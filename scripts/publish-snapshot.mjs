import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { appendFile,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {loadSnapshotHistory,validateArchiveIndex,assertArchivePrefix} from './snapshot-storage.mjs';
import {assertCommercialData} from './data-policy.mjs';

const exec = promisify(execFile);
const snapshotPath = 'src/official-snapshot.js';
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const paths = output => output.split('\0').filter(Boolean);

export async function publishSnapshot({ cwd = process.cwd(), expectedHead } = {}) {
  if (typeof expectedHead !== 'string' || expectedHead.length !== 40 || !/^[a-f0-9]{40}$/i.test(expectedHead)) throw new Error('Expected HEAD must be a complete 40-character commit SHA.');
  expectedHead = expectedHead.toLowerCase();
  const git = async (...args) => (await exec('git', args, { cwd,maxBuffer:64*1024*1024, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })).stdout;
  const gitBytes=async(...args)=>(await exec('git',args,{cwd,encoding:'buffer',maxBuffer:64*1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}})).stdout;
  const head = (await git('rev-parse', 'HEAD')).trim();
  if (head !== expectedHead) throw new Error('The checkout HEAD differs from the expected commit; refusing to publish.');
  if ((await git('diff', '--cached', '--name-only', '-z')).length) throw new Error('The index contains pre-staged changes; refusing to publish.');
  const changedPaths = (await git('diff', '--name-only', '-z')).split('\0').filter(Boolean);
  if (changedPaths.some(file => file !== snapshotPath)) throw new Error('Unrelated tracked changes or edits/deletions to immutable history exist outside the official snapshot; refusing to publish.');

  const importSnapshot=async code=>{
    const result=(await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).snapshot;
    if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('Invalid generated snapshot root');
    return result;
  };
  const previousBytes=await gitBytes('show',`${expectedHead}:${snapshotPath}`);
  const validatedRoot=await readFile(path.join(cwd,snapshotPath));
  const previous=await importSnapshot(previousBytes);
  const next=await importSnapshot(validatedRoot);
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
  const remote = (await git('ls-remote', '--exit-code', 'origin', 'refs/heads/main')).trim();
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
  // commit-tree consumes the verified immutable tree, never a second read of a
  // mutable index. The compare-and-swap retains the exact expected parent.
  const commitSha=(await git('-c','user.name=github-actions[bot]','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com','commit-tree',tree,'-p',expectedHead,'-m','data: refresh official data and release calendars')).trim();
  await git('update-ref','-m','data: publish verified official snapshot','HEAD',commitSha,expectedHead);
  // A concurrent remote update after ls-remote is rejected by this normal push.
  await git('push', 'origin', `${commitSha}:refs/heads/main`);
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
