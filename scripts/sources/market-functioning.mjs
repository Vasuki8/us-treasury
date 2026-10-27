import { requestText } from './http.mjs';
import { easternFields } from './calendar-utils.mjs';
import { DEALER_METRICS, NY_FED_TERMS_URL, NY_FED_DATA_NOTICE, NY_FED_REFERENCE_RATE_NOTICE, NY_FED_PRODUCT_NOTICE, MARKET_FUNCTIONING_LIMITATION, FUNDING_RATE_STARTS, fundingRateFootnotes, fundingRateDifference } from '../../src/market-functioning.js';

const origin = 'https://markets.newyorkfed.org';
const breakId = 'SBN2024', coverageStart = '2024-07-03';
export const DEALER_SERIES_BREAKS_URL = `${origin}/api/pd/list/seriesbreaks.json`;
export const DEALER_STATISTICS_URL = `${origin}/api/pd/get/${breakId}/timeseries/${Object.values(DEALER_METRICS).map(row => row.key).join('_')}.json`;
const notice = `${NY_FED_DATA_NOTICE} ${NY_FED_PRODUCT_NOTICE}`;
const rateNotice = `${notice} ${NY_FED_REFERENCE_RATE_NOTICE}`;
const rateTitles = {sofr:'Secured Overnight Financing Rate Data',effr:'Effective Federal Funds Rate'};
const finite = value => typeof value === 'number' && Number.isFinite(value);

function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid New York Fed observation date');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== value) throw new Error('Invalid New York Fed observation date');
  return value;
}

/** The published aggregate uses USD millions; '*' is suppressed, never zero. */
export function parseDealerStatistics(payload) {
  if (!Array.isArray(payload?.pd?.timeseries) || !payload.pd.timeseries.length) throw new Error('Invalid primary dealer statistics response');
  const byKey = new Map(Object.values(DEALER_METRICS).map(row => [row.key,new Map()])), dates = new Set();
  for (const row of payload.pd.timeseries) {
    const observations = byKey.get(row.keyid), date = dateKey(row.asofdate);
    if (!observations) throw new Error('Unreviewed primary dealer series identifier');
    if (date < coverageStart) throw new Error('Primary dealer observation predates the reviewed structural break');
    if (observations.has(date)) throw new Error('Duplicate primary dealer observation');
    const text = row.value === null || row.value === undefined ? '' : String(row.value).trim();
    let value = null;
    if (!['','*','null'].includes(text)) {
      if (!/^[+-]?\d+$/.test(text) || !Number.isSafeInteger(Number(text)) || (row.keyid !== 'PDPOSGST-TOT' && Number(text) < 0)) throw new Error('Invalid primary dealer numeric amount');
      value = Number(text)/1000;
    }
    observations.set(date,{date,value,publishedAt:null,sourceValue:text || 'null',suppressed:text === '*'});dates.add(date);
  }
  const sortedDates = [...dates].sort();
  const series = Object.fromEntries(Object.entries(DEALER_METRICS).map(([id,definition]) => {
    const rows = byKey.get(definition.key);
    if (!rows.size || ![...rows.values()].some(row => finite(row.value))) throw new Error(`Missing usable primary dealer series ${id}`);
    return [id,{observations:sortedDates.map(date => rows.get(date) ?? {date,value:null,publishedAt:null,sourceValue:'null',suppressed:false}),sourceIds:[definition.key],sourceUrl:DEALER_STATISTICS_URL,sourceTitle:'Primary Dealer Statistics',calculation:'Published New York Fed primary-dealer aggregate in USD millions / 1000, yielding USD billions. Treasury securities excluding TIPS; no carry-forward for missing or suppressed observations.',observationType:'official',dataStatus:'official',measure:definition.measure,sourceNotice:notice,licenseUrl:NY_FED_TERMS_URL,coverageNote:`${definition.measure}. ${MARKET_FUNCTIONING_LIMITATION}`}];
  }));
  const dealerHistory = sortedDates.map((date,i) => ({date,...Object.fromEntries(Object.keys(DEALER_METRICS).map(id => [id,series[id].observations[i].value]))}));
  return {series,dealerHistory};
}

function rateNumber(value,{nonnegative=false}={}) {
  if (value === null || value === undefined) return null;
  if (!finite(value) || (nonnegative && value < 0)) throw new Error('Invalid New York Fed rate number');
  return value;
}

export function parseReferenceRates(payload,type) {
  if (!['SOFR','EFFR'].includes(type) || !Array.isArray(payload?.refRates) || !payload.refRates.length) throw new Error('Invalid New York Fed reference-rate response or type');
  const seen = new Set();
  return payload.refRates.map(row => {
    if (row.type !== type) throw new Error('Unexpected New York Fed reference-rate type');
    const date = dateKey(row.effectiveDate);
    if (date < FUNDING_RATE_STARTS[type.toLowerCase()]) throw new Error('New York Fed rate predates reviewed inception or methodology coverage');
    if (seen.has(date)) throw new Error('Duplicate New York Fed reference-rate date');
    seen.add(date);
    const footnoteId = [undefined,null,''].includes(row.footnoteId) ? undefined : row.footnoteId;
    const footnotes = fundingRateFootnotes(type,footnoteId,row.revisionIndicator);
    const value = rateNumber(row.percentRate);
    const volumeInBillions = rateNumber(row.volumeInBillions,{nonnegative:true});
    const percentiles = Object.fromEntries([1,25,75,99].map(percentile => {
      const raw = row[`percentPercentile${percentile}`];
      return [`percentile${percentile}`,raw === 'NA' && type === 'SOFR' && footnoteId === 2 ? null : rateNumber(raw)];
    }));
    const percentileSourceValues = Object.fromEntries([1,25,75,99].filter(percentile => row[`percentPercentile${percentile}`] === 'NA').map(percentile => [`percentile${percentile}`,'NA']));
    if ([2,3].includes(footnoteId) && Object.values(percentiles).some(value => value !== null) || footnoteId === 3 && volumeInBillions !== null) throw new Error('New York Fed rate statistics contradict the source contingency footnote');
    if (Object.keys(percentileSourceValues).length && Object.keys(percentileSourceValues).length !== 4) throw new Error('Incomplete New York Fed survey percentile missing markers');
    return {date,value,publishedAt:null,sourceValue:value === null ? 'null' : String(row.percentRate),revisionIndicator:row.revisionIndicator,volumeInBillions,...percentiles,...(Object.keys(percentileSourceValues).length ? {percentileSourceValues} : {}),...(footnoteId === undefined ? {} : {footnoteId}),...(footnotes.length ? {footnotes} : {})};
  }).sort((a,b) => a.date.localeCompare(b.date));
}

function referenceUrl(type,endDate) {
  return `${origin}/api/rates/${type === 'SOFR' ? 'secured/sofr' : 'unsecured/effr'}/search.json?startDate=${FUNDING_RATE_STARTS[type.toLowerCase()]}&endDate=${endDate}`;
}

async function capture(url,fetchImpl) {
  return requestText(url,{maxBytes:4*1024*1024,fetchImpl:async(value,options) => {
    const response = await fetchImpl(value,options);
    if (response.redirected || (response.url && response.url !== value)) throw new Error('Unreviewed New York Fed source URL or redirect');
    return response;
  }});
}

export async function collectMarketFunctioning({fetchImpl=globalThis.fetch,now=new Date()}={}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid market-functioning capture date');
  const coverageEnd = easternFields(now.toISOString()).date;
  if (coverageEnd < coverageStart) throw new Error('Capture predates the reviewed primary-dealer structural regime');
  const breaks = await capture(DEALER_SERIES_BREAKS_URL,fetchImpl), definitions = JSON.parse(breaks.text)?.pd?.seriesbreaks;
  const matching = Array.isArray(definitions) ? definitions.filter(row => row.seriesbreak === breakId) : [];
  if (matching.length !== 1 || matching[0].startdate !== coverageStart || dateKey(matching[0].enddate) < coverageEnd) throw new Error('Primary-dealer structural regime changed; source admission review required');
  const sofrUrl = referenceUrl('SOFR',coverageEnd), effrUrl = referenceUrl('EFFR',coverageEnd);
  const [dealer,sofr,effr] = await Promise.all([DEALER_STATISTICS_URL,sofrUrl,effrUrl].map(url => capture(url,fetchImpl)));
  const parsed = parseDealerStatistics(JSON.parse(dealer.text));
  for (const series of Object.values(parsed.series)) series.observations = series.observations.filter(row => row.date <= coverageEnd);
  const dealerHistory = parsed.dealerHistory.filter(row => row.date <= coverageEnd);
  const fundingRates = {sofr:parseReferenceRates(JSON.parse(sofr.text),'SOFR').filter(row => row.date <= coverageEnd),effr:parseReferenceRates(JSON.parse(effr.text),'EFFR').filter(row => row.date <= coverageEnd)};
  if (!dealerHistory.length || Object.values(parsed.series).some(series => !series.observations.some(row => finite(row.value))) || Object.values(fundingRates).some(rows => !rows.some(row => finite(row.value)))) throw new Error('No usable New York Fed observations inside capture coverage');
  const provenance = [breaks,dealer,sofr,effr].map(({text,...metadata}) => metadata);
  const series = {
    ...parsed.series,
    ...Object.fromEntries(['sofr','effr'].map(id => [id,{observations:fundingRates[id],sourceIds:[`${id.toUpperCase()}:percentRate`],sourceUrl:id === 'sofr' ? sofrUrl : effrUrl,sourceTitle:rateTitles[id],calculation:'Published New York Fed reference rate, percent. Date is the underlying effective business day, not a verified release timestamp. Revisions retain the published revision indicator.',observationType:'official',dataStatus:'official',sourceNotice:rateNotice,licenseUrl:NY_FED_TERMS_URL,coverageNote:`${id === 'sofr' ? 'SOFR begins 2018-04-02, its first effective date; first published 2018-04-03. Earlier indicative rates are excluded.' : 'EFFR begins 2016-03-01 under the current transaction-based volume-weighted median methodology. Earlier mean-based EFFR is excluded.'} Published distribution endpoints are transaction-rate percentiles, not uncertainty intervals. Volume is USD billions. Source contingency footnotes and raw revision indicators (r or Y meaning Revised) are retained. Missing percentiles remain null; no missing dates are filled.`}])),
    sofrEffrSpread:{observations:fundingRateDifference(fundingRates.sofr,fundingRates.effr).filter(row => row.date >= FUNDING_RATE_STARTS.sofr),sourceIds:['SOFR:percentRate','EFFR:percentRate'],sourceUrl:sofrUrl,sourceUrls:[sofrUrl,effrUrl],sourceTitle:`${rateTitles.sofr}; ${rateTitles.effr}`,calculation:'100 × (SOFR − EFFR) for the identical effective date, basis points, from SOFR inception on 2018-04-02. Unmatched effective dates remain null. Meridian calculation across two distinct funding markets; not an exact credit-risk or liquidity decomposition.',observationType:'calculated',dataStatus:'calculated',sourceNotice:`${rateNotice} The SOFR−EFFR difference is a Meridian calculation.`,licenseUrl:NY_FED_TERMS_URL,coverageNote:MARKET_FUNCTIONING_LIMITATION},
  };
  return {id:'marketFunctioning',fetchedAt:provenance.map(row => row.retrievedAt).sort().at(-1),series,dealerHistory,fundingRates,coverageStart,coverageEnd,structuralBreak:breakId,coverageNote:MARKET_FUNCTIONING_LIMITATION,sourceNotice:rateNotice,licenseUrl:NY_FED_TERMS_URL,provenance,warnings:['Primary-dealer values marked * by the source are suppressed and remain missing; no older value is substituted.','Daily funding rates and weekly dealer indicators have distinct periods and coverage.']};
}
