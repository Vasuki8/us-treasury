import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshSnapshot } from '../scripts/sources/refresh.mjs';

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
