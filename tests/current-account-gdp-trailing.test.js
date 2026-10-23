import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountRegistry, currentAccountDefinitions, itaLocator} from '../src/current-account-registry.js';
import {CURRENT_ACCOUNT_GDP_COMPONENTS} from '../src/current-account-gdp-breakdown.js';
import {currentAccountGdpTrailing} from '../src/current-account-gdp-trailing.js';

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

test('trailing ratios divide four-quarter balance sums by matching quarterly GDP sums, never average ratios', () => {
  const sources = fixture(), before = structuredClone(sources), result = currentAccountGdpTrailing(sources);
  const point = result.observations[3];
  assert.equal(result.error, null);
  assert.equal(result.series.length, 4);
  assert.equal(result.totalSeries.id, 'currentAccountTrailingToGdp');
  assert.equal(result.observations.length, 6);
  assert.equal(point.startDate, dates[0]);
  assert.equal(point.endDate, dates[3]);
  assert.deepEqual(point.inputDates, dates.slice(0, 4));
  assert.equal(point.total.currentAccountBalance, -706.023);
  assert.equal(point.total.nominalGdpQuarter, 23000);
  assert.equal(point.total.nominalGdpSaar, null);
  close(point.total.value, 100 * -706.023 / 23000);
  const meanQuarterlyRatios = [-100 / 4000, -160 / 5000, -200 / 6000, -246.023 / 8000].reduce((sum, value) => sum + 100 * value, 0) / 4;
  assert.ok(Math.abs(point.total.value - meanQuarterlyRatios) > 0.01);
  for (const [index, component] of CURRENT_ACCOUNT_GDP_COMPONENTS.entries()) {
    const series = result.series[index], observation = point.components[component.id];
    assert.equal(series.id, `${component.id}TrailingToGdp`);
    assert.equal(series.format, 'percent');
    assert.equal(series.unit, 'Percent of nominal GDP');
    assert.equal(series.frequency, 'Quarterly');
    assert.equal(series.observationType, 'calculated');
    assert.equal(series.observations[3], observation);
    assert.equal(observation.nominalGdpQuarter, 23000);
    assert.equal(observation.inputPoints.length, 4);
    for (let quarter = 0; quarter < 4; quarter++) {
      assert.equal(observation.inputPoints[quarter].numeratorObservation, sources.beaIta.series[component.id].observations[quarter]);
      assert.equal(observation.inputPoints[quarter].denominatorObservation, sources.bea.series.nominalGdp.observations[quarter]);
    }
  }
  assert.equal(result.totalSeries.observations[3], point.total);
  assert.match(result.formula, /sum.*4.*SAAR.*\/ 4/i);
  assert.match(result.notice, /revised.*independently/i);
  assert.match(result.notice, /not.*average/i);
  assert.deepEqual(sources, before);
});

test('the first three endpoint quarters explicitly retain insufficient coverage instead of dropping or filling them', () => {
  const sources = fixture();
  for (const id of CURRENT_ACCOUNT_GDP_COMPONENTS.map(component => component.id)) sources.beaIta.series[id].observations.unshift(row('2024-10-01', -1));
  sources.bea.series.nominalGdp.observations.unshift(row('2024-10-01', 10000));
  const result = currentAccountGdpTrailing(sources);
  assert.equal(result.window.fullStartDate, dates[0]);
  for (const point of result.observations.slice(0, 3)) {
    assert.equal(point.total.value, null);
    assert.equal(point.total.currentAccountBalance, null);
    assert.equal(point.total.nominalGdpQuarter, null);
    assert.match(point.total.reason, /insufficient.*four.*quarter/i);
    assert.ok(Object.values(point.components).every(item => item.value === null && /insufficient/i.test(item.reason)));
    assert.equal(point.inputDates.length, 4);
    assert.equal(point.componentSum, null);
    assert.equal(point.residualBalance, null);
  }
  assert.notEqual(result.observations[3].total.value, null);
});

test('windows select calculated endpoints after retaining the three-quarter lookback and cross calendar years', () => {
  const sources = fixture();
  const result = currentAccountGdpTrailing(sources, {preset: 'custom', startDate: '2026-01-01', endDate: '2026-01-01'});
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].date, '2026-01-01');
  assert.equal(result.observations[0].startDate, '2025-04-01');
  assert.deepEqual(result.observations[0].inputDates, dates.slice(1, 5));
  assert.equal(result.observations[0].total.nominalGdpQuarter, 28000);
  close(result.observations[0].total.value, 100 * (-160 - 200 - 246.023 - 220) / 28000);
  assert.equal(result.series[0].observations.length, 6);
  assert.deepEqual(currentAccountGdpTrailing(sources, 1).observations.map(point => point.date), [dates.at(-1)]);
});

test('published total remains separately calculated and the four-quarter rounding residual is retained', () => {
  const point = currentAccountGdpTrailing(fixture()).observations[3];
  close(point.componentSumBalance, -706.024);
  close(point.residualBalance, .001);
  close(point.total.value, point.componentSum + point.residual);
  close(point.residual, 100 * .001 / 23000);
});

test('one missing component affects only overlapping rolling points and cannot become a zero or a partial sum', () => {
  const sources = fixture();
  sources.beaIta.series.itaGoodsBalance.observations.splice(1, 1);
  const result = currentAccountGdpTrailing(sources);
  for (const point of result.observations.slice(3, 5)) {
    assert.equal(point.components.itaGoodsBalance.value, null);
    assert.match(point.components.itaGoodsBalance.reason, /2025-04-01.*missing|missing.*2025-04-01/);
    assert.ok(Number.isFinite(point.components.itaServicesBalance.value));
    assert.ok(Number.isFinite(point.total.value));
    assert.equal(point.componentSum, null);
    assert.equal(point.residual, null);
    assert.equal(point.componentSumBalance, null);
  }
  assert.ok(Number.isFinite(result.observations[5].components.itaGoodsBalance.value));
});

test('a missing internal published total keeps exact calendar endpoints and valid components without fabricating a total', () => {
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.splice(2, 1);
  const result = currentAccountGdpTrailing(sources);
  assert.deepEqual(result.observations.map(point => point.date), dates);
  for (const point of result.observations.slice(3)) {
    assert.equal(point.total.value, null);
    assert.ok(Object.values(point.components).every(component => Number.isFinite(component.value)));
    assert.equal(point.componentSum, null);
    assert.equal(point.residual, null);
    assert.equal(point.residualBalance, null);
  }
});

test('a retained null balance is missing even if other quarters permit a plausible partial aggregate', () => {
  for (const value of [null, NaN, Infinity, '-160']) {
    const sources = fixture();
    sources.beaIta.series.itaPrimaryIncomeBalance.observations[1].value = value;
    const point = currentAccountGdpTrailing(sources).observations[3].components.itaPrimaryIncomeBalance;
    assert.equal(point.value, null);
    assert.equal(point.currentAccountBalance, null);
    assert.equal(point.nominalGdpQuarter, 23000);
    assert.match(point.reason, /missing.*2025-04-01/);
  }
});

test('GDP requires four individually positive official quarters, not just a positive sum', () => {
  for (const value of [0, -1, null, NaN, Infinity, '20000']) {
    const sources = fixture();
    sources.bea.series.nominalGdp.observations[1].value = value;
    const result = currentAccountGdpTrailing(sources), point = result.observations[3];
    assert.equal(point.total.value, null);
    assert.equal(point.total.currentAccountBalance, -706.023);
    assert.equal(point.total.nominalGdpQuarter, null);
    assert.ok(Object.values(point.components).every(component => component.value === null && component.reason));
    assert.equal(point.componentSum, null);
    assert.ok(Number.isFinite(result.observations[5].total.value));
  }
  const sources = fixture();
  sources.bea.series.nominalGdp.observations.splice(1, 1);
  assert.equal(currentAccountGdpTrailing(sources).observations[3].total.inputPoints[1].denominatorObservation, null);
});

test('source identity, unit and duplicate-calendar guards are reused and preserve partial component availability', () => {
  const mutations = [
    series => {series.sourceIds = ['ITA:T1.1:line33:World:SA:Q'];},
    series => {series.unit = 'USD billions (SAAR)';},
    series => {series.observations.push(row('2026-04-01', 0));},
    series => {series.observations.push(row('2026-04-02', 0));},
  ];
  for (const mutate of mutations) {
    const sources = fixture();
    mutate(sources.beaIta.series.itaGoodsBalance);
    const result = currentAccountGdpTrailing(sources);
    assert.equal(result.error, null);
    assert.ok(result.observations.slice(3).every(point => point.components.itaGoodsBalance.value === null && point.components.itaGoodsBalance.reason));
    assert.ok(result.observations.slice(3).every(point => Number.isFinite(point.components.itaServicesBalance.value)));
  }
  const sources = fixture();
  sources.bea.series.nominalGdp.sourceIds = ['A191RL'];
  const result = currentAccountGdpTrailing(sources);
  assert.match(result.error, /identity/);
  assert.ok(result.observations.every(point => point.total.value === null));
});

test('common GDP metadata and duplicate dates invalidate every affected trailing ratio without selecting an arbitrary observation', () => {
  const mutations = [
    series => {series.unit = 'Billions of current dollars per quarter';},
    series => {series.adjustment = 'Not seasonally adjusted';},
    series => {series.observations.push(row('2025-04-01', 90000));},
  ];
  for (const mutate of mutations) {
    const sources = fixture();
    mutate(sources.bea.series.nominalGdp);
    const result = currentAccountGdpTrailing(sources);
    assert.ok(result.error);
    assert.ok(result.observations.every(point => point.total.value === null));
    assert.ok(result.series.every(series => series.observations.every(point => point.value === null)));
  }
});

test('nonfinite four-quarter aggregates remain unavailable rather than emitting an infinite ratio', () => {
  const sources = fixture();
  for (const observation of sources.beaIta.series.itaGoodsBalance.observations) observation.value = 1e308;
  const point = currentAccountGdpTrailing(sources).observations[3].components.itaGoodsBalance;
  assert.equal(point.currentAccountBalance, null);
  assert.equal(point.value, null);
  assert.match(point.reason, /nonfinite/i);
});

test('finite individual ratios cannot emit infinite component sums or reconciliation residuals', () => {
  for (const componentBalance of [1e100, -.25e100]) {
    const sources = fixture();
    for (const observation of sources.bea.series.nominalGdp.observations) observation.value = 4e-206;
    for (const observation of sources.beaIta.series.currentAccountBalance.observations) observation.value = 1e100;
    for (const {id} of CURRENT_ACCOUNT_GDP_COMPONENTS) {
      for (const observation of sources.beaIta.series[id].observations) observation.value = componentBalance;
    }
    const point = currentAccountGdpTrailing(sources).observations[3];
    assert.ok(Number.isFinite(point.total.value));
    assert.ok(Object.values(point.components).every(component => Number.isFinite(component.value)));
    for (const field of ['componentSum', 'residual', 'componentSumBalance', 'residualBalance']) {
      assert.ok(point[field] === null || Number.isFinite(point[field]), `${field} must be finite or null; got ${point[field]}`);
    }
    assert.equal(point.residual, null, 'Both sum overflow and residual subtraction overflow are unavailable');
    assert.equal(point.componentSum === null, componentBalance > 0, 'A finite component sum survives residual subtraction overflow');
    assert.ok(Number.isFinite(point.componentSumBalance));
    assert.ok(Number.isFinite(point.residualBalance));
  }
});

test('cached inputs calculate identically and subsequent revisions do not mutate earlier calculated results', () => {
  const sources = fixture(), previous = currentAccountGdpTrailing(sources);
  sources.beaIta.status = 'cached';
  sources.bea.status = 'cached';
  assert.deepEqual(currentAccountGdpTrailing(sources).observations, previous.observations);
  sources.beaIta.series.itaServicesBalance.observations[1].value += 10;
  const revised = currentAccountGdpTrailing(sources);
  close(revised.observations[3].components.itaServicesBalance.value - previous.observations[3].components.itaServicesBalance.value, 100 * 10 / 23000);
  assert.equal(previous.observations[3].components.itaServicesBalance.currentAccountBalance, 331.485);
  assert.equal(revised.observations[5].components.itaServicesBalance.value, previous.observations[5].components.itaServicesBalance.value);
});

test('invalid windows, malformed total calendars and oversized sparse spans fail before expanding history', () => {
  assert.ok(currentAccountGdpTrailing(fixture(), {preset: '10y'}).error);
  assert.deepEqual(currentAccountGdpTrailing(fixture(), {preset: '10y'}).observations, []);
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.push(row('2026-04-01', -1));
  const duplicate = currentAccountGdpTrailing(sources);
  assert.match(duplicate.error, /Duplicate/);
  assert.equal(duplicate.observations.length, 0);
  sources.beaIta.series.currentAccountBalance.observations = [row('1000-01-01', -1), row('2250-01-01', -1)];
  const oversized = currentAccountGdpTrailing(sources, 1);
  assert.match(oversized.error, /5000/);
  assert.deepEqual(oversized.observations, []);
  assert.ok(oversized.series.every(series => series.observations.length === 0));
  assert.equal(oversized.totalSeries.observations.length, 0);
  const empty = currentAccountGdpTrailing();
  assert.ok(empty.error);
  assert.deepEqual(empty.observations, []);
});
