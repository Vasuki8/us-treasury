import test from 'node:test';
import assert from 'node:assert/strict';
import {explorePage} from '../src/explore-page.js';
import {parseRoute} from '../src/router.js';
import {series} from '../src/data.js';

const catalogRows=state=>[...explorePage(state).matchAll(/data-catalog-series="([^"]+)"/g)].map(match=>match[1]);
const search=query=>parseRoute('#/explore?q='+encodeURIComponent(query));

test('catalog search keeps exact identifiers and source codes ahead of topic and metadata matches',()=>{
 for(const [query,id,otherIds]of [['debt','debt',['publicDebt','householdDebtService','mortgageDebtService']],['pce','pce',['pcePriceGrowth','pceAnnualized3m','pceAnnualized6m']],['  pCe  ','pce',['pcePriceGrowth','pceAnnualized3m','pceAnnualized6m']]]){const rows=catalogRows(search(query));assert.equal(rows[0],id,query);for(const other of otherIds)assert.ok(rows.indexOf(other)>0,`${query}: retains ${other} after the exact ID`);}
 const code='CUUR0000SA0',rows=catalogRows(search(code)),exact=id=>[series[id].code,...series[id].source.seriesIds].some(value=>value.toUpperCase()===code),lastExact=rows.findLastIndex(exact);
 assert.ok(lastExact>=0);assert.ok(rows.slice(0,lastExact+1).every(exact),'every exact native code precedes loose code/metadata matches');
 assert.ok(rows.includes('cpiIndex'));assert.ok(rows.includes('cpi'));assert.ok(rows.includes('cpiCoreIndex'));assert.ok(rows.includes('cpiCore'));
});

test('ranked catalog results still respect topic and frequency filters',()=>{
 const rows=catalogRows({...search('debt'),topic:'Fiscal',frequency:'Daily'});
 assert.equal(rows[0],'debt');assert.ok(rows.includes('publicDebt'));
 assert.ok(rows.every(id=>series[id].topic==='Fiscal'&&series[id].frequency==='Daily'));
});

test('empty and whitespace-only catalog searches retain topic and headline browsing',()=>{
 for(const query of ['', '  \t  ']){
  assert.deepEqual(catalogRows(search(query)).slice(0,4),
   ['gdp','privateDomesticDemandGrowth','realSpendingMonthly','realDisposableIncomeMonthly']);
 }
});
