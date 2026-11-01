import test from 'node:test';
import assert from 'node:assert/strict';
import {laborPage} from '../src/labor-page.js';
import {indicatorPage} from '../src/indicator-page.js';
import {series} from '../src/data.js';
import {parseRoute} from '../src/router.js';

const state=hash=>({...parseRoute(hash),saved:[]});
const stats=html=>html.match(/<section class="indicator-snapshot"[^]*?<\/section>/)?.[0]??'';

test('Labor combines its guide and four headlines before the full retained research sections',()=>{
 const html=laborPage(state('#/economy/labor'));
 const headlines=html.slice(html.indexOf('aria-label="Latest headline indicators"'),html.indexOf('class="labor-revision-context"'));
 assert.match(html,/labor-reading-guide/);
 assert.equal((html.match(/data-labor-guide-card=/g)??[]).length,3);
 assert.equal((headlines.match(/class="labor-metric"/g)??[]).length,4);
 assert.doesNotMatch(headlines,/<svg|labor-spark/);
 assert.equal((html.match(/data-series-row=/g)??[]).length,23);
 for(const heading of ['Survey / code','Native unit','Ref period','Agency','Status'])assert.ok(html.includes(heading));
 assert.match(html,/class="labor-methodology-grid"[^]*?Establishment survey[^]*?Household survey/);
 assert.doesNotMatch(html,/<details[^>]*>\s*<summary[^>]*>[^<]*About this data/);
 const order=['labor-briefing','labor-revision-context','labor-uncertainty','id="labor-trends"','id="labor-weekly"','id="labor-analysis"','id="labor-readings"','id="labor-notes"'];
 for(let i=1;i<order.length;i++)assert.ok(html.indexOf(order[i])>html.indexOf(order[i-1]),order[i]);
 assert.doesNotMatch(html,/90% CI|119,000 businesses|629,000 worksites|ISO-8601 DATA|62\.8% of sampled/);
});

test('all eight reference indicator families show four visible readings before their chart and family analysis',()=>{
 for(const id of ['payroll','unrate','wages','eciCompensationQuarterly','laborProductivity','unitLaborCosts','cpi','pce']){
  const html=indicatorPage(state(`#/series/${id}?window=3y`));
  assert.equal((stats(html).match(/class="indicator-stat(?: |")/g)??[]).length,4,id);
  const selected=html.match(/<section class="indicator-snapshot"[^]*?<\/section>/)?.[0]??'';
  assert.equal((selected.match(/<article class="indicator-stat(?: |")/g)??[]).length,4,id);
  assert.match(selected,new RegExp(`data-stat-series="${id}"`));
  const order=['indicator-provenance-bar','indicator-stat-grid','class="indicator-chart"','indicator-context-grid','data-family-ledger=','indicator-related-grid','indicator-method-grid','Indicator detail sections'];
  for(let i=1;i<order.length;i++)assert.ok(html.indexOf(order[i])>html.indexOf(order[i-1]),`${id}: ${order[i]}`);
  for(const marker of ['data-save="'+id+'"','data-add-compare="'+id+'"','data-export','data-legend="true"','data-end-labels="true"'])assert.ok(html.includes(marker),`${id}: ${marker}`);
  assert.doesNotMatch(html,/api\.meridian|meridian-macro|Verified Ingestion|ISO-8601|90% CI|Response Time|Latency:/);
 }
 const payroll=indicatorPage(state('#/series/payroll'));
 for(const id of ['payrollLevel','payroll','payrollAverage3m'])assert.match(stats(payroll),new RegExp(`data-stat-series="${id}"`));
 assert.match(payroll,/CES supersector decomposition/);
 assert.match(payroll,/payrollSupersectorResidual/);
 assert.match(indicatorPage(state('#/series/unrate')),/Civilian labor force/);
});

test('wage source-input momentum uses exact month endpoints and never substitutes a missing input',()=>{
 const original=series.wages,level=series.hourlyEarnings,momentum=series.earningsAnnualized3m;
 if(level)series.hourlyEarnings={...level,observations:[]};
 if(momentum)series.earningsAnnualized3m={...momentum,observations:[]};
 series.wages={...original,observations:[
  {date:'2026-05-01',value:4,sourceValue:'40.00'},
  {date:'2026-07-01',value:4,sourceValue:'42.00'},
  {date:'2026-08-01',value:5,sourceValue:'44.00'},
 ]};
 try{
  let html=stats(indicatorPage(state('#/series/wages')));
  assert.match(html,/\$44\.00/);
  assert.match(html,/Monthly earnings growth: \+4\.76%/);
  assert.match(html,/3-month earnings momentum[^]*?\+46\.41%/);
  series.wages={...series.wages,observations:series.wages.observations.filter(row=>row.date!=='2026-05-01')};
  html=stats(indicatorPage(state('#/series/wages')));
  assert.match(html,/3-month earnings momentum[^]*?class="big-value">—<\/strong>/);
  series.wages={...series.wages,observations:series.wages.observations.map(row=>row.date==='2026-08-01'?{...row,sourceValue:''}:row)};
  html=stats(indicatorPage(state('#/series/wages')));
  assert.match(html,/Latest hourly earnings[^]*?class="big-value">—<\/strong>/);
  assert.match(html,/Monthly earnings growth: —/);
 }finally{series.wages=original;if(level)series.hourlyEarnings=level;if(momentum)series.earningsAnnualized3m=momentum;}
});

test('derived payroll and compensation annual growth require the exact year-ago level',()=>{
 for(const [id,path] of [['payrollLevel','payroll'],['eciCivilianCompensationNsa','eciCompensationQuarterly']]){
  const original=series[id],annual=series.eciCivilianCompensationAnnual;
  if(id==='eciCivilianCompensationNsa'&&annual)series.eciCivilianCompensationAnnual={...annual,observations:[]};
  series[id]={...(original??series.eciCompensation),id,observations:[{date:'2025-04-01',value:100},{date:'2026-04-01',value:110}]};
  try{
   assert.match(stats(indicatorPage(state(`#/series/${path}`))),/12-month[^]*?\+10\.00%/);
   series[id]={...series[id],observations:[{date:'2025-01-01',value:100},{date:'2026-04-01',value:110}]};
   assert.match(stats(indicatorPage(state(`#/series/${path}`))),/12-month[^]*?class="big-value">—<\/strong>/);
  }finally{if(original)series[id]=original;else delete series[id];if(annual)series.eciCivilianCompensationAnnual=annual;}
 }
});
