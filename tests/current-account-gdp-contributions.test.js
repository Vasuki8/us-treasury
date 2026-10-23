import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountRegistry, currentAccountDefinitions, itaLocator} from '../src/current-account-registry.js';
import {CURRENT_ACCOUNT_GDP_COMPONENTS} from '../src/current-account-gdp-breakdown.js';
import {currentAccountGdpContributions} from '../src/current-account-gdp-contributions.js';

const dates = ['2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01', '2026-01-01', '2026-04-01'];
const row = (date, value) => ({date, value, sourceValue: value === null ? '...' : String(value), publishedAt: null});
function fixture() {
  const balances = {
    currentAccountBalance: [-7, -18, -24, -2, -35, -30],
    itaGoodsBalance: [-10, -30, -30, -20, -50, -60],
    itaServicesBalance: [4, 12, 6, 20, 20, 30],
    itaPrimaryIncomeBalance: [1, 2, 3, 8, 5, 12],
    itaSecondaryIncomeBalance: [-2, -4, -3, -8, -5, -12],
  };
  return {
    beaIta: {status: 'ok', series: Object.fromEntries(Object.entries(balances).map(([id, values]) => {
      const line = currentAccountDefinitions.find(([key]) => key === id)[1];
      return [id, {...currentAccountRegistry[id], sourceIds: [itaLocator(line)], observations: dates.map((date, index) => row(date, values[index]))}];
    }))},
    bea: {status: 'ok', series: {nominalGdp: {sourceIds: ['A191RC'], unit: 'Billions of current dollars (SAAR)', frequency: 'Quarterly', adjustment: 'Seasonally adjusted annual rate', dateConvention: 'quarter-start', periodType: 'flow', observations: dates.map((date, index) => row(date, [400, 800, 1200, 1600, 2000, 2400][index]))}}},
  };
}
const close = (actual, expected) => assert.ok(typeof actual === 'number' && Math.abs(actual - expected) < 1e-12, `${actual} ≈ ${expected}`);
const changes = horizon => CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id}) => horizon.components[id].value);

test('quarterly changes attribute exact component ratios with changing GDP and retain residual changes', () => {
  const sources = fixture(), before = structuredClone(sources), result = currentAccountGdpContributions(sources);
  assert.equal(result.error, null);
  assert.equal(result.observations.length, 6);
  assert.deepEqual(result.observations, result.allObservations);
  const firstChange = result.observations[1];
  assert.equal(firstChange.date, '2025-04-01');
  assert.equal(firstChange.priorDate, '2025-01-01');
  assert.deepEqual(changes(firstChange.quarterly), [-5, 2, 0, 0]);
  close(firstChange.quarterly.totalChange, -2);
  close(firstChange.quarterly.componentSumChange, -3);
  close(firstChange.quarterly.residualChange, 1);
  assert.equal(firstChange.quarterly.reason, null);
  assert.equal(firstChange.quarterly.current.total.numeratorObservation, sources.beaIta.series.currentAccountBalance.observations[1]);
  assert.equal(firstChange.quarterly.prior.components.itaGoodsBalance.numeratorObservation, sources.beaIta.series.itaGoodsBalance.observations[0]);
  const latest = result.observations[4].quarterly;
  assert.deepEqual(changes(latest), [-5, -1, -1, 1]);
  close(latest.totalChange, -6.5);
  close(latest.componentSumChange, -6);
  close(latest.residualChange, -0.5);
  for (const point of result.observations.slice(1)) {
    close(point.quarterly.componentSumChange + point.quarterly.residualChange, point.quarterly.totalChange);
  }
  assert.match(result.formula, /current.*component.*ratio.*prior.*component.*ratio/i);
  assert.match(result.notice, /GDP.*denominator.*included/i);
  assert.match(result.notice, /accounting.*not.*causal/i);
  assert.match(result.notice, /not.*official BEA.*contribution/i);
  assert.deepEqual(sources, before);
});

test('adjacent trailing changes use two exact overlapping ratio-of-sums windows and five raw quarters', () => {
  const result = currentAccountGdpContributions(fixture()), point = result.observations[4].trailing;
  assert.deepEqual(point.current.inputDates, dates.slice(1, 5));
  assert.deepEqual(point.prior.inputDates, dates.slice(0, 4));
  close(point.components.itaGoodsBalance.value, 100 * -130 / 1400 - -9);
  close(point.components.itaServicesBalance.value, 100 * 58 / 1400 - 4.2);
  close(point.components.itaPrimaryIncomeBalance.value, 100 * 18 / 1400 - 1.4);
  close(point.components.itaSecondaryIncomeBalance.value, 100 * -20 / 1400 - -1.7);
  close(point.totalChange, 100 * -79 / 1400 - -5.1);
  close(point.residualChange, 100 * -5 / 1400);
  close(point.componentSumChange + point.residualChange, point.totalChange);
  assert.notEqual(point.totalChange, result.observations[4].quarterly.totalChange);
  assert.equal(point.reason, null);
  assert.match(result.notice, /overlap.*three quarters/i);
});

test('first retained quarter and first four trailing endpoints remain unavailable without falling back', () => {
  const sources = fixture();
  sources.bea.series.nominalGdp.observations.unshift(row('2024-10-01', 300));
  for (const {id} of CURRENT_ACCOUNT_GDP_COMPONENTS) sources.beaIta.series[id].observations.unshift(row('2024-10-01', 1));
  const result = currentAccountGdpContributions(sources), first = result.observations[0];
  assert.equal(first.priorDate, '2024-10-01');
  assert.equal(first.quarterly.prior, null);
  assert.equal(first.quarterly.totalChange, null);
  assert.equal(first.quarterly.componentSumChange, null);
  assert.equal(first.quarterly.residualChange, null);
  assert.ok(Object.values(first.quarterly.components).every(point => point.value === null && /preceding|prior|coverage/i.test(point.reason)));
  for (const point of result.observations.slice(0, 4)) {
    assert.equal(point.trailing.totalChange, null);
    assert.equal(point.trailing.residualChange, null);
    assert.ok(Object.values(point.trailing.components).every(component => component.value === null && component.reason));
  }
  assert.ok(Number.isFinite(result.observations[4].trailing.totalChange));
});

test('selected windows retain the exact predecessor and all rolling lookback before endpoint filtering', () => {
  const sources = fixture();
  const selected = currentAccountGdpContributions(sources, {preset: 'custom', startDate: dates[4], endDate: dates[4]});
  assert.equal(selected.observations.length, 1);
  assert.equal(selected.allObservations.length, 6);
  assert.equal(selected.observations[0].quarterly.prior.date, dates[3]);
  assert.equal(selected.observations[0].trailing.prior.date, dates[3]);
  assert.deepEqual(selected.observations[0].trailing.prior.inputDates, dates.slice(0, 4));
  close(selected.observations[0].quarterly.totalChange, -6.5);
  assert.ok(Number.isFinite(selected.observations[0].trailing.totalChange));
  assert.ok([...selected.series.quarterly, ...selected.series.trailing].every(series => series.observations.length === 6));
  assert.deepEqual(currentAccountGdpContributions(sources, 1).observations.map(point => point.date), [dates.at(-1)]);
  assert.deepEqual(currentAccountGdpContributions(sources, {preset: 'custom', startDate: '2030-01-01', endDate: '2030-12-31'}).observations, []);
});

test('synthetic component histories identify calculated percentage-point changes and preserve exact reasons', () => {
  const result = currentAccountGdpContributions(fixture());
  for (const [horizon, suffix] of [['quarterly', 'Quarterly'], ['trailing', 'Trailing']]) {
    assert.equal(result.series[horizon].length, 4);
    for (const [index, {id, label}] of CURRENT_ACCOUNT_GDP_COMPONENTS.entries()) {
      const series = result.series[horizon][index];
      assert.equal(series.id, `${id}${suffix}Contribution`);
      assert.equal(series.unit, 'Percentage points');
      assert.equal(series.format, 'percentagePoints');
      assert.equal(series.observationType, 'calculated');
      assert.equal(series.frequency, 'Quarterly');
      assert.match(series.name, new RegExp(label, 'i'));
      assert.match(series.short, horizon === 'quarterly' ? /quarterly/i : /trailing|T4Q/i);
      for (const [rowIndex, point] of result.allObservations.entries()) {
        assert.deepEqual(series.observations[rowIndex], {date: point.date, priorDate: point.priorDate, ...point[horizon].components[id]});
      }
    }
  }
});

test('missing component observations preserve other contributions and authoritative total changes', () => {
  const sources = fixture();
  sources.beaIta.series.itaGoodsBalance.observations.splice(1, 1);
  const result = currentAccountGdpContributions(sources), point = result.observations[2].quarterly;
  assert.equal(result.error, null);
  assert.equal(point.components.itaGoodsBalance.value, null);
  assert.match(point.components.itaGoodsBalance.reason, /2025-04-01/);
  close(point.components.itaServicesBalance.value, -4);
  close(point.totalChange, 1);
  assert.equal(point.componentSumChange, null);
  assert.equal(point.residualChange, null);
  assert.ok(point.reason);
  assert.ok(Number.isFinite(result.observations[3].quarterly.componentSumChange));
  assert.equal(result.observations[4].trailing.components.itaGoodsBalance.value, null);
  assert.ok(Number.isFinite(result.observations[4].trailing.components.itaServicesBalance.value));
  assert.equal(result.observations[5].trailing.components.itaGoodsBalance.value, null);
});

test('missing published total does not hide valid components or invent a complete reconciliation', () => {
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.splice(1, 1);
  const result = currentAccountGdpContributions(sources), point = result.observations[1].quarterly;
  assert.deepEqual(result.observations.map(point => point.date), dates);
  assert.deepEqual(changes(point), [-5, 2, 0, 0]);
  close(point.componentSumChange, -3);
  assert.equal(point.totalChange, null);
  assert.equal(point.residualChange, null);
  assert.match(point.reason, /2025-04-01/);
  assert.ok(Number.isFinite(result.observations[4].trailing.componentSumChange));
  assert.equal(result.observations[4].trailing.residualChange, null);
});

test('an internal missing quarter is explicit and never replaced by an older valid endpoint', () => {
  const sources = fixture();
  for (const series of Object.values(sources.beaIta.series)) series.observations.splice(2, 1);
  sources.bea.series.nominalGdp.observations.splice(2, 1);
  const result = currentAccountGdpContributions(sources);
  assert.deepEqual(result.observations.map(point => point.date), dates);
  assert.equal(result.observations[3].quarterly.prior.date, dates[2]);
  assert.equal(result.observations[3].quarterly.totalChange, null);
  assert.match(result.observations[3].quarterly.reason, /2025-07-01/);
  assert.equal(result.observations[5].trailing.totalChange, null);
});

test('zero balances and zero changes stay numeric rather than becoming missing', () => {
  const sources = fixture();
  for (const observation of sources.beaIta.series.itaPrimaryIncomeBalance.observations) observation.value = 0;
  const result = currentAccountGdpContributions(sources);
  for (const point of result.observations.slice(1)) {
    assert.deepEqual(point.quarterly.components.itaPrimaryIncomeBalance, {value: 0, reason: null});
  }
  assert.deepEqual(result.observations[4].trailing.components.itaPrimaryIncomeBalance, {value: 0, reason: null});
});

test('incompatible component metadata fails locally while invalid common GDP invalidates every change', () => {
  for (const mutate of [series => {series.unit = 'USD billions (SAAR)';}, series => {series.sourceIds = ['wrong'];}, series => {series.observations.push(row(dates[0], 0));}]) {
    const sources = fixture();
    mutate(sources.beaIta.series.itaGoodsBalance);
    const point = currentAccountGdpContributions(sources).observations[4];
    assert.equal(point.quarterly.components.itaGoodsBalance.value, null);
    assert.match(point.quarterly.components.itaGoodsBalance.reason, /incompatible|duplicate/i);
    assert.ok(Number.isFinite(point.quarterly.components.itaServicesBalance.value));
    assert.ok(Number.isFinite(point.trailing.totalChange));
  }
  for (const mutate of [series => {series.adjustment = 'Not seasonally adjusted';}, series => {series.observations[3].value = 0;}, series => {series.observations[3].value = null;}]) {
    const sources = fixture();
    mutate(sources.bea.series.nominalGdp);
    const point = currentAccountGdpContributions(sources).observations[4];
    for (const horizon of [point.quarterly, point.trailing]) {
      assert.equal(horizon.totalChange, null);
      assert.equal(horizon.componentSumChange, null);
      assert.equal(horizon.residualChange, null);
      assert.ok(Object.values(horizon.components).every(point => point.value === null && point.reason));
    }
  }
});

test('cached inputs remain usable and retained revised observations affect only dependent changes', () => {
  const sources = fixture(), before = currentAccountGdpContributions(sources);
  sources.beaIta.status = 'cached';
  sources.bea.status = 'cached';
  assert.deepEqual(currentAccountGdpContributions(sources).allObservations, before.allObservations);
  sources.beaIta.series.itaServicesBalance.observations[1].value += 1;
  const revised = currentAccountGdpContributions(sources);
  close(revised.observations[1].quarterly.components.itaServicesBalance.value - before.observations[1].quarterly.components.itaServicesBalance.value, 0.5);
  close(revised.observations[2].quarterly.components.itaServicesBalance.value - before.observations[2].quarterly.components.itaServicesBalance.value, -0.5);
  assert.deepEqual(revised.observations[4].quarterly, before.observations[4].quarterly);
  assert.notEqual(revised.observations[4].trailing.components.itaServicesBalance.value, before.observations[4].trailing.components.itaServicesBalance.value);
});

test('overflowing contribution differences remain unavailable while other finite components survive', () => {
  const sources = fixture();
  for (const observation of sources.bea.series.nominalGdp.observations) observation.value = 4e-206;
  for (const series of Object.values(sources.beaIta.series)) for (const observation of series.observations) observation.value = 0;
  sources.beaIta.series.itaGoodsBalance.observations[0].value = -1e100;
  sources.beaIta.series.itaGoodsBalance.observations[1].value = 1e100;
  const point = currentAccountGdpContributions(sources).observations[1].quarterly;
  assert.ok(Number.isFinite(point.current.components.itaGoodsBalance.value));
  assert.ok(Number.isFinite(point.prior.components.itaGoodsBalance.value));
  assert.equal(point.components.itaGoodsBalance.value, null);
  assert.match(point.components.itaGoodsBalance.reason, /nonfinite/i);
  assert.deepEqual(point.components.itaServicesBalance, {value: 0, reason: null});
  assert.equal(point.totalChange, 0);
  assert.equal(point.componentSumChange, null);
  assert.equal(point.residualChange, null);
});

test('finite individual changes cannot emit infinite component sums or residual changes', () => {
  const sources = fixture();
  for (const observation of sources.bea.series.nominalGdp.observations) observation.value = 4e-206;
  for (const series of Object.values(sources.beaIta.series)) for (const observation of series.observations) observation.value = 0;
  for (const {id} of CURRENT_ACCOUNT_GDP_COMPONENTS) sources.beaIta.series[id].observations[1].value = 5e99;
  const sum = currentAccountGdpContributions(sources).observations[1].quarterly;
  assert.ok(Object.values(sum.components).every(point => Number.isFinite(point.value)));
  assert.equal(sum.totalChange, 0);
  assert.equal(sum.componentSumChange, null);
  assert.equal(sum.residualChange, null);
  assert.match(sum.reason, /nonfinite/i);

  for (const series of Object.values(sources.beaIta.series)) for (const observation of series.observations) observation.value = 0;
  sources.beaIta.series.currentAccountBalance.observations[0].value = -1e100;
  sources.beaIta.series.itaGoodsBalance.observations[0].value = 1e100;
  const residual = currentAccountGdpContributions(sources).observations[1].quarterly;
  assert.ok(Number.isFinite(residual.totalChange));
  assert.ok(Number.isFinite(residual.componentSumChange));
  assert.equal(residual.residualChange, null);
  assert.ok(residual.reason);
});

test('invalid windows and malformed or excessive source calendars retain explicit errors and bounded results', () => {
  const invalid = currentAccountGdpContributions(fixture(), {preset: '10y'});
  assert.ok(invalid.error);
  assert.deepEqual(invalid.observations, []);
  assert.equal(invalid.allObservations.length, 6);
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.push(row('2026-04-02', -1));
  const bad = currentAccountGdpContributions(sources);
  assert.match(bad.error, /quarter date/i);
  assert.deepEqual(bad.allObservations, []);
  sources.beaIta.series.currentAccountBalance.observations = [row('1000-01-01', -1), row('2250-01-01', -1)];
  const oversized = currentAccountGdpContributions(sources, 1);
  assert.match(oversized.error, /5000/);
  assert.deepEqual(oversized.allObservations, []);
  assert.ok([...oversized.series.quarterly, ...oversized.series.trailing].every(series => series.observations.length === 0));
  const empty = currentAccountGdpContributions();
  assert.ok(empty.error);
  assert.deepEqual(empty.observations, []);
});
