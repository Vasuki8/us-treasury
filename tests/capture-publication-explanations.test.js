import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {publicationExplanationScope,explanationMetadataFor,assertPublicationExplanations} from '../scripts/publication-explanation-policy.mjs';
import {capturePublicationExplanationArchive,capturePublicationExplanationFile} from '../scripts/capture-publication-explanations.mjs';

const ids=()=>publicationExplanationScope.map(row=>row.publicationId);
const empty=()=>({version:1,explanations:[]});
const source=archive=>'// Immutable reviewed source explanations; separate from numerical publication facts.\nexport const publicationExplanations = '+JSON.stringify(archive,null,2)+';\n';
function fixture(selected=ids()){
 const byId=new Map(publicationExplanationScope.map(row=>[row.publicationId,row]));
 return {version:1,explanations:selected.map(id=>{const scope=byId.get(id);return {...explanationMetadataFor(scope),provenance:[{url:scope.sourceUrl,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T19:00:00.000Z',lastModified:null}]};})};
}
async function temporary(t){
 const parent=path.resolve('test-results');await mkdir(parent,{recursive:true});
 const directory=await mkdtemp(path.join(parent,'publication-explanation-test-'));
 t.after(async()=>{assert.equal(path.dirname(path.resolve(directory)),parent);assert.ok(path.basename(directory).startsWith('publication-explanation-test-'));await rm(directory,{recursive:true,force:true});});
 return path.join(directory,'publication-explanations.js');
}

test('explanation captures append requested missing identities without changing retained evidence',async()=>{
 const previous=fixture(ids().slice(0,2)),before=JSON.stringify(previous),missing=ids().slice(2);let calls=0;
 const result=await capturePublicationExplanationArchive({previous,collect:async({ids:requested})=>{calls++;assert.deepEqual(requested,missing);return fixture(requested.toReversed());}});
 assert.equal(calls,1);assert.equal(JSON.stringify(previous),before);
 assert.deepEqual(result.explanations.map(row=>row.publicationId),ids());
 previous.explanations.forEach((row,index)=>assert.equal(result.explanations[index],row));
 assertPublicationExplanations(result,{complete:true});
 const repeated=await capturePublicationExplanationArchive({previous:result,collect:()=>{throw Error('Complete evidence must never refetch');}});assert.equal(repeated,result);
});

test('explanation captures reject gaps, additions and conflicting prose before mutation',async()=>{
 const previous=fixture(ids().slice(0,2)),before=JSON.stringify(previous),missing=ids().slice(2);
 for(const mutate of [rows=>rows.slice(1),rows=>[...rows,rows[0]],rows=>[...rows,previous.explanations[0]],rows=>rows.map((row,index)=>index===0?{...row,summary:'invented reason'}:row)]){
  await assert.rejects(capturePublicationExplanationArchive({previous,collect:async()=>({version:1,explanations:mutate(fixture(missing).explanations)})}),/explanation/i);
  assert.equal(JSON.stringify(previous),before);
 }
 await assert.rejects(capturePublicationExplanationArchive({previous:{version:1,explanations:[{publicationId:'unknown'}]},collect:()=>{throw Error('Must not collect invalid input');}}),/explanation/i);
});

test('file capture locks before rereading and preserves repeated archive bytes and provenance',async t=>{
 const target=await temporary(t);await writeFile(target,source(empty()));
 const publicationFile=new URL('../src/publication-archive.js',import.meta.url),numericBefore=await readFile(publicationFile);
 let release,started;const waiting=new Promise(resolve=>{release=resolve;}),collecting=new Promise(resolve=>{started=resolve;});
 const first=capturePublicationExplanationFile({target,collect:async({ids:requested})=>{started();await waiting;return fixture(requested);}});
 await collecting;
 try{await assert.rejects(capturePublicationExplanationFile({target,collect:()=>{throw Error('Must not collect while locked');}}),/lock|progress/i);}finally{release();}
 const result=await first;assert.equal(result.captured,true);assert.equal(result.archive.explanations.length,10);
 const bytes=await readFile(target,'utf8');assert.equal(bytes,source(result.archive));
 const repeated=await capturePublicationExplanationFile({target,collect:()=>{throw Error('Repeated capture must not fetch');}});assert.equal(repeated.captured,false);
 assert.equal(await readFile(target,'utf8'),bytes);assert.deepEqual(await readdir(path.dirname(target)),['publication-explanations.js']);
 assert.deepEqual(await readFile(publicationFile),numericBefore);
});

test('file failures preserve evidence and remove only files created by the invocation',async t=>{
 const target=await temporary(t),original=source(empty());await writeFile(target,original);
 for(const collect of [async()=>{throw Error('Upstream unavailable');},async()=>empty()]){
  await assert.rejects(capturePublicationExplanationFile({target,collect}),/unavailable|explanation/i);
  assert.equal(await readFile(target,'utf8'),original);assert.deepEqual(await readdir(path.dirname(target)),['publication-explanations.js']);
 }
 const executable='export const publicationExplanations = (() => { throw Error("must not execute"); })();\n';await writeFile(target,executable);
 await assert.rejects(capturePublicationExplanationFile({target,collect:()=>{throw Error('Must not collect executable module');}}),/module|JSON/i);
 assert.equal(await readFile(target,'utf8'),executable);
 await writeFile(target+'.lock','another writer');await assert.rejects(capturePublicationExplanationFile({target}),/lock/i);assert.equal(await readFile(target+'.lock','utf8'),'another writer');
});

test('oversized retained explanation module fails before collection',async t=>{
 const target=await temporary(t),oversized=' '.repeat(512*1024+1);await writeFile(target,oversized);
 await assert.rejects(capturePublicationExplanationFile({target,collect:()=>{throw Error('Must not collect oversized evidence');}}),/byte limit/i);
 assert.equal(await readFile(target,'utf8'),oversized);assert.deepEqual(await readdir(path.dirname(target)),['publication-explanations.js']);
});
