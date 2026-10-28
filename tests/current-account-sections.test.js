import test from 'node:test';
import assert from 'node:assert/strict';
import {macroCoveragePage} from '../src/macro-coverage-page.js';
import {parseRoute} from '../src/router.js';

const external=(externalView='summary',query='')=>({...parseRoute(`#/economy?family=external${query}`),externalView});
const render=(view,query)=>macroCoveragePage(external(view,query));
const exportsBySection={
 summary:['data-export-current-account','data-export-current-account-gdp','data-export-macro-measure'],
 trends:['data-export-current-account-gdp-history','data-export-current-account-gdp-comparison','data-export-current-account-gdp-breakdown','data-export-current-account-gdp-trailing'],
 decomposition:['data-export-current-account-gdp-contributions','data-export-current-account-gdp-balance-effects','data-export-current-account-gdp-all-component-effects','data-export-current-account-gdp-component-effects'],
};

test('current-account default leads with exact-quarter accounting and native history without advanced charts',()=>{
 const html=macroCoveragePage(parseRoute('#/economy?family=external'));
 for(const text of ['CURRENT ACCOUNT · ACCOUNTING CHANGES','CURRENT ACCOUNT / NOMINAL GDP','FOCUSED HISTORY','exact preceding quarter','not annualized'])assert.ok(html.includes(text),text);
 assert.equal((html.match(/<div class="chart"[^>]*\sdata-chart(?:\s|>)/g)??[]).length,1);
 assert.doesNotMatch(html,/data-chart-catalog="current-account-gdp-|LATEST TOPIC READINGS/);
 assert.ok(html.indexOf('id="macro-measure"')<html.indexOf('CURRENT ACCOUNT · ACCOUNTING CHANGES'));
 assert.ok(html.indexOf('CURRENT ACCOUNT · ACCOUNTING CHANGES')<html.indexOf('CURRENT ACCOUNT / NOMINAL GDP'));
 assert.ok(html.indexOf('FOCUSED HISTORY')<html.indexOf('CURRENT ACCOUNT / NOMINAL GDP'));
 assert.match(html,/<nav[^>]+aria-label="Current-account sections"/);
 for(const label of ['Summary','Trends','Decomposition','Data &amp; methods'])assert.ok(html.includes(`>${label}</a>`),label);
 assert.match(html,/<a[^>]+aria-current="page"[^>]*>Summary<\/a>/);
});

test('advanced current-account calculations and exports remain reachable in their focused section',()=>{
 const html=Object.fromEntries(['summary','trends','decomposition','methods'].map(view=>[view,render(view)]));
 for(const [view,exports]of Object.entries(exportsBySection))for(const action of exports)assert.match(html[view],new RegExp(`${action}(?:[\\s=>])`),`${view}: ${action}`);
 for(const title of ['HISTORICAL CURRENT ACCOUNT / GDP','QUARTERLY VS TRAILING FOUR QUARTERS','HISTORICAL CURRENT ACCOUNT / GDP · BREAKDOWN','TRAILING FOUR QUARTERS · CURRENT ACCOUNT / GDP'])assert.ok(html.trends.includes(title),title);
 for(const title of ['COMPONENT CONTRIBUTIONS TO RATIO CHANGES','BALANCE CHANGES VS GDP-DENOMINATOR EFFECTS','ALL-COMPONENT BALANCE &amp; GDP EFFECT COMPARISON','COMPONENT BALANCE &amp; GDP EFFECT HISTORY'])assert.ok(html.decomposition.includes(title),title);
 assert.doesNotMatch(html.trends,/COMPONENT CONTRIBUTIONS TO RATIO CHANGES|CURRENT ACCOUNT · ACCOUNTING CHANGES/);
 assert.doesNotMatch(html.decomposition,/QUARTERLY VS TRAILING FOUR QUARTERS|FOCUSED HISTORY/);
 assert.match(html.methods,/LATEST TOPIC READINGS|DATA &amp; METHODS/);
 assert.match(html.methods,/GDP.*divided by four|GDP.*÷ 4/i);
 assert.match(html.methods,/first.release|first.publication/i);
 assert.match(html.methods,/CSV|exports/i);
 assert.doesNotMatch(html.methods,/data-chart\b/);
});

test('each external section keeps one shared measure and date control with exact custom dates',()=>{
 for(const view of ['summary','trends','decomposition','methods']){
  const html=render(view,'&measure=itaServicesBalance&window=custom&start=2024-04-01&end=2025-01-01');
  for(const id of ['macro-family','macro-measure','window-start','window-end'])assert.equal((html.match(new RegExp(`id="${id}"`,'g'))??[]).length,1,`${view}: ${id}`);
  assert.match(html,/value="itaServicesBalance" selected/);
  assert.match(html,/id="window-start"[^>]+value="2024-04-01"/);
  assert.match(html,/id="window-end"[^>]+value="2025-01-01"/);
  if(view==='summary')assert.match(html,/data-range="\{&quot;preset&quot;:&quot;custom&quot;,&quot;startDate&quot;:&quot;2024-04-01&quot;,&quot;endDate&quot;:&quot;2025-01-01&quot;\}"/);
 }
});

test('Summary keeps history controls compact with selected context visible and validation errors expanded',()=>{
 const summary=render('summary','&measure=itaServicesBalance&window=custom&start=2024-04-01&end=2025-01-01');
 const disclosure=summary.match(/<details class="supporting-details"[^>]*><summary>History controls[^]*?<\/details>/)?.[0];
 assert.ok(disclosure,'Summary history controls are available in a disclosure');
 assert.match(disclosure,/id="external-history-controls"/,'The controller can preserve the open controls during edits');
 assert.doesNotMatch(disclosure.split('>')[0],/\bopen\b/,'Valid Summary history controls start closed');
 assert.match(disclosure,/<summary>History controls · [^<]*Services[^<]*2024-04-01[^<]*2025-01-01<\/summary>/i);
 for(const id of ['macro-family','macro-measure','window-start','window-end'])assert.ok(disclosure.includes(`id="${id}"`),id);
 assert.ok(summary.indexOf(disclosure)<summary.indexOf('CURRENT ACCOUNT · ACCOUNTING CHANGES'));
 for(const view of ['trends','decomposition','methods'])assert.doesNotMatch(render(view),/<summary>History controls/);
 const invalid=render('summary','&window=custom&start=2025-01-01&end=2024-04-01');
 assert.match(invalid,/<details class="supporting-details"[^>]*\bopen\b[^>]*><summary>History controls/);
 assert.match(invalid,/role="alert"/);
});

test('section links and indicator detail returns retain the selected measure, section and exact dates',()=>{
 const query='&measure=itaServicesBalance&window=custom&start=2024-04-01&end=2025-01-01';
 for(const view of ['summary','trends','decomposition','methods']){
  const html=render(view,query),navigation=html.match(/<nav[^>]+aria-label="Current-account sections">(.*?)<\/nav>/)?.[1];
  assert.ok(navigation);
  const links=[...navigation.matchAll(/href="([^"]+)"/g)].map(match=>parseRoute(match[1].replaceAll('&amp;','&')));
  assert.deepEqual(links.map(state=>state.externalView),['summary','trends','decomposition','methods']);
  for(const target of links){
   assert.equal(target.macroFamily,'external');assert.equal(target.macroMeasure,'itaServicesBalance');
   assert.equal(target.window,'custom');assert.equal(target.startDate,'2024-04-01');assert.equal(target.endDate,'2025-01-01');
  }
  if(view==='summary'||view==='methods'){
   const detail=html.match(view==='summary'?/href="([^"]+)">DETAILS & DATA TABLE/:/<th scope="row"><a href="([^"]+)"/);
   assert.ok(detail);
   const origin=parseRoute(parseRoute(detail[1].replaceAll('&amp;','&')).returnTo);
   assert.equal(origin.externalView,view);assert.equal(origin.window,'custom');assert.equal(origin.startDate,'2024-04-01');assert.equal(origin.endDate,'2025-01-01');
  }
 }
});

test('invalid external section falls back to summary and does not alter other family workspaces',()=>{
 const html=render('unknown');
 assert.match(html,/CURRENT ACCOUNT · ACCOUNTING CHANGES/);
 assert.doesNotMatch(html,/data-chart-catalog="current-account-gdp-/);
 const prices=macroCoveragePage({...parseRoute('#/economy?family=prices'),externalView:'decomposition'});
 assert.match(prices,/LATEST TOPIC READINGS|FOCUSED HISTORY/);
 assert.doesNotMatch(prices,/Current-account sections|CURRENT ACCOUNT · ACCOUNTING CHANGES|data-chart-catalog="current-account-gdp-/);
});
