import { asKnownOn, normalizeVintageTimestamp, revisionHistory } from './vintages.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(value);
const bytesOf = value => value instanceof Uint8Array ? value : new Uint8Array(value);
const hex = value => [...new Uint8Array(value)].map(byte => byte.toString(16).padStart(2, '0')).join('');
const MAX_ARCHIVE_BYTES = 512 * 1024 * 1024;

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

function resource(entry, extension) {
  if (!object(entry) || !new RegExp(`^\\./history-[a-f0-9]{64}\\.${extension}$`).test(entry.url)
    || !/^[a-f0-9]{64}$/.test(entry.sha256) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || entry.bytes > MAX_ARCHIVE_BYTES) throw new Error('Invalid history archive resource descriptor');
  const base = new URL('./', import.meta.url), url = new URL(entry.url, import.meta.url);
  if (url.origin !== base.origin || new URL('./', url).href !== base.href) throw new Error('History archive must remain in this deployment');
  return { ...entry, url };
}

function validateDescriptor(descriptor) {
  if (!object(descriptor) || descriptor.version !== 1 || !Number.isSafeInteger(descriptor.captureCount) || descriptor.captureCount < 0 || descriptor.captureCount > 100000) throw new Error('Unsupported or unavailable history archive');
  if (descriptor.captureCount === 0 ? descriptor.latestCaptureAt !== null : normalizeVintageTimestamp(descriptor.latestCaptureAt) !== descriptor.latestCaptureAt) throw new Error('Invalid latest history capture timestamp');
  return { compressed:resource(descriptor.compressed, 'json\\.gz'), fallback:resource(descriptor.fallback, 'json') };
}

function validateHistory(history, descriptor) {
  if (!object(history) || history.version !== 1 || !Array.isArray(history.captures) || history.captures.length !== descriptor.captureCount) throw new Error('History archive capture count or format mismatch');
  let latest = null;
  for (const capture of history.captures) {
    if (!object(capture) || !identifier(capture.sourceId) || typeof capture.baseline !== 'boolean' || !object(capture.metadata)
      || !Array.isArray(capture.provenance) || !object(capture.series) || !Array.isArray(capture.removedSeries)
      || !capture.removedSeries.every(identifier)) throw new Error('Invalid history capture structure');
    const capturedAt = normalizeVintageTimestamp(capture.capturedAt), recordedAt = normalizeVintageTimestamp(capture.recordedAt);
    if (capturedAt > recordedAt) throw new Error('History capture predates its retrieval');
    latest = latest === null || capturedAt > latest ? capturedAt : latest;
    for (const [id, delta] of Object.entries(capture.series)) {
      if (!identifier(id) || !object(delta) || !object(delta.metadata) || !Array.isArray(delta.upserts) || !Array.isArray(delta.deletedDates)) throw new Error('Invalid history series delta');
    }
  }
  if (latest !== descriptor.latestCaptureAt) throw new Error('Latest history capture mismatch');
  // Replay validates immutable keys, baselines, observation dates and finite values.
  // It runs only after an explicit history request, never during ordinary startup.
  if (latest !== null) asKnownOn(history, latest);
  return history;
}

/** One verified archive per deployment, loaded only when a history view needs it. */
export function createHistoryLoader(descriptor, { fetchImpl = globalThis.fetch, cryptoImpl = globalThis.crypto, decompress = nativeDecompress } = {}) {
  let state = { status:'idle', history:null, error:null }, inFlight = null;
  const revisions = new Map();
  async function verify(bytes, expected) {
    if (bytes.byteLength !== expected.bytes) throw new Error('History archive byte length mismatch');
    if (!cryptoImpl?.subtle) throw new Error('History archive integrity verification is unavailable');
    if (hex(await cryptoImpl.subtle.digest('SHA-256', bytes)) !== expected.sha256) throw new Error('History archive SHA256 mismatch');
  }
  async function retrieve() {
    const resources = validateDescriptor(descriptor), selected = decompress ? resources.compressed : resources.fallback;
    const response = await fetchImpl(selected.url, { credentials:'same-origin', redirect:'error' });
    if (!response.ok) throw new Error(`History archive request failed (HTTP ${response.status ?? 'unknown'})`);
    if (response.url && new URL(response.url).href !== selected.url.href) throw new Error('History archive response left this deployment');
    const fetched = response.body?.getReader ? await readBounded(response.body, selected.bytes) : bytesOf(await response.arrayBuffer());
    await verify(fetched, selected);
    const decoded = decompress ? bytesOf(await decompress(fetched, resources.fallback.bytes)) : fetched;
    if (decompress) await verify(decoded, resources.fallback);
    const history = validateHistory(JSON.parse(new TextDecoder('utf-8', { fatal:true }).decode(decoded)), descriptor);
    state = { status:'ready', history, error:null };
    return history;
  }
  return {
    getState:() => state,
    load({ retry = false } = {}) {
      if (state.status === 'ready' || state.status === 'loading') return inFlight;
      if (state.status === 'error' && !retry) return Promise.reject(state.error);
      state = { status:'loading', history:null, error:null };
      inFlight = retrieve().catch(error => {
        state = { status:'error', history:null, error };
        throw error;
      });
      return inFlight;
    },
    revisions(seriesId) {
      if (state.status !== 'ready') throw new Error('History archive is not ready');
      if (!revisions.has(seriesId)) revisions.set(seriesId, revisionHistory(state.history, seriesId));
      return revisions.get(seriesId);
    },
  };
}
