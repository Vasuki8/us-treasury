import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshot } from '../src/official-snapshot.js';
import * as module from '../src/current-account-gdp.js';

const row = (date, value) => ({ date, value, sourceValue: value === null ? '...' : String(value), publishedAt: null });
function fixture() {
  return {
    beaIta: { status: 'ok', fetchedAt: '2026-10-23T01:00:00.000Z', series: { currentAccountBalance: {
      sourceIds: ['ITA:T1.1:line30:World:SA:Q'], unit: 'USD billions per quarter (not annualized)',
      frequency: 'Quarterly', adjustment: 'Seasonally adjusted', dateConvention: 'quarter-start', periodType: 'flow',
      observations: [row('2025-10-01', -100), row('2026-01-01', -200), row('2026-04-01', -300)],
    } } },
    bea: { status: 'ok', fetchedAt: '2026-10-22T02:00:00.000Z', series: { nominalGdp: {
      sourceIds: ['A191RC'], unit: 'Billions of current dollars (SAAR)', frequency: 'Quarterly',
      adjustment: 'Seasonally adjusted annual rate', dateConvention: 'quarter-start', periodType: 'flow',
      observations: [row('2025-10-01', 16000), row('2026-01-01', 20000), row('2026-04-01', 24000)],
    } } },
  };
}
function history(sources, range) {
  assert.equal(typeof module.currentAccountGdpHistory, 'function', 'Historical ratio helper must be exported');
  return module.currentAccountGdpHistory(sources, range);
}

test('historical ratio uses quarterly current account / (nominal GDP SAAR / 4) exactly once', () => {
  const sources = fixture(), result = history(sources);
  assert.deepEqual(result.observations.map(point => point.value), [-2.5, -4, -5]);
  assert.equal(result.error, null);
  assert.equal(result.window.preset, 'all');
  assert.equal(result.series.id, 'currentAccountToGdp');
  assert.equal(result.series.name, 'Current account / nominal GDP');
  assert.equal(result.series.short, 'Current account / GDP');
  assert.equal(result.series.format, 'percent');
  assert.equal(result.series.precision, 2);
  assert.equal(result.series.unit, 'Percent of nominal GDP');
  assert.equal(result.series.frequency, 'Quarterly');
  assert.equal(result.series.dateConvention, 'quarter-start');
  assert.equal(result.series.adjustment, 'Seasonally adjusted');
  assert.equal(result.series.comparisonClass, 'rate');
  assert.equal(result.series.observationType, 'calculated');
  assert.equal(result.series.observations.length, 3);
  assert.equal(result.formula, module.CURRENT_ACCOUNT_GDP_FORMULA);
  assert.match(result.notice, /retained revised.*independently/);
  assert.match(result.notice, /not an independently published BEA ratio/);
  assert.deepEqual(result.observations.at(-1), module.currentAccountGdpContext(sources).current);
  assert.equal(result.observations.at(-1).nominalGdpQuarter, 6000);
  assert.equal(result.observations.at(-1).numeratorObservation, sources.beaIta.series.currentAccountBalance.observations.at(-1));
  assert.equal(result.observations.at(-1).denominatorObservation, sources.bea.series.nominalGdp.observations.at(-1));
});

test('all retained official current-account quarters match exact nominal GDP quarters, covering at least 266 quarters', () => {
  const result = history(snapshot.sources), balances = snapshot.sources.beaIta.series.currentAccountBalance.observations;
  const nominalGdp = new Map(snapshot.sources.bea.series.nominalGdp.observations.map(point => [point.date, point]));
  assert.equal(result.error, null);
  assert.equal(result.observations.length, balances.length);
  assert.ok(result.observations.length >= 266);
  assert.equal(result.observations[0].date, '1960-01-01');
  assert.equal(result.observations.at(-1).date, balances.at(-1).date);
  for (const [index, balance] of balances.entries()) {
    const point = result.observations[index], gdp = nominalGdp.get(balance.date);
    assert.equal(point.date, balance.date);
    const available = Number.isFinite(balance.value) && Number.isFinite(gdp?.value) && gdp.value > 0;
    assert.equal(point.value, available ? 100 * balance.value / (gdp.value / 4) : null);
    assert.equal(point.numeratorObservation, balance);
    assert.equal(point.denominatorObservation, gdp ?? null);
  }
});

test('custom, year and count windows select exact reference dates while preserving full history', () => {
  const sources = fixture();
  const custom = history(sources, { preset: 'custom', startDate: '2025-12-15', endDate: '2026-03-20' });
  assert.deepEqual(custom.observations.map(point => point.date), ['2026-01-01']);
  assert.equal(custom.window.startDate, '2025-12-15');
  assert.equal(custom.series.observations.length, 3);
  sources.beaIta.series.currentAccountBalance.observations.unshift(row('2024-01-01', -50));
  sources.bea.series.nominalGdp.observations.unshift(row('2024-01-01', 10000));
  assert.deepEqual(history(sources, { preset: '1y' }).observations.map(point => point.date), ['2025-04-01', '2025-07-01', '2025-10-01', '2026-01-01', '2026-04-01']);
  assert.equal(history(sources, { preset: '3y' }).observations.length, 10);
  assert.equal(history(sources, { preset: '5y' }).observations.length, 10);
  assert.deepEqual(history(sources, 2).observations.map(point => point.date), ['2026-01-01', '2026-04-01']);
  assert.deepEqual(history(sources, 0).observations, []);
});

test('invalid custom and unknown windows provide an error without removing full history', () => {
  for (const range of [
    { preset: 'custom', startDate: '2026-02-30', endDate: '2026-04-01' },
    { preset: 'custom', startDate: '2026-04-01', endDate: '2026-01-01' },
    { preset: 'custom' }, { preset: '10y' },
  ]) {
    const result = history(fixture(), range);
    assert.equal(result.observations.length, 0);
    assert.equal(result.series.observations.length, 3);
    assert.ok(result.error);
    assert.equal(result.error, result.window.error);
  }
});

test('missing quarters insert calculated gaps and never invent official observations', () => {
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations.splice(1, 1);
  sources.bea.series.nominalGdp.observations.splice(1, 1);
  const result = history(sources), gap = result.observations[1];
  assert.deepEqual(result.observations.map(point => point.date), ['2025-10-01', '2026-01-01', '2026-04-01']);
  assert.equal(gap.value, null);
  assert.equal(gap.currentAccountBalance, null);
  assert.equal(gap.nominalGdpSaar, null);
  assert.equal(gap.numeratorObservation, null);
  assert.equal(gap.denominatorObservation, null);
  assert.match(gap.reason, /current.account.*missing/i);
  assert.equal(sources.beaIta.series.currentAccountBalance.observations.length, 2);
});

test('missing GDP quarters, retained nulls and latest missing quarters remain visible gaps', () => {
  const sources = fixture();
  sources.bea.series.nominalGdp.observations.splice(1, 1);
  sources.beaIta.series.currentAccountBalance.observations.at(-1).value = null;
  const result = history(sources);
  assert.equal(result.observations.length, 3);
  assert.equal(result.observations[1].value, null);
  assert.equal(result.observations[1].denominatorObservation, null);
  assert.equal(result.observations[1].currentAccountBalance, -200);
  assert.match(result.observations[1].reason, /GDP.*missing/i);
  assert.equal(result.observations[2].value, null);
  assert.equal(result.observations[2].numeratorObservation.value, null);
  assert.match(result.observations[2].reason, /current.account.*missing/i);
});

test('GDP-only earlier and later quarters never extend the current-account calendar', () => {
  const sources = fixture();
  sources.bea.series.nominalGdp.observations.push(row('2026-07-01', 28000));
  sources.bea.series.nominalGdp.observations.unshift(row('2020-01-01', 12000));
  sources.beaIta.series.currentAccountBalance.observations.reverse();
  const result = history(sources);
  assert.equal(result.observations.length, 3);
  assert.equal(result.window.fullStartDate, '2025-10-01');
  assert.equal(result.window.fullEndDate, '2026-04-01');
  assert.deepEqual(result.observations.map(point => point.value), [-2.5, -4, -5]);
});

test('zero or surplus numerator is valid; nonpositive, nonfinite or nonnumeric GDP is unavailable', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, 0, -1, '24000']) {
    const sources = fixture();
    sources.bea.series.nominalGdp.observations.at(-1).value = value;
    const point = history(sources).observations.at(-1);
    assert.equal(point.value, null);
    assert.ok(point.reason);
  }
  for (const [value, expected] of [[0, 0], [300, 5]]) {
    const sources = fixture();
    sources.beaIta.series.currentAccountBalance.observations.at(-1).value = value;
    assert.equal(history(sources).observations.at(-1).value, expected);
  }
});

test('incompatible units and identities fail closed across the whole ratio history', () => {
  for (const [provider, id, field, value] of [
    ['beaIta', 'currentAccountBalance', 'unit', 'USD billions (SAAR)'],
    ['beaIta', 'currentAccountBalance', 'adjustment', 'Not seasonally adjusted'],
    ['beaIta', 'currentAccountBalance', 'sourceIds', ['ITA:T1.1:line31:World:SA:Q']],
    ['bea', 'nominalGdp', 'unit', 'Billions of chained 2017 dollars (SAAR)'],
    ['bea', 'nominalGdp', 'frequency', 'Annual'],
    ['bea', 'nominalGdp', 'sourceIds', ['A191RL']],
  ]) {
    const sources = fixture();
    sources[provider].series[id][field] = value;
    const result = history(sources);
    assert.match(result.error, /incompatible/i);
    assert.ok(result.observations.every(point => point.value === null));
    assert.ok(result.observations.every(point => point[provider === 'beaIta' ? 'numeratorObservation' : 'denominatorObservation'] === null));
  }
});

test('duplicate dates, malformed quarters and invalid containers cannot silently select arbitrary inputs', () => {
  for (const [provider, id] of [['beaIta', 'currentAccountBalance'], ['bea', 'nominalGdp']]) {
    for (const extra of [row('2026-04-01', 99), row('2026-04-02', 99), row('0000-01-01', 99), row(null, 99)]) {
      const sources = fixture();
      sources[provider].series[id].observations.push(extra);
      const result = history(sources);
      assert.match(result.error, /quarter date/i);
      assert.ok(result.observations.every(point => point.value === null));
    }
    const sources = fixture();
    sources[provider].series[id].observations = { find: 'not a function' };
    assert.match(history(sources).error, /observations.*missing/i);
  }
});

test('cached observations retain values; revisions are recalculated without changing source input or context', () => {
  const sources = fixture(), before = structuredClone(sources), original = history(sources);
  assert.deepEqual(sources, before);
  sources.beaIta.status = 'cached';
  sources.bea.status = 'cached';
  assert.deepEqual(history(sources).observations.map(point => point.value), original.observations.map(point => point.value));
  sources.bea.series.nominalGdp.observations.at(-1).value = 25000;
  const revised = history(sources);
  assert.equal(revised.observations.at(-1).value, -4.8);
  assert.equal(original.observations.at(-1).value, -5);
  assert.deepEqual(revised.observations.at(-1), module.currentAccountGdpContext(sources).current);
  assert.deepEqual(revised.observations.at(-2), module.currentAccountGdpContext(sources).previous);
});

test('empty sources retain unavailable metadata and do not fabricate a historical calendar', () => {
  const result = history();
  assert.equal(result.observations.length, 0);
  assert.equal(result.series.observations.length, 0);
  assert.ok(result.error);
  assert.equal(result.window.fullStartDate, null);
  assert.equal(result.window.fullEndDate, null);
});

test('quarter-span helper counts inclusive valid ordered quarters and rejects malformed boundaries', () => {
  assert.equal(module.MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS, 5000);
  assert.equal(typeof module.currentAccountGdpQuarterSpan, 'function');
  assert.equal(module.currentAccountGdpQuarterSpan('2025-10-01', '2026-04-01'), 3);
  assert.equal(module.currentAccountGdpQuarterSpan('2026-04-01', '2026-04-01'), 1);
  assert.equal(module.currentAccountGdpQuarterSpan('1000-01-01', '2249-10-01'), 5000);
  assert.equal(module.currentAccountGdpQuarterSpan('1000-01-01', '2250-01-01'), 5001);
  for (const [start, end] of [
    ['2026-04-01', '2026-01-01'], ['2026-02-01', '2026-04-01'],
    ['0000-01-01', '2026-04-01'], ['2026-04-01', '2026-04-02'],
    [null, '2026-04-01'], ['2026-04-01', undefined], ['', ''],
  ]) assert.equal(module.currentAccountGdpQuarterSpan(start, end), 0);
});

test('sparse input calendar over 5000 quarters is rejected before expansion, even for a tiny display window', () => {
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations = [row('1000-01-01', -200), row('2250-01-01', -300)];
  sources.bea.series.nominalGdp.observations = [row('1000-01-01', 20000), row('2250-01-01', 24000)];
  for (const range of [{ preset: 'all' }, 1, { preset: 'custom', startDate: '2250-01-01', endDate: '2250-01-01' }]) {
    const result = history(sources, range);
    assert.match(result.error, /5000/);
    assert.equal(result.series.observations.length, 0);
    assert.equal(result.observations.length, 0);
  }
  const context = module.currentAccountGdpContext(sources);
  assert.equal(context.current.value, -5, 'The historical expansion bound must not alter the current/prior ratio API');
  assert.equal(context.date, '2250-01-01');
});

test('exactly 5000 inclusive quarters are allowed, retaining explicit internal missing-input rows', () => {
  const sources = fixture();
  sources.beaIta.series.currentAccountBalance.observations = [row('1000-01-01', -200), row('2249-10-01', -300)];
  sources.bea.series.nominalGdp.observations = [row('1000-01-01', 20000), row('2249-10-01', 24000)];
  const result = history(sources);
  assert.equal(result.error, null);
  assert.equal(result.series.observations.length, 5000);
  assert.equal(result.observations.length, 5000);
  assert.equal(result.observations[0].value, -4);
  assert.equal(result.observations.at(-1).value, -5);
  assert.equal(result.observations[1].date, '1000-04-01');
  assert.equal(result.observations[1].value, null);
  assert.equal(result.observations[1].numeratorObservation, null);
  assert.equal(result.observations[1].denominatorObservation, null);
  assert.equal(result.observations.filter(point => point.reason).length, 4998);
});
