import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/overview-disclosures.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const node=(key,open)=>({dataset:{overviewDisclosure:key},open});
const container=nodes=>({querySelectorAll:()=>nodes});

test('open and closed Overview disclosures survive replaced DOM after async evidence loads',()=>{
 assert.equal(typeof api.createOverviewDisclosureMemory,'function');
 const memory=api.createOverviewDisclosureMemory();
 memory.capture(container([node('weekly',true),node('publications',false)]));
 const next=[node('weekly',false),node('publications',true),node('new-warning',true)];memory.restore(container(next));
 assert.deepEqual(next.map(row=>row.open),[true,false,true]);
});
test('other pages do not erase Overview disclosure state, while closing a section is remembered',()=>{
 assert.equal(typeof api.createOverviewDisclosureMemory,'function');
 const memory=api.createOverviewDisclosureMemory(),weekly=node('weekly',true);
 memory.capture(container([weekly]));memory.capture(container([]));
 const returned=node('weekly',false);memory.restore(container([returned]));assert.equal(returned.open,true);
 returned.open=false;memory.capture(container([returned]));
 const refreshed=node('weekly',true);memory.restore(container([refreshed]));assert.equal(refreshed.open,false);
});
