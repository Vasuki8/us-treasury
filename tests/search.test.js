import test from 'node:test';
import assert from 'node:assert/strict';
import { series } from '../src/data.js';

let search;
try { search = await import('../src/search.js'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('search.js')) throw error; }
const searchSeries = (...args) => { assert.ok(search, 'Ranked catalog search must exist'); return search.searchSeries(...args); };
const ids = result => result.map(item => item.id);
const catalog = () => Object.values(series);

test('Treasury aliases retain newer catalog measures from every relevant source', () => {
  const result = ids(searchSeries(catalog(), { query: 'treasury' }));
  for (const id of ['yield', 'debt', 'publicDebt', 'marketableDebt', 'nominalYield2', 'auctionOfferingMonthly', 'somaTreasuryHoldings', 'dealerNetTreasury']) assert.ok(result.includes(id), id);
});

test('search matches official IDs, units, definitions, agencies and calculation metadata', () => {
  for (const [query, id] of [
    ['CUUR0000SA0', 'cpi'], ['LM263061105.Q', 'foreignTreasuryHoldings'],
    ['percentage points', 'gdpImportsContribution'], ['macroContributions', 'gdpConsumptionContribution'],
    ['credit liquidity decomposition', 'sofrEffrSpread'],
  ]) assert.ok(ids(searchSeries(catalog(), { query })).includes(id), `${query} finds ${id}`);
  const custom = { id: 'calculated', name: 'Example measure', calculation: { formula: 'Exact calendar match', inputs: ['SourceUnique-1'] } };
  assert.deepEqual(ids(searchSeries([custom], { query: 'calendar sourceunique-1' })), ['calculated']);
});

test('exact identifiers and titles outrank loose metadata while every query term is required', () => {
  const candidates = [
    { id: 'loose', name: 'Other', definition: 'Unique measure and UNIT' },
    { id: 'title', name: 'Unique measure' },
    { id: 'code', name: 'Other', code: 'Unique measure' },
    { id: 'unique measure', name: 'Other' },
    { id: 'partial', name: 'Unique' },
  ];
  assert.deepEqual(ids(searchSeries(candidates, { query: '  UNIQUE measure  ' })), ['unique measure', 'code', 'title', 'loose']);
  assert.deepEqual(ids(searchSeries(candidates, { query: 'Unique absent' })), []);
});

test('search aliases expand vocabulary and compose with topic, frequency and watchlist filters', () => {
  const candidates = [...catalog(), { id: 'newEmployment', name: 'Employment level', topic: 'Labor', frequency: 'Monthly' }];
  assert.ok(ids(searchSeries(candidates, { query: 'jobs' })).includes('newEmployment'));
  assert.deepEqual(ids(searchSeries(catalog(), { query: 'Treasury', topic: 'Rates', frequency: 'Daily', watchlist: ['nominalYield2', 'debt'] })), ['nominalYield2']);
  assert.deepEqual(searchSeries(catalog(), { query: 'Treasury', watchlist: [] }), []);
});

test('empty search preserves catalog order and ranking never mutates its input', () => {
  const candidates = Object.freeze([{ id: 'b', name: 'B' }, { id: 'a', name: 'A' }]);
  assert.deepEqual(ids(searchSeries(candidates)), ['b', 'a']);
  searchSeries(candidates, { query: 'a' });
  assert.deepEqual(ids(candidates), ['b', 'a']);
});
