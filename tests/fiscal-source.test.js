import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFiscalTables, parseFiscalDebt, collectFiscal } from '../scripts/sources/fiscal.mjs';

const amount = n => String(n * 1e9);
function tables(date = '2026-09-30', scale = 1) {
  const row = (id, parent, name, value, type = 'D', recordType = 'F') => ({ record_date: date, classification_id: id, parent_id: parent, classification_desc: name, current_month_rcpt_outly_amt: value === null ? 'null' : amount(value * scale), data_type_cd: type, record_type_cd: recordType });
  const table9 = { data: [row('r', 'null', 'Receipts', null, 'S', 'SL'), row('income', 'r', 'Individual Income Taxes', 350), row('insurance', 'r', 'Social Insurance and Retirement Receipts:', null, 'S'), row('employment', 'insurance', 'Employment and General Retirement', 150), row('rt', 'r', 'Total', 500, 'T', 'SL'), row('o', 'null', 'Net Outlays', null, 'S', 'SL'), row('defense', 'o', 'National Defense', 100), row('interest', 'o', 'Net Interest', 75), row('other', 'o', 'Income Security', 425), row('ot', 'o', 'Total', 600, 'T', 'SL')] };
  const finance = (name, value) => ({ record_date: date, classification_desc: name, current_month_budget_amt: amount(value * scale), current_fytd_budget_amt: '999999999999999' });
  const table2 = { data: [finance('Total Receipts', 500), finance('Total Outlays', 600), finance('Total Surplus (+) or Deficit (-)', -100), finance('Borrowing from the Public', 125), finance('Reduction of Operating Cash, Increase (-)', -30), finance('By Other Means', 5)] };
  const unitCheck = { data: [{ record_date: date, amt_category: 'Receipts', mil_amt: '500000' }, { record_date: date, amt_category: 'Outlays', mil_amt: '600000' }] };
  return { table9, table2, unitCheck };
}

test('parses aligned monthly statement actuals and uses hierarchy without double counting totals', () => {
  const result = parseFiscalTables(tables());
  const month = result.monthly[0];
  assert.deepEqual(Object.fromEntries(['date', 'periodEnd', 'receipts', 'outlays', 'deficit', 'netInterest', 'borrowingPublic', 'cashReduction', 'otherFinancing'].map(k => [k, month[k]])), { date: '2026-09-01', periodEnd: '2026-09-30', receipts: 500, outlays: 600, deficit: 100, netInterest: 75, borrowingPublic: 125, cashReduction: -30, otherFinancing: 5 });
  assert.equal(month.contributors.receipts.reduce((sum, x) => sum + x.value, 0), 500);
  assert.equal(month.contributors.outlays.reduce((sum, x) => sum + x.value, 0), 600);
  assert.equal(month.contributors.receipts.length, 2);
  assert.equal(result.series.netInterest.observations[0].publishedAt, null);
  assert.equal(result.series.receipts.observations[0].sourceValue, amount(500));
});

test('keeps a missing interest observation null and does not substitute zero or gross interest', () => {
  const fixture = tables();
  fixture.table9.data = fixture.table9.data.filter(x => x.classification_desc !== 'Net Interest');
  const parsed = parseFiscalTables(fixture);
  assert.equal(parsed.monthly[0].netInterest, null);
  assert.equal(parsed.series.netInterest.observations[0].value, null);
});

test('rejects duplicate fiscal classifications, invalid months and inconsistent totals', () => {
  const duplicate = tables(); duplicate.table9.data.push({ ...duplicate.table9.data.at(-1) });
  assert.throws(() => parseFiscalTables(duplicate), /Duplicate/);
  assert.throws(() => parseFiscalTables(tables('2026-09-31')), /date|month/i);
  const totals = tables(); totals.table2.data[0].current_month_budget_amt = amount(400);
  assert.throws(() => parseFiscalTables(totals), /reconcil|total/i);
});

test('preserves published financing discrepancies as explicit residuals without altering official amounts', () => {
  const fixture = tables(); fixture.table2.data.at(-1).current_month_budget_amt = amount(10);
  const month = parseFiscalTables(fixture).monthly[0];
  assert.equal(month.otherFinancing, 10);
  assert.equal(month.financingResidual, -5);
  assert.equal(month.financingReconciliation, 'source-residual');
  fixture.table2.data.at(-1).current_month_budget_amt = String(5e9 + 299.99);
  assert.ok(Math.abs(parseFiscalTables(fixture).monthly[0].financingResidual + 0.00000029999) < 1e-12);
});

test('cross-checks latest actual dollar units against explicitly million-denominated Treasury series', () => {
  assert.throws(() => parseFiscalTables(tables('2026-09-30', 1e-6)), /unit|million|scale/i);
  const fixture = tables(); fixture.unitCheck.data[0].mil_amt = '500001';
  assert.throws(() => parseFiscalTables(fixture), /unit|million|round/i);
  fixture.unitCheck.data[0].mil_amt = '500000.4';
  assert.doesNotThrow(() => parseFiscalTables(fixture));
});

test('aligns reports across October fiscal-year rollover and filters future observations', () => {
  const sep = tables('2026-09-30'); const oct = tables('2026-10-31');
  const result = parseFiscalTables({ table9: { data: [...oct.table9.data, ...sep.table9.data] }, table2: { data: [...oct.table2.data, ...sep.table2.data] }, unitCheck: sep.unitCheck, cutoff: '2026-10-21' });
  assert.deepEqual(result.monthly.map(x => x.date), ['2026-09-01']);
  assert.equal(result.monthly[0].fiscalYear, 2026);
  assert.equal(parseFiscalTables(oct).monthly[0].fiscalYear, 2027);
});

test('rejects incomplete pagination and keeps malformed/null monetary values missing', () => {
  const partial = tables(); partial.table9.links = { next: '?page=2' };
  assert.throws(() => parseFiscalTables(partial), /pagin|incomplete/i);
  const missing = tables(); missing.table9.data.find(x => x.classification_desc === 'Net Interest').current_month_rcpt_outly_amt = 'not a number';
  assert.throws(() => parseFiscalTables(missing), /amount|number|numeric/i);
  missing.table9.data.find(x => x.classification_desc === 'Net Interest').current_month_rcpt_outly_amt = 'null';
  assert.equal(parseFiscalTables(missing).monthly[0].netInterest, null);
});

test('keeps debt held by public distinct from gross debt and validates their sum', () => {
  const payload = { data: [{ record_date: '2026-09-30', debt_held_public_amt: '30000000000000', intragov_hold_amt: '7000000000000', tot_pub_debt_out_amt: '37000000000000' }] };
  const result = parseFiscalDebt(payload);
  assert.equal(result.observations[0].value, 30);
  assert.deepEqual(result.debtBreakdown[0], { date: '2026-09-30', publicDebt: 30, intragovernmentalDebt: 7, grossDebt: 37, sourceValues: { debt_held_public_amt: '30000000000000', intragov_hold_amt: '7000000000000', tot_pub_debt_out_amt: '37000000000000' } });
  payload.data[0].tot_pub_debt_out_amt = '38000000000000';
  assert.throws(() => parseFiscalDebt(payload), /debt|reconcil/i);
});

test('collector uses only exact approved official endpoints, retains hashes and rejects redirects', async () => {
  const fixture = tables(); const requested = [];
  const fetchImpl = async url => {
    requested.push(url);
    const path = new URL(url).pathname;
    const payload = path.endsWith('mts_table_9') ? fixture.table9 : path.endsWith('mts_table_2') ? fixture.table2 : path.endsWith('mts_receipts_outlays_deficit_surplus') ? fixture.unitCheck : { data: [{ record_date: '2026-09-30', debt_held_public_amt: '30000000000000', intragov_hold_amt: '7000000000000', tot_pub_debt_out_amt: '37000000000000' }] };
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const result = await collectFiscal({ fetchImpl, now: new Date('2026-10-21T20:00:00Z') });
  assert.equal(requested.length, 4);
  assert.equal(result.id, 'fiscal');
  assert.equal(result.provenance.length, 4);
  assert.ok(result.provenance.every(x => /^[a-f0-9]{64}$/.test(x.sha256)));
  assert.equal(result.series.receipts.observations[0].value, 500);
  assert.equal(result.series.publicDebt.observations[0].value, 30);
  assert.ok(result.warnings.some(x => /revis/i.test(x)));
  await assert.rejects(() => collectFiscal({ now: new Date('2026-10-21T20:00:00Z'), fetchImpl: async () => Object.defineProperty(new Response('{}'), 'redirected', { value: true }) }), /redirect|source URL/i);
});
