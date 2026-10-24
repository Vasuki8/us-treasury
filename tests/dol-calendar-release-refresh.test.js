import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDolCalendar} from '../scripts/sources/calendar-dol.mjs';
import {parseDolAdvanceText} from '../scripts/sources/dol-advance.mjs';
import {refreshSnapshot} from '../scripts/sources/refresh.mjs';
import {getReleaseRefreshPlan} from '../src/release-operations.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {releaseFixture} from './helpers/dol-advance-fixture.js';

const scheduleUrl='https://oui.doleta.gov/unemploy/claims_arch.asp';
const pdfUrl='https://www.dol.gov/ui/data.pdf';
const html='<p>Publication Schedule: The UI Weekly Claims News Release is published each week on Thursday morning at 8:30am EST. Exceptions to this schedule occur when a Thursday falls on a Federal Holiday. The following is a list of dates when the weekly news release will be published on a day other than Thursday:</p><table><thead><tr><th>Release Date</th><th>Release Time</th></tr></thead><tbody><tr><td>Wednesday, November 25, 2026</td><td>8:30 AM EST</td></tr><tr><td>Wednesday, November 10, 2027</td><td>8:30 AM EST</td></tr><tr><td>Wednesday, November 24, 2027</td><td>8:30 AM EST</td></tr></tbody></table>';
const receipt=(url,at)=>({url,sha256:'a'.repeat(64),retrievedAt:at,lastModified:null});
async function fullRefresh(at){
 const now=new Date(at);
 return refreshSnapshot({now,
  collectors:{dolAdvance:async()=>({...parseDolAdvanceText(releaseFixture(),{now}),fetchedAt:at,provenance:[receipt(pdfUrl,at)],warnings:[]})},
  calendarCollectors:{dol:async()=>({id:'dol',agency:'U.S. Department of Labor, Employment and Training Administration',...parseDolCalendar(html,{now}),fetchedAt:at,provenance:[receipt(scheduleUrl,at)]})},
 });
}

for(const [name,at,date,nominalDate,scheduledAt] of [
 ['Thursday','2026-10-29T12:45:00.000Z','2026-10-29','2026-10-29','2026-10-29T12:30:00.000Z'],
 ['Wednesday holiday exception','2026-11-25T13:45:00.000Z','2026-11-25','2026-11-26','2026-11-25T13:30:00.000Z'],
])test(`late full refresh preserves the ${name} schedule and retries a freshly retrieved older PDF`,async()=>{
 const snapshot=await fullRefresh(at);
 assertCommercialData(snapshot);
 assert.equal(snapshot.sources.dolAdvance.status,'ok');
 assert.equal(snapshot.sources.dolAdvance.releaseDate,'2026-10-22');
 assert.equal(snapshot.sources.dolAdvance.fetchedAt,at);
 const due=snapshot.releases.find(event=>event.date===date);
 assert.ok(due,'The current-day official schedule must survive the full refresh.');
 assert.equal(due.nominalDate,nominalDate);
 assert.equal(due.scheduledAt,scheduledAt);
 assert.equal(due.publishedAt,undefined);
 const plan=getReleaseRefreshPlan(snapshot,{now:new Date(at)});
 assert.equal(plan.required,true);
 assert.deepEqual(plan.sources,['dolAdvance']);
 assert.equal(plan.events[0].evidenceStatus,'unverified');
});

test('full refresh keeps the current Eastern release day across UTC midnight and drops it on the next Eastern date',async()=>{
 const before=await fullRefresh('2026-10-30T03:59:59.000Z');
 assert.equal(before.calendar.sources.dol.coverageStart,'2026-10-29');
 assert.equal(before.releases[0].date,'2026-10-29');
 assert.equal(getReleaseRefreshPlan(before,{now:new Date('2026-10-30T03:59:59Z')}).required,false,'Elapsed retry windows remain bounded.');
 const after=await fullRefresh('2026-10-30T04:00:00.000Z');
 assert.equal(after.calendar.sources.dol.coverageStart,'2026-10-30');
 assert.equal(after.releases[0].date,'2026-11-05');
 assert.ok(after.releases.every(event=>event.date>='2026-10-30'));
});
