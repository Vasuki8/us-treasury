import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountRegistry, currentAccountDefinitions, itaLocator} from '../src/current-account-registry.js';
import {CURRENT_ACCOUNT_GDP_COMPONENTS} from '../src/current-account-gdp-breakdown.js';
import {currentAccountGdpContributions} from '../src/current-account-gdp-contributions.js';
import {currentAccountGdpBalanceEffects, CURRENT_ACCOUNT_GDP_EFFECT_METHOD, CURRENT_ACCOUNT_GDP_BALANCE_EFFECTS_CHART, CURRENT_ACCOUNT_GDP_EFFECT_MEASURES} from '../src/current-account-gdp-balance-effects.js';
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
const close = (actual, expected, tolerance = 1e-12) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);
const ids = ['currentAccountBalance', ...CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id}) => id), 'componentSum', 'residual'];

test('exports the symmetric split model and immutable seven-measure convention', () => {
  assert.equal(typeof currentAccountGdpBalanceEffects, 'function');
  assert.equal(CURRENT_ACCOUNT_GDP_EFFECT_METHOD, 'symmetric-two-order-v1');
  assert.equal(CURRENT_ACCOUNT_GDP_BALANCE_EFFECTS_CHART, 'current-account-gdp-balance-effects');
  assert.deepEqual(CURRENT_ACCOUNT_GDP_EFFECT_MEASURES.map(({id}) => id).sort(), [...ids].sort());
  assert.ok(Object.isFrozen(CURRENT_ACCOUNT_GDP_EFFECT_MEASURES));
  assert.ok(CURRENT_ACCOUNT_GDP_EFFECT_MEASURES.every(item => Object.isFrozen(item) && item.label));
});

test('quarterly total and component splits average the two orders using signed raw balances', () => {
  const sources = fixture(), before = structuredClone(sources);
  const base = currentAccountGdpContributions(sources), result = currentAccountGdpBalanceEffects(sources);
  const point = result.observations[1].quarterly, total = point.effects.currentAccountBalance;
  close(total.balanceEffect, -8.25);
  close(total.gdpEffect, 6.25);
  close(total.totalChange, -2);
  assert.deepEqual([total.currentBalance, total.priorBalance, total.balanceChange, total.currentGdp, total.priorGdp, total.reason], [-18, -7, -11, 200, 100, null]);
  close(point.effects.itaGoodsBalance.balanceEffect, -15);
  close(point.effects.itaGoodsBalance.gdpEffect, 10);
  close(point.effects.itaServicesBalance.balanceEffect, 6);
  close(point.effects.itaServicesBalance.gdpEffect, -4);
  for (let index = 0; index < result.observations.length; index++) {
    for (const horizon of ['quarterly', 'trailing']) {
      const {effects, ...original} = result.observations[index][horizon];
      assert.deepEqual(original, base.observations[index][horizon]);
      assert.deepEqual(Object.keys(effects).sort(), [...ids].sort());
    }
  }
  assert.equal(result.method, CURRENT_ACCOUNT_GDP_EFFECT_METHOD);
  assert.match(result.effectFormula, /50.*N1.*N0/);
  assert.match(result.effectNotice, /two.*order|symmetric/i);
  assert.match(result.effectNotice, /interaction.*equal/i);
  assert.match(result.effectNotice, /not.*official BEA|not.*BEA.*contribution/i);
  assert.match(result.effectNotice, /not.*caus|causal/i);
  assert.match(result.effectNotice, /already.*include|do not add/i);
  assert.deepEqual(sources, before);
});

test('component sum and raw residual effects reconcile independently to the authoritative total', () => {
  const result = currentAccountGdpBalanceEffects(fixture());
  for (const [index, point] of result.observations.entries()) {
    for (const horizon of ['quarterly', 'trailing']) {
      if (index < (horizon === 'quarterly' ? 1 : 4)) continue;
      const effects = point[horizon].effects;
      for (const field of ['balanceEffect', 'gdpEffect', 'totalChange']) {
        const componentSum = CURRENT_ACCOUNT_GDP_COMPONENTS.reduce((sum, {id}) => sum + effects[id][field], 0);
        close(componentSum, effects.componentSum[field]);
        close(effects.componentSum[field] + effects.residual[field], effects.currentAccountBalance[field]);
      }
      for (const id of ids) close(effects[id].balanceEffect + effects[id].gdpEffect, effects[id].totalChange);
    }
  }
  const residual = result.observations[1].quarterly.effects.residual;
  assert.deepEqual([residual.priorBalance, residual.currentBalance, residual.balanceChange], [0, 2, 2]);
  close(residual.balanceEffect, 1.5);
  close(residual.gdpEffect, -0.5);
});

test('trailing effects use separately summed adjacent four-quarter balance and matching GDP flows', () => {
  const result = currentAccountGdpBalanceEffects(fixture()), point = result.observations[4].trailing;
  const total = point.effects.currentAccountBalance;
  assert.deepEqual([total.priorBalance, total.currentBalance, total.priorGdp, total.currentGdp], [-51, -79, 1000, 1400]);
  close(total.balanceEffect, -2.4);
  close(total.gdpEffect, 13 / 7);
  close(total.balanceEffect + total.gdpEffect, point.totalChange);
  assert.deepEqual(point.prior.inputDates, dates.slice(0, 4));
  assert.deepEqual(point.current.inputDates, dates.slice(1, 5));
  assert.match(result.effectNotice, /overlap.*three quarters/i);
});

test('constant GDP allocates all change to balances while constant balances isolate GDP and preserve zero', () => {
  const sources = fixture();
  for (const point of sources.bea.series.nominalGdp.observations) point.value = 400;
  const constantGdp = currentAccountGdpBalanceEffects(sources).observations[1].quarterly.effects.currentAccountBalance;
  close(constantGdp.balanceEffect, -11);
  close(constantGdp.gdpEffect, 0);
  for (const series of Object.values(sources.beaIta.series)) for (const point of series.observations) point.value = -10;
  sources.bea.series.nominalGdp.observations[1].value = 800;
  const constantBalance = currentAccountGdpBalanceEffects(sources).observations[1].quarterly.effects.currentAccountBalance;
  close(constantBalance.balanceEffect, 0);
  close(constantBalance.gdpEffect, 5);
  for (const series of Object.values(sources.beaIta.series)) for (const point of series.observations) point.value = 0;
  const zero = currentAccountGdpBalanceEffects(sources).observations[1].quarterly.effects.currentAccountBalance;
  assert.equal(zero.balanceEffect, 0);
  assert.equal(zero.gdpEffect, 0);
  assert.equal(zero.totalChange, 0);
  assert.equal(zero.reason, null);
});

test('reversing endpoint balances and GDP negates each symmetric effect and handles sign changes', () => {
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations[1].value = 9;
  const before = currentAccountGdpBalanceEffects(sources).observations[1].quarterly.effects.currentAccountBalance;
  const numerator = sources.beaIta.series.currentAccountBalance.observations;
  [numerator[0].value, numerator[1].value] = [numerator[1].value, numerator[0].value];
  const denominator = sources.bea.series.nominalGdp.observations;
  [denominator[0].value, denominator[1].value] = [denominator[1].value, denominator[0].value];
  const reversed = currentAccountGdpBalanceEffects(sources).observations[1].quarterly.effects.currentAccountBalance;
  for (const field of ['balanceEffect', 'gdpEffect', 'totalChange']) close(reversed[field], -before[field]);
  close(before.balanceEffect, 12);
  close(before.gdpEffect, -0.5);
});

test('exact predecessor and five-quarter trailing lookback survive endpoint windows without older fallback', () => {
  const selected = currentAccountGdpBalanceEffects(fixture(), {preset: 'custom', startDate: dates[4], endDate: dates[4]});
  assert.equal(selected.observations.length, 1);
  assert.equal(selected.allObservations.length, 6);
  assert.equal(selected.observations[0].priorDate, dates[3]);
  close(selected.observations[0].trailing.effects.currentAccountBalance.balanceEffect, -2.4);
  const first = selected.allObservations[0];
  for (const id of ids) assert.equal(first.quarterly.effects[id].balanceEffect, null);
  for (const point of selected.allObservations.slice(0, 4)) {
    for (const id of ids) {
      assert.equal(point.trailing.effects[id].balanceEffect, null);
      assert.ok(point.trailing.effects[id].reason);
    }
  }
  assert.deepEqual(currentAccountGdpBalanceEffects(fixture(), 1).observations.map(point => point.date), [dates.at(-1)]);
  assert.deepEqual(currentAccountGdpBalanceEffects(fixture(), {preset: 'custom', startDate: '2030-01-01', endDate: '2030-12-31'}).observations, []);
});

test('missing components leave independent total and other component effects usable', () => {
  const sources = fixture();
  sources.beaIta.series.itaGoodsBalance.observations.splice(1, 1);
  const point = currentAccountGdpBalanceEffects(sources).observations[2].quarterly.effects;
  assert.equal(point.itaGoodsBalance.balanceEffect, null);
  assert.match(point.itaGoodsBalance.reason, /2025-04-01/);
  assert.ok(Number.isFinite(point.currentAccountBalance.balanceEffect));
  assert.ok(Number.isFinite(point.itaServicesBalance.gdpEffect));
  assert.equal(point.componentSum.balanceEffect, null);
  assert.equal(point.residual.balanceEffect, null);
  assert.ok(point.residual.reason);
});

test('a missing published total preserves four component effects and their sum without a residual', () => {
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.splice(1, 1);
  const effects = currentAccountGdpBalanceEffects(sources).observations[1].quarterly.effects;
  assert.equal(effects.currentAccountBalance.balanceEffect, null);
  assert.ok(effects.currentAccountBalance.reason);
  close(effects.componentSum.totalChange, -3);
  close(effects.componentSum.balanceEffect, -9.75);
  close(effects.componentSum.gdpEffect, 6.75);
  assert.equal(effects.residual.balanceEffect, null);
  assert.ok(effects.residual.reason);
});

test('source identity, units, duplicate dates and invalid common GDP stay unavailable', () => {
  for (const mutate of [series => {series.unit = 'USD billions (SAAR)';}, series => {series.sourceIds = ['wrong'];}, series => {series.observations.push(row(dates[0], 0));}]) {
    const sources = fixture();
    mutate(sources.beaIta.series.itaGoodsBalance);
    const effects = currentAccountGdpBalanceEffects(sources).observations[4].quarterly.effects;
    assert.equal(effects.itaGoodsBalance.balanceEffect, null);
    assert.match(effects.itaGoodsBalance.reason, /incompatible|duplicate/i);
    assert.ok(Number.isFinite(effects.currentAccountBalance.balanceEffect));
  }
  for (const invalid of [0, -100, null, Infinity, Number.MIN_VALUE]) {
    const sources = fixture();
    sources.bea.series.nominalGdp.observations[3].value = invalid;
    const point = currentAccountGdpBalanceEffects(sources).observations[4];
    for (const horizon of ['quarterly', 'trailing']) for (const id of ids) {
      assert.equal(point[horizon].effects[id].balanceEffect, null);
      assert.equal(point[horizon].effects[id].gdpEffect, null);
      assert.ok(point[horizon].effects[id].reason);
    }
  }
});

test('a calendar hole retains missing endpoints instead of matching an older valid observation', () => {
  const sources = fixture();
  for (const series of Object.values(sources.beaIta.series)) series.observations.splice(2, 1);
  const result = currentAccountGdpBalanceEffects(sources), effects = result.observations[3].quarterly.effects;
  assert.equal(result.observations[3].priorDate, dates[2]);
  assert.equal(effects.currentAccountBalance.balanceEffect, null);
  assert.match(effects.currentAccountBalance.reason, /2025-07-01/);
});

test('nonfinite cross ratios or formula intermediates cannot manufacture a split of a valid combined change', () => {
  const sources = fixture();
  for (const series of Object.values(sources.beaIta.series)) for (const point of series.observations) point.value = 0;
  const total = sources.beaIta.series.currentAccountBalance.observations, gdp = sources.bea.series.nominalGdp.observations;
  total[0].value = 1e-200; total[1].value = 1e200;
  gdp[0].value = 4e-200; gdp[1].value = 4e200;
  const cross = currentAccountGdpBalanceEffects(sources).observations[1].quarterly.effects.currentAccountBalance;
  close(cross.totalChange, 0);
  assert.equal(cross.balanceEffect, null);
  assert.equal(cross.gdpEffect, null);
  assert.match(cross.reason, /nonfinite/i);
  assert.deepEqual([cross.currentBalance, cross.priorBalance, cross.balanceChange, cross.currentGdp, cross.priorGdp], [1e200, 1e-200, 1e200, 1e200, 1e-200]);

  total[0].value = 0; total[1].value = 0;
  gdp[0].value = 4e-308; gdp[1].value = 4e-308;
  const intermediate = currentAccountGdpBalanceEffects(sources).observations[1].quarterly.effects.currentAccountBalance;
  assert.equal(intermediate.totalChange, 0);
  assert.equal(intermediate.balanceEffect, null);
  assert.equal(intermediate.gdpEffect, null);
  assert.match(intermediate.reason, /nonfinite/i);
});

test('cached inputs, revised values and exported calculated pp histories preserve the original combined changes', () => {
  const sources = fixture(), before = currentAccountGdpBalanceEffects(sources);
  sources.beaIta.status = 'cached'; sources.bea.status = 'cached';
  assert.deepEqual(currentAccountGdpBalanceEffects(sources).allObservations, before.allObservations);
  sources.beaIta.series.itaServicesBalance.observations[1].value += 1;
  const revised = currentAccountGdpBalanceEffects(sources);
  assert.notEqual(revised.observations[1].quarterly.effects.itaServicesBalance.balanceEffect, before.observations[1].quarterly.effects.itaServicesBalance.balanceEffect);
  assert.deepEqual(revised.observations[4].quarterly.effects, before.observations[4].quarterly.effects);
  for (const [horizon, suffix] of [['quarterly', 'Quarterly'], ['trailing', 'Trailing']]) {
    assert.equal(revised.series[horizon].length, 3);
    for (const [index, [part, field]] of [['BalanceEffect', 'balanceEffect'], ['GdpEffect', 'gdpEffect'], ['RatioChange', 'totalChange']].entries()) {
      const series = revised.series[horizon][index];
      assert.equal(series.id, `currentAccount${suffix}${part}`);
      assert.equal(series.unit, 'Percentage points');
      assert.equal(series.format, 'percentagePoints');
      assert.equal(series.observationType, 'calculated');
      assert.equal(series.frequency, 'Quarterly');
      assert.equal(series.observations.length, 6);
      for (const [rowIndex, point] of revised.allObservations.entries()) {
        assert.equal(series.observations[rowIndex].date, point.date);
        assert.equal(series.observations[rowIndex].priorDate, point.priorDate);
        assert.equal(series.observations[rowIndex].value, point[horizon].effects.currentAccountBalance[field]);
      }
    }
  }
});

test('invalid windows, empty sources and malformed or excessive calendars preserve guarded bounded errors', () => {
  const badWindow = currentAccountGdpBalanceEffects(fixture(), {preset: '10y'});
  assert.ok(badWindow.error);
  assert.deepEqual(badWindow.observations, []);
  assert.equal(badWindow.allObservations.length, 6);
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.push(row('2026-04-02', -1));
  assert.match(currentAccountGdpBalanceEffects(sources).error, /quarter date/i);
  assert.deepEqual(currentAccountGdpBalanceEffects(sources).allObservations, []);
  sources.beaIta.series.currentAccountBalance.observations = [row('1000-01-01', -1), row('2250-01-01', -1)];
  const excessive = currentAccountGdpBalanceEffects(sources);
  assert.match(excessive.error, /5000/);
  assert.deepEqual(excessive.allObservations, []);
  const empty = currentAccountGdpBalanceEffects();
  assert.ok(empty.error);
  assert.deepEqual(empty.observations, []);
  assert.ok([...empty.series.quarterly, ...empty.series.trailing].every(series => series.observations.length === 0));
});
