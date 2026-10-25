import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {snapshot as official} from '../src/official-snapshot.js';
import {loadSnapshotHistory} from '../scripts/snapshot-storage.mjs';
import {asKnownOn} from '../src/vintages.js';
import {registry} from '../src/registry.js';
import {getFreshness} from '../src/freshness.js';
import {OfficialSourceHttpError} from '../scripts/sources/http.mjs';
import {refreshSnapshot,canPublishCachedBlsData,canPublishCachedBls} from '../scripts/sources/refresh.mjs';
import {getDailyRefreshPlan} from '../scripts/check-refresh-due.mjs';
import {getWorkflowRefreshPlan} from '../scripts/check-release-refresh.mjs';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {NYFED_BLS_CALENDAR_TITLE,NYFED_BLS_CALENDAR_TERMS,NYFED_BLS_CALENDAR_MODIFICATION_NOTICE,NYFED_BLS_CALENDAR_SOURCE_NOTICE,nyFedBlsCalendarAttribution} from '../scripts/bls-alternate-policy.mjs';

const endpoint='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const attempt='2026-10-24T23:42:00.000Z',now=new Date('2026-10-25T00:17:00.000Z');
const unavailable=(status=503,url=endpoint,extra={})=>new OfficialSourceHttpError(status,url,extra);
const failure=()=>({kind:'http',status:503,requestedUrl:endpoint,url:endpoint,redirected:false});
// Last-good BLS capture at the fixed test clock; later live refreshes remain future captures.
const priorBlsAt='2026-10-24T00:05:02.137Z';
const blsHistory=await loadSnapshotHistory({vintageArchive:{version:1,captures:official.vintageArchive.captures.filter(row=>row.sourceId==='bls'&&row.capturedAt<=priorBlsAt)}},{directory:fileURLToPath(new URL('../src/',import.meta.url))});
const pinnedBls=asKnownOn(blsHistory,priorBlsAt).sources.bls;
const priorBls=()=>structuredClone(pinnedBls);
const cachedBls=()=>({...priorBls(),status:'error',lastAttemptAt:attempt,error:'Official source HTTP 503 (api.bls.gov)',failure:failure()});
const receipt=url=>({url,sha256:'a'.repeat(64),retrievedAt:attempt,lastModified:null});
const index='https://www.newyorkfed.org/research/calendars/nationalecon_cal.html',november='https://www.newyorkfed.org/research/calendars/i-nov26.html',december='https://www.newyorkfed.org/research/calendars/i-dec26.html';
function nyfed({full=false}={}){
 const events=[{id:'bls-employment-situation-2026-11-06',sourceId:'bls',provider:'new-york-fed',program:'employment-situation',seriesId:'unrate',seriesIds:['unrate','payroll','participation','wages'],name:'Employment Situation',agency:'BLS',topic:'Labor',date:'2026-11-06',time:'08:30',scheduledAt:'2026-11-06T13:30:00.000Z',period:null,periodLabel:null,sourceUrl:november,sourceUid:null,scheduleBasis:'secondary-calendar'}];
 if(full)events.push({...events[0],id:'bls-employment-situation-2026-12-04',date:'2026-12-04',scheduledAt:'2026-12-04T13:30:00.000Z',sourceUrl:december});
 return {id:'bls',provider:'new-york-fed',agency:'BLS · calendar via New York Fed',sourceTitle:NYFED_BLS_CALENDAR_TITLE,termsUrl:NYFED_BLS_CALENDAR_TERMS,licenseUrl:NYFED_BLS_CALENDAR_TERMS,attribution:nyFedBlsCalendarAttribution(2026),modificationNotice:NYFED_BLS_CALENDAR_MODIFICATION_NOTICE,sourceNotice:NYFED_BLS_CALENDAR_SOURCE_NOTICE,fetchedAt:attempt,indexMonth:'2026-10',coveredMonths:full?['2026-10','2026-11','2026-12']:['2026-10','2026-11'],unavailableMonths:full?[]:['2026-12'],coverageStart:'2026-10-01',coverageEnd:full?'2026-12-31':'2026-11-30',coverageNote:'Listed BLS release dates; reference periods are not supplied.',provenance:[receipt(index),receipt(november),...(full?[receipt(december)]:[])],events,warnings:[]};
}
function legacyCalendar(){
 const url='https://www.bls.gov/schedule/2026/home.htm',fetchedAt='2026-10-24T00:05:02.137Z';
 return {id:'bls',agency:'U.S. Bureau of Labor Statistics',status:'ok',fetchedAt,coveredYears:[2026],provenance:[{url,sha256:'b'.repeat(64),retrievedAt:fetchedAt,lastModified:null}],warnings:[],events:[{id:'bls-consumer-price-index-2026-11-10',sourceId:'bls',program:'consumer-price-index',seriesId:'cpi',seriesIds:['cpi'],topic:'Inflation',name:'Consumer Price Index',date:'2026-11-10',time:'08:30',scheduledAt:'2026-11-10T13:30:00.000Z',sourceUrl:url}]};
}
function beaCapture(fetchedAt){const result=structuredClone(official.sources.bea);result.fetchedAt=fetchedAt;result.provenance.forEach(receipt=>{receipt.retrievedAt=fetchedAt;});for(const series of Object.values(result.series))if(Object.hasOwn(series,'fetchedAt'))series.fetchedAt=fetchedAt;return result;}
function previous(){return {sources:{bls:priorBls(),bea:beaCapture('2026-10-24T12:00:00.000Z')},calendar:{sources:{bls:legacyCalendar()}}};}
const freshBea=()=>beaCapture(attempt);
function completedDaily(){
 const value={sources:{},calendar:{sources:{}},releases:[],publicationPolicy:{mode:'allow-cached-bls-data',cachedDataSources:['bls'],cachedCalendarSources:[]}};
 for(const entry of getFreshness({}, {now}).entries){const [kind,id]=entry.id.split(':');(kind==='data'?value.sources:value.calendar.sources)[id]={status:'ok',fetchedAt:attempt,lastAttemptAt:attempt,error:null,failure:null};}
 value.sources.bls=cachedBls();return value;
}

test('the cached-statistics exception admits the actual reviewed complete last-good BLS capture only',()=>{
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:priorBls()}}));
 assert.equal(canPublishCachedBlsData(cachedBls(),now),true);
 for(const [id,metadata]of Object.entries(registry))if(metadata.agency==='bls'){const source=cachedBls();delete source.series[id];assert.equal(canPublishCachedBlsData(source,now),false,id);}
 for(const mutate of [
  source=>{source.id='bea';},source=>{source.status='ok';},source=>{source.status='unavailable';},source=>{source.failure=null;},source=>{source.failure.kind='parser';},source=>{source.failure.status=403;},source=>{source.failure.redirected=true;},source=>{source.failure.url=endpoint+'?other=1';},source=>{source.failure.requestedUrl=endpoint.replace('/v1/','/v2/');},source=>{source.fetchedAt='invalid';},source=>{source.fetchedAt='2026-02-30T12:00:00.000Z';},source=>{source.fetchedAt='2026-10-25T00:17:00.001Z';},source=>{source.provenance=[];},source=>{source.provenance[0].sha256='bad';},source=>{source.provenance[0].url=endpoint+'?key=anything';},source=>{source.provenance[0].retrievedAt='invalid';},source=>{source.provenance[0].retrievedAt='2026-10-25T00:17:00.001Z';},source=>{source.provenance[0].retrievedAt='2026-10-23T00:00:00.000Z';},source=>{source.series.unrate.sourceIds=['WRONG'];},source=>{source.series.unrate.observations[0].value=Infinity;},source=>{source.series.unrate.observations[0].date='2026-02-30';},source=>{source.series.unrate.observations.push(source.series.unrate.observations[0]);},source=>{source.series.unrate.observations.forEach(row=>{row.value=null;});},source=>{source.series.payrollAverage3m.observations.at(-1).value=999;},
 ]){const source=cachedBls();mutate(source);assert.equal(canPublishCachedBlsData(source,now),false,mutate.toString());}
 assert.equal(canPublishCachedBlsData(undefined,now),false);
});

test('a New York Fed capture cannot qualify for the legacy BLS annual-calendar access-denial exception',()=>{
 const source={...nyfed(),status:'error',failure:{kind:'http',status:403,requestedUrl:'https://www.bls.gov/schedule/2026/home.htm',url:'https://www.bls.gov/schedule/2026/home.htm',redirected:false}};
 assert.equal(canPublishCachedBls(source,now),false);
});

test('malformed receipts and observations after the original retrieval cannot count as a verified retained capture',()=>{
 const malformed=cachedBls();malformed.provenance=[null];assert.equal(canPublishCachedBlsData(malformed,now),false);
 const futureObservation=cachedBls();futureObservation.series.unrate.observations.at(-1).date='2026-10-25';assert.equal(canPublishCachedBlsData(futureObservation,now),false);
});

test('approved publication retains BLS observations and receipts while independent data and NY Fed schedule advance',async()=>{
 const prior=previous(),before=structuredClone(prior);
 const next=await refreshSnapshot({previous:prior,now,allowCachedBlsData:true,allowCachedBlsCalendar:true,collectors:{bls:async()=>{throw unavailable();},bea:async()=>freshBea()},calendarCollectors:{bls:async()=>nyfed()}});
 assert.deepEqual(prior,before);assert.deepEqual(next.sources.bls.series,before.sources.bls.series);assert.deepEqual(next.sources.bls.provenance,before.sources.bls.provenance);assert.equal(next.sources.bls.fetchedAt,before.sources.bls.fetchedAt);
 assert.equal(next.sources.bls.status,'error');assert.equal(next.sources.bls.lastAttemptAt,now.toISOString());assert.deepEqual(next.sources.bls.failure,failure());
 assert.equal(next.sources.bea.status,'ok');assert.equal(next.sources.bea.fetchedAt,attempt);assert.equal(next.sources.bea.failure,null);assert.equal(next.calendar.sources.bls.provider,'new-york-fed');assert.equal(next.calendar.sources.bls.status,'ok');
 assert.deepEqual(next.publicationPolicy,{mode:'allow-cached-bls-data',cachedDataSources:['bls'],cachedCalendarSources:[]});
 assert.doesNotThrow(()=>assertCommercialData(next));
});

test('typed statistical failure is retained even without the publication exception and cleared after success',async()=>{
 const prior=previous(),failed=await refreshSnapshot({previous:prior,now,collectors:{bls:async()=>{throw unavailable();}}});
 assert.deepEqual(failed.sources.bls.failure,failure());
 const next=await refreshSnapshot({previous:failed,now,collectors:{bls:async()=>priorBls()}});
 assert.equal(next.sources.bls.status,'ok');assert.equal(next.sources.bls.failure,null);
});

test('the publication mode never permits parser, auth, redirect, wrong-endpoint, absent-cache or unrelated failures',async()=>{
 for(const error of [new Error('Invalid BLS schema'),unavailable(401),unavailable(403),unavailable(429),unavailable(503,endpoint,{redirected:true}),unavailable(503,endpoint,{url:endpoint+'?retry=1'}),unavailable(503,endpoint.replace('/v1/','/v2/'))])await assert.rejects(refreshSnapshot({previous:previous(),now,allowCachedBlsData:true,collectors:{bls:async()=>{throw error;}}}),/Required official refresh failed/);
 const missing=previous();delete missing.sources.bls;
 await assert.rejects(refreshSnapshot({previous:missing,now,allowCachedBlsData:true,collectors:{bls:async()=>{throw unavailable();}}}),/Required official refresh failed/);
 const invalid=previous();delete invalid.sources.bls.series.cpiMonthly;
 await assert.rejects(refreshSnapshot({previous:invalid,now,allowCachedBlsData:true,collectors:{bls:async()=>{throw unavailable();}}}),/Required official refresh failed/);
 await assert.rejects(refreshSnapshot({previous:previous(),now,allowCachedBlsData:true,collectors:{bls:async()=>{throw unavailable();},bea:async()=>{throw unavailable();}}}),/bea:/);
 await assert.rejects(refreshSnapshot({previous:previous(),now,allowCachedBlsData:true,collectors:{bls:async()=>{throw unavailable();}},calendarCollectors:{bls:async()=>{throw new Error('Invalid calendar schema');}}}),/bls calendar:/);
});

test('require-all stays strict and cannot be combined with either cached publication flag',async()=>{
 for(const options of [{allowCachedBlsData:true},{allowCachedBlsCalendar:true},{allowCachedBlsData:true,allowCachedBlsCalendar:true}]){let attempted=false;await assert.rejects(refreshSnapshot({...options,requireAll:true,collectors:{bls:async()=>{attempted=true;return priorBls();}}}),/mutually exclusive/i);assert.equal(attempted,false);}
 await assert.rejects(refreshSnapshot({previous:previous(),now,requireAll:true,collectors:{bls:async()=>{throw unavailable();}}}),/Required official refresh failed/);
});

test('the new data mode can coexist with the legacy calendar403 exception only when both flags are explicit',async()=>{
 const annual='https://www.bls.gov/schedule/2026/home.htm';
 const options={previous:previous(),now,allowCachedBlsData:true,allowCachedBlsCalendar:true,collectors:{bls:async()=>{throw unavailable();}},calendarCollectors:{bls:async()=>{throw unavailable(403,annual);}}};
 const next=await refreshSnapshot(options);
 assert.deepEqual(next.publicationPolicy,{mode:'allow-cached-bls-data',cachedDataSources:['bls'],cachedCalendarSources:['bls']});
 const completed=completedDaily();completed.sources.bls=next.sources.bls;completed.calendar.sources.bls=next.calendar.sources.bls;completed.publicationPolicy=next.publicationPolicy;
 assert.equal(getDailyRefreshPlan(completed,{now}).required,false);
 await assert.rejects(refreshSnapshot({...options,allowCachedBlsCalendar:false}),/bls calendar:/);
 await assert.rejects(refreshSnapshot({...options,allowCachedBlsData:false}),/bls:/);
});

function approvedPrior(){
 const prior=previous();prior.sources.bls=cachedBls();prior.calendar.sources.bls={...legacyCalendar(),status:'error',error:'Official source HTTP 403',lastAttemptAt:attempt,failure:{kind:'http',status:403,requestedUrl:'https://www.bls.gov/schedule/2026/home.htm',url:'https://www.bls.gov/schedule/2026/home.htm',redirected:false}};
 prior.publicationPolicy={mode:'allow-cached-bls-data',cachedDataSources:['bls'],cachedCalendarSources:['bls']};return prior;
}

test('targeted healthy-source refreshes preserve revalidated untouched data and calendar exceptions without downgrading policy',async()=>{
 for(const options of [{allowCachedBlsData:true,allowCachedBlsCalendar:true},{allowCachedBlsCalendar:true},{requireAll:true}]){
  const prior=approvedPrior(),before=structuredClone(prior),next=await refreshSnapshot({previous:prior,now,...options,collectors:{bea:async()=>freshBea()}});
  assert.deepEqual(next.publicationPolicy,before.publicationPolicy);assert.deepEqual(next.sources.bls,before.sources.bls);assert.deepEqual(next.calendar.sources.bls,before.calendar.sources.bls);assert.equal(next.sources.bea.status,'ok');assert.deepEqual(prior,before);
 }
});

test('untouched exceptions are revalidated and selected success clears only its own cached marker',async()=>{
 const invalid=approvedPrior();invalid.sources.bls.failure.status=403;invalid.calendar.sources.bls.failure.status=503;
 const next=await refreshSnapshot({previous:invalid,now,allowCachedBlsData:true,allowCachedBlsCalendar:true,collectors:{bea:async()=>freshBea()}});
 assert.deepEqual(next.publicationPolicy,{mode:'allow-cached-bls-data',cachedDataSources:[],cachedCalendarSources:[]});
 const fresh=priorBls();fresh.fetchedAt=now.toISOString();fresh.provenance.forEach(receipt=>{receipt.retrievedAt=now.toISOString();});
 const success=await refreshSnapshot({previous:approvedPrior(),now,allowCachedBlsData:true,collectors:{bls:async()=>fresh}});
 assert.deepEqual(success.publicationPolicy,{mode:'allow-cached-bls-data',cachedDataSources:[],cachedCalendarSources:['bls']});
});

test('an approved targeted503 persists its new attempt time and restarts the thirty-minute recovery interval',async()=>{
 const prior=approvedPrior(),next=await refreshSnapshot({previous:prior,now,allowCachedBlsData:true,allowCachedBlsCalendar:true,collectors:{bls:async()=>{throw unavailable();}}});
 assert.equal(next.sources.bls.lastAttemptAt,now.toISOString());assert.equal(next.sources.bls.fetchedAt,prior.sources.bls.fetchedAt);assert.deepEqual(next.sources.bls.provenance,prior.sources.bls.provenance);assert.deepEqual(next.sources.bls.series,prior.sources.bls.series);assert.deepEqual(next.publicationPolicy,prior.publicationPolicy);
 const completed=completedDaily();completed.sources.bls=next.sources.bls;completed.publicationPolicy=next.publicationPolicy;completed.calendar.sources.bls=next.calendar.sources.bls;
 assert.equal(getWorkflowRefreshPlan(completed,{now:new Date('2026-10-25T00:46:59.999Z')}).required,false);
 const due=getWorkflowRefreshPlan(completed,{now:new Date('2026-10-25T00:47:00.000Z')});assert.equal(due.kind,'recovery');assert.deepEqual(due.sources,['bls']);
});

test('NY Fed refresh cannot discard a previously covered month after its page becomes unavailable',async()=>{
 const prior={calendar:{sources:{bls:{...nyfed({full:true}),status:'ok',lastAttemptAt:attempt,error:null,failure:null}}}},before=structuredClone(prior);
 const next=await refreshSnapshot({previous:prior,now,calendarCollectors:{bls:async()=>nyfed()}});
 assert.deepEqual(prior,before);assert.equal(next.calendar.sources.bls.status,'error');assert.deepEqual(next.calendar.sources.bls.events,before.calendar.sources.bls.events);assert.deepEqual(next.calendar.sources.bls.coveredMonths,['2026-10','2026-11','2026-12']);assert.deepEqual(next.calendar.sources.bls.provenance,before.calendar.sources.bls.provenance);assert.match(next.calendar.sources.bls.error,/2026-12|covered|captured month/i);
 await assert.rejects(refreshSnapshot({previous:prior,now,allowCachedBlsData:true,allowCachedBlsCalendar:true,calendarCollectors:{bls:async()=>nyfed()}}),/bls calendar:/);
});

test('explicit shorter NY Fed coverage is accepted on initial migration and when only a new future month is unavailable',async()=>{
 for(const prior of [previous(),{calendar:{sources:{bls:{...nyfed(),status:'ok'}}}}]){const next=await refreshSnapshot({previous:prior,now,requireAll:true,calendarCollectors:{bls:async()=>nyfed()}});assert.equal(next.calendar.sources.bls.status,'ok');assert.deepEqual(next.calendar.sources.bls.unavailableMonths,['2026-12']);assert.deepEqual(next.calendar.sources.bls.coveredMonths,['2026-10','2026-11']);}
});

test('daily catch-up recognizes the approved 503 attempt while preserving visibly cached and stale BLS data',()=>{
 const value=completedDaily(),before=structuredClone(value),plan=getDailyRefreshPlan(value,{now});
 assert.equal(plan.required,false);assert.deepEqual(plan.pendingSources,[]);assert.match(plan.reason,/BLS.*503|cached BLS data|cached.*statistic/i);assert.deepEqual(value,before);
 const freshness=getFreshness(value,{now:new Date('2026-10-25T01:17:00Z')}).entries.find(entry=>entry.id==='data:bls');assert.equal(freshness.status,'cached');assert.equal(freshness.stale,true);assert.equal(freshness.fetchedAt,priorBlsAt);
});

test('the daily exception requires its exact policy, proven cached data and a valid attempt in this slot',()=>{
 for(const mutate of [value=>{delete value.publicationPolicy;},value=>{value.publicationPolicy.mode='allow-cached-bls-calendar';},value=>{value.publicationPolicy.cachedDataSources=[];},value=>{value.publicationPolicy.cachedDataSources='bls';},value=>{value.sources.bls.lastAttemptAt='2026-10-24T23:36:59.999Z';},value=>{value.sources.bls.lastAttemptAt='2026-10-25T00:17:00.001Z';},value=>{value.sources.bls.lastAttemptAt='invalid';},value=>{value.sources.bls.failure.status=403;},value=>{delete value.sources.bls.series.unrate;}]){const value=completedDaily();mutate(value);const plan=getDailyRefreshPlan(value,{now});assert.equal(plan.required,true,mutate.toString());assert.deepEqual(plan.pendingSources,['BLS data']);}
 const other=completedDaily();other.sources.bea.status='error';assert.deepEqual(getDailyRefreshPlan(other,{now}).pendingSources,['BEA data']);
});

test('workflow recovery retries only BLS after thirty minutes and within three hours of the daily slot',()=>{
 const value=completedDaily(),before=structuredClone(value);
 for(const [time,required]of [['2026-10-25T00:11:59.999Z',false],['2026-10-25T00:12:00.000Z',true],['2026-10-25T02:37:00.000Z',true],['2026-10-25T02:37:00.001Z',false]]){const plan=getWorkflowRefreshPlan(value,{now:new Date(time)});assert.equal(plan.required,required,time);assert.equal(plan.kind,required?'recovery':'none',time);assert.deepEqual(plan.sources,required?['bls']:[],time);}
 assert.deepEqual(value,before);
 const forced=getWorkflowRefreshPlan(value,{now,force:true});assert.equal(forced.kind,'daily');assert.deepEqual(forced.sources,[]);
 const missing=completedDaily();delete missing.sources.bea;const daily=getWorkflowRefreshPlan(missing,{now});assert.equal(daily.kind,'daily');assert.deepEqual(daily.sources,[]);
});

test('recovery unions BLS with an independently due supported release collector',()=>{
 const value=completedDaily();value.releases=[{id:'bea-gdp-2026-10-25',sourceId:'bea',program:'gdp',name:'Gross Domestic Product, 3rd Quarter 2026 (Advance Estimate)',period:'2026-07-01',date:'2026-10-25',scheduledAt:'2026-10-25T00:00:00.000Z'}];
 const plan=getWorkflowRefreshPlan(value,{now});assert.equal(plan.kind,'release');assert.deepEqual(plan.sources,['bea','bls']);
});

test('a strict targeted retry rejects another 503 and a successful BLS capture clears the cached-data marker',async()=>{
 const prior=previous();prior.sources.bls=cachedBls();prior.publicationPolicy=completedDaily().publicationPolicy;const before=structuredClone(prior);let attempts=0;
 await assert.rejects(refreshSnapshot({previous:prior,now,requireAll:true,collectors:{bls:async()=>{attempts++;throw unavailable();}}}),/Required official refresh failed/);assert.equal(attempts,1);assert.deepEqual(prior,before);
 const fresh=priorBls();fresh.fetchedAt=now.toISOString();fresh.provenance.forEach(receipt=>{receipt.retrievedAt=now.toISOString();});
 const next=await refreshSnapshot({previous:prior,now,requireAll:true,collectors:{bls:async()=>{attempts++;return fresh;}}});
 assert.equal(attempts,2);assert.equal(next.sources.bls.status,'ok');assert.equal(next.sources.bls.failure,null);assert.deepEqual(next.publicationPolicy.cachedDataSources,[]);assert.deepEqual(next.sources.bea,before.sources.bea);
 const completed=completedDaily();completed.sources.bls=next.sources.bls;completed.publicationPolicy=next.publicationPolicy;assert.equal(getWorkflowRefreshPlan(completed,{now}).required,false);
});
