const targets = [
  ['data', 'treasury', 'Treasury data'],
  ['data', 'bls', 'BLS data'],
  ['data', 'bea', 'BEA data'],
  ['data', 'dol', 'DOL ETA data'],
  ['data', 'dolAdvance', 'DOL advance claims release'],
  ['data', 'census', 'Census data'],
  ['calendar', 'bls', 'BLS release calendar'],
  ['calendar', 'bea', 'BEA release calendar'],
  ['calendar', 'census', 'Census release calendar'],
  ['calendar', 'dol', 'DOL claims calendar'],
  ['calendar', 'treasury', 'Treasury debt calendar'],
  ['calendar', 'treasury-yield-timing', 'Treasury yield timing'],
  ['data', 'fiscal', 'Treasury fiscal pressure'],
  ['data', 'refinancing', 'Treasury debt maturity profile'],
  ['data', 'yields', 'Treasury yield history'],
  ['data', 'auctions', 'Treasury auction results'],
  ['data', 'ownership', 'Federal Reserve Treasury ownership'],
  ['data', 'macroContributions', 'BEA GDP contributions'],
  ['data', 'marketFunctioning', 'New York Fed dealer and funding data'],
  ['data', 'policyRates', 'Federal Reserve policy rates'],
  ['data', 'activity', 'Federal Reserve industrial activity'],
  ['data', 'housing', 'Census housing construction'],
];

export const DAILY_REFRESH_SCHEDULE = Object.freeze({ hourUTC: 23, minuteUTC: 37, graceMinutes: 60 });

function refreshWindow(now, graceMinutes = DAILY_REFRESH_SCHEDULE.graceMinutes) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new RangeError('The freshness clock must be a valid Date.');
  }
  const day = 24 * 60 * 60 * 1000;
  const scheduleOffset = (DAILY_REFRESH_SCHEDULE.hourUTC * 60 + DAILY_REFRESH_SCHEDULE.minuteUTC) * 60 * 1000;
  const grace = graceMinutes * 60 * 1000;
  // Select the most recent run whose grace period has elapsed. The deadline
  // crosses UTC midnight, so subtract the grace before selecting its day.
  const scheduledAt = Math.floor((now.getTime() - scheduleOffset - grace) / day) * day + scheduleOffset;
  return {
    expectedRefreshAt: new Date(scheduledAt).toISOString(),
    refreshDeadline: new Date(scheduledAt + grace).toISOString(),
  };
}

/** Latest scheduled run, including one still inside the banner's grace period. */
export function getScheduledRefreshAt(now = new Date()) {
  return refreshWindow(now, 0).expectedRefreshAt;
}

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

/** Summarize captures against the daily deadline using a valid Date clock. */
export function getFreshness(snapshot = {}, { now = new Date() } = {}) {
  const { expectedRefreshAt, refreshDeadline } = refreshWindow(now);
  const entries = targets.map(([kind, sourceId, label]) => {
    const source = kind === 'data' ? snapshot?.sources?.[sourceId] : snapshot?.calendar?.sources?.[sourceId];
    const fetchedAt = timestamp(source?.fetchedAt);
    const stale = fetchedAt !== null && fetchedAt < expectedRefreshAt;
    return {
      id: `${kind}:${sourceId}`,
      label,
      kind,
      status: fetchedAt === null ? 'unavailable' : source?.status === 'ok' ? 'available' : 'cached',
      fetchedAt,
      lastAttemptAt: timestamp(source?.lastAttemptAt),
      error: typeof source?.error === 'string' && source.error.trim() ? source.error : null,
      stale,
      staleSince: stale ? refreshDeadline : null,
    };
  });
  const cached = entries.filter(entry => entry.status === 'cached');
  const unavailable = entries.filter(entry => entry.status === 'unavailable');
  const stale = entries.filter(entry => entry.stale);
  return {
    entries,
    expectedRefreshAt,
    refreshDeadline,
    lastSuccessfulRefresh: newest(entries.map(entry => entry.fetchedAt)),
    lastAttemptAt: newest([
      timestamp(snapshot?.checkedAt),
      timestamp(snapshot?.calendar?.checkedAt),
      ...entries.map(entry => entry.lastAttemptAt),
    ]),
    cached,
    unavailable,
    stale,
    state: unavailable.length === entries.length ? 'unavailable' : cached.length || unavailable.length || stale.length ? 'partial' : 'available',
  };
}
