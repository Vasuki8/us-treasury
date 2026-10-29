import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot as actual} from '../src/official-snapshot.js';
import {series} from '../src/data.js';
import {registry} from '../src/registry.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {readFile,mkdtemp,realpath,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {loadSnapshotHistory} from '../scripts/snapshot-storage.mjs';

test('ordinary UI imports use the bounded, policy-valid snapshot and its nonempty baseline history',async()=>{
  assert.equal(actual.testFixture,'phase-3-ui','UI tests must preload the pinned fixture rather than parse production data');
  const {snapshot}=await import('./helpers/snapshot-fixture.js');
  assert.equal(actual,snapshot);
  assert.equal(series.unrate.observations,snapshot.sources.bls.series.unrate.observations);
  assert.deepEqual(Object.keys(series),Object.keys(registry));
  assert.equal(snapshot.vintages.captures.length,25);
  assert.ok(snapshot.vintages.captures.every(capture=>capture.baseline));
  assert.doesNotThrow(()=>assertCommercialData(snapshot));
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot))<8*1024**2);
});

test('the checked-in fixture matches its pinned integrity and bounded history manifest',async()=>{
  const directory=new URL('./fixtures/ui-snapshot/',import.meta.url);
  const bytes=await readFile(new URL('snapshot.json.gz',directory));
  const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
  assert.equal(bytes.length,manifest.compressedBytes);
  assert.equal(manifest.sourceCount,25);
  assert.equal(manifest.seriesCount,145);
  assert.equal(manifest.captureCount,25);
  assert.ok(bytes.length<1024**2);
  const queried=await import('../src/official-snapshot.js?projection=fixture-guard');
  assert.equal(queried.snapshot,actual);
});

test('bounded funding and auction inputs admit portable frozen packages with complete generated attachments',async()=>{
  const {buildPinContext}=await import('../src/research-context.js');
  const {parseRoute}=await import('../src/router.js');
  const {createResearchPackage,exportResearchPackage,importResearchPackage}=await import('../src/research-packages.js');
  for(const route of ['#/market?window=custom&start=2019-09-01&end=2019-09-30','#/auctions?type=Bill']){
    const pkg=await createResearchPackage({name:'Bounded fixture evidence',...buildPinContext(parseRoute(route))});
    const text=exportResearchPackage(pkg);
    assert.equal(exportResearchPackage(await importResearchPackage(text)),text);
  }
});

test('sandbox copies install real indexed fixture bytes and remain outside the root loader scope',async t=>{
  const {snapshot,copyFixtureProject,installSnapshotFixture}=await import('./helpers/snapshot-fixture.js');
  const directory=await mkdtemp(path.join(tmpdir(),'meridian-ui-fixture-'));
  t.after(async()=>{
    const resolved=await realpath(directory);
    assert.equal(path.dirname(resolved),await realpath(tmpdir()));
    assert.ok(path.basename(resolved).startsWith('meridian-ui-fixture-'));
    await rm(resolved,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  });
  await copyFixtureProject(directory,['src','scripts','package.json']);
  const copied=await import(pathToFileURL(path.join(directory,'src','official-snapshot.js')).href+'?projection=scoped');
  assert.notEqual(copied.snapshot,snapshot);
  assert.equal(copied.snapshot.vintages,undefined);
  assert.equal(copied.snapshot.vintageArchive.captures.length,25);
  assert.deepEqual(await loadSnapshotHistory(copied.snapshot,{directory:path.join(directory,'src')}),snapshot.vintages);
  assert.equal((await readdir(path.join(directory,'src','history'))).length,25);
  await assert.rejects(installSnapshotFixture(fileURLToPath(new URL('../',import.meta.url))),/fixture|Repository/);
  await assert.rejects(installSnapshotFixture(fileURLToPath(new URL('../src/',import.meta.url))),/fixture|Repository/);
});
