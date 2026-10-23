import test from 'node:test';
import assert from 'node:assert/strict';

const module = await import('../src/current-account-gdp.js').catch(() => ({}));
const row = (date, value) => ({ date, value, sourceValue: value === null ? '...' : String(value), publishedAt: null });
function fixture() {
  return {
    beaIta: { fetchedAt: '2026-10-23T01:00:00.000Z', series: { currentAccountBalance: {
      sourceIds: ['ITA:T1.1:line30:World:SA:Q'], unit: 'USD billions per quarter (not annualized)',
      frequency: 'Quarterly', adjustment: 'Seasonally adjusted', dateConvention: 'quarter-start',
      observations: [row('2026-01-01', -200), row('2026-04-01', -300)],
    } } },
    bea: { fetchedAt: '2026-10-22T02:00:00.000Z', series: { nominalGdp: {
      sourceIds: ['A191RC'], calculation: 'Source millions / 1000 = billions at seasonally adjusted annual rates.',
      observations: [row('2026-01-01', 20000), row('2026-04-01', 24000)],
    } } },
  };
}
const calculate = input => {
  assert.equal(typeof module.currentAccountGdpContext, 'function', 'The exact-quarter GDP ratio helper must be exported');
  return module.currentAccountGdpContext(input);
};

test('quarterly current account is divided by GDP SAAR / 4, preserving a deficit and percentage-point change', () => {
  const result = calculate(fixture());
  assert.equal(result.date, '2026-04-01');
  assert.equal(result.previousDate, '2026-01-01');
  assert.equal(result.current.currentAccountBalance, -300);
  assert.equal(result.current.nominalGdpSaar, 24000);
  assert.equal(result.current.nominalGdpQuarter, 6000);
  assert.equal(result.current.value, -5);
  assert.equal(result.previous.value, -4);
  assert.equal(result.change, -1);
  assert.equal(result.current.reason, null);
  assert.match(result.formula, /100/);
  assert.match(result.formula, /4/);
  assert.match(result.notice, /Meridian calculated/);
  assert.match(result.notice, /independently/);
  assert.match(result.notice, /first.release/i);
});

test('no factor-of-four error: annualizing current account once is equivalent to deannualizing GDP once', () => {
  const input = fixture();
  const point = calculate(input).current;
  assert.equal(point.value, 100 * (4 * -300) / 24000);
  assert.notEqual(point.value, 100 * -300 / 24000);
  assert.notEqual(point.value, 100 * (4 * -300) / (24000 / 4));
});

test('latest current-account quarter anchors the result despite newer GDP, and a newer unmatched CA stays unavailable', () => {
  const input = fixture();
  input.bea.series.nominalGdp.observations.push(row('2026-07-01', 28000));
  assert.equal(calculate(input).date, '2026-04-01');
  input.beaIta.series.currentAccountBalance.observations.push(row('2026-10-01', -400));
  const result = calculate(input);
  assert.equal(result.date, '2026-10-01');
  assert.equal(result.current.value, null);
  assert.match(result.current.reason, /GDP.*missing/i);
  assert.equal(result.previousDate, '2026-07-01');
  assert.equal(result.previous.value, null);
  assert.equal(result.change, null);
});

test('a retained null latest numerator is not replaced with an older overlap or zero', () => {
  const input = fixture();
  input.beaIta.series.currentAccountBalance.observations[1].value = null;
  const result = calculate(input);
  assert.equal(result.date, '2026-04-01');
  assert.equal(result.current.value, null);
  assert.equal(result.current.currentAccountBalance, null);
  assert.match(result.current.reason, /current.account.*missing/i);
  assert.equal(result.previous.value, -4);
  assert.equal(result.change, null);
});

test('zero and signed current-account balances remain valid observations', () => {
  for (const [balance, expected] of [[0, 0], [300, 5], [-300, -5]]) {
    const input = fixture();
    input.beaIta.series.currentAccountBalance.observations[1].value = balance;
    assert.equal(calculate(input).current.value, expected);
  }
});

test('missing, nonfinite and nonpositive GDP cannot produce a ratio', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, 0, -1, '24000']) {
    const input = fixture();
    input.bea.series.nominalGdp.observations[1].value = value;
    const point = calculate(input).current;
    assert.equal(point.value, null);
    assert.equal(point.nominalGdpQuarter, null);
    assert.match(point.reason, /GDP.*(?:missing|positive|finite)/i);
  }
});

test('nonfinite or nonnumeric numerator is missing rather than coerced to zero', () => {
  for (const value of [undefined, NaN, Infinity, '-300']) {
    const input = fixture();
    input.beaIta.series.currentAccountBalance.observations[1].value = value;
    assert.equal(calculate(input).current.value, null);
    assert.match(calculate(input).current.reason, /current.account.*missing/i);
  }
});

test('exact preceding quarter crosses the year and never substitutes an older observation', () => {
  const input = fixture();
  input.beaIta.series.currentAccountBalance.observations = [row('2026-01-01', -300), row('2025-07-01', -100)];
  input.bea.series.nominalGdp.observations = [row('2026-01-01', 24000), row('2025-07-01', 20000)];
  const result = calculate(input);
  assert.equal(result.previousDate, '2025-10-01');
  assert.equal(result.current.value, -5);
  assert.equal(result.previous.value, null);
  assert.equal(result.change, null);
});

test('admitted GDP registry conventions fill absent metadata, but explicitly incompatible metadata is rejected', () => {
  const input = fixture();
  assert.equal(calculate(input).current.value, -5);
  Object.assign(input.bea.series.nominalGdp, { unit: 'Billions of current dollars (SAAR)', frequency: 'Quarterly', adjustment: 'Seasonally adjusted annual rate', dateConvention: 'quarter-start', periodType: 'flow' });
  assert.equal(calculate(input).current.value, -5);
  for (const [provider, id, field, value] of [
    ['beaIta', 'currentAccountBalance', 'unit', 'USD billions (SAAR)'],
    ['beaIta', 'currentAccountBalance', 'frequency', 'Annual'],
    ['beaIta', 'currentAccountBalance', 'adjustment', 'Not seasonally adjusted'],
    ['beaIta', 'currentAccountBalance', 'dateConvention', 'quarter-end'],
    ['bea', 'nominalGdp', 'unit', 'Billions of chained 2017 dollars (SAAR)'],
    ['bea', 'nominalGdp', 'unit', 'USD millions'],
    ['bea', 'nominalGdp', 'frequency', 'Monthly'],
    ['bea', 'nominalGdp', 'adjustment', 'Seasonally adjusted'],
    ['bea', 'nominalGdp', 'periodType', 'stock'],
  ]) {
    const altered = structuredClone(input);
    altered[provider].series[id][field] = value;
    const result = calculate(altered);
    assert.equal(result.current.value, null, `${provider} ${field} must fail closed`);
    assert.match(result.current.reason, /incompatible/i);
  }
});

test('source identities exclude real GDP, GDP growth, and trade in place of current account', () => {
  for (const [provider, id, ids] of [
    ['bea', 'nominalGdp', ['A191RL']], ['bea', 'nominalGdp', ['A191RX']],
    ['beaIta', 'currentAccountBalance', ['ITA:T1.1:line31:World:SA:Q']],
    ['bea', 'nominalGdp', ['A191RC', 'A191RX']], ['bea', 'nominalGdp', undefined],
  ]) {
    const input = fixture();
    input[provider].series[id].sourceIds = ids;
    assert.equal(calculate(input).current.value, null);
    assert.match(calculate(input).current.reason, /identity/i);
  }
});

test('invalid reference dates and duplicate dates fail closed instead of selecting an arbitrary row', () => {
  for (const [provider, id] of [['beaIta', 'currentAccountBalance'], ['bea', 'nominalGdp']]) {
    for (const date of ['2026-04-02', '2026-02-01', '2026-13-01', '0000-01-01', null]) {
      const input = fixture();
      input[provider].series[id].observations.push(row(date, 42));
      assert.equal(calculate(input).current.value, null);
      assert.match(calculate(input).current.reason, /quarter.*date/i);
    }
    const input = fixture();
    input[provider].series[id].observations.push(row('2026-04-01', 99));
    assert.equal(calculate(input).current.value, null);
    assert.match(calculate(input).current.reason, /duplicate/i);
    assert.equal(calculate(input).current[provider === 'beaIta' ? 'numeratorObservation' : 'denominatorObservation'], null);
  }
});

test('malformed observation containers cannot throw or supply an arbitrary input', () => {
  for (const [provider, id] of [['beaIta', 'currentAccountBalance'], ['bea', 'nominalGdp']]) {
    const input = fixture();
    input[provider].series[id].observations = { find: 'not a function' };
    const result = calculate(input);
    assert.equal(result.current.value, null);
    assert.match(result.current.reason, /observations.*missing/i);
    assert.equal(result.current[provider === 'beaIta' ? 'numeratorObservation' : 'denominatorObservation'], null);
  }
});

test('revised inputs recompute independently and retain both actual matching observations without inventing vintages', () => {
  const input = fixture();
  input.beaIta.series.currentAccountBalance.observations.reverse();
  const original = calculate(input);
  input.bea.series.nominalGdp.observations[1].value = 25000;
  const result = calculate(input);
  assert.equal(result.current.value, -4.8);
  assert.notEqual(result.current.value, original.current.value);
  assert.deepEqual(result.current.numeratorObservation, input.beaIta.series.currentAccountBalance.observations[0]);
  assert.deepEqual(result.current.denominatorObservation, input.bea.series.nominalGdp.observations[1]);
  assert.match(result.notice, /retained revised/);
});

test('empty sources yield explicit unavailable context, and calculation never mutates input', () => {
  const empty = calculate();
  assert.equal(empty.date, null);
  assert.equal(empty.previousDate, null);
  assert.equal(empty.current.value, null);
  assert.equal(empty.previous.value, null);
  assert.equal(empty.change, null);
  assert.ok(empty.current.reason);
  const input = fixture(), before = structuredClone(input);
  calculate(input);
  assert.deepEqual(input, before);
});
