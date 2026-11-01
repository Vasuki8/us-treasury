import test from 'node:test';
import assert from 'node:assert/strict';
import {explorePage} from '../src/explore-page.js';
import {parseRoute} from '../src/router.js';
import {series} from '../src/data.js';

const catalogRows=state=>[...explorePage(state).matchAll(/data-catalog-series="([^"]+)"/g)].map(match=>match[1]);
const search=query=>parseRoute('#/explore?q='+encodeURIComponent(query));

test('catalog search keeps exact identifiers and source codes ahead of topic and metadata matches',()=>{
 for(const [query,expected]of [
  ['debt',['debt','publicDebt','householdDebtService','mortgageDebtService']],
  ['pce',['pce','pcePriceGrowth','pceAnnualized3m','pceAnnualized6m']],
  ['  pCe  ',['pce','pcePriceGrowth','pceAnnualized3m','pceAnnualized6m']],
  ['CUUR0000SA0',['cpiIndex','cpi','cpiCoreIndex','cpiCore']],
 ])assert.deepEqual(catalogRows(search(query)).slice(0,4),expected,query);
});

test('ranked catalog results still respect topic and frequency filters',()=>{
 const rows=catalogRows({...search('debt'),topic:'Fiscal',frequency:'Daily'});
 assert.deepEqual(rows.slice(0,2),['debt','publicDebt']);
 assert.ok(rows.every(id=>series[id].topic==='Fiscal'&&series[id].frequency==='Daily'));
});

test('empty and whitespace-only catalog searches retain topic and headline browsing',()=>{
 for(const query of ['', '  \t  ']){
  assert.deepEqual(catalogRows(search(query)).slice(0,4),
   ['gdp','privateDomesticDemandGrowth','realSpendingMonthly','realDisposableIncomeMonthly']);
 }
});
