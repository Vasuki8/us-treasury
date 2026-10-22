import { requestBytes } from './http.mjs';
import { extractZipEntry } from './zip.mjs';
import { easternFields } from './calendar-utils.mjs';
import { NY_FED_DATA_NOTICE, NY_FED_PRODUCT_NOTICE, NY_FED_REFERENCE_RATE_NOTICE, NY_FED_TERMS_URL } from '../../src/market-functioning.js';

export const IORB_URL = 'https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip';
export const POLICY_TARGET_URL = 'https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json';
const boardTerms = 'https://www.federalreserve.gov/disclaimer.htm';
const startDate = '2017-01-01';
const fail = message => { throw new Error(`Invalid policy rate data: ${message}`); };
const finite = value => typeof value === 'number' && Number.isFinite(value);
const captureDate = now => {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail('capture date');
  return easternFields(now.toISOString()).date;
};
function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('observation date');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) fail('observation date');
  return value;
}
function rate(value) {
  if (value === null) return null;
  if (!finite(value) || value < 0) fail('numeric policy target bound');
  return value;
}

/** Preserve the target bounds published with each EFFR effective business date. */
export function parsePolicyTargets(payload, { now = new Date() } = {}) {
  const endDate = captureDate(now), seen = new Set();
  if (!Array.isArray(payload?.refRates) || !payload.refRates.length) fail('missing policy target observations');
  const rows = payload.refRates.map(row => {
    if (row.type !== 'EFFR' || !['','Y','r'].includes(row.revisionIndicator)) fail('unexpected target rate type or revision indicator');
    const date = dateKey(row.effectiveDate);
    if (seen.has(date)) fail('duplicate policy target date');
    seen.add(date);
    const lower = rate(row.targetRateFrom), upper = rate(row.targetRateTo);
    if (finite(lower) && finite(upper) && lower > upper) fail('reversed policy target bounds');
    return { date, lower, upper, revisionIndicator: row.revisionIndicator };
  }).filter(row => row.date >= startDate && row.date <= endDate).sort((a,b) => a.date.localeCompare(b.date));
  if (!rows.some(row => finite(row.lower) && finite(row.upper))) fail('no usable policy target bounds');
  return Object.fromEntries([['policyTargetLower','lower'],['policyTargetUpper','upper']].map(([id,key]) => [id,rows.map(row => ({date:row.date,value:row[key],sourceValue:row[key]===null?'null':String(row[key]),publishedAt:null,revisionIndicator:row.revisionIndicator}))]));
}

function attributes(text) {
  const result = {};
  for (const match of text.matchAll(/([A-Z_]+)="([^"<>]*)"/g)) {
    if (Object.hasOwn(result,match[1])) fail('duplicate IORB XML attribute');
    result[match[1]]=match[2];
  }
  return result;
}

/** IORB began July 29, 2021. IOER and IORR are different, discontinued series. */
export function parseIorbXml(text, { now = new Date() } = {}) {
  const endDate = captureDate(now);
  if (typeof text !== 'string') fail('IORB XML framing');
  // Commented examples and retired records are not published observations.
  text = text.replace(/<!--([\s\S]*?)-->/g, (_comment, body) => {
    if (body.includes('--')) fail('malformed IORB XML comment');
    return '';
  });
  if (/<!--|-->/.test(text)) fail('malformed IORB XML comment');
  if (/<!DOCTYPE|<!ENTITY/i.test(text) || !text.includes('id="PRATES_POLICY_RATES"') || !/<\/message:MessageGroup>\s*$/.test(text)) fail('IORB XML framing');
  const matches = [...text.matchAll(/<kf:Series\b([^>]*)>([^]*?)<\/kf:Series>/g)].filter(match => attributes(match[1]).SERIES_NAME === 'RESBM_N.D');
  if (matches.length !== 1) fail('missing or duplicate IORB series');
  const metadata = attributes(matches[0][1]);
  if (metadata.UNIT !== 'Percent' || metadata.UNIT_MULT !== '1' || metadata.FREQ !== '8' || metadata.INT_RATES_PAID !== 'IOR') fail('IORB units or frequency changed');
  const seen = new Set(), observations = [];
  const tags = matches[0][2].match(/<frb:Obs\b[^>]*>/g) ?? [];
  for (const tag of tags) {
    if (!/\/>$/.test(tag)) fail('malformed IORB observation');
    const row = attributes(tag), date = dateKey(row.TIME_PERIOD);
    if (seen.has(date)) fail('duplicate IORB observation date');
    seen.add(date);
    if (row.OBS_STATUS !== 'A' || !/^\d+(?:\.\d+)?$/.test(row.OBS_VALUE ?? '')) fail('IORB numeric value or observation status');
    const value = Number(row.OBS_VALUE);
    if (!finite(value) || date < '2021-07-29') fail('IORB value or inception date');
    if (date <= endDate) observations.push({date,value,sourceValue:row.OBS_VALUE,publishedAt:null});
  }
  if (!observations.length) fail('missing IORB observations');
  return observations.sort((a,b) => a.date.localeCompare(b.date));
}

async function capture(url,fetchImpl) {
  return requestBytes(url,{maxBytes:8*1024*1024,fetchImpl:async(value,options)=>{
    const response=await fetchImpl(value,options);
    if(response.redirected || (response.url && response.url!==value))throw new Error('Unreviewed policy rate source URL or redirect');
    return response;
  }});
}

export async function collectPolicyRates({fetchImpl=globalThis.fetch,now=new Date()}={}) {
  const endDate=captureDate(now), url=`${POLICY_TARGET_URL}?startDate=${startDate}&endDate=${endDate}`;
  const [targets,iorb]=await Promise.all([capture(url,fetchImpl),capture(IORB_URL,fetchImpl)]);
  const parsed=parsePolicyTargets(JSON.parse(targets.bytes.toString('utf8')),{now});
  const notice=`${NY_FED_DATA_NOTICE.replace('2026',String(now.getUTCFullYear()))} ${NY_FED_PRODUCT_NOTICE} ${NY_FED_REFERENCE_RATE_NOTICE}`;
  const targetCoverage='Published target range bounds on EFFR effective business dates from 2017. Dates are source observations, not FOMC announcement timestamps. No weekend, holiday or missing date is filled.';
  const series=Object.fromEntries([['policyTargetLower','targetRateFrom'],['policyTargetUpper','targetRateTo']].map(([id,key])=>[id,{observations:parsed[id],sourceIds:[`EFFR:${key}`],sourceUrl:url,sourceTitle:'Effective Federal Funds Rate',unit:'Percent',frequency:'Daily',adjustment:'Not seasonally adjusted',calculation:`Published New York Fed EFFR ${key} field, in percent; no interpolation.`,observationType:'official',dataStatus:'official',sourceNotice:notice,licenseUrl:NY_FED_TERMS_URL,attribution:'Source: Federal Reserve Bank of New York, Effective Federal Funds Rate.',coverageNote:targetCoverage}]));
  series.iorb={observations:parseIorbXml(extractZipEntry(iorb.bytes,'PRATES_data.xml').toString('utf8'),{now}),sourceIds:['RESBM_N.D'],sourceUrl:IORB_URL,sourceTitle:'Interest on Reserve Balances',unit:'Percent',frequency:'Daily',adjustment:'Not seasonally adjusted',calculation:'Published Board IORB rate, percent, on each actual source effective date.',observationType:'official',dataStatus:'official',licenseUrl:boardTerms,attribution:'Source: Board of Governors of the Federal Reserve System, Interest on Reserve Balances.',coverageNote:'IORB starts 2021-07-29. Discontinued IOER and IORR histories are not spliced into IORB. Source effective dates, including source-published weekend values, are retained; future effective dates are excluded.'};
  const provenance=[targets,iorb].map(({bytes,...metadata})=>metadata);
  return {id:'policyRates',fetchedAt:provenance.map(row=>row.retrievedAt).sort().at(-1),series,provenance,warnings:['Policy target bounds and IORB are administered rates, distinct from observed market rates.','Historical release timestamps are unavailable; retrieval is recorded separately.']};
}
