import test from 'node:test';
import assert from 'node:assert/strict';
import { watchlistMonitor, moveFollowed, monitorUpdateLabel } from '../src/watchlist-monitor.js';
const catalog={a:{id:'a',topic:'Growth',fetchedAt:'2026-10-22T10:00:00Z'},b:{id:'b',topic:'Labor',fetchedAt:'2026-10-21T10:00:00Z'}};
test('manual ordering is stable, bounded and does not mutate prior preferences',()=>{
 const saved=['a','b'];assert.deepEqual(moveFollowed(saved,'b',-1),['b','a']);assert.deepEqual(saved,['a','b']);assert.deepEqual(moveFollowed(saved,'a',-1),saved);assert.deepEqual(moveFollowed(saved,'unknown',1),saved);
});
test('checkpoint badges distinguish new periods, backfills and observed changes without inventing a verified revision',()=>{
 const changes={status:'ready',rows:[{seriesId:'a',kind:'value-change'},{seriesId:'b',kind:'historical-backfill'}]};
 assert.equal(monitorUpdateLabel('a',changes,{enabled:true}),'Observed value change between retrievals');
 assert.equal(monitorUpdateLabel('b',changes,{enabled:true}),'Historical backfill');
 assert.equal(monitorUpdateLabel('a',changes,{enabled:false}),'Update comparison off');
 assert.equal(monitorUpdateLabel('a',{status:'error'},{enabled:true}),'Update history unavailable');
 assert.equal(monitorUpdateLabel('x',changes,{enabled:true}),'No captured changes since checkpoint');
});
test('monitor matches next event to series and sorts unknowns last without inventing dates',()=>{
 const events=[{id:'e',date:'2026-10-23',seriesId:'b',seriesIds:['b']}];
 const rows=watchlistMonitor(['a','b'],{catalog,events,sort:'next',now:new Date('2026-10-22T12:00:00Z')});
 assert.deepEqual(rows.map(r=>r.id),['b','a']);assert.equal(rows[0].nextEvent.id,'e');assert.equal(rows[1].nextEvent,null);
 assert.deepEqual(watchlistMonitor(['a','b'],{catalog,events,sort:'updated'}).map(r=>r.id),['a','b']);
});
