import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,cp,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {pathToFileURL} from 'node:url';import {promisify} from 'node:util';import {execFile} from 'node:child_process';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {snapshot as stored} from '../src/official-snapshot.js';import {createAppServer} from '../server.mjs';
import {loadSnapshotHistory} from '../scripts/snapshot-storage.mjs';
const execute=promisify(execFile),root=path.resolve('.'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const retained=await loadSnapshotHistory(stored,{directory:path.join(root,'src')});
test('development snapshot excludes history and serves integrity-matched lazy JSON/gzip bundles',async t=>{
 const server=createAppServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}/src/`,response=await fetch(base+'official-snapshot.js'),module=await response.text();
 const {snapshot}=await import('data:text/javascript;base64,'+Buffer.from(module).toString('base64'));
 assert.equal(snapshot.vintages,undefined,'ordinary startup must not carry retained captures');assert.equal(snapshot.vintageArchive,undefined,'storage index is not a browser dependency');assert.equal(snapshot.historyArchive.version,1);
 for(const [kind,type] of [['fallback','application/json'],['compressed','application/gzip']]){const file=snapshot.historyArchive[kind],result=await fetch(new URL(file.url,base));assert.equal(result.status,200);assert.ok(result.headers.get('content-type').includes(type));const bytes=Buffer.from(await result.arrayBuffer());assert.equal(bytes.length,file.bytes);assert.equal(hash(bytes),file.sha256);const history=JSON.parse((kind==='compressed'?gunzipSync(bytes):bytes).toString('utf8'));assert.equal(history.captures.length,snapshot.historyArchive.captureCount);assert.deepEqual(history,retained);}
 assert.equal((await fetch(base+'history/'+'a'.repeat(64)+'.json.gz')).status,404,'canonical per-capture storage is not exposed by the development server');
});
test('build emits current-only module and checks both lazy bundle variants',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'meridian-projection-'));t.after(()=>rm(directory,{recursive:true,force:true}));
 for(const name of ['src','scripts','index.html','styles.css','favicon.svg','package.json','server.mjs'])await cp(path.join(root,name),path.join(directory,name),{recursive:true});
 await execute(process.execPath,['scripts/build.mjs'],{cwd:directory});const html=await readFile(path.join(directory,'dist/index.html'),'utf8'),entry=html.match(/src="\.\/(assets\/[a-f0-9]{16}\/src\/app.js)"/)[1],src=path.dirname(path.join(directory,'dist',entry));
 const {snapshot}=await import(pathToFileURL(path.join(src,'official-snapshot.js')).href);assert.equal(snapshot.vintages,undefined);assert.equal(snapshot.vintageArchive,undefined);assert.ok(snapshot.historyArchive.captureCount>=25);
 const json=await readFile(path.join(src,snapshot.historyArchive.fallback.url));assert.equal(hash(json),snapshot.historyArchive.fallback.sha256);
 assert.deepEqual(JSON.parse(json),retained);
 const checked=await execute(process.execPath,['scripts/check-build.mjs'],{cwd:directory});assert.match(checked.stdout,/lazy archive|history bundles/);
});
