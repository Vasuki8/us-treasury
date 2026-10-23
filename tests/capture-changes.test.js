import test from 'node:test';import assert from 'node:assert/strict';
import {recordVintages,asKnownOn} from '../src/vintages.js';
import {captureChanges,changesCsv,readChangeCheckpoint,writeChangeCheckpoint} from '../src/capture-changes.js';
const source=(time,rows,definition='Level')=>({id:'test',fetchedAt:time,series:{amount:{sourceIds:['A'],unit:'Dollars',definition,observations:rows.map(([date,value])=>({date,value}))}},provenance:[{url:'https://example.com/data',sha256:'a'.repeat(64),retrievedAt:time}]});
const a=source('2026-10-20T12:00:00Z',[['2026-08-01',1],['2026-09-01',null]]),b=source('2026-10-21T12:00:00Z',[['2026-07-01',0],['2026-08-01',2],['2026-09-01',null],['2026-10-01',3]]);
test('capture feed separates new periods, backfills, revisions and unchanged confirmations',()=>{
 let h=recordVintages(null,{}, {test:a},{checkedAt:a.fetchedAt});h=recordVintages(h,{test:a},{test:b},{checkedAt:b.fetchedAt});
 const changes=captureChanges(h,{ids:['amount'],since:a.fetchedAt});
 assert.deepEqual(changes.map(x=>x.kind).sort(),['historical-backfill','new-period','value-change']);
 assert.equal(changes.find(x=>x.kind==='historical-backfill').value,0);assert.equal(changes.find(x=>x.kind==='value-change').previousValue,1);
 const c={...b,fetchedAt:'2026-10-22T12:00:00Z',provenance:[{...b.provenance[0],retrievedAt:'2026-10-22T12:00:00Z'}]};
 h=recordVintages(h,{test:b},{test:c},{checkedAt:c.fetchedAt});assert.deepEqual(captureChanges(h,{ids:['amount'],since:b.fetchedAt}),[]);
 assert.ok(changes.every(row=>row.publicationDate===null));assert.match(changesCsv(changes),/historical-backfill/);
});
test('new measurement and row receipts confirm unchanged values without creating monitoring changes',()=>{
 const time1='2026-10-20T12:00:00.000Z',time2='2026-10-21T12:00:00.000Z',url='https://example.com/annual-yields.csv';
 const treasury=(time,hash)=>({id:'treasury',fetchedAt:time,provenance:[{url,sha256:hash.repeat(64),retrievedAt:time}],series:{yield:{unit:'Percent',definition:'Published nominal par yield',sourceIds:['BC_10YEAR'],sourceUrl:url,fetchedAt:time,observations:[{date:'2026-10-19',value:4,publishedAt:null,sourceUrl:url,retrievedAt:time,sourceSha256:hash.repeat(64)}]}}});
 const first=treasury(time1,'a');
 let history=recordVintages(null,{}, {treasury:first},{checkedAt:time1});const baseline=JSON.stringify(history.captures[0]);
 const second=treasury(time2,'b');history=recordVintages(history,{}, {treasury:second},{checkedAt:time2});
 assert.deepEqual(captureChanges(history,{ids:['yield'],since:time1}),[],'receipt-only changes must remain confirmations, even when another part of the annual response changes its hash');
 const replayed=asKnownOn(history,time2).sources.treasury;
 assert.equal(replayed.series.yield.fetchedAt,time2);assert.equal(replayed.series.yield.observations[0].retrievedAt,time2);assert.equal(replayed.series.yield.observations[0].sourceSha256,'b'.repeat(64));
 assert.equal(JSON.stringify(history.captures[0]),baseline,'the original receipt remains immutable');
 const time3='2026-10-22T12:00:00.000Z',third=treasury(time3,'c');third.series.yield.definition='Updated measurement definition';third.series.yield.observations[0].footnotes=['New agency note'];
 history=recordVintages(history,{}, {treasury:third},{checkedAt:time3});
 const changes=captureChanges(history,{ids:['yield'],since:time2});
 assert.deepEqual(changes.find(row=>row.kind==='metadata-change').changedFields,['definition']);
 assert.deepEqual(changes.find(row=>row.kind==='observation-metadata-change').changedFields,['footnotes']);
 assert.ok(changes.every(row=>row.provenance[0].retrievedAt===time3&&row.previousProvenance[0].retrievedAt===time2));
});
test('metadata and removed coverage are distinct from economic revisions and source nulls are preserved',()=>{
 let h=recordVintages(null,{}, {test:a},{checkedAt:a.fetchedAt});const c=source(b.fetchedAt,[['2026-09-01',0]],'Changed definition');
 h=recordVintages(h,{test:a},{test:c},{checkedAt:c.fetchedAt});const rows=captureChanges(h,{ids:['amount'],since:a.fetchedAt});
 assert.ok(rows.some(row=>row.kind==='metadata-change'));assert.ok(rows.some(row=>row.kind==='coverage-removal'));
 const value=rows.find(row=>row.kind==='value-change');assert.equal(value.previousValue,null);assert.equal(value.value,0);assert.equal(value.comparable,false);
 assert.deepEqual(captureChanges(h,{ids:['untracked'],since:a.fetchedAt}),[]);
});
test('change checkpoints are local, bounded and visibly fall back when storage fails',()=>{
 const store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},now='2026-10-22T12:00:00.000Z';
 assert.equal(readChangeCheckpoint(storage,now).enabled,false);
 assert.equal(writeChangeCheckpoint(storage,{enabled:true,since:now,snapshotAt:now}),true);
 assert.equal(readChangeCheckpoint(storage,now).since,now);
 assert.equal(writeChangeCheckpoint({setItem(){throw Error('quota');}},{enabled:true,since:now,snapshotAt:now}),false);
 assert.equal(readChangeCheckpoint({getItem(){throw Error('disabled');}},now).storageAvailable,false);
 assert.throws(()=>captureChanges({version:1,captures:[]},{ids:[],since:'yesterday'}),/timestamp/i);
});
test('change CSV retains captured redistribution conditions, BLS disclaimer and both retrieval lineages',()=>{
 const first={...a,id:'bls',sourceNotice:'Original source conditions',licenseUrl:'https://www.bls.gov/developers/termsOfService.htm'};
 const next={...b,id:'bls',sourceNotice:'Updated conditions'};
 let history=recordVintages(null,{}, {bls:first},{checkedAt:first.fetchedAt});history=recordVintages(history,{bls:first},{bls:next},{checkedAt:next.fetchedAt});
 const csv=changesCsv(captureChanges(history,{ids:['amount'],since:first.fetchedAt}));
 for(const text of ['BLS.gov cannot vouch','Original source conditions','Updated conditions','termsOfService.htm','previous_provenance_json','2026-10-20T12:00:00'])assert.ok(csv.includes(text),text);
});
test('source-only and observation-only metadata updates remain visible without fabricating numeric revisions',()=>{
 const first={...a,sourceNotice:'Original terms'},next={...source(b.fetchedAt,[['2026-08-01',1],['2026-09-01',null]]),sourceNotice:'Changed terms'};
 let h=recordVintages(null,{}, {test:first},{checkedAt:first.fetchedAt});h=recordVintages(h,{test:first},{test:next},{checkedAt:next.fetchedAt});
 assert.ok(captureChanges(h,{ids:['amount'],since:first.fetchedAt}).some(row=>row.kind==='metadata-change'));
 const later={...source('2026-10-22T12:00:00Z',[['2026-08-01',1],['2026-09-01',null]]),sourceNotice:'Changed terms'};later.series.amount.observations[0].footnotes=['Source revised its note'];
 h=recordVintages(h,{test:next},{test:later},{checkedAt:later.fetchedAt});const changes=captureChanges(h,{ids:['amount'],since:next.fetchedAt});
 assert.ok(changes.some(row=>row.kind==='observation-metadata-change'));assert.ok(!changes.some(row=>row.kind==='value-change'));
 assert.match(changesCsv(changes),/changed_fields/);assert.match(changesCsv(changes),/footnotes/);
});

test('current inherited units and source URLs take precedence over superseded series metadata',()=>{
 const first=source(a.fetchedAt,[['2026-08-01',1]]),next=source(b.fetchedAt,[['2026-08-01',2]]);
 first.series.amount.unit='USD millions';first.series.amount.sourceUrl='https://example.com/old';
 delete next.series.amount.unit;next.unit='USD billions';next.sourceUrl='https://example.com/new';
 let history=recordVintages(null,{}, {test:first},{checkedAt:first.fetchedAt});history=recordVintages(history,{test:first},{test:next},{checkedAt:next.fetchedAt});
 const value=captureChanges(history,{ids:['amount'],since:first.fetchedAt}).find(row=>row.kind==='value-change');
 assert.equal(value.unit,'USD billions');assert.equal(value.previousUnit,'USD millions');assert.equal(value.sourceUrl,next.sourceUrl);assert.equal(value.comparable,false);
});
