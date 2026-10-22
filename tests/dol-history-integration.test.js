import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../src/registry.js';
import { compareSeries, resolveDateWindow, toCsv, transformSeries, windowObservations } from '../src/model.js';
import { createResearchPackage, exportResearchPackage, importResearchPackage, packagePanels, researchPackageCsv } from '../src/research-packages.js';
import { createResearchLibrary, RESEARCH_LIBRARY_KEY } from '../src/research-library.js';
import { asKnownOn, recordVintages } from '../src/vintages.js';
import { captureChanges } from '../src/capture-changes.js';
import { parseCsv } from '../scripts/sources/http.mjs';
import { refreshSnapshot } from '../scripts/sources/refresh.mjs';

const ids = ['claims', 'continuedClaims'];
const endpoint = 'https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const oldRetrieval = '2026-10-20T12:00:00.000Z';
const newRetrieval = '2026-10-22T12:00:00.000Z';
const missingWeek = '2008-10-04';
const clone = value => JSON.parse(JSON.stringify(value));

// Synthetic dates and counts exercise decades of weekly inputs; they do not
// establish the real source's coverage, historical values, or release dates.
function observations(id) {
  const rows = [];
  let index = 0;
  for (let time = Date.parse('1967-01-07T00:00:00Z'); time <= Date.parse('2026-09-26T00:00:00Z'); time += 7 * 86400000) {
    const date = new Date(time).toISOString().slice(0, 10);
    const count = id === 'claims' ? 200000 + index * 10 : 2000000 + index * 100;
    rows.push({ date, value: date === missingWeek ? null : count / 1000, sourceValue: date === missingWeek ? '' : String(count), publishedAt: null });
    index++;
  }
  return id === 'continuedClaims' ? rows.slice(1, -1) : rows;
}

function source(fetchedAt = newRetrieval, recentOnly = false) {
  return {
    id: 'dol', status: 'ok', fetchedAt, lastAttemptAt: fetchedAt,
    provenance: [{ url: endpoint, sha256: (recentOnly ? 'a' : 'b').repeat(64), retrievedAt: fetchedAt, lastModified: null }],
    warnings: [],
    series: Object.fromEntries(ids.map(id => [id, {
      sourceUrl: endpoint,
      sourceIds: [id === 'claims' ? 'InitialClaims/SA' : 'ContinuedClaims/SA'],
      calculation: `Published seasonally adjusted ${id === 'claims' ? 'initial' : 'continued'} claims count / 1000; week ending.`,
      coverageNote: 'Synthetic retained history. Historical feed may lag advance releases; retrieval does not establish historical publication dates.',
      licenseUrl: 'https://www.dol.gov/general/aboutdol/copyright',
      attribution: 'Source: U.S. Department of Labor, Employment and Training Administration.',
      sourceTitle: 'Unemployment Insurance Weekly Claims Data',
      observations: recentOnly ? observations(id).slice(-52) : observations(id),
    }]))
  };
}

function catalogFrom(input = source()) {
  return Object.fromEntries(ids.map(id => {
    const item = input.series[id];
    return [id, {
      ...registry[id], ...clone(item), comparisonClass: 'count',
      source: { ...registry[id].source, seriesIds: [...item.sourceIds] },
      fetchedAt: input.fetchedAt, provenance: clone(input.provenance), dataStatus: 'official', observationType: 'official',
    }];
  }));
}

function csvObjects(text) {
  const [headers, ...rows] = parseCsv(text);
  return rows.filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((key, index) => [key, row[index]])));
}

test('decades of claims retain independent coverage in shared All, 5Y and inclusive custom windows', () => {
  const catalog = catalogFrom(), selected = ids.map(id => catalog[id]);
  const all = resolveDateWindow({ preset: 'all' }, selected);
  assert.equal(all.startDate, '1967-01-07');
  assert.equal(all.endDate, '2026-09-26');
  for (const item of selected) {
    assert.ok(item.observations.length > 3000);
    assert.deepEqual(windowObservations(item.observations, all), item.observations);
  }
  const fiveYears = compareSeries(ids, 'native', { preset: '5y' }, catalog);
  assert.equal(fiveYears.error, null);
  assert.equal(fiveYears.window.startDate, '2021-09-26');
  assert.equal(fiveYears.window.endDate, '2026-09-26');
  for (const panel of fiveYears.panels) {
    assert.equal(panel.observations[0].date, '2021-10-02');
    assert.ok(panel.observations.length > 250 && panel.observations.length < 265);
    assert.equal(panel.coverage.fullCount, catalog[panel.series.id].observations.length);
  }
  assert.equal(fiveYears.panels[0].coverage.endDate, '2026-09-26');
  assert.equal(fiveYears.panels[1].coverage.endDate, '2026-09-19');

  const custom = { preset: 'custom', startDate: '2008-09-27', endDate: '2008-10-18' };
  const result = compareSeries(ids, 'native', custom, catalog);
  assert.equal(result.error, null);
  for (const panel of result.panels) {
    assert.deepEqual(panel.observations.map(row => row.date), ['2008-09-27', '2008-10-04', '2008-10-11', '2008-10-18']);
    assert.equal(panel.observations[1].value, null);
    const changes = transformSeries(panel.series, 'change', custom).observations;
    assert.notEqual(changes[0].value, null, 'the first displayed change can use the retained prior week');
    assert.equal(changes[1].value, null);
    assert.equal(changes[2].value, null, 'a source missing week cannot become a two-week period change');
  }
  const empty = compareSeries(ids, 'native', { preset: 'custom', startDate: '1950-01-01', endDate: '1950-12-31' }, catalog);
  assert.equal(empty.error, null);
  assert.ok(empty.panels.every(panel => panel.observations.length === 0));
  assert.equal(empty.window.startDate, '1950-01-01');
});

test('long claims comparisons preserve separate native units and use only an exact shared positive baseline', () => {
  const catalog = catalogFrom();
  const native = compareSeries(ids, 'native', { preset: 'all' }, catalog);
  assert.equal(native.error, null);
  assert.deepEqual(native.panels.map(panel => panel.unit), ['Thousands of claims', 'Thousands of continued claims']);
  assert.deepEqual(native.panels.map(panel => panel.observations[0].date), ['1967-01-07', '1967-01-14']);

  for (const mode of ['indexed', 'difference']) {
    const comparison = compareSeries(ids, mode, { preset: 'all' }, catalog);
    assert.equal(comparison.error, null);
    for (const panel of comparison.panels) {
      assert.equal(panel.baselineDate, '1967-01-14');
      assert.equal(panel.observations[0].value, mode === 'indexed' ? 100 : 0);
      assert.equal(panel.baselineValue, catalog[panel.series.id].observations.find(row => row.date === panel.baselineDate).value);
      assert.equal(panel.observations.find(row => row.date === missingWeek).value, null);
      assert.equal(panel.observations.at(-1).date, catalog[panel.series.id].observations.at(-1).date);
      assert.equal(panel.unit, mode === 'indexed' ? 'Index (common baseline = 100)' : catalog[panel.series.id].unit);
      assert.equal(panel.formula, mode === 'indexed' ? '100 × value / baseline' : 'value − baseline');
    }
  }
  const zero = clone(catalog);
  zero.claims.observations[10].value = 0;
  assert.match(compareSeries(ids, 'indexed', { preset: 'all' }, zero).error, /positive|zero/i);
  assert.equal(compareSeries(ids, 'native', { preset: 'all' }, zero).panels[0].observations[10].value, 0);
});

test('claims CSV exports the exact selected calendar with raw counts, units, rights and actual retrieval metadata', () => {
  const input = source(), catalog = catalogFrom(input);
  const range = { preset: 'custom', startDate: '2008-09-27', endDate: '2008-10-18' };
  const rows = csvObjects(toCsv(ids, { range, catalog }));
  assert.equal(rows.length, 8);
  for (const id of ids) {
    const selected = rows.filter(row => row.series_id === id);
    assert.deepEqual(selected.map(row => row.date), ['2008-09-27', '2008-10-04', '2008-10-11', '2008-10-18']);
    for (const row of selected) {
      const original = catalog[id].observations.find(item => item.date === row.date);
      assert.equal(row.value, original.value === null ? '' : String(original.value));
      assert.equal(row.source_value, original.sourceValue);
      assert.equal(row.unit, catalog[id].unit);
      assert.equal(row.frequency, 'Weekly');
      assert.equal(row.adjustment, 'Seasonally adjusted');
      assert.equal(row.publication_date, '', 'historical reference dates do not invent publication clocks');
      assert.equal(row.retrieved_at, newRetrieval);
      assert.equal(row.source_series, input.series[id].sourceIds[0]);
      assert.equal(row.calculation, input.series[id].calculation);
      assert.equal(row.license_url, input.series[id].licenseUrl);
      assert.equal(row.attribution, input.series[id].attribution);
      assert.equal(row.source_url, endpoint);
      assert.deepEqual(JSON.parse(row.capture_provenance_json), input.provenance);
      assert.equal(row.window_preset, 'custom');
      assert.equal(row.window_start_date, range.startDate);
      assert.equal(row.window_end_date, range.endDate);
    }
  }
  const indexed = csvObjects(toCsv(ids, { range: { preset: 'all' }, comparison: 'indexed', catalog }));
  for (const id of ids) {
    const first = indexed.find(row => row.series_id === id);
    assert.equal(first.date, '1967-01-14');
    assert.equal(first.value, '100');
    assert.equal(first.comparison_mode, 'indexed');
    assert.equal(first.comparison_baseline_date, '1967-01-14');
    assert.equal(first.comparison_formula, '100 × value / baseline');
  }
});

test('a portable claims package freezes decades of inputs and exact All CSV independently of later live data', async t => {
  const input = source(), catalog = catalogFrom(input);
  const expectedCsv = toCsv(ids, { range: { preset: 'all' }, catalog });
  const pkg = await createResearchPackage({
    id: 'synthetic-long-claims', name: 'Synthetic long claims study', now: newRetrieval,
    state: { page: 'compare', selected: ids, window: 'all', comparison: 'native', transform: 'level' },
    catalog, sources: { dol: input }, snapshot: { generatedAt: newRetrieval, checkedAt: newRetrieval },
    context: { route: '#/compare', notes: 'Synthetic data; latest revised histories are not original publication vintages.' },
    assumptions: { noInterpolation: true, missingWeeksRemainNull: true },
  });
  const serialized = exportResearchPackage(pkg);
  assert.ok(Buffer.byteLength(serialized) < 12 * 1024 * 1024);
  t.diagnostic(`Synthetic two-series All package: ${Buffer.byteLength(serialized)} bytes for ${ids.reduce((count, id) => count + catalog[id].observations.length, 0)} weekly inputs.`);
  assert.equal(researchPackageCsv(pkg), expectedCsv);
  for (const id of ids) assert.deepEqual(pkg.catalog[id].observations, catalog[id].observations);
  assert.equal(pkg.sources.dol.fetchedAt, newRetrieval);
  assert.equal(pkg.resolvedWindow.startDate, '1967-01-07');
  assert.equal(pkg.resolvedWindow.endDate, '2026-09-26');
  assert.equal(Object.isFrozen(pkg.catalog.claims.observations), true);
  catalog.claims.observations[0].value = 999999;
  catalog.continuedClaims.observations.splice(0, 100);
  input.provenance[0].sha256 = 'c'.repeat(64);
  const imported = await importResearchPackage(serialized);
  assert.equal(exportResearchPackage(imported), serialized);
  assert.equal(researchPackageCsv(imported), expectedCsv);
  assert.deepEqual(packagePanels(imported).map(panel => [panel.series.id, panel.coverage.fullCount, panel.coverage.startDate, panel.coverage.endDate]), [
    ['claims', pkg.catalog.claims.observations.length, '1967-01-07', '2026-09-26'],
    ['continuedClaims', pkg.catalog.continuedClaims.observations.length, '1967-01-14', '2026-09-19'],
  ]);
  assert.equal(imported.catalog.claims.observations.find(row => row.date === missingWeek).value, null);
  assert.equal(imported.catalog.claims.licenseUrl, pkg.catalog.claims.licenseUrl);
  assert.equal(imported.catalog.continuedClaims.definition, registry.continuedClaims.definition);
  assert.equal(imported.sources.dol.provenance[0].sha256, 'b'.repeat(64));

  // A valid portable download can exceed the smaller browser library budget.
  // Keep the package available in this session without replacing durable bytes.
  const durable = JSON.stringify({ version: 1, workspaces: [], packages: [] });
  const stored = new Map([[RESEARCH_LIBRARY_KEY, durable]]);
  let writes = 0;
  const library = await createResearchLibrary({
    getItem: key => stored.get(key) ?? null,
    setItem: (key, value) => { writes++; stored.set(key, value); },
  }, { locks: { request: async (_name, options, callback) => {
    assert.equal(options.mode, 'exclusive');
    return callback();
  } } });
  const pinned = await library.pinPackage(imported);
  assert.equal(pinned.ok, true);
  assert.equal(pinned.persisted, false);
  assert.equal(pinned.reason, 'quota');
  assert.equal(library.getState().sessionOnly, true);
  assert.match(library.getState().warning, /storage limit.*session-only/i);
  assert.equal(exportResearchPackage(library.getPackage(imported.id)), serialized);
  assert.equal(writes, 0);
  assert.equal(stored.get(RESEARCH_LIBRARY_KEY), durable);
});

test('earlier reference weeks become available only at the actual backfill retrieval while old captures stay exact', () => {
  const prior = source(oldRetrieval, true), next = source();
  const baseline = recordVintages(null, {}, { dol: prior }, { checkedAt: oldRetrieval, seriesMetadata: registry });
  const originalBytes = JSON.stringify(baseline.captures);
  const history = recordVintages(baseline, { dol: prior }, { dol: next }, { checkedAt: newRetrieval, seriesMetadata: registry });
  assert.equal(history.captures.length, 2);
  assert.equal(JSON.stringify(history.captures.slice(0, 1)), originalBytes);
  assert.equal(JSON.stringify(baseline.captures), originalBytes);
  assert.deepEqual(asKnownOn(history, '2026-10-20T11:59:59.999Z').sources, {});
  const before = asKnownOn(history, '2026-10-22T11:59:59.999Z').sources.dol;
  const after = asKnownOn(history, newRetrieval).sources.dol;
  for (const id of ids) {
    assert.deepEqual(before.series[id].observations, prior.series[id].observations);
    assert.equal(before.series[id].observations.length, 52);
    assert.deepEqual(after.series[id].observations, next.series[id].observations);
    assert.equal(after.series[id].observations[0].publishedAt, null);
    assert.ok(history.captures[1].series[id].upserts.every(row => row.date < prior.series[id].observations[0].date));
  }
  assert.equal(before.fetchedAt, oldRetrieval);
  assert.equal(after.fetchedAt, newRetrieval);
  assert.equal(after.provenance[0].retrievedAt, newRetrieval);
  const changes = captureChanges(history, { ids, since: oldRetrieval });
  assert.equal(changes.length, ids.reduce((count, id) => count + next.series[id].observations.length - 52, 0));
  assert.ok(changes.every(row => row.kind === 'historical-backfill' && row.capturedAt === newRetrieval && row.publicationDate === null));
  assert.ok(changes.some(row => row.seriesId === 'claims' && row.period === '1967-01-07'));
});

test('a required DOL-only backfill preserves unrelated sources and calendar and appends only its new capture', async () => {
  const prior = source(oldRetrieval, true), next = source();
  const other = { id: 'bea', fetchedAt: oldRetrieval, provenance: [], series: { gdp: { observations: [{ date: '2026-04-01', value: 1, publishedAt: null }] } } };
  const event = { id: 'retained-event', scheduledAt: '2026-10-23T12:30:00Z' };
  const calendar = { status: 'partial', sources: { bea: { events: [event] } }, links: [] };
  const previous = { sources: { dol: prior, bea: other }, calendar, releases: [event], publicationPolicy: { mode: 'retained-test-policy' } };
  previous.vintages = recordVintages(null, {}, previous.sources, { checkedAt: oldRetrieval, seriesMetadata: registry });
  const originalBytes = JSON.stringify(previous), originalCaptures = JSON.stringify(previous.vintages.captures);
  const refreshed = await refreshSnapshot({ previous, collectors: { dol: async () => clone(next) }, now: new Date(newRetrieval), requireAll: true });
  assert.equal(refreshed.sources.bea, other);
  assert.equal(refreshed.calendar, calendar);
  assert.deepEqual(refreshed.releases, [event]);
  assert.equal(refreshed.publicationPolicy, previous.publicationPolicy);
  assert.equal(refreshed.sources.dol.series.claims.observations.length, next.series.claims.observations.length);
  assert.equal(JSON.stringify(refreshed.vintages.captures.slice(0, -1)), originalCaptures);
  assert.equal(refreshed.vintages.captures.at(-1).sourceId, 'dol');
  assert.equal(refreshed.vintages.captures.at(-1).capturedAt, newRetrieval);
  assert.equal(JSON.stringify(previous), originalBytes);
  await assert.rejects(refreshSnapshot({ previous, collectors: { dol: async () => { throw new Error('synthetic DOL failure'); } }, now: new Date(newRetrieval), requireAll: true }), /Required official refresh failed/);
  assert.equal(JSON.stringify(previous), originalBytes);
});
