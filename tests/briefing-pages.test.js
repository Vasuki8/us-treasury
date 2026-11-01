import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewPage} from '../src/overview-page.js';
import {laborPage} from '../src/labor-page.js';
import {seriesPreview} from '../src/workspace-preview.js';
import {getSeries} from '../src/model.js';
import {defaults} from '../src/router.js';
const state={...defaults,saved:[],selected:[]};

test('home briefing retains independent comparison periods and escapes cached-source failures',()=>{
 const current=getSeries('payroll'),before={...current};
 try{
  Object.assign(current,{observations:[{date:'2026-06-01',value:100},{date:'2026-09-01',value:-20}],dataStatus:'cached',error:'Failed <source>'});
  const html=overviewPage(state),brief=html.match(/<article class="stitch-brief-card" data-overview-guide-card="payroll" data-overview-brief="payroll"[^]*?<\/article>/)?.[0];
  assert.ok(brief);assert.match(brief,/reading-value">−20k<\/strong>/);assert.match(brief,/Thousands of jobs/);assert.match(brief,/Sep 2026/);
  assert.match(brief,/Prior retained reading: <strong>100k<\/strong> Jun 2026/);
  assert.match(brief,/Cached/);assert.match(brief,/Failed &lt;source&gt;/);assert.doesNotMatch(brief,/<source>/);
  assert.match(brief,/href="#\/series\/payroll\?/);assert.match(brief,/CES job estimates can be revised/);
 }finally{Object.assign(current,before);}
});

test('Labor uncertainty heading does not assert that every retained payroll estimate is preliminary',()=>{
 const payroll=getSeries('payroll'),before=payroll.observations;
 try{
  payroll.observations=[{date:'2026-09-01',value:55,footnotes:[]}];
  const html=laborPage(state),heading=html.match(/data-page-disclosure="labor:uncertainty"[^]*?<\/summary>/)?.[0];
  assert.ok(heading);assert.doesNotMatch(heading,/Preliminary/i);
 }finally{payroll.observations=before;}
});

test('home shows actionable cross-checks and omits empty personal research while retaining populated research',()=>{
 const html=overviewPage(state);
 assert.match(html,/data-compare="gdp,privateDomesticDemandGrowth"/);
 assert.match(html,/data-compare="payroll,payrollAverage3m,weeklyHours"/);
 assert.doesNotMatch(html,/data-overview-disclosure="my-research"/);
 assert.match(overviewPage({...state,saved:['unrate']}),/data-overview-disclosure="my-research"/);
 assert.match(overviewPage(state,{changes:{status:'error',error:'Unavailable <retry>'}}),/Unavailable &lt;retry&gt;/);
});

test('home charts avoid repeated headline numerals while preview defaults and source warnings remain intact',()=>{
 const current=getSeries('pceCore'),before={...current};
 try{
  Object.assign(current,{observations:[{date:'2026-09-01',value:3.1}],error:'Unavailable <retry>'});
  const compact=seriesPreview('pceCore',state,{summary:false,definition:false});
  assert.doesNotMatch(compact,/class="workspace-preview-reading"/);
  assert.match(compact,/Percent year over year/);assert.match(compact,/Sep 2026/);
  assert.match(compact,/Unavailable &lt;retry&gt;/);
  assert.match(seriesPreview('pceCore',state),/class="workspace-preview-reading"/);
 }finally{Object.assign(current,before);}
});

test('Labor promotes native trends and keeps unavailable payroll release revisions distinct from captured history',()=>{
 const html=laborPage({...state,macroMeasure:'weeklyHours',window:'custom',startDate:'1900-01-01',endDate:'1900-02-01'});
 assert.match(html,/class="labor-headlines"/);assert.equal((html.match(/data-labor-reading=/g)??[]).length,4);assert.match(html,/Payroll revisions/);
 assert.match(html,/First-published payroll estimates are not covered/);
 assert.match(html,/href="#\/vintages\?series=payroll"/);
 assert.ok(html.indexOf('id="labor-trends"')<html.indexOf('id="labor-analysis"'));
 assert.match(html,/History unavailable/);assert.match(html,/id="macro-measure"/);
 assert.equal((html.match(/data-series-row=/g)??[]).length,23);
});

test('Labor payroll chart exposes the latest three-month average with its own reference period',()=>{
 const average=getSeries('payrollAverage3m'),before=average.observations;
 try{
  average.observations=[{date:'2026-09-01',value:55}];
  const html=laborPage({...state,window:'custom',startDate:'1900-01-01',endDate:'1900-02-01'});
  assert.match(html,/Latest 3-month average: 55k · Sep 2026/);
  assert.match(html,/href="#\/series\/payrollAverage3m\?/);
 }finally{average.observations=before;}
});
