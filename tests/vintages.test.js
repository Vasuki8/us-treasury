import test from 'node:test';
import assert from 'node:assert/strict';
import { recordVintages, asKnownOn, revisionHistory } from '../src/vintages.js';

const times = ['2026-10-01T12:00:00.000Z', '2026-10-02T12:00:00.000Z', '2026-10-03T12:00:00.000Z'];
const observation = (date, value, extra = {}) => ({ date, value, publishedAt: null, ...extra });
const source = (fetchedAt, observations, extra = {}) => ({ id: 'treasury', fetchedAt, coverageNote: 'Current reviewed source coverage', provenance: [{ url: 'https://api.fiscaldata.treasury.gov/example', sha256: 'a'.repeat(64), retrievedAt: fetchedAt }], series: { test: { sourceIds: ['official-code'], sourceUrl: 'https://api.fiscaldata.treasury.gov/example', calculation: 'Official observation, no conversion', dataStatus: 'official', observations } }, ...extra });

test('new household captures retain their methodology and compound Treasury captures retain per-measure retrieval clocks',()=>{
 const first=source(times[0],[observation('2026-07-01',1)]);
 const legacy=recordVintages(null,{},sources(first),{checkedAt:times[2]});
 const richer=structuredClone(first);richer.series.test.fetchedAt=times[0];
 assert.deepEqual(recordVintages(legacy,{},sources(richer),{checkedAt:times[2]}),legacy,'additional collection metadata cannot rewrite an old immutable key');
 const next=source(times[1],[observation('2026-07-01',1)]);next.series.test.fetchedAt=times[0];next.provenance.push(first.provenance[0]);
 const result=recordVintages(legacy,{},sources(next),{checkedAt:times[2]});
 assert.equal(asKnownOn(result,times[1]).sources.treasury.series.test.fetchedAt,times[0]);
 for(const invalid of ['invalid',times[2],'2026-10-01T13:00:00.000Z']){
  const bad=structuredClone(next);bad.series.test.fetchedAt=invalid;
  assert.throws(()=>recordVintages(legacy,{},sources(bad),{checkedAt:times[2]}),/retriev|timestamp|provenance/i);
 }
 const household={...source(times[1],[observation('2026-07-01',1)]),id:'householdDebt',methodology:'credit-bureau-2024'};
 const history=recordVintages(null,{}, {householdDebt:household},{checkedAt:times[2]});
 assert.equal(asKnownOn(history,times[1]).sources.householdDebt.methodology,'credit-bureau-2024');
});
test('GDP subcomponent replay retains its parent and prevents later double-counting',()=>{
 const value={...source(times[1],[observation('2026-07-01',1)]),id:'macroContributions'};
 Object.assign(value.series.test,{contributionScope:'subcomponent',parentContribution:'investment'});
 const history=recordVintages(null,{}, {macroContributions:value},{checkedAt:times[2]});
 const restored=asKnownOn(history,times[1]).sources.macroContributions.series.test;
 assert.equal(restored.contributionScope,'subcomponent');assert.equal(restored.parentContribution,'investment');
});
const sources = item => ({ treasury: item });
const record = (vintages, previous, next, checkedAt = times[2]) => recordVintages(vintages, previous ? sources(previous) : {}, next ? sources(next) : {}, { checkedAt });

test('revision values retain their own measurement metadata through rescaling and later definition-only confirmations', () => {
  const first = source(times[0], [observation('2026-07-01', 2000)]);
  Object.assign(first.series.test, { unit: 'USD millions', format: 'millions', definition: 'Original scope' });
  const second = source(times[1], [observation('2026-07-01', 2)]);
  Object.assign(second.series.test, { unit: 'USD billions', format: 'billions', definition: 'Original scope' });
  const third = source(times[2], [observation('2026-07-01', 2)]);
  Object.assign(third.series.test, { unit: 'USD billions', format: 'billions', definition: 'Changed scope' });
  const history = revisionHistory(record(record(null, first, second), second, third), 'test')[0];
  assert.ok(history.firstMetadata, 'first captured measurement metadata must remain available');
  assert.equal(history.firstMetadata.unit, 'USD millions');
  assert.equal(history.latestMetadata.unit, 'USD billions');
  assert.equal(history.latestMetadata.definition, 'Changed scope');
  assert.equal(history.changes.length, 1, 'a definition-only change is not a new value revision');
  assert.equal(history.changes[0].previousMetadata.unit, 'USD millions');
  assert.equal(history.changes[0].metadata.unit, 'USD billions');
  assert.equal(history.changes[0].metadata.definition, 'Original scope');
  assert.equal(history.changes[0].previousCapturedAt, times[0]);
  assert.equal(history.changes[0].measurementComparable, false);
  assert.equal(history.changes[0].reason, 'unknown');
});

test('bootstraps a prior committed capture at its true retrieval time and appends deltas immutably', () => {
  const previous = source(times[0], [observation('2026-07-01', 1), observation('2026-08-01', 2)]);
  const next = source(times[1], [observation('2026-07-01', 1), observation('2026-08-01', 3)]);
  const original = JSON.stringify({ previous, next });
  const vintages = record(null, previous, next);
  assert.equal(vintages.version, 1);
  assert.equal(vintages.captures.length, 2);
  assert.equal(vintages.captures[0].baseline, true);
  assert.equal(vintages.captures[0].capturedAt, times[0]);
  assert.equal(vintages.captures[0].recordedAt, times[2]);
  assert.equal(vintages.captures[1].baseline, false);
  assert.deepEqual(vintages.captures[1].series.test.upserts.map(x => x.date), ['2026-08-01']);
  assert.equal(JSON.stringify({ previous, next }), original);
  const copy = JSON.stringify(vintages);
  record(vintages, next, source(times[2], next.series.test.observations));
  assert.equal(JSON.stringify(vintages), copy);
});

test('same source retrieval capture is idempotent while a same-key value collision is rejected', () => {
  const first = source(times[0], [observation('2026-07-01', 1)]);
  const vintages = record(null, null, first);
  assert.deepEqual(record(vintages, first, first), vintages);
  const collision = source(times[0], [observation('2026-07-01', 2)]);
  assert.throws(() => record(vintages, first, collision), /collision|immutable/i);
  const metadataCollision = source(times[0], [observation('2026-07-01', 1)]);
  metadataCollision.series.test.calculation = 'Different calculation';
  assert.throws(() => record(vintages, first, metadataCollision), /collision|immutable/i);
});

test('failed retained captures do not append attempts or rewrite original capture warnings', () => {
  const first = source(times[0], [observation('2026-07-01', 1)]);
  const vintages = record(null, null, first);
  const failed = { ...first, status: 'cached', error: 'HTTP 403', lastAttemptAt: times[1], warnings: ['Current refresh failed'] };
  assert.deepEqual(record(vintages, first, failed), vintages);
});

test('as-known cutoff is inclusive by actual retrieval and does not use release, period or recording time', () => {
  const first = source(times[0], [observation('2026-07-01', 1, { publishedAt: '2026-09-01T08:30:00.000Z' })]);
  const next = source(times[1], [observation('2026-07-01', 2, { publishedAt: '2026-09-01T08:30:00.000Z' })]);
  const vintages = record(null, first, next);
  assert.deepEqual(asKnownOn(vintages, '2026-09-30T23:59:59.999Z').sources, {});
  const exact = asKnownOn(vintages, times[0]).sources.treasury;
  assert.equal(exact.series.test.observations[0].value, 1);
  assert.equal(exact.series.test.sourceIds[0], 'official-code');
  assert.equal(exact.provenance[0].sha256, 'a'.repeat(64));
  assert.equal(asKnownOn(vintages, times[1]).sources.treasury.series.test.observations[0].value, 2);
  assert.equal(asKnownOn(vintages, '2026-09-15T12:00:00.000Z').sources.treasury, undefined);
});

test('new retrieval with identical observations stores compact capture metadata and preserves all observations', () => {
  const previous = source(times[0], [observation('2026-07-01', 1), observation('2026-08-01', 2)]);
  const next = source(times[1], previous.series.test.observations);
  const vintages = record(null, previous, next);
  assert.deepEqual(vintages.captures[1].series, {});
  const latest = asKnownOn(vintages, times[2]).sources.treasury;
  assert.equal(latest.fetchedAt, times[1]);
  assert.equal(latest.series.test.observations.length, 2);
  assert.deepEqual(revisionHistory(vintages, 'test'), []);
});

test('missing periods and removed series become coverage tombstones without value revisions', () => {
  const previous = source(times[0], [observation('2026-07-01', 1), observation('2026-08-01', 2)]);
  const next = source(times[1], [observation('2026-08-01', 2)]);
  const vintages = record(null, previous, next);
  assert.deepEqual(vintages.captures[1].series.test.deletedDates, ['2026-07-01']);
  assert.deepEqual(asKnownOn(vintages, times[1]).sources.treasury.series.test.observations.map(x => x.date), ['2026-08-01']);
  assert.deepEqual(revisionHistory(vintages, 'test'), []);
  const removed = record(vintages, next, source(times[2], [], { series: {} }));
  assert.deepEqual(removed.captures.at(-1).removedSeries, ['test']);
  assert.deepEqual(asKnownOn(removed, times[2]).sources.treasury.series, {});
  assert.deepEqual(revisionHistory(removed, 'test'), []);
});

test('tracks explicit null-to-zero value changes and calls them observed changes of unknown cause', () => {
  const previous = source(times[0], [observation('2026-07-01', null)]);
  const next = source(times[1], [observation('2026-07-01', 0)]);
  const vintages = record(null, previous, next);
  const history = revisionHistory(vintages, 'test');
  assert.equal(history.length, 1);
  assert.deepEqual(history[0].firstCaptured, { capturedAt: times[0], value: null });
  assert.deepEqual(history[0].latest, { capturedAt: times[1], value: 0 });
  assert.equal(history[0].changes[0].reason, 'unknown');
  assert.equal(history[0].changes[0].kind, 'observed-value-change');
  assert.equal(history[0].changes[0].previousValue, null);
  assert.equal(history[0].changes[0].value, 0);
  assert.equal(Object.hasOwn(history[0], 'firstReported'), false);
  const unchanged = record(vintages, next, source(times[2], next.series.test.observations));
  assert.deepEqual(revisionHistory(unchanged, 'test')[0].latest, { capturedAt: times[2], value: 0 });
  assert.equal(revisionHistory(unchanged, 'test')[0].changes.length, 1);
});

test('source omissions retain prior known facts and new sources get independent baselines', () => {
  const first = source(times[0], [observation('2026-07-01', 1)]);
  const vintages = record(null, null, first);
  assert.deepEqual(recordVintages(vintages, sources(first), {}, { checkedAt: times[2] }), vintages);
  const other = { ...source(times[1], [observation('2026-07-01', 4)]), id: 'bea' };
  const added = recordVintages(vintages, {}, { bea: other }, { checkedAt: times[2] });
  assert.equal(added.captures.at(-1).baseline, true);
  assert.equal(asKnownOn(added, times[2]).sources.bea.series.test.observations[0].value, 4);
  assert.equal(asKnownOn(added, times[2]).sources.treasury.series.test.observations[0].value, 1);
});

test('rejects malformed dates, duplicate periods, unsupported values and captures after recording time', () => {
  assert.throws(() => record(null, null, source('not a date', [])), /timestamp|date/i);
  assert.throws(() => record(null, null, source(times[2], []), times[0]), /future|record/i);
  assert.throws(() => record(null, null, source(times[0], [observation('2026-07-01', 1), observation('2026-07-01', 2)])), /duplicate/i);
  assert.throws(() => record(null, null, source(times[0], [observation('2026-02-30', 1)])), /date/i);
  assert.throws(() => record(null, null, source(times[0], [observation('2026-07-01', NaN)])), /value|finite/i);
  assert.throws(() => asKnownOn({ version: 1, captures: [] }, '2026-02-30T00:00:00.000Z'), /timestamp|date/i);
});

test('replay preserves captured rights notices and measurement metadata independently of later captures', () => {
  const rights = { sourceNotice: 'New York Fed source notice', licenseUrl: 'https://www.newyorkfed.org/privacy/termsofuse', termsUrl: 'https://www.newyorkfed.org/privacy/termsofuse.html', redistributionNotice: 'Retain the same permissions and conditions.', attribution: 'Source: Federal Reserve Bank of New York.', sourceTitle: 'Reference rates', sourceUrls: ['https://markets.newyorkfed.org/sofr', 'https://markets.newyorkfed.org/effr'], observationType: 'calculated', unit: 'Basis points', frequency: 'Daily', adjustment: 'Not seasonally adjusted', definition: 'Same-date difference between two funding rates.' };
  const first = source(times[0], [observation('2026-07-01', 5)], rights);
  Object.assign(first.series.test, rights);
  const next = source(times[1], [observation('2026-07-01', 6)], { ...rights, sourceNotice: 'Later source notice' });
  Object.assign(next.series.test, rights, { definition: 'Later definition' });
  const vintages = record(null, first, next);
  const early = asKnownOn(vintages, times[0]).sources.treasury;
  for (const [key, value] of Object.entries(rights)) {
    assert.deepEqual(early[key], value, `source ${key}`);
    assert.deepEqual(early.series.test[key], value, `series ${key}`);
  }
  const latest = asKnownOn(vintages, times[1]).sources.treasury;
  assert.equal(latest.sourceNotice, 'Later source notice');
  assert.equal(latest.series.test.definition, 'Later definition');
});

test('legacy whole-second UTC retrievals share canonical capture identity and inclusive cutoffs', () => {
  const legacyTime = '2026-10-01T12:00:00Z';
  const first = source(legacyTime, [observation('2026-07-01', 1)]);
  const vintages = record(null, null, first, '2026-10-03T12:00:00Z');
  assert.equal(vintages.captures[0].capturedAt, times[0]);
  assert.equal(vintages.captures[0].recordedAt, times[2]);
  assert.equal(asKnownOn(vintages, legacyTime).sources.treasury.fetchedAt, times[0]);
  assert.deepEqual(asKnownOn(vintages, '2026-10-01T11:59:59.999Z').sources, {});
  assert.deepEqual(record(vintages, first, { ...first, fetchedAt: times[0] }), vintages);

  const legacyHistory = structuredClone(vintages);
  legacyHistory.captures[0].capturedAt = legacyTime;
  legacyHistory.captures[0].recordedAt = '2026-10-03T12:00:00Z';
  assert.deepEqual(record(legacyHistory, first, { ...first, fetchedAt: times[0] }), legacyHistory);
  assert.equal(asKnownOn(legacyHistory, times[0]).sources.treasury.fetchedAt, times[0]);
  assert.throws(() => asKnownOn({ version: 1, captures: [...legacyHistory.captures, vintages.captures[0]] }, times[2]), /duplicate/i);
  assert.throws(() => asKnownOn(vintages, '2026-10-01T12:00:00+00:00'), /timestamp/i);
});

test('new retrievals retain measurement metadata while existing keys keep their original registry meaning', () => {
  const initial = source(times[0], [observation('2026-07-01', 1)]), original = structuredClone(initial);
  const firstMetadata = { name: 'Captured measure', unit: 'Basis points', frequency: 'Daily', format: 'basisPoints', precision: 2, adjustment: 'Not seasonally adjusted', definition: 'Original measured difference.', observationType: 'calculated', periodType: 'effective-day', dateConvention: 'business-day' };
  const vintages = recordVintages(null, {}, sources(initial), { checkedAt: times[2], seriesMetadata: { test: firstMetadata } });
  const first = asKnownOn(vintages, times[0]).sources.treasury.series.test;
  for (const [key, value] of Object.entries(firstMetadata)) assert.equal(first[key], value, key);
  assert.deepEqual(initial, original, 'enrichment does not modify the source snapshot');

  const changedMetadata = { ...firstMetadata, name: 'Later measure', definition: 'Later registered definition.', dateConvention: 'calendar-day' };
  assert.deepEqual(recordVintages(vintages, {}, sources(initial), { checkedAt: times[2], seriesMetadata: { test: changedMetadata } }), vintages, 'registry changes do not rewrite an existing retrieval key');
  const next = source(times[1], [observation('2026-07-01', 1)]);
  const latest = recordVintages(vintages, {}, sources(next), { checkedAt: times[2], seriesMetadata: { test: changedMetadata } });
  assert.deepEqual(latest.captures.slice(0,1), vintages.captures);
  assert.deepEqual(latest.captures[1].series.test.upserts, []);
  assert.equal(asKnownOn(latest, times[0]).sources.treasury.series.test.definition, 'Original measured difference.');
  assert.equal(asKnownOn(latest, times[1]).sources.treasury.series.test.definition, 'Later registered definition.');
  assert.equal(asKnownOn(latest, times[1]).sources.treasury.series.test.dateConvention, 'calendar-day');

  next.series.test.unit = 'Source-defined units';
  const explicit = recordVintages(vintages, {}, sources(next), { checkedAt: times[2], seriesMetadata: { test: changedMetadata } });
  assert.equal(asKnownOn(explicit, times[1]).sources.treasury.series.test.unit, 'Source-defined units');
});
