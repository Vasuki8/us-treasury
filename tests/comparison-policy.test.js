import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../src/registry.js';
import { series } from '../src/data.js';
import { compareSeries } from '../src/model.js';

test('every admitted measurement has an explicit comparison classification', async () => {
  const policy = await import('../src/model.js');
  assert.equal(typeof policy.comparisonClassification, 'function');
  assert.equal(Object.keys(registry).length, 48);
  for (const s of Object.values(series)) assert.notEqual(policy.comparisonClassification(s), 'unknown', s.id);
  assert.equal(policy.comparisonClassification({ id: 'unregistered', format: 'billions' }), 'unknown');
});

test('rates, growth, contributions, net balances and unknown measures fail ratio indexing with alternatives', () => {
  for (const id of ['unrate', 'yield', 'sofr', 'cpi', 'gdp', 'payroll', 'gdpImportsContribution', 'budgetDeficit', 'dealerNetTreasury']) {
    const result = compareSeries([id], 'indexed', { preset: 'all' });
    assert.deepEqual(result.panels, [], id);
    assert.match(result.error, new RegExp(series[id].name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(result.error, /native.*difference/i);
  }
  const unknown = { ...series.debt, id: 'unclassified-fixture', name: 'Unknown amount' };
  series[unknown.id] = unknown;
  try { assert.match(compareSeries([unknown.id], 'indexed', 2).error, /Unknown amount.*unknown/i); }
  finally { delete series[unknown.id]; }
});

test('indexing rejects any zero or negative observed value in the window instead of skipping it', () => {
  for (const value of [0, -1]) {
    const example = { ...series.debt, id: 'positive-fixture', name: 'Eligible amount', comparisonClass: 'amount', observations: [
      { date: '2026-01-01', value: 1 }, { date: '2026-02-01', value }, { date: '2026-03-01', value: 2 },
    ] };
    series[example.id] = example;
    try {
      assert.match(compareSeries([example.id], 'indexed', { preset: 'all' }).error, /Eligible amount.*positive/i);
      const narrow = compareSeries([example.id], 'indexed', { preset: 'custom', startDate: '2026-03-01', endDate: '2026-03-01' });
      assert.equal(narrow.error, null);
      assert.equal(narrow.panels[0].observations[0].value, 100);
    } finally { delete series[example.id]; }
  }
});
