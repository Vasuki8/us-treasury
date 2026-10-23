import test from 'node:test';
import assert from 'node:assert/strict';
let adapter;
try{adapter=await import('../scripts/sources/calendar-fomc.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('calendar-fomc.mjs'))throw error;}
const source=()=>{assert.ok(adapter,'The date-precision FOMC source must exist');return adapter;};
const block=(month,date,body='')=>`<div class="row fomc-meeting"><div class="fomc-meeting__month"><strong>${month}</strong></div><div class="fomc-meeting__date">${date}</div>${body}</div>`;
const html=()=>`<h4>2026 FOMC Meetings</h4>${block('September','15-16*','<a href="/newsevents/pressreleases/monetary20260916a.htm">HTML</a><a href="/monetarypolicy/fomcprojtabl20260916.htm">HTML</a><a href="/monetarypolicy/fomcminutes20260916.htm">HTML</a>(Released October 07, 2026)')}${block('October','27-28')}${block('December','8-9*')}<h4>2027 FOMC Meetings</h4>${block('January','26-27')}`;

test('FOMC dates remain date-only with separate explicitly dated minutes and associated projection documents',()=>{
  const result=source().parseFomcCalendar(html(),{years:[2026,2027]});
  const decision=result.events.find(row=>row.id==='fomc-decision-2026-10-28'),minutes=result.events.find(row=>row.program==='fomc-minutes');
  assert.equal(decision.date,'2026-10-28');assert.equal(decision.scheduledAt,null);assert.equal(decision.time,null);assert.equal(decision.datePrecision,'day');
  assert.equal(minutes.date,'2026-10-07');assert.equal(minutes.meetingDate,'2026-09-16');assert.equal(minutes.scheduledAt,null);
  assert.ok(result.events.every(row=>!Object.hasOwn(row,'publishedAt')&&!Object.hasOwn(row,'actual')));
  const projection=result.documents.find(row=>row.kind==='projections');assert.equal(projection.documentDate,'2026-09-16');assert.match(projection.url,/fomcprojtabl20260916.htm$/);
  assert.equal(result.events.filter(row=>row.program==='fomc-minutes').length,1,'No 21-day inferred minutes dates');
});

test('FOMC parser rejects link/date mismatch, unexpected origin and duplicate meeting dates',()=>{
  assert.throws(()=>source().parseFomcCalendar(html().replace('monetary20260916a.htm','monetary20260917a.htm'),{years:[2026,2027]}),/date|FOMC|link/i);
  assert.throws(()=>source().parseFomcCalendar(html().replace('/monetarypolicy/fomcminutes','https://example.com/monetarypolicy/fomcminutes'),{years:[2026,2027]}),/source|FOMC|link/i);
  assert.throws(()=>source().parseFomcCalendar(html()+block('January','26-27'),{years:[2026,2027]}),/duplicate|FOMC/i);
});

test('FOMC collector retains the current calendar when the following year has not yet been published',async()=>{
  const current=html().slice(0,html().indexOf('<h4>2027'));
  const result=await source().collectFomcCalendar({now:new Date('2026-01-02T15:00:00Z'),fetchImpl:async()=>new Response(current)});
  assert.deepEqual(result.coveredYears,[2026]);assert.match(result.warnings.join(' '),/following year|2027/);
  assert.equal(result.events[0].scheduledAt,null);
});
