import test from 'node:test';
import assert from 'node:assert/strict';
import * as calendar from '../src/calendar-presentation.js';
import {calendarScope} from '../src/calendar-scope.js';
import {nextCatalysts} from '../src/research-brief.js';
import {indicatorPage} from '../src/indicator-page.js';
import {overviewPage} from '../src/overview-page.js';
import {calendarPage} from '../src/calendar-page.js';
import {releases,dataStatus} from '../src/data.js';
import {defaults} from '../src/router.js';
import {getSeries} from '../src/model.js';
import * as changes from '../src/measurement-change.js';

const time=await import('../src/ui-time.js').catch(()=>({}));
const event={id:'cpi',sourceId:'bls',program:'consumer-price-index',seriesId:'cpi',seriesIds:['cpi'],
 date:'2026-10-15',scheduledAt:'2026-10-15T12:30:00Z',periodLabel:'September 2026'};

test('UI timestamps use Eastern time and date-only values never acquire an invented clock',()=>{
 assert.equal(typeof time.humanTimestamp,'function');
 assert.equal(time.humanTimestamp('2026-10-29T02:48:00Z',{prefix:'Updated '}),'Updated 10:48 pm ET, 28 Oct');
 assert.equal(time.humanTimestamp('2026-01-03T02:05:00Z'),'9:05 pm ET, 2 Jan');
 assert.equal(time.humanDate('2026-10-28'),'28 Oct 2026');
 assert.equal(time.humanTimestamp('2026-10-28'),'28 Oct 2026');
 assert.equal(time.humanTimestamp(null),'');
 assert.equal(time.humanTimestamp('not a date'),'');
 for(const value of [{toString:null},{},42,true]){
  assert.equal(time.humanTimestamp(value),'');
  assert.equal(time.humanDate(value),'');
 }
});

test('yield timing guidance uses the external arrow only on its external source link',()=>{
 const html=calendar.yieldTimingPanel();
 assert.doesNotMatch(html,/<a[^>]+href="#[^"]+"[^>]*>[^<]*↗/);
 assert.match(html,/href="https:[^"]+"[^>]*>[^<]*↗/);
 assert.doesNotMatch(html,/>CAPTURED TIMING|>CACHED TIMING|>TIMING UNAVAILABLE/);
});

test('payroll prior labels reserve month for adjacent monthly references and retain honest gap labels',()=>{
 assert.equal(typeof changes.priorReadingLabel,'function');
 const series={frequency:'Monthly',observations:[{date:'2025-12-01'},{date:'2026-01-01'}]};
 assert.equal(changes.priorReadingLabel(series),'Prior month');
 series.observations=[{date:'2025-11-01'},{date:'2026-01-01'}];
 assert.equal(changes.priorReadingLabel(series),'Prior retained reading');
 series.observations=[{date:'2026-01-01'}];
 assert.equal(changes.priorReadingLabel(series),'Prior retained reading');
});

test('a matching retained schedule remains separate from confirmed publication',()=>{
 assert.equal(typeof time.publicationDate,'function');
 const series={id:'cpi'},observation={date:'2026-09-01',value:2.4};
 assert.equal(time.publicationDate(series,observation,[event]),null);
 assert.equal(time.scheduledReleaseDate(series,observation,[event]),'2026-10-15');
 assert.equal(time.publicationDate(series,{...observation,publishedAt:'2026-10-14'},[event]),'2026-10-14');
 assert.equal(time.publicationDate(series,observation,[{...event,publicationDate:'2026-10-15'}]),'2026-10-15');
 assert.equal(time.scheduledReleaseDate(series,observation,[{...event,periodLabel:null}]),null);
 assert.equal(time.scheduledReleaseDate(series,{date:'2026-08-01'},[event]),null);
 assert.equal(time.scheduledReleaseDate({id:'unrate'},observation,[event]),null);
});

test('calendar previous values require a prior reference period known before the event',()=>{
 assert.equal(typeof calendar.calendarPrevious,'function');
 const current={id:'cpi',fetchedAt:'2026-10-20T12:00:00Z',observations:[
  {date:'2026-07-01',value:2.1,publishedAt:'2026-08-12'},
  {date:'2026-08-01',value:2.2,publishedAt:'2026-09-11'},
  {date:'2026-09-01',value:2.4,publishedAt:'2026-10-15'},
  {date:'2026-10-01',value:2.6,publishedAt:'2026-11-13'},
 ]};
 assert.deepEqual(calendar.calendarPrevious(event,{cpi:current})?.observation,{date:'2026-08-01',value:2.2,publishedAt:'2026-09-11'});
 current.observations[1].publishedAt='2026-10-16';
 assert.equal(calendar.calendarPrevious(event,{cpi:current})?.observation.date,'2026-07-01');
 current.observations=[{date:'2026-08-01',value:2.2}];
 assert.equal(calendar.calendarPrevious(event,{cpi:current}),null);
 current.fetchedAt='2026-10-14T12:00:00Z';
 assert.equal(calendar.calendarPrevious(event,{cpi:current})?.observation.date,'2026-08-01');
});

test('Treasury bills appear only in Treasury view and macro catalysts outrank routine events',()=>{
 const events=[
  {...event,id:'bill',sourceId:'treasury-auctions',program:'auction',securityType:'Bill',date:'2026-10-30'},
  {...event,id:'routine',sourceId:'other',program:'other',date:'2026-10-30'},
  {...event,id:'gdp',sourceId:'bea',program:'gdp',date:'2026-11-01',scheduledAt:null},
  {...event,id:'jobs',program:'employment-situation',date:'2026-11-02',scheduledAt:null},
 ];
 for(const row of events)row.scheduledAt=null;
 const now=new Date('2026-10-30T12:00:00Z'),state={...defaults,calendarView:'all',calendarMonth:'upcoming'};
 assert.deepEqual(calendarScope(state,{events,catalog:{},now}).filtered.map(row=>row.id),['routine','gdp','jobs']);
 assert.deepEqual(calendarScope({...state,calendarView:'treasury'},{events,catalog:{},now}).filtered.map(row=>row.id),['bill']);
 const linked=calendarScope({...state,eventId:'bill'},{events,catalog:{},now});
 assert.equal(linked.view,'treasury');
 assert.equal(linked.selected.id,'bill');
 assert.deepEqual(nextCatalysts(events,{now,limit:2}).map(row=>row.id),['gdp','jobs']);
});

test('indicator omits unsupported publication and moves retrieval methods below the reading',()=>{
 const current=getSeries('unrate'),saved=current.observations;
 try{
  current.observations=[{date:'2026-09-01',value:4.2}];
  const html=indicatorPage({...defaults,seriesId:'unrate',saved:[],selected:[]});
  const reading=html.match(/<section class="indicator-snapshot"[^]*?<\/section>/)?.[0]??'';
  assert.doesNotMatch(reading,/<dt>Published<\/dt>|Unknown|\d{4}-\d\d-\d\dT/);
  assert.ok(html.indexOf('About this data')>html.indexOf('indicator-chart'));
 }finally{current.observations=saved;}
});

test('Overview payroll shows the prior level and preserves the current reading without a carousel prompt',()=>{
 const current=getSeries('payroll'),saved=current.observations;
 try{
  current.observations=[{date:'2026-08-01',value:133},{date:'2026-09-01',value:29}];
  const html=overviewPage({...defaults,saved:[],selected:[]});
  const reading=html.match(/data-overview-reading="payroll"[^]*?<\/a>/)?.[0]??'';
  assert.match(reading,/>29k<\/strong>/);
  assert.match(reading,/Prior month: 133k/);
  assert.doesNotMatch(html,/Change in gains|Calculated measure|Scroll readings/);
  assert.doesNotMatch(html,/<a [^>]*href="#[^"]*"[^>]*>[^<]*↗/);
  assert.match(html,/<summary>About this data/);
  assert.match(html,/data-series="policyTargetLower,policyTargetUpper"/);
  assert.match(html,/<tr data-series="realSpendingMonthly"/);
 }finally{current.observations=saved;}
});

test('Calendar renders previous values with reference dates and omits absent timing and period prose',()=>{
 const current=getSeries('cpi'),saved=[...releases],observations=current.observations,status=dataStatus.calendar;
 try{
  releases.splice(0,releases.length,event);
  current.observations=[{date:'2026-08-01',value:2.2,publishedAt:'2026-09-11'}];
  dataStatus.calendar={sources:{bls:{status:'ok',fetchedAt:'2026-10-14T12:00:00Z'}},links:[]};
  let html=calendarPage({...defaults,calendarMonth:'2026-10',saved:[],selected:[]});
  assert.match(html,/<th[^>]*>Previous<\/th>/);
  assert.match(html,/data-previous-period="2026-08-01"/);
  assert.match(html,/calendar-previous" data-series="cpi"/);
  Object.assign(releases[0],{periodLabel:null,time:null,scheduledAt:null});
  html=calendarPage({...defaults,calendarMonth:'2026-10',saved:[],selected:[]});
  assert.doesNotMatch(html,/Observation period not supplied|Time not supplied/);
 }finally{releases.splice(0,releases.length,...saved);current.observations=observations;dataStatus.calendar=status;}
});
