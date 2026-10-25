import test from 'node:test';
import assert from 'node:assert/strict';
import * as presentation from '../src/calendar-presentation.js';
import {calendarRelatedIds} from '../src/macro-calendar.js';
import {releaseEventIdentity} from '../src/release-evidence.js';
import {getReleaseRefreshPlan} from '../src/release-operations.js';
import {readFile} from 'node:fs/promises';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {calendarPage} from '../src/calendar-page.js';
import {overviewPage} from '../src/overview-page.js';
import {laborPage} from '../src/labor-page.js';
import {researchPage} from '../src/research-page.js';
import {buildPinContext} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {dataStatus,releases} from '../src/data.js';
import {parseRoute} from '../src/router.js';

// Real identified-client capture, 2026-10-25. It contains factual BLS rows only,
// with the provider's attribution, permissions and original retrieval receipts.
const capturedCalendar=JSON.parse(await readFile(new URL('./fixtures/nyfed-bls-calendar-capture.json',import.meta.url),'utf8'));
const fixedNow=new Date('2026-10-25T12:00:00.000Z');
const cpiId='bls-consumer-price-index-2026-11-10';
async function withCapturedCalendar(run){
 const priorEvents=[...releases],priorCalendar=dataStatus.calendar;
 const source={...structuredClone(capturedCalendar),status:'ok',lastAttemptAt:capturedCalendar.fetchedAt,error:null};
 releases.splice(0,releases.length,...source.events);
 dataStatus.calendar={status:'ok',sources:{bls:source},links:[{name:'New York Fed Economic Indicators Calendar',url:source.provenance[0].url}],message:source.coverageNote};
 try{return await run(source);}
 finally{releases.splice(0,releases.length,...priorEvents);dataStatus.calendar=priorCalendar;}
}
const cards=(html,className)=>[...html.matchAll(new RegExp(`<article class="${className}">([^]*?)<\\/article>`,'g'))].map(match=>match[1]);

const nyfed={provider:'new-york-fed',sourceTitle:'Economic Indicators Calendar',sourceNotice:'©2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.',attribution:'Source: Federal Reserve Bank of New York, Economic Indicators Calendar.',modificationNotice:'BLS events extracted and Eastern times converted to UTC by Meridian; tentative schedule; no endorsement.',licenseUrl:'https://www.newyorkfed.org/privacy/termsofuse'};
test('secondary calendar provenance is visible through existing disclosure markup and original agency associations stay intact',()=>{
 assert.equal(typeof presentation.calendarPublisherName,'function');
 assert.equal(typeof presentation.calendarSourceNotice,'function');
 assert.match(presentation.calendarPublisherName('bls',nyfed),/New York Fed/);
 const notice=presentation.calendarSourceNotice(nyfed);
 for(const value of [nyfed.sourceTitle,nyfed.sourceNotice,nyfed.modificationNotice,nyfed.licenseUrl])assert.ok(notice.includes(value),value);
 assert.match(notice,/class="panel-note"/);
 assert.equal(presentation.calendarPublisherName('bls',{}),'Bureau of Labor Statistics');
 assert.equal(presentation.calendarSourceNotice({}), '');
 const event={id:'bls-consumer-price-index-2026-11-10',sourceId:'bls',provider:'new-york-fed',program:'consumer-price-index',date:'2026-11-10',time:'08:30',scheduledAt:'2026-11-10T13:30:00.000Z',period:null,periodLabel:null,scheduleBasis:'secondary-calendar'};
 assert.match(presentation.scheduleBasisNote(event),/New York Fed|Federal Reserve Bank of New York/);
 assert.ok(calendarRelatedIds(event).includes('cpiCoreMonthly'));
 assert.deepEqual(releaseEventIdentity(event,'cpiMonthly'),{seriesId:'cpiMonthly',period:null,stage:'published'});
 assert.deepEqual(getReleaseRefreshPlan({releases:[event],sources:{}},{now:new Date('2026-11-10T13:47:00Z')}).sources,['bls']);
});

test('the actual New York Fed capture passes commercial admission with its real receipts and unknown periods',()=>{
 const source=structuredClone(capturedCalendar);
 assert.doesNotThrow(()=>assertCommercialData({sources:{},calendar:{sources:{bls:source}},releases:source.events}));
 assert.equal(source.events.length,8);assert.deepEqual(source.coveredMonths,['2026-10','2026-11','2026-12']);
 assert.equal(source.fetchedAt,'2026-10-25T00:18:05.620Z');
 for(const event of source.events){assert.equal(event.period,null);assert.equal(event.periodLabel,null);assert.equal(event.provider,'new-york-fed');assert.ok(source.provenance.some(receipt=>receipt.url===event.sourceUrl));}
 const misattributed=structuredClone(source);delete misattributed.provider;
 assert.throws(()=>assertCommercialData({sources:{},calendar:{sources:{bls:misattributed}},releases:misattributed.events}),/New York Fed|calendar|provenance/i);
});

test('the selected public calendar preview presents the actual secondary publisher, rights and unknown period',async()=>withCapturedCalendar(source=>{
 const html=calendarPage({...parseRoute(`#/calendar?month=2026-11&event=${cpiId}`),saved:[]});
 const preview=html.split('id="calendar-selected-preview"')[1].split('calendar:context')[0];
 for(const text of ['Consumer Price Index','Observation period not supplied','08:30 EST','NY FED CALENDAR','New York Fed · BLS releases','Secondary calendar','publication is not confirmed',source.sourceTitle,source.sourceNotice,source.attribution,source.modificationNotice,source.licenseUrl,'OPEN RELEASE EVIDENCE'])assert.ok(preview.includes(text),text);
 assert.ok(preview.includes('href="https://www.newyorkfed.org/research/calendars/i-nov26.html"'));
 assert.doesNotMatch(preview,/OFFICIAL SCHEDULE|Bureau of Labor Statistics<br>|October 2026/);
 assert.match(html,/Captured secondary schedule/);
 assert.match(html,/class="calendar-toolbar"|class="toolbar calendar-toolbar"/);
 assert.match(html,/data-save="cpiMonthly"/,'The BLS originating-program indicator association remains available');
}));

test('Overview upcoming cards label the New York Fed source and retain its actual dates and notices',async()=>withCapturedCalendar(source=>{
 const html=overviewPage(parseRoute('#/overview'),{now:fixedNow});
 const upcoming=cards(html,'oh-event');
 assert.equal(upcoming.length,3);
 for(const event of source.events.filter(event=>event.date.startsWith('2026-11'))){
  const card=upcoming.find(value=>value.includes(event.id));assert.ok(card,event.id);
  assert.ok(card.includes(event.name));assert.match(card,/BLS · NY FED CALENDAR/);
  assert.ok(card.includes(event.sourceUrl));assert.ok(card.includes(source.sourceNotice));assert.ok(card.includes(source.modificationNotice));assert.ok(card.includes(source.licenseUrl));
  assert.doesNotMatch(card,/Official schedule|Bureau of Labor Statistics/);
 }
 assert.ok(upcoming.some(card=>card.includes('10:00 EST')));assert.ok(upcoming.some(card=>card.includes('08:30 EST')));
}));

test('Labor upcoming cards preserve originating BLS program actions while identifying the calendar provider',async()=>withCapturedCalendar(source=>{
 const html=laborPage(parseRoute('#/economy/labor'),{now:fixedNow});
 const upcoming=cards(html,'labor-event');
 assert.equal(upcoming.length,2);
 for(const name of ['Job Openings and Labor Turnover Survey','Employment Situation']){
  const card=upcoming.find(value=>value.includes(name));assert.ok(card,name);
  assert.match(card,/NY Fed calendar/);assert.match(card,/Reference period not supplied/);assert.doesNotMatch(card,/Official BLS schedule|Bureau of Labor Statistics/);
 }
 assert.match(html,/NEXT EMPLOYMENT RELEASE/);assert.ok(html.includes('event=bls-employment-situation-2026-11-06'));
 for(const notice of [source.sourceTitle,source.sourceNotice,source.attribution,source.modificationNotice,source.licenseUrl])assert.ok(html.includes(notice),notice);
}));

test('a portable calendar package preserves complete New York Fed metadata and source URLs after live data changes',async()=>withCapturedCalendar(async source=>{
 const state=parseRoute(`#/calendar?month=2026-11&event=${cpiId}`);
 const args=buildPinContext(state,{now:fixedNow});
 assert.equal(args.context.calendar.sources.bls,source);assert.equal(args.context.selectedEvent.id,cpiId);
 assert.equal(args.context.releases.length,3);assert.equal(args.context.calendarReplay,'Frozen current context only; historical calendar replay is unavailable.');
 const pkg=await createResearchPackage({id:'nyfed-calendar-capture',name:'Captured BLS schedule via New York Fed',now:fixedNow,...args});
 const json=exportResearchPackage(pkg),restored=await importResearchPackage(json);
 assert.deepEqual(restored.context.calendar.sources.bls,source);
 assert.deepEqual(restored.context.selectedEvent,source.events.find(event=>event.id===cpiId));
 for(const notice of [source.sourceTitle,source.sourceNotice,source.attribution,source.modificationNotice,source.licenseUrl,...source.provenance.map(receipt=>receipt.url)])assert.ok(json.includes(notice),notice);
 source.attribution='Changed live attribution';source.sourceNotice='Changed live notice';source.events[0].sourceUrl='https://later.example/calendar';releases.splice(0,releases.length);
 assert.equal(exportResearchPackage(restored),json);assert.equal(restored.context.selectedEvent.periodLabel,null);
 const html=researchPage({...parseRoute('#/research?view=packages'),packageId:restored.id},{library:{packages:[restored]}});
 assert.match(html,/READ-ONLY/);assert.match(html,/data-package-json/);assert.doesNotMatch(html,/Changed live attribution|Changed live notice|later\.example/);
}));
