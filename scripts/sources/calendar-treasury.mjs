import { requestText } from './http.mjs';
import { easternFields } from './calendar-utils.mjs';

const endpoint = 'https://api.fiscaldata.treasury.gov/services/calendar/release';
const metadataEndpoint = 'https://api.fiscaldata.treasury.gov/services/dtg/metadata/';
const datasetId = '015-BFS-2014Q3-065';
const title = 'Debt to the Penny';
const path = 'debt-to-the-penny';
const maxBytes = 2 * 1024 * 1024;
const maxRows = 10000;

function arrayResponse(text, label) {
  if (typeof text !== 'string') throw new Error(`Invalid Treasury ${label} response`);
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error(`Treasury ${label} exceeds the 2 MiB size limit`);
  let rows;
  try { rows = JSON.parse(text); }
  catch { throw new Error(`Invalid Treasury ${label} JSON schema`); }
  if (!Array.isArray(rows) || rows.length > maxRows || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error(`Invalid Treasury ${label} array schema`);
  return rows;
}

function sourceInstant(date, time) {
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid Treasury calendar date or time schema');
  const timestamp = `${date}T${time}:00.000Z`;
  const parsed = new Date(timestamp);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== timestamp) throw new Error('Invalid Treasury calendar source date');
  return timestamp;
}

/** Read Treasury's explicitly listed UTC estimates; do not generate a recurring calendar. */
export function parseTreasuryCalendar(calendarText, metadataText) {
  const metadata = arrayResponse(metadataText, 'metadata');
  if (metadata.some(row => typeof row.dataset_id !== 'string')) throw new Error('Invalid Treasury metadata dataset identity schema');
  const identities = metadata.filter(row => row.dataset_id === datasetId);
  if (identities.length !== 1 || identities[0].title !== title || identities[0].dataset_path !== path) throw new Error('Unrecognized Treasury Debt to the Penny metadata identity');
  const rows = arrayResponse(calendarText, 'calendar');
  const seen = new Set();
  const events = [];
  for (const row of rows) {
    if (typeof row.datasetId !== 'string' || !['true', 'false'].includes(row.released)) throw new Error('Invalid Treasury calendar dataset or release-status schema');
    const scheduledAt = sourceInstant(row.date, row.time);
    if (row.datasetId !== datasetId) continue;
    if (seen.has(row.date)) throw new Error(`Duplicate Treasury Debt to the Penny calendar date: ${row.date}`);
    seen.add(row.date);
    events.push({
      id: `treasury-${path}-${row.date}`, sourceId: 'treasury', program: path, name: title, agency: 'Treasury Fiscal Data', seriesId: 'debt', seriesIds: ['debt'], topic: 'Fiscal',
      ...easternFields(scheduledAt), scheduledAt, period: null, periodLabel: null, sourceUrl: endpoint, sourceUid: null, scheduleBasis: 'calendar-estimate',
      sourceDatasetId: datasetId, sourceDate: row.date, sourceTime: row.time, sourceTimeZone: 'UTC',
    });
  }
  if (!events.length) throw new Error('The Treasury calendar contains no mapped Debt to the Penny records');
  events.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
  return { events, datasetIdentity: { datasetId, title, path }, coverageStart: events[0].sourceDate, coverageEnd: events.at(-1).sourceDate };
}

export async function collectTreasuryCalendar({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid Treasury calendar capture date');
  const responses = await Promise.all([endpoint, metadataEndpoint].map(async url => {
    const response = await requestText(url, { fetchImpl, maxBytes });
    if (response.url !== url) throw new Error('Unreviewed Treasury calendar source URL or redirect');
    return response;
  }));
  const result = parseTreasuryCalendar(responses[0].text, responses[1].text);
  const provenance = responses.map(({ text: _text, ...source }) => source);
  return {
    id: 'treasury', agency: 'U.S. Department of the Treasury, Fiscal Data', ...result,
    fetchedAt: provenance.map(source => source.retrievedAt).sort().at(-1), provenance,
    coverageNote: `Official Treasury Fiscal Data calendar estimates for Debt to the Penny, explicitly listed from ${result.coverageStart} through ${result.coverageEnd}. Only listed dates are imported; no dates are generated beyond the source horizon. The source supplies UTC dates and clocks, displayed in Eastern time. These are estimated release times, not confirmed publication times or observation periods. Daily par yield release dates are not supplied by this calendar.`,
    warnings: result.events.some(event => Date.parse(event.scheduledAt) >= now.getTime()) ? [] : ['The Treasury calendar contains no upcoming Debt to the Penny estimates; its listed horizon is exhausted. Check the official calendar for new or changed dates.'],
  };
}
