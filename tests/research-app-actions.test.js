import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createWorkspace,openWorkspace,MAX_RESEARCH_JSON_BYTES} from '../src/research-workspaces.js';
import {createResearchPackage,importResearchPackage,exportResearchPackage,researchPackageCsv} from '../src/research-packages.js';
import {createResearchLibrary as createLibrary} from '../src/research-library.js';
const createResearchLibrary=storage=>createLibrary(storage,{locks:{request:async(_name,_options,callback)=>callback()}});
import {buildPinContext,buildPublicationPin} from '../src/research-context.js';
import {parseRoute,routeFor} from '../src/router.js';
import {updateWorkspaceSelection} from '../src/workspace-context.js';
import {normalizedCutoff} from '../src/vintages-page.js';
import {normalizeVintageTimestamp} from '../src/vintages.js';
import {dataStatus} from '../src/data.js';
import {publicationArchive} from '../src/publication-archive.js';
import {publicationCsv} from '../src/publication-history.js';
import {changesCsv,writeChangeCheckpoint} from '../src/capture-changes.js';

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

// Run the actual delegated handlers and chart/resize helpers. Browser element
// boundaries are replaced; model, package, storage and route contracts stay real.
async function app(hash='#/series/gdp?window=all'){
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
 const researchLibrary=await createResearchLibrary(storage),inputs=new Map([['research-name',{value:'Handler research'}]]),downloads=[],chartCalls=[],listeners=new Map(),announcements=[];
 const location={hash},history={pushState:(_state,_title,route)=>{location.hash=route;},replaceState:(_state,_title,route)=>{location.hash=route;}};
 const env={createWorkspace,openWorkspace,createResearchPackage,importResearchPackage,exportResearchPackage,researchPackageCsv,MAX_RESEARCH_JSON_BYTES,buildPinContext,buildPublicationPin,normalizedCutoff,normalizeVintageTimestamp,researchLibrary,parseRoute,routeFor,updateWorkspaceSelection,dataStatus,publicationArchive,publicationCsv,changesCsv,writeChangeCheckpoint,storage,
  state:{...parseRoute(hash),saved:[]},activeWorkspaceId:null,researchLabel:'',pinBusy:false,changeCheckpoint:{enabled:true,since:'2026-10-01T12:00:00.000Z',snapshotAt:'2026-10-01T12:00:00.000Z'},changeState:{status:'ready',history:{captures:[]}},historyController:{context:()=>({historyState:{status:'idle'}})},
  document:{getElementById:id=>inputs.get(id)},location,history,main:{},window:{addEventListener:(name,callback)=>listeners.set(name,callback)},cancelAnimationFrame(){},requestAnimationFrame(callback){callback();return 1;},render(){},rememberWorkspace(){},announce:message=>announcements.push(message),renderCharts:(root,options)=>chartCalls.push(options),downloadCsv:(content,name)=>downloads.push({content,name}),downloadJson:pkg=>downloads.push({content:exportResearchPackage(pkg),name:'json'}),changesContext:()=>({status:'ready',rows:[]}),syncChanges(){}};
 const change=/root\.addEventListener\('change',async event=>\{([^]*?)\n\}\);/.exec(source);assert.ok(change,'App change delegation must exist');
 const code=`let {${Object.keys(env).join(',')}}=env;\n`
  +section('function currentPackage()','function researchActions()')
  +section('function navigate(',"window.addEventListener('hashchange'")
  +section('function stored(',"root.addEventListener('click'")
  +section('let resizeFrame;','\nrender();')
  +`;return {handleResearchAction,changeHandler:async event=>{${change[1]}},navigate,state:()=>state,workspaceId:()=>activeWorkspaceId,checkpoint:()=>changeCheckpoint};`;
 const handlers=new Function('env',code)(env);
 return {...handlers,researchLibrary,values,inputs,downloads,chartCalls,listeners,announcements,location};
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

test('the actual resize callback keeps the selected frozen catalog across navigation and returns to live charts elsewhere',async()=>{
 const current=await app();await current.handleResearchAction({pinResult:''});const pkg=current.researchLibrary.getPackage(current.state().packageId),resize=current.listeners.get('resize');
 assert.equal(typeof resize,'function');resize();assert.equal(current.chartCalls.at(-1).catalog,pkg.catalog);
 current.navigate({page:'indicator',seriesId:'gdp'});resize();assert.equal(current.chartCalls.at(-1).catalog,undefined);
 current.navigate({page:'research',researchView:'packages',packageId:pkg.id});resize();assert.equal(current.chartCalls.at(-1).catalog,pkg.catalog);
});
