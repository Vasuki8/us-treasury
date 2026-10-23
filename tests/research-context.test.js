import test from 'node:test';import assert from 'node:assert/strict';
import {buildPinContext,buildPublicationPin,buildReleasePin} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {parseRoute} from '../src/router.js';import {dataStatus,series} from '../src/data.js';import {publicationArchive} from '../src/publication-archive.js';
import {recordVintages} from '../src/vintages.js';
import {parseCsv} from '../scripts/sources/http.mjs';

test('release freezing retains the matched official result rather than current default chart selections',async()=>{
 const state=parseRoute('#/release?publicationSeries=gdp&publicationPeriod=2026-01-01&publicationCutoff=2026-06-25');
 // Use the same normalized selection keys as the release workspace.
 Object.assign(state,{publicationSeries:'gdp',publicationPeriod:'2026-01-01',publicationCutoff:'2026-06-25',eventId:''});
 const args=buildReleasePin(state,{archive:publicationArchive,publicationState:{status:'ready'}});
 assert.deepEqual(args.state.selected,['gdp']);assert.equal(args.catalog.gdp.observations[0].value,2.1);
 assert.equal(args.context.releaseEvidence.actual.publicationDate,'2026-06-25');
 const pkg=await createResearchPackage({name:'Verified GDP release',...args}),text=exportResearchPackage(pkg);
 assert.equal(exportResearchPackage(await importResearchPackage(text)),text);
 assert.throws(()=>buildReleasePin({...state,eventId:'unknown-event'},{archive:publicationArchive,publicationState:{status:'ready'}}),/retained calendar|unavailable/i);
 assert.throws(()=>buildReleasePin(state,{archive:null,publicationState:{status:'error'}}),/Load.*publication/i);
});

test('Overview freeze retains new topic readings, actual brief evidence and next catalysts independently of current data',async()=>{
 const args=buildPinContext(parseRoute('#/overview'));
 assert.deepEqual(args.state.selected,['gdp','pceCoreMonthly','payroll','policyTargetUpper']);
 assert.ok(args.context.overviewTopicReadings.some(item=>item.id==='claimsAdvance'&&item.latest.date));
 assert.ok(args.context.overviewBrief.some(item=>item.kind==='Verified published estimate'));
 assert.ok(Array.isArray(args.context.nextCatalysts));
 const pkg=await createResearchPackage({name:'Overview evidence',...args}),text=exportResearchPackage(pkg);
 assert.deepEqual((await importResearchPackage(text)).context.overviewTopicReadings,pkg.context.overviewTopicReadings);
 const failures=[{id:'bea',error:'Official source HTTP 503',fetchedAt:'2026-10-22T12:00:00Z'}];
 const failed=buildPinContext(parseRoute('#/overview'),{failures});
 assert.ok(failed.context.overviewBrief.some(row=>row.kind==='Collection problem'&&row.name===failures[0].error));
});

test('credit and fiscal results freeze the production inputs within existing portable-package limits',async()=>{
 for(const page of ['credit','fiscal']){
  const args=buildPinContext(parseRoute('#/'+page)),pkg=await createResearchPackage({name:page,...args}),text=exportResearchPackage(pkg);
  assert.equal(exportResearchPackage(await importResearchPackage(text)),text);
  if(page==='credit'){assert.match(pkg.context.scope,/three-year/i);assert.ok(pkg.context.moduleSources.bankCredit.series.bankLoans.observations.length<200);}
 }
});

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
 assert.throws(()=>buildPublicationPin(publicationArchive,'2026-04-01','2026-01-01'),/unavailable|publication/i);
});

test('new publication pins freeze only in-scope explanation evidence and a separate CSV',async()=>{
 const row=publicationArchive.releases[2],evidence={publicationId:row.id,seriesId:row.seriesId,period:row.period,estimate:row.estimate,publicationDate:row.publicationDate,kind:'revision',summary:'Test reviewed explanation.',details:['Test source detail.'],annualUpdate:null,sourceUrl:row.releaseEvidenceUrl,sourceTitle:'Test release',sourceSection:'Technical notes',licenseUrl:row.licenseUrl,attribution:row.attribution,provenance:[{url:row.releaseEvidenceUrl,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T18:00:00.000Z',lastModified:null}]};
 const explanationArchive={version:1,explanations:[evidence]},options={explanationArchive,explanationStatus:'ready'};
 const args=buildPublicationPin(publicationArchive,'2026-06-25','2026-01-01',options);
 assert.equal(args.context.publicationExplanations.length,1);assert.equal(args.context.publicationExplanationStatus,'ready');assert.equal(args.context.attachments.length,2);
 assert.equal(args.context.attachments[1].name,'gdp-revision-explanations.csv');assert.match(args.context.attachments[1].content,/Test reviewed explanation/);
 const pkg=await createResearchPackage({name:'GDP plus evidence',...args}),text=exportResearchPackage(pkg);evidence.summary='Later mutation';
 assert.equal(exportResearchPackage(await importResearchPackage(text)),text);assert.equal(pkg.context.publicationExplanations[0].summary,'Test reviewed explanation.');
 const early=buildPublicationPin(publicationArchive,'2026-05-28','2026-01-01',options);assert.deepEqual(early.context.publicationExplanations,[]);assert.doesNotMatch(early.context.attachments[1].content,/Later mutation/);
 const failed=buildPublicationPin(publicationArchive,'2026-06-25','2026-01-01',{explanationArchive:null,explanationStatus:'error'});assert.equal(failed.context.publicationExplanationStatus,'error');assert.deepEqual(failed.context.publicationExplanations,[]);assert.equal(failed.context.attachments.length,1);
});

test('publication pins retain the selected quarter and its exact as-published CSV independently of other quarters',async()=>{
 const row={...publicationArchive.releases[0],id:'older-quarter',period:'2025-01-01',publicationDate:'2025-04-30',estimate:'Advance',value:1.5};
 const archive={version:1,releases:[...publicationArchive.releases.slice(0,3),row]};
 const args=buildPublicationPin(archive,'2026-06-25','2025-01-01');assert.equal(args.catalog.gdp.observations[0].date,'2025-01-01');assert.equal(args.catalog.gdp.observations[0].value,1.5);assert.match(args.catalog.gdp.name,/Q1 2025/);assert.equal(args.context.publicationPeriod,'2025-01-01');assert.equal(args.context.publicationReleases.length,1);
 assert.match(args.catalog.gdp.coverageNote,/official publication/i);assert.doesNotMatch(args.catalog.gdp.coverageNote,/approved quarterly and monthly NIPA files/);assert.equal(args.catalog.gdp.lastAttemptAt,null);assert.deepEqual(args.catalog.gdp.sourceUrls,[row.sourceUrl]);
 const pkg=await createResearchPackage({name:'Old GDP quarter',...args}),text=exportResearchPackage(pkg);archive.releases.push({...row,value:99,publicationDate:'2026-07-01'});
 assert.equal(exportResearchPackage(await importResearchPackage(text)),text);assert.doesNotMatch(pkg.context.attachments[0].content,/2026-01-01/);
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
