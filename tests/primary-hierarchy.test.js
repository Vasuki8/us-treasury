import test from 'node:test';
import assert from 'node:assert/strict';
import {laborPage} from '../src/labor-page.js';
import {indicatorPage} from '../src/indicator-page.js';
import {calendarPage} from '../src/calendar-page.js';
import {explorePage} from '../src/explore-page.js';
import {macroCoveragePage} from '../src/macro-coverage-page.js';
import {defaults} from '../src/router.js';
import {getSeries} from '../src/model.js';
import {releases,dataStatus} from '../src/data.js';
const state=overrides=>({...defaults,saved:[],...overrides});
const count=(html,text)=>html.split(text).length-1;
function outsideDetails(html){
 let depth=0,result='';
 for(const token of html.matchAll(/<\/?details\b[^>]*>|[^<]+|<(?!\/?details\b)[^>]*>/g)){
  const part=token[0];
  if(part.startsWith('<details')){if(depth||!/\sopen(?:\s|>)/.test(part))depth++;}
  else if(part.startsWith('</details')){if(depth)depth--;}
  else if(!depth)result+=part;
 }
 return result;
}

test('Labor focus has one CSV and data action while retaining weekly distinctions and supporting source access',()=>{
 const html=laborPage(state({macroMeasure:'unrate'}));
 assert.equal(count(html,'data-export-macro-measure'),1);
 const focus=html.match(/<section class="labor-history"[^]*?<\/section>/)?.[0]??'';
 assert.ok(focus);
 assert.equal(count(focus,'Details &amp; data table'),1);
 assert.doesNotMatch(focus,/Inspect data/);
 assert.match(focus,/data-page-disclosure="labor:definition:unrate"/);
 assert.match(focus,/Methodology &amp; source notes/);
 assert.match(html,/Same-release prior/);assert.match(html,/not spliced/);
 assert.ok(html.indexOf('id="labor-weekly"')<html.indexOf('class="labor-history"'));
});

test('Indicator keeps its one definition and critical caveats by the reading with secondary source metadata below history',()=>{
 const current=getSeries('claims'),html=indicatorPage(state({seriesId:'claims',tab:'data'}));
 const escaped=current.definition.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 assert.equal(count(html,escaped),1);
 assert.match(outsideDetails(html),/Revised history and latest release context have separate captures/);
 assert.match(html,/data-page-disclosure="indicator:source:claims"/);
 assert.ok(html.indexOf('id="transform-select"')<html.indexOf('data-page-disclosure="indicator:source:claims"'));
 assert.match(html,/data-export/);assert.match(html,/data-tab="revisions"/);
});

test('Calendar selected event gives its source retrieval one home and keeps schedule uncertainty visible',()=>{
 const saved=[...releases],prior=dataStatus.calendar;
 const stamp='2026-10-20T12:34:56Z';
 releases.splice(0,releases.length,{id:'hierarchy-claims',sourceId:'dol',program:'weekly-claims',name:'Weekly claims',agency:'DOL',topic:'Labor',seriesId:'claimsAdvance',seriesIds:['claimsAdvance'],date:'2026-11-05',time:'08:30',scheduledAt:'2026-11-05T13:30:00Z',periodLabel:'Week ended Oct 31, 2026',scheduleBasis:'recurring-rule',sourceUrl:'https://www.dol.gov/ui/data.pdf'});
 dataStatus.calendar={status:'partial',sources:{dol:{status:'error',fetchedAt:stamp,error:'HTTP 503 <retry>'}}};
 try{
  const html=calendarPage(state({calendarMonth:'2026-11',eventId:'hierarchy-claims'}));
  const preview=html.slice(html.indexOf('id="calendar-selected-preview"'),html.indexOf('data-page-disclosure="calendar:context"'));
  assert.equal(count(preview,'8:34 am ET, 20 Oct'),1);
  assert.match(preview,/data-page-disclosure="calendar:event:hierarchy-claims:basis"/);
  assert.match(outsideDetails(preview),/HTTP 503 &lt;retry&gt;/);
  assert.match(outsideDetails(preview),/past scheduled time does not establish/);
  assert.match(preview,/data-save="claimsAdvance"/);
 }finally{releases.splice(0,releases.length,...saved);dataStatus.calendar=prior;}
});

test('Explore comparison leads with charts, one export action and visible no-fill context before supporting configuration',()=>{
 const html=explorePage(state({exploreMode:'compare',selected:['unrate','claims'],comparison:'native'}));
 assert.equal(count(html,'data-export'),1);
 assert.equal(count(html,'data-remove="unrate"'),1);
 const supporting=html.indexOf('data-page-disclosure="explore:comparison-details"');
 assert.ok(supporting>html.indexOf('data-panel-id="unrate"'));
 assert.match(outsideDetails(html),/NO FILL/);
 const coverage=getSeries('claims').coverageNote;
 assert.ok(coverage);
 assert.ok(outsideDetails(html).includes(coverage.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')),'the complete captured claims coverage stays visible before supporting details');
 assert.match(html,/id="comparison-select"/);assert.match(html,/id="window-start"/);
});

test('Macro readings and history lead supporting research while external accounting sections remain intact',()=>{
 const html=macroCoveragePage(state({macroFamily:'prices'}));
 const focused=html.indexOf('class="panel workspace-analysis"'),chart=html.indexOf('data-chart');
 const readings=html.indexOf('aria-label="LATEST TOPIC READINGS"');
 assert.ok(focused>=0&&focused<chart&&chart<readings,'Inflation current reading and principal chart precede the full horizon readings');
 assert.match(html,/data-page-disclosure="macro-coverage:prices:research"/);
 assert.ok(readings<html.indexOf('data-page-disclosure="macro-coverage:prices:research"'));
 assert.match(outsideDetails(html),/data-series="cpiMonthly"/);assert.match(html,/data-page-disclosure="macro-coverage:prices:history-controls"/);
 assert.match(outsideDetails(html),/WHAT CHANGED/);
 assert.equal(count(html,'WHAT CHANGED'),1);
 assert.match(html,/id="macro-measure"/);assert.match(html,/data-export-macro-measure/);
 const external=macroCoveragePage(state({macroFamily:'external',externalView:'methods'}));
 for(const label of ['Summary','Trends','Decomposition','Data &amp; methods','not annualized','not causal']){
  assert.ok(external.includes(label),label);
 }
 const summary=macroCoveragePage(state({macroFamily:'external',externalView:'summary'})),visible=outsideDetails(summary);
 assert.match(visible,/<td class="num">-?\$[\d,.]+B<\/td>/);
 assert.match(visible,/USD billions[^<]*not annualized/);
 assert.match(visible,/accounting arithmetic; they do not identify causes or market surprises/);
 assert.match(visible,/not an exact GDP accounting component or a causal explanation/);
 assert.match(visible,/<strong class="metric-value">-?[\d.]+%<\/strong>/);
 for(const key of ['current-account:accounting-evidence','current-account-gdp:context-evidence']){
  const disclosure=summary.match(new RegExp(`<details[^>]*data-page-disclosure="${key}"[^>]*>`))?.[0];
  assert.ok(disclosure,key);assert.doesNotMatch(disclosure,/\sopen(?:\s|>)/);
  assert.ok(summary.indexOf(disclosure)>summary.indexOf('<td class="num">'));
 }
});
