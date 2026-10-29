import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { assertTreeBudget, auditRepositoryBudget } from '../scripts/repository-budget.mjs';

const exec = promisify(execFile);
const temporaryRoot = fileURLToPath(new URL('../test-results/', import.meta.url));
const script = fileURLToPath(new URL('../scripts/repository-budget.mjs', import.meta.url));
const MiB = 1024 ** 2;
const git = async (cwd, ...args) => (await exec('git', args, { cwd })).stdout.trim();

async function fixture(t) {
  await mkdir(temporaryRoot, { recursive: true });
  const cwd = await mkdtemp(path.join(temporaryRoot, 'repository-budget-'));
  t.after(async () => {
    const relative = path.relative(temporaryRoot, cwd);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    await rm(cwd, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });
  await git(cwd, 'init', '-b', 'main');
  await git(cwd, 'config', 'user.name', 'Budget fixture');
  await git(cwd, 'config', 'user.email', 'budget@example.test');
  await git(cwd, 'config', 'core.autocrlf', 'false');
  const commit = async () => {
    await git(cwd, 'add', '--all');
    await git(cwd, 'commit', '--allow-empty', '-m', 'Fixture commit');
    return git(cwd, 'rev-parse', 'HEAD');
  };
  const put = async (name, bytes) => {
    const filename = path.join(cwd, name);
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, typeof bytes === 'number' ? Buffer.alloc(bytes, 0x81) : bytes);
  };
  return { cwd, commit, put, base: await commit() };
}

test('tracked files at 20 MiB pass and one byte above fails even without content changes', async t => {
  const setup = await fixture(t);
  await setup.put('src/large.bin', 20 * MiB);
  const equal = await setup.commit();
  const metrics = await assertTreeBudget({ cwd: setup.cwd, tree: equal, parent: equal });
  assert.equal(metrics.largestFile.bytes, 20971520);
  assert.equal(metrics.deltaBytes, 0);
  await setup.put('src/large.bin', 20 * MiB + 1);
  const above = await setup.commit();
  await assert.rejects(assertTreeBudget({ cwd: setup.cwd, tree: above, parent: above }), /tracked file.*src\/large.bin/);
});

test('commit delta accepts exactly 8 MiB and counts full replacement binary bytes', async t => {
  const setup = await fixture(t);
  await setup.put('src/history/capture.json.gz', 8 * MiB);
  const equal = await setup.commit();
  const metrics = await assertTreeBudget({ cwd: setup.cwd, tree: equal, parent: setup.base });
  assert.equal(metrics.deltaBytes, 8388608);
  await setup.put('src/history/capture.json.gz', 8 * MiB + 1);
  const above = await setup.commit();
  await assert.rejects(assertTreeBudget({ cwd: setup.cwd, tree: above, parent: equal }), /commit delta.*8388609/);
});

test('delta includes all paths and aggregates smaller additions without credits for deletions', async t => {
  const setup = await fixture(t);
  await setup.put('deleted.bin', 12 * MiB);
  const before = await setup.commit();
  await rm(path.join(setup.cwd, 'deleted.bin'));
  await setup.put('docs/data snapshot Ω.bin', 4 * MiB);
  await setup.put('tests/fixtures/another.bin', 4 * MiB + 1);
  const after = await setup.commit();
  await assert.rejects(assertTreeBudget({ cwd: setup.cwd, tree: after, parent: before }), /commit delta.*8388609/);
});

test('renames count the added destination while unchanged content and mode-only changes count zero', async t => {
  const setup = await fixture(t);
  await setup.put('before.bin', 9 * MiB);
  const before = await setup.commit();
  await git(setup.cwd, 'mv', 'before.bin', 'after.bin');
  const after = await setup.commit();
  await assert.rejects(assertTreeBudget({ cwd: setup.cwd, tree: after, parent: before }), /commit delta.*9437184/);
  await git(setup.cwd, 'update-index', '--chmod=+x', 'after.bin');
  await git(setup.cwd, 'commit', '-m', 'Mode only');
  const mode = await git(setup.cwd, 'rev-parse', 'HEAD');
  assert.equal((await assertTreeBudget({ cwd: setup.cwd, tree: mode, parent: after })).deltaBytes, 0);
});

test('Git tree paths with tabs and newlines remain intact in metrics', async t => {
  const setup = await fixture(t);
  await setup.put('payload.bin', Buffer.from([0, 255, 10, 128]));
  const blob = await git(setup.cwd, 'hash-object', '-w', 'payload.bin');
  const unusual = 'src/data\ttab\nline.bin';
  await git(setup.cwd, '-c', 'core.protectNTFS=false', 'update-index', '--add', '--cacheinfo', `100644,${blob},${unusual}`);
  const tree = await git(setup.cwd, 'write-tree');
  const metrics = await assertTreeBudget({ cwd: setup.cwd, tree, parent: setup.base });
  assert.equal(metrics.deltaBytes, 4);
  assert.deepEqual(metrics.changedFiles, [{ path: unusual, bytes: 4 }]);
});

test('an incoming range audits intermediate commits even after the offending file is deleted', async t => {
  const setup = await fixture(t);
  await setup.put('temporary.bin', 8 * MiB + 1);
  const offending = await setup.commit();
  await rm(path.join(setup.cwd, 'temporary.bin'));
  const head = await setup.commit();
  await assert.rejects(
    auditRepositoryBudget({ cwd: setup.cwd, base: setup.base, head }),
    error => /commit delta/.test(error.message) && error.message.includes(offending),
  );
});

test('incoming ranges do not recheck old oversized ancestors and explicit root commits count every added blob', async t => {
  const setup = await fixture(t);
  await setup.put('old.bin', 20 * MiB + 1);
  const old = await setup.commit();
  await rm(path.join(setup.cwd, 'old.bin'));
  const head = await setup.commit();
  const report = await auditRepositoryBudget({ cwd: setup.cwd, base: old, head });
  assert.deepEqual(report.commits.map(entry => entry.commit), [head]);
  assert.equal((await assertTreeBudget({ cwd: setup.cwd, tree: setup.base, parent: null })).deltaBytes, 0);
});

test('explicit root ranges count initial content and CLI environment ranges audit each later commit', async t => {
  const setup = await fixture(t);
  await git(setup.cwd, 'checkout', '--orphan', 'new-root');
  await setup.put('root.bin', 3);
  const root = await setup.commit();
  const initial = await auditRepositoryBudget({ cwd: setup.cwd, base: '0'.repeat(40), head: root });
  assert.deepEqual(initial.commits.map(entry => [entry.commit, entry.deltaBytes]), [[root, 3]]);
  await setup.put('root.bin', 4);
  const first = await setup.commit();
  await setup.put('next.bin', 2);
  const second = await setup.commit();
  const result = await exec(process.execPath, [script], {
    cwd: setup.cwd,
    env: { ...process.env, REPOSITORY_BUDGET_BASE: root, REPOSITORY_BUDGET_HEAD: second },
  });
  const report = JSON.parse(result.stdout);
  assert.deepEqual(report.commits.map(entry => [entry.commit, entry.deltaBytes]), [[first, 4], [second, 2]]);
});

test('PR head ranges also check the checkout synthetic merge tree', async t => {
  const setup = await fixture(t);
  await git(setup.cwd, 'checkout', '-b', 'feature');
  await setup.put('feature.bin', 4);
  const head = await setup.commit();
  await git(setup.cwd, 'checkout', 'main');
  await setup.put('oversized-base.bin', 20 * MiB + 1);
  const base = await setup.commit();
  await git(setup.cwd, 'merge', '--no-ff', 'feature', '-m', 'Synthetic merge');
  await assert.rejects(auditRepositoryBudget({ cwd: setup.cwd, base, head }), /tracked file.*oversized-base.bin/);
});

test('missing parents and shallow histories fail closed instead of treating a boundary as a root', async t => {
  const setup = await fixture(t);
  const head = await setup.commit();
  await assert.rejects(assertTreeBudget({ cwd: setup.cwd, tree: head, parent: 'a'.repeat(40) }), /missing|object|parent/i);
  // Construct the same missing-parent boundary used by a depth-one clone, without a transport subprocess.
  await writeFile(path.join(setup.cwd, '.git', 'shallow'), `${head}\n`);
  await rm(path.join(setup.cwd, '.git', 'objects', setup.base.slice(0, 2), setup.base.slice(2)));
  assert.equal(await git(setup.cwd, 'rev-parse', '--is-shallow-repository'), 'true');
  await assert.rejects(auditRepositoryBudget({ cwd: setup.cwd, head }), /shallow|complete.*history/i);
});

test('CLI validates SHA inputs and reports range failures with a nonzero exit code', async t => {
  const setup = await fixture(t);
  await setup.put('data.bin', 8 * MiB + 1);
  const head = await setup.commit();
  await assert.rejects(
    exec(process.execPath, [script, `--base=${setup.base}`, `--head=${head}`], { cwd: setup.cwd }),
    error => error.code === 1 && /commit delta/.test(error.stderr),
  );
  await assert.rejects(auditRepositoryBudget({ cwd: setup.cwd, base: '--all', head }), /40-character.*SHA/);
  await assert.rejects(assertTreeBudget({ cwd: setup.cwd, tree: head }), /parent/);
});

test('workflow budget inputs select PR and main ranges, including scheduled generated commits', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const verify = workflow.slice(workflow.indexOf('\n  verify:'), workflow.indexOf('\n  deploy:'));
  const step = verify.match(/      - name: Check repository budgets\r?\n([\s\S]*?)(?=\r?\n      - name:)/)?.[1];
  assert.ok(step, 'The verification job must run the repository gate before installing dependencies');
  const expression = name => step.match(new RegExp(`${name}: >-\\r?\\n((?:            .+\\r?\\n)+)`))?.[1]
    .trim().replace(/\r?\n\s*/g, ' ').replace(/^\$\{\{\s*|\s*\}\}$/g, '');
  const render = (name, context) => vm.runInNewContext(expression(name), context, { timeout: 1000 });
  const sha = value => value.repeat(40);
  for (const [event, refreshed, expectedBase, expectedHead] of [
    ['pull_request', '', sha('b'), sha('c')],
    ['push', '', sha('d'), sha('a')],
    ['push', sha('e'), sha('d'), sha('e')],
    ['schedule', sha('e'), sha('a'), sha('e')],
    ['workflow_dispatch', '', '', sha('a')],
  ]) {
    const context = {
      github: { event_name: event, sha: sha('a'), event: { before: sha('d'), pull_request: { base: { sha: sha('b') }, head: { sha: sha('c') } } } },
      needs: { refresh: { outputs: { commit_sha: refreshed } } },
    };
    assert.equal(render('REPOSITORY_BUDGET_BASE', context), expectedBase);
    assert.equal(render('REPOSITORY_BUDGET_HEAD', context), expectedHead);
  }
  assert(verify.indexOf('Check repository budgets') < verify.indexOf('Install locked data-collector dependencies'));
  assert.match(verify, /fetch-depth: 0/);
});
