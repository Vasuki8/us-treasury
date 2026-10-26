import { requestText } from './http.mjs';
import { DEBT_HISTORY_START, debtHistoryUrl, requireCompleteDebtHistory } from './treasury-debt.mjs';

const base = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/';
const endpoints = {
  table9: `${base}v1/accounting/mts/mts_table_9`,
  table2: `${base}v1/accounting/mts/mts_table_2`,
  unitCheck: `${base}v1/accounting/mts/mts_receipts_outlays_deficit_surplus`,
  debt: `${base}v2/accounting/od/debt_to_penny`,
};
const historyNote = 'Historical monthly values are as recorded in each monthly statement; later revisions may not be incorporated. Record dates identify report reference months, not verified publication dates. Actual release dates are unavailable in these captures.';

function number(value) {
  if (value === null || value === undefined || value === 'null' || value === '') return null;
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(String(value))) throw new Error('Invalid fiscal numeric amount');
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error('Invalid fiscal numeric amount');
  return result;
}

function date(value, monthEnd = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid fiscal date');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Invalid fiscal date');
  if (monthEnd && new Date(parsed.getTime() + 86400000).getUTCDate() !== 1) throw new Error('Fiscal record must identify a month end');
  return value;
}

function rows(payload, boundedWindow = false) {
  if (!payload || !Array.isArray(payload.data) || !payload.data.length) throw new Error('Invalid fiscal response data');
  if (!boundedWindow && (payload.links?.next || Number(payload.meta?.['total-count'] ?? payload.data.length) > payload.data.length)) throw new Error('Incomplete fiscal pagination');
  if (payload.data.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('Invalid fiscal response row');
  return payload.data;
}

function grouped(payload, cutoff) {
  const result = new Map();
  for (const row of rows(payload)) {
    const key = date(row.record_date, true);
    if (key > cutoff) continue;
    if (!result.has(key)) result.set(key, []);
    result.get(key).push(row);
  }
  return result;
}

function unique(items, description, required = true) {
  const matches = items.filter(row => row.classification_desc === description);
  if (matches.length > 1) throw new Error(`Duplicate fiscal classification: ${description}`);
  if (!matches.length && required) throw new Error(`Missing fiscal classification: ${description}`);
  return matches[0] ?? null;
}

function close(left, right, message, tolerance = 1) {
  if (left === null || right === null || Math.abs(left - right) > tolerance) throw new Error(message);
}

/** Actual table amounts are USD dollars; verify their scale against explicit mil_amt. */
export function parseFiscalTables({ table9, table2, unitCheck, cutoff = '9999-12-31' }) {
  date(cutoff);
  const observations = grouped(table9, cutoff), financing = grouped(table2, cutoff);
  const monthly = [], raw = [];
  for (const [periodEnd, items] of [...observations].sort(([a], [b]) => a.localeCompare(b))) {
    const ids = new Set();
    for (const item of items) {
      if (typeof item.classification_id !== 'string' || !item.classification_id || ids.has(item.classification_id)) throw new Error('Duplicate or invalid fiscal classification ID');
      ids.add(item.classification_id);
    }
    const receiptsHeader = unique(items, 'Receipts'), outlaysHeader = unique(items, 'Net Outlays');
    const receiptsTotal = unique(items.filter(row => row.parent_id === receiptsHeader.classification_id), 'Total');
    const outlaysTotal = unique(items.filter(row => row.parent_id === outlaysHeader.classification_id), 'Total');
    const interestRow = unique(items.filter(row => row.parent_id === outlaysHeader.classification_id), 'Net Interest', false);
    const receipts = number(receiptsTotal.current_month_rcpt_outly_amt), outlays = number(outlaysTotal.current_month_rcpt_outly_amt);
    if (receipts === null || outlays === null) throw new Error('Missing fiscal total amount');
    const budgetRows = financing.get(periodEnd);
    if (!budgetRows) throw new Error('Missing aligned fiscal financing month');
    const budget = name => number(unique(budgetRows, name).current_month_budget_amt);
    close(receipts, budget('Total Receipts'), 'Fiscal receipts totals do not reconcile');
    close(outlays, budget('Total Outlays'), 'Fiscal outlays totals do not reconcile');
    const deficit = outlays - receipts, borrowingPublic = budget('Borrowing from the Public'), cashReduction = budget('Reduction of Operating Cash, Increase (-)'), otherFinancing = budget('By Other Means');
    close(deficit, -budget('Total Surplus (+) or Deficit (-)'), 'Fiscal budget balance does not reconcile');
    if ([borrowingPublic, cashReduction, otherFinancing].some(value => value === null)) throw new Error('Missing fiscal financing amount');
    // Older source rows contain small discrepancies. Preserve a visible residual;
    // never change published amounts to force an accounting reconciliation.
    const financingResidual = deficit - borrowingPublic - cashReduction - otherFinancing;
    const descendants = header => {
      const descendantIds = new Set([header.classification_id]);
      for (let count = 0; count < items.length; count++) {
        let changed = false;
        for (const item of items) if (descendantIds.has(item.parent_id) && !descendantIds.has(item.classification_id)) { descendantIds.add(item.classification_id); changed = true; }
        if (!changed) break;
      }
      return items.filter(item => descendantIds.has(item.parent_id) && item.data_type_cd === 'D').map(item => ({ name: item.classification_desc, value: number(item.current_month_rcpt_outly_amt) === null ? null : number(item.current_month_rcpt_outly_amt) / 1e9 }));
    };
    const netInterest = interestRow ? number(interestRow.current_month_rcpt_outly_amt) : null;
    monthly.push({ date: `${periodEnd.slice(0, 7)}-01`, periodEnd, recordDate: periodEnd, fiscalYear: Number(periodEnd.slice(0, 4)) + (Number(periodEnd.slice(5, 7)) >= 10 ? 1 : 0), receipts: receipts / 1e9, outlays: outlays / 1e9, deficit: deficit / 1e9, netInterest: netInterest === null ? null : netInterest / 1e9, borrowingPublic: borrowingPublic / 1e9, cashReduction: cashReduction / 1e9, otherFinancing: otherFinancing / 1e9, financingResidual: financingResidual / 1e9, financingReconciliation: Math.abs(financingResidual) <= 1 ? 'reconciled-within-one-dollar' : 'source-residual', contributors: { receipts: descendants(receiptsHeader), outlays: descendants(outlaysHeader) } });
    raw.push({ receipts: receiptsTotal.current_month_rcpt_outly_amt, outlays: outlaysTotal.current_month_rcpt_outly_amt, netInterest: interestRow?.current_month_rcpt_outly_amt ?? 'null' });
  }
  if (!monthly.length) throw new Error('No usable fiscal months');
  const latest = monthly.at(-1), check = rows(unitCheck).filter(row => date(row.record_date, true) === latest.periodEnd);
  for (const [category, key] of [['Receipts', 'receipts'], ['Outlays', 'outlays']]) {
    const matches = check.filter(row => row.amt_category === category);
    if (matches.length !== 1) throw new Error('Missing or duplicate fiscal million-unit cross-check');
    close(latest[key] * 1e9, number(matches[0].mil_amt) === null ? null : number(matches[0].mil_amt) * 1e6, 'Fiscal dollar/million unit cross-check exceeds rounding tolerance', 500001);
  }
  const series = Object.fromEntries(['receipts', 'outlays', 'netInterest'].map(id => [id, {
    observations: monthly.map((month, index) => ({ date: month.date, value: month[id], publishedAt: null, sourceValue: String(raw[index][id]) })),
    calculation: 'Current-month MTS actual USD dollars / 1e9; as recorded in each monthly statement; latest scale verified against Treasury mil_amt totals (within $500,001 rounding tolerance)',
    sourceIds: [`mts_table_9:${id === 'receipts' ? 'Receipts:Total' : id === 'outlays' ? 'Net Outlays:Total' : 'Net Interest'}:current_month_rcpt_outly_amt`],
    dataStatus: 'official',
  }]));
  return { series, monthly, coverageStart: monthly[0].date, coverageEnd: latest.date, historyNote, unitCheck: { periodEnd: latest.periodEnd, tableAmountUnit: 'USD dollars', checkAmountUnit: 'USD millions', roundingToleranceUSD: 500001 } };
}

export function parseFiscalDebt(payload, cutoff = '9999-12-31', {quarantineSourceResiduals=false}={}) {
  date(cutoff);
  const seen = new Set(), observations = [], debtBreakdown = [], warnings=[];
  const selected = rows(payload).filter(row => date(row.record_date) <= cutoff && row.record_date >= DEBT_HISTORY_START).sort((a, b) => b.record_date.localeCompare(a.record_date));
  for (const row of selected) {
    const recordDate = date(row.record_date);
    if (recordDate > cutoff) continue;
    if (seen.has(recordDate)) throw new Error('Duplicate fiscal debt date');
    seen.add(recordDate);
    const publicDebt = number(row.debt_held_public_amt), intragovernmentalDebt = number(row.intragov_hold_amt), grossDebt = number(row.tot_pub_debt_out_amt);
    // Treasury documents sparse composition before daily reporting began on 4 April 2005;
    // both nulls and historical paired zero placeholders mean unpublished, not zero debt.
    const unavailable = recordDate < '2005-04-04' && ((publicDebt === null && intragovernmentalDebt === null) || (publicDebt === 0 && intragovernmentalDebt === 0));
    if (grossDebt === null || grossDebt < 0 || (!unavailable && [publicDebt, intragovernmentalDebt].some(value => value === null || value < 0))) throw new Error('Missing or invalid fiscal debt amount');
    const residual=unavailable?null:Number((grossDebt-publicDebt-intragovernmentalDebt).toFixed(2)),invalid=residual!==null&&Math.abs(residual)>1;
    if(invalid&&!quarantineSourceResiduals)close(grossDebt,publicDebt+intragovernmentalDebt,'Gross debt does not reconcile with public and intragovernmental debt');
    const quality=unavailable?{reconciliation:'composition-not-published'}:invalid?{reconciliation:'source-residual-quarantined',reconciliationResidualUSD:residual}:{};
    if(invalid)warnings.push(`Debt composition for ${recordDate} is unavailable: published gross debt differs from public plus intragovernmental debt by USD ${Math.abs(residual).toLocaleString('en-US')}. Raw amounts are retained; no balancing adjustment or replacement date is used.`);
    observations.push({ date: recordDate, value: invalid||unavailable?null:publicDebt / 1e12, publishedAt: null, sourceValue: String(row.debt_held_public_amt),...quality });
    debtBreakdown.push({ date: recordDate, publicDebt: invalid||unavailable?null:publicDebt / 1e12, intragovernmentalDebt: invalid||unavailable?null:intragovernmentalDebt / 1e12, grossDebt: invalid?null:grossDebt / 1e12, sourceValues: { debt_held_public_amt: String(row.debt_held_public_amt), intragov_hold_amt: String(row.intragov_hold_amt), tot_pub_debt_out_amt: String(row.tot_pub_debt_out_amt) },...quality });
  }
  if (!observations.length) throw new Error('No usable fiscal debt observations');
  return { observations: observations.sort((a, b) => a.date.localeCompare(b.date)), debtBreakdown: debtBreakdown.sort((a, b) => a.date.localeCompare(b.date)),warnings };
}

export async function collectFiscal({ fetchImpl = globalThis.fetch, now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid fiscal capture date');
  const cutoff = now.toISOString().slice(0, 10), start = '2015-03-01';
  const fields = {
    table9: 'record_date,parent_id,classification_id,classification_desc,current_month_rcpt_outly_amt,data_type_cd,record_type_cd',
    table2: 'record_date,classification_desc,current_month_budget_amt',
    unitCheck: 'record_date,amt_category,mil_amt',
    debt: 'record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt',
  };
  const requested = Object.fromEntries(Object.keys(endpoints).map(key => [key, key === 'debt'
    ? debtHistoryUrl(fields[key], cutoff)
    : `${endpoints[key]}?fields=${fields[key]}&filter=record_date:gte:${start},record_date:lte:${cutoff}&sort=record_date&page%5Bsize%5D=10000`]));
  const captures = await Promise.all(Object.entries(requested).map(async ([key, url]) => {
    const response = await requestText(url, { fetchImpl: async (value, options) => {
      const result = await fetchImpl(value, options);
      if (result.redirected || (result.url && result.url !== value)) throw new Error('Unreviewed fiscal source URL or redirect');
      return result;
    }, maxBytes: 8 * 1024 * 1024 });
    if (response.url !== url) throw new Error('Unreviewed fiscal source URL or redirect');
    return [key, response];
  }));
  const payloads = Object.fromEntries(captures.map(([key, response]) => [key, JSON.parse(response.text)]));
  requireCompleteDebtHistory(payloads.debt);
  const fiscal = parseFiscalTables({ ...payloads, cutoff }), debt = parseFiscalDebt(payloads.debt, cutoff,{quarantineSourceResiduals:true});
  for (const series of Object.values(fiscal.series)) series.sourceUrl = requested.table9;
  const provenance = captures.map(([, { text: _text, ...metadata }]) => metadata);
  const debtProvenance = provenance.find(item => item.url === requested.debt);
  const warnings = [historyNote,...debt.warnings];
  if (fiscal.monthly.some(month => month.financingReconciliation === 'source-residual')) warnings.push('Some published financing rows do not reconcile to the budget deficit. Their reported amounts are retained with an explicit calculated financing residual.');
  return { id: 'fiscal', fetchedAt: provenance.map(item => item.retrievedAt).sort().at(-1), series: { ...fiscal.series, publicDebt: { observations: debt.observations, fetchedAt: debtProvenance.retrievedAt, provenance: [debtProvenance], calculation: 'Debt held by the public USD dollars / 1e12; excludes intragovernmental holdings; actual debt record dates from 1 April 1993. Composition is annual from September 1997 through September 2001, monthly through March 2005, and daily from 4 April 2005; unpublished historical composition remains null, including source zero placeholders. No filled weekends or missing dates.', sourceUrl: requested.debt, sourceIds: ['debt_held_public_amt'], dataStatus: 'official' } }, monthly: fiscal.monthly, coverageStart: fiscal.coverageStart, coverageEnd: fiscal.coverageEnd, coverageNote: historyNote, fiscal: { debtBreakdown: debt.debtBreakdown, historyNote, unitCheck: fiscal.unitCheck, methodology: 'Deficit (positive) = outlays - receipts. Financing bridge: deficit = borrowing from the public + reduction of operating cash + other financing + calculated source residual. Monthly actuals, not fiscal-year-to-date or budget estimates. Net interest is the published budget function, not gross Treasury interest expense. Borrowing flow and debt stock changes have distinct accounting scope.' }, provenance, warnings };
}
