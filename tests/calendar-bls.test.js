import test from 'node:test';
import assert from 'node:assert/strict';

let adapter;
try { adapter = await import('../scripts/sources/calendar-bls.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('calendar-bls.mjs')) throw error; }
function bls() { assert.ok(adapter, 'The BLS calendar adapter must exist'); return adapter; }

const annual=year=>`https://www.bls.gov/schedule/${year}/home.htm`;
const row=(date='Friday, November 6, 2026',time='08:30 AM',name='Employment Situation',period='October 2026')=>`<tr class="release-list-even-row"><td class="date-cell"><p>${date}</p></td><td class="time-cell"><p>${time}</p></td><td class="desc-cell"><p><strong>${name}</strong>${period===null?'':` for ${period}`}</p></td></tr>`;
const page=(rows,year=2026)=>`<!DOCTYPE HTML><html><head><title>Schedule of Selected Releases ${year}</title></head><body><table class="release-list"><thead><tr><th>Date</th><th>Time</th><th>Release</th></tr></thead><tbody>${rows.join('\n')}</tbody></table><p>NOTE: All times on calendar are Eastern Time.</p></body></html>`;

test('BLS annual schedule parses explicit publication times and reference labels with all related indicators', () => {
  const events=bls().parseBlsCalendar(page([
    row(),row('Tuesday, November 3, 2026','10:00 AM','Job Openings and Labor Turnover Survey','September 2026'),
    row('Tuesday, November 10, 2026','08:30 AM','Consumer Price Index','October 2026'),
    row('Wednesday, November 11, 2026','&nbsp;',"Veterans Day",null),
  ]),{year:2026});
  assert.equal(events.length,3);
  assert.deepEqual(events.map(event=>event.date),['2026-11-03','2026-11-06','2026-11-10']);
  assert.deepEqual(events[1],{
    id:'bls-employment-situation-october-2026',sourceId:'bls',program:'employment-situation',name:'Employment Situation',agency:'BLS',
    seriesId:'unrate',seriesIds:['unrate','payroll','participation','wages'],topic:'Labor',date:'2026-11-06',time:'08:30',
    scheduledAt:'2026-11-06T13:30:00.000Z',period:null,periodLabel:'October 2026',sourceUrl:annual(2026),sourceUid:null,
  });
  assert.equal(events[0].program,'job-openings');
  assert.deepEqual(events[0].seriesIds,['openings']);
  assert.equal(events[2].topic,'Inflation');
  assert.deepEqual(events[2].seriesIds,['cpi']);
});

test('BLS event identity survives schedule corrections without inventing source identifiers', () => {
  const before=bls().parseBlsCalendar(page([row()]),{year:2026})[0];
  const after=bls().parseBlsCalendar(page([row('Monday, November 9, 2026')]),{year:2026})[0];
  assert.equal(before.id,after.id);
  assert.notEqual(before.scheduledAt,after.scheduledAt);
  assert.equal(after.sourceUid,null);
});

test('BLS captures January tables nested inside the official page layout table', () => {
  const html=page([row()]).replace('<body>','<body><table id="layout"><tr><td>').replace('</body>','</td></tr></table></body>');
  const events=bls().parseBlsCalendar(html,{year:2026});
  assert.equal(events.length,1);
  assert.equal(events[0].periodLabel,'October 2026');
});

test('BLS parser rejects unrelated pages, calendar schema drift and an unexpected source year', () => {
  for (const html of [
    '<html>Access Denied</html>',page([row()]).replace('Schedule of Selected Releases 2026','Other Calendar 2026'),
    page([row()],2027),page([row()]).replace('Eastern Time','Pacific Time'),page([row()]).replaceAll('release-list','renamed'),
    page([row()]).replace('<th>Time</th>','<th>Other</th>'),page([row()]).replace('time-cell','other-cell'),
    page([row()]).replace('</tbody>',''),null,
  ]) assert.throws(()=>bls().parseBlsCalendar(html,{year:2026}),/BLS|calendar|schema|year|table|time/i);
  assert.throws(()=>bls().parseBlsCalendar(page([row()]),{year:'2026'}),/year/i);
  assert.throws(()=>bls().parseBlsCalendar(' '.repeat(2*1024*1024)+page([row()]),{year:2026}),/size|limit/i);
});

test('BLS parser rejects impossible or mismatched dates, clocks and missing source reference periods', () => {
  for (const entry of [
    row('Friday, February 30, 2026'),row('Thursday, November 6, 2026'),row('Friday, November 6, 2027'),
    row(undefined,'13:30 PM'),row(undefined,'08:61 AM'),row(undefined,'08:30'),row(undefined,'&nbsp;'),
    row(undefined,undefined,undefined,null),row(undefined,undefined,undefined,''),row(undefined,undefined,undefined,'Autumn 2026'),
  ]) assert.throws(()=>bls().parseBlsCalendar(page([entry]),{year:2026}),/date|time|period|reference|year/i);
});

test('BLS parser rejects repeated release periods and empty relevant coverage', () => {
  assert.throws(()=>bls().parseBlsCalendar(page([row(),row()]),{year:2026}),/duplicate/i);
  assert.throws(()=>bls().parseBlsCalendar(page([row(),row('Monday, November 9, 2026')]),{year:2026}),/duplicate/i);
  assert.throws(()=>bls().parseBlsCalendar(page([row(undefined,undefined,'Real Earnings')]),{year:2026}),/events|coverage|releases/i);
});

test('BLS calendar collection keeps checked provenance and describes uneven program coverage', async () => {
  const current=page([row(),row('Tuesday, December 1, 2026','10:00 AM','Job Openings and Labor Turnover Survey','October 2026')]);
  const next=page([row('Friday, January 8, 2027','08:30 AM','Employment Situation','December 2026'),row('Wednesday, January 13, 2027','08:30 AM','Consumer Price Index','December 2026')],2027);
  const result=await bls().collectBlsCalendar({pause:async()=>{},now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async url=>new Response(url===annual(2026)?current:next,{headers:{'last-modified':'Wed, 21 Oct 2026 12:00:00 GMT'}})});
  assert.equal(result.id,'bls');
  assert.equal(result.agency,'U.S. Bureau of Labor Statistics');
  assert.equal(result.events.length,4);
  assert.equal(result.provenance.length,2);
  assert.deepEqual(result.provenance.map(entry=>entry.url),[annual(2026),annual(2027)]);
  for(const entry of result.provenance){assert.match(entry.sha256,/^[a-f\d]{64}$/);assert.ok(!('text' in entry));}
  assert.equal(result.fetchedAt,result.provenance.at(-1).retrievedAt);
  assert.match(result.coverageNote,/job openings.*2026-12-01/i);
  assert.match(result.coverageNote,/employment situation.*2027-01-08/i);
  assert.deepEqual(result.coveredYears,[2026,2027]);
  assert.deepEqual(result.failedYears,[]);
});

test('BLS next-year unavailability preserves current rows and explicitly reports the missing year', async () => {
  const result=await bls().collectBlsCalendar({pause:async()=>{},now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async url=>url===annual(2026)?new Response(page([row()])):new Response('Not found',{status:404})});
  assert.equal(result.events.length,1);
  assert.deepEqual(result.coveredYears,[2026]);
  assert.deepEqual(result.failedYears,[2027]);
  assert.match(result.warnings.join(' '),/2027.*unavailable|unavailable.*2027/i);
  assert.match(result.coverageNote,/2027/);
});

test('BLS current-year source failure prevents treating partial or redirected content as a verified schedule', async () => {
  await assert.rejects(bls().collectBlsCalendar({pause:async()=>{},now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async()=>new Response('Unavailable',{status:503})}),/HTTP.*503/i);
  await assert.rejects(bls().collectBlsCalendar({pause:async()=>{},now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async()=>new Response('<html>Challenge</html>')}),/BLS|schema|calendar/i);
  await assert.rejects(bls().collectBlsCalendar({pause:async()=>{},now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async()=>{const response=new Response(page([row()]));Object.defineProperty(response,'url',{value:'https://vendor.example/calendar'});return response;}}),/URL|source|redirect/i);
  await assert.rejects(bls().collectBlsCalendar({pause:async()=>{},now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async()=>new Response(' '.repeat(2*1024*1024+1))}),/limit/i);
});

test('BLS calendar requests identify the bot and an owner contact URL', async () => {
  const requests=[];
  await bls().collectBlsCalendar({pause:async()=>{},now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async(url,options)=>{
    requests.push({url,headers:options.headers});
    return new Response(url===annual(2026)?page([row()]):page([row('Friday, January 8, 2027','08:30 AM','Employment Situation','December 2026')],2027));
  }});
  assert.equal(requests.length,2);
  for(const request of requests) {
    assert.equal(request.headers['User-Agent'],'us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)');
    assert.equal(request.headers.Accept,'text/html');
  }
});

test('BLS calendar waits at least one second after the current schedule before requesting the next year', async () => {
  const order=[];
  await bls().collectBlsCalendar({now:new Date('2026-10-21T12:00:00Z'),pause:async milliseconds=>{
    assert.ok(milliseconds>=1000);
    order.push('pause');
    await Promise.resolve();
    order.push('pause-complete');
  },fetchImpl:async url=>{
    order.push(url);
    if(url===annual(2026)) {
      await Promise.resolve();
      order.push('current-response');
      return new Response(page([row()]));
    }
    return new Response(page([row('Friday, January 8, 2027','08:30 AM','Employment Situation','December 2026')],2027));
  }});
  assert.deepEqual(order,[annual(2026),'current-response','pause','pause-complete',annual(2027)]);
});

test('BLS current-year access denial stops before waiting or making another request', async () => {
  const requests=[],pauses=[];
  await assert.rejects(bls().collectBlsCalendar({now:new Date('2026-10-21T12:00:00Z'),pause:async milliseconds=>pauses.push(milliseconds),fetchImpl:async url=>{
    requests.push(url);
    return new Response('Access Denied',{status:403});
  }}),/HTTP.*403/i);
  assert.deepEqual(requests,[annual(2026)]);
  assert.deepEqual(pauses,[]);
});
