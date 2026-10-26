import { parseCsv, requestText } from './http.mjs';
import { NOMINAL_YIELD_TENORS, REAL_YIELD_TENORS, REAL_YIELD_INPUT_CHANGE, YIELD_METHODOLOGY_CHANGE, matchedYieldComponents, H15_TREASURY_CMT_URL, H15_3M_GAP_DATES, H15_3M_GAP_NOTE } from '../../src/yields.js';

const HISTORY_START_YEAR = 2003;
const MISSING = new Set(['','N/A','NA','NULL']);
const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clean = value => Number(value.toFixed(10));
const aliases = { '1M':['1 mo'], '1.5M':['1.5 month','1.5 mo'], '2M':['2 mo'], '3M':['3 mo'], '4M':['4 mo'], '6M':['6 mo'], '1Y':['1 yr'], '2Y':['2 yr'], '3Y':['3 yr'], '5Y':['5 yr'], '7Y':['7 yr'], '10Y':['10 yr'], '20Y':['20 yr'], '30Y':['30 yr'] };
const normalize = value => String(value).replace(/^\uFEFF/,'').trim().toLowerCase().replace(/\s+/g,' ');
const emptyRates = tenors => Object.fromEntries(tenors.map(tenor => [tenor,null]));
const h15Tenors = ['1M','3M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y'];
const h15Codes = ['RIFLGFCM01_N.B','RIFLGFCM03_N.B','RIFLGFCM06_N.B','RIFLGFCY01_N.B','RIFLGFCY02_N.B','RIFLGFCY03_N.B','RIFLGFCY05_N.B','RIFLGFCY07_N.B','RIFLGFCY10_N.B','RIFLGFCY20_N.B','RIFLGFCY30_N.B'];

/** This package also contains discontinued-tenor alternatives; only three reviewed 3M cells are eligible. */
function parseH15CmtCsv(text) {
  const rows=parseCsv(text),fail=()=>{throw new Error('Invalid H15 Treasury constant-maturity supplement');};
  const terms=['1-month','3-month','6-month','1-year','2-year','3-year','5-year','7-year','10-year','20-year','30-year'];
  const metadata=[['Series Description',...terms.map(term=>`Market yield on U.S. Treasury securities at ${term} constant maturity, quoted on investment basis`)],['Unit:',...h15Codes.map(()=>'Percent:_Per_Year')],['Multiplier:',...h15Codes.map(()=>'1')],['Currency:',...h15Codes.map(()=>'NA')],['Unique Identifier:',...h15Codes.map(code=>'H15/H15/'+code)],['Time Period',...h15Codes]];
  if(rows.length<=6||rows.length>20006||metadata.some((expected,index)=>rows[index]?.length!==expected.length||expected.some((value,column)=>normalize(rows[index][column])!==normalize(value))))fail();
  const result=new Map();
  for(const row of rows.slice(6)){
    const day=row[0],parsed=new Date(`${day}T00:00:00Z`);
    if(row.length!==12||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(+parsed)||parsed.toISOString().slice(0,10)!==day||result.has(day))fail();
    const values=row.slice(1).map(value=>{if(value===''||value==='ND')return null;if(!NUMBER.test(value)||!Number.isFinite(Number(value)))fail();return Number(value);});
    result.set(day,{rates:Object.fromEntries(h15Tenors.map((tenor,index)=>[tenor,values[index]])),sourceValue:row[2]});
  }
  return result;
}

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
  for (let captureYear = HISTORY_START_YEAR; captureYear <= year; captureYear++) {
    const pair = await Promise.all(['nominal','real'].map(async kind => {
      const response = await requestText(treasuryParYieldUrl(captureYear,kind),{fetchImpl,maxBytes:2*1024*1024});
      const rows = parseParYieldCsv(response.text,kind);
      if (rows.some(row => Number(row.date.slice(0,4)) !== captureYear)) throw new Error('Treasury curve response contains observations outside its requested year');
      if (captureYear < year && rows.length === 0) throw new Error(`Empty Treasury ${kind} curve response for past year ${captureYear}`);
      if (captureYear < year && !rows.some(row => finite(row.rates['10Y']))) throw new Error(`No usable Treasury ${kind} 10-year observations for past year ${captureYear}`);
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
  const curveHistory = joinParCurves(nominalRows,realRows);
  const gaps=curveHistory.filter(row=>H15_3M_GAP_DATES.includes(row.date)&&row.nominal['3M']===null);
  if(gaps.length){
    const response=await requestText(H15_TREASURY_CMT_URL,{fetchImpl:async(url,options)=>{const result=await fetchImpl(url,options);if(result.redirected||(result.url&&result.url!==url))throw new Error('Unreviewed H15 supplement redirect');return result;},maxBytes:2*1024*1024});
    if(response.url!==H15_TREASURY_CMT_URL)throw new Error('Unreviewed H15 supplement URL');
    const supplemental=parseH15CmtCsv(response.text);
    for(const primary of gaps){
      const alternate=supplemental.get(primary.date);
      if(!alternate||alternate.sourceValue!=='0.00'||alternate.rates['3M']!==0||!finite(primary.nominal['2Y'])||!finite(primary.nominal['10Y'])||h15Tenors.some(tenor=>finite(primary.nominal[tenor])&&primary.nominal[tenor]!==alternate.rates[tenor]))throw new Error(`H15 supplement does not match Treasury controls at ${primary.date}`);
      primary.nominalSupplements={'3M':{value:0,primaryValue:null,primarySourceUrl:treasuryParYieldUrl(2008),sourceValue:alternate.sourceValue,sourceSeriesId:'RIFLGFCM03_N.B',sourceUrl:response.url,sourceSha256:response.sha256,retrievedAt:response.retrievedAt}};
      primary.nominal['3M']=0;
    }
    responses.push(response);
  }
  const matched = matchedYieldComponents({curveHistory});
  const nominalUrl = treasuryParYieldUrl(year), realUrl = treasuryParYieldUrl(year,'real');
  const observations = callback => curveHistory.map(row => ({date:row.date,value:callback(row),publishedAt:null}));
  const difference = (left,right) => finite(left) && finite(right) ? clean((left-right)*100) : null;
  const series = (sourceIds,sourceUrl,calculation,observationType,values,sourceUrls=[sourceUrl]) => ({
    sourceIds,sourceUrl,sourceUrls,calculation,observationType,dataStatus:observationType,inputProvenanceScope:'observation-source-urls',
    observations:values.map(row => {
      const observationYear = Number(row.date.slice(0,4));
      const inputs = sourceUrls.map(url => treasuryParYieldUrl(observationYear,new URL(url).searchParams.get('type') === 'daily_treasury_real_yield_curve' ? 'real' : 'nominal'));
      const supplement=sourceIds.includes('BC_3MONTH')&&gaps.find(item=>item.date===row.date)?.nominalSupplements['3M'];
      return {...row,sourceUrl:inputs[0],sourceUrls:supplement?[...inputs,H15_TREASURY_CMT_URL]:inputs,...(supplement?{footnotes:[H15_3M_GAP_NOTE],...(sourceIds.length===1?{sourceValue:supplement.sourceValue,primaryValue:null}:{})}:{})};
    }),
  });
  return {
    id:'yields', fetchedAt:responses.map(row => row.retrievedAt).sort().at(-1),
    coverageStart:curveHistory[0].date, coverageEnd:curveHistory.at(-1).date,
    ...(gaps.length?{h15GapEvidence:{version:1,curves:gaps.map(({date,nominal,nominalSupplements})=>({date,nominal:structuredClone(nominal),nominalSupplements:structuredClone(nominalSupplements)}))}}:{}),
    coverageNote:'Published Treasury nominal and TIPS real par curves from 2003 through the capture cutoff, using currently published revised history. Exactly three reviewed December 2008 3-month gaps use matched official Federal Reserve Board H.15 Treasury CMT zeros, retaining the primary null and both receipts. Other missing feed dates and tenors are not filled. The observation cutoff does not reconstruct original release vintages. Source release timestamps are not supplied; retrieval timestamps are separate.',
    series:{
      spread2s10s:series(['BC_10YEAR','BC_2YEAR'],nominalUrl,'100 × (10-year minus 2-year nominal par yield) on the same observation date; basis points.','calculated',observations(row => difference(row.nominal['10Y'],row.nominal['2Y']))),
      spread3m10y:series(['BC_10YEAR','BC_3MONTH'],nominalUrl,'100 × (10-year minus 3-month nominal par yield) on the same observation date; basis points.','calculated',observations(row => difference(row.nominal['10Y'],row.nominal['3M']))),
      realYield10:series(['TC_10YEAR'],realUrl,'Published 10-year Treasury TIPS real par yield; percent.','official',observations(row => row.real['10Y'])),
      inflationComp10:series(['BC_10YEAR','TC_10YEAR'],nominalUrl,'100 × (10-year nominal par yield minus same-date 10-year TIPS real par yield); basis points. Inflation compensation includes inflation-risk and liquidity effects and is not pure expected inflation.','calculated',matched.map(row => ({date:row.date,value:row.inflationCompensationBps,publishedAt:null})),[nominalUrl,realUrl]),
      nominalYield2:series(['BC_2YEAR'],nominalUrl,'Published 2-year Treasury nominal par yield; percent.','official',observations(row => row.nominal['2Y'])),
      nominalYield3m:series(['BC_3MONTH'],nominalUrl,'Published 3-month Treasury nominal par yield; percent.','official',observations(row => row.nominal['3M'])),
    },
    curveHistory,
    methodologyBreaks:[
      {date:REAL_YIELD_INPUT_CHANGE,kind:'real',change:'knot-point-selection',from:'all-tips-securities',to:'most-recently-auctioned-tips',sourceUrl:'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_real_yield_curve'},
      {date:YIELD_METHODOLOGY_CHANGE,from:'quasi-cubic-hermite-spline',to:'monotone-convex',sourceUrl:'https://home.treasury.gov/policy-issues/financing-the-government/yield-curve-methodology-change-information-sheet'},
    ],
    provenance:responses.map(({text,...metadata}) => metadata), warnings:[],
  };
}
