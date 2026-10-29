import test from 'node:test';import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';import {renderPage} from '../src/pages.js';import {indicatorHref,workspaceReturn} from '../src/workspace-context.js';
import {series} from '../src/data.js';import {toCsv} from '../src/model.js';import {parseCsv} from '../scripts/sources/http.mjs';

test('macro coverage routes validate family and measure while preserving the exact research window',()=>{
 const state=parseRoute('#/economy?family=housing&measure=housingCompletions&window=custom&start=2025-01-01&end=2026-08-31');
 assert.equal(state.page,'macroCoverage');assert.equal(state.macroFamily,'housing');assert.equal(state.macroMeasure,'housingCompletions');
 const restored=parseRoute(routeFor(state));for(const key of ['macroFamily','macroMeasure','window','startDate','endDate'])assert.equal(restored[key],state[key]);
 const invalid=parseRoute('#/economy?family=vendor&measure=unrate');assert.equal(invalid.macroFamily,'prices');assert.equal(invalid.macroMeasure,'cpiMonthly');
 const mismatched=parseRoute('#/economy?family=housing&measure=unrate');assert.equal(mismatched.macroMeasure,'housingStarts');
 assert.equal(parseRoute('#/economy/labor').page,'labor');
 const detail=parseRoute(indicatorHref('housingStarts',state));
 assert.equal(workspaceReturn(detail).label,'BACK TO ECONOMY');assert.equal(workspaceReturn(detail).href,routeFor(state));
 const comparison={...state,page:'explore',exploreMode:'compare',returnTo:routeFor(state),selected:['housingStarts','housingCompletions']};
 const inspect=parseRoute(indicatorHref('housingStarts',comparison));const restoredComparison=parseRoute(workspaceReturn(inspect).href);
 assert.equal(workspaceReturn(restoredComparison).label,'BACK TO ECONOMY');
});

test('family workspace reuses date windows, history, detail context, safe comparisons and same-window CSV',()=>{
 const id='cpiMonthly',prior=series[id];series[id]={...prior,dataStatus:'official',error:null,fetchedAt:'2026-10-22T12:00:00Z',observations:[{date:'2026-07-01',value:.1},{date:'2026-08-01',value:.2},{date:'2026-09-01',value:.3}]};
 // This display fixture supplies no observation receipts and uses the legacy contract.
 delete series[id].inputProvenanceScope;
 try{
  const state=parseRoute('#/economy?family=prices&measure=cpiMonthly&window=custom&start=2026-08-01&end=2026-08-31'),html=renderPage(state);
  for(const text of ['INFLATION','How do headline and core','WHAT CHANGED','CONTEXT','WHY IT MATTERS','LIMITATIONS','Seasonally adjusted','month over month','Retained: 3 observations','Displayed: 1 observations'])assert.ok(html.includes(text),text);
  assert.match(html,/id="macro-family"/);assert.match(html,/id="macro-measure"/);assert.match(html,/data-export-macro-measure/);assert.match(html,/data-compare="cpiMonthly,cpiCoreMonthly"/);
  assert.match(html,/data-series="cpiMonthly"/);assert.match(html,/window=custom.*return=/);
  const [header,...rows]=parseCsv(toCsv([id],{range:{preset:'custom',startDate:'2026-08-01',endDate:'2026-08-31'}}));
  assert.equal(rows.length,1);assert.equal(rows[0][header.indexOf('date')],'2026-08-01');assert.equal(rows[0][header.indexOf('observation_type')],'calculated');
 }finally{series[id]=prior;}
});

test('family workspace shows unavailable or cached sources, invalid dates and external schedule coverage honestly',()=>{
 const id='housingStarts',prior=series[id];series[id]={...prior,observations:[],dataStatus:'unavailable',error:'Official source unavailable <test>',fetchedAt:null};
 try{
  const html=renderPage(parseRoute('#/economy?family=housing'));
  assert.match(html,/History unavailable/);assert.match(html,/Official source unavailable &lt;test&gt;/);assert.match(html,/New Residential Construction/);
  assert.match(html,/SAAR|annual rates/);assert.match(html,/External official schedule/);
  const invalid=renderPage(parseRoute('#/economy?family=housing&window=custom&start=2026-10-01&end=2026-09-01'));
  assert.match(invalid,/data-export-macro-measure[^>]*disabled/);assert.match(invalid,/role="alert"/);
 }finally{series[id]=prior;}
 const policy=renderPage(parseRoute('#/economy?family=policy'));
 assert.match(policy,/not.*announcement timestamps|not FOMC announcement timestamps/i);assert.match(policy,/IORB starts in July 2021/);
});
