import {humanTimestamp} from '../src/ui-time.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {macroCoveragePage} from '../src/macro-coverage-page.js';
import {macroPage} from '../src/macro-page.js';
import {creditContextPage} from '../src/credit-context-page.js';
import {currentAccountGdpPanel} from '../src/current-account-gdp-view.js';
import {creditContextGroups} from '../src/credit-context-registry.js';
import {escapeHtml} from '../src/ui.js';
import {coverageFamilies} from '../src/macro-registry.js';
import {getSeries,periodLabel} from '../src/model.js';
import {series,dataStatus} from '../src/data.js';
import {currentAccountGdpFixture} from './helpers/current-account-gdp-fixture.js';

function visible(html){
 let hidden=0,result='';
 for(const match of html.matchAll(/<\/?details\b[^>]*>|[^<]+|<(?!\/?details\b)[^>]*>/g)){
  const token=match[0];
  if(token.startsWith('<details')){if(hidden||! /\sopen(?:\s|>)/.test(token))hidden++;}
  else if(token.startsWith('</details')){if(hidden)hidden--;}
  else if(!hidden)result+=token;
 }
 return result;
}
function ordered(html,labels){html=html.toLowerCase();labels=labels.map(label=>label.toLowerCase());let prior=-1;for
  (const label of labels){const next=html.indexOf(label);assert.ok(next>prior,`${label} follows ${labels[labels.indexOf(label)-1]??'start'}`);prior=next;}}
const stamp='2026-10-20T12:00:00.123Z';
const gdpSource={status:'ok',fetchedAt:stamp,quarterly:[{date:'2026-04-01',total:2,consumption:1,investment:.5,government:.2,exports:.4,imports:-.1}],cpiCategoryEffects:{reason:'Exact CPI effects unavailable; no approximation.'}};

test('native economy families lead with compact readings and focused history before full coverage evidence',()=>{
 for(const familyId of ['prices','activity','housing','policy']){
  const family=coverageFamilies[familyId],html=macroCoveragePage({macroFamily:familyId}),lead=visible(html);
  assert.match(html,/<section class="reading-group" aria-label="LATEST TOPIC READINGS">/);
  if(familyId==='prices')ordered(html,['INFLATION · CURRENT READING &amp; HISTORY','data-chart','LATEST TOPIC READINGS',`data-page-disclosure="macro-coverage:${familyId}:research"`]);
  else ordered(html,['LATEST TOPIC READINGS','FOCUSED HISTORY',`data-page-disclosure="macro-coverage:${familyId}:research"`]);
  if(familyId==='prices'){assert.match(lead,/YEAR OVER YEAR/i);assert.match(lead,/3M ANNUALIZED/i);assert.match(lead,/6M ANNUALIZED/i);
  assert.equal((lead.match(/data-inflation-reading=/g)??[]).length,16);}
  for(const id of familyId==='prices'?[]:family.ids.slice(0,6)){const series=getSeries(id);assert.ok(lead.includes(series.unit),`${familyId}: ${series.unit}`);assert.ok(lead.includes(series.adjustment));const last=series.observations.at(-1);if(last)assert.ok(lead.includes(periodLabel(series,last.date)));}
  if(familyId!=='prices')assert.doesNotMatch(lead,/<table>/);
  assert.match(html,/SOURCE STATUS \/ FULL COVERAGE/i);
  assert.equal((html.match(/id="macro-measure"/g)??[]).length,1);
  assert.match(lead,/data-export-macro-measure/);
 }
});

test('focused history keeps invalid and empty window explanations visible',()=>{
 const invalid=visible(macroCoveragePage({macroFamily:'prices',window:'custom',startDate:'2026-10-01',endDate:'2025-01-01'}));
 assert.match(invalid,/role="alert"/);assert.match(invalid,/History unavailable/);
 const empty=visible(macroCoveragePage({macroFamily:'housing',window:'custom',startDate:'2099-01-01',endDate:'2099-12-01'}));
 assert.match(empty,/No source observation falls in this date window/);assert.match(empty,/History unavailable/);
});

test('GDP compact result retains native growth and contribution bases before accounting and history',()=>{
 const html=macroPage(gdpSource),lead=visible(html);
 assert.match(html,/<section class="reading-group" aria-label="LATEST GDP READINGS">/);
 ordered(html,['LATEST GDP READINGS','GDP: WHAT CHANGED','HISTORICAL REAL GDP','data-page-disclosure="macro:demand-detail"']);
 for(const label of ['2026 Q2','percent q/q annualized','percentage points','Sum of published contributions',
  'Headline minus contribution sum'])assert.ok(lead.includes(label),label);
 const bad=visible(macroPage({...gdpSource,status:'error',error:'Capture failed',quarterly:[{...gdpSource.quarterly[0],imports:9}]}));
 assert.match(bad,/Capture failed/);assert.match(bad,/GDP contribution data unavailable/);
 const incomplete=visible(macroPage({...gdpSource,quarterly:[{...gdpSource.quarterly[0],government:null}]}));
 assert.match(incomplete,/latest quarter has missing components/);assert.match(incomplete,/Unavailable/);
});

test('external ratio compacts both quarters while exact inputs and formula retain a stable disclosure',()=>{
 const html=currentAccountGdpPanel(currentAccountGdpFixture()),lead=visible(html);
 assert.match(html,/<section class="reading-group" aria-label="CURRENT ACCOUNT RATIO READINGS">/);
 assert.match(lead,/-3\.02%/);assert.match(lead,/exact preceding quarter/);assert.match(lead,/Percent of nominal GDP/);
 assert.doesNotMatch(lead,/<table>/);
 assert.match(html,/data-page-disclosure="current-account-gdp:inputs"/);assert.match(html,/100 ×/);assert.match(html,/GDP · SAAR ÷ 4/);
 for(const clock of ['2026-10-23T04:21:42.080Z','2026-10-23T02:56:31.625Z'])assert.ok(html.includes(humanTimestamp(clock)));
 assert.ok(html.includes('Publication dates and retrieval dates remain distinct'));
 assert.ok(lead.includes('not an exact GDP accounting component'));
 const missing=currentAccountGdpFixture();missing.bea.series.nominalGdp.observations=missing.bea.series.nominalGdp.observations.filter(row=>row.date!=='2026-04-01');missing.bea.error='GDP <failed>';missing.bea.status='error';
 const failure=visible(currentAccountGdpPanel(missing));assert.match(failure,/Unavailable/);assert.match(failure,/GDP &lt;failed&gt;/);assert.match(failure,/missing or nonfinite for 2026-04-01/);assert.doesNotMatch(failure,/-3\.02%/);
 const frozen=currentAccountGdpPanel(currentAccountGdpFixture(),{frozen:true});assert.match(frozen,/data-page-disclosure="current-account-gdp:frozen:inputs"/);assert.doesNotMatch(frozen,/data-export-current-account-gdp/);
});

test('credit groups retain separate readings, exact source periods, missing values and visible reuse notices',()=>{
 const sources={bankCredit:{status:'error',fetchedAt:stamp,error:'Source <failure>',series:{bankLoans:{observations:[{date:'2026-10-07',value:null}]}}},lendingSurvey:{status:'ok',fetchedAt:stamp,series:{ciStandardsLarge:{observations:[{date:'2026-07-01',sourcePeriodLabel:'2026-09-30',value:0}]}}}};
 const html=creditContextPage(sources,{documents:[]}),lead=visible(html);
 assert.equal((html.match(/class="panel workspace-analysis credit-evidence-group"/g)??[]).length,creditContextGroups.length,'Each source group keeps a separate evidence section');
 for(const group of creditContextGroups){assert.equal(html.split(`</span>${escapeHtml(group.label)}</h2>`).length-1,1,`${group.label} has one heading`);assert.match(html,new RegExp(`data-page-disclosure="credit:${group.id}:evidence"`));}
 const missingMetric=lead.split('href="#/series/bankLoans"')[1]?.split('</a>')[0]??'';
 const surveyMetric=lead.split('href="#/series/ciStandardsLarge"')[1]?.split('</a>')[0]??'';
 assert.match(missingMetric,/<strong class="metric-value">—<\/strong>/);
 assert.match(missingMetric,/<span class="metric-basis">USD trillions · Seasonally adjusted<\/span>/);
 assert.match(surveyMetric,/<strong class="metric-value">0%<\/strong>/);
 for(const text of ['Source &lt;failure&gt;','7 Oct 2026','2026-09-30','Net percent of domestic banks','USD billions',
  'Meridian is not affiliated','same permissions','no combined liquidity score'])assert.ok(lead.includes(text),text);
 assert.match(html,/data-page-disclosure="credit:lendingSurvey:evidence"/);
 assert.equal((html.match(/data-export-credit/g)??[]).length,1);
});

test('native topic errors remain visible even outside the compact reading selection',()=>{
 const id=coverageFamilies.activity.ids.at(-1),original=series[id];
 series[id]={...original,observations:[],dataStatus:'unavailable',error:'Independent activity source <failed>'};
 try{const lead=visible(macroCoveragePage({macroFamily:'activity'}));assert.match(lead,/Independent activity source &lt;failed&gt;/);}
 finally{series[id]=original;}
});

test('External Summary puts native history ahead of ratio context and defers verbose accounting evidence',()=>{
 const html=macroCoveragePage({macroFamily:'external',externalView:'summary'}),lead=visible(html),preChart=lead.slice(0,lead.indexOf('data-chart'));
 ordered(lead,['CURRENT ACCOUNT · ACCOUNTING CHANGES','FOCUSED HISTORY','data-chart','CURRENT ACCOUNT / NOMINAL GDP']);
 assert.match(html,/data-page-disclosure="current-account:accounting-evidence"/);
 assert.match(preChart,/USD billions/);assert.match(preChart,/not annualized/);assert.doesNotMatch(preChart,/Table release date:|Retrieved/);
 assert.match(preChart,/not causes|do not identify causes/);
 assert.doesNotMatch(preChart,/The four-component sum is|Source rounding can produce differences|GDP publication date|different retrieval vintages/);
 assert.match(html,/The four-component sum is/);assert.match(html,/Source rounding can produce differences/);
 const ratioLead=lead.slice(lead.toLowerCase().indexOf('current account / nominal gdp'));
 assert.doesNotMatch(ratioLead,/GDP publication date/);assert.match(ratioLead,/only GDP is divided by four/);
 assert.match(html,/data-page-disclosure="current-account-gdp:context-evidence"/);
 assert.doesNotMatch(ratioLead,/This compares the international balance with the size of domestic production/);
});

test('External Summary keeps independent source errors and clocks visible after compacting evidence',()=>{
 const originalIta=dataStatus.sources.beaIta,originalGdp=dataStatus.sources.bea,fixture=currentAccountGdpFixture();
 dataStatus.sources.beaIta={...fixture.beaIta,status:'error',error:'ITA <capture failed>'};
 dataStatus.sources.bea={...fixture.bea,status:'error',error:'GDP <capture failed>'};
 try{
  const html=macroCoveragePage({macroFamily:'external',externalView:'summary'}),lead=visible(html);
  for(const text of ['ITA &lt;capture failed&gt;','GDP &lt;capture failed&gt;','or a causal explanation'])assert.ok(lead.includes(text),text);
  assert.match(lead,/data-export-current-account/);assert.match(lead,/data-export-current-account-gdp/);
  for(const clock of ['2026-10-23T04:21:42.080Z','2026-10-23T02:56:31.625Z'])assert.ok(html.includes(humanTimestamp(clock)));
 }finally{dataStatus.sources.beaIta=originalIta;dataStatus.sources.bea=originalGdp;}
});
