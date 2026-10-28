import test from 'node:test';
import assert from 'node:assert/strict';
import {frozenObservationPages} from '../src/frozen-table.js';
test('frozen table starts at newest and exposes every retained row without changing chart input order',()=>{
 const rows=Array.from({length:117},(_,i)=>({date:String(i),value:i})),pages=frozenObservationPages(rows);
 assert.deepEqual(pages.map(p=>p.rows.length),[50,50,17]);assert.equal(pages[0].rows[0].value,116);assert.equal(pages.at(-1).rows.at(-1).value,0);
 assert.equal(new Set(pages.flatMap(p=>p.rows).map(r=>r.date)).size,117);assert.equal(rows[0].value,0);
});
