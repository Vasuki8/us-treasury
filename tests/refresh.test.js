import test from 'node:test';
import assert from 'node:assert/strict';
test('an independent source refresh preserves the unchanged cached calendar publication policy',async()=>{
  const {refreshSnapshot}=await import('../scripts/sources/refresh.mjs');
  const policy={mode:'allow-cached-bls-calendar',cachedCalendarSources:['bls']};
  const result=await refreshSnapshot({previous:{sources:{},publicationPolicy:policy,calendar:{status:'partial',sources:{}}}});
  assert.deepEqual(result.publicationPolicy,policy);
});
import { refreshSnapshot } from '../scripts/sources/refresh.mjs';
import * as http from '../scripts/sources/http.mjs';
import { asKnownOn } from '../src/vintages.js';
import { registry } from '../src/registry.js';

const result=id=>({id,fetchedAt:'2026-10-21T12:00:00Z',series:{example:{observations:[{date:'2026-09-01',value:4.2,publishedAt:null}],dataStatus:'official'}},provenance:[],warnings:[]});

test('a failed official refresh retains last-good data and original retrieval time',async()=>{
  const previous={schemaVersion:1,sources:{bls:{...result('bls'),status:'ok'}}};
  const next=await refreshSnapshot({previous,collectors:{bls:async()=>{throw Error('BLS unavailable');}},now:new Date('2026-10-22T12:00:00Z')});
  assert.equal(next.sources.bls.status,'error');
  assert.equal(next.sources.bls.fetchedAt,previous.sources.bls.fetchedAt);
  assert.equal(next.sources.bls.series.example.observations[0].value,4.2);
  assert.match(next.sources.bls.error,/unavailable/);
  assert.equal(next.sources.bls.lastAttemptAt,'2026-10-22T12:00:00.000Z');
});

test('first failures have no invented data while independent sources succeed',async()=>{
  const next=await refreshSnapshot({collectors:{bls:async()=>{throw Error('quota');},bea:async()=>result('bea')},now:new Date('2026-10-21T12:00:00Z')});
  assert.equal(next.sources.bls.status,'unavailable');
  assert.deepEqual(next.sources.bls.series,{});
  assert.equal(next.sources.bea.status,'ok');
  assert.equal(next.sources.bea.series.example.observations[0].publishedAt,null);
  assert.equal(next.calendar.status,'unavailable');
  assert.equal(next.releases.length,0);
});

test('invalid source observations fail closed and cannot overwrite cached official data',async()=>{
  const previous={schemaVersion:1,sources:{bls:{...result('bls'),status:'ok'}}};
  const invalid=result('bls');invalid.series.example.observations[0].value=Infinity;
  const next=await refreshSnapshot({previous,collectors:{bls:async()=>invalid}});
  assert.equal(next.sources.bls.status,'error');
  assert.equal(next.sources.bls.series.example.observations[0].value,4.2);
});

test('snapshot assembly cannot predate the successful response retrieval',async()=>{
  const next=await refreshSnapshot({collectors:{bls:async()=>result('bls')},now:new Date('2026-10-21T11:00:00Z')});
  assert.ok(Date.parse(next.generatedAt)>=Date.parse(next.sources.bls.fetchedAt));
});

test('refresh bootstraps genuine prior retrievals and appends revisions at completion without changing earlier captures',async()=>{
  const initial=result('bls'),revised=result('bls');
  initial.fetchedAt='2026-10-20T12:00:00Z';
  revised.fetchedAt='2026-10-21T12:00:01.123Z';
  revised.series.example.observations[0].value=4.3;
  const previous={sources:{bls:initial}},copy=structuredClone(previous);
  const next=await refreshSnapshot({previous,collectors:{bls:async()=>revised},now:new Date('2026-10-21T12:00:00Z')});
  assert.equal(next.vintages?.captures?.length,2);
  assert.equal(next.vintages.captures[0].capturedAt,'2026-10-20T12:00:00.000Z');
  assert.equal(next.vintages.captures[0].baseline,true);
  assert.equal(next.vintages.captures[1].capturedAt,'2026-10-21T12:00:01.123Z');
  assert.equal(next.vintages.captures[1].recordedAt,next.generatedAt);
  assert.ok(next.vintages.captures[1].recordedAt>next.checkedAt,'recording follows response completion, not the refresh start');
  assert.equal(asKnownOn(next.vintages,'2026-10-20T12:00:00Z').sources.bls.series.example.observations[0].value,4.2);
  assert.equal(asKnownOn(next.vintages,'2026-10-21T12:00:01.123Z').sources.bls.series.example.observations[0].value,4.3);
  assert.deepEqual(previous,copy);

  const retained=structuredClone(next.vintages),confirmed={...revised,fetchedAt:'2026-10-22T12:00:00Z'};
  const again=await refreshSnapshot({previous:next,collectors:{bls:async()=>confirmed},now:new Date('2026-10-22T12:00:00Z')});
  assert.deepEqual(again.vintages.captures.slice(0,2),retained.captures);
  assert.equal(again.vintages.captures.length,3);
  assert.deepEqual(again.vintages.captures[2].series,{});
});

test('failed and unattempted refreshes preserve existing vintage captures while initial failures create no invented baseline',async()=>{
  const prior=await refreshSnapshot({collectors:{bls:async()=>result('bls')},now:new Date('2026-10-21T12:00:00Z')});
  const failed=await refreshSnapshot({previous:prior,collectors:{bls:async()=>{throw Error('HTTP 503');}},now:new Date('2026-10-22T12:00:00Z')});
  assert.deepEqual(failed.vintages,prior.vintages);
  const omitted=await refreshSnapshot({previous:failed,now:new Date('2026-10-23T12:00:00Z')});
  assert.deepEqual(omitted.vintages,prior.vintages);
  const initialFailure=await refreshSnapshot({collectors:{bls:async()=>{throw Error('HTTP 503');}}});
  assert.deepEqual(initialFailure.vintages,{version:1,captures:[]});
});

test('a same-retrieval changed refresh cannot overwrite the immutable vintage key',async()=>{
  const initial=result('bls');
  const prior=await refreshSnapshot({collectors:{bls:async()=>initial}});
  const changed=result('bls');changed.series.example.observations[0].value=9;
  await assert.rejects(refreshSnapshot({previous:prior,collectors:{bls:async()=>changed}}),/immutable|collision/i);
  assert.equal(prior.sources.bls.series.example.observations[0].value,4.2);
});

test('refresh records registry measurement meaning without mutating source snapshots or earlier definitions',async t=>{
  const original=registry.gdp;
  t.after(()=>{registry.gdp=original;});
  const capture={id:'bea',fetchedAt:'2026-10-20T12:00:00Z',series:{gdp:{observations:[{date:'2026-07-01',value:2.2,publishedAt:null}],sourceIds:['A191RL'],sourceUrl:'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt'}},provenance:[]};
  const prior=await refreshSnapshot({collectors:{bea:async()=>capture},now:new Date('2026-10-20T13:00:00Z')});
  const early=asKnownOn(prior.vintages,capture.fetchedAt).sources.bea.series.gdp;
  assert.equal(early.unit,'Percent q/q annualized');
  assert.equal(early.name,'Real gross domestic product growth');
  assert.equal(early.frequency,'Quarterly');
  assert.equal(early.definition,original.definition);
  assert.equal(prior.sources.bea.series.gdp.unit,undefined);
  assert.equal(capture.series.gdp.definition,undefined);
  registry.gdp={...original,definition:'A later registered definition.',dateConvention:'quarter-start',periodType:'reference-quarter'};
  const cached=await refreshSnapshot({previous:prior,collectors:{bea:async()=>{throw Error('unavailable');}},now:new Date('2026-10-21T13:00:00Z')});
  assert.deepEqual(cached.vintages,prior.vintages);
  const latest=await refreshSnapshot({previous:prior,collectors:{bea:async()=>({...capture,fetchedAt:'2026-10-21T12:00:00Z'})},now:new Date('2026-10-21T13:00:00Z')});
  assert.equal(asKnownOn(latest.vintages,'2026-10-20T12:00:00Z').sources.bea.series.gdp.definition,original.definition);
  const known=asKnownOn(latest.vintages,'2026-10-21T12:00:00Z').sources.bea.series.gdp;
  assert.equal(known.definition,'A later registered definition.');
  assert.equal(known.dateConvention,'quarter-start');
  assert.equal(known.periodType,'reference-quarter');
});

const calendarEvent=(extra={})=>({id:'bea-gdp-q3',sourceId:'bea',program:'gdp',name:'GDP (Advance Estimate), 3rd Quarter 2026',agency:'BEA',seriesId:'gdp',seriesIds:['gdp'],topic:'Growth',date:'2026-10-29',time:'08:30',scheduledAt:'2026-10-29T12:30:00.000Z',period:null,periodLabel:'3rd Quarter 2026',sourceUrl:'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics',sourceUid:'gdp-q3',...extra});
const calendarResult=(events=[calendarEvent()])=>({id:'bea',agency:'U.S. Bureau of Economic Analysis',fetchedAt:'2026-10-21T12:01:00.000Z',events,provenance:[{url:events[0]?.sourceUrl,sha256:'a'.repeat(64)}],warnings:[],coverageNote:'National GDP and personal income schedules.'});

test('calendar refresh stores verified future schedules separately from observation data',async()=>{
  const next=await refreshSnapshot({calendarCollectors:{bea:async()=>calendarResult()},now:new Date('2026-10-21T12:00:00Z')});
  assert.equal(next.calendar.sources.bea.status,'ok');
  assert.equal(next.calendar.status,'partial','BLS is not connected yet');
  assert.equal(next.releases[0].scheduledAt,'2026-10-29T12:30:00.000Z');
  assert.equal(next.releases[0].periodLabel,'3rd Quarter 2026');
  assert.deepEqual(next.sources,{});
  assert.ok(Date.parse(next.generatedAt)>=Date.parse(next.calendar.sources.bea.fetchedAt));
});

test('failed calendar refresh retains last successful schedule and retrieval time while observations update',async()=>{
  const prior=await refreshSnapshot({calendarCollectors:{bea:async()=>calendarResult()}});
  const next=await refreshSnapshot({previous:prior,collectors:{bls:async()=>result('bls')},calendarCollectors:{bea:async()=>{throw Error('calendar HTTP 503');}},now:new Date('2026-10-22T12:00:00Z')});
  assert.equal(next.calendar.sources.bea.status,'error');
  assert.equal(next.calendar.sources.bea.fetchedAt,prior.calendar.sources.bea.fetchedAt);
  assert.equal(next.calendar.sources.bea.lastAttemptAt,'2026-10-22T12:00:00.000Z');
  assert.match(next.calendar.sources.bea.error,/503/);
  assert.deepEqual(next.releases,prior.releases);
  assert.equal(next.sources.bls.status,'ok');
});

test('successful schedule refresh replaces withdrawn or rescheduled records by source',async()=>{
  const prior=await refreshSnapshot({calendarCollectors:{bea:async()=>calendarResult([calendarEvent(),calendarEvent({id:'withdrawn'})])}});
  const moved=calendarEvent({date:'2026-10-30',scheduledAt:'2026-10-30T12:30:00.000Z'});
  const next=await refreshSnapshot({previous:prior,calendarCollectors:{bea:async()=>calendarResult([moved])}});
  assert.deepEqual(next.releases.map(event=>event.id),['bea-gdp-q3']);
  assert.equal(next.releases[0].date,'2026-10-30');
});

test('invalid calendar timestamps and duplicate IDs cannot overwrite the last successful schedule',async()=>{
  const prior=await refreshSnapshot({calendarCollectors:{bea:async()=>calendarResult()}});
  for(const events of [
    [calendarEvent({scheduledAt:'2026-10-29T13:30:00.000Z'})],
    [calendarEvent({date:'2026-02-30'})],
    [calendarEvent(),calendarEvent()],
    [calendarEvent({sourceId:'vendor'})],
  ]) {
    const next=await refreshSnapshot({previous:prior,calendarCollectors:{bea:async()=>calendarResult(events)}});
    assert.equal(next.calendar.sources.bea.status,'error');
    assert.deepEqual(next.releases,prior.releases);
  }
});

test('calendar first failure stays unavailable and an observation-only refresh preserves captured schedules',async()=>{
  const failed=await refreshSnapshot({calendarCollectors:{bea:async()=>{throw Error('denied');}}});
  assert.equal(failed.calendar.sources.bea.status,'unavailable');
  assert.equal(failed.calendar.status,'unavailable');
  assert.deepEqual(failed.releases,[]);
  const prior=await refreshSnapshot({calendarCollectors:{bea:async()=>calendarResult()}});
  const next=await refreshSnapshot({previous:prior,collectors:{bls:async()=>result('bls')}});
  assert.deepEqual(next.calendar,prior.calendar);
  assert.deepEqual(next.releases,prior.releases);
});

test('a failed BLS next-year fetch retains the whole previous agency schedule with its original retrieval',async()=>{
  const annual=year=>`https://www.bls.gov/schedule/${year}/home.htm`;
  const event=year=>calendarEvent({id:`bls-cpi-${year}`,sourceId:'bls',program:'consumer-price-index',agency:'BLS',seriesId:'cpi',seriesIds:['cpi'],topic:'Inflation',date:`${year}-10-29`,scheduledAt:`${year}-10-29T12:30:00.000Z`,sourceUrl:annual(year)});
  const result={id:'bls',events:[event(2026),event(2027)],fetchedAt:'2026-10-21T12:00:00.000Z',coveredYears:[2026,2027],failedYears:[],provenance:[2026,2027].map(year=>({url:annual(year),sha256:'a'.repeat(64)}))};
  const prior=await refreshSnapshot({calendarCollectors:{bls:async()=>result}});
  const current={...result,events:[event(2026)],coveredYears:[2026],failedYears:[2027],provenance:result.provenance.slice(0,1),fetchedAt:'2026-10-22T12:00:00.000Z'};
  const next=await refreshSnapshot({previous:prior,calendarCollectors:{bls:async()=>current}});
  assert.equal(next.calendar.sources.bls.status,'error');
  assert.equal(next.calendar.sources.bls.fetchedAt,result.fetchedAt);
  assert.deepEqual(next.releases,prior.releases);
  assert.match(next.calendar.sources.bls.error,/2027.*Retained/);
});

test('calendar status stays partial when an added agency fails while the others succeed',async()=>{
  const good=id=>({id,status:'ok',events:[],fetchedAt:'2026-10-21T12:00:00.000Z',provenance:[],warnings:[]});
  for(const missing of ['census','dol','treasury','treasury-yield-timing']) {
    const sources=Object.fromEntries(['bls','bea','census','dol','treasury','treasury-yield-timing'].filter(id=>id!==missing).map(id=>[id,good(id)]));
    const next=await refreshSnapshot({previous:{calendar:{sources}},calendarCollectors:{[missing]:async()=>{throw Error('HTTP 503');}}});
    assert.equal(next.calendar.status,'partial',`${missing} absence must remain visible`);
    assert.equal(next.calendar.sources[missing].status,'unavailable');
    assert.match(next.calendar.sources[missing].error,/503/);
  }
});

const timingResult=()=>({id:'treasury-yield-timing',agency:'U.S. Department of the Treasury, Office of Debt Management',events:[],timing:{program:'daily-par-yields',seriesIds:['yield'],topic:'Rates',scheduleBasis:'usual-availability',frequency:'each-trading-day',availableBy:'18:00',timeZone:'America/New_York',delaysPossible:true,sourceUrl:'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology'},fetchedAt:'2026-10-21T12:01:00.000Z',provenance:[{url:'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology',sha256:'b'.repeat(64)}],warnings:[]});

test('Treasury yield timing captures separately and failed or invalid refreshes retain the original rule without adding releases',async()=>{
  const prior=await refreshSnapshot({calendarCollectors:{bea:async()=>calendarResult(),'treasury-yield-timing':async()=>timingResult()},now:new Date('2026-10-21T12:00:00Z')});
  assert.equal(prior.calendar.sources['treasury-yield-timing'].status,'ok');
  assert.equal(prior.calendar.sources['treasury-yield-timing'].timing.availableBy,'18:00');
  assert.deepEqual(prior.releases,[calendarEvent()]);
  for(const collect of [async()=>{throw Error('methodology HTTP 503');},async()=>{const invalid=timingResult();invalid.timing.availableBy='15:30';return invalid;}]) {
    const next=await refreshSnapshot({previous:prior,calendarCollectors:{bea:async()=>calendarResult(),'treasury-yield-timing':collect},now:new Date('2026-10-22T12:00:00Z')});
    const source=next.calendar.sources['treasury-yield-timing'];
    assert.equal(source.status,'error');
    assert.deepEqual(source.timing,prior.calendar.sources['treasury-yield-timing'].timing);
    assert.equal(source.fetchedAt,prior.calendar.sources['treasury-yield-timing'].fetchedAt);
    assert.deepEqual(source.provenance,prior.calendar.sources['treasury-yield-timing'].provenance);
    assert.equal(next.calendar.sources.bea.status,'ok');
    assert.deepEqual(next.releases,[calendarEvent()]);
  }
  const failed=await refreshSnapshot({calendarCollectors:{'treasury-yield-timing':async()=>{throw Error('unavailable');}}});
  assert.equal(failed.calendar.sources['treasury-yield-timing'].status,'unavailable');
  assert.equal(failed.calendar.sources['treasury-yield-timing'].timing,undefined);
  assert.doesNotMatch(failed.calendar.message,/18:00|6\s*p\.m\./i,'an initial failure must not display an uncaptured deadline in shared calendar context');
  assert.deepEqual(failed.releases,[]);
});

test('strict refresh rejects a failed observation source after independent collectors finish without mutating the previous snapshot',async()=>{
  const previous={sources:{bls:{...result('bls'),status:'ok'}}};
  const original=structuredClone(previous);
  let independentFinished=false;
  await assert.rejects(refreshSnapshot({previous,requireAll:true,collectors:{
    bls:async()=>{throw Error('BLS HTTP 503');},
    bea:async()=>{await new Promise(resolve=>setImmediate(resolve));independentFinished=true;return result('bea');},
  }}),/bls.*503/i);
  assert.equal(independentFinished,true,'strict rejection waits for all attempted sources');
  assert.deepEqual(previous,original,'the retained snapshot remains untouched');
});

test('strict refresh rejects invalid observation and calendar responses',async()=>{
  const invalid=result('bls');invalid.series.example.observations[0].value=Infinity;
  await assert.rejects(refreshSnapshot({requireAll:true,collectors:{bls:async()=>invalid}}),/bls.*Invalid official value/i);
  await assert.rejects(refreshSnapshot({requireAll:true,calendarCollectors:{bea:async()=>calendarResult([calendarEvent({sourceId:'vendor'})])}}),/bea.*Unreviewed calendar/i);
});

test('strict refresh permits successful selected sources without requiring unattempted sources',async()=>{
  const next=await refreshSnapshot({previous:{sources:{dol:{...result('dol'),status:'error'}}},requireAll:true,collectors:{bls:async()=>result('bls')},calendarCollectors:{bea:async()=>calendarResult()}});
  assert.equal(next.sources.bls.status,'ok');
  assert.equal(next.sources.dol.status,'error','an unattempted cached source is outside this strict selection');
  assert.equal(next.calendar.sources.bea.status,'ok');
});

const blsAnnualResult=(years,failedYears=[])=>({
  id:'bls',fetchedAt:'2026-10-21T12:00:00.000Z',coveredYears:years,failedYears,
  events:years.map(year=>calendarEvent({id:`bls-cpi-${year}`,sourceId:'bls',program:'consumer-price-index',agency:'BLS',seriesId:'cpi',seriesIds:['cpi'],topic:'Inflation',date:`${year}-10-29`,scheduledAt:`${year}-10-29T12:30:00.000Z`,sourceUrl:`https://www.bls.gov/schedule/${year}/home.htm`})),
  provenance:years.map(year=>({url:`https://www.bls.gov/schedule/${year}/home.htm`,sha256:'a'.repeat(64)})),
  warnings:failedYears.map(year=>`BLS ${year} annual calendar unavailable; current-year schedule retained.`),
});

test('strict refresh accepts a first unavailable BLS next-year calendar but rejects loss of previously captured coverage',async()=>{
  const current=blsAnnualResult([2026],[2027]);
  const accepted=await refreshSnapshot({requireAll:true,calendarCollectors:{bls:async()=>current}});
  assert.equal(accepted.calendar.status,'partial','unpublished future-year coverage stays visible');
  assert.equal(accepted.calendar.sources.bls.status,'ok');
  assert.deepEqual(accepted.calendar.sources.bls.failedYears,[2027]);
  const previous=await refreshSnapshot({calendarCollectors:{bls:async()=>blsAnnualResult([2026,2027])}});
  await assert.rejects(refreshSnapshot({previous,requireAll:true,calendarCollectors:{bls:async()=>current}}),/bls.*previously captured year.*2027/i);
});

test('cached BLS publication and strict publication cannot be requested together',async()=>{
  let attempted=false;
  await assert.rejects(refreshSnapshot({requireAll:true,allowCachedBlsCalendar:true,collectors:{bea:async()=>{attempted=true;return result('bea');}}}),/requireAll.*allowCachedBlsCalendar|mutually exclusive/i);
  assert.equal(attempted,false,'conflicting modes fail before contacting official sources');
});

test('cached BLS publication records its policy even when every attempted source succeeds',async()=>{
  const next=await refreshSnapshot({allowCachedBlsCalendar:true,collectors:{bea:async()=>result('bea')},calendarCollectors:{bls:async()=>blsAnnualResult([2026,2027])},now:new Date('2026-10-22T12:00:00Z')});
  assert.deepEqual(next.publicationPolicy,{mode:'allow-cached-bls-calendar',cachedCalendarSources:[]});
  assert.equal(next.calendar.sources.bls.failure,null);
  const manual=await refreshSnapshot({calendarCollectors:{bls:async()=>blsAnnualResult([2026])}});
  assert.equal(Object.hasOwn(manual,'publicationPolicy'),false);
  const strict=await refreshSnapshot({requireAll:true,calendarCollectors:{bls:async()=>blsAnnualResult([2026])}});
  assert.equal(Object.hasOwn(strict,'publicationPolicy'),false);
});

const refreshNow=new Date('2026-10-22T12:00:00.000Z');
const blsBlocked=(year=2026,extra={})=>new http.OfficialSourceHttpError(403,`https://www.bls.gov/schedule/${year}/home.htm`,extra);
const retainedBlsSnapshot=()=>({calendar:{sources:{bls:{...blsAnnualResult([2026,2027]),status:'ok',lastAttemptAt:'2026-10-21T12:00:00.000Z',error:null}}}});

test('cached BLS publication permits exact annual HTTP 403 and preserves the verified capture while other sources update',async()=>{
  for(const year of [2026,2027]) {
    const previous=retainedBlsSnapshot(),original=structuredClone(previous);
    const next=await refreshSnapshot({previous,allowCachedBlsCalendar:true,now:refreshNow,collectors:{bea:async()=>result('bea')},calendarCollectors:{bls:async()=>{throw blsBlocked(year);},bea:async()=>calendarResult()}});
    const cached=next.calendar.sources.bls;
    assert.deepEqual(next.publicationPolicy,{mode:'allow-cached-bls-calendar',cachedCalendarSources:['bls']});
    assert.equal(next.sources.bea.status,'ok');
    assert.equal(next.calendar.sources.bea.status,'ok');
    assert.equal(next.calendar.status,'partial');
    assert.equal(cached.status,'error');
    assert.equal(cached.fetchedAt,'2026-10-21T12:00:00.000Z');
    assert.equal(cached.lastAttemptAt,'2026-10-22T12:00:00.000Z');
    assert.match(cached.error,/HTTP 403/);
    assert.deepEqual(cached.failure,{kind:'http',status:403,requestedUrl:`https://www.bls.gov/schedule/${year}/home.htm`,url:`https://www.bls.gov/schedule/${year}/home.htm`,redirected:false});
    assert.deepEqual(cached.events,original.calendar.sources.bls.events);
    assert.deepEqual(cached.provenance,original.calendar.sources.bls.provenance);
    assert.deepEqual(cached.coveredYears,[2026,2027]);
    assert.deepEqual(previous,original,'refresh does not mutate the cached snapshot');
    const again=await refreshSnapshot({previous:next,allowCachedBlsCalendar:true,now:new Date('2026-10-23T12:00:00Z'),calendarCollectors:{bls:async()=>{throw blsBlocked(year);}}});
    assert.equal(again.calendar.sources.bls.fetchedAt,'2026-10-21T12:00:00.000Z');
    assert.deepEqual(again.calendar.sources.bls.events,cached.events);
    assert.deepEqual(again.calendar.sources.bls.provenance,cached.provenance);
  }
});

test('cached BLS publication rejects other failures and forged HTTP 403 messages',async()=>{
  const annual='https://www.bls.gov/schedule/2026/home.htm';
  const blockedErrors=[
    Error('Official source HTTP 403 (www.bls.gov)'),
    Object.assign(Error('Official source HTTP 403'),{status:403,requestedUrl:annual,url:annual,redirected:false}),
    new http.OfficialSourceHttpError(503,annual),
    new http.OfficialSourceHttpError(403,'https://www.bls.gov/schedule/2025/home.htm'),
    new http.OfficialSourceHttpError(403,`${annual}?retry=1`),
    new http.OfficialSourceHttpError(403,annual,{redirected:true}),
    new http.OfficialSourceHttpError(403,annual,{url:'https://www.bls.gov/schedule/'}),
    new http.OfficialSourceHttpError(403,'https://vendor.example/schedule/2026/home.htm'),
  ];
  for(const error of blockedErrors)await assert.rejects(refreshSnapshot({previous:retainedBlsSnapshot(),allowCachedBlsCalendar:true,now:refreshNow,calendarCollectors:{bls:async()=>{throw error;}}}),/bls calendar.*(?:403|503)/i);
  await assert.rejects(refreshSnapshot({previous:retainedBlsSnapshot(),allowCachedBlsCalendar:true,now:refreshNow,collectors:{bls:async()=>{throw blsBlocked();}},calendarCollectors:{bls:async()=>{throw blsBlocked();}}}),/bls:.*403/i);
  await assert.rejects(refreshSnapshot({previous:retainedBlsSnapshot(),allowCachedBlsCalendar:true,now:refreshNow,calendarCollectors:{bls:async()=>{throw blsBlocked();},bea:async()=>{throw blsBlocked();}}}),/bea calendar.*403/i);
});

test('cached BLS publication rejects a first failure or an empty, invalid, unreviewed or future retained capture',async()=>{
  const invalidCaptures=[
    undefined,
    {...blsAnnualResult([2026]),events:[]},
    {...blsAnnualResult([2026]),fetchedAt:'not-a-date'},
    {...blsAnnualResult([2026]),fetchedAt:'2026-10-23T12:00:00.000Z'},
    {...blsAnnualResult([2026]),provenance:[]},
    {...blsAnnualResult([2026]),provenance:[{url:'https://vendor.example/calendar',sha256:'a'.repeat(64)}]},
    {...blsAnnualResult([2026]),provenance:[{url:'https://www.bls.gov/schedule/2026/home.htm',sha256:'invalid'}]},
    {...blsAnnualResult([2026]),events:[calendarEvent({sourceId:'bls',program:'consumer-price-index',seriesId:'cpi',seriesIds:['cpi'],sourceUrl:'https://vendor.example/calendar'})]},
    {...blsAnnualResult([2026]),events:blsAnnualResult([2026]).events.map(event=>({...event,scheduledAt:'2026-10-29T13:30:00.000Z'}))},
  ];
  for(const capture of invalidCaptures) {
    const previous={calendar:{sources:capture?{bls:capture}:{}}};
    await assert.rejects(refreshSnapshot({previous,allowCachedBlsCalendar:true,now:refreshNow,calendarCollectors:{bls:async()=>{throw blsBlocked();}}}),/bls calendar.*403/i);
  }
});

test('strict mode still rejects an otherwise admissible cached BLS 403 and a successful retry clears stale failure metadata',async()=>{
  const previous=retainedBlsSnapshot();
  await assert.rejects(refreshSnapshot({previous,requireAll:true,now:refreshNow,calendarCollectors:{bls:async()=>{throw blsBlocked();}}}),/bls calendar.*403/i);
  const failed=await refreshSnapshot({previous,now:refreshNow,calendarCollectors:{bls:async()=>{throw blsBlocked();}}});
  const success=await refreshSnapshot({previous:failed,allowCachedBlsCalendar:true,now:refreshNow,calendarCollectors:{bls:async()=>blsAnnualResult([2026,2027])}});
  assert.equal(success.calendar.sources.bls.failure,null);
  assert.equal(success.calendar.sources.bls.error,null);
  assert.equal(success.calendar.sources.bls.status,'ok');
  assert.deepEqual(success.publicationPolicy.cachedCalendarSources,[]);
  const generic=await refreshSnapshot({previous:failed,calendarCollectors:{bls:async()=>{throw Error('network timeout');}}});
  assert.equal(generic.calendar.sources.bls.failure,null,'an old typed403 cannot authorize an unrelated current failure');
});
