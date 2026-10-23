import test from 'node:test';
import assert from 'node:assert/strict';
import { currentAccountRegistry, currentAccountDefinitions, itaLocator } from '../src/current-account-registry.js';
import { currentAccountGdpHistory } from '../src/current-account-gdp.js';
import { CURRENT_ACCOUNT_GDP_COMPONENTS, currentAccountGdpBreakdown } from '../src/current-account-gdp-breakdown.js';

const dates = ['2025-10-01', '2026-01-01', '2026-04-01'];
const row = (date, value) => ({date, value, sourceValue: value === null ? '...' : String(value), publishedAt: null});
function fixture() {
  const balances = {
    currentAccountBalance: [-100, -200, -246.023],
    itaGoodsBalance: [-180, -300, -291.302], itaServicesBalance: [70, 80, 91.485],
    itaPrimaryIncomeBalance: [20, 30, -11.405], itaSecondaryIncomeBalance: [-10, -10, -34.802],
  };
  return {
    beaIta: {status: 'ok', series: Object.fromEntries(Object.entries(balances).map(([id, values]) => {
      const line = currentAccountDefinitions.find(([key]) => key === id)[1];
      return [id, {...currentAccountRegistry[id], sourceIds: [itaLocator(line)], observations: dates.map((date, index) => row(date, values[index]))}];
    }))},
    bea: {status: 'ok', series: {nominalGdp: {sourceIds: ['A191RC'], unit: 'Billions of current dollars (SAAR)', frequency: 'Quarterly', adjustment: 'Seasonally adjusted annual rate', dateConvention: 'quarter-start', periodType: 'flow', observations: dates.map((date, index) => row(date, [16000, 20000, 24000][index]))}}},
  };
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} ≈ ${expected}`);

test('four official components use the same exact quarterly nominal GDP and retain independent source observations', () => {
  const sources = fixture(), before = structuredClone(sources), result = currentAccountGdpBreakdown(sources);
  assert.deepEqual(CURRENT_ACCOUNT_GDP_COMPONENTS, [
    {id: 'itaGoodsBalance', label: 'Goods', ratioId: 'itaGoodsBalanceToGdp'},
    {id: 'itaServicesBalance', label: 'Services', ratioId: 'itaServicesBalanceToGdp'},
    {id: 'itaPrimaryIncomeBalance', label: 'Primary income', ratioId: 'itaPrimaryIncomeBalanceToGdp'},
    {id: 'itaSecondaryIncomeBalance', label: 'Secondary income', ratioId: 'itaSecondaryIncomeBalanceToGdp'},
  ]);
  assert.equal(result.error, null);
  assert.equal(result.series.length, 4);
  assert.equal(result.observations.length, 3);
  for (const [index, definition] of CURRENT_ACCOUNT_GDP_COMPONENTS.entries()) {
    const series = result.series[index];
    assert.equal(series.id, definition.ratioId);
    assert.equal(series.format, 'percent');
    assert.equal(series.unit, 'Percent of nominal GDP');
    assert.equal(series.observationType, 'calculated');
    assert.equal(series.frequency, 'Quarterly');
    for (const [quarter, point] of series.observations.entries()) {
      assert.equal(point, result.observations[quarter].components[definition.id]);
      assert.equal(point.numeratorObservation, sources.beaIta.series[definition.id].observations[quarter]);
      assert.equal(point.denominatorObservation, sources.bea.series.nominalGdp.observations[quarter]);
      assert.equal(point.nominalGdpQuarter, [4000, 5000, 6000][quarter]);
      assert.equal(point.value, 100 * point.currentAccountBalance / point.nominalGdpQuarter);
    }
  }
  assert.deepEqual(result.observations.map(item => item.total), currentAccountGdpHistory(sources).observations);
  assert.match(result.formula, /component balance.*SAAR.*\/ 4/);
  assert.match(result.notice, /rounding/i);
  assert.match(result.notice, /revised.*independently/i);
  assert.deepEqual(sources, before);
});

test('published total stays authoritative and component rounding is exposed as a residual', () => {
  const point = currentAccountGdpBreakdown(fixture()).observations.at(-1);
  close(point.componentSumBalance, -246.024);
  close(point.residualBalance, 0.001);
  close(point.componentSum, -4.1004);
  close(point.residual, 100 * .001 / 6000);
  assert.equal(point.total.currentAccountBalance, -246.023);
  close(point.total.value, point.componentSum + point.residual);
});

test('exact shared windows and total calendar prevent components or GDP extending displayed coverage', () => {
  const sources = fixture();
  sources.beaIta.series.itaGoodsBalance.observations.unshift(row('2020-01-01', -100));
  sources.bea.series.nominalGdp.observations.push(row('2026-07-01', 30000));
  const result = currentAccountGdpBreakdown(sources, {preset: 'custom', startDate: '2025-12-15', endDate: '2026-03-20'});
  assert.equal(result.window.fullStartDate, dates[0]);
  assert.equal(result.window.fullEndDate, dates.at(-1));
  assert.deepEqual(result.observations.map(point => point.date), ['2026-01-01']);
  assert.ok(result.series.every(series => series.observations.length === 3));
  assert.deepEqual(currentAccountGdpBreakdown(sources, 1).observations.map(point => point.date), ['2026-04-01']);
});

test('missing components and retained nulls preserve available components without zero filling or reconciling incomplete sums', () => {
  const sources = fixture();
  sources.beaIta.series.itaGoodsBalance.observations.splice(1, 1);
  sources.beaIta.series.itaPrimaryIncomeBalance.observations.at(-1).value = null;
  delete sources.beaIta.series.itaSecondaryIncomeBalance;
  const result = currentAccountGdpBreakdown(sources);
  assert.equal(result.error, null, 'Partial component availability is not a fatal calendar error');
  for (const point of result.observations) {
    assert.notEqual(point.components.itaServicesBalance.value, null);
    assert.equal(point.components.itaSecondaryIncomeBalance.value, null);
    assert.equal(point.componentSum, null);
    assert.equal(point.residual, null);
    assert.equal(point.componentSumBalance, null);
    assert.equal(point.residualBalance, null);
  }
  assert.equal(result.observations[1].components.itaGoodsBalance.numeratorObservation, null);
  assert.match(result.observations[1].components.itaGoodsBalance.reason, /missing/);
  assert.equal(result.observations.at(-1).components.itaPrimaryIncomeBalance.numeratorObservation.value, null);
});

test('an internal missing published total retains the calendar and components but cannot invent a total or residual', () => {
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.splice(1, 1);
  const point = currentAccountGdpBreakdown(sources).observations[1];
  assert.equal(point.date, '2026-01-01');
  assert.equal(point.total.value, null);
  assert.equal(point.total.numeratorObservation, null);
  assert.ok(Object.values(point.components).every(component => Number.isFinite(component.value)));
  assert.equal(point.componentSum, null);
  assert.equal(point.componentSumBalance, null);
  assert.equal(point.residual, null);
  assert.equal(point.residualBalance, null);
});

test('component identity, units and duplicate or malformed calendars fail only that component', () => {
  const mutations = [
    series => {series.sourceIds = ['ITA:T1.1:line33:World:SA:Q'];},
    series => {series.sourceIds.push('ITA:T1.1:line32:World:SA:Q');},
    series => {series.unit = 'USD billions (SAAR)';},
    series => {series.adjustment = 'Not seasonally adjusted';},
    series => {series.observations.push(row('2026-04-01', 0));},
    series => {series.observations.push(row('2026-04-02', 0));},
    series => {series.observations = {};},
  ];
  for (const mutate of mutations) {
    const sources = fixture();
    mutate(sources.beaIta.series.itaGoodsBalance);
    const result = currentAccountGdpBreakdown(sources);
    assert.equal(result.error, null);
    assert.ok(result.observations.every(point => point.components.itaGoodsBalance.value === null));
    assert.ok(result.observations.every(point => point.components.itaGoodsBalance.reason));
    assert.ok(result.observations.every(point => Number.isFinite(point.components.itaServicesBalance.value)));
  }
});

test('invalid common GDP, missing quarters and nonnumeric values remain unavailable with exact reasons', () => {
  for (const value of [0, -1, null, NaN, Infinity, '24000']) {
    const sources = fixture();
    sources.bea.series.nominalGdp.observations.at(-1).value = value;
    const result = currentAccountGdpBreakdown(sources), point = result.observations.at(-1);
    assert.ok(Object.values(point.components).every(component => component.value === null && component.reason));
    assert.equal(point.componentSum, null);
    assert.equal(point.residual, null);
  }
  const sources = fixture();
  sources.bea.series.nominalGdp.observations.splice(1, 1);
  const point = currentAccountGdpBreakdown(sources).observations[1];
  assert.ok(Object.values(point.components).every(component => component.denominatorObservation === null));
  sources.bea.series.nominalGdp.sourceIds = ['A191RL'];
  assert.match(currentAccountGdpBreakdown(sources).error, /identity/);
});

test('shared total errors, invalid windows and sparse oversized spans are bounded before breakdown allocation', () => {
  const sources = fixture();
  assert.ok(currentAccountGdpBreakdown(sources, {preset: '10y'}).error);
  assert.ok(currentAccountGdpBreakdown(sources, {preset: 'custom', startDate: '2026-04-01', endDate: '2026-01-01'}).error);
  sources.beaIta.series.currentAccountBalance.observations.push(row('2026-04-01', -1));
  assert.match(currentAccountGdpBreakdown(sources).error, /Duplicate/);
  assert.equal(currentAccountGdpBreakdown(sources).observations.length, 0);
  sources.beaIta.series.currentAccountBalance.observations = [row('1000-01-01', -200), row('2250-01-01', -300)];
  const oversized = currentAccountGdpBreakdown(sources, 1);
  assert.match(oversized.error, /5000/);
  assert.equal(oversized.observations.length, 0);
  assert.ok(oversized.series.every(series => series.observations.length === 0));
  const empty = currentAccountGdpBreakdown();
  assert.ok(empty.error);
  assert.deepEqual(empty.observations, []);
});

test('cached inputs and legitimate revised values recalculate without rewriting previous results', () => {
  const sources = fixture(), original = currentAccountGdpBreakdown(sources);
  sources.beaIta.status = 'cached'; sources.bea.status = 'cached';
  assert.deepEqual(currentAccountGdpBreakdown(sources).observations, original.observations);
  sources.beaIta.series.itaGoodsBalance.observations.at(-1).value = -300;
  const revised = currentAccountGdpBreakdown(sources);
  assert.equal(revised.observations.at(-1).components.itaGoodsBalance.value, -5);
  assert.notEqual(original.observations.at(-1).components.itaGoodsBalance.value, -5);
});
