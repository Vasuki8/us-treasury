import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../src/registry.js';

let related;
try { related = await import('../src/related.js'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('related.js')) throw error; }
const relatedIndicators = id => { assert.ok(related, 'Curated related research context must exist'); return related.relatedIndicators(id); };

test('derived measures link to their actual inputs before other topic context', () => {
  assert.deepEqual(relatedIndicators('interestRevenueRatio').seriesIds.slice(0, 2), ['netInterestTtm', 'receiptsTtm']);
  assert.deepEqual(relatedIndicators('sofrEffrSpread').seriesIds.slice(0, 2), ['sofr', 'effr']);
  assert.deepEqual(relatedIndicators('spread2s10s').seriesIds.slice(0, 2), ['yield', 'nominalYield2']);
});

test('Treasury and specialist indicators get their own module and topic rather than fixed labor links', () => {
  for (const [id, href] of [['publicDebt', '#/fiscal'], ['marketableDebt', '#/refinancing'], ['spread2s10s', '#/yields'], ['auctionOfferingMonthly', '#/auctions'], ['somaTreasuryHoldings', '#/ownership'], ['gdpImportsContribution', '#/macro'], ['sofr', '#/market'], ['currentAccountBalance', '#/economy?family=external']]) {
    const result = relatedIndicators(id);
    assert.equal(result.module?.href, href, id);
    assert.ok(result.module.label.length);
    assert.ok(result.seriesIds.length > 0);
    assert.ok(result.seriesIds.every(relatedId => !['unrate', 'payroll', 'claims', 'participation', 'cpi'].includes(relatedId)), id);
  }
});

test('all related context uses unique existing series and unknown IDs fail closed', () => {
  for (const id of Object.keys(registry)) {
    const { seriesIds, module } = relatedIndicators(id);
    assert.equal(seriesIds.length, new Set(seriesIds).size);
    assert.ok(seriesIds.length <= 4);
    assert.ok(seriesIds.every(value => value !== id && Object.hasOwn(registry, value)), id);
    if (module) assert.match(module.href, /^#\/(?:[a-z]+|economy\/labor|economy\?family=(?:prices|policy|activity|housing|labor|external))$/);
  }
  assert.deepEqual(relatedIndicators('not-a-series'), { seriesIds: [], module: null });
});
