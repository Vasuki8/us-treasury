import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { snapshot } from '../src/official-snapshot.js';
import { registry } from '../src/registry.js';
import { loadSnapshotHistory, browserSnapshotAssets } from './snapshot-storage.mjs';
import { assertCommercialData } from './data-policy.mjs';
import { asKnownOn, normalizeVintageTimestamp, revisionHistory } from '../src/vintages.js';
import { vintagesCsv } from '../src/vintages-page.js';

const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const digest = value => createHash('sha256').update(value).digest('hex');
const seriesIds = history => [...new Set(history.captures.flatMap(capture => [...Object.keys(capture.series), ...capture.removedSeries]))].sort();
const latestCapture = history => history.captures.map(capture => normalizeVintageTimestamp(capture.capturedAt)).sort().at(-1) ?? null;
const boundaryCutoffs = history => [...new Set(history.captures.flatMap(capture => [normalizeVintageTimestamp(capture.capturedAt), new Date(Date.parse(capture.capturedAt) - 1).toISOString()]))].sort();
const merge = bundles => ({ version: 1, captures: bundles.flatMap(bundle => bundle.captures.map((capture, index) => [bundle.captureIndexes[index], capture])).sort(([a], [b]) => a - b).map(([, capture]) => capture) });
const exactKeys = (value, keys, message) => assert.deepEqual(Object.keys(value).sort(), [...keys].sort(), message);

const directory = fileURLToPath(new URL('../src/', import.meta.url));
const history = await loadSnapshotHistory(snapshot, { directory }), full = { ...snapshot, vintages: history };
// Admission always sees the complete immutable history before any partitioning.
assertCommercialData(full);
const options = process.argv.slice(2);
if (options.length > 1 || options.some(arg => !arg.startsWith('--baseline='))) throw new Error('Only --baseline=<saved snapshot JSON> is supported');
const baseline = { retainedCaptures: 0, checkedCutoffs: 0, checkedSeries: 0, checkedCsv: 0 };
if (options.length) {
  const before = JSON.parse(await readFile(options[0].slice('--baseline='.length), 'utf8')), prior = before.vintages;
  assert.ok(prior?.version === 1 && Array.isArray(prior.captures), 'Baseline must contain the original full capture history');
  const retained = { version: 1, captures: history.captures.slice(0, prior.captures.length) };
  assert.deepEqual(retained, prior, 'Every original capture object and its order must remain exact');
  baseline.retainedCaptures = retained.captures.length;
  for (const cutoff of boundaryCutoffs(prior)) {
    assert.deepEqual(asKnownOn(retained, cutoff), asKnownOn(prior, cutoff), `Baseline as-known mismatch at ${cutoff}`);
    baseline.checkedCutoffs++;
  }
  for (const id of seriesIds(prior)) {
    assert.deepEqual(revisionHistory(retained, id), revisionHistory(prior, id), `Baseline revision mismatch for ${id}`);
    baseline.checkedSeries++;
    if (Object.hasOwn(registry, id)) {
      assert.equal(vintagesCsv(retained, { seriesId: id, cutoff: latestCapture(prior) }), vintagesCsv(prior, { seriesId: id, cutoff: latestCapture(prior) }), `Baseline CSV mismatch for ${id}`);
      baseline.checkedCsv++;
    }
  }
}

const assets = browserSnapshotAssets(full), manifest = assets.snapshot.historyArchive;
exactKeys(manifest, ['version', 'captureCount', 'latestCaptureAt', 'sources'], 'Source history manifest fields');
assert.equal(manifest.version, 2);
assert.equal(manifest.captureCount, history.captures.length);
assert.equal(manifest.latestCaptureAt, latestCapture(history));
assert.deepEqual(Object.keys(manifest.sources), [...new Set(history.captures.map(capture => capture.sourceId))].sort(), 'Manifest source IDs must be complete and sorted');
const bundles = new Map(), indexes = new Set(), referencedFiles = new Set(), perSource = {};
let lazyGzipBytes = 0, lazyFallbackBytes = 0;
for (const [sourceId, source] of Object.entries(manifest.sources)) {
  const multipart=Object.hasOwn(source,'parts');
  const resourceKeys=multipart?['contentBytes','contentSha256','parts']:['compressed','fallback'];
  exactKeys(source,['captureCount','latestCaptureAt','seriesIds',...resourceKeys],`Manifest fields for ${sourceId}`);
  if(multipart){
    assert.ok(Array.isArray(source.parts)&&source.parts.length>=2,`History parts for ${sourceId}`);
    assert.ok(Number.isSafeInteger(source.contentBytes)&&source.contentBytes>0&&source.contentBytes<=MAX_ARCHIVE_BYTES,
      `Bounded complete source bytes for ${sourceId}`);
    assert.match(source.contentSha256,/^[a-f0-9]{64}$/);
  }
  const expected = { version: 1, captures: history.captures.filter(capture => capture.sourceId === sourceId) };
  assert.equal(source.captureCount, expected.captures.length, `Source capture count for ${sourceId}`);
  assert.equal(source.latestCaptureAt, latestCapture(expected), `Source latest capture for ${sourceId}`);
  assert.deepEqual(source.seriesIds, seriesIds(expected), `Complete historical series mapping for ${sourceId}`);
  const chunks=[];
  let sourceGzipBytes=0,sourceFallbackBytes=0;
  for(const part of multipart?source.parts:[source]){
    if(multipart)exactKeys(part,['compressed','fallback'],`Part fields for ${sourceId}`);
    const bytes={};
    for(const kind of ['compressed','fallback']){
      const extension=(multipart?'.bin':'.json')+(kind==='compressed'?'.gz':''),descriptor=part[kind];
      exactKeys(descriptor,['url','sha256','bytes'],`Resource fields for ${sourceId}/${kind}`);
      assert.match(descriptor.sha256,/^[a-f0-9]{64}$/);
      assert.equal(descriptor.url,`./history-${descriptor.sha256}${extension}`,`Content-addressed resource name for ${sourceId}/${kind}`);
      assert.ok(Number.isSafeInteger(descriptor.bytes)&&descriptor.bytes>0&&descriptor.bytes<MAX_FILE_BYTES,
        `Resource must remain below 20 MiB for ${sourceId}/${kind}`);
      const filename=descriptor.url.slice(2),content=assets.files.get(filename);
      assert.ok(Buffer.isBuffer(content),`Missing resource for ${sourceId}/${kind}`);
      assert.equal(content.length,descriptor.bytes,`Byte length for ${sourceId}/${kind}`);
      assert.equal(digest(content),descriptor.sha256,`Hash for ${sourceId}/${kind}`);
      referencedFiles.add(filename);bytes[kind]=content;
    }
    assert.deepEqual(gunzipSync(bytes.compressed,{maxOutputLength:part.fallback.bytes}),bytes.fallback,
      `Gzip and fallback content for ${sourceId}`);
    sourceGzipBytes+=bytes.compressed.length;sourceFallbackBytes+=bytes.fallback.length;chunks.push(bytes.fallback);
    assert.ok(sourceGzipBytes<=MAX_ARCHIVE_BYTES&&sourceFallbackBytes<=MAX_ARCHIVE_BYTES,`Source resource byte limits for ${sourceId}`);
  }
  const fallback=Buffer.concat(chunks);
  if(multipart){
    assert.equal(fallback.length,source.contentBytes,`Complete source byte length for ${sourceId}`);
    assert.equal(digest(fallback),source.contentSha256,`Complete source hash for ${sourceId}`);
  }
  const bundle = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(fallback));
  exactKeys(bundle, ['version', 'sourceId', 'captureIndexes', 'captures'], `Bundle fields for ${sourceId}`);
  assert.equal(bundle.version, 1);
  assert.equal(bundle.sourceId, sourceId);
  assert.deepEqual(bundle.captures, expected.captures, `Exact source capture objects for ${sourceId}`);
  assert.ok(bundle.captures.every(capture => capture.sourceId === sourceId), `Source identity for ${sourceId}`);
  assert.ok(Array.isArray(bundle.captureIndexes));
  assert.equal(bundle.captureIndexes.length, source.captureCount, `Capture index count for ${sourceId}`);
  bundle.captureIndexes.forEach((index, position) => {
    assert.ok(Number.isSafeInteger(index) && index >= 0 && index < manifest.captureCount, `Capture index range for ${sourceId}`);
    assert.ok(position === 0 || index > bundle.captureIndexes[position - 1], `Source capture index order for ${sourceId}`);
    assert.ok(!indexes.has(index), `Duplicate global capture index ${index}`);
    indexes.add(index);
    assert.deepEqual(bundle.captures[position], history.captures[index], `Original capture at global index ${index}`);
  });
  bundles.set(sourceId, bundle);
  perSource[sourceId] = { captures: source.captureCount, series: source.seriesIds.length,
    latestCaptureAt: source.latestCaptureAt, gzipBytes: sourceGzipBytes, fallbackBytes: sourceFallbackBytes };
  lazyGzipBytes += sourceGzipBytes;
  lazyFallbackBytes += sourceFallbackBytes;
}
assert.ok(lazyGzipBytes <= MAX_ARCHIVE_BYTES && lazyFallbackBytes <= MAX_ARCHIVE_BYTES, 'Total public resource byte limits');
assert.equal(indexes.size, manifest.captureCount, 'Every global capture index must occur exactly once');
for(const [sourceId,descriptor]of Object.entries(assets.snapshot.sourceArchive.sources)){
  const filename=descriptor.url.slice(2),content=assets.files.get(filename);
  assert.ok(Buffer.isBuffer(content),`Missing current source module for ${sourceId}`);
  assert.equal(content.length,descriptor.bytes,`Current source byte length for ${sourceId}`);
  assert.equal(digest(content),descriptor.sha256,`Current source SHA256 for ${sourceId}`);
  const module=await import(`data:text/javascript;base64,${content.toString('base64')}`);
  assert.deepEqual(module.snapshot.source,snapshot.sources[sourceId],`Exact complete current source for ${sourceId}`);
  referencedFiles.add(filename);
}
assert.deepEqual([...assets.files.keys()].sort(), [...referencedFiles].sort(), 'No unreferenced public assets');
const merged = merge([...bundles.values()]);
assert.deepEqual(merged, history, 'Source partitions must merge to the exact canonical history');

let checkedCutoffs = 0, checkedSourceCutoffs = 0, checkedSeries = 0, checkedCsv = 0;
const knownAt = new Map();
for (const cutoff of boundaryCutoffs(history)) {
  const known = asKnownOn(history, cutoff);
  assert.deepEqual(asKnownOn(merged, cutoff), known, `Merged as-known mismatch at ${cutoff}`);
  knownAt.set(cutoff, known);
  checkedCutoffs++;
}
const groups = new Map();
for (const id of seriesIds(history)) {
  const sourceIds = Object.keys(manifest.sources).filter(sourceId => manifest.sources[sourceId].seriesIds.includes(id));
  const key = JSON.stringify(sourceIds);
  if (!groups.has(key)) {
    const selected = merge(sourceIds.map(sourceId => bundles.get(sourceId)));
    for (const [cutoff, known] of knownAt) {
      const expected = { sources: Object.fromEntries(sourceIds.filter(sourceId => Object.hasOwn(known.sources, sourceId)).map(sourceId => [sourceId, known.sources[sourceId]])) };
      assert.deepEqual(asKnownOn(selected, cutoff), expected, `Selected-source as-known mismatch for ${key} at ${cutoff}`);
      checkedSourceCutoffs++;
    }
    groups.set(key, selected);
  }
  const selected = groups.get(key);
  assert.deepEqual(revisionHistory(selected, id), revisionHistory(history, id), `Selected-source revision mismatch for ${id}`);
  checkedSeries++;
  if (Object.hasOwn(registry, id)) {
    // Other-source captures cannot change this series. Test each selected-source
    // boundary and the global default cutoff, including its exact CSV timestamp.
    const cutoffs = [...new Set([...boundaryCutoffs(selected), manifest.latestCaptureAt])].filter(Boolean).sort();
    for (const cutoff of cutoffs) {
      assert.equal(vintagesCsv(selected, { seriesId: id, cutoff }), vintagesCsv(history, { seriesId: id, cutoff }), `Selected-source CSV mismatch for ${id} at ${cutoff}`);
      checkedCsv++;
    }
  }
}

const storedRoot = await readFile(path.join(directory, 'official-snapshot.json.gz'));
const immutableArchiveBytes = snapshot.vintageArchive?.captures.reduce((total, capture) => total + capture.bytes, 0) ?? 0;
console.log(JSON.stringify({
  captures: history.captures.length, sources: bundles.size,
  checkedCutoffs, checkedSourceCutoffs, checkedSeries, checkedCsv, baseline,
  currentModuleBytes: Buffer.byteLength(assets.module), lazyGzipBytes, lazyFallbackBytes,
  combinedGzipBytes: gzipSync(JSON.stringify(history), { level: 9 }).length,
  storedRootBytes: storedRoot.length, storedRootSha256: digest(storedRoot), immutableArchiveBytes, perSource,
}, null, 2));
