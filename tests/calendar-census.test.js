import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

let adapter;
try { adapter=await import('../scripts/sources/calendar-census.mjs'); }
catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('calendar-census.mjs')) throw error; }
function census() { assert.ok(adapter,'The Census calendar adapter must exist'); return adapter; }
const canonical='https://www.census.gov/economic-indicators/calendar-listview.html';
const archive='https://www.census.gov/economic-indicators/calendar-listview-2026.html';
const name='Advance Monthly Sales for Retail and Food Services';
const row=({title=name,date='November 17, 2026',time='8:30 AM',period='October 2026',hidden='A202611170830'}={})=>`<tr><td><a href="/retail">${title}</a></td><td sorttable_customkey="202611170830">${date}</td><td>${time}</td><td>${period}</td><td class="hiden">${hidden}</td><td class="hiden">A202610</td></tr>`;
const page=(rows=[row()],year=2026,links='')=>`<!DOCTYPE html><html><h3>US Census Bureau: ${year} Economic Indicator Release Schedule: List View</h3>${links}<table id="calendar"><tr><th><span>Indicator</span></th><th>Release Date</th><th>Time</th><th>Period Covered</th><td class="hiden">A202601021000</td><td class="hiden">A202511</td></tr>${rows.join('\n')}</table></html>`;

test('Census parses only advance retail factual schedule fields with an explicit reference month',()=>{
  const result=census().parseCensusCalendar(page([row(),row({title:'Monthly Retail Trade Report',date:'not a selected date'})]),{year:2026,sourceUrl:archive});
  assert.deepEqual(result,{events:[{
    id:'census-retail-sales-october-2026',sourceId:'census',program:'retail-sales',name,agency:'Census',seriesId:'retail',seriesIds:['retail'],topic:'Growth',
    date:'2026-11-17',time:'08:30',scheduledAt:'2026-11-17T13:30:00.000Z',period:null,periodLabel:'October 2026',sourceUrl:archive,sourceUid:null,scheduleBasis:'listed-date',
  }],warnings:[]});
});

test('Census preserves the source period and stable identity through corrected dates and hidden-key errors',()=>{
  const before=census().parseCensusCalendar(page([row({date:'January 14, 2026',period:'November 2025',hidden:'A202512150830'})]),{year:2026,sourceUrl:archive}).events[0];
  const after=census().parseCensusCalendar(page([row({date:'January 15, 2026',period:'November 2025'})]),{year:2026,sourceUrl:archive}).events[0];
  assert.equal(before.date,'2026-01-14');
  assert.equal(before.periodLabel,'November 2025');
  assert.equal(before.id,after.id);
  assert.notEqual(before.scheduledAt,after.scheduledAt);
});

test('Census uses the Eastern daylight saving offset instead of a fixed standard-time offset',()=>{
  const result=census().parseCensusCalendar(page([row({date:'July 16, 2026',period:'June 2026'}),row()]),{year:2026,sourceUrl:archive});
  assert.deepEqual(result.events.map(event=>event.scheduledAt),['2026-07-16T12:30:00.000Z','2026-11-17T13:30:00.000Z']);
});

test('Census skips suspended and unannounced dates without reviving obsolete hidden dates',()=>{
  const result=census().parseCensusCalendar(page([row(),row({date:'Suspended',period:'January 2026'}),row({date:'To be announced at a later date',period:'December 2026'})]),{year:2026,sourceUrl:archive});
  assert.equal(result.events.length,1);
  assert.match(result.warnings.join(' '),/suspended/i);
  assert.match(result.warnings.join(' '),/December 2026/);
});

test('Census matches the exact retail program title and can preserve an entirely suspended schedule',()=>{
  const result=census().parseCensusCalendar(page([row({date:'Suspended'}),row({title:`Annual Revisions to ${name}`,date:'not selected'})]),{year:2026,sourceUrl:archive});
  assert.deepEqual(result.events,[]);
  assert.equal(result.warnings.length,1);
});

test('Census rejects wrong calendars, unsafe URLs, malformed selected rows and changed header schema',()=>{
  for(const html of [null,'<html>Access Denied</html>',page().replace('id="calendar"','id="other"'),page([],2026),page([row()],2027),page().replace('<th>Time</th>','<th>Other</th>'),page().replace('</table>',''),page().replace('<td>8:30 AM</td>','<td>8:30 AM'),page().replace('<td>8:30 AM</td>','<td hidden>8:30 AM</td>')]) {
    assert.throws(()=>census().parseCensusCalendar(html,{year:2026,sourceUrl:archive}),/Census|schema|calendar|row|year|coverage/i);
  }
  for(const sourceUrl of ['https://vendor.example/economic-indicators/calendar-listview-2026.html',`${archive}?other=1`,'https://www.census.gov/retail/index.html']) assert.throws(()=>census().parseCensusCalendar(page(),{year:2026,sourceUrl}),/URL|source/i);
  assert.throws(()=>census().parseCensusCalendar(' '.repeat(2*1024*1024)+page(),{year:2026,sourceUrl:archive}),/limit|size/i);
});

test('Census rejects impossible dates, unexpected clocks, missing periods and duplicate program periods',()=>{
  for(const entry of [row({date:'February 30, 2026'}),row({date:'November 17, 2027'}),row({date:'Nov 17, 2026'}),row({time:'13:30 PM'}),row({time:'8:61 AM'}),row({time:'8:30'}),row({period:'Autumn 2026'}),row({period:''})]) assert.throws(()=>census().parseCensusCalendar(page([entry]),{year:2026,sourceUrl:archive}),/date|time|period|year/i);
  assert.throws(()=>census().parseCensusCalendar(page([row(),row({date:'November 18, 2026'})]),{year:2026,sourceUrl:archive}),/duplicate/i);
  assert.throws(()=>census().parseCensusCalendar(page([row({date:'Suspended'}),row()]),{year:2026,sourceUrl:archive}),/duplicate/i);
});

test('Census collection follows a discovered current-year archive after canonical year rollover',async()=>{
  const current=page([row()]);
  const next=page([row({date:'January 15, 2027',period:'December 2026'})],2027,`<a href="/economic-indicators/calendar-listview-2026.html">2026 Economic Indicator Calendar</a>`);
  const responses=new Map([[canonical,next],[archive,current]]);
  const result=await census().collectCensusCalendar({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async url=>{
    assert.ok(responses.has(url),'Only published official calendar links may be fetched');
    return new Response(responses.get(url),{headers:{'last-modified':'Wed, 21 Oct 2026 12:00:00 GMT'}});
  }});
  assert.equal(result.id,'census');
  assert.match(result.agency,/U\.S\. Census Bureau.*Advance Monthly Retail Trade Survey/);
  assert.deepEqual(result.coveredYears,[2026,2027]);
  assert.deepEqual(result.events.map(event=>event.date),['2026-11-17','2027-01-15']);
  assert.equal(result.provenance.length,2);
  for(const source of result.provenance) {
    assert.equal(source.sha256,createHash('sha256').update(responses.get(source.url)).digest('hex'));
    assert.equal(source.lastModified,'Wed, 21 Oct 2026 12:00:00 GMT');
    assert.ok(!('text' in source));
  }
  assert.equal(result.fetchedAt,result.provenance.at(-1).retrievedAt);
  assert.match(result.coverageNote,/Advance Monthly Retail Trade Survey/);
  assert.match(result.coverageNote,/2027-01-15/);
});

test('Census current-year canonical coverage stays explicit when no following year is published',async()=>{
  const result=await census().collectCensusCalendar({now:new Date('2026-01-01T02:00:00Z'),fetchImpl:async url=>{
    assert.equal(url,canonical);
    return new Response(page([row({date:'December 17, 2025',period:'November 2025'})],2025));
  }});
  assert.deepEqual(result.coveredYears,[2025]);
  assert.match(result.warnings.join(' '),/2026.*not.*published|not.*published.*2026/i);
  assert.match(result.coverageNote,/Eastern/);
});

test('Census collection fails instead of dropping the current year when an archive link is absent or unsafe',async()=>{
  for(const links of ['',`<a href="https://vendor.example/economic-indicators/calendar-listview-2026.html">2026</a>`,`<a href="/economic-indicators/calendar-listview-2026.html?unreviewed=1">2026</a>`]) {
    await assert.rejects(census().collectCensusCalendar({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async()=>new Response(page([row({date:'January 15, 2027',period:'December 2026'})],2027,links))}),/archive|current.year|URL|source/i);
  }
  await assert.rejects(census().collectCensusCalendar({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async url=>url===canonical?new Response(page([row({date:'January 15, 2027',period:'December 2026'})],2027,`<a href="${archive}">2026</a>`)):new Response('Unavailable',{status:503})}),/HTTP.*503/i);
});

test('Census collection rejects stale canonical years, challenge HTML, redirects and oversized responses',async()=>{
  for(const html of [page([row()],2025),page([row()],2028),'<html>Challenge</html>']) await assert.rejects(census().collectCensusCalendar({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async()=>new Response(html)}),/Census|year|schema|calendar/i);
  await assert.rejects(census().collectCensusCalendar({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async()=>{const response=new Response(page());Object.defineProperty(response,'url',{value:'https://vendor.example/calendar'});return response;}}),/URL|source|redirect/i);
  await assert.rejects(census().collectCensusCalendar({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:async()=>new Response(' '.repeat(2*1024*1024+1))}),/limit/i);
});
