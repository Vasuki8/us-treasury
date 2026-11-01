import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewPage} from '../src/overview-page.js';
import {laborPage} from '../src/labor-page.js';
import {indicatorPage} from '../src/indicator-page.js';
import {defaults} from '../src/router.js';
import {familyLedger,exactLevelGrowth,earningsAnnualSeries} from '../src/stitch-family-view.js';
import {series} from '../src/data.js';

const state=extra=>({...defaults,saved:[],selected:[],...extra});
const ordered=(html,markers)=>{let position=-1;for(const marker of markers){const next=html.indexOf(marker);assert.ok(next>position,marker);position=next;}};

test('Overview and Labor restore separate visible three-card reading guides before four headlines',()=>{
 const overview=overviewPage(state()),labor=laborPage(state());
 ordered(overview,['data-overview-guide','stitch-headline-grid','stitch-workstation','stitch-cross-checks','overview-system-monitor','stitch-provenance']);
 assert.equal((overview.match(/data-overview-guide-card=/g)??[]).length,3);
 assert.equal((overview.match(/class="oh-topic stitch-card"/g)??[]).length,4);
 ordered(labor,['data-labor-guide','class="labor-headlines"','class="labor-desk"','id="labor-weekly"','id="labor-analysis"','id="labor-readings"','id="labor-notes"']);
 assert.equal((labor.match(/data-labor-guide-card=/g)??[]).length,3);
 assert.equal((labor.match(/data-labor-reading=/g)??[]).length,4);
});

test('family ledgers join exact dates without falling back to latest peer values',()=>{
 const original=series.underemployment;
 series.underemployment={...original,observations:[{date:'2026-09-01',value:987.6}]};
 try{
  const html=familyLedger({...series.unrate,observations:[{date:'2026-08-01',value:4.2}]},'unemployment');
  assert.match(html,/data-family-input="underemployment">—<\/td>/);
  assert.doesNotMatch(html,/987\.6/);
 }finally{series.underemployment=original;}
});

test('earnings chart growth retains exact year-ago endpoints, missing inputs and source evidence',()=>{
 const input={...series.wages,id:'productionHourlyEarnings',source:{...series.wages.source,seriesIds:['CES0500000008']},observations:[{date:'2025-08-01',value:40},{date:'2026-07-01',value:42},{date:'2026-08-01',value:44,sourceSha256:'receipt'}]};
 const calculated=earningsAnnualSeries(input),last=calculated.observations.at(-1);
 assert.ok(Math.abs(last.value-10)<1e-12);
 assert.deepEqual(last.inputDates,['2026-08-01','2025-08-01']);
 assert.deepEqual(last.inputValues,[44,40]);
 assert.equal(last.sourceSha256,'receipt');
 assert.equal(calculated.observations[1].value,null);
 assert.equal(exactLevelGrowth({...input,observations:input.observations.filter(row=>row.date!=='2025-08-01')},12),null);
 assert.equal(exactLevelGrowth({...input,observations:[{date:'2025-08-01',value:0},{date:'2026-08-01',value:44}]},12),null);
});

test('all eight reference families show four KPI cards, a bespoke ledger and five related measures',()=>{
 for(const id of ['payroll','unrate','wages','eciCompensationQuarterly','laborProductivity','unitLaborCosts','cpi','pce']){
  const html=indicatorPage(state({page:'indicator',seriesId:id}));
  ordered(html,['class="indicator-snapshot"','class="indicator-chart"','data-family-analysis=','data-family-ledger=','class="indicator-related"','class="indicator-method-grid"']);
  const snapshot=html.slice(html.indexOf('class="indicator-snapshot"'),html.indexOf('class="indicator-chart"'));
  assert.equal((snapshot.match(/<article class="indicator-stat/g)??[]).length,4,id);
  assert.equal((html.match(/class="indicator-related-card"/g)??[]).length,5,id);
  assert.doesNotMatch(html,/<details[^>]*class="indicator-reading-context"/);
  for(const hook of ['data-export','data-add-compare=','id="transform-select"','role="tablist"','data-copy-link'])assert.ok(html.includes(hook),id+' '+hook);
  assert.match(html,/Local CSV export/);
  assert.doesNotMatch(html,/GET \/v1\/|import meridian|Certified|AUDIT ENGINE/);
 }
});

test('a focused source index retains its selected native reading inside the four-card family strip',()=>{
 const html=indicatorPage(state({page:'indicator',seriesId:'cpiIndex'})),snapshot=html.match(/<section class="indicator-snapshot"[^]*?<\/section>/)?.[0];
 assert.match(snapshot,/data-stat-series="cpiIndex"/);
 assert.equal((snapshot.match(/<article class="indicator-stat/g)??[]).length,4);
 assert.match(snapshot,/class="indicator-stat-unit">Index/);
});
