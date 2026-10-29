import test from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {snapshot} from '../src/official-snapshot.js';
import {encodeStoredSnapshot} from '../scripts/snapshot-storage.mjs';
import {createAppServer} from '../server.mjs';

async function request(server){
  const headers=new Map();let status;
  return new Promise(resolve=>server.emit('request',{method:'GET',url:'/src/official-snapshot.js'},{
    setHeader:(key,value)=>headers.set(key,value),getHeader:key=>headers.get(key),
    writeHead:code=>{status=code;},end:body=>resolve({status,body:String(body)}),
  }));
}
async function projected(source){
  const codec=new URL('../src/source-codec.js',import.meta.url).href;
  const code=source.replace("'./source-codec.js'",JSON.stringify(codec));
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).snapshot;
}

test('development projection reloads changed gzip data while the Node adapter stays unchanged',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'meridian-gzip-cache-'));
  t.after(async()=>{
    const resolved=await realpath(root);
    assert.equal(path.dirname(resolved),await realpath(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('meridian-gzip-cache-'));
    await rm(resolved,{recursive:true,force:true});
  });
  await mkdir(path.join(root,'src'));await mkdir(path.join(root,'scripts'));
  for(const file of [
    'src/official-snapshot.js','src/official-snapshot.json.gz','src/source-codec.js','src/vintages.js',
    'scripts/snapshot-storage.mjs','scripts/current-snapshot.mjs',
  ])await cp(new URL(`../${file}`,import.meta.url),path.join(root,file));
  await cp(new URL('../src/history/',import.meta.url),path.join(root,'src/history'),{recursive:true});
  await writeFile(path.join(root,'package.json'),'{"type":"module"}');
  const server=createAppServer(root),first=await request(server);
  assert.equal(first.status,200);
  assert.equal((await projected(first.body)).generatedAt,snapshot.generatedAt);
  const reader=await readFile(path.join(root,'src/official-snapshot.js'));
  const changed={...snapshot,generatedAt:'2026-10-29T12:01:00.000Z'};
  await writeFile(path.join(root,'src/official-snapshot.json.gz'),encodeStoredSnapshot(changed));
  const second=await request(server);
  assert.equal(second.status,200);
  assert.equal((await projected(second.body)).generatedAt,changed.generatedAt);
  assert.deepEqual(await readFile(path.join(root,'src/official-snapshot.js')),reader);
});
