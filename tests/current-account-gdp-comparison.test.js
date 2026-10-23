import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountRegistry, currentAccountDefinitions, itaLocator} from '../src/current-account-registry.js';
import {CURRENT_ACCOUNT_GDP_COMPONENTS} from '../src/current-account-gdp-breakdown.js';
import {currentAccountGdpHistory} from '../src/current-account-gdp.js';
import {currentAccountGdpTrailing} from '../src/current-account-gdp-trailing.js';
import {CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES, resolveCurrentAccountComparisonMeasure, currentAccountGdpComparison} from '../src/current-account-gdp-comparison.js';

const dates = ['2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01', '2026-01-01', '2026-04-01'];
const row = (date, value) => ({date, value, sourceValue: value === null ? '...' : String(value), publishedAt: null});
function fixture() {
  const balances = {
    currentAccountBalance: [-100, -160, -200, -246.023, -220, -180],
    itaGoodsBalance: [-180, -250, -310, -291.302, -300, -260],
    itaServicesBalance: [70, 80, 90, 91.485, 100, 110],
    itaPrimaryIncomeBalance: [20, 30, 40, -11.405, 10, 0],
    itaSecondaryIncomeBalance: [-10, -20, -20, -34.802, -30, -30],
  };
  return {
    beaIta: {status: 'ok', series: Object.fromEntries(Object.entries(balances).map(([id, values]) => {
      const line = currentAccountDefinitions.find(([key]) => key === id)[1];
      return [id, {...currentAccountRegistry[id], sourceIds: [itaLocator(line)], observations: dates.map((date, index) => row(date, values[index]))}];
    }))},
    bea: {status: 'ok', series: {nominalGdp: {sourceIds: ['A191RC'], unit: 'Billions of current dollars (SAAR)', frequency: 'Quarterly', adjustment: 'Seasonally adjusted annual rate', dateConvention: 'quarter-start', periodType: 'flow', observations: dates.map((date, index) => row(date, [16000, 20000, 24000, 32000, 36000, 40000][index]))}}},
  };
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≈ ${expected}`);

test('comparison admits only the published current account and its four components', () => {
  assert.deepEqual(CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES, [{id: 'currentAccountBalance', label: 'Current account'}, ...CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id, label}) => ({id, label}))]);
  assert.ok(Object.isFrozen(CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES));
  assert.ok(CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES.every(Object.isFrozen));
  for (const {id} of CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES) assert.equal(resolveCurrentAccountComparisonMeasure(id), id);
  for (const value of [undefined, null, '', 'nominalGdp', 'netExports', 'itaGoodsServicesBalance', 'toString', {}, ['itaGoodsBalance']]) {
    assert.equal(resolveCurrentAccountComparisonMeasure(value), 'currentAccountBalance');
  }
});

test('comparison reuses exact quarterly and ratio-of-sums trailing points with a percentage-point horizon gap', () => {
  const sources = fixture(), before = structuredClone(sources), result = currentAccountGdpComparison(sources);
  const quarterly = currentAccountGdpHistory(sources), trailing = currentAccountGdpTrailing(sources);
  assert.equal(result.error, null);
  assert.deepEqual(result.measure, {id: 'currentAccountBalance', label: 'Current account'});
  assert.equal(result.observations.length, 6);
  assert.deepEqual(result.allObservations, result.observations);
  assert.deepEqual(result.series.map(series => series.id), ['currentAccountBalanceQuarterlyComparison', 'currentAccountBalanceTrailingComparison']);
  assert.deepEqual(result.series.map(series => series.short), ['Quarterly', 'Trailing four quarters']);
  assert.deepEqual(result.series[0].observations, quarterly.series.observations);
  assert.deepEqual(result.series[1].observations, trailing.totalSeries.observations);
  for (const series of result.series) {
    assert.equal(series.unit, 'Percent of nominal GDP');
    assert.equal(series.observationType, 'calculated');
    assert.match(series.name, /current account/i);
  }
  const point = result.observations[3];
  assert.deepEqual(point.quarterly, quarterly.observations[3]);
  assert.deepEqual(point.trailing, trailing.observations[3].total);
  close(point.quarterly.value, 100 * -246.023 / 8000);
  close(point.trailing.value, 100 * -706.023 / 23000);
  close(point.gap, point.quarterly.value - point.trailing.value);
  assert.notEqual(point.gap, point.quarterly.value - result.observations[2].quarterly.value);
  assert.equal(point.gapReason, null);
  assert.match(result.quarterlyFormula, /SAAR.*\/ 4/);
  assert.match(result.trailingFormula, /sum of 4/);
  assert.match(result.notice, /percentage.point.*horizon/i);
  assert.match(result.notice, /not.*revision/i);
  assert.match(result.notice, /not.*quarter.to.quarter/i);
  assert.deepEqual(sources, before);
});

test('all component comparisons retain independent official inputs and their own horizon values', () => {
  const sources = fixture(), trailing = currentAccountGdpTrailing(sources);
  for (const {id, label} of CURRENT_ACCOUNT_GDP_COMPONENTS) {
    const result = currentAccountGdpComparison(sources, {preset: 'all'}, id), point = result.observations[3];
    assert.deepEqual(result.measure, {id, label});
    assert.equal(result.series[0].id, `${id}QuarterlyComparison`);
    assert.equal(result.series[1].id, `${id}TrailingComparison`);
    assert.equal(point.quarterly.numeratorObservation, sources.beaIta.series[id].observations[3]);
    assert.deepEqual(point.trailing, trailing.observations[3].components[id]);
    close(point.quarterly.value, 100 * sources.beaIta.series[id].observations[3].value / 8000);
    close(point.gap, point.quarterly.value - point.trailing.value);
    assert.match(result.quarterlyFormula, /component balance/i);
  }
});

test('initial three windows retain valid quarterly points and unavailable trailing comparisons', () => {
  const result = currentAccountGdpComparison(fixture());
  for (const point of result.observations.slice(0, 3)) {
    assert.ok(Number.isFinite(point.quarterly.value));
    assert.equal(point.trailing.value, null);
    assert.equal(point.gap, null);
    assert.match(point.gapReason, /insufficient.*four.*quarter/i);
  }
});

test('custom and observation windows filter only endpoints after complete four-quarter calculations', () => {
  const sources = fixture(), result = currentAccountGdpComparison(sources, {preset: 'custom', startDate: '2026-01-01', endDate: '2026-01-01'}, 'itaServicesBalance');
  assert.equal(result.observations.length, 1);
  assert.equal(result.allObservations.length, 6);
  assert.ok(result.series.every(series => series.observations.length === 6));
  assert.deepEqual(result.observations[0].trailing.inputPoints.map(point => point.date), dates.slice(1, 5));
  close(result.observations[0].trailing.value, 100 * (80 + 90 + 91.485 + 100) / 28000);
  assert.deepEqual(currentAccountGdpComparison(sources, 1).observations.map(point => point.date), [dates.at(-1)]);
  const empty = currentAccountGdpComparison(sources, {preset: 'custom', startDate: '2030-01-01', endDate: '2030-12-31'});
  assert.deepEqual(empty.observations, []);
  assert.equal(empty.allObservations.length, 6);
  assert.equal(empty.error, null);
});

test('missing component inputs leave other measures valid and do not zero-fill trailing windows', () => {
  const sources = fixture();
  sources.beaIta.series.itaGoodsBalance.observations.splice(1, 1);
  const goods = currentAccountGdpComparison(sources, {preset: 'all'}, 'itaGoodsBalance');
  assert.equal(goods.error, null);
  assert.equal(goods.observations[1].quarterly.value, null);
  assert.ok(Number.isFinite(goods.observations[3].quarterly.value));
  assert.equal(goods.observations[3].trailing.value, null);
  assert.equal(goods.observations[3].gap, null);
  assert.match(goods.observations[3].gapReason, /missing.*2025-04-01/);
  assert.ok(Number.isFinite(goods.observations[5].gap));
  for (const measure of ['currentAccountBalance', 'itaServicesBalance']) assert.ok(Number.isFinite(currentAccountGdpComparison(sources, {preset: 'all'}, measure).observations[3].gap));
});

test('published total defines the exact endpoint calendar even when total observations are missing', () => {
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.splice(2, 1);
  sources.beaIta.series.itaServicesBalance.observations.unshift(row('2024-10-01', 20));
  sources.beaIta.series.itaServicesBalance.observations.push(row('2026-07-01', 120));
  const total = currentAccountGdpComparison(sources), services = currentAccountGdpComparison(sources, {preset: 'all'}, 'itaServicesBalance');
  assert.deepEqual(total.observations.map(point => point.date), dates);
  assert.deepEqual(services.observations.map(point => point.date), dates);
  assert.equal(total.observations[2].quarterly.value, null);
  assert.equal(total.observations[3].trailing.value, null);
  assert.ok(Number.isFinite(services.observations[2].quarterly.value));
  assert.ok(Number.isFinite(services.observations[3].trailing.value));
});

test('valid zero balances and zero gaps survive without unavailable or truthiness substitutions', () => {
  const sources = fixture();
  for (const observation of sources.beaIta.series.itaPrimaryIncomeBalance.observations) observation.value = 0;
  const point = currentAccountGdpComparison(sources, {preset: 'all'}, 'itaPrimaryIncomeBalance').observations[3];
  assert.equal(point.quarterly.value, 0);
  assert.equal(point.trailing.value, 0);
  assert.equal(point.gap, 0);
  assert.equal(point.gapReason, null);
});

test('wrong component metadata fails locally and incompatible common GDP metadata fails all measures', () => {
  for (const mutate of [series => {series.unit = 'USD billions (SAAR)';}, series => {series.sourceIds = ['wrong'];}, series => {series.observations.push(row('2025-01-01', 0));}]) {
    const sources = fixture();
    mutate(sources.beaIta.series.itaGoodsBalance);
    const goods = currentAccountGdpComparison(sources, {preset: 'all'}, 'itaGoodsBalance');
    assert.equal(goods.error, null);
    assert.ok(goods.observations.every(point => point.quarterly.value === null && point.trailing.value === null && point.gap === null));
    assert.match(goods.observations[3].gapReason, /incompatible|duplicate/i);
    assert.ok(Number.isFinite(currentAccountGdpComparison(sources).observations[3].gap));
  }
  const sources = fixture();
  sources.bea.series.nominalGdp.adjustment = 'Not seasonally adjusted';
  for (const {id} of CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES) {
    const result = currentAccountGdpComparison(sources, {preset: 'all'}, id);
    assert.match(result.error, /adjustment/i);
    assert.ok(result.observations.every(point => point.quarterly.value === null && point.trailing.value === null && point.gap === null));
  }
});

test('cached source status and future revisions preserve previous calculated values without mutation', () => {
  const sources = fixture(), before = currentAccountGdpComparison(sources, {preset: 'all'}, 'itaServicesBalance');
  sources.beaIta.status = 'cached';
  sources.bea.status = 'cached';
  assert.deepEqual(currentAccountGdpComparison(sources, {preset: 'all'}, 'itaServicesBalance').observations, before.observations);
  sources.beaIta.series.itaServicesBalance.observations[1].value += 10;
  const after = currentAccountGdpComparison(sources, {preset: 'all'}, 'itaServicesBalance');
  close(after.observations[1].quarterly.value - before.observations[1].quarterly.value, 100 * 10 / 5000);
  close(after.observations[3].trailing.value - before.observations[3].trailing.value, 100 * 10 / 23000);
  assert.equal(after.observations[3].quarterly.value, before.observations[3].quarterly.value);
  assert.equal(after.observations[5].gap, before.observations[5].gap);
});

test('overflow remains unavailable at either ratio or horizon-gap stage', () => {
  const sources = fixture();
  for (const observation of sources.bea.series.nominalGdp.observations) observation.value = 4e-206;
  for (const [index, observation] of sources.beaIta.series.currentAccountBalance.observations.entries()) observation.value = index === 3 ? 1e100 : -1.7e100;
  const point = currentAccountGdpComparison(sources).observations[3];
  assert.ok(Number.isFinite(point.quarterly.value));
  assert.ok(Number.isFinite(point.trailing.value));
  assert.equal(point.gap, null);
  assert.match(point.gapReason, /nonfinite/i);
  sources.beaIta.series.currentAccountBalance.observations[3].value = 1e308;
  const overflow = currentAccountGdpComparison(sources).observations[3];
  assert.equal(overflow.quarterly.value, null);
  assert.equal(overflow.gap, null);
});

test('invalid windows, malformed calendars, oversized spans and missing sources fail explicitly', () => {
  const invalid = currentAccountGdpComparison(fixture(), {preset: '10y'});
  assert.ok(invalid.error);
  assert.deepEqual(invalid.observations, []);
  assert.equal(invalid.allObservations.length, 6);
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.push(row('2026-04-02', -1));
  const badCalendar = currentAccountGdpComparison(sources);
  assert.match(badCalendar.error, /quarter date/);
  assert.deepEqual(badCalendar.observations, []);
  sources.beaIta.series.currentAccountBalance.observations = [row('1000-01-01', -1), row('2250-01-01', -1)];
  const oversized = currentAccountGdpComparison(sources, 1);
  assert.match(oversized.error, /5000/);
  assert.deepEqual(oversized.observations, []);
  assert.deepEqual(oversized.allObservations, []);
  assert.ok(oversized.series.every(series => series.observations.length === 0));
  const empty = currentAccountGdpComparison();
  assert.ok(empty.error);
  assert.deepEqual(empty.observations, []);
});

test('quarterly and trailing rows keep identical anchored calendars across partial and malformed retained inputs', () => {
  const mutations = [
    sources => {delete sources.beaIta;},
    sources => {delete sources.bea;},
    sources => {delete sources.beaIta.series.currentAccountBalance;},
    sources => {sources.beaIta.series.currentAccountBalance.observations = null;},
    sources => {sources.beaIta.series.currentAccountBalance.observations = [null];},
    sources => {sources.beaIta.series.currentAccountBalance.observations.push(row('2025-01-01', -1));},
    sources => {sources.beaIta.series.currentAccountBalance.observations.push(row('2026-04-02', -1));},
    sources => {sources.beaIta.series.currentAccountBalance.observations.splice(1, 1);},
    sources => {sources.beaIta.series.currentAccountBalance.sourceIds = ['wrong'];},
    sources => {sources.beaIta.series.itaServicesBalance.observations.splice(2, 1);},
    sources => {sources.beaIta.series.itaServicesBalance.observations = [null];},
    sources => {sources.beaIta.series.itaServicesBalance.observations.unshift(row('2024-10-01', 10));},
    sources => {sources.beaIta.series.itaServicesBalance.observations.push(row('2026-07-01', 10));},
    sources => {sources.bea.series.nominalGdp.observations.splice(1, 1);},
    sources => {sources.bea.series.nominalGdp.observations = {};},
    sources => {sources.bea.series.nominalGdp.sourceIds = ['wrong'];},
  ];
  for (const mutate of mutations) {
    const sources = fixture();
    mutate(sources);
    for (const {id} of CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES) {
      const result = currentAccountGdpComparison(sources, {preset: 'all'}, id);
      assert.deepEqual(result.series[0].observations.map(point => point.date), result.series[1].observations.map(point => point.date));
      assert.ok(result.allObservations.every(point => point.date === point.quarterly.date && point.date === point.trailing.date));
    }
  }
});
