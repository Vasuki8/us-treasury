import test from 'node:test';import assert from 'node:assert/strict';
import * as capture from '../scripts/capture-publications.mjs';
import * as policy from '../scripts/publication-policy.mjs';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';import {tmpdir} from 'node:os';
import {publicationArchive} from '../src/publication-archive.js';
const {capturePublicationArchive}=capture;
const source=archive=>'// Immutable selected official publication facts; distinct from local capture history.\nexport const publicationArchive = '+JSON.stringify(archive,null,2)+';\n';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const legacyIds=['bea-gdp-2026q1-advance-2026-04-30','bea-gdp-2026q1-second-2026-05-28','bea-gdp-2026q1-third-2026-06-25'];
const legacyHashes=['9128e91584e7205e86c26a1093622fb166447ed561d6f4b8fe6a5e8684318b60','9f2a62015cb62fb47ab0f074042ac06b3540bae42bb4a12ce1d9f23a1a1ffb02','54564ea039e58f6082b166aec8c32bfe419add3fb07e3e855f95d372789fd0b0'];
const legacy=()=>({version:1,releases:publicationArchive.releases.filter(row=>legacyIds.includes(row.id))});
const approvedIds=()=>policy.publicationScope.map(policy.publicationId);
function fixture(ids=approvedIds()){
 assert.equal(typeof policy.publicationMetadataFor,'function','Fixtures use the admitted scope and exact official metadata');
 const scopes=new Map(policy.publicationScope.map(scope=>[policy.publicationId(scope),scope]));
 return {version:1,releases:ids.map(id=>{
  const scope=scopes.get(id);assert.ok(scope,`Unknown fixture scope ${id}`);
  return {...policy.publicationMetadataFor(scope),id,estimate:scope.estimate,publicationDate:scope.publicationDate,
   value:Number(scope.sourceValue.replaceAll(',','')),sourceValue:scope.sourceValue,sourcePublicationDate:scope.sourcePublicationDate,
   sourceIds:['A191RL'],releaseEvidenceUrl:scope.releaseEvidenceUrl,sourceCells:policy.publicationCells(scope),
   provenance:[{url:scope.sourceUrl,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T18:00:00.000Z',lastModified:null}]};
 })};
}
async function temporary(t){
 const directory=await mkdtemp(path.join(tmpdir(),'meridian-publication-test-'));
 t.after(async()=>{
  const absolute=path.resolve(directory);
  assert.equal(path.dirname(absolute),path.resolve(tmpdir()));assert.ok(path.basename(absolute).startsWith('meridian-publication-test-'));
  await rm(absolute,{recursive:true,force:true});
 });
 return path.join(directory,'publication-archive.js');
}

test('the original three retained publication records remain byte-identical',()=>{
 const previous=legacy();assert.deepEqual(previous.releases.map(row=>row.id),legacyIds);
 assert.deepEqual(previous.releases.map(hash),legacyHashes);
});

test('an existing legacy archive appends only missing admitted IDs in scope order',async()=>{
 const previous=legacy(),before=JSON.stringify(previous),expectedIds=approvedIds().filter(id=>!legacyIds.includes(id));
 assert.ok(expectedIds.length>3,'The admitted scope must extend beyond the legacy sample');
 let calls=0;
 const result=await capturePublicationArchive({previous,collect:async({ids})=>{
  calls++;assert.deepEqual(ids,expectedIds);return fixture(ids.toReversed());
 }});
 assert.equal(calls,1);assert.notEqual(result,previous);
 assert.equal(JSON.stringify(previous),before);
 assert.deepEqual(result.releases.slice(0,3).map(hash),legacyHashes);
 previous.releases.forEach((row,index)=>assert.equal(result.releases[index],row));
 assert.deepEqual(result.releases.slice(3).map(row=>row.id),expectedIds);
 policy.assertPublicationData(result,{complete:true});
});

test('append rejects incomplete, duplicate, unknown, unrequested and conflicting batches',async()=>{
 const previous=legacy(),before=JSON.stringify(previous),missing=approvedIds().filter(id=>!legacyIds.includes(id));
 const invalidBatches=[
  rows=>rows.slice(1),
  rows=>[...rows,rows[0]],
  rows=>[{...rows[0],id:'unknown-publication'},...rows.slice(1)],
  rows=>[...rows,previous.releases[0]],
  rows=>[...rows,{...previous.releases[0],value:999,sourceValue:'999.0'}],
  rows=>[...rows,{...previous.releases[0],provenance:[{...previous.releases[0].provenance[0],retrievedAt:'2026-10-22T19:00:00.000Z'}]}]
 ];
 for(const mutate of invalidBatches){
  await assert.rejects(capturePublicationArchive({previous,collect:async()=>({version:1,releases:mutate(fixture(missing).releases)})}),/publication|batch|requested|complete|duplicate|scope/i);
  assert.equal(JSON.stringify(previous),before);
 }
 await assert.rejects(capturePublicationArchive({previous:{version:1,releases:[]},collect:async()=>({version:1,releases:[]})}),/publication|complete|batch/i);
 await assert.rejects(capturePublicationArchive({previous:{version:1,releases:[{id:'invented'}]},collect:()=>{throw Error('must not fetch');}}),/publication archive/i);
});

test('only a fully retained admitted archive returns without collection',async()=>{
 const previous=fixture(),before=JSON.stringify(previous);
 const result=await capturePublicationArchive({previous,collect:()=>{throw Error('A complete retained archive must never fetch');}});
 assert.equal(result,previous);assert.equal(JSON.stringify(previous),before);
});

test('exclusive append writers preserve the original retrieval and serial reruns re-read without fetching',async t=>{
 const target=await temporary(t),previous=legacy();await writeFile(target,source(previous));
 let release,started;const waiting=new Promise(resolve=>{release=resolve;}),collecting=new Promise(resolve=>{started=resolve;});
 let secondCalls=0;
 const first=capture.capturePublicationFile({target,collect:async({ids})=>{started();await waiting;return fixture(ids);}});
 await collecting;
 try{await assert.rejects(capture.capturePublicationFile({target,collect:async()=>{secondCalls++;return fixture();}}),/lock|progress/i);}finally{release();}
 const result=await first;assert.equal(result.captured,true);assert.equal(secondCalls,0);
 assert.deepEqual(result.archive.releases.slice(0,3).map(hash),legacyHashes);
 const bytes=await readFile(target,'utf8');assert.equal(bytes,source(result.archive));
 assert.ok(Buffer.byteLength(bytes)>256*1024,'The expanded archive must pass the former 256 KiB limit');
 assert.ok(Buffer.byteLength(bytes)<=4*1024*1024);
 const repeated=await capture.capturePublicationFile({target,collect:()=>{throw Error('Existing complete capture must never fetch');}});
 assert.equal(repeated.captured,false);assert.deepEqual(repeated.archive.releases.slice(0,3).map(hash),legacyHashes);
 assert.equal(await readFile(target,'utf8'),bytes);assert.deepEqual(await readdir(path.dirname(target)),['publication-archive.js']);
});

test('append failures remove only the acquired lock and preserve target bytes',async t=>{
 const target=await temporary(t),original=source(legacy());await writeFile(target,original);
 await assert.rejects(capture.capturePublicationFile({target,collect:async()=>{throw Error('Upstream unavailable');}}),/upstream/i);
 assert.equal(await readFile(target,'utf8'),original);assert.deepEqual(await readdir(path.dirname(target)),['publication-archive.js']);
 await assert.rejects(capture.capturePublicationFile({target,collect:async()=>({version:1,releases:[]})}),/publication|complete|batch/i);
 assert.equal(await readFile(target,'utf8'),original);assert.deepEqual(await readdir(path.dirname(target)),['publication-archive.js']);
 const executable='export const publicationArchive = (() => { throw Error("must not execute"); })();\n';await writeFile(target,executable);
 await assert.rejects(capture.capturePublicationFile({target,collect:()=>{throw Error('Must not fetch invalid archive');}}),/module|JSON|archive/i);
 assert.equal(await readFile(target,'utf8'),executable);assert.deepEqual(await readdir(path.dirname(target)),['publication-archive.js']);
 await writeFile(target+'.lock','another writer');
 await assert.rejects(capture.capturePublicationFile({target,collect:()=>{throw Error('Must not fetch while locked');}}),/lock|progress/i);
 assert.equal(await readFile(target+'.lock','utf8'),'another writer');assert.equal(await readFile(target,'utf8'),executable);
});

test('capture rejects oversized retained archive modules before collection',async t=>{
 const target=await temporary(t),oversized=' '.repeat(4*1024*1024+1);await writeFile(target,oversized);
 await assert.rejects(capture.capturePublicationFile({target,collect:()=>{throw Error('Must not fetch oversized archive');}}),/byte limit/i);
 assert.equal(await readFile(target,'utf8'),oversized);assert.deepEqual(await readdir(path.dirname(target)),['publication-archive.js']);
});

test('capture rejects an unreviewed oversized value before creating a temporary output',async t=>{
 const target=await temporary(t),original=source(legacy());await writeFile(target,original);
 const missing=approvedIds().filter(id=>!legacyIds.includes(id)),batch=fixture(missing);
 // Numerically valid tokens still require the exact reviewed source fact.
 batch.releases[0].value=1;batch.releases[0].sourceValue='0'.repeat(4*1024*1024)+'1.0';
 await assert.rejects(capture.capturePublicationFile({target,collect:async()=>batch}),/publication source value/i);
 assert.equal(await readFile(target,'utf8'),original);assert.deepEqual(await readdir(path.dirname(target)),['publication-archive.js']);
});
