import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewPage} from '../src/overview-page.js';
import {getSeries,periodLabel} from '../src/model.js';
import {formatDisplayValue} from '../src/display-format.js';
import {pceHorizonChartCatalog} from '../src/dashboard-chart-data.js';
import {releases} from '../src/data.js';
import {defaults} from '../src/router.js';

const render=(context={})=>overviewPage({...defaults,saved:[],selected:[]},{now:new Date('2026-11-01T12:00:00Z'),...context});
const briefing=(html,id)=>html.match(new RegExp(`data-overview-brief="${id}"[^]*?</article>`))?.[0];

test('Stitch Overview combines briefing context with headlines and retains its workstation, diagnostics and provenance',()=>{
 const html=render();
 for(const [pattern,count] of [[/data-overview-brief=/g,3],[/class="oh-topic stitch-card"/g,4],[/class="stitch-feed"/g,4],[/class="stitch-card stitch-cross-card"/g,3],[/class="stitch-stat-row"/g,9],[/class="workspace-monitor-row"/g,4]])assert.equal((html.match(pattern)??[]).length,count,String(pattern));
 let position=-1;
 for(const marker of ['stitch-overview-header','stitch-headline-grid','stitch-workstation','stitch-cross-checks','overview-system-monitor','stitch-provenance','class="oh-support"']){
  const next=html.indexOf(marker);assert.ok(next>position,marker);position=next;
 }
 const provenance=html.slice(html.indexOf('class="stitch-provenance-grid"'),html.indexOf('class="oh-support"'));
 assert.equal((provenance.match(/<section>/g)??[]).length,3);
 for(const action of ['data-overview-follow','data-overview-export','data-research-actions'])assert.ok(html.includes(action),action);
 assert.doesNotMatch(html,/BEA Verified|BLS Survey Impact|All series current|MERIDIAN AUDIT ENGINE|GET \/v1\/overview|Consensus:|FRED-API|\bLIVE\b|weather and aerospace|services momentum/);
});

test('expanded briefings use actual latest and prior reference values plus calculated PCE endpoints',()=>{
 const html=render();
 for(const id of ['gdp','pceCore','payroll']){
  const current=getSeries(id),card=briefing(html,id);assert.ok(card);
  for(const row of current.observations.slice(-2)){
   assert.ok(card.includes(formatDisplayValue(current,row.value)),id+' reading');
   assert.ok(card.includes(periodLabel(current,row.date)),id+' reference period');
  }
  assert.ok(card.includes(current.code.replaceAll('&','&amp;')),id+' source identifier');
  assert.match(card,/Retained observation/);
 }
 const oneMonth=pceHorizonChartCatalog()['pce-horizons'].catalog.corePce1m;
 for(const row of oneMonth.observations.slice(-2))assert.ok(briefing(html,'pceCore').includes(formatDisplayValue(oneMonth,row.value)));
 assert.match(briefing(html,'payroll'),/original payroll vintages are not covered/);
 assert.match(html,/2% longer-run objective applies to annual headline PCE inflation/);
});

test('unavailable readings and schedule slots remain explicit without earlier-value substitution',()=>{
 const current=getSeries('payroll'),saved={observations:current.observations,dataStatus:current.dataStatus,error:current.error},events=[...releases];
 try{
  current.observations=[{date:'2026-08-01',value:987},{date:'2026-09-01',value:null,footnotes:['Withheld <estimate>']}];
  current.dataStatus='unavailable';current.error='<unsafe> feed unavailable';releases.splice(0,releases.length);
  const html=render(),card=briefing(html,'payroll');
  assert.match(card,/reading-value">—<\/strong>/);assert.match(card,/Sep 2026/);assert.match(card,/Prior month: 987k/);assert.match(card,/Prior reference: Aug 2026/);
  assert.match(card,/Unavailable/);assert.match(card,/&lt;unsafe&gt; feed unavailable/);assert.match(card,/Withheld &lt;estimate&gt;/);
  assert.doesNotMatch(html,/<unsafe>|<estimate>/);
  assert.equal((html.match(/class="stitch-agenda-unavailable"/g)??[]).length,5);
  assert.doesNotMatch(html,/class="oh-event"/);
 }finally{Object.assign(current,saved);releases.splice(0,releases.length,...events);}
});

test('Stitch charts keep independent ranges and exact source series while the extra measurement picker stays in support',()=>{
 const html=render({overviewChartSettings:{growth:'5y',inflation:'3y',inflationFamily:'headline'}});
 const main=html.slice(html.indexOf('class="stitch-workstation"'),html.indexOf('class="overview-cross-checks'));
 assert.match(main,/data-series="gdp,privateDomesticDemandGrowth" data-kind="combo"/);
 assert.match(main,/data-chart-catalog="pce-horizons"[^]*?data-series="headlinePceYoy,headlinePce3m,headlinePce1m"/);
 assert.match(main,/data-dashboard-range="growth" data-preset="5y" aria-pressed="true"/);
 assert.match(main,/data-dashboard-range="inflation" data-preset="3y" aria-pressed="true"/);
 assert.doesNotMatch(main,/id="overview-trend"/);
 const picker=html.slice(html.indexOf('data-overview-disclosure="chart-measurement"'));
 assert.match(picker,/id="overview-trend" data-workspace-series/);
 assert.equal((picker.match(/<option value=/g)??[]).length,8);
});
