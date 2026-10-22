import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryController, preserveHistoryView, historySeriesId } from '../src/history-controller.js';
import { renderPage } from '../src/pages.js';

const ready={status:'ready',history:{version:1,captures:[]},error:null};
function fixture(){
 let route={page:'overview'},loads=0;
 const groups={gdp:'bea',pce:'bea',debt:'treasury',unrate:'bls',cpi:'bls'},states=new Map(),requests=new Map();
 const group=id=>groups[id??'gdp'];
 const loader={getState:id=>states.get(group(id))??{status:'idle',history:null,error:null},revisions:id=>[{id}],load:(id,{retry=false}={})=>{
  const key=group(id),state=states.get(key);if(state?.status==='loading'||state?.status==='ready')return requests.get(key).promise;
  if(state?.status==='error'&&!retry)return Promise.reject(state.error);
  loads++;states.set(key,{status:'loading',history:null,error:null});
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});requests.set(key,{promise,resolve,reject});return promise;
 }};
 const changes=[];
 const controller=createHistoryController(loader,{getRoute:()=>route,onChange:()=>changes.push({...route})});
 return {controller,changes,setRoute:value=>{route=value;controller.sync(route);},complete:(key='bea')=>{states.set(key,{...ready,sourceIds:[key]});requests.get(key).resolve(ready.history);},fail:(key='bea')=>{const error=new Error('offline');states.set(key,{status:'error',history:null,error});requests.get(key).reject(error);},get loads(){return loads;}};
}

test('only revision routes request history; late completion never repaints another route',async()=>{
 const f=fixture();
 for(const route of [{page:'overview'},{page:'indicator',seriesId:'gdp',tab:'data'},{page:'indicator',seriesId:'gdp',tab:'methodology'}])f.setRoute(route);
 assert.equal(f.loads,0);
 f.setRoute({page:'vintages',vintageCutoff:'2026-10-20T12:00:00.000Z'});
 assert.equal(f.loads,1);
 f.setRoute({page:'overview'});
 f.complete();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.changes,[]);
 f.setRoute({page:'indicator',seriesId:'gdp',tab:'revisions'});
 assert.equal(f.loads,1);
 assert.deepEqual(f.controller.context({page:'indicator',seriesId:'gdp',tab:'revisions'}).revisions,[{id:'gdp'}]);
});

test('different source selections load independently and an old completion cannot repaint the new selection',async()=>{
 const f=fixture();
 f.setRoute({page:'vintages',vintageSeries:'gdp',vintageCutoff:'2026-10-20T12:00:00.000Z'});
 f.setRoute({page:'vintages',vintageSeries:'debt',vintageCutoff:'2026-10-21T12:00:00.000Z'});
 assert.equal(f.loads,2);f.complete();await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(f.changes,[]);
 assert.equal(f.controller.context({page:'vintages',vintageSeries:'debt'}).historyState.status,'loading');
 f.complete('treasury');await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.changes,[{page:'vintages',vintageSeries:'debt',vintageCutoff:'2026-10-21T12:00:00.000Z'}]);
});

test('series sharing a source complete the current route without restarting its request',async()=>{
 const f=fixture();f.setRoute({page:'vintages',vintageSeries:'gdp'});f.setRoute({page:'vintages',vintageSeries:'pce',vintageCutoff:'2026-10-20T12:00:00.000Z'});
 assert.equal(f.loads,1);f.complete();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.changes,[{page:'vintages',vintageSeries:'pce',vintageCutoff:'2026-10-20T12:00:00.000Z'}]);
});

test('a failed source does not block another source and retry targets only the selected one',async()=>{
 const f=fixture();f.setRoute({page:'vintages',vintageSeries:'gdp'});f.fail();await new Promise(resolve=>setImmediate(resolve));
 f.setRoute({page:'indicator',seriesId:'unrate',tab:'revisions'});assert.equal(f.loads,2);f.complete('bls');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.controller.context({page:'indicator',seriesId:'unrate',tab:'revisions'}).historyState.status,'ready');
 f.setRoute({page:'vintages',vintageSeries:'gdp'});assert.equal(f.loads,2);f.controller.sync({page:'vintages',vintageSeries:'gdp'},{retry:true});assert.equal(f.loads,3);
 f.complete();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.controller.context({page:'vintages',vintageSeries:'gdp'}).historyState.status,'ready');
});

test('history selection uses the correct route field and registered GDP fallback',()=>{
 assert.equal(historySeriesId({page:'vintages',vintageSeries:'debt',seriesId:'gdp'}),'debt');
 assert.equal(historySeriesId({page:'indicator',seriesId:'cpi',vintageSeries:'debt'}),'cpi');
 assert.equal(historySeriesId({page:'vintages',vintageSeries:'unknown'}),'gdp');
});

test('load failure only retries explicitly and leaves the current route selected',async()=>{
 const f=fixture();f.setRoute({page:'vintages'});f.fail();await new Promise(resolve=>setImmediate(resolve));
 f.setRoute({page:'vintages'});assert.equal(f.loads,1);
 f.controller.sync({page:'vintages'},{retry:true});assert.equal(f.loads,2);
 f.complete();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.controller.context({page:'vintages'}).historyState.status,'ready');
});

test('async repaint restores focused cutoff selection and scroll, and stable retry focus',()=>{
 for(const id of ['vintage-cutoff','history-retry']){
  const old={id,tagName:'INPUT',dataset:{},selectionStart:2,selectionEnd:4,value:'2026-10-20T14:30'};let active=old;
  const replacement={id,focus:options=>{active=replacement;assert.deepEqual(options,{preventScroll:true});},setSelectionRange:(start,end)=>{replacement.selection=[start,end];}};
  const document={get activeElement(){return active;},getElementById:()=>replacement};
  const main={ownerDocument:document,contains:node=>node===old,querySelectorAll:()=>[]};
  const window={scrollX:12,scrollY:300,scrollTo:value=>{window.restored=value;}};
  preserveHistoryView(main,()=>{active=null;window.scrollY=0;},{window,document});
  assert.equal(active,replacement);assert.equal(replacement.value,old.value);assert.deepEqual(replacement.selection,[2,4]);assert.deepEqual(window.restored,{left:12,top:300,behavior:'instant'});
 }
});

test('async history repaint restores file-input focus without assigning a browser-protected filename',()=>{
 const old={id:'research-import',tagName:'INPUT',type:'file',dataset:{},value:'C:\\fakepath\\pinned.json',selectionStart:null,selectionEnd:null};let active=old,assignments=0;
 const replacement={id:'research-import',type:'file',focus:()=>{active=replacement;},set value(value){assignments++;if(value)throw new DOMException('File input values may only be set to the empty string.','InvalidStateError');}};
 const document={get activeElement(){return active;},getElementById:()=>replacement},main={ownerDocument:document,contains:node=>node===old,querySelectorAll:()=>[]},window={scrollX:8,scrollY:120,scrollTo:value=>{window.restored=value;}};
 assert.doesNotThrow(()=>preserveHistoryView(main,()=>{active=null;},{window,document}));
 assert.equal(active,replacement);assert.equal(assignments,0);assert.deepEqual(window.restored,{left:8,top:120,behavior:'instant'});
});

test('successful retry focuses the current history control after its retry button disappears',()=>{
 for(const fallbackId of ['vintage-cutoff','detail-tab-revisions']){
  const retry={id:'history-retry',tagName:'BUTTON',dataset:{retryHistory:''},value:''};let active=retry;
  const target={id:fallbackId,value:'2026-10-21T12:00',focus:()=>{active=target;}};
  const document={get activeElement(){return active;},getElementById:id=>id===fallbackId?target:null};
  const main={ownerDocument:document,contains:node=>node===retry,querySelectorAll:()=>[]};
  preserveHistoryView(main,()=>{active=null;},{window:{scrollX:0,scrollY:10,scrollTo(){}},document});
  assert.equal(active,target);assert.equal(target.value,'2026-10-21T12:00');
 }
});

test('idle, loading and failed history never render the verified empty state or an enabled CSV',()=>{
 for(const status of ['idle','loading','error']){
  const historyState={status,history:null,error:status==='error'?new Error('<offline>'):null};
  const html=renderPage({page:'vintages',vintageCutoff:'2026-10-20T12:00:00.000Z'},{historyState});
  assert.match(html,/data-export-vintages[^>]*disabled/);assert.doesNotMatch(html,/No capture history is available|No baseline exists at this cutoff/);
  assert.match(html,/id="vintage-cutoff"[^>]*value="2026-10-20T12:00:00.000"/);
  const detail=renderPage({page:'indicator',seriesId:'gdp',tab:'revisions'},{historyState});
  assert.doesNotMatch(detail,/No observed value changes have been captured/);
  assert.match(html,status==='error'?/role="alert"/:/role="status"/);
  if(status==='error'){assert.match(html,/id="history-retry"/);assert.match(html,/&lt;offline&gt;/);}
  if(status==='loading')assert.doesNotMatch(html,/<button[^>]*id="history-retry"[^>]*\sdisabled(?:\s|>)/);
 }
 const html=renderPage({page:'vintages'},{historyState:ready});
 assert.match(html,/No capture history is available/);
});
