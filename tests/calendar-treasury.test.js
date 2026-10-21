import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

let adapter;
try { adapter = await import('../scripts/sources/calendar-treasury.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('calendar-treasury.mjs')) throw error; }
function treasury() { assert.ok(adapter, 'The Treasury release calendar adapter must exist'); return adapter; }
const endpoint = 'https://api.fiscaldata.treasury.gov/services/calendar/release';
const metadataEndpoint = 'https://api.fiscaldata.treasury.gov/services/dtg/metadata/';
const datasetId = '015-BFS-2014Q3-065';
const identity = { dataset_id: datasetId, title: 'Debt to the Penny', dataset_path: 'debt-to-the-penny' };
const row = (overrides = {}) => ({ datasetId, date: '2026-10-30', time: '20:15', released: 'false', ...overrides });
const calendar = (rows = [row()]) => JSON.stringify(rows);
const metadata = (rows = [identity]) => JSON.stringify(rows);
const parse = (rows, identities) => treasury().parseTreasuryCalendar(calendar(rows), metadata(identities));

test('Treasury maps only the exact Debt to the Penny dataset identity and factual dated estimates', () => {
  const result = parse([row(), row({ datasetId: '015-BFS-2014Q3-077' })], [identity, { dataset_id: '015-BFS-2014Q3-077', title: 'Daily Treasury Statement', dataset_path: 'daily-treasury-statement' }]);
  assert.deepEqual(result.datasetIdentity, { datasetId, title: 'Debt to the Penny', path: 'debt-to-the-penny' });
  assert.deepEqual(result.events, [{
    id: 'treasury-debt-to-the-penny-2026-10-30', sourceId: 'treasury', program: 'debt-to-the-penny', name: 'Debt to the Penny', agency: 'Treasury Fiscal Data', seriesId: 'debt', seriesIds: ['debt'], topic: 'Fiscal',
    date: '2026-10-30', time: '16:15', scheduledAt: '2026-10-30T20:15:00.000Z', period: null, periodLabel: null, sourceUrl: endpoint, sourceUid: null, scheduleBasis: 'calendar-estimate',
    sourceDatasetId: datasetId, sourceDate: '2026-10-30', sourceTime: '20:15', sourceTimeZone: 'UTC',
  }]);
  assert.equal(result.coverageStart, '2026-10-30');
  assert.equal(result.coverageEnd, '2026-10-30');
  assert.ok(!('publishedAt' in result.events[0]));
  assert.ok(!('released' in result.events[0]));
});

test('Treasury preserves published UTC clocks and converts DST using America/New_York', () => {
  const result = parse([row({ date: '2026-11-02', time: '21:15' }), row(), row({ date: '2026-11-03', time: '00:15' })]);
  assert.deepEqual(result.events.map(event => [event.date, event.time, event.scheduledAt]), [
    ['2026-10-30', '16:15', '2026-10-30T20:15:00.000Z'],
    ['2026-11-02', '16:15', '2026-11-02T21:15:00.000Z'],
    ['2026-11-02', '19:15', '2026-11-03T00:15:00.000Z'],
  ]);
  assert.equal(result.events[2].sourceDate, '2026-11-03');
});

test('Treasury keeps only individually listed dates without filling weekends or holiday gaps', () => {
  const result = parse([row({ date: '2026-11-10', time: '21:15' }), row({ date: '2026-11-12', time: '21:15' }), row({ date: '2026-11-13', time: '21:15' }), row({ date: '2026-11-16', time: '21:15' })]);
  assert.deepEqual(result.events.map(event => event.date), ['2026-11-10', '2026-11-12', '2026-11-13', '2026-11-16']);
});

test('Treasury does not interpret the source released flag as publication history', () => {
  const events = ['true', 'false'].map(released => parse([row({ released })]).events[0]);
  assert.deepEqual(events[0], events[1]);
  assert.equal(events[0].period, null);
  assert.equal(events[0].periodLabel, null);
});

test('Treasury rejects missing, duplicated or renamed dataset identity rather than mapping other debt releases', () => {
  for (const identities of [[], [identity, identity], [{ ...identity, title: 'Monthly Statement of the Public Debt' }], [{ ...identity, dataset_path: 'monthly-statement-public-debt' }], [{ ...identity, dataset_id: '015-BFS-other' }]]) {
    assert.throws(() => parse(undefined, identities), /Treasury|identity|metadata/i);
  }
  assert.throws(() => parse([row({ datasetId: '015-BFS-other' })]), /Treasury|mapped|Debt/i);
});

test('Treasury rejects malformed calendar and metadata response schemas and oversized bodies', () => {
  for (const body of ['<html>Access denied</html>', '{}', 'null', '[]', '[null]', '[{"datasetId":5}]']) assert.throws(() => treasury().parseTreasuryCalendar(body, metadata()), /Treasury|calendar|schema|mapped/i);
  for (const body of ['<html>Challenge</html>', '{}', 'null', '[null]']) assert.throws(() => treasury().parseTreasuryCalendar(calendar(), body), /Treasury|metadata|schema/i);
  assert.throws(() => treasury().parseTreasuryCalendar(' '.repeat(2 * 1024 * 1024) + calendar(), metadata()), /limit|size/i);
  assert.throws(() => treasury().parseTreasuryCalendar(calendar(), ' '.repeat(2 * 1024 * 1024) + metadata()), /limit|size/i);
});

test('Treasury rejects invalid source dates, clocks and release-status schema', () => {
  for (const entry of [row({ date: '2026-02-30' }), row({ date: '2026-2-3' }), row({ date: '2026-11-02Z' }), row({ time: '24:15' }), row({ time: '21:60' }), row({ time: '2115' }), row({ time: null }), row({ released: 'unknown' }), row({ released: true })]) {
    assert.throws(() => parse([entry]), /Treasury|date|time|clock|status|schema/i);
  }
});

test('Treasury rejects duplicate selected dates including conflicting listed clocks', () => {
  for (const entries of [[row(), row()], [row(), row({ time: '21:15' })]]) assert.throws(() => parse(entries), /duplicate/i);
});

test('Treasury collection fetches only the official calendar and metadata and retains hashes without copied narrative', async () => {
  const bodies = new Map([[endpoint, calendar()], [metadataEndpoint, metadata([{ ...identity, long_description: 'Not approved narrative' }])]]);
  const calls = [];
  const result = await treasury().collectTreasuryCalendar({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: async url => {
    calls.push(url); assert.ok(bodies.has(url)); return new Response(bodies.get(url), { headers: { 'last-modified': 'Wed, 21 Oct 2026 12:00:00 GMT' } });
  } });
  assert.deepEqual(calls.sort(), [...bodies.keys()].sort());
  assert.equal(result.id, 'treasury');
  assert.match(result.agency, /U\.S\. Department of the Treasury.*Fiscal Data/);
  assert.equal(result.events.length, 1);
  assert.equal(result.provenance.length, 2);
  for (const source of result.provenance) {
    assert.equal(source.sha256, createHash('sha256').update(bodies.get(source.url)).digest('hex'));
    assert.equal(source.lastModified, 'Wed, 21 Oct 2026 12:00:00 GMT');
    assert.ok(!('text' in source));
  }
  assert.ok(result.provenance.some(source => source.retrievedAt === result.fetchedAt));
  assert.match(result.coverageNote, /estimated/i);
  assert.match(result.coverageNote, /2026-10-30/);
  assert.match(result.coverageNote, /not.*confirmed|not.*publication/i);
  assert.deepEqual(result.warnings, []);
  assert.ok(!JSON.stringify(result).includes('Not approved narrative'));
});

test('Treasury warns when the official listed horizon contains no upcoming mapped dates', async () => {
  const result = await treasury().collectTreasuryCalendar({ now: new Date('2026-11-01T12:00:00Z'), fetchImpl: async url => new Response(url === endpoint ? calendar() : metadata()) });
  assert.equal(result.events.length, 1);
  assert.match(result.warnings.join(' '), /no upcoming|exhausted/i);
  assert.equal(result.coverageEnd, '2026-10-30');
});

test('Treasury collection rejects changed redirects, HTTP failures, invalid now and oversized responses', async () => {
  await assert.rejects(treasury().collectTreasuryCalendar({ now: new Date('invalid') }), /date|capture/i);
  for (const changedUrl of ['https://vendor.example/calendar', `${endpoint}?unreviewed=1`, metadataEndpoint]) {
    await assert.rejects(treasury().collectTreasuryCalendar({ fetchImpl: async url => { const response = new Response(url === endpoint ? calendar() : metadata()); Object.defineProperty(response, 'url', { value: url === endpoint ? changedUrl : url }); return response; } }), /URL|source|redirect/i);
  }
  await assert.rejects(treasury().collectTreasuryCalendar({ fetchImpl: async () => new Response('Unavailable', { status: 503 }) }), /HTTP.*503/i);
  await assert.rejects(treasury().collectTreasuryCalendar({ fetchImpl: async () => new Response(' '.repeat(2 * 1024 * 1024 + 1)) }), /limit/i);
});
