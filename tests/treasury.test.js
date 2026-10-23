import test from 'node:test';
import assert from 'node:assert/strict';

let adapter;
try {
  adapter = await import('../scripts/sources/treasury.mjs');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('treasury.mjs')) throw error;
}

function treasury() {
  assert.ok(adapter, 'The Treasury source adapter must exist');
  return adapter;
}

const debtPayload = {
  data: [
    { record_date: '2026-10-20', tot_pub_debt_out_amt: 'null' },
    { record_date: '2026-10-19', tot_pub_debt_out_amt: '40396401120485.05' },
    { record_date: '2026-10-16', tot_pub_debt_out_amt: '0.00' },
  ],
};

const yieldCsv = '\uFEFFDate,"2 Yr","10 Yr","30 Yr"\r\n'
  + '10/20/2026,4.79,,5.42\r\n'
  + '10/16/2026,4.74,5.09,5.43\r\n'
  + '10/19/2026,4.77,5.15,N/A\r\n';

test('conflicting Treasury records cannot silently overwrite the same observation date',()=>{
  assert.throws(()=>treasury().parseDebt({data:[{record_date:'2026-10-20',tot_pub_debt_out_amt:'1000000000000'},{record_date:'2026-10-20',tot_pub_debt_out_amt:'2000000000000'}]}),/duplicate/i);
  assert.throws(()=>treasury().parseYieldCsv('Date,"10 Yr"\n10/20/2026,4.2\n10/20/2026,9.9\n'),/duplicate/i);
});

test('debt parser converts dollars to trillions, keeps source precision, sorts, and retains missing values', () => {
  const result = treasury().parseDebt(debtPayload);
  assert.ok(Math.abs(result[1].value - 40.39640112048505) < 1e-13, 'The displayed numeric value must match USD trillions within floating-point precision');
  assert.deepEqual(result.map(({ value, ...row }) => ({ ...row, value: value === null ? null : Number(value.toFixed(6)) })), [
    { date: '2026-10-16', value: 0, publishedAt: null, sourceValue: '0.00' },
    { date: '2026-10-19', value: 40.396401, publishedAt: null, sourceValue: '40396401120485.05' },
    { date: '2026-10-20', value: null, publishedAt: null, sourceValue: 'null' },
  ]);
});

test('debt parser rejects invalid payloads and histories with no usable observations', () => {
  const { parseDebt } = treasury();
  for (const payload of [{}, { data: [] }, { data: [{ record_date: '2026-02-30', tot_pub_debt_out_amt: '1' }] }, { data: [{ record_date: '2026-10-20', tot_pub_debt_out_amt: 'null' }] }]) {
    assert.throws(() => parseDebt(payload), /debt|date|observations/i);
  }
});

test('yield parser compares the exact latest two curve dates without filling missing rates', () => {
  const result = treasury().parseYieldCsv(yieldCsv);
  assert.equal(result.curveDate, '2026-10-20');
  assert.equal(result.previousCurveDate, '2026-10-19');
  assert.deepEqual(result.observations, [
    { date: '2026-10-16', value: 5.09, publishedAt: null },
    { date: '2026-10-19', value: 5.15, publishedAt: null },
    { date: '2026-10-20', value: null, publishedAt: null },
  ]);
  assert.deepEqual(result.yieldCurve.find(row => row.tenor === '10Y'), { tenor: '10Y', years: 10, value: null, previous: 5.15 });
  assert.deepEqual(result.yieldCurve.find(row => row.tenor === '30Y'), { tenor: '30Y', years: 30, value: 5.42, previous: null });
  assert.deepEqual(result.yieldCurve.find(row => row.tenor === '2Y'), { tenor: '2Y', years: 2, value: 4.79, previous: 4.77 });
  assert.equal(result.yieldCurve.find(row => row.tenor === '1M').value, null);
});

test('yield parser retains actual zero yields and has no invented prior curve', () => {
  const result = treasury().parseYieldCsv('Date,"1.5 Month","10 Yr"\n01/02/2026,0.00,0\n');
  assert.equal(result.observations[0].value, 0);
  assert.equal(result.previousCurveDate, null);
  assert.deepEqual(result.yieldCurve.find(row => row.tenor === '1.5M'), { tenor: '1.5M', years: 0.125, value: 0, previous: null });
});

test('yield parser rejects HTML, unknown schemas, invalid calendar dates, and unusable histories', () => {
  const { parseYieldCsv } = treasury();
  for (const text of ['<html>Denied</html>', 'Date,Rate\n10/20/2026,5.12', 'Date,"10 Yr"\n02/30/2026,5.12', 'Date,"10 Yr"\n10/20/2026,N/A']) {
    assert.throws(() => parseYieldCsv(text), /Treasury|yield|date|observations|header/i);
  }
});

function fixtureFetch({ debt = debtPayload, current = yieldCsv, previous = 'Date,"10 Yr"\n12/31/2025,4.17\n' } = {}) {
  return async function fetchFixture(url) {
    const target = new URL(url);
    if (target.hostname === 'api.fiscaldata.treasury.gov') return new Response(JSON.stringify(debt), { headers: { 'content-type': 'application/json' } });
    if (target.hostname === 'home.treasury.gov' && target.searchParams.get('field_tdr_date_value') === '2026') return new Response(current, { headers: { 'content-type': 'text/csv' } });
    if (target.hostname === 'home.treasury.gov' && target.searchParams.get('field_tdr_date_value') === '2025') return new Response(previous, { headers: { 'content-type': 'text/csv' } });
    throw new Error(`Unexpected source URL ${url}`);
  };
}

test('Treasury collector applies an arbitrary as-of date to curves and series and omits response bodies from provenance', async () => {
  const result = await treasury().collectTreasury({ now: new Date('2026-10-19T17:00:00Z'), fetchImpl: fixtureFetch() });
  assert.equal(result.id, 'treasury');
  assert.equal(result.fetchedAt, result.provenance.map(row => row.retrievedAt).sort().at(-1));
  assert.equal(result.curveDate, '2026-10-19');
  assert.equal(result.previousCurveDate, '2026-10-16');
  assert.deepEqual(result.series.yield.observations.map(row => row.date), ['2025-12-31', '2026-10-16', '2026-10-19']);
  assert.deepEqual(result.series.debt.observations.map(row => row.date), ['2026-10-16', '2026-10-19']);
  assert.equal(result.series.debt.dataStatus, 'official');
  assert.equal(result.series.yield.dataStatus, 'official');
  assert.deepEqual(result.series.yield.sourceIds, ['BC_10YEAR']);
  assert.ok(result.provenance.length >= 2);
  assert.ok(result.provenance.every(row => !('text' in row) && /^[a-f\d]{64}$/.test(row.sha256)));
  assert.deepEqual(result.warnings, []);
});

test('collector includes prior-year observations when January has fewer than 36 daily observations', async () => {
  const result = await treasury().collectTreasury({
    now: new Date('2026-01-02T12:00:00Z'),
    fetchImpl: fixtureFetch({ debt: { data: [{ record_date: '2026-01-02', tot_pub_debt_out_amt: '39000000000000' }] }, current: 'Date,"10 Yr"\n01/02/2026,4.19\n01/05/2026,4.17\n' }),
  });
  assert.deepEqual(result.series.yield.observations.map(row => row.date), ['2025-12-31', '2026-01-02']);
  assert.equal(result.previousCurveDate, '2025-12-31');
});

test('collector can retrieve historical debt instead of filtering only the latest 100 present-day records', async () => {
  const otherSources = fixtureFetch();
  const fetchImpl = async (url, options) => {
    const target = new URL(url);
    if (target.hostname !== 'api.fiscaldata.treasury.gov') return otherSources(url, options);
    const historical = target.searchParams.get('filter') === 'record_date:gte:2017-01-01,record_date:lte:2026-01-02';
    assert.equal(target.searchParams.get('page[size]'),'10000');
    return new Response(JSON.stringify({ data: [{ record_date: historical ? '2026-01-02' : '2026-10-20', tot_pub_debt_out_amt: '39000000000000' }] }));
  };
  const result = await treasury().collectTreasury({ now: new Date('2026-01-02T12:00:00Z'), fetchImpl });
  assert.equal(result.series.debt.observations.at(-1).date, '2026-01-02');
  assert.equal(result.series.debt.observations.at(-1).value, 39);
});

test('prior-year fallback also runs after 13 current-year points until there are at least 36', async () => {
  const current = 'Date,"10 Yr"\n' + Array.from({ length: 20 }, (_, index) => `01/${index + 2}/2026,4.19`).join('\n');
  const previous = 'Date,"10 Yr"\n' + Array.from({ length: 20 }, (_, index) => `12/${index + 2}/2025,4.17`).join('\n');
  const result = await treasury().collectTreasury({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch({ current, previous }) });
  assert.equal(result.series.yield.observations.length, 40);
  assert.equal(result.series.yield.observations[0].date, '2025-12-02');
  assert.equal(result.series.yield.observations.at(-1).date, '2026-01-21');
});

test('New Year collection can use the previous year before the first current-year publication', async () => {
  const result = await treasury().collectTreasury({
    now: new Date('2026-01-01T12:00:00Z'),
    fetchImpl: fixtureFetch({ debt: { data: [{ record_date: '2025-12-31', tot_pub_debt_out_amt: '39000000000000' }] }, current: 'Date,"10 Yr"\n' }),
  });
  assert.equal(result.curveDate, '2025-12-31');
  assert.equal(result.previousCurveDate, null);
});

test('collector fails on rejected upstream requests so the caller can retain the last successful source snapshot', async () => {
  await assert.rejects(treasury().collectTreasury({ now: new Date('2026-10-20T12:00:00Z'), fetchImpl: async () => new Response('Service unavailable', { status: 503 }) }), /503|request|HTTP/i);
});
