import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {validateFrozenFomcCalendar} from '../src/fomc-calendar-validation.js';
import {parseFomcCalendar} from '../scripts/sources/calendar-fomc.mjs';
import {assertFomcCalendarData} from '../scripts/credit-context-policy.mjs';

const retained=JSON.parse(readFileSync(new URL('./fixtures/market-desks/fomc-calendar.json',import.meta.url),'utf8'));
const fixture=()=>({version:1,asOf:'2026-11-01T12:00:00.000Z',source:structuredClone(retained)});
const change=(context,mutate)=>{const copy=structuredClone(context);mutate(copy);return copy;};

test('the tracked official FOMC calendar retains date-only facts and exact retrieval evidence',()=>{
 const context=fixture(),before=structuredClone(context);
 assert.doesNotThrow(()=>assertFomcCalendarData(context.source));
 assert.equal(validateFrozenFomcCalendar(context),true);
 assert.deepEqual(context,before,'validation is read-only');
 assert.ok(context.source.events.some(r=>r.date>context.asOf.slice(0,10)),'future listed meetings are allowed without a publication claim');
 assert.equal(validateFrozenFomcCalendar({...context,asOf:retained.fetchedAt}),true);
});

test('native parser fixtures preserve explicit minutes and projection relationships without inferred dates',()=>{
 const html='<h4>2026 FOMC Meetings</h4><div class="row fomc-meeting"><div class="fomc-meeting__month">September</div><div class="fomc-meeting__date">15-16*</div><a href="/newsevents/pressreleases/monetary20260916a.htm">HTML</a><a href="/monetarypolicy/fomcminutes20260916.htm">HTML</a><a href="/monetarypolicy/fomcprojtabl20260916.htm">HTML</a>(Released October 07, 2026)</div>';
 const context=fixture();Object.assign(context.source,parseFomcCalendar(html,{years:[2026]}));
 assert.doesNotThrow(()=>assertFomcCalendarData(context.source));
 assert.equal(validateFrozenFomcCalendar(context),true);
 const noDocs=fixture();noDocs.source.events=noDocs.source.events.filter(r=>r.program==='fomc-decision');noDocs.source.documents=[];
 assert.equal(validateFrozenFomcCalendar(noDocs),true,'a listed meeting does not require released document contents');
 const noDate=change(context,c=>{const row=c.source.events.find(r=>r.program==='fomc-minutes');row.date='2026-10-08';row.id='fomc-minutes-'+row.date;});
 assert.equal(validateFrozenFomcCalendar(noDate),false,'a conventional delay cannot replace the calendar’s explicit release date');
});

test('retained facts remain usable after a failed attempt with a separate, bounded cached clock',()=>{
 const context=fixture();Object.assign(context.source,{status:'error',lastAttemptAt:'2026-11-01T10:00:00.000Z',error:'Official calendar temporarily unavailable',failure:{kind:'http',status:503,requestedUrl:retained.provenance[0].url,url:retained.provenance[0].url,redirected:false}});
 assert.equal(validateFrozenFomcCalendar(context),true);
 assert.equal(validateFrozenFomcCalendar(change(context,c=>{c.source.failure=null;})),true,'network failure need not have an HTTP response');
 for(const mutate of [c=>{c.source.lastAttemptAt='2026-11-02T10:00:00.000Z';},c=>{c.source.lastAttemptAt='2026-10-31T10:00:00.000Z';},c=>{c.source.error=null;},c=>{c.source.fetchedAt=null;},c=>{c.source.failure.url='https://example.com/calendar';}])assert.equal(validateFrozenFomcCalendar(change(context,mutate)),false);
});

test('calendar clocks, native years, counts, receipt identity and unknown source claims fail closed',()=>{
 const context=fixture();
 const mutations=[
  c=>{c.version=2;},c=>{c.asOf='2026-11-01';},c=>{c.asOf='2026-11-01T12:00:00+00:00';},c=>{c.asOf='2026-02-30T12:00:00.000Z';},c=>{c.asOf='2026-10-31T12:00:00.000Z';},
  c=>{c.source.id='other';},c=>{c.source.status='unavailable';},c=>{c.source.fetchedAt='2026-11-01T02:31:23Z';},c=>{c.source.coveredYears=[];},c=>{c.source.coveredYears=[2026,2026];},c=>{c.source.coveredYears=[2026,2028];},c=>{c.source.coveredYears=[2026];},
  c=>{c.source.provenance.push({...c.source.provenance[0]});},c=>{c.source.provenance[0].url+='?quote=1';},c=>{c.source.provenance[0].url='https://www.federalreserve.gov@evil.example/fomccalendars.htm';},c=>{c.source.provenance[0].sha256='f'.repeat(63);},c=>{c.source.provenance[0].retrievedAt='2026-11-01T02:31:23.963Z';},
  c=>{c.source.provenance[0].sha256=[c.source.provenance[0].sha256];},
  c=>{c.source.events=[];},c=>{c.source.events=Array(65).fill(c.source.events[0]);},c=>{c.source.documents=Array(97).fill(c.source.documents[0]);},c=>{c.source.events.push({...c.source.events[0]});},c=>{c.source.documents.push({...c.source.documents[0]});},c=>{c.source.actual=4.5;},c=>{c.forecast=4.5;},
 ];
 for(const [i,mutate]of mutations.entries())assert.equal(validateFrozenFomcCalendar(change(context,mutate)),false,'source mutation '+i);
});

test('events and documents reject invented times, results, unsupported programs and detached references',()=>{
 const context=fixture(),mutations=[
  c=>{c.source.events[0].date='2026-02-30';},c=>{c.source.events[0].time='14:00';},c=>{c.source.events[0].scheduledAt='2026-01-28T19:00:00.000Z';},c=>{c.source.events[0].datePrecision='minute';},c=>{c.source.events[0].program='fomc-speech';},c=>{c.source.events[0].scheduleBasis='agency-rule';},c=>{c.source.events[0].seriesIds.reverse();},
  c=>{c.source.events[0].meetingStartDate='2026-01-29';},c=>{c.source.events[0].meetingDate='2026-01-27';},c=>{c.source.events[0].actual=null;},c=>{c.source.events[0].consensus=4.5;},c=>{c.source.events[0].forecast=4.5;},c=>{c.source.events[0].publishedAt=null;},
  c=>{c.source.events.find(r=>r.program==='fomc-minutes').documentUrl='https://example.com/minutes';},c=>{c.source.documents[0].kind='speech';},c=>{c.source.documents[0].documentDate='2026-01-29';},c=>{c.source.documents[0].url+='?published=1';},c=>{c.source.documents[0].publicationEvidence='Verified publication and result';},c=>{c.source.documents[0].publishedAt='2026-01-28T19:00:00.000Z';},
  c=>{c.source.events=c.source.events.filter(r=>r.id!=='fomc-decision-2026-01-28');},c=>{c.source.events=c.source.events.filter(r=>r.id!=='fomc-minutes-2026-02-18');},c=>{c.source.events.find(r=>r.meetingDate==='2026-03-18'&&r.program==='fomc-decision').projectionsAssociated=false;},
 ];
 for(const [i,mutate]of mutations.entries())assert.equal(validateFrozenFomcCalendar(change(context,mutate)),false,'event/document mutation '+i);
});

test('the standalone module replays in a browser realm without imports or Node globals',()=>{
 const code=readFileSync(new URL('../src/fomc-calendar-validation.js',import.meta.url),'utf8');assert.doesNotMatch(code,/^import\s/m);
 const browser=code.replace(/\bexport /g,'')+'\nvalidateFrozenFomcCalendar(JSON.parse(candidate))';
 assert.equal(runInNewContext(browser,{candidate:JSON.stringify(fixture())},{timeout:1000}),true);
 assert.equal(runInNewContext(browser,{candidate:JSON.stringify(change(fixture(),c=>{c.source.events[0].time='14:00';}))},{timeout:1000}),false);
});
