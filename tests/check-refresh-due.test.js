import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleUrl = new URL('../scripts/check-refresh-due.mjs', import.meta.url);
const execute = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const scratchRoot = path.join(root, 'test-results');
const now = new Date('2026-10-22T00:17:00.000Z');
const at = '2026-10-21T23:37:00.000Z';
const source = () => ({ status: 'ok', fetchedAt: at, lastAttemptAt: at, error: null, failure: null });
const snapshot = () => ({
  sources: Object.fromEntries(['treasury', 'bls', 'bea', 'dol', 'census'].map(id => [id, source()])),
  calendar: { sources: Object.fromEntries(['bls', 'bea', 'census', 'dol', 'treasury', 'treasury-yield-timing'].map(id => [id, source()])) },
});
const cachedBls = () => ({
  id: 'bls', status: 'error', fetchedAt: '2026-10-20T12:00:00.000Z', lastAttemptAt: at,
  failure: { kind: 'http', status: 403, redirected: false, requestedUrl: 'https://www.bls.gov/schedule/2026/home.htm', url: 'https://www.bls.gov/schedule/2026/home.htm' },
  error: 'Official source HTTP 403',
  events: [{ id: 'bls-cpi-2026', sourceId: 'bls', program: 'consumer-price-index', name: 'Consumer Price Index', seriesId: 'cpi', seriesIds: ['cpi'], date: '2026-10-29', time: '08:30', scheduledAt: '2026-10-29T12:30:00.000Z', sourceUrl: 'https://www.bls.gov/schedule/2026/home.htm' }],
  provenance: [{ url: 'https://www.bls.gov/schedule/2026/home.htm', sha256: 'a'.repeat(64) }],
});
const approvedSnapshot = () => {
  const value = snapshot();
  value.calendar.sources.bls = cachedBls();
  value.publicationPolicy = { mode: 'allow-cached-bls-calendar', cachedCalendarSources: ['bls'] };
  return value;
};

async function guard() {
  const module = await import(moduleUrl);
  assert.equal(typeof module.getDailyRefreshPlan, 'function');
  return module.getDailyRefreshPlan;
}

test('the guard skips eleven successful captures from the latest scheduled start', async () => {
  const plan = (await guard())(snapshot(), { now });
  assert.equal(plan.required, false);
  assert.equal(plan.expectedRefreshAt, at);
  assert.deepEqual(plan.pendingSources, []);
  assert.match(plan.reason, /already|complete|current/i);
});

test('a missed daily slot is due immediately at its start and remains due at both backup checks', async () => {
  const getPlan = await guard();
  const value = snapshot();
  for (const entry of [...Object.values(value.sources), ...Object.values(value.calendar.sources)]) entry.fetchedAt = '2026-10-21T23:36:59.999Z';
  for (const [clock, required, expected] of [
    ['2026-10-21T23:36:59.999Z', false, '2026-10-20T23:37:00.000Z'],
    ['2026-10-21T23:37:00.000Z', true, at],
    ['2026-10-22T00:17:00.000Z', true, at],
    ['2026-10-22T01:17:00.000Z', true, at],
  ]) {
    const plan = getPlan(value, { now: new Date(clock) });
    assert.equal(plan.required, required, clock);
    assert.equal(plan.expectedRefreshAt, expected, clock);
    assert.equal(plan.pendingSources.length, required ? 11 : 0, clock);
  }
});

test('every canonical source is required while assembly and recent attempts cannot stand in for captures', async () => {
  const getPlan = await guard();
  for (const [kind, ids] of [['sources', ['treasury', 'bls', 'bea', 'dol', 'census']], ['calendar', ['bls', 'bea', 'census', 'dol', 'treasury', 'treasury-yield-timing']]]) {
    for (const id of ids) {
      const value = snapshot();
      const entry = kind === 'sources' ? value.sources[id] : value.calendar.sources[id];
      entry.fetchedAt = '2026-10-21T23:36:59.999Z';
      entry.lastAttemptAt = now.toISOString();
      value.checkedAt = now.toISOString();
      value.generatedAt = now.toISOString();
      value.calendar.checkedAt = now.toISOString();
      const plan = getPlan(value, { now });
      assert.equal(plan.required, true, `${kind}:${id}`);
      assert.equal(plan.pendingSources.length, 1, `${kind}:${id}`);
    }
  }
});

test('missing, malformed, failed and future captures require another refresh', async () => {
  const getPlan = await guard();
  for (const change of [
    value => { delete value.sources.bea; },
    value => { value.sources.bea.fetchedAt = null; },
    value => { value.sources.bea.fetchedAt = '2026-02-30T23:40:00Z'; },
    value => { value.sources.bea.fetchedAt = '2026-10-21T19:40:00-04:00'; },
    value => { value.sources.bea.fetchedAt = '2026-10-22T00:17:00.001Z'; },
    value => { value.sources.bea.status = 'error'; },
    value => { value.sources.bea.error = 'HTTP 503'; },
    value => { value.sources.bea.failure = { kind: 'http', status: 503 }; },
  ]) {
    const value = snapshot();
    change(value);
    const plan = getPlan(value, { now });
    assert.equal(plan.required, true);
    assert.deepEqual(plan.pendingSources, ['BEA data']);
  }
  for (const value of [undefined, null, {}, [], { sources: {}, calendar: null }]) {
    const plan = getPlan(value, { now });
    assert.equal(plan.required, true);
    assert.equal(plan.pendingSources.length, 11);
  }
});

test('a verified BLS403 attempted in the current daily slot permits catch-up checks to skip', async () => {
  const value = approvedSnapshot();
  const before = structuredClone(value);
  const plan = (await guard())(value, { now });
  assert.equal(plan.required, false);
  assert.deepEqual(plan.pendingSources, []);
  assert.match(plan.reason, /BLS|cached/i);
  assert.deepEqual(value, before);
});

test('the cached BLS exception needs the exact policy, valid provenance and an attempt inside this slot', async () => {
  const getPlan = await guard();
  for (const change of [
    value => { delete value.publicationPolicy; },
    value => { value.publicationPolicy.mode = 'require-all'; },
    value => { value.publicationPolicy.cachedCalendarSources = []; },
    value => { value.publicationPolicy.cachedCalendarSources = 'bls'; },
    value => { value.publicationPolicy.cachedCalendarSources = {}; },
    value => { value.publicationPolicy.cachedCalendarSources = null; },
    value => { value.calendar.sources.bls.lastAttemptAt = '2026-10-21T23:36:59.999Z'; },
    value => { value.calendar.sources.bls.lastAttemptAt = '2026-10-22T00:17:00.001Z'; },
    value => { value.calendar.sources.bls.lastAttemptAt = 'invalid'; },
    value => { value.calendar.sources.bls.fetchedAt = 'invalid'; },
    value => { value.calendar.sources.bls.fetchedAt = '2026-10-22T00:17:00.001Z'; },
    value => { value.calendar.sources.bls.events = []; },
    value => { value.calendar.sources.bls.provenance[0].sha256 = 'invalid'; },
    value => { value.calendar.sources.bls.failure.status = 503; },
    value => { value.calendar.sources.bls.failure.redirected = true; },
    value => { value.calendar.sources.bls.failure.requestedUrl = 'https://www.bls.gov/schedule/2025/home.htm'; },
  ]) {
    const value = approvedSnapshot();
    change(value);
    const plan = getPlan(value, { now });
    assert.equal(plan.required, true);
    assert.deepEqual(plan.pendingSources, ['BLS release calendar']);
  }
});

test('an approved cached BLS calendar never exempts any other source failure or stale capture', async () => {
  const getPlan = await guard();
  for (const kind of ['data', 'calendar']) {
    const value = approvedSnapshot();
    const entry = kind === 'data' ? value.sources.bls : value.calendar.sources.bea;
    entry.status = 'error';
    entry.fetchedAt = '2026-10-20T12:00:00Z';
    const plan = getPlan(value, { now });
    assert.equal(plan.required, true);
    assert.deepEqual(plan.pendingSources, [kind === 'data' ? 'BLS data' : 'BEA release calendar']);
  }
});

test('manual force refreshes a completed snapshot but invalid clocks still fail explicitly', async () => {
  const getPlan = await guard();
  const plan = getPlan(snapshot(), { now, force: true });
  assert.equal(plan.required, true);
  assert.deepEqual(plan.pendingSources, []);
  assert.match(plan.reason, /manual|force/i);
  assert.equal(getPlan(snapshot(), { now, force: 'true' }).required, false);
  for (const clock of [new Date('invalid'), '2026-10-22T00:17:00Z', null]) {
    assert.throws(() => getPlan(snapshot(), { now: clock, force: true }), { name: 'RangeError', message: /valid Date/i });
  }
});

async function withCliFixture(value, run) {
  await mkdir(scratchRoot, { recursive: true });
  const directory = await mkdtemp(path.join(scratchRoot, 'refresh-due-'));
  try {
    await cp(path.join(root, 'scripts'), path.join(directory, 'scripts'), { recursive: true });
    await mkdir(path.join(directory, 'src'));
    await cp(path.join(root, 'src', 'freshness.js'), path.join(directory, 'src', 'freshness.js'));
    await writeFile(path.join(directory, 'package.json'), '{"type":"module"}');
    await writeFile(path.join(directory, 'src', 'official-snapshot.js'), `export const snapshot = ${JSON.stringify(value)};\n`);
    await writeFile(path.join(directory, 'clock.mjs'), `const NativeDate=Date; globalThis.Date=class extends NativeDate { constructor(...args){super(...(args.length?args:['2026-10-22T00:17:00.000Z']));} static now(){return NativeDate.parse('2026-10-22T00:17:00.000Z');} };\n`);
    await run(directory);
  } finally {
    const resolvedDirectory = await realpath(directory);
    const resolvedRoot = await realpath(scratchRoot);
    assert.ok(resolvedDirectory.startsWith(`${resolvedRoot}${path.sep}`));
    await rm(resolvedDirectory, { recursive: true, force: true });
  }
}

test('the CLI records run and skip outputs without changing the committed snapshot', async () => {
  await withCliFixture(approvedSnapshot(), async directory => {
    const output = path.join(directory, 'output');
    const summary = path.join(directory, 'summary');
    const destination = path.join(directory, 'src', 'official-snapshot.js');
    const original = await readFile(destination);
    const options = { cwd: directory, timeout: 20000, env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary } };
    const skipped = await execute(process.execPath, ['--import', './clock.mjs', 'scripts/check-refresh-due.mjs'], options);
    assert.match(skipped.stdout, /skip/i);
    assert.match(await readFile(output, 'utf8'), /(?:^|\n)required=false\n/);
    assert.match(await readFile(output, 'utf8'), /expected_refresh_at=2026-10-21T23:37:00.000Z/);
    assert.match(await readFile(summary, 'utf8'), /skip|complete|current/i);
    await writeFile(output, '');
    const forced = await execute(process.execPath, ['--import', './clock.mjs', 'scripts/check-refresh-due.mjs', '--force'], options);
    assert.match(forced.stdout, /run|refresh/i);
    assert.match(await readFile(output, 'utf8'), /(?:^|\n)required=true\n/);
    assert.ok((await readFile(destination)).equals(original));
  });
});

test('the CLI names pending sources and fails unknown options without claiming a skip', async () => {
  await withCliFixture({}, async directory => {
    const output = path.join(directory, 'output');
    const summary = path.join(directory, 'summary');
    const options = { cwd: directory, timeout: 20000, env: { ...process.env, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: summary } };
    const result = await execute(process.execPath, ['--import', './clock.mjs', 'scripts/check-refresh-due.mjs'], options);
    assert.match(result.stdout, /Treasury data/);
    assert.match(result.stdout, /Treasury yield timing/);
    assert.match(await readFile(output, 'utf8'), /required=true/);
    await writeFile(output, '');
    await writeFile(summary, '');
    await assert.rejects(execute(process.execPath, ['scripts/check-refresh-due.mjs', '--now=2099-01-01'], options), error => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /unknown|unsupported|option/i);
      assert.doesNotMatch(error.stdout, /skip/i);
      return true;
    });
    assert.equal(await readFile(output, 'utf8'), '');
    assert.equal(await readFile(summary, 'utf8'), '');
  });
});
