import test from 'node:test';import assert from 'node:assert/strict';
import * as capture from '../scripts/capture-publications.mjs';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';import {tmpdir} from 'node:os';
import {publicationArchive} from '../src/publication-archive.js';
const {capturePublicationArchive}=capture;
const source=archive=>'// Immutable selected official publication facts; distinct from local capture history.\nexport const publicationArchive = '+JSON.stringify(archive,null,2)+';\n';
async function temporary(t){
 const directory=await mkdtemp(path.join(tmpdir(),'meridian-publication-test-'));
 t.after(async()=>{
  const absolute=path.resolve(directory);
  assert.equal(path.dirname(absolute),path.resolve(tmpdir()));assert.ok(path.basename(absolute).startsWith('meridian-publication-test-'));
  await rm(absolute,{recursive:true,force:true});
 });
 return path.join(directory,'publication-archive.js');
}
test('capture requires the complete admitted publication sample',async()=>{
 await assert.rejects(capturePublicationArchive({previous:{version:1,releases:[]},collect:async()=>({version:1,releases:[]})}),/complete official publication/);
 await assert.rejects(capturePublicationArchive({previous:{version:1,releases:[{id:'invented'}]},collect:()=>{throw Error('must not fetch');}}),/publication archive/i);
});

test('exclusive first-capture writers preserve the first retrieval and serial reruns re-read without fetching',async t=>{
 assert.equal(typeof capture.capturePublicationFile,'function','Capture writes must use an exclusive lock and fresh file state');
 const target=await temporary(t);await writeFile(target,source({version:1,releases:[]}));
 let release,started;const waiting=new Promise(resolve=>{release=resolve;}),collecting=new Promise(resolve=>{started=resolve;});
 const firstArchive=structuredClone(publicationArchive);firstArchive.releases.forEach(row=>row.provenance[0].retrievedAt='2026-10-22T16:30:00.000Z');
 let secondCalls=0;
 const first=capture.capturePublicationFile({target,collect:async()=>{started();await waiting;return firstArchive;}});
 await collecting;
 try{await assert.rejects(capture.capturePublicationFile({target,collect:async()=>{secondCalls++;return publicationArchive;}}),/lock|progress/i);}finally{release();}
 const result=await first;assert.equal(result.captured,true);assert.equal(secondCalls,0);
 const bytes=await readFile(target,'utf8');assert.equal(bytes,source(firstArchive));
 const repeated=await capture.capturePublicationFile({target,collect:()=>{throw Error('Existing capture must never fetch');}});
 assert.equal(repeated.captured,false);assert.equal(repeated.archive.releases[0].provenance[0].retrievedAt,'2026-10-22T16:30:00.000Z');
 assert.equal(await readFile(target,'utf8'),bytes);assert.deepEqual(await readdir(path.dirname(target)),['publication-archive.js']);
});

test('capture errors remove only the acquired lock, preserve target bytes and reject executable module input',async t=>{
 assert.equal(typeof capture.capturePublicationFile,'function','Safe file capture must exist');
 const target=await temporary(t),empty=source({version:1,releases:[]});await writeFile(target,empty);
 await assert.rejects(capture.capturePublicationFile({target,collect:async()=>{throw Error('Upstream unavailable');}}),/upstream/i);
 assert.equal(await readFile(target,'utf8'),empty);assert.deepEqual(await readdir(path.dirname(target)),['publication-archive.js']);
 const executable='export const publicationArchive = (() => { throw Error("must not execute"); })();\n';await writeFile(target,executable);
 await assert.rejects(capture.capturePublicationFile({target,collect:()=>{throw Error('Must not fetch invalid archive');}}),/module|JSON|archive/i);
 assert.equal(await readFile(target,'utf8'),executable);assert.deepEqual(await readdir(path.dirname(target)),['publication-archive.js']);
 await writeFile(target+'.lock','another writer');
 await assert.rejects(capture.capturePublicationFile({target,collect:()=>{throw Error('Must not fetch while locked');}}),/lock|progress/i);
 assert.equal(await readFile(target+'.lock','utf8'),'another writer');assert.equal(await readFile(target,'utf8'),executable);
});
