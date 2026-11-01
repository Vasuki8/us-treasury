import {rememberStableFocus,restoreStableFocus} from '../src/stable-focus.js';
import {createResearchSaveDrafts,researchSaveScope,positionResearchSave} from '../src/research-save.js';
import {createQuestionDrafts,saveResearchQuestion,questionFieldId} from '../src/question-drafts.js';
import {destinationChanged,entryWindow} from '../src/router.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorkspace,openWorkspace,MAX_RESEARCH_JSON_BYTES} from '../src/research-workspaces.js';
import {parseResearchQuestion} from '../src/research-questions.js';
import {buildPceBaseEffects} from '../src/pce-base-effects.js';
import {pceScenarioOptions} from '../src/workspace-context.js';
import {createResearchPackage,importResearchPackage,exportResearchPackage,researchPackageCsv,researchPackageAttachment} from '../src/research-packages.js';
import {createResearchLibrary as createLibrary} from '../src/research-library.js';
const createResearchLibrary=storage=>createLibrary(storage,{locks:{request:async(_name,_options,callback)=>callback()}});
import {buildPinContext,freezeCandidates,buildPublicationPin,buildClaimsPublicationPin,buildReleasePin,buildCpiPublicationPin,buildGdpMatrixPin} from '../src/research-context.js';
import {cpiPublicationArchive} from '../src/cpi-publication-archive.js';
import {cpiPublicationIds,cpiPublicationCsv,selectCpiPublicationHistory} from '../src/cpi-publication-history.js';
import {gdpRevisionMatrixCsv} from '../src/gdp-revision-matrix.js';
import {buildCoverageInventory,coverageInventoryCsv} from '../src/coverage-inventory.js';
import {fundingChartCatalog} from '../src/funding-distribution.js';
import {parseRoute,routeFor} from '../src/router.js';
import {updateWorkspaceSelection} from '../src/workspace-context.js';
import {normalizedCutoff} from '../src/vintages-page.js';
import {normalizeVintageTimestamp} from '../src/vintages.js';
import {dataStatus,series,releases} from '../src/data.js';
import {getSeries} from '../src/model.js';
import {publicationArchive} from '../src/publication-archive.js';
import {publicationCsv,selectPublicationHistory} from '../src/publication-history.js';
import {publicationExplanationsCsv} from '../src/publication-explanation-view.js';
import {changesCsv,writeChangeCheckpoint} from '../src/capture-changes.js';
import {periodLabel} from '../src/model.js';
import {selectClaimsPublicationHistory,claimsPublicationCsv,claimsPublicationIds} from '../src/claims-publication-history.js';
import {claimsFixture} from './helpers/claims-publications-fixture.js';
import {createPublicationController} from '../src/publication-controller.js';
import {requiredSourceIds} from '../src/source-controller.js';
import {watchDisclosureCharts} from '../src/page-hierarchy.js';
import {normalizeDashboardChartSettings,pceHorizonChartCatalog} from '../src/dashboard-chart-data.js';

const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
function section(start,end){
 const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
 assert.ok(from>=0&&to>from,`App integration boundary missing: ${start}`);
 return source.slice(from,to);
}

test('change feed replay is reused across pagination and rebuilt only when its evidence or cutoff changes',()=>{
 let calls=0;const initial={captures:[]},env={changeState:{status:'ready',ids:['gdp'],history:initial},state:{changeSince:'',changePage:1},changeCheckpoint:{since:'2026-10-01T00:00:00.000Z'}};
 const view=new Function('env','captureChanges',`let {changeState,state,changeCheckpoint}=env;let changeRowsCache=null;${section('function changesContext()','function currentPackage()')};return {context:changesContext,setHistory:history=>{changeState={...changeState,history}}};`)(env,()=>[{id:++calls}]);
 const first=view.context().rows;env.state.changePage=2;assert.equal(view.context().rows,first);assert.equal(calls,1);
 env.state.changeSince='2026-10-02T00:00:00.000Z';assert.notEqual(view.context().rows,first);assert.equal(calls,2);
 view.setHistory({captures:[]});view.context();assert.equal(calls,3);
});

test('actual publication synchronization requests no archive on ordinary views and ignores navigation while loading',async()=>{
 let finish,calls=0,renders=0;const env={state:{page:'explore'},publicationState:{status:'idle',error:null},publicationArchive:null,publicationLoader:{load:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}},createPublicationController,claimsPublicationIds,main:{},preserveHistoryView:(_main,callback)=>callback(),render:()=>{renders++;}};
 const view=new Function('env',`let {${Object.keys(env).join(',')}}=env;const publicationController=createPublicationController({gdpLoader:publicationLoader,claimsLoader:{load(){throw Error('Wrong archive requested');}},getRoute:()=>state,onChange:()=>preserveHistoryView(main,()=>render())});${section('function syncPublications(', 'function syncChanges(')};return{sync:syncPublications,route:next=>{state=next},context:()=>{const value=publicationController.context(state.publicationSeries);return{publicationState:value,publicationArchive:value.archive};}};`)(env);
 view.sync();view.route({page:'research',researchView:'changes'});view.sync();assert.equal(calls,0);
 view.route({page:'research',researchView:'publications'});view.sync();view.sync();assert.equal(calls,1);assert.equal(view.context().publicationState.status,'loading');
 view.route({page:'calendar'});const archive={version:1,releases:[]};finish(archive);await Promise.resolve();await Promise.resolve();assert.equal(view.context().publicationArchive,archive);assert.equal(view.context().publicationState.status,'ready');assert.equal(renders,0);
 view.route({page:'research',researchView:'publications'});view.sync();assert.equal(calls,1);
});

// Run the actual delegated handlers and chart/resize helpers. Browser element
// boundaries are replaced; model, package, storage and route contracts stay real.
async function app(hash='#/series/gdp?window=all',{
 archive=publicationArchive,explanations={version:1,explanations:[]},explanationStatus='ready',publicationStatus='ready',sourceController,
}={}){
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const researchLibrary=await createResearchLibrary(storage),inputs=new Map([['research-name',{value:'Handler research'}]]),downloads=[],chartCalls=[],chartRoots=[],listeners=new Map(),announcements=[];
 const location={hash},history={pushState:(_state,_title,route)=>{location.hash=route;},replaceState:(_state,_title,route)=>{location.hash=route;}};
 const questionDrafts=createQuestionDrafts(),saveDrafts=createResearchSaveDrafts();
 const env={rememberStableFocus,restoreStableFocus,freezeCandidates,prepareReadableTables:()=>{},questionDrafts,saveDrafts,researchSaveScope,positionResearchSave,destinationChanged,saveResearchQuestion,questionFieldId,buildPceBaseEffects,pceScenarioOptions,parseResearchQuestion,createWorkspace,openWorkspace,createResearchPackage,importResearchPackage,exportResearchPackage,researchPackageCsv,MAX_RESEARCH_JSON_BYTES,buildPinContext,buildPublicationPin,buildClaimsPublicationPin,buildReleasePin,selectClaimsPublicationHistory,claimsPublicationCsv,claimsPublicationIds,normalizedCutoff,normalizeVintageTimestamp,researchLibrary,parseRoute,routeFor,updateWorkspaceSelection,dataStatus,series,releases,getSeries,publicationArchive:archive,publicationState:{status:publicationStatus},publicationExplanations:explanations,explanationState:{status:explanationStatus},publicationExplanationsCsv,publicationCsv,selectPublicationHistory,periodLabel,changesCsv,writeChangeCheckpoint,storage,
  publicationController:{context:()=>({status:publicationStatus,archive})},state:{...parseRoute(hash),saved:[]},activeWorkspaceId:null,researchLabel:'',pinBusy:false,changeCheckpoint:{enabled:true,since:'2026-10-01T12:00:00.000Z',snapshotAt:'2026-10-01T12:00:00.000Z'},changeState:{status:'ready',history:{captures:[]}},historyController:{context:()=>({historyState:{status:'idle'}})},
  document:{getElementById:id=>{const input=inputs.get(id);if(input&&!input.focus)input.focus=()=>{};return input;}},location,history,watchDisclosureCharts,main:{contains:()=>false,querySelector:()=>null,addEventListener:(name,callback,capture)=>{assert.equal(name,'toggle');assert.equal(capture,true);listeners.set(name,callback);}},window:{addEventListener:(name,callback)=>listeners.set(name,callback)},cancelAnimationFrame(){},requestAnimationFrame(callback){callback();return 1;},render(){},rememberWorkspace(){},announce:message=>announcements.push(message),renderCharts:(root,options)=>{chartRoots.push(root);chartCalls.push(options);},downloadCsv:(content,name)=>downloads.push({content,name}),downloadJson:pkg=>downloads.push({content:exportResearchPackage(pkg),name:'json'}),changesContext:()=>({status:'ready',rows:[]}),syncChanges(){}};
 Object.assign(env,{positionResearchSave:node=>positionResearchSave(node,{innerWidth:1280,innerHeight:720}),buildCpiPublicationPin,buildGdpMatrixPin,cpiPublicationIds,cpiPublicationCsv,selectCpiPublicationHistory,gdpRevisionMatrixCsv,buildCoverageInventory,coverageInventoryCsv,fundingChartCatalog,researchPackageAttachment});
 Object.assign(env,{requiredSourceIds,sourceController,actionFeedback(){},overviewChartSettings:normalizeDashboardChartSettings(),workspacePreviewRequest:0,workspacePreviews:{overview:'gdp',explore:null},pceHorizonChartCatalog,normalizeDashboardChartSettings});
 env.workspaceActivation=0;
 if(sourceController)env.dataStatus={...dataStatus,sourceArchive:{version:1,sources:{}}};
 const change=/root\.addEventListener\('change',async event=>\{([^]*?)\n\}\);/.exec(source);assert.ok(change,'App change delegation must exist');
 env.entryWindow=entryWindow;
 const code=`let {${Object.keys(env).join(',')}}=env;\n`
  +section('function trackedChanges()','function syncPublications(')
  +section('function currentPackage()','function researchActions()')
  +section('async function chooseWorkspacePreview(',"document.getElementById('workspace-topics')")
  +section('function navigate(',"window.addEventListener('hashchange'")
  +section('function applyPceAssumptions(',"root.addEventListener('click'")
  +section('let resizeFrame;','\nrender();')
  +`;return {handleResearchAction,applyPceAssumptions,changeHandler:async event=>{${change[1]}},navigate,state:()=>state,workspaceId:()=>activeWorkspaceId,checkpoint:()=>changeCheckpoint,chartPreview:()=>workspacePreviews.overview,chartSettings:()=>overviewChartSettings,previewState:()=>workspacePreviews};`;
 const handlers=new Function('env',code)(env);
 return {...handlers,questionDrafts,saveDrafts,researchLibrary,values,inputs,downloads,chartCalls,chartRoots,listeners,announcements,location};
}

test('checkpoint mark, enable and disable clear the displayed cutoff/page in the actual route',async()=>{
 for(const action of ['markChanges','enableChanges','disableChanges']){
  const current=await app('#/research?view=changes&since=2026-10-01T12%3A00%3A00.000Z&changePage=5');
  await current.handleResearchAction({[action]:''});
  assert.equal(current.state().changeSince,'');assert.equal(current.state().changePage,1);
  const reopened=parseRoute(current.location.hash);assert.equal(reopened.changeSince,'');assert.equal(reopened.changePage,1);
  assert.equal(current.checkpoint().enabled,action!=='disableChanges');assert.ok(current.values.has('meridian.change-checkpoint.v1'));
  if(action!=='disableChanges')assert.equal(current.checkpoint().since,dataStatus.generatedAt);
 }
});

test('actual explanation export and pin actions share the same selected quarter/date evidence',async()=>{
 const row=publicationArchive.releases[2],evidence={publicationId:row.id,seriesId:row.seriesId,period:row.period,estimate:row.estimate,publicationDate:row.publicationDate,kind:'revision',summary:'Test source explanation.',details:[],annualUpdate:null,sourceTitle:'Test',sourceSection:'Technical notes',sourceUrl:row.releaseEvidenceUrl,licenseUrl:row.licenseUrl,attribution:row.attribution,provenance:row.provenance};
 const explanations={version:1,explanations:[evidence]},current=await app('#/research?view=publications&period=2026-01-01&publishedBy=2026-06-25',{explanations});
 await current.handleResearchAction({exportPublicationExplanations:''});assert.equal(current.downloads.at(-1)?.content,publicationExplanationsCsv(publicationArchive,explanations,'2026-06-25','2026-01-01'));assert.match(current.downloads.at(-1).name,/2026-01-01/);
 await current.handleResearchAction({pinPublication:''});const pkg=current.researchLibrary.getPackage(current.state().packageId);assert.equal(pkg.context.publicationExplanations[0].summary,evidence.summary);assert.equal(pkg.context.attachments[1].content,current.downloads[0].content);
 const unavailable=await app('#/research?view=publications&period=2026-01-01&publishedBy=2026-06-25',{explanationStatus:'error'});
 await assert.rejects(unavailable.handleResearchAction({exportPublicationExplanations:''}),/explanation.*unavailable/i);assert.equal(unavailable.downloads.length,0);
});

test('actual explanation synchronization is independent, demand-loaded and retries without discarding numerical history',async()=>{
 let calls=0,renders=0;const env={state:{page:'overview'},claimsPublicationIds,explanationState:{status:'idle',error:null},publicationExplanations:null,explanationLoader:{load:async()=>{if(++calls===1)throw Error('HTTP503');return {version:1,explanations:[]};}},main:{},preserveHistoryView:(_main,fn)=>fn(),render:()=>{renders++;}};
 const view=new Function('env',`let {${Object.keys(env).join(',')}}=env;${section('function syncPublicationExplanations(', 'function syncChanges(')};return{sync:syncPublicationExplanations,route:next=>{state=next},context:()=>({explanationState,publicationExplanations})};`)(env);
 view.sync();assert.equal(calls,0);view.route({page:'research',researchView:'publications'});view.sync();await Promise.resolve();await Promise.resolve();assert.equal(view.context().explanationState.status,'error');assert.equal(renders,1);
 view.sync();assert.equal(calls,1);view.sync({retry:true});view.route({page:'overview'});await Promise.resolve();await Promise.resolve();assert.equal(calls,2);assert.equal(view.context().explanationState.status,'ready');assert.equal(renders,1);
 view.route({page:'research',researchView:'publications',publicationSeries:'claimsAdvance'});view.sync({retry:true});assert.equal(calls,2,'claims do not request BEA explanations');
});

test('publication actions retain the chosen quarter across cutoff changes, scoped CSV and frozen pins',async()=>{
 const row={...publicationArchive.releases[0],id:'older-quarter',period:'2025-01-01',publicationDate:'2025-04-30',estimate:'Advance',value:1.5};
 const archive={version:1,releases:[...publicationArchive.releases.slice(0,3),row]},current=await app('#/research?view=publications&period=2025-01-01&publishedBy=2026-06-25',{archive});
 await current.changeHandler({target:{id:'publication-cutoff',value:'2026-05-01'}});assert.equal(current.state().publicationPeriod,'2025-01-01');
 await current.handleResearchAction({exportPublications:''});assert.equal(current.downloads.at(-1).content,publicationCsv(archive,'2026-05-01','2025-01-01'));assert.match(current.downloads.at(-1).name,/2025-01-01/);
 await current.handleResearchAction({pinPublication:''});const pkg=current.researchLibrary.getPackage(current.state().packageId);assert.equal(pkg.context.publicationPeriod,'2025-01-01');assert.equal(pkg.catalog.gdp.observations[0].value,1.5);assert.match(pkg.name,/2025/);
});

test('actual claims publication actions use one series/week/cutoff for CSV and frozen pins',async()=>{
 const archive=claimsFixture(),current=await app('#/research?view=publications&publicationSeries=claimsAdvance&period=2026-03-07&publishedBy=2026-03-19',{archive});
 await current.handleResearchAction({exportPublications:''});assert.equal(current.downloads.at(-1).content,claimsPublicationCsv(archive,'claimsAdvance','2026-03-19','2026-03-07'));assert.match(current.downloads.at(-1).name,/claimsAdvance.*2026-03-07/);
 await current.handleResearchAction({pinPublication:''});const pkg=current.researchLibrary.getPackage(current.state().packageId);assert.deepEqual(pkg.request.ids,['claimsAdvance']);assert.equal(pkg.context.publicationSeries,'claimsAdvance');assert.equal(pkg.catalog.claimsAdvance.observations[0].value,201);assert.equal(pkg.context.attachments[0].content,current.downloads[0].content);
});

test('the release workspace Freeze action stores its verified publication and supports an unavailable archive safely',async()=>{
 const current=await app('#/release?period=2026-01-01&publishedBy=2026-06-25');
 await current.handleResearchAction({pinResult:''});
 const pkg=current.researchLibrary.getPackage(current.state().packageId);
 assert.equal(current.state().researchView,'packages');assert.deepEqual(pkg.request.ids,['gdp']);
 assert.equal(pkg.context.releaseEvidence.actual.value,2.1);assert.equal(pkg.context.releaseEvidence.actual.publicationDate,'2026-06-25');
 const failed=await app('#/release',{publicationStatus:'error'});
 await assert.rejects(failed.handleResearchAction({pinResult:''}),/Load.*publication/i);
 assert.equal(failed.researchLibrary.listPackages().length,0);
});

test('switching publication measurement clears cross-measure periods and retained weeks survive cutoff changes',async()=>{
 const archive=claimsFixture(),current=await app('#/research?view=publications&publicationSeries=claimsAdvance&period=2026-03-07&publishedBy=2026-03-19',{archive});
 await current.changeHandler({target:{id:'publication-cutoff',value:'2026-03-12'}});assert.equal(current.state().publicationPeriod,'2026-03-07');
 await current.changeHandler({target:{id:'publication-series',value:'continuedClaimsAdvance',matches:()=>false}});assert.equal(current.state().publicationSeries,'continuedClaimsAdvance');assert.equal(current.state().publicationPeriod,'');assert.equal(parseRoute(current.location.hash).publicationSeries,'continuedClaimsAdvance');
 const unavailable=await app('#/research?view=publications&publicationSeries=claimsAdvance',{archive,publicationStatus:'loading'});await assert.rejects(unavailable.handleResearchAction({exportPublications:''}),/unavailable|load/i);await assert.rejects(unavailable.handleResearchAction({pinPublication:''}),/unavailable|load/i);assert.equal(unavailable.researchLibrary.listPackages().length,0);
});

test('checkpoint control accepts native fractional seconds as UTC and preserves that cutoff in its URL',async()=>{
 const current=await app('#/research?view=changes');
 await current.changeHandler({target:{id:'change-since',value:'2026-10-21T12:30:00.5'}});
 assert.equal(current.state().changeSince,'2026-10-21T12:30:00.500Z');assert.equal(parseRoute(current.location.hash).changeSince,current.state().changeSince);
 await current.changeHandler({target:{id:'change-since',value:'2026-02-30T12:30'}});
 assert.match(current.state().researchError,/valid|cutoff/i);assert.equal(current.state().changeSince,'2026-10-21T12:30:00.500Z');
});

test('actual workspace actions update one saved identity and reopen its renamed configuration',async()=>{
 const current=await app();await current.handleResearchAction({saveWorkspace:''});const id=current.workspaceId();
 Object.assign(current.state(),{window:'custom',startDate:'2026-01-01',endDate:'2026-06-30'});
 await current.handleResearchAction({saveWorkspace:''});assert.equal(current.researchLibrary.listWorkspaces().length,1);assert.equal(current.researchLibrary.getWorkspace(id).state.endDate,'2026-06-30');
 current.inputs.set(`workspace-label-${id}`,{value:'Renamed handler study'});await current.handleResearchAction({renameWorkspace:id});
 await current.handleResearchAction({openWorkspace:id});assert.equal(current.researchLibrary.getWorkspace(id).name,'Renamed handler study');assert.equal(current.state().page,'indicator');assert.equal(current.state().endDate,'2026-06-30');assert.equal(current.workspaceId(),id);
});

function delayFirstWorkspaceSave(library){
 const save=library.saveWorkspace.bind(library);let finish;
 library.saveWorkspace=record=>{library.saveWorkspace=save;return new Promise(resolve=>{finish=resolve;}).then(()=>save(record));};
 return ()=>finish();
}

test('a late saved-view update preserves a subsequently opened view and its next update target',async()=>{
 const current=await app('#/series/gdp');
 for(const [id,name,seriesId]of [['view-a','View A','gdp'],['view-b','View B','cpi']])await current.researchLibrary.saveWorkspace(createWorkspace({id,name,state:{...current.state(),seriesId}}));
 await current.handleResearchAction({openWorkspace:'view-a'});current.inputs.get('research-name').value='View A';
 const finish=delayFirstWorkspaceSave(current.researchLibrary),pending=current.handleResearchAction({saveWorkspace:''});
 await current.handleResearchAction({openWorkspace:'view-b'});current.inputs.get('research-name').value='View B';
 const scope=researchSaveScope(current.state());current.saveDrafts.get(scope,{name:'View B'});
 finish();await pending;
 assert.equal(current.workspaceId(),'view-b');assert.equal(current.state().seriesId,'cpi');assert.equal(current.saveDrafts.get(scope).name,'View B');
 await current.handleResearchAction({saveWorkspace:''});
 assert.equal(current.researchLibrary.getWorkspace('view-a').name,'View A');assert.equal(current.researchLibrary.getWorkspace('view-a').state.seriesId,'gdp');
 assert.equal(current.researchLibrary.getWorkspace('view-b').state.seriesId,'cpi');
});

test('clearing or reopening the same saved view supersedes its pending save activation',async()=>{
 for(const action of ['clear','reopen']){
  const current=await app();await current.handleResearchAction({saveWorkspace:''});const id=current.workspaceId();
  const finish=delayFirstWorkspaceSave(current.researchLibrary),pending=current.handleResearchAction({saveWorkspace:''});
  await current.handleResearchAction(action==='clear'?{clearWorkspace:''}:{openWorkspace:id});
  const scope=researchSaveScope(current.state()),draft=current.saveDrafts.get(scope,{name:'New unsaved draft'});
  finish();await pending;
  assert.equal(current.workspaceId(),action==='clear'?null:id);assert.equal(current.saveDrafts.get(scope),draft);
  assert.equal(draft.name,'New unsaved draft');assert.equal(draft.feedback,null);
 }
});

test('a newer save activation wins when an older new-view save completes last',async()=>{
 const current=await app(),finish=delayFirstWorkspaceSave(current.researchLibrary),pending=current.handleResearchAction({saveWorkspace:''});
 await current.handleResearchAction({clearWorkspace:''});current.inputs.get('research-name').value='Newer view';
 await current.handleResearchAction({saveWorkspace:''});const newest=current.workspaceId();
 finish();await pending;
 assert.equal(current.workspaceId(),newest);assert.equal(current.researchLibrary.getWorkspace(newest).name,'Newer view');
 assert.equal(current.researchLibrary.listWorkspaces().length,2);
});

test('pin and import actions dispatch original frozen JSON, CSV and attachments without substituting live exports',async()=>{
 const current=await app('#/series/gdp?window=custom&start=2026-01-01&end=2026-06-30&transform=change');
 await current.handleResearchAction({pinResult:''});const pkg=current.researchLibrary.getPackage(current.state().packageId);
 assert.ok(pkg);assert.equal(current.state().page,'research');assert.deepEqual(pkg.request.ids,['gdp']);assert.equal(pkg.request.transform,'change');assert.equal(pkg.resolvedWindow.startDate,'2026-01-01');
 await current.handleResearchAction({packageCsv:pkg.id});assert.equal(current.downloads.at(-1).content,pkg.csv);
 await current.handleResearchAction({packageJson:pkg.id});assert.equal(current.downloads.at(-1).content,exportResearchPackage(pkg));
 const attached=await createResearchPackage({id:'handler-attachment',name:'Portable evidence',state:{selected:['gdp'],range:1},context:{attachments:[{name:'original.csv',content:'measure,value\r\nCaptured,1\r\n',type:'text/csv'}]}}),text=exportResearchPackage(attached);
 await current.changeHandler({target:{id:'research-import',files:[{size:Buffer.byteLength(text),text:async()=>text}]}});
 assert.equal(current.state().packageId,attached.id);assert.equal(current.state().researchError,'');
 await current.handleResearchAction({packageAttachment:'0'});assert.equal(current.downloads.at(-1).content,attached.context.attachments[0].content);assert.equal(current.downloads.at(-1).name,'original.csv');
 await current.changeHandler({target:{id:'research-import',files:[{size:MAX_RESEARCH_JSON_BYTES+1,text:()=>{throw Error('Oversize file must not be read');}}]}});
 assert.match(current.state().researchError,/12 MiB|limit/);assert.equal(current.researchLibrary.listPackages().length,2);
});

test('the actual funding attachment action downloads generated full frozen history and rejects detached or unavailable packages',async()=>{
 const current=await app('#/market?window=custom&start=2019-09-01&end=2019-09-30');
 await current.handleResearchAction({pinResult:''});const pkg=current.researchLibrary.getPackage(current.state().packageId);
 assert.equal(pkg.context.fundingDistributions.version,2);assert.equal(pkg.context.attachments.length,0);
 await current.handleResearchAction({packageAttachment:'0'});const file=current.downloads.at(-1);
 assert.equal(file.name,'market-functioning.csv');assert.match(file.content,/,2016-03-01,/);assert.match(file.content,/,2018-04-02,/);
 current.listeners.get('resize')();assert.deepEqual(current.chartCalls.at(-1).chartCatalogs.funding.catalog.effr.observations,pkg.context.moduleSources.marketFunctioning.series.effr.observations);
 const before=current.downloads.length,getPackage=current.researchLibrary.getPackage;
 current.researchLibrary.getPackage=()=>({...pkg});
 await assert.rejects(current.handleResearchAction({packageAttachment:'0'}),/validated package/i);assert.equal(current.downloads.length,before);
 current.researchLibrary.getPackage=()=>undefined;
 await assert.rejects(current.handleResearchAction({packageAttachment:'0'}),/unavailable/i);assert.equal(current.downloads.length,before);
 current.researchLibrary.getPackage=getPackage;
 await assert.rejects(current.handleResearchAction({packageAttachment:'1'}),/unavailable/i);assert.equal(current.downloads.length,before);
});

test('the actual auction attachment action downloads both generated frozen exports',async()=>{
 const current=await app('#/auctions?type=Bill');
 await current.handleResearchAction({pinResult:''});const pkg=current.researchLibrary.getPackage(current.state().packageId);
 assert.equal(pkg.context.auctionExports.version,1);assert.equal(pkg.context.attachments.length,0);
 for(const index of [0,1]){
  await current.handleResearchAction({packageAttachment:String(index)});const file=current.downloads.at(-1),expected=researchPackageAttachment(pkg,index);
  assert.equal(file.name,expected.name);assert.equal(file.content,expected.content);
 }
 const before=current.downloads.length;
 await assert.rejects(current.handleResearchAction({packageAttachment:'2'}),/unavailable/i);assert.equal(current.downloads.length,before);
});

test('the actual resize callback keeps the selected frozen catalog across navigation and returns to live charts elsewhere',async()=>{
 const current=await app();await current.handleResearchAction({pinResult:''});const pkg=current.researchLibrary.getPackage(current.state().packageId),resize=current.listeners.get('resize');
 assert.equal(typeof resize,'function');resize();assert.equal(current.chartCalls.at(-1).catalog,pkg.catalog);
 current.navigate({page:'indicator',seriesId:'gdp'});resize();assert.equal(current.chartCalls.at(-1).catalog,undefined);
 current.navigate({page:'research',researchView:'packages',packageId:pkg.id});resize();assert.equal(current.chartCalls.at(-1).catalog,pkg.catalog);
});

test('the actual disclosure callback redraws only the expanded section with its frozen or live catalog',async()=>{
 const current=await app();await current.handleResearchAction({pinResult:''});const pkg=current.researchLibrary.getPackage(current.state().packageId),toggle=current.listeners.get('toggle');
 const section={tagName:'DETAILS',open:true,querySelector:()=>({})};assert.equal(typeof toggle,'function');
 toggle({target:section});assert.equal(current.chartRoots.at(-1),section);assert.equal(current.chartCalls.at(-1).catalog,pkg.catalog);
 current.navigate({page:'indicator',seriesId:'gdp'});toggle({target:section});assert.equal(current.chartRoots.at(-1),section);assert.equal(current.chartCalls.at(-1).catalog,undefined);
 const calls=current.chartCalls.length;section.open=false;toggle({target:section});assert.equal(current.chartCalls.length,calls);
});

test('actual CPI publication selection, CSV and pin actions use published monthly evidence',async()=>{
 const current=await app('#/research?view=publications&publicationSeries=cpiMonthly&period=2026-09-01&publishedBy=2026-10-14',{archive:cpiPublicationArchive});
 await current.handleResearchAction({exportPublications:''});assert.match(current.downloads[0].name,/cpi/);assert.match(current.downloads[0].content,/cpiMonthly/);assert.doesNotMatch(current.downloads[0].name,/gdp/);
 await current.handleResearchAction({pinPublication:''});const pkg=current.researchLibrary.getPackage(current.state().packageId);
 assert.equal(pkg.context.publicationSeries,'cpiMonthly');assert.equal(pkg.catalog.cpiMonthly.observations[0].value,0.6);assert.equal(pkg.catalog.cpiMonthly.adjustment,'Seasonally adjusted');
 const selector=await app('#/research?view=publications');await selector.changeHandler({target:{id:'publication-series',value:'cpiCore'}});assert.equal(selector.state().publicationSeries,'cpiCore');
});

test('actual GDP matrix and coverage exports preserve their selected scope and frozen result context',async()=>{
 const current=await app('#/research?view=publications&publicationMode=matrix&publishedBy=2026-09-30');
 await current.handleResearchAction({exportGdpMatrix:''});assert.equal(current.downloads.length,1);assert.match(current.downloads[0].name,/revision-matrix/);
 await current.handleResearchAction({pinGdpMatrix:''});const pkg=current.researchLibrary.getPackage(current.state().packageId);assert.equal(pkg.context.gdpRevisionMatrix.cutoff,'2026-09-30');
 const coverage=await app('#/explore?mode=coverage&q=unemployment&topic=Labor');await coverage.handleResearchAction({exportCoverage:''});assert.equal(coverage.downloads.length,1);assert.match(coverage.downloads[0].content,/first_reference_date/);assert.doesNotMatch(coverage.downloads[0].content,/^cpi,/m);
});


test('question action freezes exactly the explicit evidence and later view updates preserve the question',async()=>{
 const view=await app('#/series/yield?window=1y');
 await view.handleResearchAction({saveWorkspace:''});
 const prior=view.researchLibrary.listWorkspaces()[0];
 const fields={hypothesis:'Does labor support a slower inflation hypothesis?',support:'unrate',contradict:'cpi','review-date':'2026-11-01','review-event':'','condition-series':'unrate','condition-op':'>=','condition-value':'4'};
 for(const [name,value]of Object.entries(fields))view.inputs.set(`question-${name}-${prior.id}`,{value});
 Object.assign(view.questionDrafts.get(prior.id).draft,{hypothesis:fields.hypothesis,supportingSeriesIds:['unrate'],contradictingSeriesIds:['cpi'],reviewDate:fields['review-date'],reviewEvent:'',conditions:[{seriesId:'unrate',operator:'>=',value:'4'}]});
 await view.handleResearchAction({saveQuestion:prior.id});
 const saved=view.researchLibrary.getWorkspace(prior.id),baseline=view.researchLibrary.getPackage(saved.researchQuestion.baselinePackageId);
 assert.deepEqual(baseline.request.ids,['unrate','cpi']);assert.equal(saved.state.seriesId,'yield');
 assert.ok(baseline.catalog.unrate.observations.length>baseline.panels[0].observations.length,'full baseline inputs are retained, with bounded primary-window CSV');
 assert.equal(baseline.request.range.preset,'1y');
 await view.handleResearchAction({saveWorkspace:''});
 assert.equal(view.researchLibrary.getWorkspace(prior.id).researchQuestion.baselinePackageId,baseline.id);
});


test('conditional assumptions apply together and blank/invalid inputs cannot silently replace the displayed path',async()=>{
 const view=await app('#/economy?family=prices');
 for(const [id,value]of Object.entries({'pce-base-index':'pceCoreIndex','pce-monthly-rate':'0.25','pce-horizon-months':'6','pce-target-annual':'2.1'}))view.inputs.set(id,{value});
 view.applyPceAssumptions();
 assert.equal(view.state().pceMonthlyRate,.25);assert.equal(view.state().pceHorizonMonths,6);assert.equal(view.state().pceTargetAnnualRate,2.1);assert.equal(view.state().pceBaseIndex,'pceCoreIndex');
 assert.match(view.location.hash,/assumedMonthly=0.25/);
 view.inputs.get('pce-monthly-rate').value='';assert.throws(()=>view.applyPceAssumptions(),/no value was substituted/);assert.equal(view.state().pceMonthlyRate,.25);
 view.inputs.get('pce-monthly-rate').value='-100';assert.throws(()=>view.applyPceAssumptions(),/Invalid assumptions/);assert.equal(view.state().pceMonthlyRate,.25);
});


test('actual question validation preserves the whole draft, keeps its editor open and leaves the saved baseline untouched',async()=>{
 const view=await app('#/series/unrate');await view.handleResearchAction({saveWorkspace:''});const prior=view.researchLibrary.listWorkspaces()[0];
 const entry=view.questionDrafts.get(prior.id);Object.assign(entry.draft,{hypothesis:'Keep this unsaved question',supportingSeriesIds:['unrate'],contradictingSeriesIds:['cpi'],reviewDate:'2026-11-01',reviewEvent:'',conditions:[{seriesId:'unrate',operator:'>=',value:''}]});
 const before=structuredClone(entry.draft);
 for(const [name,value]of Object.entries({hypothesis:entry.draft.hypothesis,support:'unrate',contradict:'cpi','review-date':'2026-11-01','review-event':'','condition-series':'unrate','condition-op':'>=','condition-value':''}))view.inputs.set(`question-${name}-${prior.id}`,{value});
 await assert.doesNotReject(view.handleResearchAction({saveQuestion:prior.id}));
 assert.deepEqual(entry.draft,before);assert.equal(entry.status,'error');assert.match(entry.errors['condition-value'],/threshold/);assert.equal(entry.focusField,'condition-value');
 assert.equal(view.researchLibrary.getWorkspace(prior.id).researchQuestion,undefined);assert.equal(view.researchLibrary.listPackages().length,0);
});


test('actual Freeze never substitutes defaults when every preview measurement is unchecked',async()=>{
 const current=await app('#/series/unrate');current.saveDrafts.get(researchSaveScope(current.state()),{name:'Empty evidence',selected:[]});
 await assert.rejects(current.handleResearchAction({pinResult:''}),/one to four measurements/);assert.equal(current.researchLibrary.listPackages().length,0);
});

test('Freeze waits for full source inputs and retains its initiating measurement selection',async()=>{
 let finish,calls=[];
 const sourceController={ensure:ids=>{calls.push(ids);return new Promise(resolve=>{finish=resolve;});}};
 const current=await app('#/series/gdp?window=1y',{sourceController});
 const pending=current.handleResearchAction({pinResult:''});await Promise.resolve();
 assert.deepEqual(calls,[['bea']]);assert.equal(current.researchLibrary.listPackages().length,0);
 current.state().freezeSelection=[];finish();await pending;
 const pkg=current.researchLibrary.getPackage(current.state().packageId);
 assert.deepEqual(pkg.request.ids,['gdp']);
 assert.equal(pkg.catalog.gdp.observations.length,series.gdp.observations.length);
});

test('the latest requested Overview chart wins when full histories finish out of order',async()=>{
 const pending=[];
 const sourceController={ensure:ids=>new Promise(resolve=>pending.push({ids,resolve}))};
 const current=await app('#/overview?selected=unrate',{sourceController});
 const select=value=>current.changeHandler({target:{matches:selector=>selector==='[data-workspace-series]',value}});
 const earlier=select('payroll'),later=select('yield');
 assert.deepEqual(pending.map(item=>item.ids),[['bls'],['treasury']]);
 pending[1].resolve();await later;assert.equal(current.chartPreview(),'yield');
 pending[0].resolve();await earlier;assert.equal(current.chartPreview(),'yield');
 assert.deepEqual(current.state().selected,['unrate']);
});

test('Overview Freeze captures the chart family, range and preview requested before history loading',async()=>{
 let finish;
 const sourceController={ensure:()=>new Promise(resolve=>{finish=resolve;})};
 const current=await app('#/overview',{sourceController});
 const pending=current.handleResearchAction({pinResult:''});await Promise.resolve();
 current.chartSettings().inflationFamily='headline';current.chartSettings().growth='all';current.previewState().overview='payroll';
 finish();await pending;
 const charts=current.researchLibrary.getPackage(current.state().packageId).context.overviewComparisonCharts;
 assert.equal(charts[0].preset,'2y');
 assert.deepEqual(charts[0].series.map(s=>s.id),['gdp','privateDomesticDemandGrowth']);
 assert.equal(charts[1].family,'core');
});

test('Freeze cannot save evidence from another route when source loading finishes late',async()=>{
 let finish;const sourceController={ensure:()=>new Promise(resolve=>{finish=resolve;})};
 const current=await app('#/series/gdp?window=all',{sourceController});
 const pending=current.handleResearchAction({pinResult:''});await Promise.resolve();
 current.navigate({page:'overview'});finish();await assert.rejects(pending,/view changed/i);
 assert.equal(current.researchLibrary.listPackages().length,0);assert.equal(current.state().page,'overview');
});

test('question baseline waits for all explicit evidence histories before saving',async()=>{
 let finish,calls=[];const sourceController={ensure:ids=>{calls.push(ids);return new Promise(resolve=>{finish=resolve;});}};
 const current=await app('#/series/yield?window=1y',{sourceController});
 await current.handleResearchAction({saveWorkspace:''});const prior=current.researchLibrary.listWorkspaces()[0];
 const entry=current.questionDrafts.get(prior.id);
 Object.assign(entry.draft,{
  hypothesis:'Retain the chosen evidence histories',supportingSeriesIds:['unrate'],contradictingSeriesIds:['gdp'],conditions:[],
 });
 const pending=current.handleResearchAction({saveQuestion:prior.id});await Promise.resolve();
 assert.deepEqual(calls,[['bls','bea']]);assert.equal(current.researchLibrary.listPackages().length,0);
 finish();await pending;
 const saved=current.researchLibrary.getWorkspace(prior.id),pkg=current.researchLibrary.getPackage(saved.researchQuestion.baselinePackageId);
 assert.deepEqual(pkg.request.ids,['unrate','gdp']);
 assert.equal(pkg.catalog.unrate.observations.length,series.unrate.observations.length);
});
