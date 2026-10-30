import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../src/registry.js';
import { macroRegistry, coverageFamilies } from '../src/macro-registry.js';
import { series } from '../src/data.js';
import { snapshot } from '../src/official-snapshot.js';
import { comparisonClassification, compareSeries, toCsv } from '../src/model.js';
import { calendarRelatedIds } from '../src/macro-calendar.js';
import { parseRoute, routeFor } from '../src/router.js';
import { renderPage } from '../src/pages.js';
import { searchSeries } from '../src/search.js';
import { parseCsv } from '../scripts/sources/http.mjs';

const pairs = [['claims', 'claimsAdvance', 'InitialClaims/SA/Release'], ['continuedClaims', 'continuedClaimsAdvance', 'ContinuedClaims/SA/Release']];
const publicationNote = 'The official release supplies the publication date at day precision. The embargo heading does not verify the actual release instant; retrieval is separate.';

function fixture(id) {
  assert.ok(registry[id], `${id} must be registered separately from revised history`);
  const continued = id === 'continuedClaimsAdvance';
  return {
    ...registry[id], dataStatus: 'official', error: null, fetchedAt: '2026-10-22T13:00:00.000Z', publicationNote,
    coverageNote: 'Latest release context only: current advance and the prior-week value reported in the same release. Separate from revised history.',
    source: { ...registry[id].source, seriesIds: [continued ? 'ContinuedClaims/SA/Release' : 'InitialClaims/SA/Release'] },
    observations: [
      { date: continued ? '2026-10-03' : '2026-10-10', value: continued ? 1800 : 220, sourceValue: continued ? '1,800,000' : '220,000', publishedAt: '2026-10-22', publicationDatePrecision: 'day', releaseStage: 'prior-week-revised', footnotes: ['Prior-week value as revised in this release; not its original advance estimate.'] },
      { date: continued ? '2026-10-10' : '2026-10-17', value: continued ? 1810 : 221, sourceValue: continued ? '1,810,000' : '221,000', publishedAt: '2026-10-22', publicationDatePrecision: 'day', releaseStage: 'advance', footnotes: ['Current advance estimate in this release.'] },
    ],
  };
}

function withReadings(run) {
  const previous = new Map(pairs.map(([, id]) => [id, series[id]]));
  try {
    for (const [, id] of pairs) series[id] = fixture(id);
    return run();
  } finally {
    for (const [id, value] of previous) if (value === undefined) delete series[id]; else series[id] = value;
  }
}

test('advance release contexts have distinct IDs, source ownership, count semantics and labor discovery', () => {
  for (const [historyId, id, sourceId] of pairs) {
    const item = macroRegistry[id];
    assert.ok(item, `${id} must be an independent measurement`);
    assert.equal(registry[id], item);
    assert.equal(item.agency, 'dolAdvance');
    assert.equal(item.code, `ETA ${sourceId}`);
    assert.equal(item.unit, registry[historyId].unit);
    assert.equal(item.frequency, 'Weekly');
    assert.equal(item.dateConvention, 'week-ending');
    assert.equal(item.adjustment, 'Seasonally adjusted');
    assert.equal(comparisonClassification(item), 'count');
    assert.match(item.name, /latest release context/i);
    assert.match(item.definition, /prior.week/);
    assert.match(item.definition, /advance/);
    assert.equal(item.source.url,'https://www.dol.gov/ui/data.pdf','advance source links must open the release rather than the historical XML form');
    assert.match(item.definition, /day precision/);
    assert.match(item.definition, /not.*actual.*instant/i);
    assert.ok(coverageFamilies.labor.ids.includes(id));
    assert.ok(searchSeries(Object.values(registry), { query: item.name }).some(row => row.id === id));
    assert.equal(parseRoute(routeFor({ page: 'indicator', seriesId: id })).seriesId, id);
  }
  assert.equal(registry.claims.agency, 'dol');
  assert.equal(registry.continuedClaims.agency, 'dol');
});

test('DOL calendar connects all four measurements without rewriting captured schedule metadata', () => {
  const event = { sourceId: 'dol', program: 'weekly-claims', seriesId: 'claims', seriesIds: ['claims'], name: 'Unemployment Insurance Weekly Claims', publishedAt: undefined };
  const original = structuredClone(event);
  assert.deepEqual(calendarRelatedIds(event), ['claims', 'continuedClaims', 'claimsAdvance', 'continuedClaimsAdvance']);
  assert.deepEqual(event, original);
});

test('data mapping uses the source publication note for advance context and leaves historical fallback unchanged', async () => {
  const prior = snapshot.sources.dolAdvance, priorHistory = snapshot.sources.dol;
  snapshot.sources.dolAdvance = {
    id: 'dolAdvance', status: 'ok', fetchedAt: '2026-10-22T13:00:00.000Z', provenance: [],
    series: Object.fromEntries(pairs.map(([, id, sourceId]) => [id, { publicationNote, sourceIds: [sourceId], observations: [] }])),
  };
  // Exercise the legacy XML fallback independently of the live source, which
  // may retain a confirmed PDF supplement with its own publication note.
  snapshot.sources.dol = {
    id: 'dol', status: 'ok', fetchedAt: '2026-10-22T13:00:00.000Z', provenance: [],
    series: Object.fromEntries(pairs.map(([id]) => [id, { sourceIds: [id === 'claims' ? 'InitialClaims/SA' : 'ContinuedClaims/SA'], observations: [] }])),
  };
  try {
    const { series: mapped } = await import('../src/data.js?dol-advance-publication-note');
    for (const [, id] of pairs) {
      assert.ok(mapped[id], `${id} must be mapped`);
      assert.equal(mapped[id].publicationNote, publicationNote);
    }
    for (const [id] of pairs) assert.equal(mapped[id].publicationNote, 'The source feed does not provide historical publication timestamps. Retrieval time is shown separately; it is not a release date.');
  } finally {
    if (prior === undefined) delete snapshot.sources.dolAdvance; else snapshot.sources.dolAdvance = prior;
    snapshot.sources.dol = priorHistory;
  }
});

test('advance details display release roles and day dates, and link to separate revised histories in both directions', () => withReadings(() => {
  for (const [historyId, id] of pairs) {
    const html = renderPage(parseRoute(`#/series/${id}?window=all`));
    assert.match(html, /Latest release context/);
    assert.doesNotMatch(html, /\/ Historical series/);
    assert.match(html, /2026-10-22/);
    assert.match(html, /day precision/);
    assert.match(html, /embargo.*not.*actual release instant/i);
    assert.match(html, /Prior-week value as revised in this release/);
    assert.match(html, /Current advance estimate in this release/);
    assert.ok(html.includes(`href="#/series/${historyId}`));
    assert.match(html, /View revised history/);
    const history = renderPage(parseRoute(`#/series/${historyId}`));
    assert.ok(history.includes(`href="#/series/${id}`));
    assert.match(history, /View latest release context/);
    assert.ok(!history.includes(`data-series="${id}"`), 'the history detail must not add unpinned advance numerical panels');
  }
}));

test('labor links to advance context without injecting numerical panels; family dropdown exposes both measures', () => withReadings(() => {
  const html = renderPage(parseRoute('#/economy/labor'));
  for (const [, id] of pairs) {
    assert.ok(html.includes(`href="#/series/${id}`));
    assert.ok(!html.includes(`data-series="${id}"`));
  }
  assert.match(html, /revised history.*latest release context/i);
  const family = renderPage(parseRoute('#/economy?family=labor&measure=claimsAdvance&window=all'));
  for (const [, id] of pairs) assert.ok(family.includes(`<option value="${id}"`));
  assert.match(family, /data-series="claimsAdvance"/);
}));

test('unavailable and cached advance details retain their own source status and never substitute revised history', () => withReadings(() => {
  for (const [historyId, id] of pairs) {
    const retained = series[id];
    series[id] = { ...retained, observations: [], fetchedAt: null, dataStatus: 'unavailable', error: 'Advance source unavailable <test>' };
    const empty = renderPage(parseRoute(`#/series/${id}`));
    assert.match(empty, /Advance source unavailable &lt;test&gt;/);
    assert.match(empty, /UNAVAILABLE/i);
    assert.ok(!empty.includes(`data-series="${historyId}"`));
    series[id] = { ...retained, dataStatus: 'cached', error: 'Advance HTTP 503; retained the last successful release.' };
    const cached = renderPage(parseRoute(`#/series/${id}?window=all`));
    assert.match(cached, /CACHED OFFICIAL SNAPSHOT/i);
    assert.match(cached, /Advance HTTP 503/);
    assert.match(cached, /2026-10-22T13:00:00.000Z/);
    assert.ok(cached.includes(`href="#/series/${historyId}?window=all"`));
    assert.ok(!cached.includes(`data-series="${historyId}"`));
  }
}));

test('release-context comparisons and CSV preserve independent weeks, source counts, publication days and stage notes', () => {
  const ids = pairs.map(([, id]) => id), catalog = Object.fromEntries(ids.map(id => [id, fixture(id)]));
  catalog.continuedClaimsAdvance.observations[0].releaseStage = 'prior-week-unrevised';
  catalog.continuedClaimsAdvance.observations[0].footnotes = ['Prior-week value explicitly unrevised in this release; not its original advance estimate.'];
  const compared = compareSeries(ids, 'native', { preset: 'all' }, catalog);
  assert.equal(compared.error, null);
  assert.deepEqual(compared.panels.map(panel => panel.observations.at(-1).date), ['2026-10-17', '2026-10-10']);
  assert.deepEqual(compared.panels.map(panel => panel.unit), ['Thousands of claims', 'Thousands of continued claims']);
  const [headers, ...rows] = parseCsv(toCsv(ids, { range: { preset: 'all' }, catalog }));
  assert.equal(rows.length, 4);
  for (const id of ids) {
    const own = rows.filter(row => row[headers.indexOf('series_id')] === id);
    assert.deepEqual(own.map(row => row[headers.indexOf('source_value')]), catalog[id].observations.map(row => row.sourceValue));
    assert.ok(own.every(row => row[headers.indexOf('publication_date')] === '2026-10-22'));
    assert.ok(own.every(row => row[headers.indexOf('retrieved_at')] === '2026-10-22T13:00:00.000Z'));
    assert.match(own[0][headers.indexOf('source_notes')], id === 'continuedClaimsAdvance' ? /prior.week.*explicitly unrevised/i : /prior.week.*as revised/i);
    assert.match(own[1][headers.indexOf('source_notes')], /advance/i);
  }
});
