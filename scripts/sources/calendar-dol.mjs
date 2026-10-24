import { requestText } from './http.mjs';
import { decodeHtmlText, easternFields, easternInstant } from './calendar-utils.mjs';

const endpoint = 'https://oui.doleta.gov/unemploy/claims_arch.asp';
const maxBytes = 2 * 1024 * 1024;
const dayMs = 24 * 60 * 60 * 1000;
const expectedRule = 'Publication Schedule: The UI Weekly Claims News Release is published each week on Thursday morning at 8:30am EST. Exceptions to this schedule occur when a Thursday falls on a Federal Holiday. The following is a list of dates when the weekly news release will be published on a day other than Thursday:';
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function shiftedDate(date, days) {
  return new Date(Date.parse(`${date}T12:00:00.000Z`) + days * dayMs).toISOString().slice(0, 10);
}

function exceptionDate(text) {
  const match = /^Wednesday, ([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(text);
  const month = match ? months.indexOf(match[1]) : -1;
  if (!match || month < 0 || Number(match[3]) < 2000 || Number(match[3]) > 2100) throw new Error('Unsupported DOL exception date or weekday schema');
  const date = `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || parsed.getUTCDay() !== 3) throw new Error('Invalid DOL exception date or weekday');
  return date;
}

function publishedSchedule(html) {
  if (typeof html !== 'string') throw new Error('Invalid DOL calendar HTML');
  if (Buffer.byteLength(html, 'utf8') > maxBytes) throw new Error('DOL calendar exceeds the 2 MiB size limit');
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(html)) throw new Error('Invalid DOL calendar control character');
  const content = html.replace(/<!--[^]*?-->/g, ' ').replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi, ' ');
  if (/\b(?:no publication|will not be published|suspend(?:ed)?|postpon(?:ed|ement)|cancel(?:led|ed|lation))\b/i.test(decodeHtmlText(content))) throw new Error('Unrecognized DOL publication interruption notice; schedule requires review');
  const paragraphs = [...content.matchAll(/<p\b[^>]*>([^]*?)<\/p>/gi)].filter(match => decodeHtmlText(match[1]).startsWith('Publication Schedule:'));
  if (paragraphs.length !== 1 || decodeHtmlText(paragraphs[0][1]) !== expectedRule) throw new Error('Unrecognized DOL publication schedule rule schema');
  const paragraph = paragraphs[0];
  const table = /^\s*<table\b[^>]*>([^]*?)<\/table>/i.exec(content.slice(paragraph.index + paragraph[0].length));
  if (!table) throw new Error('Unrecognized DOL publication exception table schema');
  const header = /<thead\b[^>]*>([^]*?)<\/thead>/i.exec(table[1]);
  const body = /<tbody\b[^>]*>([^]*?)<\/tbody>/i.exec(table[1]);
  const labels = header ? [...header[1].matchAll(/<th\b[^>]*>([^]*?)<\/th>/gi)].map(match => decodeHtmlText(match[1])) : [];
  if (!body || labels.join('|') !== 'Release Date|Release Time') throw new Error('Unrecognized DOL publication exception header/body schema');
  const rows = [...body[1].matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)];
  if (!rows.length || rows.length > 100 || body[1].replace(/<tr\b[^>]*>[^]*?<\/tr>/gi, '').trim()) throw new Error('Invalid DOL publication exception rows schema');
  const seen = new Set();
  const publishedExceptions = rows.map(row => {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([^]*?)<\/td>/gi)];
    if (cells.length !== 2 || row[1].replace(/<td\b[^>]*>[^]*?<\/td>/gi, '').trim()) throw new Error('Invalid DOL publication exception row schema');
    const date = exceptionDate(decodeHtmlText(cells[0][1]));
    if (decodeHtmlText(cells[1][1]) !== '8:30 AM EST') throw new Error('Unsupported DOL publication exception time schema');
    const nominalDate = shiftedDate(date, 1);
    if (seen.has(nominalDate)) throw new Error('Duplicate DOL exception nominal week');
    seen.add(nominalDate);
    return { date, time: '08:30', nominalDate };
  }).sort((a, b) => a.date.localeCompare(b.date));
  return { rawScheduleRule: decodeHtmlText(paragraph[1]), publishedExceptions };
}

/** Expand current-day and upcoming dates from DOL's published rule and explicit exceptions. */
export function parseDolCalendar(html, { now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid DOL calendar capture date');
  const { rawScheduleRule, publishedExceptions } = publishedSchedule(html);
  const coverageStart = easternFields(now.toISOString()).date;
  const requestedEnd = shiftedDate(coverageStart, 89);
  const publishedHorizon = `${publishedExceptions.at(-1).date.slice(0, 4)}-12-31`;
  if (publishedHorizon < coverageStart) throw new Error('DOL posted exception horizon is stale; no supported upcoming coverage');
  const coverageEnd = requestedEnd < publishedHorizon ? requestedEnd : publishedHorizon;
  const exceptionsByNominal = new Map(publishedExceptions.map(exception => [exception.nominalDate, exception]));
  const events = [];
  // Include the following nominal day so a Wednesday exception on the last
  // covered day still replaces its Thursday rather than disappearing.
  for (let nominalDate = coverageStart; nominalDate <= shiftedDate(coverageEnd, 1); nominalDate = shiftedDate(nominalDate, 1)) {
    if (new Date(`${nominalDate}T12:00:00.000Z`).getUTCDay() !== 4) continue;
    const exception = exceptionsByNominal.get(nominalDate);
    const date = exception?.date ?? nominalDate;
    const time = exception?.time ?? '08:30';
    const scheduledAt = easternInstant(date, time);
    // Keep today's schedule after 08:30 so a late full refresh can still retry
    // an unavailable release. The scheduled clock does not verify publication.
    if (date < coverageStart || date > coverageEnd) continue;
    events.push({
      id: `dol-claims-${nominalDate}`, sourceId: 'dol', program: 'weekly-claims',
      name: 'Unemployment Insurance Weekly Claims', agency: 'DOL ETA', seriesId: 'claims', seriesIds: ['claims'], topic: 'Labor',
      date, time, scheduledAt, period: null, periodLabel: null, sourceUrl: endpoint, sourceUid: null,
      scheduleBasis: exception ? 'published-exception' : 'recurring-rule', nominalDate,
    });
  }
  if (!events.length) throw new Error('DOL schedule has no usable current-day or upcoming coverage within its posted horizon');
  const warnings = requestedEnd > publishedHorizon ? [`DOL coverage stops at the posted exception horizon, ${publishedHorizon}; later weekly dates have not been expanded.`] : [];
  return {
    events, rawScheduleRule, publishedExceptions, coverageStart, coverageEnd,
    scheduleMethod: 'recurring-rule-with-exceptions', warnings,
    coverageNote: `Current-day and upcoming DOL ETA weekly claims dates expanded from its published recurring Thursday rule and explicit Wednesday holiday exceptions; limited to 90 calendar days (${coverageStart} through ${coverageEnd}) and the posted exception-year horizon. Current Eastern-day schedules remain available for release retries after the scheduled clock; a schedule does not establish publication. These are agency schedule rules, not individually dated calendar entries. Source wording uses EST; 8:30 a.m. is normalized to America/New_York Eastern time, including daylight saving, consistent with the official release's Eastern-time embargo. Reference periods are not supplied. Dates can change; check the official schedule.`,
  };
}

export async function collectDolCalendar({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const response = await requestText(endpoint, { fetchImpl, maxBytes, headers: { Accept: 'text/html' } });
  if (response.url !== endpoint) throw new Error('Unexpected DOL calendar source URL or redirect');
  const parsed = parseDolCalendar(response.text, { now });
  const { text: _text, ...provenance } = response;
  return {
    id: 'dol', agency: 'U.S. Department of Labor, Employment and Training Administration',
    ...parsed, provenance: [provenance], fetchedAt: response.retrievedAt,
  };
}
