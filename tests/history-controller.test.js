import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryController, preserveHistoryView } from '../src/history-controller.js';
import { renderPage } from '../src/pages.js';

const ready={status:'ready',history:{version:1,captures:[]},error:null};
function fixture(){
 let route={page:'overview'},historyState={status:'idle',history:null,error:null},complete,fail,loads=0;
 const loader={getState:()=>historyState,revisions:id=>[{id}],load:()=>{loads++;historyState={...historyState,status:'loading'};return new Promise((resolve,reject)=>{complete=()=>{historyState=ready;resolve(ready.history);};fail=()=>{historyState={status:'error',history:null,error:new Error('offline')};reject(historyState.error);};});}};
 const changes=[];
 const controller=createHistoryController(loader,{getRoute:()=>route,onChange:()=>changes.push({...route})});
 return {controller,changes,setRoute:value=>{route=value;controller.sync(route);},complete:()=>complete(),fail:()=>fail(),get loads(){return loads;}};
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

test('completion uses the current cutoff and selected series without restarting a shared load',async()=>{
 const f=fixture();
 f.setRoute({page:'vintages',vintageSeries:'gdp',vintageCutoff:'2026-10-20T12:00:00.000Z'});
 f.setRoute({page:'vintages',vintageSeries:'debt',vintageCutoff:'2026-10-21T12:00:00.000Z'});
 assert.equal(f.loads,1);f.complete();await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(f.changes,[{page:'vintages',vintageSeries:'debt',vintageCutoff:'2026-10-21T12:00:00.000Z'}]);
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
