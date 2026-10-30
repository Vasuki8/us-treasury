import { asKnownOn, normalizeVintageTimestamp, revisionHistory } from './vintages.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(value);
const bytesOf = value => value instanceof Uint8Array ? value : new Uint8Array(value);
const hex = value => [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;
const MAX_PART_BYTES = 20 * 1024 * 1024 - 1;

async function readBounded(stream, limit) {
  const reader = stream.getReader(), chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = bytesOf(value);
      length += chunk.byteLength;
      if (length > limit) {
        await reader.cancel().catch(() => {});
        throw new Error('History archive exceeds declared byte length');
      }
      chunks.push(chunk);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

const nativeDecompress = typeof globalThis.DecompressionStream === 'function'
  ? (bytes, limit) => readBounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')), limit)
  : null;

function resource(entry, extension, maximum = MAX_ARCHIVE_BYTES) {
  if (!object(entry) || !new RegExp(`^\\./history-[a-f0-9]{64}\\.${extension}$`).test(entry.url)
    || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes)
    || entry.bytes < 1 || entry.bytes > maximum) throw new Error('Invalid history archive resource descriptor');
  const base = new URL('./', import.meta.url), url = new URL(entry.url, import.meta.url);
  if (url.origin !== base.origin || new URL('./', url).href !== base.href) throw new Error('History archive must remain in this deployment');
  return { ...entry, url };
}

function sourceResources(entry) {
  if (!Object.hasOwn(entry,'parts')) {
    if (Object.hasOwn(entry,'contentBytes') || Object.hasOwn(entry,'contentSha256')) throw new Error('Ambiguous history source descriptor');
    return { compressed:resource(entry.compressed,'json\\.gz'), fallback:resource(entry.fallback,'json') };
  }
  if (Object.hasOwn(entry,'compressed') || Object.hasOwn(entry,'fallback') || !Array.isArray(entry.parts)
    || entry.parts.length < 2 || entry.parts.length > 100000 || !Number.isSafeInteger(entry.contentBytes)
    || entry.contentBytes < 1 || entry.contentBytes > MAX_ARCHIVE_BYTES || !/^[a-f0-9]{64}$/.test(entry.contentSha256)) {
    throw new Error('Invalid multipart history source descriptor');
  }
  let contentBytes = 0;
  const parts = entry.parts.map(part => {
    if (!object(part) || Object.keys(part).length !== 2 || !Object.hasOwn(part,'compressed') || !Object.hasOwn(part,'fallback')) {
      throw new Error('Invalid history part descriptor');
    }
    const resources = { compressed:resource(part.compressed,'bin\\.gz',MAX_PART_BYTES), fallback:resource(part.fallback,'bin',MAX_PART_BYTES) };
    contentBytes += resources.fallback.bytes;
    return resources;
  });
  if (contentBytes !== entry.contentBytes) throw new Error('Multipart history content byte total mismatch');
  return { parts };
}

function validateDescriptor(descriptor) {
  if (!object(descriptor) || descriptor.version !== 2 || !Number.isSafeInteger(descriptor.captureCount) || descriptor.captureCount < 0 || descriptor.captureCount > 100000 || !object(descriptor.sources)) throw new Error('Unsupported or unavailable history archive');
  if (descriptor.captureCount === 0 ? descriptor.latestCaptureAt !== null : normalizeVintageTimestamp(descriptor.latestCaptureAt) !== descriptor.latestCaptureAt) throw new Error('Invalid latest history capture timestamp');
  const sources = new Map(), seriesSources = new Map();
  let captureCount = 0, compressedBytes = 0, fallbackBytes = 0, latest = null;
  for (const [id, entry] of Object.entries(descriptor.sources)) {
    if (!identifier(id) || !object(entry) || !Number.isSafeInteger(entry.captureCount) || entry.captureCount < 1 || entry.captureCount > descriptor.captureCount
      || normalizeVintageTimestamp(entry.latestCaptureAt) !== entry.latestCaptureAt || !Array.isArray(entry.seriesIds) || !entry.seriesIds.every(identifier)
      || new Set(entry.seriesIds).size !== entry.seriesIds.length) throw new Error('Invalid history source descriptor');
    captureCount += entry.captureCount;
    latest = latest === null || entry.latestCaptureAt > latest ? entry.latestCaptureAt : latest;
    const resources = sourceResources(entry);
    for (const part of resources.parts ?? [resources]) {
      compressedBytes += part.compressed.bytes;
      fallbackBytes += part.fallback.bytes;
    }
    if (compressedBytes > MAX_ARCHIVE_BYTES || fallbackBytes > MAX_ARCHIVE_BYTES) throw new Error('History manifest resources exceed the archive byte limit');
    sources.set(id, { ...entry, ...resources });
    for (const seriesId of entry.seriesIds) {
      if (!seriesSources.has(seriesId)) seriesSources.set(seriesId, []);
      seriesSources.get(seriesId).push(id);
    }
  }
  if (captureCount !== descriptor.captureCount || latest !== descriptor.latestCaptureAt) throw new Error('History manifest capture total or latest timestamp mismatch');
  return { sources, seriesSources, captureCount, latestCaptureAt:latest };
}

function validateHistory(history, sourceId, descriptor, captureCount) {
  if (!object(history) || history.version !== 1 || history.sourceId !== sourceId || !Array.isArray(history.captures) || history.captures.length !== descriptor.captureCount
    || !Array.isArray(history.captureIndexes) || history.captureIndexes.length !== history.captures.length) throw new Error('History source identity, capture count or format mismatch');
  let previousIndex = -1;
  for (const index of history.captureIndexes) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= captureCount || index <= previousIndex) throw new Error('Invalid history capture index');
    previousIndex = index;
  }
  const seriesIds = new Set();
  let latest = null;
  for (const capture of history.captures) {
    if (!object(capture) || capture.sourceId !== sourceId || typeof capture.baseline !== 'boolean' || !object(capture.metadata)
      || !Array.isArray(capture.provenance) || !object(capture.series) || !Array.isArray(capture.removedSeries)
      || !capture.removedSeries.every(identifier)) throw new Error('Invalid history capture structure');
    const capturedAt = normalizeVintageTimestamp(capture.capturedAt), recordedAt = normalizeVintageTimestamp(capture.recordedAt);
    if (capturedAt > recordedAt) throw new Error('History capture predates its retrieval');
    latest = latest === null || capturedAt > latest ? capturedAt : latest;
    for (const [id, delta] of Object.entries(capture.series)) {
      if (!identifier(id) || !object(delta) || !object(delta.metadata) || !Array.isArray(delta.upserts) || !Array.isArray(delta.deletedDates)) throw new Error('Invalid history series delta');
      seriesIds.add(id);
    }
    for (const id of capture.removedSeries) seriesIds.add(id);
  }
  if (latest !== descriptor.latestCaptureAt) throw new Error('Latest history capture mismatch');
  if (seriesIds.size !== descriptor.seriesIds.length || !descriptor.seriesIds.every(id => seriesIds.has(id))) throw new Error('History source series mapping mismatch');
  // Replay validates immutable keys, baselines, observation dates and finite values.
  // It runs only after an explicit history request, never during ordinary startup.
  if (latest !== null) asKnownOn(history, latest);
  return history;
}

/** Verify and cache only the source archives needed by an explicitly selected series. */
export function createHistoryLoader(descriptor, { fetchImpl = globalThis.fetch, cryptoImpl = globalThis.crypto, decompress = nativeDecompress } = {}) {
  let manifest = null, manifestError = null;
  const sources = new Map(), selections = new Map(), indexes = new Map();

  function selection(seriesId) {
    if (manifestError) throw manifestError;
    if (!manifest) {
      try { manifest = validateDescriptor(descriptor); }
      catch (error) { manifestError = error; throw error; }
      for (const [id, entry] of manifest.sources) sources.set(id, { descriptor:entry, status:'idle', history:null, error:null, promise:null });
    }
    if (!identifier(seriesId)) throw new Error('Invalid history series ID');
    if (!selections.has(seriesId)) selections.set(seriesId, { sourceIds:manifest.seriesSources.get(seriesId) ?? [], history:null, promise:null, inFlight:null, revisions:null });
    return selections.get(seriesId);
  }

  function stateFor(selected) {
    const entries = selected.sourceIds.map(id => sources.get(id));
    const failed = entries.find(entry => entry.status === 'error');
    const status = failed ? 'error' : entries.every(entry => entry.status === 'ready') ? 'ready' : entries.some(entry => entry.status === 'loading') ? 'loading' : 'idle';
    if (status === 'ready' && !selected.history) {
      const captures = selected.sourceIds.flatMap(id => {
        const history = sources.get(id).history;
        return history.captures.map((capture, index) => ({ capture, index:history.captureIndexes[index] }));
      }).sort((a, b) => a.index - b.index).map(item => item.capture);
      selected.history = { version:1, captures };
    }
    return { status, history:status === 'ready' ? selected.history : null, error:failed?.error ?? null, sourceIds:selected.sourceIds, latestCaptureAt:manifest.latestCaptureAt };
  }

  function getState(seriesId = 'gdp') {
    try { return stateFor(selection(seriesId)); }
    catch (error) { return { status:'error', history:null, error, sourceIds:[], latestCaptureAt:manifest?.latestCaptureAt ?? null }; }
  }

  async function verify(bytes, expected) {
    if (bytes.byteLength !== expected.bytes) throw new Error('History archive byte length mismatch');
    if (!cryptoImpl?.subtle) throw new Error('History archive integrity verification is unavailable');
    if (hex(await cryptoImpl.subtle.digest('SHA-256', bytes)) !== expected.sha256) throw new Error('History archive SHA256 mismatch');
  }
  async function retrieveBytes(resources) {
    const selected = decompress ? resources.compressed : resources.fallback;
    const response = await fetchImpl(selected.url, { credentials:'same-origin', redirect:'error' });
    if (!response.ok) throw new Error(`History archive request failed (HTTP ${response.status ?? 'unknown'})`);
    if (response.url && new URL(response.url).href !== selected.url.href) throw new Error('History archive response left this deployment');
    const fetched = response.body?.getReader ? await readBounded(response.body, selected.bytes) : bytesOf(await response.arrayBuffer());
    await verify(fetched, selected);
    const decoded = decompress ? bytesOf(await decompress(fetched, resources.fallback.bytes)) : fetched;
    if (decompress) await verify(decoded, resources.fallback);
    return decoded;
  }
  async function retrieve(sourceId, entry) {
    const resources = entry.descriptor;
    let decoded;
    if (resources.parts) {
      const chunks = [];
      for (const part of resources.parts) chunks.push(await retrieveBytes(part));
      decoded = new Uint8Array(resources.contentBytes);
      let offset = 0;
      for (const chunk of chunks) { decoded.set(chunk,offset); offset += chunk.byteLength; }
      await verify(decoded,{ bytes:resources.contentBytes, sha256:resources.contentSha256 });
    } else decoded = await retrieveBytes(resources);
    const history = validateHistory(JSON.parse(new TextDecoder('utf-8', { fatal:true }).decode(decoded)), sourceId, resources, manifest.captureCount);
    // An index belongs to exactly one source, including sources verified by an
    // earlier selection. Check the whole group before retaining any of its keys.
    for (const index of history.captureIndexes) if (indexes.has(index) && indexes.get(index) !== sourceId) throw new Error('Duplicate history capture index across sources');
    for (const index of history.captureIndexes) indexes.set(index, sourceId);
    Object.assign(entry, { status:'ready', history, error:null });
    return history;
  }

  function loadSource(sourceId, retry) {
    const entry = sources.get(sourceId);
    if (entry.status === 'ready' || entry.status === 'loading') return entry.promise;
    if (entry.status === 'error' && !retry) return Promise.reject(entry.error);
    Object.assign(entry, { status:'loading', history:null, error:null });
    entry.promise = retrieve(sourceId, entry).catch(error => {
      Object.assign(entry, { status:'error', history:null, error });
      throw error;
    });
    return entry.promise;
  }

  return {
    getState,
    load(seriesId = 'gdp', { retry = false } = {}) {
      let selected;
      try { selected = selection(seriesId); }
      catch (error) { return Promise.reject(error); }
      if (selected.inFlight) return selected.inFlight;
      const state = stateFor(selected);
      if (state.status === 'ready') return selected.promise ??= Promise.resolve(state.history);
      if (state.status === 'error' && !retry) return Promise.reject(state.error);
      selected.inFlight = Promise.all(selected.sourceIds.map(id => loadSource(id, retry))).then(() => {
        const ready = stateFor(selected);
        if (ready.status !== 'ready') throw ready.error ?? new Error('History archive is not ready');
        selected.inFlight = null;
        return ready.history;
      }, error => {
        selected.inFlight = null;
        selected.promise = null;
        throw error;
      });
      selected.promise = selected.inFlight;
      return selected.inFlight;
    },
    revisions(seriesId) {
      const selected = selection(seriesId), state = stateFor(selected);
      if (state.status !== 'ready') throw new Error('History archive is not ready');
      return selected.revisions ??= revisionHistory(state.history, seriesId);
    },
  };
}
