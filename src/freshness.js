const targets = [
  ['data', 'treasury', 'Treasury data'],
  ['data', 'bls', 'BLS data'],
  ['data', 'bea', 'BEA data'],
  ['data', 'dol', 'DOL ETA data'],
  ['data', 'census', 'Census data'],
  ['calendar', 'bls', 'BLS release calendar'],
  ['calendar', 'bea', 'BEA release calendar'],
  ['calendar', 'census', 'Census release calendar'],
  ['calendar', 'dol', 'DOL claims calendar'],
  ['calendar', 'treasury', 'Treasury debt calendar'],
  ['calendar', 'treasury-yield-timing', 'Treasury yield timing'],
];

// Date.parse accepts calendar rollovers and local dates; capture provenance must
// be an actual UTC instant in the format written by the refresh collectors.
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return null;
  const normalized = new Date(millis).toISOString();
  return normalized === (value.includes('.') ? value : value.replace('Z', '.000Z')) ? normalized : null;
}

function newest(values) {
  return values.filter(Boolean).reduce((latest, value) => latest === null || value > latest ? value : latest, null);
}

/** Summarize recorded capture outcomes, independently of data observation dates. */
export function getFreshness(snapshot = {}) {
  const entries = targets.map(([kind, sourceId, label]) => {
    const source = kind === 'data' ? snapshot?.sources?.[sourceId] : snapshot?.calendar?.sources?.[sourceId];
    const fetchedAt = timestamp(source?.fetchedAt);
    return {
      id: `${kind}:${sourceId}`,
      label,
      kind,
      status: fetchedAt === null ? 'unavailable' : source?.status === 'ok' ? 'available' : 'cached',
      fetchedAt,
      lastAttemptAt: timestamp(source?.lastAttemptAt),
      error: typeof source?.error === 'string' && source.error.trim() ? source.error : null,
    };
  });
  const cached = entries.filter(entry => entry.status === 'cached');
  const unavailable = entries.filter(entry => entry.status === 'unavailable');
  return {
    entries,
    lastSuccessfulRefresh: newest(entries.map(entry => entry.fetchedAt)),
    lastAttemptAt: newest([
      timestamp(snapshot?.checkedAt),
      timestamp(snapshot?.calendar?.checkedAt),
      ...entries.map(entry => entry.lastAttemptAt),
    ]),
    cached,
    unavailable,
    state: unavailable.length === entries.length ? 'unavailable' : cached.length || unavailable.length ? 'partial' : 'available',
  };
}
