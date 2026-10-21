import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshSnapshot } from '../scripts/sources/refresh.mjs';

const result=id=>({id,fetchedAt:'2026-10-21T12:00:00Z',series:{example:{observations:[{date:'2026-09-01',value:4.2,publishedAt:null}],dataStatus:'official'}},provenance:[],warnings:[]});

test('a failed official refresh retains last-good data and original retrieval time',async()=>{
  const previous={schemaVersion:1,sources:{bls:{...result('bls'),status:'ok'}}};
  const next=await refreshSnapshot({previous,collectors:{bls:async()=>{throw Error('BLS unavailable');}},now:new Date('2026-10-22T12:00:00Z')});
  assert.equal(next.sources.bls.status,'error');
  assert.equal(next.sources.bls.fetchedAt,previous.sources.bls.fetchedAt);
  assert.equal(next.sources.bls.series.example.observations[0].value,4.2);
  assert.match(next.sources.bls.error,/unavailable/);
  assert.equal(next.sources.bls.lastAttemptAt,'2026-10-22T12:00:00.000Z');
});

test('first failures have no invented data while independent sources succeed',async()=>{
  const next=await refreshSnapshot({collectors:{bls:async()=>{throw Error('quota');},bea:async()=>result('bea')},now:new Date('2026-10-21T12:00:00Z')});
  assert.equal(next.sources.bls.status,'unavailable');
  assert.deepEqual(next.sources.bls.series,{});
  assert.equal(next.sources.bea.status,'ok');
  assert.equal(next.sources.bea.series.example.observations[0].publishedAt,null);
  assert.equal(next.calendar.status,'unavailable');
  assert.equal(next.releases.length,0);
});

test('invalid source observations fail closed and cannot overwrite cached official data',async()=>{
  const previous={schemaVersion:1,sources:{bls:{...result('bls'),status:'ok'}}};
  const invalid=result('bls');invalid.series.example.observations[0].value=Infinity;
  const next=await refreshSnapshot({previous,collectors:{bls:async()=>invalid}});
  assert.equal(next.sources.bls.status,'error');
  assert.equal(next.sources.bls.series.example.observations[0].value,4.2);
});

test('snapshot assembly cannot predate the successful response retrieval',async()=>{
  const next=await refreshSnapshot({collectors:{bls:async()=>result('bls')},now:new Date('2026-10-21T11:00:00Z')});
  assert.ok(Date.parse(next.generatedAt)>=Date.parse(next.sources.bls.fetchedAt));
});
