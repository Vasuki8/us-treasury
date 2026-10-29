import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFile,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {loadSnapshotHistory,validateArchiveIndex,assertArchivePrefix,decodeStoredSnapshot} from './snapshot-storage.mjs';
import {assertCommercialData} from './data-policy.mjs';
import {assertTreeBudget} from './repository-budget.mjs';

const exec = promisify(execFile);
const snapshotPath = 'src/official-snapshot.json.gz';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = output => output.split('\0').filter(Boolean);

function transientGitFailure(error){
  if(error?.signal||error?.killed)return false;
  const detail=`${error?.message??''}\n${error?.stderr??''}`.slice(-8192);
  if(/authentication failed|permission denied|access denied|could not read username|returned error:\s*40[13]|pre-receive hook declined|non-fast-forward|\[rejected\]/i.test(detail))return false;
  return ['ETIMEDOUT','ECONNRESET','ECONNREFUSED','EAI_AGAIN','ENETUNREACH','EHOSTUNREACH'].includes(error?.code)||/could not resolve host|failed to connect|connection (?:reset|timed out|closed unexpectedly)|operation timed out|returned error:\s*50\d|HTTP\s+50\d|RPC failed|remote end hung up|unexpected disconnect|recv failure|empty reply from server|early EOF/i.test(detail);
}

/** Retry the pre-publication network read before any staging or commit changes. */
export async function readPublicationRemote({git,maxAttempts=1,sleepImpl=delay}={}){
  if(typeof git!=='function'||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3)throw new Error('Invalid publication remote retry configuration.');
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{return (await git('ls-remote','--exit-code','origin','refs/heads/main')).trim();}
    catch(error){
      if(!transientGitFailure(error)||attempt===maxAttempts)throw new Error('Publication remote check failed; publication was not attempted.');
      await sleepImpl(attempt===1?5000:30000);
    }
  }
}

/** Retry only the immutable verified commit; a fresh remote guard precedes every push. */
export async function pushVerifiedCommit({git,expectedHead,commitSha,maxAttempts=1,sleepImpl=delay}={}){
  if(typeof git!=='function'||!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>3||![expectedHead,commitSha].every(value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value)))throw new Error('Invalid verified publication retry configuration.');
  const failed=()=>{throw new Error('Verified snapshot push failed; publication could not be confirmed.');};
  const remoteState=async()=>{
    const remote=(await git('ls-remote','--exit-code','origin','refs/heads/main')).trim();
    if(remote===`${commitSha}\trefs/heads/main`)return 'published';
    if(remote===`${expectedHead}\trefs/heads/main`)return 'expected';
    const error=new Error('Remote main changed; refusing to retry a stale verified publication.');error.code='STALE_PUBLICATION';throw error;
  };
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      if(await remoteState()==='published')return {attempts:attempt,alreadyPublished:true};
    }catch(error){
      if(error?.code==='STALE_PUBLICATION')throw error;
      if(!transientGitFailure(error)||attempt===maxAttempts)failed();
      await sleepImpl(attempt===1?5000:30000);continue;
    }
    try{
      await git('push','origin',`${commitSha}:refs/heads/main`);
      return {attempts:attempt,alreadyPublished:false};
    }catch(error){
      if(!transientGitFailure(error))failed();
      // A transport failure may follow an accepted push. Verify before sending it again.
      try{if(await remoteState()==='published')return {attempts:attempt,alreadyPublished:true};}
      catch(readError){
        if(readError?.code==='STALE_PUBLICATION')throw readError;
        if(!transientGitFailure(readError))failed();
      }
      if(attempt===maxAttempts)failed();
      await sleepImpl(attempt===1?5000:30000);
    }
  }
}

export async function publishSnapshot({ cwd = process.cwd(), expectedHead } = {}) {
  if (typeof expectedHead !== 'string' || expectedHead.length !== 40 || !/^[a-f0-9]{40}$/i.test(expectedHead)) throw new Error('Expected HEAD must be a complete 40-character commit SHA.');
  expectedHead = expectedHead.toLowerCase();
  const maxAttempts=process.env.UPDATE_RETRY_ATTEMPTS==='3'?3:1;
  const git = async (...args) => (await exec('git', args, { cwd,maxBuffer:64*1024*1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })).stdout;
  const gitBytes=async(...args)=>(await exec('git',args,{cwd,encoding:'buffer',maxBuffer:64*1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}})).stdout;
  const head = (await git('rev-parse', 'HEAD')).trim();
  if (head !== expectedHead) throw new Error('The checkout HEAD differs from the expected commit; refusing to publish.');
  if ((await git('diff', '--cached', '--name-only', '-z')).length) throw new Error('The index contains pre-staged changes; refusing to publish.');
  const changedPaths = (await git('diff', '--name-only', '-z')).split('\0').filter(Boolean);
  if (changedPaths.some(file => file !== snapshotPath)) throw new Error('Unrelated tracked changes or edits/deletions to immutable history exist outside the official snapshot; refusing to publish.');

  const previousBytes=await gitBytes('show',`${expectedHead}:${snapshotPath}`);
  const validatedRoot=await readFile(path.join(cwd,snapshotPath));
  const previous=decodeStoredSnapshot(previousBytes);
  const next=decodeStoredSnapshot(validatedRoot);
  if(previous.vintageArchive)validateArchiveIndex(previous.vintageArchive);
  if(next.vintageArchive)validateArchiveIndex(next.vintageArchive);
  assertArchivePrefix(previous,next);
  const tracked=new Set((await git('ls-tree','-r','--name-only','-z',expectedHead)).split('\0').filter(Boolean));
  const referenced=(next.vintageArchive?.captures??[]).map(entry=>'src/'+entry.path);
  const newEntries=(next.vintageArchive?.captures??[]).filter(entry=>!tracked.has('src/'+entry.path));
  const rootChanged=!validatedRoot.equals(previousBytes);
  // Every already committed immutable file is checked against Git, including
  // old index entries. New files are verified by the storage reader below.
  for(const file of new Set([...(previous.vintageArchive?.captures??[]).map(entry=>'src/'+entry.path),...referenced.filter(file=>tracked.has(file))])){
    if(!tracked.has(file))throw new Error(`Previously indexed immutable history is absent from Git: ${file}`);
    const [committed,working]=await Promise.all([gitBytes('show',`${expectedHead}:${file}`),readFile(path.join(cwd,file))]);
    if(!committed.equals(working))throw new Error(`Immutable archive file was changed: ${file}`);
  }
  const history=await loadSnapshotHistory(next,{directory:path.join(cwd,'src')});
  if(Object.hasOwn(next,'sources')||Object.hasOwn(next,'vintageArchive')||Object.hasOwn(next,'vintages'))assertCommercialData({...next,vintages:history});

  // Workflow concurrency does not prevent a developer from pushing to main.
  const remote = await readPublicationRemote({git,maxAttempts});
  if (remote !== `${expectedHead}\trefs/heads/main`) throw new Error('Remote main has changed since this run started; refusing to publish a stale refresh.');
  // The remote request can overlap another local refresh or a developer staging
  // changes. Refuse those races before touching the existing index.
  if ((await git('rev-parse','HEAD')).trim() !== expectedHead) throw new Error('Checkout HEAD changed during publication; refusing to publish.');
  if ((await git('diff','--cached','--name-only','-z')).length) throw new Error('The index changed during publication; refusing to publish.');
  if (paths(await git('diff','--name-only','-z')).some(file=>file!==snapshotPath)) throw new Error('Unrelated tracked or immutable archive files changed during publication.');
  if (!(await readFile(path.join(cwd,snapshotPath))).equals(validatedRoot)) throw new Error('Snapshot root changed during publication.');
  for (const entry of newEntries) {
    const bytes=await readFile(path.join(cwd,'src',entry.path));
    if (bytes.length!==entry.bytes || sha256(bytes)!==entry.sha256) throw new Error('New immutable archive bytes changed during publication.');
  }
  if (!rootChanged) return { commitSha: expectedHead, changed: false };

  const stagePaths=[snapshotPath,...newEntries.map(entry=>'src/'+entry.path)];
  await git('add','--',...stagePaths);
  const tree=(await git('write-tree')).trim();
  const staged=paths(await git('diff-tree','--no-commit-id','--name-only','-r','-z',expectedHead,tree)).sort();
  const expectedPaths=[...stagePaths].sort();
  if (staged.length!==expectedPaths.length || staged.some((file,i)=>file!==expectedPaths[i])) throw new Error('Staged publication tree contains unexpected or missing paths.');
  const entries=paths(await git('ls-tree','-r','-z',tree,'--',...stagePaths));
  if (entries.length!==stagePaths.length || entries.some(entry=>!entry.startsWith('100644 blob '))) throw new Error('Staged snapshot and archive files must be regular non-executable blobs.');
  if (!(await gitBytes('show',`${tree}:${snapshotPath}`)).equals(validatedRoot)) throw new Error('Staged snapshot root differs from the validated bytes.');
  for (const entry of newEntries) {
    const bytes=await gitBytes('show',`${tree}:src/${entry.path}`);
    if (bytes.length!==entry.bytes || sha256(bytes)!==entry.sha256) throw new Error('Staged immutable archive differs from the validated bytes.');
  }
  await assertTreeBudget({cwd,tree,parent:expectedHead});
  // commit-tree consumes the verified immutable tree, never a second read of a
  // mutable index. The compare-and-swap retains the exact expected parent.
  const commitSha=(await git('-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit-tree',tree,'-p',expectedHead,'-m','data: refresh official data and release calendars')).trim();
  await git('update-ref','-m','data: publish verified official snapshot','HEAD',commitSha,expectedHead);
  // A concurrent remote update after ls-remote is rejected by this normal push.
  await pushVerifiedCommit({git,expectedHead,commitSha,maxAttempts});
  return { commitSha, changed: true };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await publishSnapshot({ expectedHead: process.env.EXPECTED_HEAD || process.env.GITHUB_SHA });
    const message = result.changed ? 'Refreshed official snapshot published' : 'Official snapshot unchanged';
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Official data refresh\n\n${message}: \`${result.commitSha}\`.\n`);
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `commit_sha=${result.commitSha}\n`);
    console.log(`${message}: ${result.commitSha}`);
  } catch (error) {
    console.error(error.message || String(error));
    process.exitCode = 1;
  }
}
