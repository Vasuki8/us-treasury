import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountRegistry, currentAccountDefinitions, itaLocator} from '../src/current-account-registry.js';
import {CURRENT_ACCOUNT_GDP_COMPONENTS} from '../src/current-account-gdp-breakdown.js';
import {currentAccountGdpBalanceEffects} from '../src/current-account-gdp-balance-effects.js';
import {
  CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS, CURRENT_ACCOUNT_GDP_COMPONENT_EFFECTS_CHART,
  resolveCurrentAccountComponentEffectMeasure, currentAccountGdpComponentEffectSeries,
  currentAccountGdpComponentEffects,
} from '../src/current-account-gdp-component-effects.js';

const dates = ['2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01', '2026-01-01', '2026-04-01'];
const row = (date, value) => ({date, value, sourceValue: value === null ? '...' : String(value), publishedAt: null});
const parts = [['BalanceEffect', 'balanceEffect'], ['GdpEffect', 'gdpEffect'], ['RatioChange', 'totalChange']];
const horizons = [['quarterly', 'Quarterly'], ['trailing', 'Trailing']];
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
    bea: {status: 'ok', series: {nominalGdp: {
      sourceIds: ['A191RC'], unit: 'Billions of current dollars (SAAR)', frequency: 'Quarterly',
      adjustment: 'Seasonally adjusted annual rate', dateConvention: 'quarter-start', periodType: 'flow',
      observations: dates.map((date, index) => row(date, [400, 800, 1200, 1600, 2000, 2400][index])),
    }}},
  };
}

test('admits only the four immutable official ITA components and explicitly defaults to Goods', () => {
  assert.equal(CURRENT_ACCOUNT_GDP_COMPONENT_EFFECTS_CHART, 'current-account-gdp-component-effects');
  assert.deepEqual(CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS, CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id, label}) => ({id, label})));
  assert.ok(Object.isFrozen(CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS));
  assert.ok(CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS.every(Object.isFrozen));
  for (const {id} of CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS) assert.equal(resolveCurrentAccountComponentEffectMeasure(id), id);
  for (const id of [undefined, null, '', 'currentAccountBalance', 'componentSum', 'residual', 'netExports', '__proto__']) {
    assert.equal(resolveCurrentAccountComponentEffectMeasure(id), 'itaGoodsBalance');
  }
});

test('projects all four components, both horizons and three fields exactly from guarded effect rows', () => {
  const base = currentAccountGdpBalanceEffects(fixture());
  for (const {id, label} of CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS) {
    const series = currentAccountGdpComponentEffectSeries(base, id);
    assert.deepEqual(Object.keys(series), ['quarterly', 'trailing']);
    for (const [horizon, suffix] of horizons) {
      assert.equal(series[horizon].length, 3);
      for (const [index, [part, field]] of parts.entries()) {
        const selected = series[horizon][index];
        assert.equal(selected.id, `${id}${suffix}${part}`);
        assert.match(selected.name, new RegExp(label, 'i'));
        assert.match(selected.name, new RegExp(horizon === 'quarterly' ? 'quarterly' : 'trailing-four-quarter', 'i'));
        assert.equal(selected.unit, 'Percentage points');
        assert.equal(selected.format, 'percentagePoints');
        assert.equal(selected.precision, 3);
        assert.equal(selected.frequency, 'Quarterly');
        assert.equal(selected.dateConvention, 'quarter-start');
        assert.equal(selected.observationType, 'calculated');
        assert.equal(selected.observations.length, base.allObservations.length);
        for (const [rowIndex, point] of base.allObservations.entries()) {
          const effect = point[horizon].effects[id];
          assert.deepEqual(selected.observations[rowIndex], {
            date: point.date, priorDate: point.priorDate, value: effect[field],
            reason: Number.isFinite(effect[field]) ? null : effect.reason,
          });
        }
      }
    }
  }
});

test('wrapper preserves the complete authoritative model and records the selected component', () => {
  const sources = fixture(), base = currentAccountGdpBalanceEffects(sources), before = structuredClone(sources);
  const result = currentAccountGdpComponentEffects(sources, {preset: 'all'}, 'itaServicesBalance');
  const {measure, series, ...retained} = result;
  const {series: totalSeries, ...original} = base;
  assert.deepEqual(measure, {id: 'itaServicesBalance', label: 'Services'});
  assert.deepEqual(retained, original);
  assert.deepEqual(series, currentAccountGdpComponentEffectSeries(base, measure.id));
  assert.deepEqual(sources, before);
  assert.deepEqual(currentAccountGdpBalanceEffects(sources), base);
  assert.equal(totalSeries.quarterly[0].id, 'currentAccountQuarterlyBalanceEffect');
  assert.equal(currentAccountGdpComponentEffects(sources).measure.id, 'itaGoodsBalance');
  assert.equal(currentAccountGdpComponentEffects(sources, undefined, 'nominalGdp').measure.id, 'itaGoodsBalance');
});

test('projection retains method metadata and raw source references without mutating its precomputed result', () => {
  const sources = fixture(), base = currentAccountGdpBalanceEffects(sources), before = structuredClone(base);
  base.series.quarterly[0].sourceRefs = ['retained BEA ITA', 'retained BEA NIPA'];
  base.series.trailing[0].method = base.method;
  const marked = structuredClone(base);
  const series = currentAccountGdpComponentEffectSeries(base, 'itaPrimaryIncomeBalance');
  assert.strictEqual(series.quarterly[0].sourceRefs, base.series.quarterly[0].sourceRefs);
  assert.equal(series.trailing[1].method, base.method);
  assert.deepEqual(base, marked);
  const raw = base.allObservations[1].quarterly.current.components.itaPrimaryIncomeBalance.numeratorObservation;
  assert.strictEqual(raw, sources.beaIta.series.itaPrimaryIncomeBalance.observations[1]);
  assert.deepEqual(before.allObservations, base.allObservations);
});

test('count, calendar and custom endpoint windows retain full exact-predecessor and trailing lookback histories', () => {
  const sources = fixture();
  for (const range of [1, {preset: '1y'}, {preset: 'custom', startDate: dates[4], endDate: dates[4]}]) {
    const base = currentAccountGdpBalanceEffects(sources, range);
    const selected = currentAccountGdpComponentEffects(sources, range, 'itaSecondaryIncomeBalance');
    assert.deepEqual(selected.window, base.window);
    assert.deepEqual(selected.observations, base.observations);
    assert.equal(selected.allObservations.length, dates.length);
    assert.ok([...selected.series.quarterly, ...selected.series.trailing].every(item => item.observations.length === dates.length));
    for (const point of selected.observations) assert.equal(point.priorDate, base.allObservations.find(item => item.date === point.date).priorDate);
  }
  const selected = currentAccountGdpComponentEffects(sources, {preset: 'custom', startDate: dates[4], endDate: dates[4]}, 'itaSecondaryIncomeBalance');
  assert.equal(selected.observations.length, 1);
  assert.deepEqual(selected.observations[0].trailing.prior.inputDates, dates.slice(0, 4));
  assert.deepEqual(selected.observations[0].trailing.current.inputDates, dates.slice(1, 5));
  assert.ok(Number.isFinite(selected.observations[0].trailing.effects.itaSecondaryIncomeBalance.balanceEffect));
});

test('missing component and exact calendar holes remain unavailable independently of other components', () => {
  const sources = fixture();
  sources.beaIta.series.itaGoodsBalance.observations.splice(1, 1);
  const goods = currentAccountGdpComponentEffects(sources), services = currentAccountGdpComponentEffects(sources, {preset: 'all'}, 'itaServicesBalance');
  for (const series of goods.series.quarterly) {
    assert.equal(series.observations[2].value, null);
    assert.match(series.observations[2].reason, /2025-04-01/);
    assert.equal(series.observations[2].priorDate, dates[1]);
  }
  assert.ok(services.series.quarterly.every(series => Number.isFinite(series.observations[2].value)));
  assert.ok(Number.isFinite(goods.allObservations[2].quarterly.effects.currentAccountBalance.balanceEffect));
  for (const series of Object.values(sources.beaIta.series)) series.observations = series.observations.filter(point => point.date !== dates[2]);
  const hole = currentAccountGdpComponentEffects(sources, {preset: 'all'}, 'itaServicesBalance');
  assert.deepEqual(hole.allObservations.map(point => point.date), dates);
  assert.equal(hole.series.quarterly[0].observations[3].value, null);
  assert.match(hole.series.quarterly[0].observations[3].reason, /2025-07-01/);
});

test('finite combined component change survives nonfinite split arithmetic with separate unavailable reasons', () => {
  const sources = fixture();
  for (const series of Object.values(sources.beaIta.series)) for (const point of series.observations) point.value = 0;
  const component = sources.beaIta.series.itaServicesBalance.observations;
  const gdp = sources.bea.series.nominalGdp.observations;
  component[0].value = 1e-200; component[1].value = 1e200;
  gdp[0].value = 4e-200; gdp[1].value = 4e200;
  const selected = currentAccountGdpComponentEffects(sources, {preset: 'all'}, 'itaServicesBalance');
  assert.equal(selected.series.quarterly[0].observations[1].value, null);
  assert.equal(selected.series.quarterly[1].observations[1].value, null);
  assert.match(selected.series.quarterly[0].observations[1].reason, /nonfinite/i);
  assert.match(selected.series.quarterly[1].observations[1].reason, /nonfinite/i);
  assert.equal(selected.series.quarterly[2].observations[1].value, 0);
  assert.equal(selected.series.quarterly[2].observations[1].reason, null);
});

test('invalid component source identity, units and duplicates preserve guarded reasons rather than calculating', () => {
  for (const mutate of [
    series => {series.sourceIds = ['wrong'];},
    series => {series.unit = 'Billions of current dollars (SAAR)';},
    series => {series.observations.push(row(dates[0], 99));},
  ]) {
    const sources = fixture();
    mutate(sources.beaIta.series.itaPrimaryIncomeBalance);
    const result = currentAccountGdpComponentEffects(sources, {preset: 'all'}, 'itaPrimaryIncomeBalance');
    assert.equal(result.series.quarterly[0].observations.at(-1).value, null);
    assert.match(result.series.quarterly[0].observations.at(-1).reason, /incompatible|duplicate/i);
    assert.ok(Number.isFinite(result.allObservations.at(-1).quarterly.effects.currentAccountBalance.balanceEffect));
  }
});

test('invalid GDP metadata and absent latest observations do not fall back to an older endpoint', () => {
  const sources = fixture();
  sources.bea.series.nominalGdp.unit = 'Percent';
  const invalid = currentAccountGdpComponentEffects(sources, {preset: 'all'}, 'itaSecondaryIncomeBalance');
  assert.match(invalid.error, /incompatible/i);
  assert.ok(invalid.series.quarterly.every(series => series.observations.every(point => point.value === null)));
  sources.bea.series.nominalGdp.unit = 'Billions of current dollars (SAAR)';
  sources.beaIta.series.itaSecondaryIncomeBalance.observations.at(-1).value = null;
  const latest = currentAccountGdpComponentEffects(sources, 1, 'itaSecondaryIncomeBalance');
  assert.equal(latest.observations[0].date, dates.at(-1));
  assert.equal(latest.observations[0].quarterly.effects.itaSecondaryIncomeBalance.balanceEffect, null);
  assert.match(latest.series.quarterly[0].observations.at(-1).reason, /2026-04-01/);
});

test('cached status and revised component values are projected without changing the default total model', () => {
  const sources = fixture(), original = currentAccountGdpBalanceEffects(sources);
  sources.beaIta.status = 'cached'; sources.bea.status = 'cached';
  assert.deepEqual(currentAccountGdpComponentEffects(sources).allObservations, original.allObservations);
  sources.beaIta.series.itaSecondaryIncomeBalance.observations[1].value += 1;
  const changed = currentAccountGdpComponentEffects(sources, {preset: 'all'}, 'itaSecondaryIncomeBalance');
  assert.notEqual(changed.series.quarterly[0].observations[1].value, original.allObservations[1].quarterly.effects.itaSecondaryIncomeBalance.balanceEffect);
  assert.deepEqual(currentAccountGdpBalanceEffects(sources).series, original.series);
});

test('empty sources, malformed calendars and invalid or empty windows retain bounded base errors', () => {
  const empty = currentAccountGdpComponentEffects();
  assert.ok(empty.error);
  assert.deepEqual(empty.observations, []);
  assert.deepEqual(empty.allObservations, []);
  assert.ok([...empty.series.quarterly, ...empty.series.trailing].every(series => series.observations.length === 0));
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.push(row('2026-04-02', -1));
  const malformed = currentAccountGdpComponentEffects(sources);
  assert.match(malformed.error, /quarter date/i);
  assert.deepEqual(malformed.allObservations, []);
  const invalidWindow = currentAccountGdpComponentEffects(fixture(), {preset: '10y'});
  assert.ok(invalidWindow.error);
  assert.deepEqual(invalidWindow.observations, []);
  assert.equal(invalidWindow.allObservations.length, dates.length);
  assert.deepEqual(currentAccountGdpComponentEffects(fixture(), {preset: 'custom', startDate: '2030-01-01', endDate: '2030-12-31'}).observations, []);
});
