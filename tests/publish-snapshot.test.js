import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, rm, chmod } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { publishSnapshot } from '../scripts/publish-snapshot.mjs';
import { encodeStoredSnapshot, writeStoredSnapshot } from '../scripts/snapshot-storage.mjs';
import { recordVintages } from '../src/vintages.js';

const exec = promisify(execFile);
const project = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = path.join(project, 'test-results');
const script = fileURLToPath(new URL('../scripts/publish-snapshot.mjs', import.meta.url));
const snapshotPath = 'src/official-snapshot.json.gz';
const git = async (cwd, ...args) => (await exec('git', args, {
  cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
})).stdout.trim();
const shellQuote = value => `'${value.replaceAll("'", "'\\''")}'`;
const shellRunner = runner => [process.execPath, runner].map(value => shellQuote(value.replaceAll('\\', '/'))).join(' ');
const writeSnapshot = (filename, value) => writeFile(filename, encodeStoredSnapshot(value));
const writeRunner = (filename, lines) => writeFile(filename, lines.join('\n') + '\n');
const fileMutation = (filename, bytes) => {
  const encoded = JSON.stringify(Buffer.from(bytes).toString('base64'));
  return `fs.writeFileSync(${JSON.stringify(filename)},Buffer.from(${encoded},'base64'));`;
};
const gitMutation = (cwd, args) => `cp.execFileSync('git',${JSON.stringify(args)},{cwd:${JSON.stringify(cwd)}});`;
const committedFiles = async (cwd, revision) => (await git(cwd, 'show', '--format=', '--name-only', revision)).split('\n').sort();
const archivePaths = root => (root.vintageArchive?.captures ?? []).map(entry => 'src/' + entry.path);

async function duringRemoteRead(setup, mutation) {
  const runner = path.join(setup.directory, 'upload-pack-race.cjs');
  await writeRunner(runner, [
    "const fs=require('node:fs'); const cp=require('node:child_process');",
    mutation,
    "const child=cp.spawnSync('git',['upload-pack',...process.argv.slice(2)],{stdio:'inherit'});",
    'process.exit(child.status??1);',
  ]);
  await git(setup.cwd, 'config', 'remote.origin.uploadpack', shellRunner(runner));
}

for (const race of ['root', 'new archive', 'index']) {
  test(`rejects a ${race} change during the remote check without committing or pushing`, async t => {
    const setup = await historyFixture(t, { indexed: true });
    const file = race === 'root' ? setup.destination : race === 'new archive'
      ? path.join(setup.cwd, 'src', setup.stored.vintageArchive.captures.at(-1).path)
      : path.join(setup.cwd, 'README.md');
    const changed = race === 'root' ? encodeStoredSnapshot({ generation: 999 }) : 'Changed during the network wait\n';
    const mutation = [
      fileMutation(file, changed),
      race === 'index' ? gitMutation(setup.cwd, ['add', '--', 'README.md']) : '',
    ].join('\n');
    await duringRemoteRead(setup, mutation);
    await assert.rejects(publishSnapshot(setup), /changed|race|index|stag|archive|snapshot|bytes|hash/i);
    assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD'), setup.expectedHead);
    assert.equal(await setup.remoteHead(), setup.expectedHead);
    assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), race === 'index' ? 'README.md' : '',
      'A refusal preserves concurrent user staging and does not stage publisher files');
  });
}

test('the committed tree stays verified when another process stages changes during the ref update', async t => {
  const setup = await historyFixture(t, { indexed: true });
  const validatedRoot = await readFile(setup.destination);
  const runner = path.join(setup.directory, 'reference-race.cjs');
  const hook = path.join(setup.cwd, '.git/hooks/reference-transaction');
  await writeRunner(runner, [
    "if(process.argv[2]==='prepared'){",
    "const fs=require('node:fs'); const cp=require('node:child_process');",
    fileMutation(setup.destination, encodeStoredSnapshot({ generation: 999 })),
    fileMutation(path.join(setup.cwd, 'README.md'), 'Concurrent staging remains local\n'),
    gitMutation(setup.cwd, ['add', '--', snapshotPath, 'README.md']),
    '}',
  ]);
  await writeRunner(hook, ['#!/bin/sh', `${shellRunner(runner)} "$1"`]);
  await chmod(hook, 0o755);
  const result = await publishSnapshot(setup);
  const committed = (await exec('git', ['show', `${result.commitSha}:${snapshotPath}`], {
    cwd: setup.cwd, encoding: 'buffer',
  })).stdout;
  assert.deepEqual(committed, validatedRoot, 'The commit uses the verified tree instead of reading the changed index again');
  assert.equal(await git(setup.cwd, 'rev-parse', `${result.commitSha}^`), setup.expectedHead);
  assert.equal(await setup.remoteHead(), result.commitSha);
  const staged = (await git(setup.cwd, 'diff', '--cached', '--name-only')).split('\n').sort();
  assert.deepEqual(staged, ['README.md', snapshotPath]);
  assert.deepEqual(await committedFiles(setup.cwd, result.commitSha), [snapshotPath, ...archivePaths(setup.stored).slice(1)].sort());
});

test('a local HEAD change during the remote check is preserved and refuses publication', async t => {
  const setup = await historyFixture(t, { indexed: true });
  await duringRemoteRead(setup, gitMutation(setup.cwd, ['commit', '--allow-empty', '-m', 'Concurrent local commit']));
  await assert.rejects(publishSnapshot(setup), /HEAD.*changed|checkout/i);
  const concurrent = await git(setup.cwd, 'rev-parse', 'HEAD');
  assert.notEqual(concurrent, setup.expectedHead);
  assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD^'), setup.expectedHead);
  assert.equal(await setup.remoteHead(), setup.expectedHead);
  assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), '');
});

for (const kind of ['root', 'new archive']) {
  test(`staged ${kind} bytes must match the validated bytes`, async t => {
    const setup = await historyFixture(t, { indexed: true });
    const original = await readFile(setup.destination);
    const filename = kind === 'root' ? snapshotPath : 'src/' + setup.stored.vintageArchive.captures.at(-1).path;
    const runner = path.join(setup.directory, 'clean-filter.cjs');
    await writeFile(runner, "process.stdin.resume();process.stdin.on('end',()=>process.stdout.write('Changed by clean filter\\n'));\n");
    await writeFile(path.join(setup.cwd, '.git/info/attributes'), `${filename} filter=publication-race\n`);
    await git(setup.cwd, 'config', 'filter.publication-race.clean', shellRunner(runner));
    await git(setup.cwd, 'config', 'filter.publication-race.required', 'true');
    await assert.rejects(publishSnapshot(setup), /staged.*(snapshot|archive|bytes|validated)/i);
    assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD'), setup.expectedHead);
    assert.equal(await setup.remoteHead(), setup.expectedHead);
    assert.deepEqual(await readFile(setup.destination), original, 'Publication refusal never resets working files');
  });
}

async function historyFixture(t, { indexed = false } = {}) {
  const setup = await fixture(t);
  const at = ['2026-10-20T12:00:00.000Z', '2026-10-21T12:00:00.000Z'];
  const url = 'https://api.bls.gov/publicAPI/v1/timeseries/data/';
  const source = (time, value) => ({
    id: 'bls', fetchedAt: time,
    provenance: [{ url, sha256: 'a'.repeat(64), retrievedAt: time }],
    series: { unrate: {
      sourceIds: ['LNS14000000'], sourceUrl: url,
      observations: [{ date: '2026-09-01', value, publishedAt: null }],
    } },
  });
  const previous = {
    sources: { bls: source(at[0], 4.1) },
    vintages: recordVintages(null, {}, { bls: source(at[0], 4.1) }, { checkedAt: at[0] }),
  };
  const destination = path.join(setup.cwd, snapshotPath);
  let root = previous;
  if (indexed) root = await writeStoredSnapshot(previous, { destination });
  else await writeSnapshot(destination, previous);
  await git(setup.cwd, 'add', '--', snapshotPath, ...archivePaths(root));
  await git(setup.cwd, 'commit', '-m', 'Verified prior capture');
  await git(setup.cwd, 'push', 'origin', 'HEAD:refs/heads/main');
  setup.expectedHead = await git(setup.cwd, 'rev-parse', 'HEAD');
  const next = {
    sources: { bls: source(at[1], 4.2) },
    vintages: recordVintages(previous.vintages, previous.sources, { bls: source(at[1], 4.2) }, { checkedAt: at[1] }),
  };
  const stored = await writeStoredSnapshot(next, { destination, previous: root });
  return { ...setup, root, stored, destination };
}

test('publishes migrated root and every newly referenced immutable blob together, excluding orphans', async t => {
  const setup = await historyFixture(t);
  const orphan = path.join(setup.cwd, 'src/history', 'f'.repeat(64) + '.json.gz');
  await writeFile(orphan, 'Unreferenced local file');
  const result = await publishSnapshot(setup);
  assert.deepEqual(await committedFiles(setup.cwd, result.commitSha), [snapshotPath, ...archivePaths(setup.stored)].sort());
  assert.equal(await git(setup.cwd, 'ls-files', '--', path.relative(setup.cwd, orphan)), '');
  assert.equal(await setup.remoteHead(), result.commitSha);
});

test('publication rejects any edit or deletion to an already committed immutable capture', async t => {
  for (const remove of [false, true]) {
    const setup = await historyFixture(t, { indexed: true });
    const file = path.join(setup.cwd, 'src', setup.root.vintageArchive.captures[0].path);
    if (remove) await rm(file);
    else await writeFile(file, 'Changed old capture');
    await assert.rejects(publishSnapshot(setup), /immutable|tracked|archive/i);
    assert.equal(await setup.remoteHead(), setup.expectedHead);
    assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), '');
  }
});

test('publication rejects missing or corrupted new history before touching the index', async t => {
  for (const remove of [false, true]) {
    const setup = await historyFixture(t, { indexed: true });
    const file = path.join(setup.cwd, 'src', setup.stored.vintageArchive.captures.at(-1).path);
    if (remove) await rm(file);
    else await writeFile(file, 'Bad new bytes');
    await assert.rejects(publishSnapshot(setup), /ENOENT|archive|hash|size|missing/i);
    assert.equal(await setup.remoteHead(), setup.expectedHead);
    assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), '');
  }
});

test('publication refuses pruning an immutable index even when current observations are valid', async t => {
  const setup = await historyFixture(t, { indexed: true });
  setup.stored.vintageArchive.captures = [];
  await writeSnapshot(setup.destination, setup.stored);
  await assert.rejects(publishSnapshot(setup), /prefix|prun|immutable|capture|history/i);
  assert.equal(await setup.remoteHead(), setup.expectedHead);
});

async function fixture(t) {
  await mkdir(temporaryRoot, { recursive: true });
  const directory = await mkdtemp(path.join(temporaryRoot, 'publish-snapshot-'));
  t.after(async () => {
    const relative = path.relative(temporaryRoot, directory);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), 'Cleanup must remain within test-results');
    await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const remote = path.join(directory, 'origin.git');
  const cwd = path.join(directory, 'checkout');
  await mkdir(cwd);
  await git(directory, 'init', '--bare', remote);
  await git(cwd, 'init', '-b', 'main');
  await git(cwd, 'config', 'user.name', 'Fixture Author');
  await git(cwd, 'config', 'user.email', 'fixture@example.test');
  await git(cwd, 'config', 'core.autocrlf', 'false');
  await mkdir(path.join(cwd, 'src'));
  await writeSnapshot(path.join(cwd, snapshotPath), { generation: 1 });
  await writeFile(path.join(cwd, 'README.md'), 'Fixture project\n');
  await git(cwd, 'add', snapshotPath, 'README.md');
  await git(cwd, 'commit', '-m', 'Initial fixture');
  await git(cwd, 'remote', 'add', 'origin', remote);
  await git(cwd, 'push', 'origin', 'HEAD:refs/heads/main');
  await git(directory, '--git-dir', remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  const expectedHead = await git(cwd, 'rev-parse', 'HEAD');
  const modifySnapshot = () => writeSnapshot(path.join(cwd, snapshotPath), { generation: 2 });
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
  assert.equal(await git(setup.cwd, 'show', '--format=', '--name-only', result.commitSha), snapshotPath);
  const author = await git(setup.cwd, 'show', '--format=%an <%ae>', '--no-patch', result.commitSha);
  assert.equal(author, 'github-actions[bot] <41898282+github-actions[bot]@users.noreply.github.com>');
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
  for (const stagedPath of ['README.md', snapshotPath]) {
    const setup = await fixture(t);
    await setup.modifySnapshot();
    if (stagedPath === 'README.md') await writeFile(path.join(setup.cwd, stagedPath), 'Staged unrelated change\n');
    await git(setup.cwd, 'add', '--', stagedPath);
    await assert.rejects(publishSnapshot(setup), /stag|index/i);
    assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD'), setup.expectedHead);
    assert.equal(await setup.remoteHead(), setup.expectedHead);
    assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), stagedPath,
      'A rejected publication leaves the existing index untouched');
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

test('rejects malformed compressed roots before staging or publishing', async t => {
  const setup = await fixture(t);
  await writeFile(path.join(setup.cwd, snapshotPath), 'Invalid gzip');
  await assert.rejects(publishSnapshot(setup), /gzip|snapshot|compress|header/i);
  assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD'), setup.expectedHead);
  assert.equal(await setup.remoteHead(), setup.expectedHead);
  assert.equal(await git(setup.cwd, 'diff', '--cached', '--name-only'), '');
});

test('a publication exceeding the commit delta budget cannot create a commit or advance either ref', async t => {
  const setup = await fixture(t);
  const bytes = encodeStoredSnapshot({ generation: 2, diagnostic: randomBytes(9 * 1024 ** 2).toString('base64') });
  assert.ok(bytes.length > 8 * 1024 ** 2 && bytes.length < 20 * 1024 ** 2, 'The valid root exceeds only the commit delta budget');
  await writeFile(path.join(setup.cwd, snapshotPath), bytes);
  await assert.rejects(publishSnapshot(setup), /repository budget exceeded.*commit delta/is);
  assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD'), setup.expectedHead);
  assert.equal(await setup.remoteHead(), setup.expectedHead);
  const objectTypes = await git(setup.cwd, 'cat-file', '--batch-all-objects', '--batch-check=%(objecttype)');
  assert.equal(objectTypes.split('\n').filter(type => type === 'commit').length, 1, 'Even an unreachable publication commit must not exist');
  assert.deepEqual(await readFile(path.join(setup.cwd, snapshotPath)), bytes);
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
  await writeRunner(runner, [
    "const cp=require('node:child_process');",
    gitMutation(other.racer, ['push', 'origin', 'HEAD:refs/heads/main']),
  ]);
  await writeRunner(hook, ['#!/bin/sh', shellRunner(runner)]);
  await chmod(hook, 0o755);
  await assert.rejects(publishSnapshot(setup), /push|failed|rejected|cannot lock/i);
  assert.equal(await setup.remoteHead(), other.sha);
  assert.equal(await git(setup.cwd, 'rev-parse', 'HEAD^'), setup.expectedHead, 'The local snapshot commit retains the original parent');
  assert.equal(await git(setup.cwd, 'show', '--format=', '--name-only', 'HEAD'), snapshotPath);
});

test('CLI writes the successful commit SHA and run summary, using GITHUB_SHA as a fallback', async t => {
  const setup = await fixture(t);
  await setup.modifySnapshot();
  const output = path.join(setup.directory, 'outputs');
  const summary = path.join(setup.directory, 'summary.md');
  await exec(process.execPath, [script], {
    cwd: setup.cwd,
    env: { ...process.env, EXPECTED_HEAD: '', GITHUB_SHA: setup.expectedHead, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary },
  });
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
  const run = () => exec(process.execPath, [script], {
    cwd: setup.cwd,
    env: { ...process.env, EXPECTED_HEAD: '0'.repeat(40), GITHUB_SHA: setup.expectedHead, GITHUB_OUTPUT: output },
  });
  await assert.rejects(run(), /expected.*(HEAD|commit)|checkout/i);
  assert.equal(await readFile(output, 'utf8'), 'existing=value\n');
  assert.equal(await setup.remoteHead(), setup.expectedHead);
});
