import { parseCsv, requestText } from './http.mjs';
import { DEBT_HISTORY_START, debtHistoryUrl, requireCompleteDebtHistory } from './treasury-debt.mjs';
import { collectDebtFallback } from './debt-fallback.mjs';
import { DTS_DEBT_URL, DTS_DEBT_VALUES, DTS_DEBT_NOTE, isDtsDebtFallbackRow, debtFallbackMetadata } from '../../src/debt-fallback.js';

const TENORS = [
  ['1M', 1 / 12, ['1 Mo']],
  ['1.5M', 0.125, ['1.5 Month', '1.5 Mo']],
  ['2M', 2 / 12, ['2 Mo']],
  ['3M', 0.25, ['3 Mo']],
  ['4M', 4 / 12, ['4 Mo']],
  ['6M', 0.5, ['6 Mo']],
  ['1Y', 1, ['1 Yr']],
  ['2Y', 2, ['2 Yr']],
  ['3Y', 3, ['3 Yr']],
  ['5Y', 5, ['5 Yr']],
  ['7Y', 7, ['7 Yr']],
  ['10Y', 10, ['10 Yr']],
  ['20Y', 20, ['20 Yr']],
  ['30Y', 30, ['30 Yr']],
];

function nullableNumber(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function calendarDate(year, month, day) {
  const text = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const parsed = new Date(`${text}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error(`Invalid Treasury observation date: ${text}`);
  }
  return text;
}

function isoDate(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text));
  if (!match) throw new Error(`Invalid Treasury observation date: ${text}`);
  return calendarDate(match[1], Number(match[2]), Number(match[3]));
}

function csvDate(text) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text).trim());
  if (!match) throw new Error(`Invalid Treasury yield date: ${text}`);
  return calendarDate(match[3], Number(match[1]), Number(match[2]));
}

function sortedUnique(rows) {
  const unique=new Map();
  for(const row of rows) {
    if(unique.has(row.date))throw new Error(`Duplicate Treasury observation date: ${row.date}`);
    unique.set(row.date,row);
  }
  return [...unique.values()].sort((left, right) => left.date.localeCompare(right.date));
}

function requireUsable(observations, name) {
  if (!observations.some(row => row.value !== null && Number.isFinite(row.value))) {
    throw new Error(`No usable Treasury ${name} observations`);
  }
  return observations;
}

export function parseDebt(payload, { debtFallback = null, primaryReceipt = null, quarantineSourceResiduals = false } = {}) {
  if (!payload || !Array.isArray(payload.data)) throw new Error('Invalid Treasury debt response: expected a data array');
  const observations = payload.data.map(row => {
    const dollars = nullableNumber(row.tot_pub_debt_out_amt);
    const publicDebt = nullableNumber(row.debt_held_public_amt), intragovernmentalDebt = nullableNumber(row.intragov_hold_amt);
    const unavailable = row.record_date < '2005-04-04' && publicDebt === 0 && intragovernmentalDebt === 0;
    const residual = dollars === null || publicDebt === null || intragovernmentalDebt === null || unavailable ? null : Number((dollars - publicDebt - intragovernmentalDebt).toFixed(2));
    const invalid = quarantineSourceResiduals && residual !== null && Math.abs(residual) > 1;
    const fallback = debtFallback && isDtsDebtFallbackRow(row);
    return {
      date: isoDate(row.record_date),
      value: fallback ? Number(DTS_DEBT_VALUES.tot_pub_debt_out_amt) / 1e6 : dollars === null || invalid ? null : dollars / 1e12,
      publishedAt: null,
      sourceValue: row.tot_pub_debt_out_amt === null || row.tot_pub_debt_out_amt === undefined ? 'null' : String(row.tot_pub_debt_out_amt),
      ...(fallback ? debtFallbackMetadata('tot_pub_debt_out_amt', debtFallback, primaryReceipt) : invalid ? { reconciliation: 'source-residual-quarantined', reconciliationResidualUSD: residual, primarySourceValues: { debt_held_public_amt: String(row.debt_held_public_amt), intragov_hold_amt: String(row.intragov_hold_amt), tot_pub_debt_out_amt: String(row.tot_pub_debt_out_amt) } } : {}),
    };
  });
  return requireUsable(sortedUnique(observations), 'debt');
}

function parseYieldRows(text) {
  const [header, ...rows] = parseCsv(text);
  const normalize = value => String(value).replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
  const names = (header ?? []).map(normalize);
  const dateIndex = names.indexOf('date');
  if (dateIndex < 0 || !names.includes('10 yr')) throw new Error('Unrecognized Treasury yield CSV headers');
  const indices = TENORS.map(([, , aliases]) => names.findIndex(name => aliases.some(alias => normalize(alias) === name)));
  return sortedUnique(rows.filter(row => row.some(value => String(value).trim())).map(row => ({
    date: csvDate(row[dateIndex]),
    rates: TENORS.map((_, index) => indices[index] < 0 ? null : nullableNumber(row[indices[index]])),
  })));
}

function buildYieldResult(rows) {
  const tenYearIndex = TENORS.findIndex(([tenor]) => tenor === '10Y');
  const observations = requireUsable(rows.map(row => ({ date: row.date, value: row.rates[tenYearIndex], publishedAt: null })), 'yield');
  const latest = rows.at(-1);
  const previous = rows.at(-2);
  return {
    observations,
    yieldCurve: TENORS.map(([tenor, years], index) => ({ tenor, years, value: latest.rates[index], previous: previous?.rates[index] ?? null })),
    curveDate: latest.date,
    previousCurveDate: previous?.date ?? null,
  };
}

export function parseYieldCsv(text) {
  return buildYieldResult(parseYieldRows(text));
}

function yieldUrl(year) {
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
}

/** Reuse equivalent approved nominal par curves, retaining each input's real capture. */
export function harmonizeTreasuryYieldHistory(treasury,yields,{previousTreasury}={}) {
  if(!treasury?.series?.yield||!yields?.curveHistory?.length)return treasury;
  const nominalCapture=item=>{
    try{return new URL(item.url).searchParams.get('type')==='daily_treasury_yield_curve';}catch{return false;}
  };
  const byDate=new Map();
  const add=(source,rows)=>{
    const seen=new Set();
    for(const row of rows){
      if(seen.has(row.date))throw new Error('Duplicate date in main 10Y source history');seen.add(row.date);
    const sourceUrl=yieldUrl(Number(row.date.slice(0,4)));
      if(row.sourceUrl&&row.sourceUrl!==sourceUrl)throw new Error('Invalid annual source URL for main 10Y history');
      const captures=(source.provenance??[]).filter(item=>item.url===sourceUrl&&(!row.sourceSha256||row.sourceSha256===item.sha256)&&(!row.retrievedAt||!item.retrievedAt||row.retrievedAt===item.retrievedAt));
      if(!captures.length)throw new Error('Missing captured annual provenance for main 10Y yield history');
      const capture=captures.sort((a,b)=>(a.retrievedAt??'').localeCompare(b.retrievedAt??'')).at(-1);
      const retrievedAt=row.retrievedAt??capture.retrievedAt??source.series?.yield?.fetchedAt??source.fetchedAt;
      if(!Number.isFinite(Date.parse(retrievedAt)))throw new Error('Missing actual capture time for main 10Y yield history');
      const value=row.value;
      if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)))throw new Error('Invalid main 10Y yield value');
      const candidate={date:isoDate(row.date),value,publishedAt:null,sourceUrl,retrievedAt,sourceSha256:capture.sha256};
      const existing=byDate.get(row.date);
      if(!existing||Date.parse(retrievedAt)>=Date.parse(existing.retrievedAt))byDate.set(row.date,candidate);
    }
  };
  if(previousTreasury?.series?.yield?.observations?.length)add(previousTreasury,previousTreasury.series.yield.observations);
  add(treasury,treasury.series.yield.observations);
  add(yields,yields.curveHistory.map(row=>({date:row.date,value:row.nominal?.['10Y']??null})));
  const observations=sortedUnique([...byDate.values()]);
  requireUsable(observations,'yield');
  const provenance=[...(treasury.provenance??[]),...(previousTreasury?.provenance??[]).filter(nominalCapture),...(yields.provenance??[]).filter(nominalCapture)];
  const merged=new Map(provenance.map(item=>[`${item.url}|${item.retrievedAt}|${item.sha256}`,item]));
  const fetchedAt=observations.map(row=>row.retrievedAt).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);
  const sourceFetchedAt=[treasury.fetchedAt,fetchedAt,...[...merged.values()].map(row=>row.retrievedAt)].filter(time=>Number.isFinite(Date.parse(time))).sort((a,b)=>Date.parse(a)-Date.parse(b)).at(-1);
  return {...treasury,fetchedAt:sourceFetchedAt,series:{...treasury.series,...(treasury.series.debt?{debt:{...treasury.series.debt,fetchedAt:treasury.series.debt.fetchedAt??treasury.fetchedAt}}:{}),yield:{...treasury.series.yield,observations,fetchedAt,inputProvenanceScope:'observation-source-urls',sourceUrl:yieldUrl(Number(observations.at(-1).date.slice(0,4))),coverageNote:'Retained official 10-year nominal par history from the approved annual curve files. Each row retains its actual retrieval timestamp and response hash; later captures win only on matching dates. No filled dates or synthetic publication times.',calculation:'Published daily 10-year Treasury nominal par yield, percent; reused from the approved dated nominal curve history. Annual source URL and capture provenance retained; no synthetic release date or fill.'}},provenance:[...merged.values()]};
}

export async function collectTreasury({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const cutoff = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const sourceUrl = yieldUrl(year);
  const debtUrl = debtHistoryUrl('record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt', cutoff);
  const [debtResponse, currentYieldResponse] = await Promise.all([
    requestText(debtUrl, { fetchImpl: async (url, options) => {
      const response = await fetchImpl(url, options);
      if (response.redirected || (response.url && response.url !== url)) throw new Error('Unreviewed Treasury debt source URL or redirect');
      return response;
    }, maxBytes: 8 * 1024 * 1024 }),
    requestText(sourceUrl, { fetchImpl }),
  ]);
  const responses = [debtResponse, currentYieldResponse];
  const debtPayload=JSON.parse(debtResponse.text);
  requireCompleteDebtHistory(debtPayload);
  const { text: _debtText, ...debtProvenance } = debtResponse;
  const debtFallback = await collectDebtFallback(debtPayload, { cutoff, fetchImpl });
  const debtReceipts = [debtProvenance, ...(debtFallback ? [debtFallback] : [])];
  if (debtFallback) responses.push(debtFallback);
  const debt = requireUsable(parseDebt(debtPayload, { debtFallback, primaryReceipt: debtProvenance, quarantineSourceResiduals: true }).filter(row => row.date <= cutoff && row.date >= DEBT_HISTORY_START), 'debt');
  let rows = parseYieldRows(currentYieldResponse.text).filter(row => row.date <= cutoff);
  const tenYearIndex = TENORS.findIndex(([tenor]) => tenor === '10Y');
  if (rows.filter(row => row.rates[tenYearIndex] !== null).length < 36) {
    const previousYieldResponse = await requestText(yieldUrl(year - 1), { fetchImpl });
    responses.push(previousYieldResponse);
    rows = sortedUnique([...parseYieldRows(previousYieldResponse.text), ...rows]).filter(row => row.date <= cutoff);
  }
  const curve = buildYieldResult(rows);
  return {
    id: 'treasury',
    fetchedAt: responses.map(response => response.retrievedAt).sort().at(-1),
    series: {
      debt: {
        observations: debt,
        fetchedAt: debtReceipts.map(item => item.retrievedAt).sort().at(-1),
        provenance: debtReceipts,
        calculation: 'USD dollars / 1e12' + (debtFallback ? '; 2025-08-04 official DTS USD millions / 1e6, reported at USD 1,000,000 precision' : ''),
        sourceUrl: debtUrl,
        ...(debtFallback ? { sourceUrls: [debtUrl, DTS_DEBT_URL] } : {}),
        sourceIds: ['tot_pub_debt_out_amt'],
        dataStatus: 'official',
        coverageNote:'Official daily gross debt history from 1 April 1993 through the capture cutoff. Actual record dates only; weekends and missing dates are not filled. Current published history captured at its actual retrieval date, not historical first releases. The complete history must fit the reviewed 10,000-row single-page bound or collection fails.' + (debtFallback ? ` ${DTS_DEBT_NOTE}` : ''),
      },
      yield: {
        observations: curve.observations,
        calculation: 'Published daily Treasury par yield, percent',
        sourceUrl,
        sourceIds: ['BC_10YEAR'],
        dataStatus: 'official',
      },
    },
    yieldCurve: curve.yieldCurve,
    curveDate: curve.curveDate,
    previousCurveDate: curve.previousCurveDate,
    provenance: responses.map(({ text, ...metadata }) => metadata),
    warnings: [...(debtFallback ? [DTS_DEBT_NOTE] : []), ...debt.filter(row => row.reconciliation === 'source-residual-quarantined').map(row => `Debt for ${row.date} is unavailable: published gross debt does not reconcile with public plus intragovernmental debt. Raw amounts and residual are retained.`)],
  };
}
