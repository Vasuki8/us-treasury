import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import path from 'node:path';import {tmpdir} from 'node:os';
import {claimsPublicationScope,claimsPublicationMetadataFor,assertClaimsPublicationData} from '../scripts/dol-publication-policy.mjs';
import {captureClaimsPublicationArchive,captureClaimsPublicationFile} from '../scripts/capture-claims-publications.mjs';
const fixture=(ids=claimsPublicationScope.map(row=>row.id))=>({version:1,releases:ids.map(id=>{
 const scope=claimsPublicationScope.find(row=>row.id===id);return {...claimsPublicationMetadataFor(scope),provenance:[{url:scope.sourceUrl,sha256:scope.reviewedPdfSha256,retrievedAt:'2026-10-22T22:00:00.000Z',lastModified:null}]};
})});
const source=archive=>'// Immutable selected official DOL publication facts; separate from revised and capture history.\nexport const claimsPublicationArchive = '+JSON.stringify(archive,null,2)+';\n';
async function temporary(t){const directory=await mkdtemp(path.join(tmpdir(),'meridian-dol-publications-'));t.after(async()=>{const absolute=path.resolve(directory);assert.equal(path.dirname(absolute),path.resolve(tmpdir()));assert.ok(path.basename(absolute).startsWith('meridian-dol-publications-'));await rm(absolute,{recursive:true,force:true});});return path.join(directory,'claims-publication-archive.js');}

test('append-only DOL capture retains earlier records exactly, orders missing identities, and never refetches a complete archive',async()=>{
 const previous=fixture([claimsPublicationScope.at(-1).id]),before=JSON.stringify(previous);let calls=0;
 const archive=await captureClaimsPublicationArchive({previous,collect:async({ids})=>{calls++;assert.equal(ids.length,767);return fixture(ids.toReversed());}});
 assert.equal(calls,1);assert.equal(archive.releases[0],previous.releases[0]);assert.equal(JSON.stringify(previous),before);assert.equal(archive.releases.length,768);assertClaimsPublicationData(archive,{complete:true});
 assert.equal(await captureClaimsPublicationArchive({previous:archive,collect:()=>{throw Error('No refetch');}}),archive);
});

test('retained other-year archives append only the missing 184 admitted 2025 facts without replacing retained objects',async()=>{
 const previous=fixture(claimsPublicationScope.filter(row=>!row.publicationDate.startsWith('2025')).map(row=>row.id)),before=JSON.stringify(previous);let calls=0;
 const result=await captureClaimsPublicationArchive({previous,collect:async({ids})=>{calls++;assert.equal(ids.length,184);assert.ok(ids.every(id=>claimsPublicationScope.find(row=>row.id===id).publicationDate.startsWith('2025')));return fixture(ids);}});
 assert.equal(calls,1);assert.equal(JSON.stringify(previous),before);assert.equal(result.releases.length,768);
 for(let i=0;i<previous.releases.length;i++)assert.equal(result.releases[i],previous.releases[i]);
});

test('retained other-year archives append only the missing 208 admitted2024 facts without replacing objects',async()=>{
 const previous=fixture(claimsPublicationScope.filter(row=>!row.publicationDate.startsWith('2024')).map(row=>row.id)),before=JSON.stringify(previous);let calls=0;
 const result=await captureClaimsPublicationArchive({previous,collect:async({ids})=>{calls++;assert.equal(ids.length,208);assert.ok(ids.every(id=>claimsPublicationScope.find(row=>row.id===id).publicationDate.startsWith('2024')));return fixture(ids.toReversed());}});
 assert.equal(calls,1);assert.equal(JSON.stringify(previous),before);assert.equal(result.releases.length,768);
 for(let i=0;i<previous.releases.length;i++)assert.equal(result.releases[i],previous.releases[i]);
});

test('the original560-fact archive appends only208 reviewed2023 identities, including the originalDOL edition, without replacing records',async()=>{
 const previous=fixture(claimsPublicationScope.slice(0,560).map(row=>row.id)),before=JSON.stringify(previous);let calls=0;
 const result=await captureClaimsPublicationArchive({previous,collect:async({ids})=>{calls++;assert.equal(ids.length,208);assert.ok(ids.every(id=>claimsPublicationScope.find(row=>row.id===id).publicationDate.startsWith('2023')));return fixture(ids.toReversed());}});
 assert.equal(calls,1);assert.equal(JSON.stringify(previous),before);assert.equal(result.releases.length,768);for(let i=0;i<560;i++)assert.equal(result.releases[i],previous.releases[i]);
});
test('incomplete, duplicate, extra and conflicting source batches reject without changing retained records',async()=>{
 const previous=fixture([claimsPublicationScope[0].id]),before=JSON.stringify(previous);
 for(const mutate of [rows=>rows.slice(1),rows=>[...rows,rows[0]],rows=>[...rows,previous.releases[0]],rows=>[{...rows[0],value:999,sourceValue:'999,000'},...rows.slice(1)]]){
  await assert.rejects(captureClaimsPublicationArchive({previous,collect:async({ids})=>({version:1,releases:mutate(fixture(ids).releases)})}),/DOL.*publication/i);assert.equal(JSON.stringify(previous),before);
 }
});
test('exclusive writers re-read under lock and serial capture preserves original file bytes without refetch',async t=>{
 const target=await temporary(t),previous=fixture([claimsPublicationScope[0].id]);await writeFile(target,source(previous));
 let signal,release;const started=new Promise(resolve=>{signal=resolve;}),pending=new Promise(resolve=>{release=resolve;});
 const first=captureClaimsPublicationFile({target,collect:async({ids})=>{signal();await pending;return fixture(ids);}});await started;
 try{await assert.rejects(captureClaimsPublicationFile({target,collect:()=>{throw Error('Must not fetch');}}),/lock|progress/i);}finally{release();}
 assert.equal((await first).captured,true);const bytes=await readFile(target,'utf8');
 assert.equal((await captureClaimsPublicationFile({target,collect:()=>{throw Error('No refetch');}})).captured,false);assert.equal(await readFile(target,'utf8'),bytes);assert.deepEqual(await readdir(path.dirname(target)),['claims-publication-archive.js']);
});
test('failed collection and unsafe/non-data archive input preserve the target and clean only acquired artifacts',async t=>{
 const target=await temporary(t),original=source(fixture([claimsPublicationScope[0].id]));await writeFile(target,original);
 await assert.rejects(captureClaimsPublicationFile({target,collect:()=>{throw Error('Upstream unavailable');}}),/Upstream/);assert.equal(await readFile(target,'utf8'),original);assert.deepEqual(await readdir(path.dirname(target)),['claims-publication-archive.js']);
 for(const text of ['export const claimsPublicationArchive = globalThis.attack();',source(fixture()).replace('"version": 1','"version": 2'),'x'.repeat(4*1024*1024+1)]){
  await writeFile(target,text);await assert.rejects(captureClaimsPublicationFile({target,collect:()=>{throw Error('Must not fetch');}}),/archive|DOL.*publication/i);assert.equal(await readFile(target,'utf8'),text);assert.deepEqual(await readdir(path.dirname(target)),['claims-publication-archive.js']);
 }
});
