import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
const api=await import('../src/coverage-inventory.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const view=await import('../src/coverage-inventory-view.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const catalog={
 alpha:{id:'alpha',name:'Alpha <feed>',code:'A1',topic:'Labor',agency:'bls',frequency:'Monthly',unit:'Percent',adjustment:'Seasonally adjusted',observationType:'official',dataStatus:'cached',fetchedAt:'2026-10-22T12:00:00Z',error:'<retry>',source:{name:'BLS',url:'https://www.bls.gov/'},observations:[{date:'2010-01-01',value:0},{date:'2011-01-01',value:null},{date:'2012-01-01',value:3,suppressed:true}]},
 beta:{id:'beta',name:'Beta calculated',code:'B2',topic:'Growth',agency:'bea',frequency:'Quarterly',unit:'USD billions',adjustment:'SAAR',observationType:'calculated',dataStatus:'unavailable',source:{name:'BEA',url:'https://www.bea.gov/'},observations:[]},
 claimsAdvance:{id:'claimsAdvance',name:'Initial claims latest release',code:'C3',topic:'Labor',agency:'dolAdvance',frequency:'Weekly',unit:'Thousands',adjustment:'SA',observationType:'official',dataStatus:'official',source:{name:'DOL',url:'https://www.dol.gov/'},observations:[{date:'2026-10-17',value:194,publishedAt:'2026-10-22'}]},
};

test('coverage retains unavailable measurements and separates reference bounds, usable counts and observation/history types',()=>{
 assert.equal(typeof api.buildCoverageInventory,'function');const result=api.buildCoverageInventory(catalog);
 assert.equal(result.totalRegistered,3);assert.equal(result.rows.length,3);
 const a=result.rows.find(x=>x.id==='alpha'),b=result.rows.find(x=>x.id==='beta'),c=result.rows.find(x=>x.id==='claimsAdvance');
 assert.deepEqual([a.firstReference,a.lastReference,a.totalCount,a.usableCount],['2010-01-01','2012-01-01',3,1]);
 assert.equal(a.observationType,'official');assert.equal(a.captureStatus,'cached');assert.equal(a.historyType,'current-history');
 assert.equal(b.observationType,'calculated');assert.deepEqual([b.firstReference,b.lastReference,b.totalCount,b.usableCount],[null,null,0,0]);
 assert.equal(b.captureStatus,'unavailable');assert.equal(c.historyType,'latest-release-context');
});

test('coverage uses the existing composed search filters and separates loaded publication dates from observation history',()=>{
 assert.equal(typeof api.buildCoverageInventory,'function');const result=api.buildCoverageInventory(catalog,{query:'initial claims',topic:'Labor',frequency:'Weekly',publicationContexts:{claims:{status:'ready',archive:{releases:[{seriesId:'claimsAdvance',publicationDate:'2026-10-22'}]}}}});
 assert.equal(result.rows.length,1);const row=result.rows[0];assert.equal(row.firstReference,'2026-10-17');assert.equal(row.publications.firstDate,'2026-10-22');assert.equal(row.publications.status,'ready');
 const unloaded=api.buildCoverageInventory(catalog).rows.find(x=>x.id==='claimsAdvance');assert.equal(unloaded.publications.status,'unloaded');assert.equal(unloaded.publications.firstDate,null);
 assert.equal(api.buildCoverageInventory(catalog).rows.find(x=>x.id==='alpha').publications.status,'unsupported');
});

test('coverage view and CSV preserve source and dates safely without adding repeated latest values',()=>{
 assert.equal(typeof view.coverageInventoryPanel,'function');assert.equal(typeof api.coverageInventoryCsv,'function');
 const result=api.buildCoverageInventory(catalog),html=view.coverageInventoryPanel(result,{state:parseRoute('#/explore?mode=coverage')});
 assert.match(html,/Alpha &lt;feed&gt;/);assert.match(html,/&lt;retry&gt;/);assert.match(html,/2010-01-01/);assert.match(html,/1 \/ 3/);assert.match(html,/data-export-coverage/);assert.doesNotMatch(html,/LATEST VALUE|<feed>/);
 const csv=api.coverageInventoryCsv(result);assert.match(csv,/first_reference_date/);assert.match(csv,/usable_observations/);assert.match(csv,/alpha/);assert.match(csv,/2010-01-01/);assert.match(csv,/2026-10-22T12:00:00Z/);
});

test('coverage and GDP matrix/CPI selections survive bounded route round trips',()=>{
 const coverage=parseRoute('#/explore?mode=coverage&q=claims&topic=Labor&frequency=Weekly');assert.equal(coverage.exploreMode,'coverage');assert.equal(parseRoute(routeFor(coverage)).exploreMode,'coverage');
 const matrix=parseRoute('#/research?view=publications&publicationMode=matrix&publishedBy=2026-09-30');assert.equal(matrix.publicationMode,'matrix');assert.equal(parseRoute(routeFor(matrix)).publicationMode,'matrix');
 for(const id of ['cpi','cpiCore','cpiMonthly','cpiCoreMonthly']){const route=parseRoute('#/release?publicationSeries='+id);assert.equal(route.publicationSeries,id);assert.equal(parseRoute(routeFor(route)).publicationSeries,id);assert.equal(route.publicationMode,'quarter');}
});

test('frozen inventory preserves every searchable metadata field before reapplying its recorded query',()=>{
 for(const [field,query] of [['sourceTitle','Primary Dealer Statistics'],['measure','Wednesday net position stock at fair value']]){
  const input={alpha:{...catalog.alpha,[field]:query}};
  const live=api.buildCoverageInventory(input,{query});assert.equal(live.rows.length,1);
  const frozen=api.buildCoverageInventory(live.inputs,{...live.filters,registeredCount:live.totalRegistered});
  assert.deepEqual(frozen.rows,live.rows);
 }
});
