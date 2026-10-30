import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,realpath,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {snapshot,copyFixtureProject} from './helpers/snapshot-fixture.js';
import {encodeStoredSnapshot,writeStoredSnapshot,browserSnapshotAssets} from '../scripts/snapshot-storage.mjs';
import {recordVintages} from '../src/vintages.js';
import {registry} from '../src/registry.js';

const run=promisify(execFile);

async function project(t){
  const root=await mkdtemp(path.join(tmpdir(),'meridian-history-check-'));
  t.after(async()=>{
    const resolved=await realpath(root);
    assert.equal(path.dirname(resolved),await realpath(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('meridian-history-check-'));
    await rm(resolved,{recursive:true,force:true});
  });
  await copyFixtureProject(root,['src','scripts','package.json']);
  return root;
}

test('history diagnostics account for complete current-source modules and measure the gzip root',async t=>{
  const root=await project(t);
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

test('history diagnostics reconstruct multipart captures and preserve baseline replay and CSV checks',async t=>{
  const root=await project(t),source=structuredClone(snapshot.sources.treasury);
  for(const item of Object.values(source.series))item.observations=item.observations.slice(-1);
  source.structuralBreak='Synthetic diagnostic metadata · café 🙂 '+ 'x'.repeat(21*1024**2);
  const history=recordVintages(null,{}, {treasury:source},{checkedAt:source.fetchedAt,seriesMetadata:registry});
  const fixture={schemaVersion:snapshot.schemaVersion,generatedAt:snapshot.generatedAt,checkedAt:snapshot.checkedAt,
    sources:{treasury:snapshot.sources.treasury},releases:[],vintages:history};
  await writeStoredSnapshot(fixture,{destination:path.join(root,'src/official-snapshot.json.gz')});
  const baseline=path.join(root,'baseline.json');await writeFile(baseline,JSON.stringify(fixture));
  const projected=browserSnapshotAssets(fixture),descriptor=projected.snapshot.historyArchive.sources.treasury;
  assert.equal(descriptor.parts.length,2);
  const result=await run(process.execPath,['scripts/check-snapshot-history.mjs','--baseline='+baseline],{cwd:root,maxBuffer:1024**2});
  const metrics=JSON.parse(result.stdout);
  assert.equal(metrics.captures,1);assert.equal(metrics.sources,1);assert.equal(metrics.checkedCutoffs,2);
  assert.equal(metrics.checkedSeries,2);assert.equal(metrics.checkedCsv,4);
  assert.deepEqual(metrics.baseline,{retainedCaptures:1,checkedCutoffs:2,checkedSeries:2,checkedCsv:2});
  assert.equal(metrics.lazyFallbackBytes,descriptor.contentBytes);
  assert.equal(metrics.lazyGzipBytes,descriptor.parts.reduce((sum,part)=>sum+part.compressed.bytes,0));
  assert.equal(metrics.perSource.treasury.fallbackBytes,descriptor.contentBytes);
});
