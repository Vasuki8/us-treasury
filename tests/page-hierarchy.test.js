import test from 'node:test';
import assert from 'node:assert/strict';
import {createOverviewDisclosureMemory} from '../src/overview-disclosures.js';
import {metrics,seriesTable} from '../src/ui.js';
import {getSeries,formatChange,formatValue} from '../src/model.js';
import {measurementChange} from '../src/measurement-change.js';
const api=await import('../src/page-hierarchy.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const node=(key,open,overview=false)=>({dataset:overview?{overviewDisclosure:key}:{pageDisclosure:key},open});
const container=nodes=>({querySelectorAll:()=>nodes});

test('supporting sections escape external labels while preserving native rendered controls',()=>{
 assert.equal(typeof api.supportingDetails,'function');
 const html=api.supportingDetails('labor:<focus>','Methods <feed>','<button data-export>CSV</button>',{meta:'3 & sources',open:true});
 assert.match(html,/data-page-disclosure="labor:&lt;focus&gt;"/);assert.match(html,/Methods &lt;feed&gt;/);assert.match(html,/3 &amp; sources/);
 assert.match(html,/<button data-export>CSV<\/button>/);assert.match(html,/<details[^>]* open>/);
});

test('supporting disclosure choices remain separate across pages and the approved Overview',()=>{
 const memory=createOverviewDisclosureMemory();
 memory.capture(container([node('labor:methods',true),node('calendar:methods',false),node('labor:methods',false,true)]));
 const next=[node('labor:methods',false),node('calendar:methods',true),node('labor:methods',true,true),node('release:new-warning',true)];
 memory.restore(container(next));assert.deepEqual(next.map(x=>x.open),[true,false,false,true]);
 memory.capture(container([]));const returned=node('labor:methods',false);memory.restore(container([returned]));assert.equal(returned.open,true);
 returned.open=false;memory.capture(container([returned]));const refreshed=node('labor:methods',true);memory.restore(container([refreshed]));assert.equal(refreshed.open,false);
});

test('headline and table changes retain units and prior period without repeating the current period prose',()=>{
 const current=getSeries('gdp'),change=measurementChange(current),html=metrics(['gdp']);
 const reading=html.match(/class="metric-change"[^>]*>([^<]+)<\/span>/)?.[1];
 assert.equal(reading,`Growth-rate change ${formatChange(current)} vs ${change.priorPeriod}`);
 assert.ok(html.includes(`title="${change.text}"`),'complete explanation remains available');
 assert.ok(seriesTable(['gdp']).includes(`>${reading}</td>`));
 const payroll=getSeries('payroll'),prior=payroll.observations.at(-2);
 const payrollReading=metrics(['payroll']).match(/class="metric-change"[^>]*>([^<]+)<\/span>/)?.[1];
 assert.equal(payrollReading,`Prior month: ${formatValue(payroll,prior.value)}`);
});

test('an unavailable prior comparison stays explicit in compact metric readings',()=>{
 const current=getSeries('spread2s10s'),point=current.observations.at(-1),saved=point.value;point.value=null;
 try{assert.match(metrics(['spread2s10s']),/class="metric-change"[^>]*>Comparison unavailable<\/span>/);}
 finally{point.value=saved;}
});

test('expanding analysis redraws only its native charts and leaves unrelated cursor state alone',()=>{
 assert.equal(typeof api.watchDisclosureCharts,'function');
 let listener,capture;const calls=[],root={addEventListener:(type,handler,useCapture)=>{assert.equal(type,'toggle');listener=handler;capture=useCapture;}};
 api.watchDisclosureCharts(root,section=>calls.push(section));assert.equal(capture,true,'native toggle events need capture');
 const closed={tagName:'DETAILS',open:false,querySelector:()=>({})},notes={tagName:'DETAILS',open:true,querySelector:()=>null},analysis={tagName:'DETAILS',open:true,querySelector:()=>({})};
 listener({target:closed});listener({target:notes});listener({target:{tagName:'DIV',open:true}});assert.deepEqual(calls,[]);
 listener({target:analysis});assert.deepEqual(calls,[analysis]);
});
