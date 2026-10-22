import { requestText } from './http.mjs';

const endpoint = 'https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const MAX_XML_BYTES = 2 * 1024 * 1024;
const MAX_WEEKS = 10000;
const dayMs = 86400000;

function calendarDate(raw, weekly = false) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!match) throw new Error(`Invalid DOL date: ${raw}`);
  const date = `${match[3]}-${match[1]}-${match[2]}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid DOL calendar date: ${raw}`);
  }
  if (weekly && parsed.getUTCDay() !== 6) throw new Error(`DOL week-ending date must be a Saturday: ${date}`);
  return date;
}

function blankEntities(text) {
  // The export represents missing cells with a numeric nonbreaking-space entity.
  // Nothing here resolves XML entities, external resources, or declarations.
  if (/&(?!(?:#160|#x[aA]0);)/.test(text)) throw new Error('Unsupported DOL XML entity');
  return text.replace(/&#(?:160|x[aA]0);/g, '\u00a0');
}

function fields(text, allowed) {
  const result = {};
  const remainder = text.replace(/<([A-Za-z][A-Za-z0-9]*)>([^<>]*)<\/\1>/g, (_all, name, value) => {
    if (!allowed.includes(name) || Object.hasOwn(result, name)) throw new Error('Invalid or duplicate DOL XML field');
    result[name] = blankEntities(value).trim();
    return '';
  });
  if (remainder.trim()) throw new Error('Unrecognized DOL XML field schema');
  return result;
}

function trimMissing(observations) {
  const first = observations.findIndex(row => row.value !== null);
  if (first < 0) throw new Error('No usable numeric DOL claims observations');
  let last = observations.length - 1;
  while (observations[last].value === null) last--;
  return observations.slice(first, last + 1);
}

function claimsObservation(date, sourceValue, measurement) {
  let value = null;
  if (sourceValue !== '') {
    if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(sourceValue)) throw new Error(`Invalid DOL numeric ${measurement} count for ${date}`);
    const count = Number(sourceValue.replaceAll(',', ''));
    if (!Number.isSafeInteger(count)) throw new Error(`Invalid DOL numeric ${measurement} count for ${date}`);
    value = count / 1000;
  }
  return { date, value, publishedAt: null, sourceValue };
}

/** Strict, bounded reader for ETA's national weekly-claims export, not general XML. */
export function parseDol(xml) {
  if (typeof xml !== 'string') throw new Error('Invalid DOL XML response');
  if (Buffer.byteLength(xml, 'utf8') > MAX_XML_BYTES) throw new Error('DOL XML exceeds the 2 MiB source size limit');
  if (xml.includes('<!')) throw new Error('DOL XML declarations and external entities are not supported');
  const text = xml.trim().replace(/^<\?xml\s+version=(?:"1\.0"|'1\.0')(?:\s+encoding=(?:"UTF-8"|'UTF-8'))?\s*\?>\s*/i, '');
  const root = /^<r539cyNational\s+rundate=(?:"([^"]*)"|'([^']*)')\s*>([\s\S]*)<\/r539cyNational>$/.exec(text);
  if (!root) throw new Error('Unrecognized DOL national XML schema');
  const reportDate = calendarDate(root[1] ?? root[2]);
  const dates = new Set();
  const observations = [];
  const continuedObservations = [];
  const remainder = root[3].replace(/<week>([\s\S]*?)<\/week>/g, (_all, body) => {
    if (dates.size >= MAX_WEEKS) throw new Error('DOL XML exceeds the weekly observation limit');
    const row = /^\s*<weekEnded>([^<>]*)<\/weekEnded>\s*(?:<InitialClaims>([\s\S]*?)<\/InitialClaims>\s*)?(?:<ContinuedClaims>([\s\S]*?)<\/ContinuedClaims>\s*)?(?:<IUR>([\s\S]*?)<\/IUR>\s*)?(?:<CoveredEmployment>([^<>]*)<\/CoveredEmployment>\s*)?$/.exec(body);
    if (!row) throw new Error('Unrecognized DOL weekly XML schema');
    const date = calendarDate(row[1], true);
    if (dates.has(date)) throw new Error(`Duplicate DOL observation date: ${date}`);
    dates.add(date);
    const initial = fields(row[2] ?? '', ['NSA', 'SF', 'SA', 'SA4WK']);
    const continued = fields(row[3] ?? '', ['NSA', 'SF', 'SA', 'SA4WK']);
    fields(row[4] ?? '', ['NSA', 'SA']);
    if (row[5] !== undefined) blankEntities(row[5]);
    observations.push(claimsObservation(date, initial.SA ?? '', 'initial claims'));
    continuedObservations.push(claimsObservation(date, continued.SA ?? '', 'continued claims'));
    return '';
  });
  if (remainder.trim()) throw new Error('Unrecognized DOL XML weekly schema');
  observations.sort((a, b) => a.date.localeCompare(b.date));
  continuedObservations.sort((a, b) => a.date.localeCompare(b.date));
  return { observations: trimMissing(observations), continuedObservations: trimMissing(continuedObservations), reportDate };
}

export async function collectDol({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const year = now.getUTCFullYear();
  const cutoff = now.toISOString().slice(0, 10);
  const body = new URLSearchParams({ level: 'us', strtdate: String(year - 2), enddate: String(year), filetype: 'xml', submit: 'Submit' }).toString();
  const response = await requestText(endpoint, { fetchImpl, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const parsed = parseDol(response.text);
  const observations = trimMissing(parsed.observations.filter(row => row.date <= cutoff)).slice(-52);
  const continuedObservations = trimMissing(parsed.continuedObservations.filter(row => row.date <= cutoff)).slice(-52);
  const latestObservationDate = observations.at(-1).date;
  const coverageNote = `ETA historical national weekly claims; latest observation ${latestObservationDate} (week ending). This feed may lag the latest advance weekly release, and historical values can be revised.`;
  const ageDays = (Date.parse(`${cutoff}T00:00:00Z`) - Date.parse(`${latestObservationDate}T00:00:00Z`)) / dayMs;
  const continuedLatestDate = continuedObservations.at(-1).date;
  const continuedCoverage = `ETA historical national continued weekly claims (insured unemployment); latest observation ${continuedLatestDate} (week ending). This feed may lag the latest advance weekly release, and historical values can be revised. Continued claims may have an earlier latest reference week than initial claims.`;
  const continuedAgeDays = (Date.parse(`${cutoff}T00:00:00Z`) - Date.parse(`${continuedLatestDate}T00:00:00Z`)) / dayMs;
  const { text: _text, ...provenance } = response;
  return {
    id: 'dol',
    fetchedAt: response.retrievedAt,
    reportDate: parsed.reportDate,
    latestObservationDate,
    coverageNote,
    series: {
      claims: {
        observations,
        sourceUrl: endpoint,
        sourceIds: ['InitialClaims/SA'],
        calculation: 'Published seasonally adjusted initial claims count / 1000; thousands of claims, week ending.',
        dataStatus: 'official',
        latestObservationDate,
        coverageNote,
      },
      continuedClaims: {
        observations: continuedObservations,
        sourceUrl: endpoint,
        sourceIds: ['ContinuedClaims/SA'],
        calculation: 'Published seasonally adjusted continued claims count / 1000; thousands of claims, week ending.',
        measure: 'Continued weeks claimed (insured unemployment), national seasonally adjusted count in thousands; not total unemployment or initial claims.',
        observationType: 'official',
        dataStatus: 'official',
        latestObservationDate: continuedLatestDate,
        coverageNote: continuedCoverage,
      },
    },
    provenance: [provenance],
    warnings: [
      ...(ageDays > 14 ? [`DOL historical feed latest observation is ${latestObservationDate}, ${ageDays} days before ${cutoff}; this feed may lag the latest advance weekly release.`] : []),
      ...(continuedAgeDays > 14 ? [`DOL historical continued claims latest observation is ${continuedLatestDate}, ${continuedAgeDays} days before ${cutoff}; this feed may lag the latest advance weekly release.`] : []),
    ],
  };
}
