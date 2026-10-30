import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFileSync,existsSync,mkdirSync,mkdtempSync,readFileSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {registry} from '../src/registry.js';
import {parseRoute,routeFor} from '../src/router.js';

const generator=new URL('../scripts/update-registry-counts.mjs',import.meta.url);
const document=new URL('../docs/registry-counts.md',import.meta.url);
async function loadGenerator(){
  assert.ok(existsSync(generator),'The registry count generator must exist');
  return import(generator.href);
}

test('registry counts recalculate measurements, distinct source IDs and page types from fixtures',async()=>{
  const {renderRegistryCounts}=await loadGenerator();
  const measurements={first:{agency:'officialA'},second:{agency:'officialA'}};
  const pages={overview:'/overview',indicator:'/series/'};
  const before=renderRegistryCounts(measurements,pages);
  assert.match(before,/\| Measurements \| 2 \|/);
  assert.match(before,/\| Sources \| 1 \|/);
  assert.match(before,/\| Pages \| 2 \|/);
  measurements.third={agency:'officialA'};
  measurements.fourth={agency:'officialB'};
  pages.sources='/sources';
  const after=renderRegistryCounts(measurements,pages);
  assert.match(after,/\| Measurements \| 4 \|/);
  assert.match(after,/\| Sources \| 2 \|/);
  assert.match(after,/\| Pages \| 3 \|/);
});

test('generated count document matches the live registries',async()=>{
  const {renderRegistryCounts}=await loadGenerator();
  const {pagePaths}=await import('../src/page-registry.js');
  const generated=readFileSync(document,'utf8');
  assert.equal(generated,renderRegistryCounts());
  assert.ok(generated.includes(`| Measurements | ${Object.keys(registry).length} |`));
  assert.ok(generated.includes(`| Sources | ${new Set(Object.values(registry).map(item=>item.agency)).size} |`));
  assert.ok(generated.includes(`| Pages | ${Object.keys(pagePaths).length} |`));
});

test('count generator check detects missing or stale output without writing',async t=>{
  await loadGenerator();
  const temporaryRoot=resolve(tmpdir()),directory=mkdtempSync(join(temporaryRoot,'meridian-counts-'));
  t.after(()=>{
    assert.equal(dirname(directory),temporaryRoot);
    rmSync(directory,{recursive:true,force:true});
  });
  for(const name of ['scripts','src','docs'])mkdirSync(join(directory,name));
  writeFileSync(join(directory,'package.json'),'{"type":"module"}\n');
  copyFileSync(generator,join(directory,'scripts/update-registry-counts.mjs'));
  writeFileSync(join(directory,'src/registry.js'),"export const registry={a:{agency:'same'},b:{agency:'same'}};\n");
  writeFileSync(join(directory,'src/page-registry.js'),"export const pagePaths={overview:'/overview',indicator:'/series/'};\n");
  const output=join(directory,'docs/registry-counts.md');
  const run=(...args)=>spawnSync(process.execPath,['scripts/update-registry-counts.mjs',...args],{cwd:directory,encoding:'utf8'});
  assert.equal(run('--check').status,1);
  assert.equal(existsSync(output),false);
  assert.equal(run().status,0);
  assert.match(readFileSync(output,'utf8'),/\| Measurements \| 2 \|/);
  const modified=statSync(output).mtimeMs;
  assert.equal(run('--check').status,0);
  assert.equal(statSync(output).mtimeMs,modified);
  writeFileSync(output,'stale\n');
  assert.equal(run('--check').status,1);
  assert.equal(readFileSync(output,'utf8'),'stale\n');
});

test('registered page types preserve existing paths, round trips, encoding and unknown fallback',async()=>{
  assert.ok(existsSync(new URL('../src/page-registry.js',import.meta.url)),'The shared page registry must exist');
  const {pagePaths}=await import('../src/page-registry.js');
  const paths={
    release:'/release',credit:'/credit',research:'/research',sources:'/sources',macroCoverage:'/economy',overview:'/overview',
    labor:'/economy/labor',indicator:'/series/',calendar:'/calendar',explore:'/explore',watchlist:'/watchlist',fiscal:'/fiscal',
    refinancing:'/refinancing',yields:'/yields',auctions:'/auctions',ownership:'/ownership',macro:'/macro',vintages:'/vintages',
    market:'/market',
  };
  assert.deepEqual(pagePaths,paths);
  for(const [page,path] of Object.entries(paths)){
    const state={page,seriesId:'unrate'};
    for(const legacyWindow of [false,true]){
      const hash=routeFor(state,{legacyWindow});
      assert.equal(hash.split('?')[0],'#'+path+(page==='indicator'?'unrate':''));
      assert.equal(parseRoute(hash).page,page);
    }
  }
  assert.equal(routeFor({page:'indicator',seriesId:'a/b c'}).split('?')[0],'#/series/a%2Fb%20c');
  assert.equal(routeFor({page:'unknown'}),'#/overview');
  assert.equal(parseRoute('#/unknown').page,'overview');
});
