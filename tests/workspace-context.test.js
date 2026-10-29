import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor,safeReturnTo} from '../src/router.js';
import {indicatorHref,workspaceReturn,viewRange,createWorkspaceMemory,updateWorkspaceSelection} from '../src/workspace-context.js';

test('calendar windows, custom dates and baseline differences round-trip without replacing old observation links',()=>{
 for(const window of ['1y','3y','5y','all','custom']){
  const state={...parseRoute('#/explore'),window,startDate:window==='custom'?'2024-02-29':'',endDate:window==='custom'?'2026-09-30':'',selected:['sofr','effr'],exploreMode:'compare',comparison:'difference'};
  const parsed=parseRoute(routeFor(state));for(const key of ['window','startDate','endDate','comparison','selected'])assert.deepEqual(parsed[key],state[key]);
 }
 assert.equal(parseRoute('#/series/sofr?range=6').window,'observations');assert.equal(parseRoute('#/series/sofr?range=12').window,'observations');
 assert.equal(parseRoute('#/series/sofr').window,'1y');assert.equal(viewRange(parseRoute('#/series/sofr?range=6')),6);
 assert.deepEqual(viewRange(parseRoute('#/series/sofr?window=custom&start=2024-01-01&end=2025-12-31')),{preset:'custom',startDate:'2024-01-01',endDate:'2025-12-31'});
 assert.equal(parseRoute('#/series/sofr?window=all&range=6').window,'all');
 assert.equal(parseRoute('#/series/sofr?window=custom&start=2024-02-30&end=2025-12-31').startDate,'2024-02-30','invalid dates remain visible to model validation');
});

test('indicator return links retain catalog filters, comparison selection and date configuration',()=>{
 const original={...parseRoute('#/explore'),query:'Treasury',topic:'Fiscal',frequency:'Monthly',selected:['receipts','publicDebt'],window:'all',comparison:'difference'};
 const href=indicatorHref('publicDebt',original),detail=parseRoute(href),back=workspaceReturn(detail);
 assert.equal(detail.seriesId,'publicDebt');assert.equal(detail.page,'indicator');assert.equal(detail.window,'all');
 assert.deepEqual(detail.selected,original.selected,'opening the detail URL fresh retains the actual comparison selection');
 assert.equal(detail.comparison,original.comparison,'adding a measure after a copied link retains comparison mode');
 assert.equal(back.href,routeFor(original));assert.match(back.label,/RESULTS/);
 const restored=parseRoute(back.href);for(const key of ['query','topic','frequency','selected','window'])assert.deepEqual(restored[key],original[key]);
});

test('watchlist is a real route with safe return access through comparisons',()=>{
 const origin=parseRoute('#/watchlist?comparison=difference&window=all');assert.equal(origin.page,'watchlist');
 const detail=parseRoute(indicatorHref('sofr',origin));assert.match(workspaceReturn(detail).label,/WATCHLIST/);
 const comparison={...detail,page:'explore',exploreMode:'compare',selected:['sofr','effr']};
 assert.match(workspaceReturn(parseRoute(routeFor(comparison))).label,/WATCHLIST/);
 const comparisonDetail=parseRoute(indicatorHref('effr',comparison));
 const returnedComparison=parseRoute(workspaceReturn(comparisonDetail).href);
 assert.match(workspaceReturn(returnedComparison).label,/WATCHLIST/,'comparison retains its ultimate watchlist origin after detail inspection');
 assert.equal(returnedComparison.window,'all');
 const returnedWatchlist=parseRoute(workspaceReturn(returnedComparison).href);
 assert.equal(returnedWatchlist.comparison,'difference');
 const newSelection=['sofr','effr','claims'];
 const updated=parseRoute(updateWorkspaceSelection(comparisonDetail.returnTo,newSelection));
 assert.deepEqual(updated.selected,newSelection);
 assert.deepEqual(parseRoute(workspaceReturn(updated).href).selected,newSelection,'adding from a detail updates both return destinations');
 const catalog={...origin,page:'explore',returnTo:routeFor(origin)};
 assert.match(workspaceReturn(parseRoute(workspaceReturn(parseRoute(indicatorHref('sofr',catalog))).href)).label,/WATCHLIST/,'catalog keeps the same bounded origin');
});

test('return routes stay in approved workspaces with at most one watchlist origin',()=>{
 for(const value of ['https://example.com','#/series/missing','#/exploreevil','javascript:alert(1)','//example.com','#/watchlist\n'])assert.equal(safeReturnTo(value),null);
 assert.equal(safeReturnTo('#/explore?q=Treasury&return=%23%2Fwatchlist'),'#/explore?q=Treasury&return=%23%2Fwatchlist');
 assert.equal(safeReturnTo('#/explore?return=%23%2Fexplore'),'#/explore');
 assert.equal(safeReturnTo('#/watchlist?return=%23%2Fexplore'),'#/watchlist');
 assert.equal(safeReturnTo('#/explore?return=https%3A%2F%2Fexample.com'),'#/explore');
 assert.equal(safeReturnTo('#/explore?return='+encodeURIComponent('#/watchlist?return=%23%2Fexplore')),'#/explore?return=%23%2Fwatchlist');
 assert.equal(parseRoute('#/series/sofr?return=https%3A%2F%2Fexample.com').returnTo,null);
 assert.equal(workspaceReturn({returnTo:'https://example.com'}),null);
});

test('returning to the same workspace restores its scroll and focused link without mixing other searches',()=>{
 const memory=createWorkspaceMemory(),origin={...parseRoute('#/explore'),query:'Treasury',window:'all'};
 memory.remember(origin,{left:0,top:720,focusHref:'#/series/publicDebt'});
 const restored=parseRoute(workspaceReturn(parseRoute(indicatorHref('publicDebt',origin))).href);
 assert.deepEqual(memory.recall(restored),{left:0,top:720,focusHref:'#/series/publicDebt'});
 assert.deepEqual(memory.recall({...restored,selected:['sofr','publicDebt']}),memory.recall(restored),'adding a comparison series does not lose the original list position');
 assert.equal(memory.recall({...restored,query:'inflation'}),null);assert.equal(memory.recall({page:'indicator'}),null);
});
