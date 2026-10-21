import test from 'node:test';
import assert from 'node:assert/strict';
import { getFreshness } from '../src/freshness.js';

const capturedAt = '2026-10-21T23:18:28.455Z';
const source = (extra = {}) => ({ status: 'ok', fetchedAt: capturedAt, lastAttemptAt: '2026-10-21T23:18:27.753Z', ...extra });
const completeSnapshot = () => ({
  generatedAt: '2026-10-22T01:00:00.000Z',
  checkedAt: '2026-10-21T23:18:27.753Z',
  sources: { treasury: source(), bls: source(), bea: source(), dol: source(), census: source() },
  calendar: {
    checkedAt: '2026-10-21T23:18:27.753Z',
    sources: { bls: source(), bea: source(), census: source(), dol: source(), treasury: source(), 'treasury-yield-timing': source() },
  },
});

test('all eleven successful capture targets produce an available summary', () => {
  const result = getFreshness(completeSnapshot());
  assert.equal(result.state, 'available');
  assert.equal(result.entries.length, 11);
  assert.ok(result.entries.every(entry => entry.status === 'available'));
  assert.deepEqual(result.cached, []);
  assert.deepEqual(result.unavailable, []);
  assert.equal(result.lastSuccessfulRefresh, capturedAt);
  assert.deepEqual(result.entries.map(({ id, label, kind }) => ({ id, label, kind })), [
    { id: 'data:treasury', label: 'Treasury data', kind: 'data' },
    { id: 'data:bls', label: 'BLS data', kind: 'data' },
    { id: 'data:bea', label: 'BEA data', kind: 'data' },
    { id: 'data:dol', label: 'DOL ETA data', kind: 'data' },
    { id: 'data:census', label: 'Census data', kind: 'data' },
    { id: 'calendar:bls', label: 'BLS release calendar', kind: 'calendar' },
    { id: 'calendar:bea', label: 'BEA release calendar', kind: 'calendar' },
    { id: 'calendar:census', label: 'Census release calendar', kind: 'calendar' },
    { id: 'calendar:dol', label: 'DOL claims calendar', kind: 'calendar' },
    { id: 'calendar:treasury', label: 'Treasury debt calendar', kind: 'calendar' },
    { id: 'calendar:treasury-yield-timing', label: 'Treasury yield timing', kind: 'calendar' },
  ]);
});

test('a failed BLS calendar retains its successful capture separately from the successful BLS data feed', () => {
  const snapshot = completeSnapshot();
  snapshot.calendar.sources.bls = source({ status: 'error', fetchedAt: '2026-10-20T18:00:00Z', error: 'HTTP 403' });
  const result = getFreshness(snapshot);
  assert.equal(result.state, 'partial');
  assert.deepEqual(result.cached, [{
    id: 'calendar:bls', label: 'BLS release calendar', kind: 'calendar', status: 'cached',
    fetchedAt: '2026-10-20T18:00:00.000Z', lastAttemptAt: '2026-10-21T23:18:27.753Z', error: 'HTTP 403',
  }]);
  assert.equal(result.entries.find(entry => entry.id === 'data:bls').status, 'available');
  assert.deepEqual(result.unavailable, []);
});

test('missing expected targets are unavailable even when every present target claims success', () => {
  const snapshot = completeSnapshot();
  delete snapshot.sources.census;
  delete snapshot.calendar.sources['treasury-yield-timing'];
  snapshot.sources.unrecognized = source({ fetchedAt: '2099-01-01T00:00:00Z' });
  const result = getFreshness(snapshot);
  assert.equal(result.state, 'partial');
  assert.deepEqual(result.unavailable.map(entry => entry.id), ['data:census', 'calendar:treasury-yield-timing']);
  assert.equal(result.unavailable[0].fetchedAt, null);
  assert.equal(result.unavailable[0].error, null);
  assert.equal(result.lastSuccessfulRefresh, capturedAt);
});

test('an absent calendar exposes all six missing targets', () => {
  const snapshot = completeSnapshot();
  delete snapshot.calendar;
  const result = getFreshness(snapshot);
  assert.equal(result.state, 'partial');
  assert.equal(result.unavailable.length, 6);
  assert.ok(result.unavailable.every(entry => entry.kind === 'calendar'));
});

test('no known successful captures produces an unavailable summary', () => {
  for (const snapshot of [undefined, null, {}, { checkedAt: '2026-10-21T23:00:00Z', sources: { bls: { status: 'error', error: 'HTTP 503' } } }]) {
    const result = getFreshness(snapshot);
    assert.equal(result.state, 'unavailable');
    assert.equal(result.lastSuccessfulRefresh, null);
    assert.equal(result.unavailable.length, 11);
    assert.deepEqual(result.cached, []);
  }
});

test('retained captures remain the last known successful refresh even if no source currently succeeds', () => {
  const snapshot = completeSnapshot();
  for (const entry of [...Object.values(snapshot.sources), ...Object.values(snapshot.calendar.sources)]) entry.status = 'error';
  snapshot.sources.bls.fetchedAt = '2026-10-22T00:00:00Z';
  const result = getFreshness(snapshot);
  assert.equal(result.state, 'partial');
  assert.equal(result.cached.length, 11);
  assert.equal(result.unavailable.length, 0);
  assert.equal(result.lastSuccessfulRefresh, '2026-10-22T00:00:00.000Z');
});

test('a newer refresh attempt never replaces the last successful source capture', () => {
  const snapshot = completeSnapshot();
  snapshot.checkedAt = '2026-10-22T23:37:00Z';
  snapshot.calendar.checkedAt = '2026-10-23T00:00:00Z';
  snapshot.calendar.sources.bls.lastAttemptAt = '2026-10-23T00:01:00Z';
  const result = getFreshness(snapshot);
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
  const result = getFreshness(snapshot);
  assert.equal(result.lastSuccessfulRefresh, capturedAt);
  assert.equal(result.lastAttemptAt, null);
});

test('a capture claimed successful without a valid timestamp is unavailable', () => {
  const snapshot = completeSnapshot();
  snapshot.sources.treasury = source({ fetchedAt: null });
  snapshot.sources.bls = source({ fetchedAt: 'not a date' });
  snapshot.sources.bea = source({ fetchedAt: 1792623600000 });
  const result = getFreshness(snapshot);
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
    const result = getFreshness({ sources: { bls: source({ fetchedAt }) } });
    assert.equal(result.entries.find(entry => entry.id === 'data:bls').status, 'unavailable', fetchedAt);
    assert.equal(result.lastSuccessfulRefresh, null, fetchedAt);
  }
});

test('valid leap dates normalize to UTC with no dependency on local DST', () => {
  const result = getFreshness({ sources: {
    bls: source({ fetchedAt: '2024-02-29T00:00:00Z' }),
    bea: source({ fetchedAt: '2026-11-01T06:30:00.125Z' }),
    treasury: source({ fetchedAt: '2026-11-01T05:30:00.999Z' }),
  } });
  assert.equal(result.entries.find(entry => entry.id === 'data:bls').fetchedAt, '2024-02-29T00:00:00.000Z');
  assert.equal(result.lastSuccessfulRefresh, '2026-11-01T06:30:00.125Z');
});

test('invalid attempted timestamps are ignored while valid attempts survive unavailable captures', () => {
  const result = getFreshness({
    checkedAt: '2026-02-29T00:00:00Z',
    calendar: { checkedAt: 'invalid', sources: { bls: { status: 'error', fetchedAt: null, lastAttemptAt: '2026-10-21T23:37:00Z', error: 'HTTP 403' } } },
    sources: { bls: source({ lastAttemptAt: '2099-02-30T00:00:00Z' }) },
  });
  assert.equal(result.lastAttemptAt, '2026-10-21T23:37:00.000Z');
  assert.equal(result.entries.find(entry => entry.id === 'data:bls').lastAttemptAt, null);
  assert.equal(result.unavailable.find(entry => entry.id === 'calendar:bls').error, 'HTTP 403');
});

test('missing success status marks a retained valid capture as cached', () => {
  const result = getFreshness({ sources: { bls: { fetchedAt: capturedAt, error: { message: 'not a display string' } } } });
  assert.equal(result.cached[0].id, 'data:bls');
  assert.equal(result.cached[0].error, null);
});

test('summarizing provenance neither mutates the snapshot nor exposes its source objects', () => {
  const snapshot = completeSnapshot();
  const before = structuredClone(snapshot);
  const result = getFreshness(snapshot);
  assert.deepEqual(snapshot, before);
  result.entries[0].fetchedAt = null;
  assert.deepEqual(snapshot, before);
  assert.equal(getFreshness(snapshot).entries[0].fetchedAt, capturedAt);
});
