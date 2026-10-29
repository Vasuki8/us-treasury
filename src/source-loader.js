const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(value);
const importer = url => import(url);
const MAX_SOURCE_BYTES = 64 * 1024 * 1024;

function validateDescriptor(descriptor) {
  if (!object(descriptor) || descriptor.version !== 1 || !object(descriptor.sources)) throw new Error('Unsupported current source archive');
  const entries = new Map();
  for (const [sourceId, entry] of Object.entries(descriptor.sources)) {
    if (!identifier(sourceId) || !object(entry) || !/^[a-f0-9]{64}$/.test(entry.sha256)
      || entry.url !== `./source-${entry.sha256}.js` || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1
      || entry.bytes > MAX_SOURCE_BYTES || !Array.isArray(entry.seriesIds) || !entry.seriesIds.every(identifier)
      || new Set(entry.seriesIds).size !== entry.seriesIds.length || !Number.isSafeInteger(entry.observationCount)
      || entry.observationCount < 0 || entry.observationCount > 1000000) throw new Error('Invalid current source descriptor');
    const base = new URL('./', import.meta.url), url = new URL(import.meta.resolve(entry.url));
    if (url.origin !== base.origin || new URL('./', url).href !== base.href) throw new Error('Current source must remain in this deployment');
    entries.set(sourceId, { descriptor:entry, url, status:'idle', source:null, error:null, promise:null, attempt:0 });
  }
  return entries;
}

function validateSource(source, sourceId, descriptor) {
  if (!object(source) || source.id !== sourceId) throw new Error('Current source identity or schema mismatch');
  const series = source.series === undefined ? {} : source.series;
  if (!object(series)) throw new Error('Current source identity or schema mismatch');
  const ids = Object.keys(series);
  if (ids.length !== descriptor.seriesIds.length || !ids.every(id => descriptor.seriesIds.includes(id))) {
    throw new Error('Current source series mapping mismatch');
  }
  let count = 0;
  for (const item of Object.values(series)) {
    if (!object(item) || item.observations !== undefined && !Array.isArray(item.observations)) {
      throw new Error('Invalid current source observations');
    }
    count += item.observations?.length ?? 0;
  }
  if (count !== descriptor.observationCount) throw new Error('Current source observation count mismatch');
  return source;
}

/** Native same-deployment modules retain complete source inputs and original observation fields. */
export function createSourceLoader(descriptor, { importer:importImpl = importer } = {}) {
  if (descriptor == null) return {
    getState:() => ({ status:'ready', source:null, error:null }),
    load:() => Promise.resolve(null),
  };
  let entries = null, manifestError = null;
  function selected(sourceId) {
    if (manifestError) throw manifestError;
    if (!entries) {
      try { entries = validateDescriptor(descriptor); }
      catch (error) { manifestError = error; throw error; }
    }
    if (!identifier(sourceId) || !entries.has(sourceId)) throw new Error('Unknown current source');
    return entries.get(sourceId);
  }
  return {
    getState(sourceId) {
      try {
        const entry = selected(sourceId);
        return { status:entry.status, source:entry.source, error:entry.error };
      } catch (error) { return { status:'error', source:null, error }; }
    },
    load(sourceId, { retry = false } = {}) {
      let entry;
      try { entry = selected(sourceId); }
      catch (error) { return Promise.reject(error); }
      if (entry.status === 'ready' || entry.status === 'loading') return entry.promise;
      if (entry.status === 'error' && !retry) return Promise.reject(entry.error);
      const url = new URL(entry.url);
      if (entry.attempt++) url.searchParams.set('retry', String(entry.attempt));
      Object.assign(entry, { status:'loading', source:null, error:null });
      entry.promise = Promise.resolve().then(() => importImpl(url.href)).then(module => {
        const source = validateSource(module?.snapshot?.source, sourceId, entry.descriptor);
        Object.assign(entry, { status:'ready', source, error:null });
        return source;
      }).catch(error => {
        Object.assign(entry, { status:'error', source:null, error });
        throw error;
      });
      return entry.promise;
    },
  };
}
