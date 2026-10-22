import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContributionQuarter, gdpContributionSummary } from '../src/macro-contributions.js';

const quarter = (overrides = {}) => ({ date: '2026-04-01', total: 2.2, consumption: 2.51, investment: .82, government: -.01, exports: .56, imports: -1.66, ...overrides });

test('uses published contribution signs and allows only published rounding precision', () => {
  const result = validateContributionQuarter(quarter());
  assert.equal(result.complete, true);
  assert.ok(Math.abs(result.sum - 2.22) < 1e-12);
  assert.ok(Math.abs(result.residual + .02) < 1e-12);
  assert.equal(result.roundingLimit, .075);
  assert.throws(() => validateContributionQuarter(quarter({ imports: 1.66 })), /reconcil|round/i);
});

test('missing component remains unavailable and cannot be treated as zero', () => {
  const result = validateContributionQuarter(quarter({ government: null }));
  assert.equal(result.complete, false);
  assert.equal(result.sum, null);
  assert.equal(result.residual, null);
  assert.throws(() => validateContributionQuarter(quarter({ date: '2026-05-01' })), /quarter/i);
});

test('explains published accounting contributions and exact consecutive-quarter changes', () => {
  const source = { quarterly: [quarter({ date: '2026-01-01', total: 2.5, consumption: .49, investment: 1.25, government: .8, exports: 1.43, imports: -1.47 }), quarter()] };
  const summary = gdpContributionSummary(source);
  assert.equal(summary.date, '2026-04-01');
  assert.equal(summary.total, 2.2);
  assert.ok(Math.abs(summary.growthChange + .3) < 1e-12);
  assert.equal(summary.largestPositive.label, 'Personal consumption expenditures');
  assert.equal(summary.largestNegative.id, 'imports');
  assert.ok(Math.abs(summary.components.find(x => x.id === 'consumption').change - 2.02) < 1e-12);
  assert.match(summary.interpretation, /accounting/i);
  assert.equal(gdpContributionSummary({ quarterly: [source.quarterly[1]] }).growthChange, null);
  assert.equal(gdpContributionSummary(source, { date: '2025-10-01' }), null);
});

test('latest incomplete quarter is shown explicitly and is not silently replaced by an older complete row', () => {
  const summary = gdpContributionSummary({ quarterly: [quarter({ date: '2026-01-01' }), quarter({ government: null })] });
  assert.equal(summary.date, '2026-04-01');
  assert.equal(summary.complete, false);
  assert.equal(summary.largestPositive, null);
  assert.equal(summary.reconciliationResidual, null);
});
