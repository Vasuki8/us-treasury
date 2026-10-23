import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { series } from '../src/data.js';
import { canonicalJson } from '../src/research-workspaces.js';
import { createResearchPackage, exportResearchPackage, importResearchPackage } from '../src/research-packages.js';

const observation = (date, value) => ({ date, value, sourceValue: value === null ? '...' : String(value), publishedAt: null, footnotes: [] });
const source = (id, seriesId, sourceIds, values) => ({
  id, status: 'ok', fetchedAt: '2026-10-23T20:00:00.000Z', warnings: [], error: null,
  provenance: [{ url: 'https://www.bea.gov/data', sha256: 'a'.repeat(64), retrievedAt: '2026-10-23T20:00:00.000Z' }],
  series: { [seriesId]: { sourceIds, sourceUrl: 'https://www.bea.gov/data', observations: values } },
});
const history = () => ({
  version: 1, range: { preset: 'all' }, sources: {
    beaIta: source('beaIta', 'currentAccountBalance', ['ITA:T1.1:line30:World:SA:Q'], [observation('2025-07-01', -300), observation('2026-01-01', -400), observation('2026-04-01', null)]),
    bea: source('bea', 'nominalGdp', ['A191RC'], [observation('2025-07-01', 30000), observation('2025-10-01', 31000), observation('2026-01-01', 32000), observation('2026-04-01', 33000)]),
  },
});
const base = exportResearchPackage(await createResearchPackage({
  id: 'current-account-history-validation', name: 'Retained current-account history', now: '2026-10-23T21:00:00.000Z',
  state: { selected: ['gdp'], window: 'all' },
  catalog: { gdp: { ...series.gdp, observations: series.gdp.observations.slice(-2) } },
}));
function withHistory(value) {
  const plain = JSON.parse(base); plain.context.currentAccountGdpHistory = value; delete plain.checksum;
  plain.checksum = { algorithm: 'SHA-256', value: createHash('sha256').update(canonicalJson(plain)).digest('hex') };
  return JSON.stringify(plain);
}
async function rejects(change) {
  const value = history(), replacement = change(value);
  await assert.rejects(importResearchPackage(withHistory(replacement === undefined ? value : replacement)), /current.account.*history|date.window/i);
}

test('checksum-valid history supplements reject unsupported envelopes and malformed or missing required sources', async () => {
  for (const change of [
    () => null, () => [], () => 'Recorded history',
    value => { value.version = 2; }, value => { delete value.version; },
    value => { value.extra = 'Ignored data'; }, value => { delete value.range; },
    value => { value.sources = []; }, value => { value.sources = null; },
    value => { delete value.sources.bea; }, value => { delete value.sources.beaIta; },
    value => { value.sources.foreign = {}; }, value => { value.sources.bea = null; },
    value => { value.sources.beaIta = []; }, value => { value.sources.bea = 'GDP'; },
    value => { value.sources.bea.series = []; },
    value => { value.sources.bea.series.realGdp = value.sources.bea.series.nominalGdp; },
    value => { value.sources.beaIta.series.itaGoodsBalance = value.sources.beaIta.series.currentAccountBalance; },
    value => { value.sources.beaIta.series.currentAccountBalance.observations = {}; },
  ]) await rejects(change);
});

test('frozen historical windows reject malformed presets, hidden keys and invalid custom boundaries', async () => {
  for (const range of [null, 'all', -1, 1.5, 50001, {}, { preset: '10y' }, { preset: 'all', fallback: 'live' }, { preset: 'all', startDate: 123 }, { preset: 'custom', startDate: '2026-02-30', endDate: '2026-04-01' }, { preset: 'custom', startDate: '2026-04-01', endDate: '2026-01-01' }]) {
    await rejects(value => { value.range = range; });
  }
});

test('frozen input histories require bounded ordered unique quarters, finite or null values and render-safe metadata', async () => {
  for (const agency of ['beaIta', 'bea']) {
    const id = agency === 'beaIta' ? 'currentAccountBalance' : 'nominalGdp';
    for (const change of [
      item => { item.observations = [null]; },
      item => { item.observations[0].date = '2025-08-01'; },
      item => { item.observations[0].date = '2025-02-30'; },
      item => { item.observations[1].date = item.observations[0].date; },
      item => { item.observations.reverse(); },
      item => { item.observations[0].value = '-300'; },
      item => { delete item.observations[0].value; },
      item => { item.observations[0].footnotes = 'Footnote'; },
      item => { item.observations[0].sourceValue = {}; },
      item => { item.sourceIds = 'A191RC'; },
      item => { item.sourceUrl = ['https://www.bea.gov']; },
      item => { item.publicationNote = {}; },
    ]) await rejects(value => { change(value.sources[agency].series[id]); });
    for (const change of [
      item => { item.status = ['ok']; }, item => { item.fetchedAt = 123; },
      item => { item.coverageNote = []; }, item => { item.error = {}; },
      item => { item.tableReleaseDate = '2026-02-30'; },
      item => { item.provenance = [null]; }, item => { item.provenance[0].retrievedAt = {}; },
    ]) await rejects(value => { change(value.sources[agency]); });
    await rejects(value => { value.sources[agency].series[id].observations = Array.from({ length: 5001 }, (_, index) => observation(`${String(1000 + Math.floor(index / 4))}-${['01','04','07','10'][index % 4]}-01`, index)); });
  }
  await rejects(value => { value.sources.bea.series.nominalGdp.dataStatus = []; });
});

test('full raw histories, explicit nulls and valid calendar or count windows round-trip without trimming or filling gaps', async () => {
  for (const range of [0, 1, 50000, { preset: '1y' }, { preset: '3y', startDate: '', endDate: '' }, { preset: '5y' }, { preset: 'all' }, { preset: 'custom', startDate: '2025-09-15', endDate: '2026-03-28' }]) {
    const value = history(); value.range = range;
    value.sources.bea.series.nominalGdp.dataStatus = 'official';
    const pkg = await importResearchPackage(withHistory(value));
    assert.deepEqual(pkg.context.currentAccountGdpHistory, value);
    assert.equal(pkg.context.currentAccountGdpHistory.sources.beaIta.series.currentAccountBalance.observations.length, 3);
    assert.equal(pkg.context.currentAccountGdpHistory.sources.bea.series.nominalGdp.observations.length, 4);
    assert.equal(pkg.context.currentAccountGdpHistory.sources.beaIta.series.currentAccountBalance.observations[2].value, null);
    assert.equal(exportResearchPackage(pkg), canonicalJson(JSON.parse(withHistory(value))));
    assert.equal(Object.isFrozen(pkg.context.currentAccountGdpHistory.sources.beaIta.series.currentAccountBalance.observations), true);
  }
});

test('required source records can retain absent series, empty observations and unavailable coverage as captured claims', async () => {
  const empty = history(); empty.sources.beaIta.series.currentAccountBalance.observations = []; empty.sources.bea.series.nominalGdp.observations = [];
  for (const value of [history(), empty, { version: 1, range: { preset: 'all' }, sources: { beaIta: {}, bea: {} } }, { version: 1, range: 12, sources: { beaIta: { status: 'unavailable', series: {}, error: 'No ITA capture' }, bea: { status: 'error', series: {}, error: 'Recorded GDP failure' } } }]) {
    const pkg = await importResearchPackage(withHistory(value));
    assert.deepEqual(pkg.context.currentAccountGdpHistory, value);
  }
});

test('sparse frozen histories reject more than 5000 calendar quarters even when a narrow window is selected', async () => {
  for (const range of [1, { preset: 'all' }, { preset: 'custom', startDate: '2250-01-01', endDate: '2250-03-31' }]) {
    const value = history(); value.range = range;
    value.sources.beaIta.series.currentAccountBalance.observations = [observation('1000-01-01', null), observation('2250-01-01', -100)];
    await assert.rejects(importResearchPackage(withHistory(value)), /current.account.*history.*(?:span|quarter|limit)/i);
  }
  const boundary = history();
  boundary.sources.beaIta.series.currentAccountBalance.observations = [observation('1000-01-01', null), observation('2249-10-01', -100)];
  const pkg = await importResearchPackage(withHistory(boundary));
  assert.deepEqual(pkg.context.currentAccountGdpHistory, boundary);
});

test('history supplement does not loosen the existing two-observation GDP denominator bound', async () => {
  const plain = JSON.parse(withHistory(history()));
  plain.context.currentAccountGdpDenominator = history().sources.bea;
  delete plain.checksum;
  plain.checksum = { algorithm: 'SHA-256', value: createHash('sha256').update(canonicalJson(plain)).digest('hex') };
  await assert.rejects(importResearchPackage(JSON.stringify(plain)), /current.account.*GDP denominator.*bounded array/i);
});

test('older frozen packages stay byte-identical and acquire no historical supplement or live data', async () => {
  const originalFetch = globalThis.fetch, before = canonicalJson(series);
  globalThis.fetch = () => { throw new Error('Frozen imports must not fetch live data.'); };
  try {
    const legacy = await importResearchPackage(base);
    assert.equal(exportResearchPackage(legacy), base);
    assert.equal(Object.hasOwn(legacy.context, 'currentAccountGdpHistory'), false);
    const value = history(), retained = await importResearchPackage(withHistory(value));
    assert.deepEqual(retained.context.currentAccountGdpHistory, value);
    assert.equal(canonicalJson(series), before);
  } finally { globalThis.fetch = originalFetch; }
});
