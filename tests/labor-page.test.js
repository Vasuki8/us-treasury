import {humanDate} from '../src/ui-time.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPage} from '../src/pages.js';
import {parseRoute,routeFor} from '../src/router.js';
import {series} from '../src/data.js';
import {formatValue,latest,periodLabel,transformSeries} from '../src/model.js';
import {rangeControls} from '../src/research-controls.js';

const render=(query='',overrides={})=>renderPage({...parseRoute('#/economy?family=labor'+query),saved:[],laborGroup:'all',...overrides});
const rowIds=html=>[...html.matchAll(/data-series-row="([^"]+)"/g)].map(match=>match[1]);
const ordered=['payroll','payrollAverage3m','payrollLevel','weeklyHours','openings','hiresRate','quitsRate','layoffsRate','unrate','underemployment','participation','employmentPopulation','primeAgeParticipation','primeAgeEmploymentPopulation','wages','eciCompensationQuarterly','eciCompensation','laborProductivity','unitLaborCosts','claimsAdvance','continuedClaimsAdvance','claims','continuedClaims'];

test('Labor Radar presents all 23 readings in domain-reviewed order with accessible actions',()=>{
 const html=render();
 assert.match(html,/class="labor-radar/);
 assert.deepEqual(rowIds(html),ordered);
 assert.equal((html.match(/class="labor-group-heading"/g)??[]).length,4);
 for(const id of ordered){assert.match(html,new RegExp(`data-save="${id}"`));assert.match(html,new RegExp(`data-select="${id}"`));assert.ok(html.includes(periodLabel(series[id],latest(series[id])?.date)));}
 assert.match(html,/id="macro-measure"/);assert.match(html,/value="underemployment" selected/);
 for(const id of ['analysis','weekly','trends','readings','notes'])assert.match(html,new RegExp(`data-labor-section="labor-${id}"`));
 assert.ok(html.indexOf('id="labor-trends"')<html.indexOf('id="labor-weekly"'));
 assert.ok(html.indexOf('id="labor-weekly"')<html.indexOf('id="labor-analysis"'));
 assert.match(html,/data-compare="unrate,underemployment,participation"/);
 assert.match(html,/data-compare="payroll,payrollAverage3m,weeklyHours"/);
 assert.match(html,/data-compare="hiresRate,quitsRate,layoffsRate"/);
 assert.match(html,/Latest readings.*selected history window/i);
});

test('Labor table filters groups and names/source codes without altering the full focus selector',()=>{
 assert.deepEqual(rowIds(render('',{laborGroup:'pay'})),['wages','eciCompensationQuarterly','eciCompensation','laborProductivity','unitLaborCosts']);
 const html=render('',{query:series.hiresRate.code});assert.deepEqual(rowIds(html),['hiresRate']);
 assert.match(html,/id="labor-query"/);assert.match(html,/data-labor-group="jobs"/);
 assert.match(html,/value="continuedClaimsAdvance"/);
 assert.match(render('',{query:'<no such reading>'}),/No matching labor measures/);
});

test('focused history preserves exact windows, empty errors and live latest summaries',()=>{
 const html=render('&measure=weeklyHours&window=custom&start=1900-01-01&end=1900-01-31');
 assert.match(html,/History unavailable/);assert.match(html,/data-export-macro-measure[^>]*disabled/);
 assert.ok(html.includes(formatValue(series.payroll,latest(series.payroll)?.value)));
 assert.match(html,/id="window-start"/);assert.equal((html.match(/id="window-start"/g)??[]).length,1);
 const invalid=render('&window=custom&start=2026-10-01&end=2026-09-01');assert.match(invalid,/role="alert"/);
 assert.match(render('&measure=payroll&window=3y'),/data-kind="bar"/);
 assert.match(render('&measure=weeklyHours&window=3y'),/value="weeklyHours" selected/);
});

test('weekly desk keeps own weeks and same-release priors distinct from revised history',()=>{
 const html=render(),desk=html.slice(html.indexOf('id="labor-weekly"'),html.indexOf('id="labor-analysis"'));
 for(const id of ['claimsAdvance','continuedClaimsAdvance']){
  const s=series[id];for(const observation of s.observations)assert.ok(desk.includes(periodLabel(s,observation.date)));
  assert.ok(desk.includes(humanDate(latest(s).publishedAt)));assert.match(desk,new RegExp(`publicationSeries=${id}`));
  const row=html.match(new RegExp(`<tr[^>]*data-series-row="${id}"[\\s\\S]*?</tr>`))?.[0];assert.ok(row);assert.doesNotMatch(row,/<svg/);
 }
 assert.match(desk,/Same-release prior/);assert.match(desk,/Published/);assert.match(desk,/Revised history ends/);
 assert.match(desk,/not spliced/);assert.match(desk,/Prior previously published/);
});

test('measurement kind, cached freshness, unavailable values and growth horizons remain explicit',()=>{
 const prior=series.eciCompensationQuarterly;
 series.eciCompensationQuarterly={...prior,dataStatus:'cached',error:'Source failed <retry>'};
 try{const html=render();assert.match(html,/Calculated.*Cached/s);assert.match(html,/Source failed &lt;retry&gt;/);assert.match(html,/quarter over quarter.*not annualized/i);assert.match(html,/Percent q\/q annualized/);assert.match(html,/Change in monthly job gains/);assert.match(html,/Change in annual wage growth/);}
 finally{series.eciCompensationQuarterly=prior;}
 const missing=series.underemployment;series.underemployment={...missing,observations:[],dataStatus:'unavailable',error:'Unavailable <source>'};
 try{const html=render();assert.match(html,/Unavailable &lt;source&gt;/);assert.match(html,/History unavailable/);}
 finally{series.underemployment=missing;}
});

test('core charts share quarterly and weekly focus dates for calendar presets and observation counts',()=>{
 const ids=['eciCompensation','claimsAdvance','payroll','unrate'],priors=Object.fromEntries(ids.map(id=>[id,series[id]]));
 series.eciCompensation={...series.eciCompensation,observations:[{date:'2025-04-01',value:168},{date:'2026-04-01',value:175}]};
 series.claimsAdvance={...series.claimsAdvance,observations:[{date:'2026-10-10',value:200},{date:'2026-10-17',value:194}]};
 for(const id of ['payroll','unrate'])series[id]={...series[id],observations:[{date:'2025-04-01',value:1},{date:'2026-04-01',value:2},{date:'2026-09-01',value:3}]};
 try{
  for(const [focus,windowQuery,start,end] of [
   ['eciCompensation','&window=1y','2025-04-01','2026-04-01'],
   ['eciCompensation','&window=all','2025-04-01','2026-04-01'],
   ['eciCompensation','&range=6','2025-04-01','2026-04-01'],
   ['claimsAdvance','&window=1y','2025-10-17','2026-10-17'],
   ['claimsAdvance','&range=6','2026-10-10','2026-10-17'],
  ]){
  const html=render('&measure='+focus+windowQuery);
  const windows=[...html.matchAll(/data-chart data-series="([^"]+)"[^>]*data-range="([^"]+)"/g)].map(([,id,encoded])=>({id,...transformSeries(series[id],'level',JSON.parse(encoded.replaceAll('&quot;','"')))}));
  assert.deepEqual(windows.map(({id,window,observations})=>[id,window.mode==='calendar'?window.startDate:observations[0]?.date,window.mode==='calendar'?window.endDate:observations.at(-1)?.date]),[
   ['payroll',start,end],['unrate',start,end],[focus,start,end],
  ]);
  }
 }finally{for(const id of ids)series[id]=priors[id];}
});

test('focused methodology link opens methodology and preserves the exact Labor return context',()=>{
 const state={...parseRoute('#/economy/labor?measure=eciCompensation&window=custom&start=2025-04-01&end=2026-04-01'),saved:[]};
 const html=renderPage(state),href=html.match(/href="([^"]+)">Methodology &amp; source notes<\/a>/)?.[1];
 assert.ok(href);const target=parseRoute(href.replaceAll('&amp;','&'));
 assert.equal(target.page,'indicator');assert.equal(target.seriesId,'eciCompensation');assert.equal(target.tab,'methodology');
 assert.equal(target.returnTo,routeFor(state));assert.equal(target.window,'custom');assert.equal(target.startDate,'2025-04-01');assert.equal(target.endDate,'2026-04-01');
});

test('Labor observation-count controls explain the shared focused dates while other workspaces keep independent counts',()=>{
 const html=render('&range=6');
 assert.match(html,/Observation count applies to the focused measure; core trends share its displayed start and end dates\./);
 assert.doesNotMatch(html,/Each series uses its own observation count/);
 assert.match(rangeControls({window:'observations',range:6},['payroll','unrate']),/Each series uses its own observation count/);
});

test('Labor shows preliminary and sampling context beside headlines and working real earnings and breadth evidence',()=>{
 const html=render();
 assert.ok(html.indexOf('Labor estimate uncertainty')>html.indexOf('Latest headline indicators'));
 assert.ok(html.indexOf('Labor estimate uncertainty')<html.indexOf('id="labor-analysis"'));
 assert.match(html,/Preliminary payroll estimate/);assert.match(html,/difference between two monthly job gains/);
 assert.match(html,/Real earnings &amp; employment breadth/);assert.match(html,/data-export-economic-evidence="laborEvidence"/);
 assert.match(html,/Private employment diffusion/);assert.match(html,/CPI-U/);
});
