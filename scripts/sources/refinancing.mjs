import { requestText } from './http.mjs';
import { createHash } from 'node:crypto';

const BASE = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/';
const TYPES = new Map([
  ['Bills Maturity Value', 'Bill'], ['Notes', 'Note'], ['Bonds', 'Bond'],
  ['Inflation-Protected Securities', 'TIPS'], ['Floating Rate Notes', 'FRN'],
]);
const CATEGORIES = [
  ['Bills Maturity Value', 'Total Unmatured Treasury Bills'],
  ['Notes', 'Total Unmatured Treasury Notes'], ['Bonds', 'Total Unmatured Treasury Bonds'],
  ['Inflation-Protected Securities', 'Total Treasury TIPS'],
  ['Floating Rate Notes', 'Total Treasury Floating Rate Notes'],
];
const CUSIP = /^[A-Z0-9]{9}$/;
const fail = detail => { throw new Error(`MSPD refinancing: ${detail}`); };
const sum = values => values.reduce((total, value) => total + value, 0);
const missing = value => value === null || value === undefined || value === 'null';

function number(raw, name) {
  if (missing(raw) || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(String(raw))) fail(`missing or invalid ${name}`);
  const value = Number(raw);
  if (!Number.isFinite(value)) fail(`invalid ${name}`);
  return value;
}
function date(raw) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) fail('invalid date');
  const value = new Date(`${raw}T00:00:00Z`);
  if (!Number.isFinite(value.getTime()) || value.toISOString().slice(0, 10) !== raw) fail('invalid date');
  return raw;
}
function monthEnd(raw) {
  const value = new Date(`${date(raw)}T00:00:00Z`);
  if (new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate() !== value.getUTCDate()) fail('record is not a month-end date');
  return raw;
}
function rows(payload) {
  if (!payload || !Array.isArray(payload.data) || !payload.data.length) fail('empty or invalid response');
  if (Number(payload.meta?.['total-pages']) !== 1 || Number(payload.meta?.['total-count']) !== payload.data.length) fail('incomplete pagination');
  return payload.data;
}
function equal(actual, expected, label) {
  // Published values are in USD millions; this tolerance is ten dollars.
  if (Math.abs(actual - expected) > 0.00001) fail(`${label} does not reconcile`);
}
function one(data, predicate, label) {
  const matches = data.filter(predicate);
  if (matches.length !== 1) fail(`missing or duplicate ${label}`);
  return matches[0];
}
function categoryTotals(data) {
  return CATEGORIES.map(([type, label]) => number(one(data, row => row.security_class1_desc === type && row.security_class2_desc === label, label).outstanding_amt, label));
}
function url(table, params) {
  const result = new URL(BASE + table);
  for (const [key, value] of Object.entries(params)) result.searchParams.set(key, String(value));
  return result.href;
}

function history(payload, cutoff) {
  const groups = new Map();
  for (const row of rows(payload)) {
    const period = monthEnd(row.record_date);
    if (period > cutoff) fail('future reporting date');
    if (!CATEGORIES.some(([type, label]) => row.security_class1_desc === type && row.security_class2_desc === label)) fail('unreviewed historical category');
    if (!groups.has(period)) groups.set(period, []);
    groups.get(period).push(row);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([period, group]) => {
    const principal = sum(categoryTotals(group));
    if (principal <= 0) fail('nonpositive marketable balance');
    return { date: period, value: principal / 1e6, publishedAt: null, sourceValue: String(principal) };
  });
}

function parseSecurities(data, asOf) {
  const groups = new Map();
  const allowedLabels = new Set([
    ...CATEGORIES.map(([, label]) => label), 'Total Matured Treasury Bills', 'Total Treasury Bills',
    'Total Matured Treasury Notes', 'Total Treasury Notes', 'Total Matured Treasury Bonds', 'Total Treasury Bonds',
  ]);
  for (const row of data) {
    if (row.record_date !== asOf || row.security_type_desc !== 'Marketable') fail('mixed period or security type');
    if (!CUSIP.test(row.security_class2_desc)) {
      if (allowedLabels.has(row.security_class2_desc) && TYPES.has(row.security_class1_desc)) continue;
      if (['Federal Financing Bank', 'Total Marketable'].includes(row.security_class1_desc) && missing(row.security_class2_desc)) continue;
      fail('unreviewed marketable row');
    }
    if (!TYPES.has(row.security_class1_desc)) fail('unreviewed security instrument');
    const cusip = row.security_class2_desc;
    if (!groups.has(cusip)) groups.set(cusip, []);
    groups.get(cusip).push(row);
  }
  if (!groups.size) fail('no usable securities');
  return [...groups].map(([cusip, issues]) => {
    const first = issues[0];
    const type = TYPES.get(first.security_class1_desc);
    const maturityDate = date(first.maturity_date);
    if (maturityDate <= asOf) fail('security is not unmatured');
    const outstandingRows = issues.filter(row => !missing(row.outstanding_amt));
    if (outstandingRows.length !== 1) fail('ambiguous CUSIP outstanding balance');
    const principal = number(outstandingRows[0].outstanding_amt, 'CUSIP outstanding balance');
    if (principal <= 0) fail('nonpositive CUSIP balance');
    const fixed = ['Note', 'Bond', 'TIPS'].includes(type);
    const couponRatePct = fixed ? number(first.interest_rate_pct, 'coupon rate') : null;
    if (fixed && couponRatePct < 0) fail('negative fixed coupon');
    const issueDates = new Set();
    for (const row of issues) {
      const issued = date(row.issue_date);
      if (issued > asOf || issued >= maturityDate || issueDates.has(issued)) fail('invalid or duplicate reopening date');
      issueDates.add(issued);
      if (row.security_class1_desc !== first.security_class1_desc || row.maturity_date !== maturityDate) fail('conflicting CUSIP maturity or instrument');
      if (fixed && number(row.interest_rate_pct, 'coupon rate') !== couponRatePct) fail('conflicting CUSIP coupon');
      if (!fixed && !missing(row.interest_rate_pct)) fail('unexpected bill or FRN fixed coupon');
    }
    const unadjustedPrincipal = sum(issues.map(row => number(row.issued_amt, 'issued principal') + number(row.redeemed_amt, 'redeemed principal')));
    const inflationAdjustment = sum(issues.map(row => number(row.inflation_adj_amt, 'inflation adjustment')));
    if (type !== 'TIPS' && inflationAdjustment !== 0) fail('inflation adjustment on nominal security');
    equal(unadjustedPrincipal + inflationAdjustment, principal, 'CUSIP principal');
    const securityId=`meridian-${createHash('sha256').update(cusip).digest('hex').slice(0,20)}`;
    return { securityId, type, maturityDate, principal: principal / 1000, unadjustedPrincipal: unadjustedPrincipal / 1000, inflationAdjustment: inflationAdjustment / 1000, couponRatePct };
  }).sort((a, b) => a.maturityDate.localeCompare(b.maturityDate) || a.securityId.localeCompare(b.securityId));
}

export async function collectRefinancing({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  const cutoff = now.toISOString().slice(0, 10);
  const beginning = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 36, 1)).toISOString().slice(0, 10);
  const historyUrl = url('mspd_table_3_market', {
    fields: 'record_date,security_class1_desc,security_class2_desc,outstanding_amt,src_line_nbr',
    filter: `record_date:gte:${beginning},record_date:lte:${cutoff},security_class2_desc:in:(${CATEGORIES.map(([, label]) => label).join(',')})`,
    sort: 'record_date,src_line_nbr', 'page[size]': 1000,
  });
  const historicalResponse = await requestText(historyUrl, { fetchImpl, maxBytes: 4 * 1024 * 1024 });
  const observations = history(JSON.parse(historicalResponse.text), cutoff);
  const asOf = observations.at(-1).date;
  const detailUrl = url('mspd_table_3_market', { filter: `record_date:eq:${asOf}`, sort: 'src_line_nbr', 'page[size]': 1000 });
  const summaryUrl = url('mspd_table_1', { filter: `record_date:eq:${asOf}`, 'page[size]': 100 });
  const [detailResponse, summaryResponse] = await Promise.all([
    requestText(detailUrl, { fetchImpl, maxBytes: 4 * 1024 * 1024 }),
    requestText(summaryUrl, { fetchImpl, maxBytes: 1024 * 1024 }),
  ]);
  const detail = rows(JSON.parse(detailResponse.text));
  const summary = rows(JSON.parse(summaryResponse.text));
  if (summary.some(row => row.record_date !== asOf)) fail('mixed summary period');
  const securities = parseSecurities(detail, asOf);
  const categories = categoryTotals(detail);
  for (let i = 0; i < CATEGORIES.length; i++) {
    const type = TYPES.get(CATEGORIES[i][0]);
    equal(sum(securities.filter(row => row.type === type).map(row => row.principal * 1000)), categories[i], `${type} category`);
  }
  const eligible = sum(categories);
  equal(eligible, observations.at(-1).value * 1e6, 'historical and detail balance');
  const ffb = number(one(detail, row => row.security_class1_desc === 'Federal Financing Bank', 'FFB balance').outstanding_amt, 'FFB balance');
  let matured = 0;
  for (let i = 0; i < 3; i++) {
    const labels = ['Total Treasury Bills', 'Total Treasury Notes', 'Total Treasury Bonds'];
    const total = number(one(detail, row => row.security_class1_desc === CATEGORIES[i][0] && row.security_class2_desc === labels[i], labels[i]).outstanding_amt, labels[i]);
    if (total < categories[i]) fail('negative matured balance');
    matured += total - categories[i];
  }
  const reported = number(one(detail, row => row.security_class1_desc === 'Total Marketable', 'total marketable').outstanding_amt, 'total marketable');
  equal(eligible + matured + ffb, reported, 'marketable total');
  const summaryTotal = one(summary, row => row.security_type_desc === 'Total Marketable', 'summary total');
  equal(number(summaryTotal.total_mil_amt, 'summary total'), reported, 'summary and detail total');
  const heldByPublic = number(summaryTotal.debt_held_public_mil_amt, 'marketable held by public');
  const intragovernmental = number(summaryTotal.intragov_hold_mil_amt, 'marketable intragovernmental holdings');
  equal(heldByPublic + intragovernmental, reported, 'summary ownership');
  equal(number(one(summary, row => row.security_type_desc === 'Marketable' && row.security_class_desc === 'Federal Financing Bank', 'summary FFB').total_mil_amt, 'summary FFB'), ffb, 'FFB summary');
  const responses = [historicalResponse, detailResponse, summaryResponse];
  const warnings = [
    'The maturity profile covers unmatured marketable Treasury securities, including small intragovernmental holdings; it is not debt held by the public alone. Federal Financing Bank and matured-unredeemed balances are excluded.',
    'TIPS amounts include inflation adjustment already accrued as of the observation date; future inflation and redemption-floor adjustments are unknown.',
    'Month-end record dates are observation dates. Exact historical release instants are not captured; retrieval dates are separate.',
  ];
  for (let i = 1; i < observations.length; i++) {
    const prior = new Date(`${observations[i - 1].date}T00:00:00Z`);
    let next = new Date(Date.UTC(prior.getUTCFullYear(), prior.getUTCMonth() + 2, 0));
    while (next.toISOString().slice(0, 10) < observations[i].date) {
      warnings.push(`Missing monthly MSPD observation: ${next.toISOString().slice(0, 7)}; no value is filled.`);
      next = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 2, 0));
    }
  }
  return {
    id: 'refinancing', asOf, unit: 'USD billions', securities,
    fetchedAt: responses.map(response => response.retrievedAt).sort().at(-1),
    series: { marketableDebt: {
      observations, dataStatus: 'calculated', sourceUrl: historyUrl,
      sourceIds: ['mspd_table_3_market:unmatured-outstanding'],
      calculation: 'Sum official unmatured bills, notes, bonds, TIPS and FRN outstanding amounts in USD millions / 1e6; TIPS include accrued inflation adjustment; FFB and matured-unredeemed balances excluded',
    } },
    totals: { eligiblePrincipal: eligible / 1000, reportedMarketablePrincipal: reported / 1000, ffbPrincipal: ffb / 1000, maturedUnredeemedPrincipal: matured / 1000, reportedMarketableHeldByPublic: heldByPublic / 1000, reportedMarketableIntragovernmental: intragovernmental / 1000 },
    provenance: responses.map(({ text, ...metadata }) => metadata), warnings,
  };
}
