import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { asKnownOn, recordVintages, revisionHistory } from '../src/vintages.js';
import { assertArchivePrefix, browserSnapshotAssets, loadSnapshotHistory, snapshotModule, validateArchiveIndex, writeStoredSnapshot } from '../scripts/snapshot-storage.mjs';

const temporaryRoot = fileURLToPath(new URL('../test-results/', import.meta.url));
const digest = value => createHash('sha256').update(value).digest('hex');
const at = ['2026-10-20T12:00:00.000Z', '2026-10-21T12:00:00.000Z', '2026-10-22T12:00:00.000Z'];
const source = (time, value, extra = {}) => ({ id: 'test', fetchedAt: time, sourceNotice: 'Retain original source conditions.', provenance: [{ url: 'https://example.test/original', sha256: 'a'.repeat(64), retrievedAt: time, lastModified: null }], series: { measure: { sourceIds: ['original'], sourceUrl: 'https://example.test/original', unit: 'Original units', observations: [{ date: '2026-01-01', value, publishedAt: null, footnotes: [], ...extra }] } } });
function fixture() {
  const vintages = recordVintages(null, { test: source(at[0], 1) }, { test: source(at[1], 2) }, { checkedAt: at[2] });
  // Legacy timestamp spelling and extra observation fields must survive exactly.
  vintages.captures[0].capturedAt = '2026-10-20T12:00:00Z';
  vintages.captures[0].recordedAt = '2026-10-22T12:00:00Z';
  return { schemaVersion: 1, generatedAt: at[2], sources: { test: source(at[1], 2) }, vintages };
}
async function directory(t) {
  await mkdir(temporaryRoot, { recursive: true });
  const root = await mkdtemp(path.join(temporaryRoot, 'snapshot-storage-'));
  t.after(async () => {
    const relative = path.relative(temporaryRoot, root);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });
  return root;
}
const moduleValue = async source => (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).snapshot;

test('generated modules pool repeated long strings without changing JSON values or __proto__ keys', async () => {
  const repeated = 'Captured terms and original input URL. '.repeat(15);
  const value = JSON.parse('{"__proto__":{"retained":true},"constructor":"literal","nested":{}}');
  value.items = [repeated, repeated, { notice: repeated, quote: '\\"\n\u2028', zero: 0, missing: null }];
  const generated = snapshotModule(value);
  assert.deepEqual(await moduleValue(generated), value);
  assert.equal(Object.getPrototypeOf((await moduleValue(generated))), Object.prototype);
  assert(generated.length < JSON.stringify(value).length);
  assert.doesNotMatch(generated, /\bimport\b|node:/);
  assert.throws(() => snapshotModule({ invalid: Number.NaN }), /finite|JSON|unsupported/i);
  assert(Object.is((await moduleValue(snapshotModule({ value: -0 }))).value, -0));
});

test('legacy inline histories and absent histories load without touching the filesystem', async () => {
  const original = fixture();
  assert.deepEqual(await loadSnapshotHistory(original, { directory: '/does-not-exist' }), original.vintages);
  assert.deepEqual(await loadSnapshotHistory({}), { version: 1, captures: [] });
});

test('storage preserves exact captures, retrieval cutoffs and revision confirmations while appending immutable files', async t => {
  const root = await directory(t), destination = path.join(root, 'official-snapshot.js'), full = fixture();
  const initial = await writeStoredSnapshot(full, { destination });
  assert.equal(initial.vintages, undefined);
  assert.equal(initial.vintageArchive.captures.length, 2);
  assert.deepEqual(await moduleValue(await readFile(destination, 'utf8')), initial);
  const before = new Map(await Promise.all(initial.vintageArchive.captures.map(async entry => [entry.path, await readFile(path.join(root, entry.path))])));
  const decoded = await loadSnapshotHistory(initial, { directory: root });
  assert.deepEqual(decoded, full.vintages);
  for (const capture of full.vintages.captures) {
    const time = new Date(capture.capturedAt);
    for (const cutoff of [time.toISOString(), new Date(time.getTime() - 1).toISOString()]) assert.deepEqual(asKnownOn(decoded, cutoff), asKnownOn(full.vintages, cutoff));
  }
  assert.deepEqual(revisionHistory(decoded, 'measure'), revisionHistory(full.vintages, 'measure'));
  const next = { ...full, vintages: recordVintages(full.vintages, {}, { test: source(at[2], 2) }, { checkedAt: at[2] }) };
  const appended = await writeStoredSnapshot(next, { destination, previous: initial });
  assert.deepEqual(appended.vintageArchive.captures.slice(0, 2), initial.vintageArchive.captures);
  assert.equal(appended.vintageArchive.captures.length, 3);
  for (const [name, bytes] of before) assert.deepEqual(await readFile(path.join(root, name)), bytes);
  assert.deepEqual(await loadSnapshotHistory(appended, { directory: root }), next.vintages);
  const revisions = revisionHistory(await loadSnapshotHistory(appended, { directory: root }), 'measure');
  assert.equal(revisions[0].latest.capturedAt, at[2]);
});

test('archive index validation rejects paths, bounds, duplicate keys and incoherent per-source ordering', async t => {
  const root = await directory(t), stored = await writeStoredSnapshot(fixture(), { destination: path.join(root, 'official-snapshot.js') });
  assert.deepEqual(validateArchiveIndex(stored.vintageArchive), stored.vintageArchive);
  for (const mutate of [
    index => { index.captures[0].path = '../outside.json.gz'; },
    index => { index.captures[0].bytes = -1; },
    index => { index.captures[0].contentBytes = 2 ** 40; },
    index => { index.captures[0].sha256 = 'bad'; },
    index => { index.captures[0].unexpected = true; },
    index => { index.captures.push(structuredClone(index.captures[0])); },
    index => { index.captures.reverse(); },
  ]) {
    const invalid = structuredClone(stored.vintageArchive); mutate(invalid);
    assert.throws(() => validateArchiveIndex(invalid), /archive|capture|path|hash|length|bytes|order|baseline/i);
  }
});

test('prefix checks reject pruning, changed immutable content and altered indexed descriptors', async t => {
  const root = await directory(t), full = fixture(), stored = await writeStoredSnapshot(full, { destination: path.join(root, 'official-snapshot.js') });
  assert.doesNotThrow(() => assertArchivePrefix(full, stored));
  for (const mutate of [
    next => { next.vintages.captures.pop(); },
    next => { next.vintages.captures[0].metadata.sourceNotice = 'Changed historical terms'; },
    next => { next.vintages.captures[0].recordedAt = at[1]; },
  ]) {
    const changed = structuredClone(full); mutate(changed);
    assert.throws(() => assertArchivePrefix(full, changed), /prefix|immutable|capture|history/i);
  }
  const changed = structuredClone(stored); changed.vintageArchive.captures[0].contentBytes += 1;
  assert.throws(() => assertArchivePrefix(stored, changed), /prefix|immutable|capture|history/i);
});

test('missing and corrupted files or mismatched content metadata fail loading', async t => {
  for (const mutate of [
    async (root, entry) => rm(path.join(root, entry.path)),
    async (root, entry) => writeFile(path.join(root, entry.path), 'not gzip'),
    async (_root, entry) => { entry.contentSha256 = 'b'.repeat(64); },
    async (_root, entry) => { entry.contentBytes += 1; },
    async (_root, entry) => { entry.recordedAt = at[1]; },
  ]) {
    const root = await directory(t), stored = await writeStoredSnapshot(fixture(), { destination: path.join(root, 'official-snapshot.js') });
    await mutate(root, stored.vintageArchive.captures[0]);
    await assert.rejects(loadSnapshotHistory(stored, { directory: root }), /archive|capture|ENOENT|gzip|hash|bytes|length|metadata/i);
  }
});

test('an immutable file collision stops writes before changing the published root', async t => {
  const root = await directory(t), destination = path.join(root, 'official-snapshot.js'), full = fixture();
  const stored = await writeStoredSnapshot(full, { destination }), before = await readFile(destination);
  const next = { ...full, vintages: recordVintages(full.vintages, {}, { test: source(at[2], 3) }, { checkedAt: at[2] }) };
  const content = Buffer.from(JSON.stringify(next.vintages.captures.at(-1))), compressed = gzipSync(content, { level: 9, mtime: 0 });
  compressed.fill(0, 4, 8); compressed[9] = 255;
  await mkdir(path.join(root, 'history', `${digest(compressed)}.json.gz`));
  await assert.rejects(writeStoredSnapshot(next, { destination, previous: stored }), /archive|file|directory|EEXIST|EISDIR/i);
  assert.deepEqual(await readFile(destination), before);
  assert.deepEqual(await loadSnapshotHistory(stored, { directory: root }), full.vintages);
});

test('prior immutable captures are verified and reused without recompression', async t => {
  const root = await directory(t), destination = path.join(root, 'official-snapshot.js'), full = fixture();
  const stored = await writeStoredSnapshot(full, { destination });
  const capture = full.vintages.captures[0], content = Buffer.from(JSON.stringify(capture));
  // A valid capture from another compressor remains immutable during append.
  const compressed = gzipSync(content, { level: 1 });
  compressed[9] = 3;
  const entry = { ...stored.vintageArchive.captures[0], sha256: digest(compressed), bytes: compressed.length };
  entry.path = `history/${entry.sha256}.json.gz`;
  await writeFile(path.join(root, entry.path), compressed);
  stored.vintageArchive.captures[0] = entry;
  const appended = await writeStoredSnapshot(full, { destination, previous: stored });
  assert.deepEqual(appended.vintageArchive, stored.vintageArchive);
  assert.deepEqual(await readFile(path.join(root, entry.path)), compressed);
  const before = await readFile(destination);
  await writeFile(path.join(root, entry.path), 'corrupt prior capture');
  await assert.rejects(writeStoredSnapshot(full, { destination, previous: stored }), /archive|capture|bytes|length|hash/i);
  assert.deepEqual(await readFile(destination), before);
});

test('stored and browser gzip headers use zero timestamps, level nine and the portable OS marker', async t => {
  const root = await directory(t), stored = await writeStoredSnapshot(fixture(), { destination: path.join(root, 'official-snapshot.js') });
  const assets = browserSnapshotAssets(fixture());
  const buffers = [await readFile(path.join(root, stored.vintageArchive.captures[0].path)), assets.files.get(assets.snapshot.historyArchive.compressed.url.slice(2))];
  for (const bytes of buffers) {
    assert.equal(bytes.readUInt32LE(4), 0);
    assert.equal(bytes[8], 2);
    assert.equal(bytes[9], 255);
  }
});

test('invalid new history is rejected before the existing root changes', async t => {
  const root = await directory(t), destination = path.join(root, 'official-snapshot.js'), full = fixture();
  const previous = await writeStoredSnapshot(full, { destination }), before = await readFile(destination);
  const changed = structuredClone(full);
  changed.vintages.captures[0].metadata.sourceNotice = 'Changed original terms';
  await assert.rejects(writeStoredSnapshot(changed, { destination, previous }), /immutable|prefix|capture|history/i);
  assert.deepEqual(await readFile(destination), before);
});

test('symlinked history directories are rejected before reading or writing outside the snapshot directory', async t => {
  const root = await directory(t), other = await directory(t), full = fixture();
  await mkdir(path.join(other, 'history'));
  try { await symlink(path.join(other, 'history'), path.join(root, 'history'), 'junction'); }
  catch (error) { if (error.code === 'EPERM' || error.code === 'EACCES') return t.skip('Host does not permit test symlinks'); throw error; }
  const before = await readdir(path.join(other, 'history'));
  await assert.rejects(writeStoredSnapshot(full, { destination: path.join(root, 'official-snapshot.js') }), /symbolic|symlink|directory/i);
  assert.deepEqual(await readdir(path.join(other, 'history')), before);
});

test('browser projection excludes archived captures and produces exact integrity-checked gzip and fallback bundles', async () => {
  const full = fixture(), original = structuredClone(full), result = browserSnapshotAssets(full);
  assert.deepEqual(full, original);
  assert.equal(result.snapshot.vintages, undefined);
  assert.equal(result.snapshot.vintageArchive, undefined);
  assert.deepEqual(result.snapshot.sources, full.sources);
  assert.deepEqual(await moduleValue(result.module), result.snapshot);
  const descriptor = result.snapshot.historyArchive;
  assert.equal(descriptor.version, 1);
  assert.equal(descriptor.captureCount, 2);
  assert.equal(descriptor.latestCaptureAt, at[1]);
  assert.equal(result.files.size, 2);
  for (const [kind, item] of [['compressed', descriptor.compressed], ['fallback', descriptor.fallback]]) {
    assert.match(item.url, kind === 'compressed' ? /^\.\/history-[a-f0-9]{64}\.json\.gz$/ : /^\.\/history-[a-f0-9]{64}\.json$/);
    const bytes = result.files.get(item.url.slice(2));
    assert(Buffer.isBuffer(bytes));
    assert.equal(bytes.length, item.bytes);
    assert.equal(digest(bytes), item.sha256);
    assert.deepEqual(JSON.parse((kind === 'compressed' ? gunzipSync(bytes) : bytes).toString('utf8')), full.vintages);
  }
});

test('browser projection accepts a hydrated stored root and handles a verified empty archive', async t => {
  const root = await directory(t), full = fixture();
  const stored = await writeStoredSnapshot(full, { destination: path.join(root, 'official-snapshot.js') });
  const hydrated = { ...stored, vintages: await loadSnapshotHistory(stored, { directory: root }) };
  assert.deepEqual(browserSnapshotAssets(hydrated).snapshot, browserSnapshotAssets(full).snapshot);
  const empty = browserSnapshotAssets({ schemaVersion: 1, sources: {}, vintages: { version: 1, captures: [] } });
  assert.equal(empty.snapshot.historyArchive.captureCount, 0);
  assert.equal(empty.snapshot.historyArchive.latestCaptureAt, null);
  assert.deepEqual(JSON.parse(empty.files.get(empty.snapshot.historyArchive.fallback.url.slice(2))), { version: 1, captures: [] });
  assert.throws(() => browserSnapshotAssets(stored), /hydrated/i);
});
