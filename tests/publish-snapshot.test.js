import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const project = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = path.join(project, 'test-results');
const script = fileURLToPath(new URL('../scripts/publish-snapshot.mjs', import.meta.url));
import { publishSnapshot } from '../scripts/publish-snapshot.mjs';
import {snapshotModule,writeStoredSnapshot} from '../scripts/snapshot-storage.mjs';
import {recordVintages} from '../src/vintages.js';
const git = async (cwd, ...args) => (await exec('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })).stdout.trim();
const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;

async function duringRemoteRead(setup, mutation) {
  const runner = path.join(setup.directory, 'upload-pack-race.cjs');
  await writeFile(runner, `const fs=require('node:fs'); const cp=require('node:child_process');\n${mutation}\nconst child=cp.spawnSync('git',['upload-pack',...process.argv.slice(2)],{stdio:'inherit'}); process.exit(child.status??1);\n`);
  await git(setup.cwd, 'config', 'remote.origin.uploadpack', `${shellQuote(process.execPath.replaceAll('\\', '/'))} ${shellQuote(runner.replaceAll('\\', '/'))}`);
}

for (const race of ['root', 'new archive', 'index']) test(`rejects a ${race} change during the remote check without committing or pushing`, async t => {
  const setup = await historyFixture(t, { indexed:true });
  const file = race === 'root' ? setup.destination : race === 'new archive' ? path.join(setup.cwd, 'src', setup.stored.vintageArchive.captures.at(-1).path) : path.join(setup.cwd, 'README.md');
  const mutation = `fs.writeFileSync(${JSON.stringify(file)}, ${JSON.stringify(race === 'root' ? 'export const snapshot={generation:999};\n' : 'Changed during the network wait\n')});${race === 'index' ? `cp.execFileSync('git',['add','--','README.md'],{cwd:${JSON.stringify(setup.cwd)}});` : ''}`;
  await duringRemoteRead(setup, mutation);
  await assert.rejects(publishSnapshot(setup), /changed|race|index|stag|archive|snapshot|bytes|hash/i);
  assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD'), setup.expectedHead);
  assert.equal(await setup.remoteHead(), setup.expectedHead);
  assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), race === 'index' ? 'README.md' : '', 'A refusal preserves concurrent user staging and does not stage publisher files');
});

test('the committed tree stays verified when another process stages changes during the ref update', async t => {
  const setup = await historyFixture(t, { indexed:true }), validatedRoot = await readFile(setup.destination);
  const runner = path.join(setup.directory, 'reference-race.cjs'), hook = path.join(setup.cwd, '.git/hooks/reference-transaction');
  await writeFile(runner, `if(process.argv[2]==='prepared'){const fs=require('node:fs'); const cp=require('node:child_process'); fs.writeFileSync(${JSON.stringify(setup.destination)},'export const snapshot={generation:999};\\n'); fs.writeFileSync(${JSON.stringify(path.join(setup.cwd,'README.md'))},'Concurrent staging remains local\\n'); cp.execFileSync('git',['add','--','src/official-snapshot.js','README.md'],{cwd:${JSON.stringify(setup.cwd)}});}\n`);
  await writeFile(hook, `#!/bin/sh\n${shellQuote(process.execPath.replaceAll('\\','/'))} ${shellQuote(runner.replaceAll('\\','/'))} "$1"\n`);
  await chmod(hook, 0o755);
  const result = await publishSnapshot(setup);
  const committed = (await exec('git', ['show', `${result.commitSha}:src/official-snapshot.js`], { cwd:setup.cwd, encoding:'buffer' })).stdout;
  assert.deepEqual(committed, validatedRoot, 'The commit uses the verified tree instead of reading the changed index again');
  assert.equal(await git(setup.cwd,'rev-parse',`${result.commitSha}^`),setup.expectedHead);
  assert.equal(await setup.remoteHead(),result.commitSha);
  assert.deepEqual((await git(setup.cwd,'diff','--cached','--name-only')).split('\n').sort(),['README.md','src/official-snapshot.js']);
  assert.deepEqual((await git(setup.cwd,'show','--format=','--name-only',result.commitSha)).split('\n').sort(),['src/official-snapshot.js',...setup.stored.vintageArchive.captures.slice(1).map(entry=>'src/'+entry.path)].sort());
});

test('a local HEAD change during the remote check is preserved and refuses publication', async t => {
  const setup = await historyFixture(t, { indexed:true });
  await duringRemoteRead(setup, `cp.execFileSync('git',['commit','--allow-empty','-m','Concurrent local commit'],{cwd:${JSON.stringify(setup.cwd)}});`);
  await assert.rejects(publishSnapshot(setup), /HEAD.*changed|checkout/i);
  const concurrent = await git(setup.cwd, 'rev-parse', 'HEAD');
  assert.notEqual(concurrent, setup.expectedHead);
  assert.equal(await git(setup.cwd,'rev-parse','HEAD^'),setup.expectedHead);
  assert.equal(await setup.remoteHead(),setup.expectedHead);
  assert.equal(await git(setup.cwd,'diff','--cached','--name-only'),'');
});

for (const kind of ['root', 'new archive']) test(`staged ${kind} bytes must match the validated bytes`, async t => {
  const setup = await historyFixture(t, { indexed:true }), original = await readFile(setup.destination);
  const filename = kind === 'root' ? 'src/official-snapshot.js' : 'src/'+setup.stored.vintageArchive.captures.at(-1).path;
  const runner = path.join(setup.directory,'clean-filter.cjs');
  await writeFile(runner, `process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('Changed by clean filter\\n'));\n`);
  await writeFile(path.join(setup.cwd,'.git/info/attributes'),`${filename} filter=publication-race\n`);
  await git(setup.cwd,'config','filter.publication-race.clean',`${shellQuote(process.execPath.replaceAll('\\','/'))} ${shellQuote(runner.replaceAll('\\','/'))}`);
  await git(setup.cwd,'config','filter.publication-race.required','true');
  await assert.rejects(publishSnapshot(setup), /staged.*(snapshot|archive|bytes|validated)/i);
  assert.equal(await git(setup.cwd,'rev-parse','HEAD'),setup.expectedHead);
  assert.equal(await setup.remoteHead(),setup.expectedHead);
  assert.deepEqual(await readFile(setup.destination),original,'Publication refusal never resets working files');
});

async function historyFixture(t,{indexed=false}={}){
  const setup=await fixture(t),at=['2026-10-20T12:00:00.000Z','2026-10-21T12:00:00.000Z'];
  const source=(time,value)=>({id:'bls',fetchedAt:time,provenance:[{url:'https://api.bls.gov/publicAPI/v1/timeseries/data/',sha256:'a'.repeat(64),retrievedAt:time}],series:{unrate:{sourceIds:['LNS14000000'],sourceUrl:'https://api.bls.gov/publicAPI/v1/timeseries/data/',observations:[{date:'2026-09-01',value,publishedAt:null}]}}});
  const previous={sources:{bls:source(at[0],4.1)},vintages:recordVintages(null,{}, {bls:source(at[0],4.1)},{checkedAt:at[0]})};
  const destination=path.join(setup.cwd,'src/official-snapshot.js');let root=previous;
  if(indexed)root=await writeStoredSnapshot(previous,{destination});else await writeFile(destination,snapshotModule(previous));
  await git(setup.cwd,'add','--','src/official-snapshot.js',...(root.vintageArchive?.captures??[]).map(entry=>'src/'+entry.path));
  await git(setup.cwd,'commit','-m','Verified prior capture');await git(setup.cwd,'push','origin','HEAD:refs/heads/main');setup.expectedHead=await git(setup.cwd,'rev-parse','HEAD');
  const next={sources:{bls:source(at[1],4.2)},vintages:recordVintages(previous.vintages,previous.sources,{bls:source(at[1],4.2)},{checkedAt:at[1]})};
  const stored=await writeStoredSnapshot(next,{destination,previous:root});return {...setup,root,stored,destination};
}

test('publishes migrated root and every newly referenced immutable blob together, excluding orphans',async t=>{
 const setup=await historyFixture(t),orphan=path.join(setup.cwd,'src/history','f'.repeat(64)+'.json.gz');await writeFile(orphan,'Unreferenced local file');
 const result=await publishSnapshot(setup);const files=(await git(setup.cwd,'show','--format=','--name-only',result.commitSha)).split('\n').sort();
 assert.deepEqual(files,['src/official-snapshot.js',...setup.stored.vintageArchive.captures.map(entry=>'src/'+entry.path)].sort());
 assert.equal(await git(setup.cwd,'ls-files','--',path.relative(setup.cwd,orphan)),'');assert.equal(await setup.remoteHead(),result.commitSha);
});

test('publication rejects any edit or deletion to an already committed immutable capture',async t=>{
 for(const remove of [false,true]){const setup=await historyFixture(t,{indexed:true}),file=path.join(setup.cwd,'src',setup.root.vintageArchive.captures[0].path);if(remove)await rm(file);else await writeFile(file,'Changed old capture');await assert.rejects(publishSnapshot(setup),/immutable|tracked|archive/i);assert.equal(await setup.remoteHead(),setup.expectedHead);assert.equal(await git(setup.cwd,'diff','--cached','--name-only'),'');}
});

test('publication rejects missing or corrupted new history before touching the index',async t=>{
 for(const remove of [false,true]){const setup=await historyFixture(t,{indexed:true}),file=path.join(setup.cwd,'src',setup.stored.vintageArchive.captures.at(-1).path);if(remove)await rm(file);else await writeFile(file,'Bad new bytes');await assert.rejects(publishSnapshot(setup),/ENOENT|archive|hash|size|missing/i);assert.equal(await setup.remoteHead(),setup.expectedHead);assert.equal(await git(setup.cwd,'diff','--cached','--name-only'),'');}
});

test('publication refuses pruning an immutable index even when current observations are valid',async t=>{
 const setup=await historyFixture(t,{indexed:true});setup.stored.vintageArchive.captures=[];await writeFile(setup.destination,snapshotModule(setup.stored));await assert.rejects(publishSnapshot(setup),/prefix|prun|immutable|capture|history/i);assert.equal(await setup.remoteHead(),setup.expectedHead);
});

async function fixture(t) {
  await mkdir(temporaryRoot, { recursive: true });
  const directory = await mkdtemp(path.join(temporaryRoot, 'publish-snapshot-'));
  t.after(async () => {
    const relative = path.relative(temporaryRoot, directory);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Cleanup must remain within test-results');
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const remote = path.join(directory, 'origin.git'), cwd = path.join(directory, 'checkout');
  await mkdir(cwd);
  await git(directory, 'init', '--bare', remote);
  await git(cwd, 'init', '-b', 'main');
  await git(cwd, 'config', 'user.name', 'Fixture Author');
  await git(cwd, 'config', 'user.email', 'fixture@example.test');
  await git(cwd, 'config', 'core.autocrlf', 'false');
  await mkdir(path.join(cwd, 'src'));
  await writeFile(path.join(cwd, 'src/official-snapshot.js'), 'export const snapshot = { generation: 1 };\n');
  await writeFile(path.join(cwd, 'README.md'), 'Fixture project\n');
  await git(cwd, 'add', 'src/official-snapshot.js', 'README.md');
  await git(cwd, 'commit', '-m', 'Initial fixture');
  await git(cwd, 'remote', 'add', 'origin', remote);
  await git(cwd, 'push', 'origin', 'HEAD:refs/heads/main');
  await git(directory, '--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const expectedHead = await git(cwd, 'rev-parse', 'HEAD');
  const modifySnapshot = () => writeFile(path.join(cwd, 'src/official-snapshot.js'), 'export const snapshot = { generation: 2 };\n');
  const remoteHead = () => git(directory, '--git-dir', remote, 'rev-parse', 'refs/heads/main');
  return { directory, cwd, remote, expectedHead, modifySnapshot, remoteHead };
}

test('publishes only the refreshed snapshot to main with a bot author', async t => {
  const setup = await fixture(t);
  await setup.modifySnapshot();
  await writeFile(path.join(setup.cwd, 'local-note.txt'), 'Untracked files must not be published.\n');
  const result = await publishSnapshot(setup);
  assert.equal(result.changed, true);
  assert.match(result.commitSha, /^[a-f0-9]{40}$/);
  assert.notEqual(result.commitSha, setup.expectedHead);
  assert.equal(await setup.remoteHead(), result.commitSha);
  assert.equal(await git(setup.cwd, 'show', '--format=', '--name-only', result.commitSha), 'src/official-snapshot.js');
  assert.equal(await git(setup.cwd, 'show', '--format=%an <%ae>', '--no-patch', result.commitSha), 'github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>');
  assert.equal(await git(setup.cwd, 'status', '--porcelain'), '?? local-note.txt');
  assert.equal(await git(setup.cwd, 'config', 'user.name'), 'Fixture Author', 'Bot identity does not rewrite local user configuration');
});

test('an unchanged snapshot returns its exact SHA without an empty commit', async t => {
  const setup = await fixture(t);
  assert.deepEqual(await publishSnapshot(setup), { commitSha: setup.expectedHead, changed: false });
  assert.equal(await setup.remoteHead(), setup.expectedHead);
  assert.equal(await git(setup.cwd, 'rev-list', '--count', 'HEAD'), '1');
});

test('rejects unrelated tracked changes before staging or committing the snapshot', async t => {
  const setup = await fixture(t);
  await setup.modifySnapshot();
  await writeFile(path.join(setup.cwd, 'README.md'), 'Unrelated change\n');
  await assert.rejects(publishSnapshot(setup), /unrelated.*tracked|tracked.*snapshot/i);
  assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD'), setup.expectedHead);
  assert.equal(await setup.remoteHead(), setup.expectedHead);
  assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), '');
});

test('rejects every pre-staged change, including a pre-staged snapshot', async t => {
  for (const stagedPath of ['README.md', 'src/official-snapshot.js']) {
    const setup = await fixture(t);
    await setup.modifySnapshot();
    if (stagedPath === 'README.md') await writeFile(path.join(setup.cwd, stagedPath), 'Staged unrelated change\n');
    await git(setup.cwd, 'add', '--', stagedPath);
    await assert.rejects(publishSnapshot(setup), /stag|index/i);
    assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD'), setup.expectedHead);
    assert.equal(await setup.remoteHead(), setup.expectedHead);
    assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), stagedPath, 'A rejected publication leaves the existing index untouched');
  }
});

test('rejects malformed expected SHAs and a checkout different from the expected commit', async t => {
  const setup = await fixture(t);
  await setup.modifySnapshot();
  for (const expectedHead of [undefined, '', 'main', '-HEAD', `${setup.expectedHead}\n`, '0'.repeat(40)]) {
    await assert.rejects(publishSnapshot({ ...setup, expectedHead }), /expected.*(SHA|HEAD|commit)|checkout/i);
    assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD'), setup.expectedHead);
    assert.equal(await setup.remoteHead(), setup.expectedHead);
    assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), '');
  }
});

async function competingCommit(setup) {
  const racer = path.join(setup.directory, 'competing-checkout');
  await git(setup.directory, 'clone', setup.remote, racer);
  await git(racer, 'config', 'user.name', 'Other Author');
  await git(racer, 'config', 'user.email', 'other@example.test');
  await writeFile(path.join(racer, 'README.md'), 'A concurrent development commit\n');
  await git(racer, 'add', 'README.md');
  await git(racer, 'commit', '-m', 'Concurrent development');
  return { racer, sha: await git(racer, 'rev-parse', 'HEAD') };
}

test('a newer remote main prevents publication, including when the snapshot is unchanged', async t => {
  for (const changed of [true, false]) {
    const setup = await fixture(t);
    if (changed) await setup.modifySnapshot();
    const other = await competingCommit(setup);
    await git(other.racer, 'push', 'origin', 'HEAD:refs/heads/main');
    await assert.rejects(publishSnapshot(setup), /main.*(changed|advanced|match)|stale|remote/i);
    assert.equal(await setup.remoteHead(), other.sha);
    assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD'), setup.expectedHead);
    assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), '');
  }
});

test('a push-time race fails without overwriting or rebasing concurrent work', async t => {
  const setup = await fixture(t);
  await setup.modifySnapshot();
  const other = await competingCommit(setup);
  const hook = path.join(setup.cwd, '.git/hooks/pre-push');
  const runner = path.join(setup.directory, 'race.cjs');
  await writeFile(runner, `require('node:child_process').execFileSync('git', ['push', 'origin', 'HEAD:refs/heads/main'], { cwd: ${JSON.stringify(other.racer)}, stdio: 'inherit' });\n`);
  const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;
  await writeFile(hook, `#!/bin/sh\n${shellQuote(process.execPath.replaceAll('\\', '/'))} ${shellQuote(runner.replaceAll('\\', '/'))}\n`);
  await chmod(hook, 0o755);
  await assert.rejects(publishSnapshot(setup), /push|failed|rejected|cannot lock/i);
  assert.equal(await setup.remoteHead(), other.sha);
  assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD^'), setup.expectedHead, 'The local snapshot commit retains the original parent');
  assert.equal(await git(setup.cwd, 'show', '--format=', '--name-only', 'HEAD'), 'src/official-snapshot.js');
});

test('CLI writes the successful commit SHA and run summary, using GITHUB_SHA as a fallback', async t => {
  const setup = await fixture(t);
  await setup.modifySnapshot();
  const output = path.join(setup.directory, 'outputs'), summary = path.join(setup.directory, 'summary.md');
  await exec(process.execPath, [script], { cwd: setup.cwd, env: { ...process.env, EXPECTED_HEAD: '', GITHUB_SHA: setup.expectedHead, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary } });
  const sha = await setup.remoteHead();
  assert.equal(await readFile(output, 'utf8'), `commit_sha=${sha}\n`);
  assert.match(await readFile(summary, 'utf8'), new RegExp(sha));
  assert.match(await readFile(summary, 'utf8'), /refresh|snapshot/i);
});

test('CLI failures exit nonzero without emitting a deployable SHA', async t => {
  const setup = await fixture(t);
  await setup.modifySnapshot();
  const output = path.join(setup.directory, 'outputs');
  await writeFile(output, 'existing=value\n');
  await assert.rejects(exec(process.execPath, [script], { cwd: setup.cwd, env: { ...process.env, EXPECTED_HEAD: '0'.repeat(40), GITHUB_SHA: setup.expectedHead, GITHUB_OUTPUT: output } }), /expected.*(HEAD|commit)|checkout/i);
  assert.equal(await readFile(output, 'utf8'), 'existing=value\n');
  assert.equal(await setup.remoteHead(), setup.expectedHead);
});
