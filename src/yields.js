/** Treasury rates are published par-curve observations, not transaction or zero-coupon yields. */
export const NOMINAL_YIELD_TENORS = Object.freeze(['1M','1.5M','2M','3M','4M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y']);
export const REAL_YIELD_TENORS = Object.freeze(['5Y','7Y','10Y','20Y','30Y']);
export const REAL_YIELD_INPUT_CHANGE = '2008-12-01';
export const YIELD_METHODOLOGY_CHANGE = '2021-12-06';
export const H15_TREASURY_CMT_URL = 'https://www.federalreserve.gov/datadownload/Output.aspx?rel=H15&series=bf17364827e38702b42a58cf8eaa3f78&lastobs=&from=&to=&filetype=csv&label=include&layout=seriescolumn&type=package';
export const H15_3M_GAP_DATES = Object.freeze(['2008-12-10','2008-12-18','2008-12-24']);
export const H15_3M_GAP_NOTE = 'Treasury annual CSV reports no 3-month rate on this date. Official Federal Reserve Board H.15 series RIFLGFCM03_N.B reports the same Treasury constant-maturity measure as 0.00 percent; other available same-date nominal tenors match. The primary null and both source receipts are retained.';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const rate = value => finite(value) ? value : null;
const clean = value => Number(value.toFixed(10));

function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid Treasury curve date');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw new Error('Invalid Treasury curve date');
  return value;
}

function capturedCurves(source) {
  const seen = new Set();
  return (source?.curveHistory ?? []).map(row => {
    dateKey(row.date);
    if (seen.has(row.date)) throw new Error(`Duplicate Treasury curve date: ${row.date}`);
    seen.add(row.date);
    return row;
  }).sort((a,b) => a.date.localeCompare(b.date));
}

/** Date-input choices use nearest UTC calendar distance; equal distances choose earlier. */
export function nearestCurveDate(source, requested) {
  try { dateKey(requested); } catch { return null; }
  const target=Date.parse(`${requested}T00:00:00Z`);
  const distance=date=>Math.abs(Date.parse(`${date}T00:00:00Z`)-target);
  return capturedCurves(source).reduce((nearest,row)=>nearest===null||distance(row.date)<distance(nearest)?row.date:nearest,null);
}

/** Exact requested dates only; unavailable dates are explicit and no earlier curve is substituted. */
export function selectCurveOverlays(source, dates = []) {
  if (!Array.isArray(dates)) throw new Error('Treasury overlay dates must be an array');
  const curves = new Map(capturedCurves(source).map(row => [row.date,row]));
  return dates.map(date => {
    dateKey(date);
    const row = curves.get(date);
    const copyRates = (values,tenors) => Object.fromEntries(tenors.filter(tenor => Object.hasOwn(values ?? {},tenor)).map(tenor => [tenor,rate(values[tenor])]));
    return {
      date, available:Boolean(row),
      nominal:copyRates(row?.nominal,NOMINAL_YIELD_TENORS),
      real:copyRates(row?.real,REAL_YIELD_TENORS),
      ...(row?.nominalSupplements?{nominalSupplements:structuredClone(row.nominalSupplements)}:{}),
      methodology:date < YIELD_METHODOLOGY_CHANGE ? 'quasi-cubic-hermite-spline' : 'monotone-convex',
      realCurveInputs:date < REAL_YIELD_INPUT_CHANGE ? 'all-tips-securities' : 'most-recently-auctioned-tips',
    };
  });
}

/** The difference includes inflation-risk and liquidity effects; it is not pure expected inflation. */
export function matchedYieldComponents(source, {tenor = '10Y'} = {}) {
  if (!REAL_YIELD_TENORS.includes(tenor)) throw new RangeError(`No matched Treasury real par yield tenor: ${tenor}`);
  return capturedCurves(source).map(row => {
    const nominal = rate(row.nominal?.[tenor]), real = rate(row.real?.[tenor]);
    return {
      date:row.date, tenor, nominal, real,
      inflationCompensationBps:nominal !== null && real !== null ? clean((nominal-real)*100) : null,
    };
  });
}

/** Shortcuts resolve only to retained observations on/before the stated target. */
export function yieldComparisonShortcuts(source, anchorDate) {
  const curves = capturedCurves(source),dates = curves.map(row=>row.date),dateA = anchorDate || dates.at(-1);
  if (!dateA || !dates.includes(dateA)) return [];
  const instant = new Date(`${dateA}T00:00:00Z`),previousMonthLast = new Date(Date.UTC(instant.getUTCFullYear(),instant.getUTCMonth(),0));
  const monthDate = new Date(Date.UTC(instant.getUTCFullYear(),instant.getUTCMonth()-1,Math.min(instant.getUTCDate(),previousMonthLast.getUTCDate()))).toISOString().slice(0,10);
  const targets = [['1D',dates.filter(date=>date<dateA).at(-1),'Previous retained observation'],['1W',new Date(instant.getTime()-7*86400000).toISOString().slice(0,10),'One calendar week earlier'],['1M',monthDate,'One calendar month earlier'],['YTD',`${instant.getUTCFullYear()-1}-12-31`,'Last retained observation of the preceding year']];
  return targets.map(([label,targetDate,basis])=>({label,dateA,dateB:targetDate?dates.filter(date=>date<=targetDate).at(-1)??null:null,targetDate:targetDate??null,basis}));
}

export function selectedYieldChanges(source, dateA, dateB, {tenor = '10Y'} = {}) {
  if (!REAL_YIELD_TENORS.includes(tenor)) throw new RangeError('Selected yield changes require a matched real tenor');
  const [a,b] = selectCurveOverlays(source,[dateA,dateB]);
  const measures = curve => ({nominal:rate(curve.nominal[tenor]),real:rate(curve.real[tenor]),inflationCompensation:finite(curve.nominal[tenor])&&finite(curve.real[tenor])?clean((curve.nominal[tenor]-curve.real[tenor])*100):null});
  const valuesA = measures(a),valuesB = measures(b);
  return Object.fromEntries(Object.keys(valuesA).map(measure=>[measure,{a:valuesA[measure],b:valuesB[measure],changeBps:valuesA[measure]!==null&&valuesB[measure]!==null?clean((valuesA[measure]-valuesB[measure])*(measure==='inflationCompensation'?1:100)):null}]));
}

/** Named dates are retained official schedules or documented Treasury method changes, not causal claims. */
export function yieldEventComparisons(source, events = []) {
  const dates = capturedCurves(source).map(row=>row.date);
  const scheduled = events.filter(event=>event.sourceId==='fomc'&&event.program==='fomc-decision').map(event=>({date:event.date,label:`FOMC scheduled decision · ${event.date}`,sourceUrl:event.sourceUrl,basis:'Official scheduled date; this label does not verify when a decision was published.'}));
  const methodology = [{date:REAL_YIELD_INPUT_CHANGE,label:'TIPS curve inputs · 2008-12-01'},{date:YIELD_METHODOLOGY_CHANGE,label:'Curve fitting change · 2021-12-06'}].map(event=>({...event,sourceUrl:'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology',basis:'Documented Treasury methodology change; comparison does not identify a causal effect.'}));
  return [...scheduled.filter(event=>dates.includes(event.date)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3),...methodology].filter(event=>dates.includes(event.date)&&dates.some(date=>date<event.date)).map(event=>({...event,dateA:event.date,dateB:dates.filter(date=>date<event.date).at(-1)}));
}
