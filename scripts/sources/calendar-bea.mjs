import { createHash } from 'node:crypto';
import { requestText } from './http.mjs';
import { easternFields } from './calendar-utils.mjs';

const endpoint = 'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics';
const maxBytes = 2 * 1024 * 1024;
const maxEvents = 10000;
const months = 'January|February|March|April|May|June|July|August|September|October|November|December';
const coreFields = new Set(['SUMMARY', 'UID', 'DTSTART', 'DTSTAMP', 'SEQUENCE', 'STATUS', 'RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID']);

function decodeText(value) {
  return value.replace(/\\([\s\S]?)/g, (_all, character) => {
    if (!/^[nN,;\\]$/.test(character)) throw new Error('Unsupported BEA calendar text escape');
    return /[nN]/.test(character) ? '\n' : character;
  });
}

function utcInstant(field, label) {
  if (!field || !['', ';VALUE=DATE-TIME'].includes(field.parameters)) throw new Error(`Invalid BEA calendar ${label} UTC schema`);
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(field.value);
  if (!match) throw new Error(`Invalid BEA calendar ${label} UTC date`);
  const date = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}.000Z`;
  const instant = new Date(date);
  if (!Number.isFinite(instant.getTime()) || instant.toISOString() !== date) throw new Error(`Invalid BEA calendar ${label} date`);
  return instant.toISOString();
}

function classification(name) {
  if (/^(?:Gross Domestic Product,|GDP \()/.test(name)) return { program: 'gdp', seriesId: 'gdp', topic: 'Growth' };
  if (/^Personal Income and Outlays,/.test(name)) return { program: 'personal-income-outlays', seriesId: 'pce', topic: 'Inflation' };
  return null;
}

function referencePeriod(name, program) {
  const title = name.trim();
  if (program === 'gdp') return title.match(/\b([1-4](?:st|nd|rd|th) Quarter(?: and Year)? \d{4})\b/)?.[1] ?? null;
  return title.match(new RegExp(`^Personal Income and Outlays, ((?:${months})(?: and (?:${months}))? \\d{4})$`))?.[1] ?? null;
}

function componentLines(ics) {
  if (typeof ics !== 'string') throw new Error('Invalid BEA calendar response');
  if (Buffer.byteLength(ics, 'utf8') > maxBytes) throw new Error('BEA calendar exceeds the 2 MiB size limit');
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(ics)) throw new Error('Invalid BEA calendar control character');
  const lines = ics.replace(/^\ufeff/, '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').trim().split('\n').filter(Boolean);
  if (lines[0] !== 'BEGIN:VCALENDAR' || lines.at(-1) !== 'END:VCALENDAR') throw new Error('Invalid BEA calendar component schema');
  const components = [];
  let current = null;
  let version = null;
  for (const line of lines.slice(1, -1)) {
    if (line.length > 16384) throw new Error('BEA calendar line size limit exceeded');
    if (line === 'BEGIN:VEVENT') {
      if (current || components.length >= maxEvents) throw new Error('Invalid BEA calendar event schema or event limit');
      current = {};
      continue;
    }
    if (line === 'END:VEVENT') {
      if (!current) throw new Error('Invalid BEA calendar event component schema');
      components.push(current); current = null;
      continue;
    }
    const property = /^([A-Z0-9-]+)((?:;[^:\r\n]*)?):([^\r\n]*)$/.exec(line);
    if (!property || ['BEGIN', 'END'].includes(property[1])) throw new Error('Unrecognized BEA calendar property schema');
    const [, key, parameters, value] = property;
    if (!current) {
      if (key === 'VERSION') {
        if (version !== null || parameters || value !== '2.0') throw new Error('Unsupported BEA calendar version schema');
        version = value;
      }
      continue;
    }
    if (coreFields.has(key) && Object.hasOwn(current, key)) throw new Error(`Duplicate BEA calendar ${key} field`);
    if (coreFields.has(key)) current[key] = { value, parameters };
  }
  if (current || version !== '2.0') throw new Error('Incomplete BEA calendar component schema');
  return components;
}

/** Bounded reader for BEA's dated national GDP and Personal Income and Outlays events. */
export function parseBeaCalendar(ics) {
  const components = componentLines(ics);
  const entries = components.map(fields => ({ fields, name: fields.SUMMARY ? decodeText(fields.SUMMARY.value) : null }));
  const mappedUids = new Set(entries.filter(entry => classification(entry.name ?? '')).map(entry => entry.fields.UID?.value));
  const latest = new Map();
  for (const { fields, name } of entries) {
    const mapping = classification(name ?? '');
    const uid = fields.UID?.value;
    const cancelled = fields.STATUS?.value === 'CANCELLED';
    if (!mapping && !mappedUids.has(uid) && !cancelled) continue;
    if (!uid || uid.length > 512 || /\s|[\x00-\x1f\x7f]/.test(uid) || fields.UID.parameters) throw new Error('Invalid BEA calendar source UID');
    const rawSequence = fields.SEQUENCE?.value;
    if (!rawSequence || !/^\d+$/.test(rawSequence) || !Number.isSafeInteger(Number(rawSequence)) || fields.SEQUENCE.parameters) throw new Error('Invalid BEA calendar sequence');
    const sequence = Number(rawSequence);
    const sourceUpdatedAt = utcInstant(fields.DTSTAMP, 'update');
    if (fields.STATUS && (!['CANCELLED', 'CONFIRMED', 'TENTATIVE'].includes(fields.STATUS.value) || fields.STATUS.parameters)) throw new Error('Invalid BEA calendar status schema');
    if (['RRULE', 'RDATE', 'EXDATE', 'RECURRENCE-ID'].some(key => fields[key])) throw new Error('Unsupported BEA calendar recurrence schema');
    let event = null;
    if (!cancelled && mapping) {
      if (!name.trim() || fields.SUMMARY.parameters) throw new Error('Invalid BEA calendar title schema');
      const scheduledAt = utcInstant(fields.DTSTART, 'release');
      event = {
        id: `bea-${createHash('sha256').update(uid).digest('hex')}`,
        sourceId: 'bea', ...mapping, name, agency: 'BEA', seriesIds: [mapping.seriesId],
        ...easternFields(scheduledAt), scheduledAt, period: null, periodLabel: referencePeriod(name, mapping.program),
        sourceUrl: endpoint, sourceUid: uid, sequence, sourceUpdatedAt,
      };
    }
    const record = { sequence, sourceUpdatedAt, event };
    const previous = latest.get(uid);
    if (previous && previous.sequence === sequence && JSON.stringify(previous) !== JSON.stringify(record)) throw new Error(`Ambiguous duplicate BEA calendar UID: ${uid}`);
    if (!previous || sequence > previous.sequence) latest.set(uid, record);
  }
  return [...latest.values()].flatMap(record => record.event ? [record.event] : []).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
}

export async function collectBeaCalendar({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const response = await requestText(endpoint, { fetchImpl, maxBytes });
  const events = parseBeaCalendar(response.text);
  const upcoming = events.filter(event => Date.parse(event.scheduledAt) >= now.getTime());
  const { text: _text, ...provenance } = response;
  return {
    id: 'bea', agency: 'U.S. Bureau of Economic Analysis', events, fetchedAt: response.retrievedAt,
    provenance: [provenance],
    coverageNote: 'Official BEA national GDP and Personal Income and Outlays dated release schedule. Times are Eastern; schedules may change. Calendar update timestamps describe schedule metadata, not publication of statistical results.',
    warnings: upcoming.length ? [] : ['The BEA calendar contains no upcoming mapped releases; check the official schedule for new or changed dates.'],
  };
}
