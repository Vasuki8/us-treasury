import test from 'node:test';import assert from 'node:assert/strict';
import {buildPinContext,buildPublicationPin} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {parseRoute} from '../src/router.js';import {dataStatus,series} from '../src/data.js';import {publicationArchive} from '../src/publication-archive.js';
import {recordVintages} from '../src/vintages.js';
import {parseCsv} from '../scripts/sources/http.mjs';

test('pin scope follows the focused measure and retains family reading dates',()=>{
 const args=buildPinContext(parseRoute('#/economy?family=housing&measure=housingCompletions&window=all'));
 assert.deepEqual(args.state.selected,['housingCompletions']);assert.equal(args.context.familyReadings.length,3);assert.equal(args.state.transform,'level');
});
test('specialist pin preserves observed inputs, modeled assumptions and exact original exports across refresh',async()=>{
 const state=parseRoute('#/refinancing?horizon=24&shock=200'),args=buildPinContext(state),pkg=await createResearchPackage({name:'Refinancing 24m',...args});
 assert.equal(pkg.assumptions.horizonMonths,24);assert.equal(pkg.assumptions.shockBps,200);assert.ok(pkg.context.moduleSources.refinancing.positions?.length||pkg.context.moduleSources.refinancing.securities?.length);
 assert.equal(pkg.context.attachments.length,2);assert.match(pkg.context.attachments[1].content,/scenario|shock|sensitivity/i);
 const before=exportResearchPackage(pkg),current=series.marketableDebt;
 try{series.marketableDebt={...current,observations:[{date:'2030-01-01',value:999}]};assert.equal(exportResearchPackage(await importResearchPackage(before)),before);}
 finally{series.marketableDebt=current;}
});
test('publication package uses selected official estimate rather than current revised GDP',()=>{
 const args=buildPublicationPin(publicationArchive,'2026-05-01');assert.equal(args.catalog.gdp.observations[0].value,2);assert.equal(args.catalog.gdp.observations[0].publishedAt,null);assert.match(args.catalog.gdp.publicationNote,/2026-04-30/);
 assert.throws(()=>buildPublicationPin(publicationArchive,'2026-04-01'),/unavailable|publication/i);
});
test('calendar pins retain original schedule evidence without claiming historical calendar replay',()=>{
 const args=buildPinContext(parseRoute('#/calendar'));assert.ok(args.context.calendar.sources.bls.fetchedAt);assert.equal(args.context.calendarReplay,'Frozen current context only; historical calendar replay is unavailable.');
 assert.equal(args.snapshot.generatedAt,dataStatus.generatedAt);
});

test('Captured by pin interprets the datetime-local control as exact UTC and never substitutes later observations',async()=>{
 const source=(fetchedAt,value)=>({id:'bea',fetchedAt,provenance:[],series:{gdp:{sourceIds:['A191RL'],sourceUrl:series.gdp.sourceUrl,calculation:series.gdp.calculation,observations:[{date:'2026-01-01',value,publishedAt:null,sourceValue:String(value)}]}}});
 const first=source('2026-10-21T12:00:00.000Z',2.5),later=source('2026-10-22T12:00:00.000Z',999);
 let history=recordVintages(null,{}, {bea:first},{checkedAt:first.fetchedAt,seriesMetadata:series});
 history=recordVintages(history,{}, {bea:later},{checkedAt:later.fetchedAt,seriesMetadata:series});
 const historyState={status:'ready',history,latestCaptureAt:later.fetchedAt};
 const args=buildPinContext(parseRoute('#/vintages?series=gdp&cutoff=2026-10-21T12%3A30%3A12.5'),{historyState});
 assert.equal(args.context.captureCutoff,'2026-10-21T12:30:12.500Z');assert.equal(args.catalog.gdp.observations[0].value,2.5);
 const pkg=await createResearchPackage({name:'As captured then',...args});assert.equal(pkg.panels[0].observations[0].value,2.5);assert.match(pkg.context.attachments[0].content,/2026-10-21T12:30:12\.500Z/);
 assert.throws(()=>buildPinContext(parseRoute('#/vintages?series=gdp&cutoff=2026-10-21T11%3A59'),{historyState}),/unavailable/i);
 assert.throws(()=>buildPinContext(parseRoute('#/vintages?series=gdp&cutoff=2026-02-30T12%3A00'),{historyState}),/cutoff|valid/i);
 const beforeLater={...historyState,history:{version:1,captures:history.captures.slice(0,1)}};
 assert.equal(buildPinContext(parseRoute('#/vintages?series=gdp'),{historyState:beforeLater}).context.captureCutoff,later.fetchedAt,'default cutoff preserves the manifest-wide latest retrieval, matching the view');
});

test('calendar pins use visible month/day/topic/watch filters and choose the first visible event when the selection is stale',()=>{
 const events=[
  {id:'claims-first',date:'2026-10-22',time:'08:30',name:'Claims',topic:'Labor',sourceId:'dol',program:'weekly-claims',seriesIds:['claims']},
  {id:'housing-october',date:'2026-10-23',time:'08:30',name:'Original construction title',topic:'Housing',sourceId:'census',program:'housing-construction',seriesIds:['housingStarts','housingPermits','housingCompletions'],sourceUrl:'https://www.census.gov/economic-indicators/calendar-listview.html'},
  {id:'housing-november',date:'2026-11-18',time:'08:30',name:'Construction November',topic:'Housing',sourceId:'census',program:'housing-construction',seriesIds:['housingStarts']},
 ];
 const state={...parseRoute('#/calendar'),calendarMonth:'2026-10',day:'all',calendarTopic:'Housing',eventId:'claims-first',watchOnly:true,saved:['housingCompletions']};
 const args=buildPinContext(state,{events,now:new Date('2026-10-22T15:00:00Z')});
 assert.equal(args.context.selectedEvent,events[1]);assert.deepEqual(args.context.releases,[events[1]]);assert.equal(events[1].name,'Original construction title');
 assert.deepEqual(args.state.selected,['housingStarts','housingPermits','housingCompletions']);assert.deepEqual(args.context.calendarScope.eventIds,['housing-october']);
 assert.equal(args.context.calendarScope.window.startDate,'2026-10-01');assert.equal(args.context.calendarScope.window.endDate,'2026-10-31');
 const november=buildPinContext({...state,calendarMonth:'2026-11',day:'2026-11-18'},{events,now:new Date('2026-10-22T15:00:00Z')});assert.equal(november.context.selectedEvent.id,'housing-november');
 for(const changed of [{...state,day:'2026-10-24'},{...state,saved:[]},{...state,calendarTopic:'Fiscal'}])assert.throws(()=>buildPinContext(changed,{events}),/no.*calendar.*match|filters/i);
});

test('Captured by pin uses captured source-level measurement and rights before current metadata, with series overrides',async()=>{
 const capturedAt='2026-10-21T12:00:00.000Z',source={id:'bea',fetchedAt:capturedAt,unit:'USD millions',format:'millions',precision:2,definition:'Captured source definition',sourceNotice:'Captured provider notice.',licenseUrl:'https://example.gov/original-terms',attribution:'Captured provider credit.',sourceTitle:'Captured provider title',provenance:[],series:{gdp:{sourceIds:['A191RL'],sourceUrl:series.gdp.sourceUrl,calculation:'Published captured amount',sourceNotice:'Captured series notice.',observations:[{date:'2026-01-01',value:2000,publishedAt:null}]}}};
 const pin=()=>{const history=recordVintages(null,{}, {bea:source},{checkedAt:capturedAt});return buildPinContext({...parseRoute('#/vintages?series=gdp'),vintageCutoff:capturedAt},{historyState:{status:'ready',history,latestCaptureAt:capturedAt}});};
 const args=pin(),pkg=await createResearchPackage({name:'Captured measurement',...args});
 assert.equal(pkg.catalog.gdp.unit,'USD millions');assert.equal(pkg.catalog.gdp.format,'millions');assert.equal(pkg.catalog.gdp.definition,'Captured source definition');
 assert.equal(pkg.catalog.gdp.sourceNotice,'Captured provider notice. Captured series notice.');assert.equal(pkg.catalog.gdp.licenseUrl,'https://example.gov/original-terms');assert.equal(pkg.catalog.gdp.attribution,'Captured provider credit.');
 const [header,row]=parseCsv(args.context.attachments[0].content);assert.equal(row[header.indexOf('unit')],pkg.catalog.gdp.unit);
 Object.assign(source.series.gdp,{unit:'USD billions',format:'billions',definition:'Captured series definition'});
 const override=pin();assert.equal(override.catalog.gdp.unit,'USD billions');assert.equal(override.catalog.gdp.format,'billions');assert.equal(override.catalog.gdp.definition,'Captured series definition');
});
