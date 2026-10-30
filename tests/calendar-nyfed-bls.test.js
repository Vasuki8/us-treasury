import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {OfficialSourceHttpError} from '../scripts/sources/http.mjs';
import {assertNyFedBlsCalendar} from '../scripts/bls-alternate-policy.mjs';
import {refreshSnapshot} from '../scripts/sources/refresh.mjs';

let adapter;
try {adapter=await import('../scripts/sources/calendar-nyfed-bls.mjs');}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('calendar-nyfed-bls.mjs'))throw error;}
const nyfed=()=>{assert.ok(adapter,'The New York Fed BLS calendar adapter must exist');return adapter;};
const anchor='https://www.newyorkfed.org/research/calendars/nationalecon_cal.html';
const octoberUrl='https://www.newyorkfed.org/research/calendars/i-oct26.html';
const novemberUrl='https://www.newyorkfed.org/research/calendars/i-nov26.html';
const decemberUrl='https://www.newyorkfed.org/research/calendars/i-dec26.html';
const januaryUrl='https://www.newyorkfed.org/research/calendars/i-jan27.html';
const names={'Employment Situation':'empsit','Consumer Price Index':'cpi',JOLTS:'jolts'};
const entry=(name,time=name==='JOLTS'?'10:00':'08:30',href=`https://www.bls.gov/news.release/${names[name]??'other'}.toc.htm`)=>`<a href="${href}" target="_NEW">${name}</a><br/>(${time})<br/><br/>`;
// The two official markup styles differ in tbody wrappers and attribute order.
const page=(month,weeks,next='',modern=false)=>`<!doctype html><title>Economic Indicators Calendar - FEDERAL RESERVE BANK of NEW YORK</title><div class="ts-article-title">Economic Indicators Calendar</div><div class="ts-article-text">Provides the date and time of key economic data releases (all Eastern Time).</div><table><tr><td class="ts-data-table-head"><div>${month}</div></td><td>${next?`<a href="${next}">NEXT MONTH&nbsp;<img alt="Next Month"></a>`:''}</td></tr></table><table class="research-table-1col greyborder">${modern?'<tbody>':''}<tr class="tdtblhdr">${['','Monday','Tuesday','Wednesday','Thursday','Friday',''].map(label=>`<td>${label||'&nbsp;'}</td>`).join('')}</tr>${weeks.map(week=>`<tr valign="top"><td class="somatdR dirColR">&nbsp;</td>${week.map(value=>{const [day,content]=Array.isArray(value)?value:[value,''];return `<td ${modern?'class="somatdR dirColL" style="width:104px"':'width="104" class="somatdR dirColL"'}>${day?`<div>${String(day).padStart(2,'0')}<br/><br/><span class="ts-accordion-content">${content}</span></div>`:''}</td>`;}).join('')}<td class="somatdR dirColL">&nbsp;</td></tr>`).join('')}${modern?'</tbody>':''}</table><p>Dates and times are tentative and subject to immediate change.</p>`;
const november=(next=decemberUrl)=>page('November 2026',[[2,[3,entry('JOLTS')],4,5,[6,entry('Employment Situation')]],[9,[10,entry('Consumer Price Index')],11,12,13]],next);
const october=()=>page('October 2026',[[null,null,null,1,[2,entry('Employment Situation')]],[12,13,[14,entry('Consumer Price Index')],15,16]],novemberUrl,true);
const december=(next=januaryUrl)=>page('December 2026',[[null,[1,entry('JOLTS')],2,3,[4,entry('Employment Situation')]],[7,8,9,[10,entry('Consumer Price Index')],11]],next);
const january=(next='')=>page('January 2027',[[4,5,6,7,[8,entry('Employment Situation')]],
 [11,12,[13,entry('Consumer Price Index')],14,15]],next);
function withPrevious(html,url=octoberUrl){
 return html.replace('<td class="ts-data-table-head">',
  `<td><a href="${url}">PREVIOUS MONTH</a></td><td class="ts-data-table-head">`);
}

test('New York Fed parses only an unambiguous reviewed sequential previous-month link',()=>{
 const parsed=nyfed().parseNyFedBlsCalendar(withPrevious(november(),'./i-oct26.html'),{url:anchor});
 assert.equal(parsed.previousUrl,octoberUrl);assert.equal(parsed.nextUrl,decemberUrl);
 for(const html of [
  withPrevious(withPrevious(november())),withPrevious(november(),novemberUrl),withPrevious(november(),anchor),
  withPrevious(november(),'https://vendor.example/i-oct26.html'),withPrevious(november(),octoberUrl+'?copy=1'),
  withPrevious(november()).replace(`href="${octoberUrl}"`,''),
  withPrevious(november()).replace(`href="${octoberUrl}"`,`href="${octoberUrl}" href="${octoberUrl}"`),
 ])assert.throws(()=>nyfed().parseNyFedBlsCalendar(html,{url:anchor}),/previous|sequential|ambiguous|source URL/i);
});

test('New York Fed acquires the current month when its index advances early without duplicating the index month',async()=>{
 const pages=new Map([[anchor,withPrevious(november())],[octoberUrl,october()],[decemberUrl,december()]]);
 const requests=[],pauses=[];
 const result=await nyfed().collectNyFedBlsCalendar({now:new Date('2026-10-30T19:00:00Z'),pause:async ms=>pauses.push(ms),
  fetchImpl:async url=>{requests.push(url);assert.ok(pages.has(url),'Only published discovered pages may be requested');
   return new Response(pages.get(url));},
 });
 assert.deepEqual(requests,[anchor,octoberUrl,decemberUrl]);assert.deepEqual(pauses,[1000,1000]);
 assert.equal(result.indexMonth,'2026-11');assert.deepEqual(result.coveredMonths,['2026-10','2026-11','2026-12']);
 assert.deepEqual(result.unavailableMonths,[]);assert.equal(result.coverageStart,'2026-10-01');assert.equal(result.coverageEnd,'2026-12-31');
 assert.equal(result.events.length,8);assert.equal(result.fetchedAt,result.provenance.at(-1).retrievedAt);
 assert.deepEqual(result.provenance.map(item=>item.url),requests);
 for(const event of result.events){
  const expected={'2026-10':octoberUrl,'2026-11':anchor,'2026-12':decemberUrl}[event.date.slice(0,7)];
  assert.equal(event.sourceUrl,expected);assert.equal(event.period,null);assert.equal(event.scheduleBasis,'secondary-calendar');
 }
});

test('advanced-index calendar capture passes admission and the required-refresh guard with truthful receipts',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-30T19:00:00Z')});
 const pages=new Map([[anchor,withPrevious(november())],[octoberUrl,october()],[decemberUrl,december()]]);
 const collect=({now})=>nyfed().collectNyFedBlsCalendar({now,pause:async()=>{},fetchImpl:async url=>{
  assert.ok(pages.has(url));return new Response(pages.get(url));
 }});
 const next=await refreshSnapshot({calendarCollectors:{bls:collect},now:new Date(),requireAll:true});
 const source=next.calendar.sources.bls;
 assert.equal(source.status,'ok');assertNyFedBlsCalendar(source);
 assert.equal(source.indexMonth,'2026-11');assert.equal(source.coverageStart,'2026-10-01');
 assert.ok(source.provenance.every(row=>row.retrievedAt==='2026-10-30T19:00:00.000Z'));
});

test('advanced-index discovery preserves the required current-month failure safeguards and prior capture',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-10-30T19:00:00Z')});
 const old=await nyfed().collectNyFedBlsCalendar({pause:async()=>{},fetchImpl:async url=>
  new Response(url===anchor?october():url===novemberUrl?november():december())});
 const previous={calendar:{sources:{bls:{...old,status:'ok'}}}},before=structuredClone(previous);
 const failures=[
  ['404',()=>new Response('Not found',{status:404})],['403',()=>new Response('Denied',{status:403})],
  ['missing-page redirect',()=>new Response('',{status:302,headers:{location:'/errors/404'}})],
  ['other redirect',()=>new Response('',{status:301,headers:{location:novemberUrl}})],
  ['wrong month',()=>new Response(november())],['invalid table',()=>new Response('<html>Challenge</html>')],
 ];
 for(const [name,response]of failures)for(const mode of [{requireAll:true},{allowCachedBlsData:true}]){
  const requests=[];
  const collect=({now})=>nyfed().collectNyFedBlsCalendar({now,pause:async()=>{},fetchImpl:async url=>{
   requests.push(url);return url===anchor?new Response(withPrevious(november())):response();
  }});
  await assert.rejects(refreshSnapshot({previous,calendarCollectors:{bls:collect},now:new Date(),...mode}),
   /Required official refresh failed; snapshot was not replaced.*bls calendar/,name);
  assert.deepEqual(requests,[anchor,octoberUrl],name);assert.deepEqual(previous,before,name);
 }
});

test('advanced-index discovery rejects missing navigation and indexes more than one month away',async()=>{
 for(const [html,time]of [
  [november(),'2026-10-30T12:00:00Z'],[withPrevious(december(),novemberUrl),'2026-10-30T12:00:00Z'],
  [october(),'2026-12-01T12:00:00Z'],
 ]){
  const requests=[];
  await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date(time),pause:async()=>{},fetchImpl:async url=>{
   requests.push(url);return new Response(html);
  }}),/month|link/i);
  assert.deepEqual(requests,[anchor]);
 }
});

test('advanced-index discovery respects Eastern month and December-to-January boundaries',async t=>{
 t.mock.timers.enable({apis:['Date'],now:new Date('2026-12-31T23:00:00Z')});
 const requests=[],february='https://www.newyorkfed.org/research/calendars/i-feb27.html';
 const advanced=withPrevious(january(february),decemberUrl);
 const source=await nyfed().collectNyFedBlsCalendar({pause:async()=>{},fetchImpl:async url=>{
  requests.push(url);return url===anchor?new Response(advanced):url===decemberUrl?new Response(december()):new Response('',{status:404});
 }});
 assert.deepEqual(requests,[anchor,decemberUrl,february]);assertNyFedBlsCalendar(source);
 assert.equal(source.indexMonth,'2027-01');assert.deepEqual(source.coveredMonths,['2026-12','2027-01']);
 assert.deepEqual(source.unavailableMonths,['2027-02']);assert.equal(source.coverageEnd,'2027-01-31');
 for(const [time,start,expected]of [
  ['2026-11-01T03:59:59Z','2026-10-01',[anchor,octoberUrl,decemberUrl]],
  ['2026-11-01T04:00:00Z','2026-11-01',[anchor,decemberUrl,januaryUrl]],
 ]){
  t.mock.timers.setTime(Date.parse(time));
  const urls=[];
  const result=await nyfed().collectNyFedBlsCalendar({now:new Date(time),pause:async()=>{},fetchImpl:async url=>{
   urls.push(url);return new Response(url===anchor?withPrevious(november()):url===octoberUrl?october():
    url===decemberUrl?december():january());
  }});
  assert.equal(result.coverageStart,start);assert.deepEqual(urls,expected);assertNyFedBlsCalendar(result);
 }
});

test('New York Fed parses legacy markup with explicit provider, times and no invented reference periods',()=>{
 const result=nyfed().parseNyFedBlsCalendar(november(),{url:novemberUrl,expectedMonth:'2026-11'});
 assert.equal(result.month,'2026-11');assert.equal(result.nextUrl,decemberUrl);
 assert.deepEqual(result.events.map(event=>event.date),['2026-11-03','2026-11-06','2026-11-10']);
 assert.deepEqual(result.events[1],{id:'bls-employment-situation-2026-11-06',sourceId:'bls',provider:'new-york-fed',program:'employment-situation',seriesId:'unrate',seriesIds:['unrate','payroll','participation','wages'],topic:'Labor',name:'Employment Situation',agency:'BLS',date:'2026-11-06',time:'08:30',scheduledAt:'2026-11-06T13:30:00.000Z',period:null,periodLabel:null,sourceUrl:novemberUrl,sourceUid:null,scheduleBasis:'secondary-calendar'});
 assert.equal(result.events[0].program,'job-openings');assert.deepEqual(result.events[2].seriesIds,['cpi']);
 for(const event of result.events){assert.equal(event.period,null);assert.equal(event.periodLabel,null);assert.equal(event.provider,'new-york-fed');}
});

test('New York Fed parses modern tbody markup and resolves the Eastern daylight saving offset',()=>{
 const result=nyfed().parseNyFedBlsCalendar(october(),{url:anchor,expectedMonth:'2026-10'});
 assert.deepEqual(result.events.map(event=>event.scheduledAt),['2026-10-02T12:30:00.000Z','2026-10-14T12:30:00.000Z']);
 assert.equal(result.events.length,2,'October has no listed JOLTS release; no cadence is inferred');
 assert.equal(result.nextUrl,novemberUrl);
});

test('New York Fed accepts calendar days with no releases or accordion span',()=>{
 const html=october().replace('<div>12<br/><br/><span class="ts-accordion-content"></span></div>','<div>12\n</div>');
 const result=nyfed().parseNyFedBlsCalendar(html,{url:anchor,expectedMonth:'2026-10'});
 assert.equal(result.events.length,2);
});

test('New York Fed accepts an explicit final month-end row without trailing out-of-month cells',()=>{
 const partial=(day)=>`<tr valign="top"><td class="somatdR dirColR">&nbsp;</td><td class="somatdR dirColL"><div>${day}</div></td></tr>`;
 const html=november().replace('</table><p>',`${partial('30')}</table><p>`);
 assert.equal(nyfed().parseNyFedBlsCalendar(html,{url:novemberUrl}).events.length,3);
 assert.throws(()=>nyfed().parseNyFedBlsCalendar(november().replace('</table><p>',`${partial('23')}</table><p>`),{url:novemberUrl}),/row|schema|month/i);
});

test('New York Fed rejects altered title, timezone, month, weekday columns and malformed calendar rows',()=>{
 for(const html of [null,'<html>Access Denied</html>',november().replace(' - FEDERAL RESERVE BANK of NEW YORK',' - Other Publisher'),november().replace('(all Eastern Time)','(all Central Time)'),november().replace('November 2026','November 2027'),november().replace('Monday</td>','Sunday</td>'),november().replace('<div>03','<div>04'),november().replace('<div>03','<div>33'),november().replace('research-table-1col greyborder','other'),november().replace('</table><p>','<p>'),november().replace('<td width="104" class="somatdR dirColL"><div>03','<td hidden width="104" class="somatdR dirColL"><div>03')])assert.throws(()=>nyfed().parseNyFedBlsCalendar(html,{url:novemberUrl,expectedMonth:'2026-11'}),/calendar|schema|title|time|month|date|weekday|year|row/i);
 assert.throws(()=>nyfed().parseNyFedBlsCalendar(november(),{url:novemberUrl,expectedMonth:'2026-12'}),/month/i);
 assert.throws(()=>nyfed().parseNyFedBlsCalendar(' '.repeat(2*1024*1024)+november(),{url:novemberUrl}),/limit|size/i);
});

test('New York Fed requires exact reviewed source URLs and sequential discovered next-month links',()=>{
 for(const url of ['https://vendor.example/research/calendars/i-nov26.html',`${novemberUrl}?key=1`,`${novemberUrl}#calendar`,'http://www.newyorkfed.org/research/calendars/i-nov26.html','https://www.newyorkfed.org/research/calendars/i-dec26.html','https://www.newyorkfed.org/research/calendars/i-nov2026.html'])assert.throws(()=>nyfed().parseNyFedBlsCalendar(november(),{url}),/URL|source|month/i);
 for(const next of ['https://vendor.example/calendar',`${decemberUrl}?other=1`,januaryUrl,novemberUrl])assert.throws(()=>nyfed().parseNyFedBlsCalendar(november(next),{url:novemberUrl}),/URL|source|next|month/i);
 assert.equal(nyfed().parseNyFedBlsCalendar(november('/research/calendars/i-dec26.html'),{url:novemberUrl}).nextUrl,decemberUrl);
});

test('New York Fed rejects selected link substitution and missing, malformed or contradictory times',()=>{
 for(const html of [november().replace('/jolts.toc.htm','/cpi.toc.htm'),november().replace('>JOLTS<','>Job Openings and Labor Turnover Survey<'),november().replace('(10:00)','(25:00)'),november().replace('(10:00)',''),november().replace('(10:00)','(10:00 AM)'),november().replace('(10:00)','(10:00) (11:00)'),november().replace('>JOLTS<','><span>JOLTS</span><').replace('https://www.bls.gov/news.release/jolts.toc.htm','https://vendor.example/jolts')])assert.throws(()=>nyfed().parseNyFedBlsCalendar(html,{url:novemberUrl}),/identity|link|time|calendar|row/i);
});

test('New York Fed rejects a selected release whose source anchor loses its href',()=>{
 assert.throws(()=>nyfed().parseNyFedBlsCalendar(november().replace('href="https://www.bls.gov/news.release/jolts.toc.htm"',''),{url:novemberUrl}),/identity|link/i);
});

test('New York Fed rejects duplicate and conflicting program dates while excluding unrelated releases',()=>{
 for(const releases of [entry('JOLTS')+entry('JOLTS'),entry('JOLTS')+entry('JOLTS','11:00')])assert.throws(()=>nyfed().parseNyFedBlsCalendar(page('November 2026',[[2,[3,releases],4,5,6]]),{url:novemberUrl}),/duplicate|conflict/i);
 const result=nyfed().parseNyFedBlsCalendar(page('November 2026',[[2,[3,entry('JOLTS')+entry('Not a selected release','invalid')],4,5,6]]),{url:novemberUrl});
 assert.equal(result.events.length,1);assert.equal(result.events[0].name,'Job Openings and Labor Turnover Survey');
});

test('New York Fed collection follows only three discovered pages and records provenance, rights and coverage',async()=>{
 const pages=new Map([[anchor,october()],[novemberUrl,november()],[decemberUrl,december()]]),requests=[],pauses=[];
 const result=await nyfed().collectNyFedBlsCalendar({now:new Date('2026-10-24T12:00:00Z'),pause:async ms=>pauses.push(ms),fetchImpl:async(url,options)=>{requests.push(url);assert.equal(options.redirect,'manual');assert.equal(options.headers['User-Agent'],'us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)');assert.equal(options.headers.Accept,'text/html');assert.ok(options.signal instanceof AbortSignal);assert.ok(pages.has(url),'No unpublished or synthetic URL may be requested');return new Response(pages.get(url),{headers:{'last-modified':'Sat, 24 Oct 2026 10:00:00 GMT'}});}});
 assert.deepEqual(requests,[anchor,novemberUrl,decemberUrl]);assert.deepEqual(pauses,[1000,1000]);
 assert.equal(result.id,'bls');assert.equal(result.provider,'new-york-fed');assert.equal(result.agency,'BLS · calendar via New York Fed');assert.equal(result.events.length,8);
 assert.deepEqual(result.coveredMonths,['2026-10','2026-11','2026-12']);assert.deepEqual(result.unavailableMonths,[]);assert.equal(result.coverageStart,'2026-10-01');assert.equal(result.coverageEnd,'2026-12-31');
 assert.equal(result.sourceTitle,'Economic Indicators Calendar');assert.equal(result.licenseUrl,'https://www.newyorkfed.org/privacy/termsofuse');assert.equal(result.termsUrl,result.licenseUrl);
 assert.match(result.attribution,/© 2026 Federal Reserve Bank of New York/);assert.match(result.sourceNotice,/tentative|change/i);assert.match(result.sourceNotice,/permissions.*conditions.*restrictions/i);assert.match(result.modificationNotice,/extracted.*UTC.*Meridian/i);assert.match(result.modificationNotice,/endorse/i);
 assert.match(result.coverageNote,/2026-12-31/);assert.match(result.coverageNote,/reference periods.*not supplied|not supply.*reference periods/i);assert.deepEqual(result.warnings,[]);
 assert.equal(result.fetchedAt,result.provenance.at(-1).retrievedAt);
 for(const receipt of result.provenance){assert.equal(receipt.sha256,createHash('sha256').update(pages.get(receipt.url)).digest('hex'));assert.equal(receipt.lastModified,'Sat, 24 Oct 2026 10:00:00 GMT');assert.ok(!('text' in receipt));}
});

test('New York Fed records a future 404 as a bounded explicit horizon across January rollover',async()=>{
 const requests=[];
 const result=await nyfed().collectNyFedBlsCalendar({now:new Date('2026-12-10T12:00:00Z'),pause:async()=>{},fetchImpl:async url=>{requests.push(url);return url===anchor?new Response(december()):new Response('Not found',{status:404});}});
 assert.deepEqual(requests,[anchor,januaryUrl]);assert.deepEqual(result.coveredMonths,['2026-12']);assert.deepEqual(result.unavailableMonths,['2027-01','2027-02']);assert.equal(result.coverageEnd,'2026-12-31');assert.match(result.warnings.join(' '),/2027-01.*404/);
 const captured=await nyfed().collectNyFedBlsCalendar({now:new Date('2026-12-10T12:00:00Z'),pause:async()=>{},fetchImpl:async url=>new Response(url===anchor?december():january())});
 assert.deepEqual(captured.coveredMonths,['2026-12','2027-01']);assert.deepEqual(captured.unavailableMonths,['2027-02']);assert.equal(captured.coverageEnd,'2027-01-31');assert.equal(captured.events.at(-1).scheduledAt,'2027-01-13T13:30:00.000Z');assert.match(captured.warnings.join(' '),/2027-02.*link|link.*2027-02/i);
});

test('New York Fed treats only a future 302 to its exact missing-page route as an explicit coverage horizon',async()=>{
 for(const location of ['/errors/404','https://www.newyorkfed.org/errors/404']){
  const requests=[];let cancelled=0;
  const missing=new Response('Unpublished future calendar',{status:302,headers:{location}});
  Object.defineProperty(missing,'body',{value:{cancel:async()=>{cancelled++;},getReader:()=>{throw new Error('Redirect bodies must not be read');}}});
  const result=await nyfed().collectNyFedBlsCalendar({now:new Date('2026-11-01T12:00:00Z'),pause:async()=>{},fetchImpl:async(url,options)=>{
   requests.push(url);assert.equal(options.redirect,'manual');
   return url===anchor?new Response(november()):url===decemberUrl?new Response(december()):missing;
  }});
  assert.deepEqual(requests,[anchor,decemberUrl,januaryUrl]);assert.equal(cancelled,1);
  assert.deepEqual(result.coveredMonths,['2026-11','2026-12']);assert.deepEqual(result.unavailableMonths,['2027-01']);assert.equal(result.coverageEnd,'2026-12-31');
  assert.deepEqual(result.provenance.map(receipt=>receipt.url),[anchor,decemberUrl]);
  assert.match(result.warnings.join(' '),/2027-01.*HTTP 302.*\/errors\/404/);assert.doesNotMatch(result.warnings.join(' '),/HTTP 404/);
 }
});

test('New York Fed rejects missing-page redirects on its index and on a lagging index current-month link',async()=>{
 for(const lagged of [false,true]){
  const requests=[];
  await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-11-01T12:00:00Z'),pause:async()=>{},fetchImpl:async url=>{
   requests.push(url);return lagged&&url===anchor?new Response(october()):new Response('Not found',{status:302,headers:{location:'/errors/404'}});
  }}),/redirect/i);
  assert.deepEqual(requests,lagged?[anchor,novemberUrl]:[anchor]);
 }
});

test('New York Fed rejects every other future redirect and access denial without following it',async()=>{
 for(const [status,location] of [[301,'/errors/404'],[307,'/errors/404'],[302,'/errors/404?other=1'],[302,'/errors/404#other'],[302,'/errors/403'],[302,'https://vendor.example/errors/404'],[302,'/research/calendars/i-jan27.html'],[403,'/errors/404']]){
  const requests=[];
  await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-11-01T12:00:00Z'),pause:async()=>{},fetchImpl:async url=>{
   requests.push(url);return url===anchor?new Response(november()):new Response('Unavailable',{status,headers:{location}});
  }}),/redirect|HTTP.*403/i);
  assert.deepEqual(requests,[anchor,decemberUrl]);
 }
});

test('New York Fed tolerates a one-month index lag only after acquiring the current month',async()=>{
 const requests=[];
 const result=await nyfed().collectNyFedBlsCalendar({now:new Date('2026-11-01T05:00:00Z'),pause:async()=>{},fetchImpl:async url=>{requests.push(url);return url===anchor?new Response(october()):url===novemberUrl?new Response(november()):url===decemberUrl?new Response(december()):new Response('Not found',{status:404});}});
 assert.deepEqual(requests,[anchor,novemberUrl,decemberUrl,januaryUrl]);assert.deepEqual(result.coveredMonths,['2026-11','2026-12']);assert.deepEqual(result.unavailableMonths,['2027-01']);assert.ok(result.events.every(event=>event.date>='2026-11-01'));assert.equal(result.provenance.length,4-1);
 await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-11-01T05:00:00Z'),pause:async()=>{},fetchImpl:async url=>url===anchor?new Response(october()):new Response('Not found',{status:404})}),/HTTP.*404|current.month/i);
 await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-12-01T05:00:00Z'),pause:async()=>{},fetchImpl:async()=>new Response(october())}),/month/i);
 await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-11-01T05:00:00Z'),pause:async()=>{},fetchImpl:async()=>new Response(october().replace(novemberUrl,''))}),/current.month|next|link/i);
});

test('New York Fed uses the Eastern current month and stops without retries on denial',async()=>{
 const requests=[],pauses=[];
 await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-11-01T03:00:00Z'),pause:async ms=>pauses.push(ms),fetchImpl:async url=>{requests.push(url);return new Response('Access denied',{status:403});}}),error=>error instanceof OfficialSourceHttpError&&error.status===403);
 assert.deepEqual(requests,[anchor]);assert.deepEqual(pauses,[]);
 const eastern=await nyfed().collectNyFedBlsCalendar({now:new Date('2026-11-01T03:00:00Z'),pause:async()=>{},fetchImpl:async url=>new Response(url===anchor?october():url===novemberUrl?november():december())});
 assert.equal(eastern.coverageStart,'2026-10-01');
});

test('New York Fed fails unexpected future errors so refresh retains a prior complete capture',async()=>{
 for(const failed of [new Response('Denied',{status:403}),new Response('Unavailable',{status:503}),new Response('<html>Challenge</html>'),new Response(november().replace('(10:00)','(99:00)'))]){
  const requests=[];
  await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-10-24T12:00:00Z'),pause:async()=>{},fetchImpl:async url=>{requests.push(url);return url===anchor?new Response(october()):failed;}}),/HTTP|calendar|time/i);
  assert.deepEqual(requests,[anchor,novemberUrl]);
 }
 await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-10-24T12:00:00Z'),pause:async()=>{},fetchImpl:async url=>{if(url===anchor)return new Response(october());throw new Error('Network failure');}}),/Network failure/);
});

test('New York Fed rejects redirects, wrong response URLs, oversized responses and stale index months',async()=>{
 for(const response of [new Response('',{status:302,headers:{location:novemberUrl}}),new Response(' '.repeat(2*1024*1024+1)),new Response(november())])await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-10-24T12:00:00Z'),pause:async()=>{},fetchImpl:async()=>response}),/redirect|limit|month/i);
 const response=new Response(october());Object.defineProperty(response,'url',{value:novemberUrl});
 await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-10-24T12:00:00Z'),pause:async()=>{},fetchImpl:async()=>response}),/URL|redirect/i);
 const redirected=new Response(october());Object.defineProperty(redirected,'redirected',{value:true});
 await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('2026-10-24T12:00:00Z'),pause:async()=>{},fetchImpl:async()=>redirected}),/redirect/i);
 await assert.rejects(nyfed().collectNyFedBlsCalendar({now:new Date('invalid')}),/date/i);
});
