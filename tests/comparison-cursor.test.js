import test from 'node:test';
import assert from 'node:assert/strict';
import {createLinkedCursor,cursorReadings} from '../src/comparison-cursor.js';

const panels=[{series:{id:'daily'},observations:[{date:'2026-08-01',value:0},{date:'2026-08-02',value:2},{date:'2026-08-03',value:null}]},{series:{id:'monthly'},observations:[{date:'2026-08-01',value:100}]}];
test('linked cursor uses exact reference dates and preserves zero, missing and unmatched values',()=>{
 assert.deepEqual(cursorReadings(panels,'2026-08-02').map(r=>[r.seriesId,r.value,r.status]),[['daily',2,'observed'],['monthly',null,'no observation on this date']]);
 assert.equal(cursorReadings(panels,'2026-08-01')[0].value,0);
 assert.equal(cursorReadings(panels,'2026-08-03')[0].status,'explicit missing value');
});
test('pointer selections and keyboard movement broadcast one union date without mutating observations',()=>{
 const before=JSON.stringify(panels),cursor=createLinkedCursor(panels),a=[],b=[];
 cursor.subscribe(value=>a.push(value.date));cursor.subscribe(value=>b.push(value.date));
 assert.equal(cursor.date,'2026-08-03');cursor.select('2026-08-01');cursor.move(1);cursor.move('end');cursor.move('home');
 assert.deepEqual(a,b);assert.deepEqual(a,['2026-08-03','2026-08-01','2026-08-02','2026-08-03','2026-08-01']);
 assert.equal(JSON.stringify(panels),before);assert.throws(()=>cursor.select('2026-08-31'),/reference date/);
});
test('empty and disconnected cursor listeners remain safe',()=>{
 const empty=createLinkedCursor([]);assert.equal(empty.date,null);empty.move(1);
 const cursor=createLinkedCursor(panels);let calls=0;const stop=cursor.subscribe(()=>calls++);stop();cursor.move('home');assert.equal(calls,1);
});
