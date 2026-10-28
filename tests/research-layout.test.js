import test from 'node:test';
import assert from 'node:assert/strict';
import {indicatorPage} from '../src/indicator-page.js';
import {explorePage} from '../src/explore-page.js';
import {calendarPage} from '../src/calendar-page.js';
import {vintagesPage} from '../src/vintages-page.js';
import {watchlistPage} from '../src/watchlist-page.js';
import {researchPage} from '../src/research-page.js';
import {releasePage} from '../src/release-page.js';
import {defaults} from '../src/router.js';
import {getSeries} from '../src/model.js';
import {publicationArchive} from '../src/publication-archive.js';
import {createResearchPackage} from '../src/research-packages.js';

const state=overrides=>({...defaults,saved:[],...overrides});
// Native closed disclosures remove their descendants; open frozen analyses stay visible.
function visible(html){
 let hidden=0,result='';
 for(const {0:token} of html.matchAll(/<\/?details\b[^>]*>|[^<]+|<(?!\/?details\b)[^>]*>/g)){
  if(token.startsWith('<details')){if(hidden||! /\sopen(?:\s|>)/.test(token))hidden++;}
  else if(token.startsWith('</details')){if(hidden)hidden--;}
  else if(!hidden)result+=token;
 }
 return result;
}
const group=(html,label)=>{const result=html.match(new RegExp('<section class="reading-group" aria-label="'+label+'">([\\s\\S]*?)</section>'));assert.ok(result,`Missing named reading group: ${label}`);return result[1];};
const before=(html,first,second)=>assert.ok(html.indexOf(first)>=0&&html.indexOf(first)<html.indexOf(second),`${first} must precede ${second}`);

test('Indicator retains native reading and clocks beside its working history in every detail tab',()=>{
 for(const tab of ['data','methodology','revisions']){
  const html=indicatorPage(state({seriesId:'claims',tab}),{historyState:{status:'error',error:{message:'Archive failed'}}}),lead=visible(html);
  assert.match(html,/<div class="workspace-basis"><section class="indicator-snapshot"/);
  for(const text of ['Native unit','Published','Retrieved','independent of the selected history window','separate captures'])assert.ok(lead.includes(text),text);
  before(html,'id="transform-select"','data-page-disclosure="indicator:source:claims"');
  if(tab==='revisions')assert.match(lead,/data-retry-history/);
 }
});

test('Comparison groups measurement basis without hiding the controls, no-fill scope or recovery',()=>{
 const html=explorePage(state({exploreMode:'compare',selected:['unrate','claims'],comparison:'native'}));
 const basis=group(html,'Selected measurement basis');
 for(const id of ['unrate','claims'])assert.ok(basis.includes(getSeries(id).unit));
 assert.ok(basis.includes('Historical'));
 before(html,'id="comparison-select"','data-panel-id="unrate"');
 before(html,'data-panel-id="unrate"','data-page-disclosure="explore:comparison-details"');
 assert.match(visible(html),/DISPLAYED WINDOW[\s\S]*NO FILL/);
 const invalid=visible(explorePage(state({exploreMode:'compare',selected:['unrate'],comparison:'indexed'})));
 assert.match(invalid,/data-comparison-mode="native"/);assert.match(invalid,/data-comparison-mode="difference"/);
});

test('Calendar keeps filters and scope limitations together ahead of the working schedule',()=>{
 const html=calendarPage(state({calendarView:'all',calendarMonth:'upcoming'})),basis=group(html,'Schedule scope');
 for(const id of ['calendar-scope','calendar-month','calendar-day','calendar-topic','calendar-watch-only'])assert.ok(basis.includes(`id="${id}"`),id);
 assert.match(basis,/Individually announced auctions and issue\/settlement dates/);
 assert.match(basis,/later announcements are not covered/);
 before(html,'aria-label="Schedule scope"','id="calendar-selected-preview"');
 assert.match(visible(html),/data-reset-calendar/);
});

test('Retrieval controls expose the reconstruction boundary before loading and failed evidence',()=>{
 for(const status of ['loading','error']){
  const html=vintagesPage({vintageSeries:'gdp'},undefined,{status,error:{message:'History failed'}}),lead=visible(html),basis=group(html,'Retrieval cutoff &amp; scope');
  assert.match(basis,/id="vintage-cutoff"/);assert.match(basis,/id="vintage-series"/);
  assert.match(lead,/Supplemental module data and calendars are not reconstructed/);
  before(html,'Supplemental module data and calendars are not reconstructed','data-retry-history');
  assert.match(lead,/Later values are not substituted/);
 }
});

test('Watchlist puts each native unit with its latest value and keeps storage and update recovery open',()=>{
 const html=watchlistPage({saved:['gdp','unrate'],selected:['gdp'],storageAvailable:false},{changes:{status:'error',error:'History failed'}}),lead=visible(html);
 const readings=[...html.matchAll(/<td class="num" data-label="Latest value">([\s\S]*?)<\/td>/g)];
 assert.equal(readings.length,2);
 assert.ok(readings[0][1].includes(getSeries('gdp').unit));assert.ok(readings[1][1].includes(getSeries('unrate').unit));
 const basis=group(html,'Monitor scope');
 for(const text of ['id="watchlist-sort"','id="watchlist-group"','session only','data-retry-changes'])assert.ok(basis.includes(text),text);
 assert.match(lead,/data-add-compare="unrate"/);assert.match(lead,/data-watch-move="gdp"/);assert.match(lead,/data-save="gdp"/);
});

test('Frozen result basis is compact while original charts, exports and attachment order remain visible',async()=>{
 const pkg=await createResearchPackage({name:'Retained layout',state:{selected:['gdp'],range:1},context:{attachments:[{name:'First.csv',type:'text/csv',content:'value\n1'},{name:'Second.csv',type:'text/csv',content:'value\n2'}]}});
 const original=JSON.stringify(pkg),html=researchPage({researchView:'packages',packageId:pkg.id},{library:{packages:[pkg]}}),lead=visible(html);
 const basis=group(html,'Frozen result basis');
 for(const text of ['PINNED','WINDOW','VALUES','independent of the current snapshot'])assert.ok(basis.includes(text),text);
 for(const text of ['data-chart','data-package-json','data-package-csv','does not authenticate','Imported source claims remain unverified'])assert.ok(lead.includes(text),text);
 before(lead,'data-package-attachment="0"','data-package-attachment="1"');
 assert.equal(JSON.stringify(pkg),original,'Rendering never mutates retained inputs');
});

test('Saved research views retain editable and frozen scope with independent failed-publication recovery',()=>{
 for(const view of ['workspaces','packages','changes','publications']){
  const html=researchPage(state({researchView:view}),{library:{sessionOnly:true},changes:{status:'error',error:'History failed'},publicationState:{status:'error',error:'Publication failed'}}),lead=visible(html);
  assert.match(html,/class="workspace-analysis"/);assert.match(lead,/session-only/);assert.match(lead,/Research library views/);
  if(view==='changes')assert.match(lead,/data-retry-changes/);
  if(view==='publications')assert.match(lead,/data-retry-publications/);
 }
});

test('Release result groups published measurement basis and keeps clock and explanation failures independent',()=>{
 const row=publicationArchive.releases.find(item=>item.seriesId==='gdp');
 const html=releasePage({publicationSeries:'gdp',publicationPeriod:row.period,publicationCutoff:row.publicationDate},{archive:publicationArchive,explanationState:{status:'error',error:'Explanation failed'}}),lead=visible(html),basis=group(html,'Published result basis');
 assert.match(basis,/Verified official result/);assert.match(basis,/day precision/);assert.ok(basis.includes(row.adjustment));
 for(const text of ['Expected schedule','Verified publication','Evidence retrieved','data-retry-publication-explanations','RETURN TO CALENDAR','PUBLICATION HISTORY / CSV / FREEZE'])assert.ok(lead.includes(text),text);
 before(html,'VERIFIED OFFICIAL RESULT','AGENCY EXPLANATION');
});

test('Working result wrappers stay balanced so supporting actions remain within their page',()=>{
 const pages=[indicatorPage(state({seriesId:'unrate'})),explorePage(state({exploreMode:'compare'})),calendarPage(state()),vintagesPage({},undefined,{status:'loading'}),watchlistPage({saved:['unrate']}),researchPage({researchView:'workspaces'}),releasePage({publicationSeries:'gdp'})];
 for(const html of pages){
  const stack=[];
  for(const {0:tag,1:closing,2:name} of html.matchAll(/<(\/)?(div|section|details|nav|header)\b[^>]*>/g)){
   if(closing)assert.equal(stack.pop(),name,`Balanced ${tag}`);else stack.push(name);
  }
  assert.deepEqual(stack,[]);
 }
});
