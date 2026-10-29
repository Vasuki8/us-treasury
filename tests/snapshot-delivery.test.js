import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {snapshot as stored,copyFixtureProject} from './helpers/snapshot-fixture.js';import {createAppServer} from '../server.mjs';
import {importMapSource} from '../scripts/asset-references.mjs';
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
