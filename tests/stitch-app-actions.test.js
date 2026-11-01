import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRoute,routeFor} from '../src/router.js';
import {readPreferences,writePreferences,normalizePreferences} from '../src/storage.js';
import {requiredSourceIds} from '../src/source-controller.js';
import {toCsv} from '../src/model.js';
import {viewRange} from '../src/workspace-context.js';
import {overviewPage} from '../src/overview-page.js';

const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const ids=['gdp','pceCore','unrate','yield','payroll','policyTargetUpper','spread2s10s','interestRevenueRatio'];
const section=(from,to)=>{
 const start=source.indexOf(from),end=source.indexOf(to,start);assert.ok(start>=0&&end>start);return source.slice(start,end);
};
function app({preferences={},ensure=async()=>{},storageFailure=false,sectionTargets={}}={}){
 const values=new Map([['meridian.preferences.v1',JSON.stringify(preferences)]]),writes=[],renders=[],notices=[],downloads=[],sourceCalls=[];
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes.push({key,value});if(storageFailure)throw Error('quota');values.set(key,value);}};
 const densityButtons=['comfortable','compact'].map(value=>({dataset:{displayDensity:value},attributes:new Map(),setAttribute(name,value){this.attributes.set(name,value);}}));
 const label={textContent:''},sun={hidden:false},moon={hidden:true},themeButton={querySelector:selector=>({'[data-theme-label]':label,'[data-theme-sun]':sun,'[data-theme-moon]':moon}[selector]),setAttribute(){}};
 const desktopDensity={value:''},mobileDensity={value:''},root={dataset:{}},meta={content:''};
 const document={documentElement:{dataset:{}},querySelector:()=>meta,querySelectorAll:()=>densityButtons,getElementById:id=>sectionTargets[id]??({'theme-toggle':themeButton,'density-select':desktopDensity,'density-select-mobile':mobileDensity}[id])};
 let handlers;
 const env={state:{...parseRoute('#/overview'),...readPreferences(storage),selected:['cpi'],freezeSelection:['gdp']},root,document,storage,writePreferences,normalizePreferences,routeFor,requiredSourceIds,toCsv,viewRange,
  announce:message=>notices.push(message),render:options=>{renders.push(options);handlers.apply();},downloadCsv:(content,name)=>downloads.push({content,name}),
  dataStatus:{sourceArchive:{sources:{}}},sourceController:{ensure:async selected=>{sourceCalls.push(selected);await ensure(selected);}},actionFeedback(){},main:{querySelector:()=>null},esc:value=>value};
 const delegated=/root\.addEventListener\('click',async event=>\{([^]*?)\n\}\);/.exec(source);assert.ok(delegated);
 handlers=new Function('env',`let {${Object.keys(env).join(',')}}=env;
  ${section('function persist()','function rememberFocus()')}
  ${section('function exportCsv(','function downloadJson(')}
  ${section('async function ensureSourceAction(','function stored(')}
  return {state:()=>state,apply:applyAppearance,click:async event=>{${delegated[1]}}};`)(env);
 return {...handlers,click:data=>handlers.click({target:{closest:()=>({dataset:data,disabled:false})}}),values,writes,renders,notices,downloads,sourceCalls,storage,root,document,densityButtons,desktopDensity,mobileDensity};
}

test('Labor section actions focus the destination heading before scrolling, preserving forward keyboard traversal',async()=>{
 for(const id of ['labor-analysis','labor-weekly','labor-trends','labor-readings','labor-notes']){
  const calls=[],heading={tabIndex:null,focus:options=>calls.push(['focus',options])};
  const target={querySelector:selector=>{assert.equal(selector,'h2');return heading;},scrollIntoView:options=>calls.push(['scroll',options])};
  const view=app({sectionTargets:{[id]:target}});await view.click({laborSection:id});
  assert.equal(heading.tabIndex,-1);assert.deepEqual(calls,[['focus',{preventScroll:true}],['scroll',{block:'start'}]]);
 }
 const view=app();await assert.doesNotReject(view.click({laborSection:'unknown'}));
 await assert.doesNotReject(view.click({laborSection:'labor-notes'}));
});

test('Follow Page adds the eight Overview readings once to the active named watchlist while preserving other lists and selections',async()=>{
 const view=app({preferences:{theme:'Graphite',density:'comfortable',activeWatchlistId:'rates',watchlists:[{id:'default',name:'Default',saved:['cpi']},{id:'rates',name:'Rates',saved:['sofr','yield']}]}});
 await view.click({overviewFollow:''});
 assert.deepEqual(view.state().saved,['sofr','yield',...ids.filter(id=>id!=='yield')]);
 assert.equal(view.state().activeWatchlistId,'rates');assert.deepEqual(view.state().selected,['cpi']);assert.equal(view.state().freezeSelection,undefined);
 const restored=readPreferences(view.storage);
 assert.deepEqual(restored.watchlists[0].saved,['cpi']);assert.deepEqual(restored.watchlists[1].saved,view.state().saved);
 assert.equal(restored.theme,'Graphite');assert.equal(restored.density,'comfortable');
 assert.equal(view.writes.length,1);assert.deepEqual(view.renders,[{preserveFocus:true}]);assert.match(view.notices.at(-1),/Added 7 Overview readings to Rates/);
 assert.match(overviewPage(view.state()),/data-overview-follow aria-pressed="true"/);
 await view.click({overviewFollow:''});
 assert.equal(view.state().saved.length,9);assert.match(view.notices.at(-1),/already followed/);
});

test('Follow Page remains usable with truthful session-only feedback when browser persistence fails',async()=>{
 const view=app({storageFailure:true});await view.click({overviewFollow:''});
 assert.deepEqual(view.state().saved,ids);assert.equal(view.state().storageAvailable,false);
 assert.equal(view.renders.length,1);assert.match(view.notices.at(-1),/session; browser storage is unavailable/);
});

test('Overview CSV waits for all eight readings’ complete source inputs without using comparison selections',async()=>{
 let finish;const view=app({ensure:()=>new Promise(resolve=>{finish=resolve;})});
 const pending=view.click({overviewExport:''});await Promise.resolve();
 assert.deepEqual(view.sourceCalls,[['bea','bls','treasury','policyRates','yields','fiscal']]);assert.equal(view.downloads.length,0);
 finish();await pending;
 assert.equal(view.downloads.length,1);assert.equal(view.downloads[0].content,toCsv(ids,{transform:'level',range:view.state().range,comparison:'native'}));
 assert.deepEqual(view.state().selected,['cpi']);assert.equal(view.writes.length,0);
});

test('Overview CSV aborts on source failure or navigation while complete inputs are loading',async()=>{
 const failed=app({ensure:async()=>{throw Error('HTTP 503');}});await failed.click({overviewExport:''});
 assert.equal(failed.downloads.length,0);assert.match(failed.notices.at(-1),/Export unavailable: HTTP 503/);
 let finish;const moved=app({ensure:()=>new Promise(resolve=>{finish=resolve;})}),pending=moved.click({overviewExport:''});
 await Promise.resolve();moved.state().page='calendar';finish();await pending;
 assert.equal(moved.downloads.length,0);assert.match(moved.notices.at(-1),/view changed while history loaded/i);
});

test('COMF and DENSE actions persist density and synchronize both selects and pressed states while preserving the theme',async()=>{
 const view=app({preferences:{theme:'Graphite',density:'compact',saved:['cpi']}});view.apply();
 assert.deepEqual(view.densityButtons.map(button=>button.attributes.get('aria-pressed')),['false','true']);
 await view.click({displayDensity:'comfortable'});
 assert.equal(view.state().density,'comfortable');assert.equal(view.root.dataset.density,'comfortable');
 assert.equal(view.desktopDensity.value,'comfortable');assert.equal(view.mobileDensity.value,'comfortable');
 assert.deepEqual(view.densityButtons.map(button=>button.attributes.get('aria-pressed')),['true','false']);
 assert.equal(readPreferences(view.storage).density,'comfortable');assert.equal(view.state().theme,'Graphite');assert.deepEqual(view.state().saved,['cpi']);
 await view.click({displayDensity:'compact'});
 assert.equal(view.state().density,'compact');assert.deepEqual(view.densityButtons.map(button=>button.attributes.get('aria-pressed')),['false','true']);
 assert.equal(view.writes.length,2);assert.equal(view.renders.length,2);
 await view.click({displayDensity:'unknown'});assert.equal(view.writes.length,2);assert.equal(view.renders.length,2);
});
