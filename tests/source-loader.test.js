import test from 'node:test';
import assert from 'node:assert/strict';
import { createSourceLoader } from '../src/source-loader.js';

const hash = 'a'.repeat(64);
const source = { id:'alpha', series:{ measure:{ observations:[{ date:'2026-01-01', value:2 }] } }, provenance:[] };
const descriptor = () => ({ version:1, sources:{ alpha:{
  url:`./source-${hash}.js`, sha256:hash, bytes:100, seriesIds:['measure'], observationCount:1,
} } });

test('canonical Node snapshots without a lazy manifest already contain complete source data', async () => {
  const loader = createSourceLoader(undefined, { importer:() => assert.fail('Canonical data must not import') });
  assert.deepEqual(loader.getState('alpha'), { status:'ready', source:null, error:null });
  assert.equal(await loader.load('alpha'), null);
});

test('empty sources and metadata-only series preserve absent observations without inventing rows', async () => {
  for (const original of [{ id:'alpha' }, { id:'alpha', series:{} }, { id:'alpha', series:{ measure:{ unit:'Original' } } }]) {
    const manifest = descriptor();
    manifest.sources.alpha.seriesIds = Object.keys(original.series ?? {});
    manifest.sources.alpha.observationCount = 0;
    const loader = createSourceLoader(manifest, { importer:async () => ({ snapshot:{ source:original } }) });
    assert.strictEqual(await loader.load('alpha'), original);
  }
});

test('source loader stays idle until requested, deduplicates in flight and caches the complete source', async () => {
  let calls = 0, finish;
  const loader = createSourceLoader(descriptor(), { importer:url => {
    calls++;
    assert.match(url, /\/source-a{64}\.js$/);
    return new Promise(resolve => { finish = resolve; });
  } });
  assert.deepEqual(loader.getState('alpha'), { status:'idle', source:null, error:null });
  assert.equal(calls, 0);
  const pending = loader.load('alpha');
  assert.equal(loader.getState('alpha').status, 'loading');
  assert.strictEqual(loader.load('alpha'), pending);
  await Promise.resolve();
  finish({ snapshot:{ source } });
  assert.strictEqual(await pending, source);
  assert.strictEqual(await loader.load('alpha'), source);
  assert.equal(calls, 1);
  assert.deepEqual(loader.getState('alpha'), { status:'ready', source, error:null });
});

test('failed source loads remain failed until retry and retry uses a fresh native import URL', async () => {
  const urls = [];
  const loader = createSourceLoader(descriptor(), { importer:async url => {
    urls.push(url);
    if (urls.length === 1) throw new Error('Temporary source failure');
    return { snapshot:{ source } };
  } });
  await assert.rejects(loader.load('alpha'), /Temporary/);
  assert.equal(loader.getState('alpha').status, 'error');
  await assert.rejects(loader.load('alpha'), /Temporary/);
  assert.equal(urls.length, 1);
  assert.strictEqual(await loader.load('alpha', { retry:true }), source);
  assert.notEqual(urls[1], urls[0]);
  assert.ok(new URL(urls[1]).searchParams.has('retry'));
});

test('invalid manifests fail before importing and source identity, schema and observation counts are checked', async () => {
  for (const mutate of [
    value => { value.version = 2; },
    value => { value.sources.alpha.url = 'https://outside.test/source.js'; },
    value => { value.sources.alpha.url = '../source.js'; },
    value => { value.sources.alpha.sha256 = 'invalid'; },
    value => { value.sources.alpha.bytes = 0; },
    value => { value.sources.alpha.observationCount = -1; },
    value => { value.sources.alpha.seriesIds = ['measure', 'measure']; },
  ]) {
    const invalid = descriptor(); mutate(invalid);
    const loader = createSourceLoader(invalid, { importer:() => { assert.fail('Invalid descriptor must not import'); } });
    assert.equal(loader.getState('alpha').status, 'error');
    await assert.rejects(loader.load('alpha'), /descriptor|archive/);
  }
  for (const invalid of [
    { ...source, id:'beta' }, { ...source, series:null }, { ...source, series:{} },
    { ...source, series:{ measure:{ observations:[] } } }, { ...source, series:{ measure:{ observations:{} } } },
  ]) {
    const loader = createSourceLoader(descriptor(), { importer:async () => ({ snapshot:{ source:invalid } }) });
    await assert.rejects(loader.load('alpha'), /identity|schema|mapping|count|observations/);
    assert.equal(loader.getState('alpha').status, 'error');
  }
  const loader = createSourceLoader(descriptor());
  await assert.rejects(loader.load('unknown'), /Unknown/);
});
