import { parseCsv, requestText } from './http.mjs';
import { NOMINAL_YIELD_TENORS, REAL_YIELD_TENORS, YIELD_METHODOLOGY_CHANGE, matchedYieldComponents } from '../../src/yields.js';

const HISTORY_YEARS = 5;
const MISSING = new Set(['','N/A','NA','NULL']);
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clean = value => Number(value.toFixed(10));
const aliases = { '1M':['1 mo'], '1.5M':['1.5 month','1.5 mo'], '2M':['2 mo'], '3M':['3 mo'], '4M':['4 mo'], '6M':['6 mo'], '1Y':['1 yr'], '2Y':['2 yr'], '3Y':['3 yr'], '5Y':['5 yr'], '7Y':['7 yr'], '10Y':['10 yr'], '20Y':['20 yr'], '30Y':['30 yr'] };
const normalize = value => String(value).replace(/^\uFEFF/,'').trim().toLowerCase().replace(/\s+/g,' ');
const emptyRates = tenors => Object.fromEntries(tenors.map(tenor => [tenor,null]));

function parseDate(value) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value).trim());
  if (!match) throw new Error('Invalid Treasury curve date');
  const date = `${match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) throw new Error('Invalid Treasury curve date');
  return date;
}

function parseNumber(value) {
  const text = String(value).trim();
  if (MISSING.has(text.toUpperCase())) return null;
  if (!NUMBER.test(text) || !Number.isFinite(Number(text))) throw new Error('Invalid Treasury curve number');
  return Number(text);
}

function sortedUnique(rows) {
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.date)) throw new Error(`Duplicate Treasury curve date: ${row.date}`);
    seen.add(row.date);
  }
  return [...rows].sort((a,b) => a.date.localeCompare(b.date));
}

/** Read the agency's CSV headers; missing columns and marked observations remain missing. */
export function parseParYieldCsv(text, kind) {
  const tenors = kind === 'nominal' ? NOMINAL_YIELD_TENORS : kind === 'real' ? REAL_YIELD_TENORS : null;
  if (!tenors) throw new Error('Invalid Treasury curve kind');
  if (typeof text !== 'string' || text.trimStart().startsWith('<')) throw new Error('Unrecognized Treasury curve CSV');
  const [header,...rows] = parseCsv(text), names = (header ?? []).map(normalize);
  const dateIndex = names.indexOf('date');
  if (dateIndex < 0 || !names.includes('10 yr') || new Set(names).size !== names.length) throw new Error('Unrecognized or duplicate Treasury curve headers');
  const indices = tenors.map(tenor => {
    const matches = names.map((name,index) => aliases[tenor].includes(name) ? index : -1).filter(index => index >= 0);
    if (matches.length > 1) throw new Error(`Duplicate Treasury curve tenor header: ${tenor}`);
    return matches[0] ?? -1;
  });
  const populatedRows=rows.filter(row => row.some(value => String(value).trim()));
  const nominalSpecific=NOMINAL_YIELD_TENORS.filter(tenor=>!REAL_YIELD_TENORS.includes(tenor));
  const hasNominalHeader=nominalSpecific.some(tenor=>aliases[tenor].some(alias=>names.includes(alias)));
  if(kind==='real'&&hasNominalHeader)throw new Error('Treasury real curve response contains nominal-only tenor headers');
  if(kind==='nominal'&&populatedRows.length&&!hasNominalHeader)throw new Error('Treasury nominal curve response lacks nominal-specific tenor headers');
  return sortedUnique(populatedRows.map(row => {
    if (row.length !== header.length) throw new Error('Invalid Treasury curve row width');
    return {date:parseDate(row[dateIndex]), rates:Object.fromEntries(tenors.map((tenor,index) => [tenor,indices[index] < 0 ? null : parseNumber(row[indices[index]])]))};
  }));
}

/** The union keeps unmatched feed dates visible; calculations require both inputs on that same date. */
export function joinParCurves(nominalRows, realRows) {
  const nominal = new Map(sortedUnique(nominalRows).map(row => [row.date,row.rates]));
  const real = new Map(sortedUnique(realRows).map(row => [row.date,row.rates]));
  return [...new Set([...nominal.keys(),...real.keys()])].sort().map(date => ({
    date, nominal:{...emptyRates(NOMINAL_YIELD_TENORS),...nominal.get(date)}, real:{...emptyRates(REAL_YIELD_TENORS),...real.get(date)},
  }));
}

export function treasuryParYieldUrl(year, kind = 'nominal') {
  if (!Number.isInteger(year) || year < 1990 || year > 9999 || !['nominal','real'].includes(kind)) throw new Error('Invalid Treasury yield feed year or kind');
  const type = kind === 'nominal' ? 'daily_treasury_yield_curve' : 'daily_treasury_real_yield_curve';
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=${type}&field_tdr_date_value=${year}&page&_format=csv`;
}

export async function collectYields({fetchImpl = globalThis.fetch, now = new Date()} = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid Treasury yield capture date');
  const cutoff = now.toISOString().slice(0,10), year = now.getUTCFullYear();
  const responses = [], nominalRows = [], realRows = [];
  // Two bounded, independent requests at a time. The current year may have no publication at New Year.
  for (let captureYear = Math.max(2003,year-HISTORY_YEARS+1); captureYear <= year; captureYear++) {
    const pair = await Promise.all(['nominal','real'].map(async kind => {
      const response = await requestText(treasuryParYieldUrl(captureYear,kind),{fetchImpl,maxBytes:2*1024*1024});
      const rows = parseParYieldCsv(response.text,kind);
      if (rows.some(row => Number(row.date.slice(0,4)) !== captureYear)) throw new Error('Treasury curve response contains observations outside its requested year');
      return {kind,response,rows:rows.filter(row => row.date <= cutoff)};
    }));
    for (const {kind,response,rows} of pair) {
      responses.push(response);
      (kind === 'nominal' ? nominalRows : realRows).push(...rows);
    }
  }
  for (const [kind,rows] of [['nominal',nominalRows],['real',realRows]]) {
    if (!rows.some(row => finite(row.rates['10Y']))) throw new Error(`No usable Treasury ${kind} par-yield observations`);
  }
  const curveHistory = joinParCurves(nominalRows,realRows), matched = matchedYieldComponents({curveHistory});
  const nominalUrl = treasuryParYieldUrl(year), realUrl = treasuryParYieldUrl(year,'real');
  const observations = callback => curveHistory.map(row => ({date:row.date,value:callback(row),publishedAt:null}));
  const difference = (left,right) => finite(left) && finite(right) ? clean((left-right)*100) : null;
  const series = (sourceIds,sourceUrl,calculation,observationType,values,sourceUrls=[sourceUrl]) => ({
    sourceIds,sourceUrl,sourceUrls,calculation,observationType,dataStatus:observationType,
    observations:values.map(row => {
      const observationYear = Number(row.date.slice(0,4));
      const inputs = sourceUrls.map(url => treasuryParYieldUrl(observationYear,new URL(url).searchParams.get('type') === 'daily_treasury_real_yield_curve' ? 'real' : 'nominal'));
      return {...row,sourceUrl:inputs[0],sourceUrls:inputs};
    }),
  });
  return {
    id:'yields', fetchedAt:responses.map(row => row.retrievedAt).sort().at(-1),
    coverageStart:curveHistory[0].date, coverageEnd:curveHistory.at(-1).date,
    coverageNote:'Five calendar years of published Treasury nominal and TIPS real par curves. Missing feed dates and tenors are not filled. The observation cutoff does not reconstruct historical data vintages. Source release timestamps are not supplied; retrieval timestamps are separate.',
    series:{
      spread2s10s:series(['BC_10YEAR','BC_2YEAR'],nominalUrl,'100 × (10-year minus 2-year nominal par yield) on the same observation date; basis points.','calculated',observations(row => difference(row.nominal['10Y'],row.nominal['2Y']))),
      spread3m10y:series(['BC_10YEAR','BC_3MONTH'],nominalUrl,'100 × (10-year minus 3-month nominal par yield) on the same observation date; basis points.','calculated',observations(row => difference(row.nominal['10Y'],row.nominal['3M']))),
      realYield10:series(['TC_10YEAR'],realUrl,'Published 10-year Treasury TIPS real par yield; percent.','official',observations(row => row.real['10Y'])),
      inflationComp10:series(['BC_10YEAR','TC_10YEAR'],nominalUrl,'100 × (10-year nominal par yield minus same-date 10-year TIPS real par yield); basis points. Inflation compensation includes inflation-risk and liquidity effects and is not pure expected inflation.','calculated',matched.map(row => ({date:row.date,value:row.inflationCompensationBps,publishedAt:null})),[nominalUrl,realUrl]),
      nominalYield2:series(['BC_2YEAR'],nominalUrl,'Published 2-year Treasury nominal par yield; percent.','official',observations(row => row.nominal['2Y'])),
      nominalYield3m:series(['BC_3MONTH'],nominalUrl,'Published 3-month Treasury nominal par yield; percent.','official',observations(row => row.nominal['3M'])),
    },
    curveHistory,
    methodologyBreaks:[{date:YIELD_METHODOLOGY_CHANGE,from:'quasi-cubic-hermite-spline',to:'monotone-convex',sourceUrl:'https://home.treasury.gov/policy-issues/financing-the-government/yield-curve-methodology-change-information-sheet'}],
    provenance:responses.map(({text,...metadata}) => metadata), warnings:[],
  };
}
