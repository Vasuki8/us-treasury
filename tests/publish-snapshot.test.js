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
const git = async (cwd, ...args) => (await exec('git', args, { cwd, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })).stdout.trim();

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
