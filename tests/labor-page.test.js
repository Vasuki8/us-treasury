import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPage} from '../src/pages.js';
import {parseRoute} from '../src/router.js';
import {series} from '../src/data.js';
import {formatValue,latest,periodLabel} from '../src/model.js';

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
 assert.ok(html.indexOf('id="labor-weekly"')<html.indexOf('id="labor-trends"'));
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
 const html=render(),desk=html.slice(html.indexOf('id="labor-weekly"'),html.indexOf('id="labor-trends"'));
 for(const id of ['claimsAdvance','continuedClaimsAdvance']){
  const s=series[id];for(const observation of s.observations)assert.ok(desk.includes(periodLabel(s,observation.date)));
  assert.ok(desk.includes(latest(s).publishedAt));assert.match(desk,new RegExp(`publicationSeries=${id}`));
  const row=html.match(new RegExp(`<tr[^>]*data-series-row="${id}"[\\s\\S]*?</tr>`))?.[0];assert.ok(row);assert.doesNotMatch(row,/<svg/);
 }
 assert.match(desk,/Same-release prior/);assert.match(desk,/day precision/);assert.match(desk,/Revised history ends/);
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
