import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getFreshness } from '../src/freshness.js';
import * as freshness from '../src/freshness.js';

// Keep the provenance cases independent of the date this suite runs.
const clock = { now: new Date('2026-10-21T23:30:00.000Z') };

const capturedAt = '2026-10-21T23:18:28.455Z';
const source = (extra = {}) => ({ status: 'ok', fetchedAt: capturedAt, lastAttemptAt: '2026-10-21T23:18:27.753Z', ...extra });
const researchSources = ['fiscal','refinancing','yields','auctions','ownership','macroContributions','marketFunctioning','policyRates','activity','housing'];
const completeSnapshot = () => ({
  generatedAt: '2026-10-22T01:00:00.000Z',
  checkedAt: '2026-10-21T23:18:27.753Z',
  sources: Object.fromEntries(['treasury','bls','bea','dol','dolAdvance','census',...researchSources].map(id=>[id,source()])),
  calendar: {
    checkedAt: '2026-10-21T23:18:27.753Z',
    sources: { bls: source(), bea: source(), census: source(), dol: source(), treasury: source(), 'treasury-yield-timing': source() },
  },
});

test('all twenty-two successful capture targets produce an available summary', () => {
  const result = getFreshness(completeSnapshot(), clock);
  assert.equal(result.state, 'available');
  assert.equal(result.entries.length, 22);
  assert.ok(result.entries.every(entry => entry.status === 'available'));
  assert.deepEqual(result.cached, []);
  assert.deepEqual(result.unavailable, []);
  assert.deepEqual(result.stale, []);
  assert.ok(result.entries.every(entry => entry.stale === false && entry.staleSince === null));
  assert.equal(result.lastSuccessfulRefresh, capturedAt);
  assert.deepEqual(result.entries.map(({ id, label, kind }) => ({ id, label, kind })), [
    { id: 'data:treasury', label: 'Treasury data', kind: 'data' },
    { id: 'data:bls', label: 'BLS data', kind: 'data' },
    { id: 'data:bea', label: 'BEA data', kind: 'data' },
    { id: 'data:dol', label: 'DOL ETA data', kind: 'data' },
    { id: 'data:dolAdvance', label: 'DOL advance claims release', kind: 'data' },
    { id: 'data:census', label: 'Census data', kind: 'data' },
    { id: 'calendar:bls', label: 'BLS release calendar', kind: 'calendar' },
    { id: 'calendar:bea', label: 'BEA release calendar', kind: 'calendar' },
    { id: 'calendar:census', label: 'Census release calendar', kind: 'calendar' },
    { id: 'calendar:dol', label: 'DOL claims calendar', kind: 'calendar' },
    { id: 'calendar:treasury', label: 'Treasury debt calendar', kind: 'calendar' },
    { id: 'calendar:treasury-yield-timing', label: 'Treasury yield timing', kind: 'calendar' },
    { id: 'data:fiscal', label: 'Treasury fiscal pressure', kind: 'data' },
    { id: 'data:refinancing', label: 'Treasury debt maturity profile', kind: 'data' },
    { id: 'data:yields', label: 'Treasury yield history', kind: 'data' },
    { id: 'data:auctions', label: 'Treasury auction results', kind: 'data' },
    { id: 'data:ownership', label: 'Federal Reserve Treasury ownership', kind: 'data' },
    { id: 'data:macroContributions', label: 'BEA GDP contributions', kind: 'data' },
    { id: 'data:marketFunctioning', label: 'New York Fed dealer and funding data', kind: 'data' },
    { id: 'data:policyRates', label: 'Federal Reserve policy rates', kind: 'data' },
    { id: 'data:activity', label: 'Federal Reserve industrial activity', kind: 'data' },
    { id: 'data:housing', label: 'Census housing construction', kind: 'data' },
  ]);
});

test('a missing research source remains a required unavailable outcome',()=>{
  for(const id of researchSources){
    const snapshot=completeSnapshot();
    delete snapshot.sources[id];
    const result=getFreshness(snapshot,clock);
    assert.equal(result.state,'partial',id);
    assert.equal(result.entries.length,22,id);
    assert.deepEqual(result.unavailable.map(entry=>entry.id),[`data:${id}`],id);
  }
});

test('a failed BLS calendar retains its successful capture separately from the successful BLS data feed', () => {
  const snapshot = completeSnapshot();
  snapshot.calendar.sources.bls = source({ status: 'error', fetchedAt: '2026-10-20T18:00:00Z', error: 'HTTP 403' });
  const result = getFreshness(snapshot, clock);
  assert.equal(result.state, 'partial');
  assert.deepEqual(result.cached, [{
    id: 'calendar:bls', label: 'BLS release calendar', kind: 'calendar', status: 'cached',
    fetchedAt: '2026-10-20T18:00:00.000Z', lastAttemptAt: '2026-10-21T23:18:27.753Z', error: 'HTTP 403',
    stale: true, staleSince: '2026-10-21T00:37:00.000Z',
  }]);
  assert.equal(result.entries.find(entry => entry.id === 'data:bls').status, 'available');
  assert.deepEqual(result.unavailable, []);
});

test('missing expected targets are unavailable even when every present target claims success', () => {
  const snapshot = completeSnapshot();
  delete snapshot.sources.census;
  delete snapshot.calendar.sources['treasury-yield-timing'];
  snapshot.sources.unrecognized = source({ fetchedAt: '2099-01-01T00:00:00Z' });
  const result = getFreshness(snapshot, clock);
  assert.equal(result.state, 'partial');
  assert.deepEqual(result.unavailable.map(entry => entry.id), ['data:census', 'calendar:treasury-yield-timing']);
  assert.equal(result.unavailable[0].fetchedAt, null);
  assert.equal(result.unavailable[0].error, null);
  assert.equal(result.lastSuccessfulRefresh, capturedAt);
});

test('an absent calendar exposes all six missing targets', () => {
  const snapshot = completeSnapshot();
  delete snapshot.calendar;
  const result = getFreshness(snapshot, clock);
  assert.equal(result.state, 'partial');
  assert.equal(result.unavailable.length, 6);
  assert.ok(result.unavailable.every(entry => entry.kind === 'calendar'));
});

test('no known successful captures produces an unavailable summary', () => {
  for (const snapshot of [undefined, null, {}, { checkedAt: '2026-10-21T23:00:00Z', sources: { bls: { status: 'error', error: 'HTTP 503' } } }]) {
    const result = getFreshness(snapshot, clock);
    assert.equal(result.state, 'unavailable');
    assert.equal(result.lastSuccessfulRefresh, null);
    assert.equal(result.unavailable.length, 22);
    assert.deepEqual(result.cached, []);
  }
});

test('retained captures remain the last known successful refresh even if no source currently succeeds', () => {
  const snapshot = completeSnapshot();
  for (const entry of [...Object.values(snapshot.sources), ...Object.values(snapshot.calendar.sources)]) entry.status = 'error';
  snapshot.sources.bls.fetchedAt = '2026-10-22T00:00:00Z';
  const result = getFreshness(snapshot, clock);
  assert.equal(result.state, 'partial');
  assert.equal(result.cached.length, 22);
  assert.equal(result.unavailable.length, 0);
  assert.equal(result.lastSuccessfulRefresh, '2026-10-22T00:00:00.000Z');
});

test('a newer refresh attempt never replaces the last successful source capture', () => {
  const snapshot = completeSnapshot();
  snapshot.checkedAt = '2026-10-22T23:37:00Z';
  snapshot.calendar.checkedAt = '2026-10-23T00:00:00Z';
  snapshot.calendar.sources.bls.lastAttemptAt = '2026-10-23T00:01:00Z';
  const result = getFreshness(snapshot, clock);
  assert.equal(result.lastSuccessfulRefresh, capturedAt);
  assert.equal(result.lastAttemptAt, '2026-10-23T00:01:00.000Z');
});

test('snapshot assembly and unknown-source timestamps are excluded from refresh provenance', () => {
  const snapshot = completeSnapshot();
  delete snapshot.checkedAt;
  delete snapshot.calendar.checkedAt;
  for (const entry of [...Object.values(snapshot.sources), ...Object.values(snapshot.calendar.sources)]) delete entry.lastAttemptAt;
  snapshot.generatedAt = '2099-01-01T00:00:00Z';
  snapshot.sources.extra = source({ fetchedAt: '2098-01-01T00:00:00Z', lastAttemptAt: '2098-01-01T00:00:00Z' });
  const result = getFreshness(snapshot, clock);
  assert.equal(result.lastSuccessfulRefresh, capturedAt);
  assert.equal(result.lastAttemptAt, null);
});

test('a capture claimed successful without a valid timestamp is unavailable', () => {
  const snapshot = completeSnapshot();
  snapshot.sources.treasury = source({ fetchedAt: null });
  snapshot.sources.bls = source({ fetchedAt: 'not a date' });
  snapshot.sources.bea = source({ fetchedAt: 1792623600000 });
  const result = getFreshness(snapshot, clock);
  assert.deepEqual(result.unavailable.map(entry => entry.id), ['data:treasury', 'data:bls', 'data:bea']);
  assert.ok(result.unavailable.every(entry => entry.fetchedAt === null));
});

test('invalid calendar dates and non-UTC timestamp spellings cannot create a successful capture', () => {
  for (const fetchedAt of [
    '2026-02-29T00:00:00Z', '2026-04-31T00:00:00Z', '2026-13-01T00:00:00Z',
    '2026-01-01T24:00:00Z', '2026-01-01T00:60:00Z', '2026-01-01T00:00:60Z',
    '2026-10-21', '2026-10-21T23:18:28', '2026-10-21T19:18:28-04:00',
    '2026-10-21T23:18:28.4Z', ' 2026-10-21T23:18:28Z ',
  ]) {
    const result = getFreshness({ sources: { bls: source({ fetchedAt }) } }, clock);
    assert.equal(result.entries.find(entry => entry.id === 'data:bls').status, 'unavailable', fetchedAt);
    assert.equal(result.lastSuccessfulRefresh, null, fetchedAt);
  }
});

test('valid leap dates normalize to UTC with no dependency on local DST', () => {
  const result = getFreshness({ sources: {
    bls: source({ fetchedAt: '2024-02-29T00:00:00Z' }),
    bea: source({ fetchedAt: '2026-11-01T06:30:00.125Z' }),
    treasury: source({ fetchedAt: '2026-11-01T05:30:00.999Z' }),
  } }, clock);
  assert.equal(result.entries.find(entry => entry.id === 'data:bls').fetchedAt, '2024-02-29T00:00:00.000Z');
  assert.equal(result.lastSuccessfulRefresh, '2026-11-01T06:30:00.125Z');
});

test('invalid attempted timestamps are ignored while valid attempts survive unavailable captures', () => {
  const result = getFreshness({
    checkedAt: '2026-02-29T00:00:00Z',
    calendar: { checkedAt: 'invalid', sources: { bls: { status: 'error', fetchedAt: null, lastAttemptAt: '2026-10-21T23:37:00Z', error: 'HTTP 403' } } },
    sources: { bls: source({ lastAttemptAt: '2099-02-30T00:00:00Z' }) },
  }, clock);
  assert.equal(result.lastAttemptAt, '2026-10-21T23:37:00.000Z');
  assert.equal(result.entries.find(entry => entry.id === 'data:bls').lastAttemptAt, null);
  assert.equal(result.unavailable.find(entry => entry.id === 'calendar:bls').error, 'HTTP 403');
});

test('missing success status marks a retained valid capture as cached', () => {
  const result = getFreshness({ sources: { bls: { fetchedAt: capturedAt, error: { message: 'not a display string' } } } }, clock);
  assert.equal(result.cached[0].id, 'data:bls');
  assert.equal(result.cached[0].error, null);
});

test('summarizing provenance neither mutates the snapshot nor exposes its source objects', () => {
  const snapshot = completeSnapshot();
  const before = structuredClone(snapshot);
  const result = getFreshness(snapshot, clock);
  assert.deepEqual(snapshot, before);
  result.entries[0].fetchedAt = null;
  assert.deepEqual(snapshot, before);
  assert.equal(getFreshness(snapshot, clock).entries[0].fetchedAt, capturedAt);
});

test('a missed run becomes stale exactly at its deadline after the midnight grace period', () => {
  const snapshot = completeSnapshot();
  for (const [now, expectedRefreshAt, refreshDeadline, stale] of [
    ['2026-10-22T00:36:59.999Z', '2026-10-20T23:37:00.000Z', '2026-10-21T00:37:00.000Z', false],
    ['2026-10-22T00:37:00.000Z', '2026-10-21T23:37:00.000Z', '2026-10-22T00:37:00.000Z', true],
    ['2026-10-22T00:37:00.001Z', '2026-10-21T23:37:00.000Z', '2026-10-22T00:37:00.000Z', true],
  ]) {
    const result = getFreshness(snapshot, { now: new Date(now) });
    assert.equal(result.expectedRefreshAt, expectedRefreshAt, now);
    assert.equal(result.refreshDeadline, refreshDeadline, now);
    assert.equal(result.entries[0].stale, stale, now);
    assert.equal(result.entries[0].staleSince, stale ? refreshDeadline : null, now);
    assert.equal(result.state, stale ? 'partial' : 'available', now);
    assert.equal(result.stale.length, stale ? 22 : 0, now);
    assert.equal(result.entries[0].status, 'available', now);
  }
});

test('a capture at the scheduled run is fresh while a capture one millisecond earlier is stale', () => {
  const snapshot = completeSnapshot();
  snapshot.sources.treasury.fetchedAt = '2026-10-21T23:37:00.000Z';
  snapshot.sources.bls.fetchedAt = '2026-10-21T23:36:59.999Z';
  snapshot.sources.bea.fetchedAt = '2026-10-22T00:37:00.001Z';
  const result = getFreshness(snapshot, { now: new Date('2026-10-22T00:37:00.000Z') });
  assert.equal(result.entries.find(entry => entry.id === 'data:treasury').stale, false);
  assert.equal(result.entries.find(entry => entry.id === 'data:bls').stale, true);
  assert.equal(result.entries.find(entry => entry.id === 'data:bea').stale, false);
  assert.equal(result.entries.find(entry => entry.id === 'data:bls').staleSince, '2026-10-22T00:37:00.000Z');
});

test('new attempts, snapshot assembly and data observation dates cannot make a retained capture fresh', () => {
  const snapshot = completeSnapshot();
  snapshot.checkedAt = '2026-10-22T01:20:00Z';
  snapshot.calendar.checkedAt = '2026-10-22T01:20:00Z';
  snapshot.generatedAt = '2026-10-22T01:20:00Z';
  snapshot.sources.treasury.lastAttemptAt = '2026-10-22T01:19:00Z';
  snapshot.sources.treasury.observationDate = '2026-10-22';
  const result = getFreshness(snapshot, { now: new Date('2026-10-22T01:30:00Z') });
  assert.equal(result.stale.length, 22);
  assert.equal(result.entries[0].fetchedAt, capturedAt);
  assert.equal(result.lastSuccessfulRefresh, capturedAt);
  assert.equal(result.lastAttemptAt, '2026-10-22T01:20:00.000Z');
});

test('cached captures can also be overdue and recover only after a new successful capture', () => {
  const snapshot = completeSnapshot();
  snapshot.calendar.sources.bls = source({ status: 'error', fetchedAt: '2026-10-20T18:00:00Z', lastAttemptAt: '2026-10-22T00:40:00Z', error: 'HTTP 403' });
  const now = new Date('2026-10-22T01:00:00Z');
  const result = getFreshness(snapshot, { now });
  const retained = result.entries.find(entry => entry.id === 'calendar:bls');
  assert.equal(retained.status, 'cached');
  assert.equal(retained.stale, true);
  assert.equal(retained.staleSince, '2026-10-22T00:37:00.000Z');
  assert.ok(result.cached.includes(retained));
  assert.ok(result.stale.includes(retained));

  snapshot.calendar.sources.bls = source({ fetchedAt: '2026-10-22T00:50:00Z', lastAttemptAt: '2026-10-22T00:49:00Z' });
  const resumed = getFreshness(snapshot, { now }).entries.find(entry => entry.id === 'calendar:bls');
  assert.equal(resumed.status, 'available');
  assert.equal(resumed.stale, false);
  assert.equal(resumed.staleSince, null);
});

test('a recent failed attempt may be cached without having missed the daily refresh', () => {
  const snapshot = completeSnapshot();
  snapshot.calendar.sources.bls = source({ status: 'error', fetchedAt: '2026-10-22T00:10:00Z', error: 'HTTP 503' });
  const result = getFreshness(snapshot, { now: new Date('2026-10-22T00:40:00Z') });
  assert.equal(result.cached[0].stale, false);
  assert.equal(result.cached[0].staleSince, null);
  assert.equal(result.stale.some(entry => entry.id === 'calendar:bls'), false);
});

test('missing or invalid captures are unavailable rather than mislabeled stale', () => {
  const snapshot = completeSnapshot();
  delete snapshot.sources.census;
  snapshot.calendar.sources.bls.fetchedAt = 'invalid';
  const result = getFreshness(snapshot, { now: new Date('2026-10-22T00:40:00Z') });
  assert.deepEqual(result.unavailable.map(entry => entry.id), ['data:census', 'calendar:bls']);
  assert.ok(result.unavailable.every(entry => entry.stale === false && entry.staleSince === null));
  assert.equal(result.stale.length, 20);
  const empty = getFreshness({}, { now: new Date('2026-10-22T00:40:00Z') });
  assert.equal(empty.state, 'unavailable');
  assert.deepEqual(empty.stale, []);
});

test('daily deadlines stay in UTC over month, year, leap-day, weekend and DST boundaries', () => {
  for (const [now, expectedRefreshAt, refreshDeadline] of [
    ['2026-11-01T00:37:00Z', '2026-10-31T23:37:00.000Z', '2026-11-01T00:37:00.000Z'],
    ['2027-01-01T00:37:00Z', '2026-12-31T23:37:00.000Z', '2027-01-01T00:37:00.000Z'],
    ['2024-03-01T00:37:00Z', '2024-02-29T23:37:00.000Z', '2024-03-01T00:37:00.000Z'],
    ['2026-10-25T00:37:00Z', '2026-10-24T23:37:00.000Z', '2026-10-25T00:37:00.000Z'],
    ['2026-03-08T07:30:00Z', '2026-03-07T23:37:00.000Z', '2026-03-08T00:37:00.000Z'],
    ['2026-11-01T06:30:00Z', '2026-10-31T23:37:00.000Z', '2026-11-01T00:37:00.000Z'],
  ]) {
    const result = getFreshness({}, { now: new Date(now) });
    assert.equal(result.expectedRefreshAt, expectedRefreshAt, now);
    assert.equal(result.refreshDeadline, refreshDeadline, now);
  }
});

test('invalid freshness clocks fail explicitly instead of displaying an incorrect freshness state', () => {
  for (const now of [new Date('invalid'), null, '2026-10-22T00:40:00Z', 1792623600000, {}]) {
    assert.throws(() => getFreshness(completeSnapshot(), { now }), { name: 'RangeError', message: /valid Date/i });
  }
});

test('the refresh guard selects the latest scheduled start immediately, without the banner grace period', () => {
  assert.equal(typeof freshness.getScheduledRefreshAt, 'function');
  for (const [now, expected] of [
    ['2026-10-21T23:36:59.999Z', '2026-10-20T23:37:00.000Z'],
    ['2026-10-21T23:37:00.000Z', '2026-10-21T23:37:00.000Z'],
    ['2026-10-22T00:17:00.000Z', '2026-10-21T23:37:00.000Z'],
    ['2026-10-22T01:17:00.000Z', '2026-10-21T23:37:00.000Z'],
    ['2027-01-01T00:00:00.000Z', '2026-12-31T23:37:00.000Z'],
    ['2024-03-01T00:00:00.000Z', '2024-02-29T23:37:00.000Z'],
    ['2026-10-25T00:17:00.000Z', '2026-10-24T23:37:00.000Z'],
    ['2026-03-08T07:30:00.000Z', '2026-03-07T23:37:00.000Z'],
    ['2026-11-01T06:30:00.000Z', '2026-10-31T23:37:00.000Z'],
  ]) assert.equal(freshness.getScheduledRefreshAt(new Date(now)), expected, now);
  for (const now of [new Date('invalid'), null, '2026-10-22T00:17:00Z', 1792623600000, {}]) {
    assert.throws(() => freshness.getScheduledRefreshAt(now), { name: 'RangeError', message: /valid Date/i });
  }
});

test('the banner daily schedule matches the workflow that refreshes its data', async () => {
  const { DAILY_REFRESH_SCHEDULE } = await import('../src/freshness.js');
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
  const schedules = [...workflow.matchAll(/^\s*-\s*cron:\s*['"]([^'"]+)['"]\s*$/gm)].map(match => match[1]);
  assert.equal(schedules.length, 2, 'A primary daily refresh and guarded catch-up schedule must drive the freshness policy');
  const [minute, hour, day, month, weekday] = schedules[0].split(/\s+/);
  assert.deepEqual([day, month, weekday], ['*', '*', '*']);
  assert.equal(DAILY_REFRESH_SCHEDULE.minuteUTC, Number(minute));
  assert.equal(DAILY_REFRESH_SCHEDULE.hourUTC, Number(hour));
  assert.equal(Object.isFrozen(DAILY_REFRESH_SCHEDULE), true);
  assert.equal(schedules[1], '17 0,1 * * *');
  assert.equal(freshness.getScheduledRefreshAt(new Date('2026-10-22T00:17:00Z')), '2026-10-21T23:37:00.000Z');
  assert.equal(freshness.getScheduledRefreshAt(new Date('2026-10-22T01:17:00Z')), '2026-10-21T23:37:00.000Z');
});
