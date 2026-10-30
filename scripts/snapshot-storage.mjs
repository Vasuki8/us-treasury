import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { normalizeVintageTimestamp } from '../src/vintages.js';
import { currentSnapshotAssets } from './current-snapshot.mjs';

const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_STORED_BYTES = 20 * 1024 * 1024;
const BROWSER_HISTORY_PART_BYTES = 16 * 1024 * 1024;
const MAX_STORED_CONTENT_BYTES = 128 * 1024 * 1024;
const MAX_CAPTURES = 100000;
const HASH = /^[a-f0-9]{64}$/;
const ENTRY_KEYS = ['path', 'sha256', 'contentSha256', 'bytes', 'contentBytes', 'sourceId', 'capturedAt', 'recordedAt', 'baseline'];
const digest = value => createHash('sha256').update(value).digest('hex');
const own = (value, key) => Object.hasOwn(value, key);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => { throw new Error(`Invalid snapshot archive: ${message}`); };

function exactKeys(value, keys) {
  if (!object(value) || Object.keys(value).length !== keys.length || keys.some(key => !own(value, key))) fail('unexpected or missing archive fields');
}

// Strict JSON serialization also protects generated modules from silent NaN,
// undefined, custom toJSON, sparse-array and non-JSON object conversions.
function jsonValue(value, strings, ancestors = new Set(), sorted = false) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') {
    if (strings) strings.set(value, (strings.get(value) ?? 0) + 1);
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('JSON numbers must be finite');
    return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  }
  if (!value || typeof value !== 'object' || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) fail('unsupported JSON value');
  if (ancestors.has(value)) fail('cyclic JSON value');
  ancestors.add(value);
  let result;
  if (Array.isArray(value)) {
    const values = [];
    for (let i = 0; i < value.length; i++) {
      if (!own(value, i)) fail('unsupported sparse JSON array');
      values.push(jsonValue(value[i], strings, ancestors, sorted));
    }
    result = `[${values.join(',')}]`;
  } else {
    const keys = Object.keys(value);
    if (sorted) keys.sort();
    result = `{${keys.map(key => `${JSON.stringify(key)}:${jsonValue(value[key], strings, ancestors, sorted)}`).join(',')}}`;
  }
  ancestors.delete(value);
  return result;
}

const equal = (a, b) => jsonValue(a, null, new Set(), true) === jsonValue(b, null, new Set(), true);
function canonicalGzip(content) {
  const compressed = gzipSync(content, { level: 9, mtime: 0 });
  compressed.fill(0, 4, 8);
  compressed[9] = 255;
  return compressed;
}

function captureMetadata(item, states, seen) {
  if (!object(item) || typeof item.sourceId !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(item.sourceId)) fail('invalid capture source ID');
  let capturedAt, recordedAt;
  try { capturedAt = normalizeVintageTimestamp(item.capturedAt); recordedAt = normalizeVintageTimestamp(item.recordedAt); }
  catch { fail('invalid capture timestamp'); }
  if (recordedAt < capturedAt || typeof item.baseline !== 'boolean') fail('invalid capture metadata or baseline');
  const key = `${item.sourceId}|${capturedAt}`;
  if (seen.has(key)) fail('duplicate immutable capture key');
  seen.add(key);
  const prior = states.get(item.sourceId);
  if ((!prior && !item.baseline) || (prior && (item.baseline || capturedAt <= prior))) fail('capture order or baseline is incoherent');
  states.set(item.sourceId, capturedAt);
}

function validateHistory(history) {
  exactKeys(history, ['version', 'captures']);
  if (history.version !== 1 || !Array.isArray(history.captures) || history.captures.length > MAX_CAPTURES) fail('unsupported capture history');
  const states = new Map(), seen = new Set();
  let bytes = 0;
  for (const item of history.captures) {
    captureMetadata(item, states, seen);
    if (!object(item.series) || !Array.isArray(item.removedSeries)) fail('invalid capture structure');
    const length = Buffer.byteLength(jsonValue(item));
    if (length > MAX_CAPTURE_BYTES || (bytes += length) > MAX_ARCHIVE_BYTES) fail('capture content bytes exceed output limit');
  }
  return history;
}

export function validateArchiveIndex(index) {
  exactKeys(index, ['version', 'captures']);
  if (index.version !== 1 || !Array.isArray(index.captures) || index.captures.length > MAX_CAPTURES) fail('unsupported archive index');
  const states = new Map(), seen = new Set(), paths = new Set();
  let total = 0, compressedTotal = 0;
  for (const entry of index.captures) {
    exactKeys(entry, ENTRY_KEYS);
    if (!HASH.test(entry.sha256) || !HASH.test(entry.contentSha256)) fail('invalid archive hash');
    if (entry.path !== `history/${entry.sha256}.json.gz` || paths.has(entry.path)) fail('unsafe or duplicate archive path');
    paths.add(entry.path);
    for (const name of ['bytes', 'contentBytes']) if (!Number.isSafeInteger(entry[name]) || entry[name] <= 0 || entry[name] > MAX_CAPTURE_BYTES) fail('invalid archive byte length');
    if ((total += entry.contentBytes) > MAX_ARCHIVE_BYTES) fail('archive content bytes exceed output limit');
    if ((compressedTotal += entry.bytes) > MAX_ARCHIVE_BYTES) fail('archive compressed bytes exceed input limit');
    captureMetadata(entry, states, seen);
  }
  return index;
}

function representation(snapshot) {
  if (snapshot?.vintageArchive !== undefined && snapshot?.vintages !== undefined) fail('ambiguous inline and indexed capture history');
  if (snapshot?.vintageArchive !== undefined) return { indexed: true, captures: validateArchiveIndex(snapshot.vintageArchive).captures };
  return { indexed: false, captures: validateHistory(snapshot?.vintages ?? { version: 1, captures: [] }).captures };
}

function storedRoot(snapshot) {
  if (!object(snapshot)) fail('snapshot root must be a JSON object');
  representation(snapshot);
  return snapshot;
}

/** Canonical repository storage; strict JSON retains signed zero and property order. */
export function encodeStoredSnapshot(snapshot) {
  const content = Buffer.from(jsonValue(storedRoot(snapshot)));
  if (content.length > MAX_STORED_CONTENT_BYTES) fail('snapshot content bytes exceed output limit');
  const compressed = canonicalGzip(content);
  if (compressed.length > MAX_STORED_BYTES) fail('snapshot compressed bytes exceed input limit');
  return compressed;
}

export function decodeStoredSnapshot(bytes) {
  if (!(bytes instanceof Uint8Array)) fail('snapshot input must be bytes');
  if (bytes.length > MAX_STORED_BYTES) fail('snapshot compressed bytes exceed input limit');
  let content;
  try { content = gunzipSync(bytes, { maxOutputLength: MAX_STORED_CONTENT_BYTES }); }
  catch (error) { fail(`snapshot gzip decompression failed: ${error.message}`); }
  let snapshot;
  try { snapshot = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(content)); }
  catch (error) { fail(`snapshot UTF-8 or JSON is invalid: ${error.message}`); }
  storedRoot(snapshot);
  jsonValue(snapshot);
  return snapshot;
}

/** A previous capture and its descriptor may never change or disappear. */
export function assertArchivePrefix(previous, next) {
  const before = representation(previous), after = representation(next);
  if (after.captures.length < before.captures.length) fail('immutable history prefix was pruned');
  for (let i = 0; i < before.captures.length; i++) {
    const a = before.captures[i], b = after.captures[i];
    if (before.indexed === after.indexed) {
      if (!equal(a, b)) fail(`immutable history prefix changed at capture ${i}`);
    } else {
      const entry = before.indexed ? a : b, capture = before.indexed ? b : a;
      const content = Buffer.from(jsonValue(capture));
      if (entry.contentSha256 !== digest(content) || entry.contentBytes !== content.length || ['sourceId', 'capturedAt', 'recordedAt', 'baseline'].some(key => entry[key] !== capture[key])) fail(`immutable history prefix changed at capture ${i}`);
    }
  }
}

async function regularDirectory(directory) {
  const stat = await lstat(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) fail('archive directory must be a real directory, not a symbolic link');
}

async function readImmutable(directory, entry) {
  await regularDirectory(directory);
  await regularDirectory(path.join(directory, 'history'));
  const filename = path.join(directory, entry.path);
  const stat = await lstat(filename);
  if (stat.isSymbolicLink() || !stat.isFile()) fail('archive capture must be a regular file, not a symbolic link');
  if (stat.size !== entry.bytes) fail('archive compressed byte length mismatch');
  const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  let compressed;
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== entry.bytes) fail('archive file or byte length changed');
    compressed = Buffer.alloc(entry.bytes);
    let offset = 0;
    while (offset < compressed.length) {
      const { bytesRead } = await handle.read(compressed, offset, compressed.length - offset, offset);
      if (!bytesRead) fail('archive file became shorter during reading');
      offset += bytesRead;
    }
    const extra = Buffer.alloc(1);
    if ((await handle.read(extra, 0, 1, offset)).bytesRead) fail('archive file became longer during reading');
  } finally { await handle.close(); }
  if (compressed.length !== entry.bytes || digest(compressed) !== entry.sha256) fail('archive compressed hash or bytes mismatch');
  let content;
  try { content = gunzipSync(compressed, { maxOutputLength: entry.contentBytes }); }
  catch (error) { fail(`capture gzip decompression failed: ${error.message}`); }
  if (content.length !== entry.contentBytes || digest(content) !== entry.contentSha256) fail('archive content hash or bytes mismatch');
  let capture;
  try { capture = JSON.parse(content.toString('utf8')); }
  catch { fail('capture JSON is invalid'); }
  if (['sourceId', 'capturedAt', 'recordedAt', 'baseline'].some(key => capture?.[key] !== entry[key])) fail('capture metadata differs from archive index');
  return capture;
}

export async function loadSnapshotHistory(snapshot, { directory } = {}) {
  const current = representation(snapshot);
  if (!current.indexed) return snapshot?.vintages ?? { version: 1, captures: [] };
  if (typeof directory !== 'string') fail('archive directory is required');
  const captures = [];
  for (const entry of current.captures) captures.push(await readImmutable(directory, entry));
  return validateHistory({ version: 1, captures });
}

/** Native browser module; repeated value strings are declared once. */
export function snapshotModule(snapshot) {
  const counts = new Map();
  jsonValue(snapshot, counts);
  const aliases = new Map();
  for (const [value, count] of counts) if (count > 1 && value.length >= 64) aliases.set(value, `_s${aliases.size}`);
  const literal = value => {
    if (typeof value === 'string') return aliases.get(value) ?? JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(literal).join(',')}]`;
    if (object(value)) return `{${Object.keys(value).map(key => `${key === '__proto__' ? '["__proto__"]' : JSON.stringify(key)}:${literal(value[key])}`).join(',')}}`;
    return Object.is(value, -0) ? '-0' : JSON.stringify(value);
  };
  const declarations = [...aliases].map(([value, name]) => `const ${name}=${JSON.stringify(value)};`).join('\n');
  return `${declarations}${declarations ? '\n' : ''}export const snapshot=${literal(snapshot)};\n`;
}

async function writeImmutable(directory, entry, compressed) {
  const filename = path.join(directory, entry.path);
  let handle;
  try { handle = await open(filename, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o644); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // An existing content address is never overwritten, even on a retry.
    await readImmutable(directory, entry);
    return;
  }
  try { await handle.writeFile(compressed); await handle.sync(); }
  finally { await handle.close(); }
}

export async function writeStoredSnapshot(fullSnapshot, { destination, previous } = {}) {
  if (typeof destination !== 'string') fail('snapshot destination is required');
  const history = validateHistory(fullSnapshot?.vintages ?? { version: 1, captures: [] });
  if (fullSnapshot?.vintageArchive !== undefined) fail('write requires hydrated capture history');
  assertArchivePrefix(previous, fullSnapshot);
  const directory = path.dirname(path.resolve(destination));
  await regularDirectory(directory);
  try {
    const stat = await lstat(destination);
    if (stat.isSymbolicLink() || !stat.isFile()) fail('snapshot root must be a regular file');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try { await mkdir(path.join(directory, 'history')); }
  catch (error) { if (error.code !== 'EEXIST') throw error; }
  await regularDirectory(path.join(directory, 'history'));
  const prior = previous?.vintageArchive ? validateArchiveIndex(previous.vintageArchive).captures : [];
  const captures = [];
  for (let i = 0; i < history.captures.length; i++) {
    if (i < prior.length) {
      await readImmutable(directory, prior[i]);
      captures.push({ ...prior[i] });
      continue;
    }
    const capture = history.captures[i], content = Buffer.from(jsonValue(capture)), compressed = canonicalGzip(content);
    const sha256 = digest(compressed);
    const entry = { path: `history/${sha256}.json.gz`, sha256, contentSha256: digest(content), bytes: compressed.length, contentBytes: content.length, sourceId: capture.sourceId, capturedAt: capture.capturedAt, recordedAt: capture.recordedAt, baseline: capture.baseline };
    await writeImmutable(directory, entry, compressed);
    captures.push(entry);
  }
  const { vintages: _history, historyArchive: _publicArchive, ...current } = fullSnapshot;
  const stored = { ...current, vintageArchive: { version: 1, captures } };
  validateArchiveIndex(stored.vintageArchive);
  assertArchivePrefix(previous, stored);
  const temporary = path.join(directory, `.${path.basename(destination)}.${randomUUID()}.tmp`);
  try {
    const handle = await open(temporary, 'wx', 0o644);
    try {
      await handle.writeFile(destination.endsWith('.json.gz') ? encodeStoredSnapshot(stored) : snapshotModule(stored));
      await handle.sync();
    }
    finally { await handle.close(); }
    await rename(temporary, destination);
  } catch (error) { await unlink(temporary).catch(() => {}); throw error; }
  return stored;
}

export function browserSnapshotAssets(fullSnapshot) {
  if (fullSnapshot?.vintageArchive !== undefined && fullSnapshot?.vintages === undefined) fail('browser projection requires hydrated capture history');
  const history = validateHistory(fullSnapshot?.vintages ?? { version: 1, captures: [] });
  const groups = new Map(), files = new Map();
  let latestCaptureAt = null, contentBytes = 0, compressedBytes = 0;
  history.captures.forEach((capture, index) => {
    if (!groups.has(capture.sourceId)) groups.set(capture.sourceId, { captureIndexes: [], captures: [], seriesIds: new Set(), latestCaptureAt: null });
    const group = groups.get(capture.sourceId), normalized = normalizeVintageTimestamp(capture.capturedAt);
    group.captureIndexes.push(index);
    group.captures.push(capture);
    for (const id of [...Object.keys(capture.series), ...capture.removedSeries]) group.seriesIds.add(id);
    if (group.latestCaptureAt === null || normalized > group.latestCaptureAt) group.latestCaptureAt = normalized;
    if (latestCaptureAt === null || normalized > latestCaptureAt) latestCaptureAt = normalized;
  });
  const descriptor = (bytes, extension, format='json') => {
    if(bytes.length>=MAX_STORED_BYTES)fail('public history resource exceeds the 20 MiB file limit');
    if(extension==='.gz'&&(compressedBytes+=bytes.length)>MAX_ARCHIVE_BYTES)fail('public archive compressed bytes exceed output limit');
    const sha256 = digest(bytes), basename = `history-${sha256}.${format}${extension}`;
    files.set(basename, bytes);
    return { url: `./${basename}`, sha256, bytes: bytes.length };
  };
  const sources = Object.fromEntries([...groups.keys()].sort().map(sourceId => {
    const group = groups.get(sourceId);
    const fallback = Buffer.from(jsonValue({ version: 1, sourceId, captureIndexes: group.captureIndexes, captures: group.captures }));
    if ((contentBytes += fallback.length) > MAX_ARCHIVE_BYTES) fail('public archive content bytes exceed output limit');
    const compressed=fallback.length<MAX_STORED_BYTES?canonicalGzip(fallback):null;
    let resources;
    if(compressed&&compressed.length<MAX_STORED_BYTES){
      resources={compressed:descriptor(compressed,'.gz'),fallback:descriptor(fallback,'')};
    }else{
      const parts=[];
      for(let offset=0;offset<fallback.length;offset+=BROWSER_HISTORY_PART_BYTES){
        const bytes=fallback.subarray(offset,offset+BROWSER_HISTORY_PART_BYTES);
        parts.push({compressed:descriptor(canonicalGzip(bytes),'.gz','bin'),fallback:descriptor(bytes,'','bin')});
      }
      resources={contentBytes:fallback.length,contentSha256:digest(fallback),parts};
    }
    return [sourceId,{
      captureCount:group.captures.length,latestCaptureAt:group.latestCaptureAt,seriesIds:[...group.seriesIds].sort(),...resources,
    }];
  }));
  const { vintages: _history, vintageArchive: _storedArchive, historyArchive: _oldArchive, ...current } = fullSnapshot;
  const snapshot = { ...current, historyArchive: { version: 2, captureCount: history.captures.length, latestCaptureAt, sources } };
  const projected = currentSnapshotAssets(snapshot, snapshotModule);
  for (const [name, bytes] of projected.files) files.set(name, bytes);
  return { ...projected, files };
}
