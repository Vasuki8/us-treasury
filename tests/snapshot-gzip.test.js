import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import * as storage from '../scripts/snapshot-storage.mjs';
import { snapshot } from '../src/official-snapshot.js';

const temporaryRoot = fileURLToPath(new URL('../test-results/', import.meta.url));
const at = '2026-10-29T00:00:00.000Z';
const empty = () => ({ schemaVersion: 1, sources: {}, vintageArchive: { version: 1, captures: [] } });
const capture = value => ({
  sourceId: 'test', capturedAt: at, recordedAt: at, baseline: true,
  metadata: {}, provenance: [], removedSeries: [],
  series: { measure: { metadata: {}, upserts: [{ date: '2026-10-01', value, publishedAt: null }], deletedDates: [] } },
});
async function directory(t) {
  await mkdir(temporaryRoot, { recursive: true });
  const root = await mkdtemp(path.join(temporaryRoot, 'snapshot-gzip-'));
  t.after(async () => {
    const relative = path.relative(temporaryRoot, root);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });
  return root;
}

test('gzip storage preserves absent, null, signed zero, key order and own __proto__ values', () => {
  const value = JSON.parse('{"schemaVersion":1,"__proto__":{"retained":true},"sources":{},"zero":-0,"missing":null}');
  const bytes = storage.encodeStoredSnapshot(value), decoded = storage.decodeStoredSnapshot(bytes);
  assert.deepEqual(decoded, value);
  assert(Object.is(decoded.zero, -0));
  assert.equal(Object.hasOwn(decoded, 'absent'), false);
  assert.equal(decoded.missing, null);
  assert.equal(Object.getPrototypeOf(decoded), Object.prototype);
  assert.deepEqual(Object.keys(decoded), ['schemaVersion', '__proto__', 'sources', 'zero', 'missing']);
  assert.equal(gunzipSync(bytes).toString(), '{"schemaVersion":1,"__proto__":{"retained":true},"sources":{},"zero":-0,"missing":null}');
  assert.deepEqual(storage.encodeStoredSnapshot(decoded), bytes);
  assert.equal(bytes.readUInt32LE(4), 0);
  assert.equal(bytes[8], 2);
  assert.equal(bytes[9], 255);
});

test('gzip encoding rejects values that JSON would silently change or discard', () => {
  for (const value of [
    { value: undefined }, { value: NaN }, { value: Infinity }, { value: BigInt(1) },
    { value: new Date(at) }, { value: { toJSON() { return 1; } } }, { value: Array(1) },
  ]) assert.throws(() => storage.encodeStoredSnapshot(value), /JSON|finite|unsupported/i);
  const cyclic = {}; cyclic.self = cyclic;
  assert.throws(() => storage.encodeStoredSnapshot(cyclic), /cyclic/i);
});

test('gzip decoding rejects invalid compression, truncation, invalid UTF-8 and malformed JSON', () => {
  const valid = storage.encodeStoredSnapshot(empty());
  for (const bytes of [
    Buffer.from('not gzip'), valid.subarray(0, valid.length - 1), gzipSync('{bad json'),
    gzipSync(Buffer.from([123, 34, 120, 34, 58, 34, 255, 34, 125])),
  ]) assert.throws(() => storage.decodeStoredSnapshot(bytes), /gzip|JSON|UTF-8|encoding|decompress/i);
});

test('gzip storage rejects primitive roots and invalid archive descriptors', () => {
  for (const value of [null, [], 0, 'snapshot', true]) {
    assert.throws(() => storage.encodeStoredSnapshot(value), /root|object/i);
    assert.throws(() => storage.decodeStoredSnapshot(gzipSync(JSON.stringify(value))), /root|object/i);
  }
  const invalid = { ...empty(), vintageArchive: { version: 1, captures: [{ path: '../escape' }] } };
  assert.throws(() => storage.encodeStoredSnapshot(invalid), /archive|fields/i);
  assert.throws(() => storage.decodeStoredSnapshot(gzipSync(JSON.stringify(invalid))), /archive|fields/i);
});

test('gzip decoding bounds compressed input before decompressing it', () => {
  assert.throws(() => storage.decodeStoredSnapshot(Buffer.alloc(20 * 1024 ** 2 + 1)), /compressed|input|limit|bytes/i);
  assert.throws(() => storage.decodeStoredSnapshot('not bytes'), /bytes|buffer|input/i);
});

test('gzip decoding bounds expanded input before parsing it', () => {
  const oversized = gzipSync(Buffer.alloc(128 * 1024 ** 2 + 1, 32));
  assert.throws(() => storage.decodeStoredSnapshot(oversized), /output|limit|bytes|decompress/i);
});

test('gzip storage preserves the entire real snapshot and regenerates the same browser module', () => {
  const before = storage.snapshotModule(snapshot);
  const decoded = storage.decodeStoredSnapshot(storage.encodeStoredSnapshot(snapshot));
  assert.deepEqual(decoded, snapshot);
  assert.equal(storage.snapshotModule(decoded), before);
});

test('gzip writes retain archive bytes and reject pruned history without replacing the root', async t => {
  const root = await directory(t), destination = path.join(root, 'official-snapshot.json.gz');
  const full = { schemaVersion: 1, sources: {}, vintages: { version: 1, captures: [capture(-0)] } };
  const stored = await storage.writeStoredSnapshot(full, { destination });
  const before = await readFile(destination), names = await readdir(path.join(root, 'history'));
  assert.deepEqual(storage.decodeStoredSnapshot(before), stored);
  assert.deepEqual(await storage.loadSnapshotHistory(stored, { directory: root }), full.vintages);
  const archive = await readFile(path.join(root, stored.vintageArchive.captures[0].path));
  await storage.writeStoredSnapshot(full, { destination, previous: stored });
  assert.deepEqual(await readFile(destination), before);
  assert.deepEqual(await readdir(path.join(root, 'history')), names);
  assert.deepEqual(await readFile(path.join(root, stored.vintageArchive.captures[0].path)), archive);
  await assert.rejects(storage.writeStoredSnapshot({ ...full, vintages: { version: 1, captures: [] } }, {
    destination, previous: stored,
  }), /pruned|prefix|immutable/i);
  assert.deepEqual(await readFile(destination), before);
  assert.equal((await readdir(root)).some(name => name.endsWith('.tmp')), false);
});
