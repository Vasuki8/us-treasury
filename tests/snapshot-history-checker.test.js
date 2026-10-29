import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {cp,mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {snapshot} from '../src/official-snapshot.js';
import {encodeStoredSnapshot} from '../scripts/snapshot-storage.mjs';

const run=promisify(execFile);

test('history diagnostics account for complete current-source modules and measure the gzip root',async t=>{
  const root=await mkdtemp(path.join(tmpdir(),'meridian-history-check-'));
  t.after(async()=>{
    const resolved=await realpath(root);
    assert.equal(path.dirname(resolved),await realpath(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('meridian-history-check-'));
    await rm(resolved,{recursive:true,force:true});
  });
  for(const name of ['src','scripts','package.json']){
    await cp(new URL(`../${name}`,import.meta.url),path.join(root,name),{recursive:true});
  }
  const fixture={
    schemaVersion:snapshot.schemaVersion,generatedAt:snapshot.generatedAt,checkedAt:snapshot.checkedAt,
    sources:{treasury:snapshot.sources.treasury},releases:[],vintageArchive:{version:1,captures:[]},
  };
  const bytes=encodeStoredSnapshot(fixture);
  await writeFile(path.join(root,'src/official-snapshot.json.gz'),bytes);
  const result=await run(process.execPath,['scripts/check-snapshot-history.mjs'],{cwd:root,maxBuffer:1024**2});
  const metrics=JSON.parse(result.stdout);
  assert.equal(metrics.captures,0);
  assert.equal(metrics.storedRootBytes,bytes.length);
  assert.equal(metrics.storedRootSha256,createHash('sha256').update(bytes).digest('hex'));
  assert.equal(metrics.currentModuleBytes>0,true);
  assert.equal((await readFile(path.join(root,'src/official-snapshot.js'))).length<2048,true);
});
