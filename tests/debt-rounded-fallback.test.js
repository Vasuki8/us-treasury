import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { collectTreasury } from '../scripts/sources/treasury.mjs';
import { collectFiscal, parseFiscalDebt } from '../scripts/sources/fiscal.mjs';
import { debtFallbackMetadata } from '../src/debt-fallback.js';

const pdfUrl = 'https://fiscaldata.treasury.gov/static-data/published-reports/dts/DailyTreasuryStatement_20250804.pdf';
const pdfHash = '2afa2b2497dc88fb4b14893681d127d651c868b7c3d46ad0c52455df7e6f5c9f';
const primary = { debt_held_public_amt: '29523300148538.85', intragov_hold_amt: '7314864649375.46', tot_pub_debt_out_amt: '36828164797914.31' };
const rounded = { debt_held_public_amt: '29523300', intragov_hold_amt: '7314865', tot_pub_debt_out_amt: '36838165' };
const anomaly = { record_date: '2025-08-04', ...primary };
const older = { record_date: '1993-04-01', debt_held_public_amt: 'null', intragov_hold_amt: 'null', tot_pub_debt_out_amt: '4225873987843.44' };
const latest = { record_date: '2026-09-30', debt_held_public_amt: '30000000000000', intragov_hold_amt: '7000000000000', tot_pub_debt_out_amt: '37000000000000' };
const now = new Date('2026-10-26T12:00:00Z');
const pdf = await readFile(new URL('./fixtures/DailyTreasuryStatement_20250804.pdf', import.meta.url));
function fixtureFetch({ rows = [older, anomaly, latest], pdfResponse = () => new Response(pdf) } = {}) {
  const requested = [];
  const fetchImpl = async (url, options) => {
    requested.push({ url, options });
    if (url === pdfUrl) return pdfResponse();
    const target = new URL(url), path = target.pathname;
    if (path.endsWith('debt_to_penny')) return Response.json({ data: rows, meta: { count: rows.length, 'total-count': rows.length, 'total-pages': 1 }, links: { next: null } });
    if (target.hostname === 'home.treasury.gov') {
      const year = Number(target.searchParams.get('field_tdr_date_value'));
      return new Response(`Date,"10 Yr"\n12/01/${year},4.2\n`);
    }
    const date = '2026-09-30';
    if (path.endsWith('mts_table_9')) {
      const row = (id, parent, name, amount, type = 'D') => ({ record_date: date, classification_id: id, parent_id: parent, classification_desc: name, current_month_rcpt_outly_amt: amount, data_type_cd: type });
      return Response.json({ data: [row('r', 'null', 'Receipts', 'null', 'S'), row('rt', 'r', 'Total', '500000000000', 'T'), row('o', 'null', 'Net Outlays', 'null', 'S'), row('ot', 'o', 'Total', '600000000000', 'T')] });
    }
    if (path.endsWith('mts_table_2')) return Response.json({ data: [['Total Receipts', '500000000000'], ['Total Outlays', '600000000000'], ['Total Surplus (+) or Deficit (-)', '-100000000000'], ['Borrowing from the Public', '100000000000'], ['Reduction of Operating Cash, Increase (-)', '0'], ['By Other Means', '0']].map(([classification_desc, current_month_budget_amt]) => ({ record_date: date, classification_desc, current_month_budget_amt })) });
    if (path.endsWith('mts_receipts_outlays_deficit_surplus')) return Response.json({ data: [{ record_date: date, amt_category: 'Receipts', mil_amt: '500000' }, { record_date: date, amt_category: 'Outlays', mil_amt: '600000' }] });
    throw new Error(`Unexpected source ${url}`);
  };
  return { fetchImpl, requested };
}

test('both collectors use the coherent reviewed million-precision row and preserve other debt numbers', async () => {
  for (const [collect, id, field, value, sourceSeriesId] of [[collectTreasury, 'debt', 'tot_pub_debt_out_amt', 36.838165, 'gross'], [collectFiscal, 'publicDebt', 'debt_held_public_amt', 29.5233, 'public']]) {
    const { fetchImpl, requested } = fixtureFetch();
    const before = Date.now(), source = await collect({ fetchImpl, now }), after = Date.now();
    const series = source.series[id], row = series.observations.find(row => row.date === '2025-08-04');
    assert.equal(row.value, value);
    assert.equal(row.sourceValue, rounded[field]);
    assert.equal(row.sourceUnit, 'USD millions');
    assert.equal(row.sourcePrecisionUSD, 1000000);
    assert.equal(row.sourceSeriesId, `DTS:IIIC:closing:${sourceSeriesId}`);
    assert.equal(row.sourceUrl, pdfUrl);
    assert.equal(row.sourceSha256, pdfHash);
    assert.equal(row.publishedAt, null);
    assert.ok(Date.parse(row.retrievedAt) >= before && Date.parse(row.retrievedAt) <= after);
    assert.equal(row.reconciliation, 'official-rounded-fallback');
    assert.equal(row.reconciliationResidualUSD, -10000000000);
    assert.deepEqual(row.primarySourceValues, primary);
    assert.deepEqual(row.fallbackSourceValues, rounded);
    assert.match(row.footnotes.join(' '), /2025-08-04.*million.*Debt.to.the.Penny/i);
    assert.deepEqual(series.sourceUrls, [series.sourceUrl, pdfUrl]);
    assert.equal(series.provenance.length, 2);
    const receipt = series.provenance.find(item => item.url === pdfUrl);
    assert.deepEqual(receipt, source.provenance.find(item => item.url === pdfUrl));
    assert.equal(receipt.sha256, pdfHash);
    assert.equal(receipt.retrievedAt, row.retrievedAt);
    assert.deepEqual(row.inputProvenance, series.provenance);
    assert.ok(row.inputProvenance.every(item => !('bytes' in item) && !('text' in item)));
    assert.equal(series.fetchedAt, series.provenance.map(item => item.retrievedAt).sort().at(-1));
    assert.match(series.calculation, /2025-08-04.*million/i);
    assert.equal(series.observations.at(-1).value, id === 'debt' ? 37 : 30);
    assert.equal(series.observations[0].value, id === 'debt' ? 4.22587398784344 : null);
    assert.equal(requested.filter(item => item.url === pdfUrl).length, 1);
    assert.equal(requested.find(item => item.url === pdfUrl).options.redirect, 'error');
    assert.ok(new URL(series.sourceUrl).searchParams.get('fields').includes('debt_held_public_amt,intragov_hold_amt'));
    if (source.id === 'fiscal') {
      const breakdown = source.fiscal.debtBreakdown.find(item => item.date === '2025-08-04');
      assert.deepEqual([breakdown.publicDebt, breakdown.intragovernmentalDebt, breakdown.grossDebt], [29.5233, 7.314865, 36.838165]);
      assert.deepEqual(breakdown.sourceValues, primary);
      assert.deepEqual(breakdown.fallbackSourceValues, rounded);
      assert.equal(breakdown.sourcePrecisionUSD, 1000000);
      assert.equal(breakdown.sourceSha256, pdfHash);
      assert.equal(breakdown.retrievedAt, row.retrievedAt);
      assert.deepEqual(breakdown.inputProvenance, series.provenance);
    }
  }
});

test('reconciled primary debt wins without fetching any DTS evidence', async () => {
  const corrected = { ...anomaly, tot_pub_debt_out_amt: '36838164797914.31' };
  for (const [collect, id, value] of [[collectTreasury, 'debt', 36.83816479791431], [collectFiscal, 'publicDebt', 29.52330014853885]]) {
    const { fetchImpl, requested } = fixtureFetch({ rows: [corrected, latest], pdfResponse: () => assert.fail('good primary never requests the fallback') });
    const result = await collect({ fetchImpl, now }), row = result.series[id].observations[0];
    assert.equal(row.value, value);
    assert.equal(row.sourceValue, corrected[id === 'debt' ? 'tot_pub_debt_out_amt' : 'debt_held_public_amt']);
    assert.equal(row.sourcePrecisionUSD, undefined);
    assert.equal(requested.some(item => item.url === pdfUrl), false);
  }
});

test('unreviewed date or primary fingerprint remains quarantined without fallback retrieval', async () => {
  for (const changed of [{ ...anomaly, record_date: '2025-08-05' }, { ...anomaly, debt_held_public_amt: '29523300148538.86' }]) {
    for (const [collect, id] of [[collectTreasury, 'debt'], [collectFiscal, 'publicDebt']]) {
      const { fetchImpl } = fixtureFetch({ rows: [changed, latest], pdfResponse: () => assert.fail('unreviewed anomaly must not request the PDF') });
      const result = await collect({ fetchImpl, now }), row = result.series[id].observations[0];
      assert.equal(row.value, null);
      assert.equal(row.reconciliation, 'source-residual-quarantined');
      assert.equal(row.sourcePrecisionUSD, undefined);
    }
  }
  assert.throws(() => parseFiscalDebt({ data: [anomaly] }), /reconcile/i, 'strict direct parsing remains strict');
});

test('missing, changed, redirected and oversized PDF evidence fails closed in both collectors', async () => {
  const cases = [
    () => new Response('missing', { status: 404 }),
    () => new Response(Buffer.concat([pdf, Buffer.from('changed')])),
    () => Object.defineProperty(new Response(pdf), 'redirected', { value: true }),
    () => Object.defineProperty(new Response(pdf), 'url', { value: pdfUrl + '?unreviewed' }),
    () => new Response(Buffer.alloc(1024 * 1024 + 1)),
  ];
  for (const pdfResponse of cases) for (const collect of [collectTreasury, collectFiscal]) {
    const { fetchImpl } = fixtureFetch({ pdfResponse });
    await assert.rejects(collect({ fetchImpl, now }), /HTTP|hash|sha|redirect|URL|limit/i);
  }
});

test('fallback metadata requires its reviewed field and both usable source receipts', () => {
  const receipt = { url: pdfUrl, sha256: pdfHash, retrievedAt: '2026-10-27T02:39:15.293Z', lastModified: null };
  const primaryReceipt = { url: 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?fields=record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt', sha256: 'a'.repeat(64), retrievedAt: '2026-10-27T02:38:00.000Z', lastModified: null };
  for (const field of ['toString', '__proto__', 'unreviewed']) assert.throws(() => debtFallbackMetadata(field, receipt, primaryReceipt), /field|receipt/i);
  for (const primary of [undefined, {}, { ...primaryReceipt, sha256: null }, { ...primaryReceipt, retrievedAt: null }]) assert.throws(() => debtFallbackMetadata('debt_held_public_amt', receipt, primary), /receipt/i);
});
