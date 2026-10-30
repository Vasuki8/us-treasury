import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,realpath,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {gunzipSync,gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {snapshot as stored,copyFixtureProject} from './helpers/snapshot-fixture.js';import {createAppServer} from '../server.mjs';
import {importMapSource} from '../scripts/asset-references.mjs';
import {writeStoredSnapshot} from '../scripts/snapshot-storage.mjs';
const execute=promisify(execFile),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const retained=stored.vintages;

async function fixture(t){
 const directory=await mkdtemp(path.join(tmpdir(),'meridian-projection-'));
 t.after(async()=>{
  const resolved=await realpath(directory);
  assert.equal(path.dirname(resolved),await realpath(tmpdir()));
  assert.ok(path.basename(resolved).startsWith('meridian-projection-'));
  await rm(resolved,{recursive:true,force:true});
 });
 await copyFixtureProject(directory);
 return directory;
}

async function importProjection(source) {
 const codec = new URL('../src/source-codec.js', import.meta.url).href;
 const module = source.replace(/(['"])\.\/source-codec\.js\1/g, JSON.stringify(codec));
 return import('data:text/javascript;base64,' + Buffer.from(module).toString('base64'));
}
test('development snapshot excludes history and serves every source partition in verified JSON/gzip variants',async t=>{
 const directory=await fixture(t);
 const server=createAppServer(directory);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}/src/`,response=await fetch(base+'official-snapshot.js'),module=await response.text();
 const {snapshot} = await importProjection(module);
 assert.equal(snapshot.vintages,undefined,'ordinary startup must not carry retained captures');assert.equal(snapshot.vintageArchive,undefined,'storage index is not a browser dependency');assert.equal(snapshot.historyArchive.version,2);
 const reconstructed=[];
 for(const [sourceId,descriptor] of Object.entries(snapshot.historyArchive.sources))for(const [kind,type] of [['fallback','application/json'],['compressed','application/gzip']]){
  const file=descriptor[kind],result=await fetch(new URL(file.url,base));assert.equal(result.status,200);assert.ok(result.headers.get('content-type').includes(type));
  const bytes=Buffer.from(await result.arrayBuffer());assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);
  const partition=JSON.parse((kind==='compressed'?gunzipSync(bytes):bytes).toString('utf8'));assert.equal(partition.sourceId,sourceId);assert.equal(partition.captures.length,descriptor.captureCount);
  partition.captures.forEach((capture,i)=>{assert.equal(capture.sourceId,sourceId);assert.deepEqual(capture,retained.captures[partition.captureIndexes[i]]);if(kind==='fallback')reconstructed.push([partition.captureIndexes[i],capture]);});
 }
 assert.deepEqual(reconstructed.sort((a,b)=>a[0]-b[0]).map(([,c])=>c),retained.captures);
 for (const descriptor of Object.values(snapshot.sourceArchive.sources)) {
  const result = await fetch(new URL(descriptor.url, base));
  assert.equal(result.status, 200, 'lazy full-source module must load from the development projection');
  assert.match(result.headers.get('content-type'), /javascript/);
  const bytes = Buffer.from(await result.arrayBuffer());
  assert.equal(bytes.length, descriptor.bytes);
  assert.equal(hash(bytes), descriptor.sha256);
 }
 assert.equal((await fetch(base+'history/'+'a'.repeat(64)+'.json.gz')).status,404,'canonical per-capture storage is not exposed by the development server');
});
test('build emits a current-only module and checks every source history variant',async t=>{
 const directory=await fixture(t);
 await execute(process.execPath, ['scripts/build.mjs'], {cwd: directory});
 const html = await readFile(path.join(directory, 'dist/index.html'), 'utf8');
 const {imports} = JSON.parse(importMapSource(html));
 const filename = path.join(directory, 'dist', imports['./assets/src/official-snapshot.js']);
 const src = path.dirname(filename), {snapshot} = await importProjection(await readFile(filename, 'utf8'));
 assert.equal(snapshot.vintages, undefined);
 assert.equal(snapshot.vintageArchive, undefined);
 assert.ok(snapshot.historyArchive.captureCount >= 25);
 const reconstructed=[];
 for(const [sourceId,descriptor] of Object.entries(snapshot.historyArchive.sources))for(const kind of ['compressed','fallback']){
  const bytes=await readFile(path.join(src,descriptor[kind].url));assert.equal(bytes.length,descriptor[kind].bytes);assert.equal(hash(bytes),descriptor[kind].sha256);
  const partition=JSON.parse(kind==='compressed'?gunzipSync(bytes):bytes);assert.equal(partition.sourceId,sourceId);
  if(kind==='fallback')partition.captures.forEach((c,i)=>reconstructed.push([partition.captureIndexes[i],c]));
 }
 assert.deepEqual(reconstructed.sort((a,b)=>a[0]-b[0]).map(([,c])=>c),retained.captures);
 const checked=await execute(process.execPath,['scripts/check-build.mjs'],{cwd:directory});assert.match(checked.stdout,/lazy archive|history bundles/);
});

test('built smoke check visits every binary history part and rejects missing or incorrectly typed parts',async t=>{
 const directory=await fixture(t),dist=path.join(directory,'dist'),version='0123456789abcdef';
 const files={},parts=[];
 for(const fragment of ['{"captures":[',']}']){
  const pair={};
  for(const [kind,bytes,extension]of [['fallback',Buffer.from(fragment),'bin'],['compressed',gzipSync(fragment),'bin.gz']]){
   const name=`history-${hash(bytes)}.${extension}`;
   files['assets/src/'+name]=bytes;pair[kind]={url:'./'+name};
  }
  parts.push(pair);
 }
 files[`assets/src/app.${version}.js`]=`export const archive=${JSON.stringify({version:2,sources:{treasury:{parts}}})};`;
 files[`assets/styles.${version}.css`]='body{}';files[`assets/favicon.${version}.svg`]='<svg/>';
 files['index.html']='<title>Meridian</title>'
  +`<link rel="stylesheet" href="./assets/styles.${version}.css"><link rel="icon" href="./assets/favicon.${version}.svg">`
  +`<script type="module" src="./assets/src/app.${version}.js"></script>`;
 for(const [name,bytes]of Object.entries(files)){
  await mkdir(path.dirname(path.join(dist,name)),{recursive:true});await writeFile(path.join(dist,name),bytes);
 }
 const run=()=>execute(process.execPath,['scripts/check-build.mjs'],{cwd:directory});
 assert.match((await run()).stdout,/passed \(7 assets\)/);
 const missing='assets/src/'+parts[1].compressed.url.slice(2);
 await rm(path.join(dist,missing));await assert.rejects(run(),/Built asset must load/);
 await writeFile(path.join(dist,missing),files[missing]);
 const server=path.join(directory,'server.mjs');
 await writeFile(server,(await readFile(server,'utf8')).replace('const types = {',"const types = {'.bin':'text/plain',"));
 await assert.rejects(run(),/Lazy history binary MIME/);
});

test('development and build deliver every generated split history part with exact bytes and binary MIME',async t=>{
 const directory=await fixture(t),full=structuredClone(stored);
 // Enlarge history-only test evidence; source values, current data and rights notices are unchanged.
 const row=full.vintages.captures.find(capture=>capture.sourceId==='treasury').series.debt.upserts[0];
 row.footnotes=[...(row.footnotes??[]),'Synthetic transport fixture '+'x'.repeat(21*1024**2)];
 await writeStoredSnapshot(full,{destination:path.join(directory,'src/official-snapshot.json.gz')});
 const server=createAppServer(directory);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}/src/`;
 const {snapshot}=await importProjection(await (await fetch(base+'official-snapshot.js')).text());
 const descriptor=snapshot.historyArchive.sources.treasury;
 assert.equal(descriptor.parts.length,2);assert.ok(descriptor.contentBytes>20*1024**2);
 for(const kind of ['fallback','compressed']){
  const parts=[];
  for(const part of descriptor.parts){
   const resource=part[kind],response=await fetch(new URL(resource.url,base));
   assert.equal(response.status,200);
   assert.match(response.headers.get('content-type'),kind==='fallback'?/^application\/octet-stream$/:/^application\/gzip$/);
   const bytes=Buffer.from(await response.arrayBuffer());
   assert.equal(bytes.length,resource.bytes);assert.ok(bytes.length<20*1024**2);assert.equal(hash(bytes),resource.sha256);
   parts.push(kind==='compressed'?gunzipSync(bytes):bytes);
  }
  const content=Buffer.concat(parts);assert.equal(content.length,descriptor.contentBytes);assert.equal(hash(content),descriptor.contentSha256);
  const partition=JSON.parse(content.toString('utf8')),expected=full.vintages.captures.filter(capture=>capture.sourceId==='treasury');
  assert.deepEqual(partition.captureIndexes,full.vintages.captures.flatMap((capture,i)=>capture.sourceId==='treasury'?[i]:[]));
  assert.equal(hash(Buffer.from(JSON.stringify(partition.captures))),hash(Buffer.from(JSON.stringify(expected))));
 }
 await execute(process.execPath,['scripts/build.mjs'],{cwd:directory});
 const html=await readFile(path.join(directory,'dist/index.html'),'utf8'),{imports}=JSON.parse(importMapSource(html));
 const filename=path.join(directory,'dist',imports['./assets/src/official-snapshot.js']);
 const {snapshot:built}=await importProjection(await readFile(filename,'utf8'));
 assert.deepEqual(built.historyArchive.sources.treasury,descriptor,'development and built parts use the same content hashes');
 for(const part of descriptor.parts)for(const kind of ['compressed','fallback']){
  const item=part[kind],bytes=await readFile(path.join(path.dirname(filename),item.url));
  assert.equal(bytes.length,item.bytes);assert.ok(bytes.length<20*1024**2);assert.equal(hash(bytes),item.sha256);
 }
 assert.match((await execute(process.execPath,['scripts/check-build.mjs'],{cwd:directory})).stdout,/smoke check passed/);
});
