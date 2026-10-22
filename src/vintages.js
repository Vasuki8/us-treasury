/** Immutable local retrieval history, not a reconstruction of historical releases. */
const measurementFields = ['name', 'unit', 'frequency', 'format', 'precision', 'adjustment', 'definition', 'observationType', 'periodType', 'dateConvention'];
const sharedMetadata = ['sourceNotice', 'licenseUrl', 'termsUrl', 'redistributionNotice', 'attribution', 'sourceTitle', 'sourceUrls', ...measurementFields, 'measure'];
const sourceFields = ['agency', 'sourceUrl', 'coverageStart', 'coverageEnd', 'coverageNote', 'structuralBreak', ...sharedMetadata];
const seriesFields = ['sourceIds', 'sourceUrl', 'calculation', 'dataStatus', 'coverageNote', ...sharedMetadata];
// Existing providers keep their historical normalization contract. RESCONST is
// newly admitted and needs its originating program in replayed rights metadata.
const housingSeriesFields = [...seriesFields, 'programName'];
const advanceSeriesFields = [...seriesFields, 'publicationNote'];
const seriesFieldsFor = source => source === 'housing' ? housingSeriesFields : source === 'dolAdvance' ? advanceSeriesFields : seriesFields;
const clone = value => JSON.parse(JSON.stringify(value));
const own = (value, key) => Object.hasOwn(value, key);

export function normalizeVintageTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) throw new Error('Invalid vintage timestamp');
  const canonical = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  const parsed = new Date(canonical);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== canonical) throw new Error('Invalid vintage timestamp date');
  return canonical;
}
const timestamp = normalizeVintageTimestamp;

function periodDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid vintage observation date');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid vintage observation date');
  return value;
}

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  throw new Error('Invalid non-finite or unsupported vintage value');
}
const equal = (a, b) => canonical(a) === canonical(b);
const metadata = (value, keys) => Object.fromEntries(keys.filter(key => own(value, key) && value[key] !== undefined).map(key => [key, clone(value[key])]));

function sourceId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(value)) throw new Error('Invalid vintage source or series ID');
  return value;
}

function observations(rows) {
  if (!Array.isArray(rows)) throw new Error('Invalid vintage observations');
  const seen = new Set();
  return rows.map(row => {
    periodDate(row?.date);
    if (seen.has(row.date)) throw new Error('Duplicate vintage observation date');
    seen.add(row.date);
    if (row.value !== null && (typeof row.value !== 'number' || !Number.isFinite(row.value))) throw new Error('Invalid non-finite vintage observation value');
    canonical(row);
    return clone(row);
  }).sort((a, b) => a.date.localeCompare(b.date));
}

function normalizedSource(source, id, seriesMetadata = {}) {
  sourceId(id);
  if (source.id !== undefined && source.id !== id) throw new Error('Vintage source identity mismatch');
  const fetchedAt = timestamp(source.fetchedAt);
  if (!source.series || typeof source.series !== 'object' || Array.isArray(source.series)) throw new Error('Invalid vintage source series');
  const series = Object.fromEntries(Object.entries(source.series).map(([key, item]) => {
    sourceId(key);
    if (!item || typeof item !== 'object') throw new Error('Invalid vintage series');
    const defaults = own(seriesMetadata, key) ? metadata(seriesMetadata[key] ?? {}, measurementFields) : {};
    return [key, { ...defaults, ...metadata(item, seriesFieldsFor(id)), observations: observations(item.observations) }];
  }));
  const result = { id, fetchedAt, ...metadata(source, sourceFields), provenance: clone(source.provenance ?? []), series };
  canonical(result);
  return result;
}

function captures(vintages) {
  if (vintages === null || vintages === undefined) return [];
  if (vintages.version !== 1 || !Array.isArray(vintages.captures)) throw new Error('Unsupported vintage history format');
  const seen = new Set();
  for (const item of vintages.captures) {
    sourceId(item.sourceId); timestamp(item.recordedAt);
    const key = `${item.sourceId}|${timestamp(item.capturedAt)}`;
    if (seen.has(key)) throw new Error('Duplicate immutable vintage capture key');
    seen.add(key);
    if (!item.series || typeof item.series !== 'object' || Array.isArray(item.series) || !Array.isArray(item.removedSeries)) throw new Error('Invalid vintage capture structure');
  }
  return vintages.captures;
}

function ordered(vintages) {
  return captures(vintages).map(item => ({ ...item, capturedAt: timestamp(item.capturedAt), recordedAt: timestamp(item.recordedAt) })).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.sourceId.localeCompare(b.sourceId));
}

/** Apply a validated capture to private replay state, never to retained archive objects. */
export function applyVintageCapture(sources, capture) {
  if (!sources[capture.sourceId] && !capture.baseline) throw new Error('Vintage delta is missing its baseline');
  const source = sources[capture.sourceId] ?? { id: capture.sourceId, series: {} };
  for (const key of sourceFields) delete source[key];
  Object.assign(source, clone(capture.metadata ?? {}), { fetchedAt: capture.capturedAt, provenance: clone(capture.provenance ?? []) });
  for (const id of capture.removedSeries) delete source.series[sourceId(id)];
  for (const [id, delta] of Object.entries(capture.series)) {
    sourceId(id);
    const original = source.series[id]?.observations ?? [];
    const byDate = new Map(original.map(row => [row.date, row]));
    for (const value of delta.deletedDates ?? []) byDate.delete(periodDate(value));
    for (const row of observations(delta.upserts ?? [])) byDate.set(row.date, row);
    source.series[id] = { ...clone(delta.metadata ?? {}), observations: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  }
  sources[capture.sourceId] = source;
}

/** Inclusive cutoff by actual source retrieval; publication clocks do not control knowledge. */
export function asKnownOn(vintages, cutoffISOString) {
  const cutoff = timestamp(cutoffISOString), sources = {};
  for (const item of ordered(vintages)) {
    if (item.capturedAt > cutoff) continue;
    applyVintageCapture(sources, item);
  }
  return { sources };
}

function deltaCapture(previous, next, recordedAt) {
  const series = {}, removedSeries = Object.keys(previous?.series ?? {}).filter(id => !own(next.series, id)).sort();
  const fields = seriesFieldsFor(next.id);
  for (const [id, current] of Object.entries(next.series)) {
    const prior = previous?.series[id];
    const before = new Map((prior?.observations ?? []).map(row => [row.date, row]));
    const after = new Map(current.observations.map(row => [row.date, row]));
    const upserts = current.observations.filter(row => !before.has(row.date) || !equal(before.get(row.date), row));
    const deletedDates = [...before.keys()].filter(date => !after.has(date)).sort();
    const nextMetadata = metadata(current, fields);
    if (!prior || upserts.length || deletedDates.length || !equal(metadata(prior, fields), nextMetadata)) series[id] = { metadata: nextMetadata, upserts: clone(upserts), deletedDates };
  }
  return { sourceId: next.id, capturedAt: next.fetchedAt, recordedAt, baseline: !previous, metadata: metadata(next, sourceFields), provenance: clone(next.provenance), series, removedSeries };
}

/** Append baseline plus changed observation records; never edit a retained capture. */
export function recordVintages(previousVintages, previousSources = {}, newSources = {}, { checkedAt = new Date().toISOString(), seriesMetadata = {} } = {}) {
  const recordedAt = timestamp(checkedAt);
  const result = { version: 1, captures: clone(captures(previousVintages)) };
  const append = (input, id) => {
    if (!input?.fetchedAt) return;
    const fetchedAt = timestamp(input.fetchedAt);
    const history = ordered(result).filter(item => item.sourceId === id);
    const sameKey = history.find(item => item.capturedAt === fetchedAt);
    const known = sameKey ? asKnownOn(result, fetchedAt).sources[id] : null;
    // Current registry changes apply only to genuinely new retrievals. A retained
    // key keeps its captured definitions when the source omitted those fields.
    const next = normalizedSource(input, id, known ? known.series : seriesMetadata);
    if (next.fetchedAt > recordedAt) throw new Error('Vintage capture retrieval is after its recorded time');
    if (sameKey) {
      if (!equal(known, next)) throw new Error('Immutable vintage capture collision: same source retrieval key has different data');
      return;
    }
    const last = [...history].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)).at(-1);
    if (last && next.fetchedAt < last.capturedAt) throw new Error('Cannot append an older vintage retrieval after an existing source capture');
    const previous = last ? asKnownOn(result, last.capturedAt).sources[id] : null;
    result.captures.push(deltaCapture(previous, next, recordedAt));
  };
  // Prior committed values are genuine old retrievals, never inferred first releases.
  for (const [id, source] of Object.entries(previousSources)) if (!result.captures.some(item => item.sourceId === id)) append(source, id);
  for (const [id, source] of Object.entries(newSources)) append(source, id);
  return result;
}

const comparisonFields = ['unit', 'frequency', 'adjustment', 'definition', 'observationType', 'periodType', 'dateConvention', 'measure', 'calculation'];
export function vintageMeasurementsComparable(previous = {}, current = {}) {
  return equal(metadata(previous, comparisonFields), metadata(current, comparisonFields));
}

/** Only observed value changes are revisions; coverage removals are separate facts. */
export function revisionHistory(vintages, seriesId) {
  sourceId(seriesId);
  const periods = new Map(), seriesMetadata = new Map();
  for (const capture of ordered(vintages)) {
    if (capture.removedSeries.includes(seriesId)) seriesMetadata.delete(capture.sourceId);
    const delta = capture.series[seriesId];
    if (delta) seriesMetadata.set(capture.sourceId, delta.metadata ?? {});
    const measurement = metadata({ ...capture.metadata, ...seriesMetadata.get(capture.sourceId) }, [...measurementFields, 'measure', 'calculation']);
    if (capture.removedSeries.includes(seriesId)) for (const row of periods.values()) if (row.sourceId === capture.sourceId) row.available = false;
    for (const date of delta?.deletedDates ?? []) {
      const prior = periods.get(`${capture.sourceId}|${date}`);
      if (prior) prior.available = false;
    }
    for (const row of observations(delta?.upserts ?? [])) {
      const key = `${capture.sourceId}|${row.date}`, previous = periods.get(key);
      const current = { capturedAt: capture.capturedAt, value: row.value };
      if (!previous) periods.set(key, { sourceId: capture.sourceId, seriesId, date: row.date, firstCaptured: current, firstMetadata: clone(measurement), latest: current, latestMetadata: clone(measurement), changes: [], available: true });
      else {
        if (previous.latest.value !== row.value) previous.changes.push({ capturedAt: capture.capturedAt, previousCapturedAt: previous.latest.capturedAt, previousValue: previous.latest.value, previousMetadata: clone(previous.latestMetadata), value: row.value, metadata: clone(measurement), measurementComparable: vintageMeasurementsComparable(previous.latestMetadata, measurement), kind: 'observed-value-change', reason: 'unknown' });
        previous.latest = current;
        previous.available = true;
      }
    }
    // A compact unchanged capture still confirms every retained current value.
    for (const row of periods.values()) if (row.sourceId === capture.sourceId && row.available) {
      row.latest = { capturedAt: capture.capturedAt, value: row.latest.value };
      row.latestMetadata = clone(measurement);
    }
  }
  return [...periods.values()].filter(row => row.changes.length).sort((a, b) => a.date.localeCompare(b.date) || a.sourceId.localeCompare(b.sourceId));
}
