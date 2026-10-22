import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

let adapter;
try { adapter = await import('../scripts/sources/refinancing.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('refinancing.mjs')) throw error; }
const source = () => { assert.ok(adapter, 'The official MSPD refinancing adapter must exist'); return adapter; };

const asOf = '2026-09-30';
const classes = [
  ['Bills Maturity Value', 'Total Unmatured Treasury Bills', '1000'],
  ['Notes', 'Total Unmatured Treasury Notes', '2000'],
  ['Bonds', 'Total Unmatured Treasury Bonds', '3000'],
  ['Inflation-Protected Securities', 'Total Treasury TIPS', '1200'],
  ['Floating Rate Notes', 'Total Treasury Floating Rate Notes', '500'],
];
const wrap = data => ({ data, meta: { count: data.length, 'total-count': data.length, 'total-pages': 1 } });
const totals = (date = asOf) => classes.map(([security_class1_desc, security_class2_desc, outstanding_amt]) => ({ record_date: date, security_type_desc: 'Marketable', security_class1_desc, security_class2_desc, outstanding_amt }));
function security(cusip, type, maturity, amount, { issued = amount, inflation = '0', redeemed = '0', coupon = null, issue = '2026-01-01' } = {}) {
  return { record_date: asOf, security_type_desc: 'Marketable', security_class1_desc: type, security_class2_desc: cusip, maturity_date: maturity, issue_date: issue, outstanding_amt: amount, issued_amt: issued, inflation_adj_amt: inflation, redeemed_amt: redeemed, interest_rate_pct: coupon, yield_pct: '4.2' };
}
function detailRows() {
  return [
    security('912345AA1', 'Bills Maturity Value', '2026-10-15', '1000', { issued: '400' }),
    security('912345AA1', 'Bills Maturity Value', '2026-10-15', 'null', { issued: '600', issue: '2026-06-01' }),
    security('912345AB2', 'Notes', '2026-12-31', '2000', { issued: '1000', coupon: '2' }),
    security('912345AB2', 'Notes', '2026-12-31', 'null', { issued: '1000', coupon: '2', issue: '2026-06-01' }),
    security('912345AC3', 'Bonds', '2056-09-30', '3000', { coupon: '3' }),
    security('912345AD4', 'Inflation-Protected Securities', '2027-09-30', '1200', { issued: '1000', inflation: '200', coupon: '0.125' }),
    security('912345AE5', 'Floating Rate Notes', '2027-03-31', '500'),
    ...totals(),
    { record_date: asOf, security_type_desc: 'Marketable', security_class1_desc: 'Bills Maturity Value', security_class2_desc: 'Total Matured Treasury Bills', outstanding_amt: '*' },
    { record_date: asOf, security_type_desc: 'Marketable', security_class1_desc: 'Bills Maturity Value', security_class2_desc: 'Total Treasury Bills', outstanding_amt: '1000.25' },
    { record_date: asOf, security_type_desc: 'Marketable', security_class1_desc: 'Notes', security_class2_desc: 'Total Matured Treasury Notes', outstanding_amt: '1' },
    { record_date: asOf, security_type_desc: 'Marketable', security_class1_desc: 'Notes', security_class2_desc: 'Total Treasury Notes', outstanding_amt: '2001' },
    { record_date: asOf, security_type_desc: 'Marketable', security_class1_desc: 'Bonds', security_class2_desc: 'Total Matured Treasury Bonds', outstanding_amt: '2' },
    { record_date: asOf, security_type_desc: 'Marketable', security_class1_desc: 'Bonds', security_class2_desc: 'Total Treasury Bonds', outstanding_amt: '3002' },
    { record_date: asOf, security_type_desc: 'Marketable', security_class1_desc: 'Federal Financing Bank', security_class2_desc: 'null', outstanding_amt: '3' },
    { record_date: asOf, security_type_desc: 'Marketable', security_class1_desc: 'Total Marketable', security_class2_desc: 'null', outstanding_amt: '7706.25' },
  ];
}
const summaryRows = () => [
  { record_date: asOf, security_type_desc: 'Total Marketable', security_class_desc: '_', total_mil_amt: '7706.25', debt_held_public_mil_amt: '7696.25', intragov_hold_mil_amt: '10' },
  { record_date: asOf, security_type_desc: 'Marketable', security_class_desc: 'Federal Financing Bank', total_mil_amt: '3', debt_held_public_mil_amt: '0', intragov_hold_mil_amt: '3' },
];

function fixtureFetch({ history = wrap(totals()), detail = wrap(detailRows()), summary = wrap(summaryRows()), calls = [] } = {}) {
  return async url => {
    calls.push(url);
    const target = new URL(url);
    if (target.pathname.endsWith('/mspd_table_1')) return new Response(JSON.stringify(summary));
    if (target.searchParams.get('filter').includes(`record_date:eq:${asOf}`)) return new Response(JSON.stringify(detail));
    return new Response(JSON.stringify(history));
  };
}

test('MSPD collector uses approved exact endpoints, deduplicates reopenings and reconciles adjusted principal', async () => {
  const calls = [];
  const result = await source().collectRefinancing({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch({ calls }) });
  assert.equal(result.id, 'refinancing');
  assert.equal(result.asOf, asOf);
  assert.equal(result.unit, 'USD billions');
  assert.equal(result.securities.length, 5);
  assert.equal(result.securities.find(row => row.type === 'Bill').principal, 1);
  assert.deepEqual(result.securities.find(row => row.type === 'TIPS'), { securityId: `meridian-${createHash('sha256').update('912345AD4').digest('hex').slice(0,20)}`, type: 'TIPS', maturityDate: '2027-09-30', principal: 1.2, unadjustedPrincipal: 1, inflationAdjustment: 0.2, couponRatePct: 0.125 });
  assert.ok(result.securities.every(row=>!('cusip' in row)&&/^meridian-[a-f0-9]{20}$/.test(row.securityId)), 'Only generated Meridian IDs are published');
  assert.equal(result.totals.eligiblePrincipal, 7.7);
  assert.equal(result.totals.reportedMarketablePrincipal, 7.70625);
  assert.equal(result.totals.ffbPrincipal, 0.003);
  assert.ok(Math.abs(result.totals.maturedUnredeemedPrincipal - 0.00325) < 1e-10);
  assert.deepEqual(result.series.marketableDebt.observations, [{ date: asOf, value: 0.0077, publishedAt: null, sourceValue: '7700' }]);
  assert.equal(result.series.marketableDebt.dataStatus, 'calculated');
  assert.deepEqual(result.series.marketableDebt.sourceIds, ['mspd_table_3_market:unmatured-outstanding']);
  assert.ok(calls.every(url => new URL(url).origin === 'https://api.fiscaldata.treasury.gov'));
  assert.equal(calls.length, 3);
  const historyUrl = new URL(calls[0]);
  assert.ok(historyUrl.searchParams.get('sort').split(',').every(field => historyUrl.searchParams.get('fields').split(',').includes(field)), 'Every selected sort field must be present in the Fiscal Data projection');
  assert.ok(result.provenance.every(row => !('text' in row) && /^[a-f0-9]{64}$/.test(row.sha256)));
  assert.equal(result.fetchedAt, result.provenance.map(row => row.retrievedAt).sort().at(-1));
  assert.ok(result.warnings.some(warning => /intragovernmental/i.test(warning)));
  assert.ok(result.warnings.some(warning => /inflation/i.test(warning)));
});

test('MSPD histories retain month gaps and never invent release dates from period-end records', async () => {
  const result = await source().collectRefinancing({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch({ history: wrap([...totals('2026-07-31'), ...totals()]) }) });
  assert.deepEqual(result.series.marketableDebt.observations.map(row => row.date), ['2026-07-31', asOf]);
  assert.ok(result.series.marketableDebt.observations.every(row => row.publishedAt === null));
  assert.ok(result.warnings.some(warning => /missing.*2026-08/i.test(warning)));
});

test('MSPD collection rejects incomplete pagination, missing category totals and future reporting dates', async () => {
  for (const history of [
    { ...wrap(totals()), meta: { 'total-pages': 2 } },
    wrap(totals().slice(1)),
    wrap(totals('2026-11-30')),
    wrap([...totals(), totals()[0]]),
    wrap([]),
  ]) {
    await assert.rejects(source().collectRefinancing({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch({ history }) }), /MSPD|Treasury|refinancing/i);
  }
});

test('MSPD collection rejects ambiguous CUSIPs, suppressed balances, conflicting maturity and non-reconciling totals', async () => {
  const bad = [
    rows => { rows[1].outstanding_amt = '1000'; },
    rows => { rows[0].outstanding_amt = '*'; },
    rows => { rows[1].maturity_date = '2026-10-16'; },
    rows => { rows[0].maturity_date = '2026-02-30'; },
    rows => { rows[0].maturity_date = '2026-09-30'; },
    rows => { rows[0].security_class1_desc = 'Unreviewed security'; },
    rows => { rows[2].outstanding_amt = '2001'; },
    rows => { rows[5].inflation_adj_amt = '201'; },
    rows => { rows.at(-1).outstanding_amt = '9999'; },
  ];
  for (const alter of bad) {
    const rows = detailRows(); alter(rows);
    await assert.rejects(source().collectRefinancing({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch({ detail: wrap(rows) }) }), /MSPD|Treasury|refinancing/i);
  }
  const summary = summaryRows(); summary[0].total_mil_amt = '9999';
  await assert.rejects(source().collectRefinancing({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch({ summary: wrap(summary) }) }), /reconcil|MSPD/i);
});

test('MSPD upstream failures remain errors for last-good snapshot retention', async () => {
  await assert.rejects(source().collectRefinancing({ fetchImpl: async () => new Response('Unavailable', { status: 503 }) }), /503/);
});
