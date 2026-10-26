import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { parseFiscalTables, parseFiscalDebt, collectFiscal } from '../scripts/sources/fiscal.mjs';
import { deriveFiscalSeries } from '../src/fiscal.js';

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

test('historical unpublished composition stays missing while gross debt and sparse reported amounts retain precision', () => {
  const payload = { data: [
    { record_date: '1993-04-01', debt_held_public_amt: 'null', intragov_hold_amt: 'null', tot_pub_debt_out_amt: '4225873987843.44' },
    { record_date: '1993-04-02', debt_held_public_amt: '0.00', intragov_hold_amt: '0.00', tot_pub_debt_out_amt: '4233931445349.25' },
    { record_date: '1997-09-30', debt_held_public_amt: '3789667546849.60', intragov_hold_amt: '1623478464547.74', tot_pub_debt_out_amt: '5413146011397.34' },
    { record_date: '2005-03-30', debt_held_public_amt: 'null', intragov_hold_amt: 'null', tot_pub_debt_out_amt: '7786606686259.96' },
    { record_date: '2005-03-31', debt_held_public_amt: '4572715640119.20', intragov_hold_amt: '3204223407550.94', tot_pub_debt_out_amt: '7776939047670.14' },
  ] };
  const result = parseFiscalDebt(payload);
  assert.deepEqual(result.observations.map(row => row.value), [null, null, 3.7896675468496, null, 4.5727156401192]);
  assert.equal(result.debtBreakdown[0].grossDebt, 4.22587398784344);
  assert.equal(result.debtBreakdown[0].publicDebt, null);
  assert.equal(result.debtBreakdown[0].intragovernmentalDebt, null);
  assert.equal(result.debtBreakdown[0].reconciliation, 'composition-not-published');
  assert.equal(result.debtBreakdown[1].sourceValues.debt_held_public_amt, '0.00');
  assert.equal(result.observations[2].sourceValue, '3789667546849.60');
  assert.ok(result.observations.every(row => row.publishedAt === null));
  assert.equal(result.warnings.length, 0, 'documented missing historical composition is not an accounting anomaly');
  assert.throws(() => parseFiscalDebt({ data: [{ ...payload.data[0], record_date: '2005-04-04' }] }), /invalid|missing/i, 'unexpected missing modern composition still fails closed');
});

test('public debt preserves more than 100 actual dates for quarter-end nominal-GDP context',()=>{
  const data=Array.from({length:400},(_,i)=>({record_date:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),debt_held_public_amt:'30000000000000',intragov_hold_amt:'7000000000000',tot_pub_debt_out_amt:'37000000000000'}));
  const result=parseFiscalDebt({data},'2026-06-30');
  assert.equal(result.observations.length,400);assert.equal(result.observations[0].date,'2025-01-01');
  assert.equal(result.debtBreakdown.length,400);
});

test('history collection quarantines source debt-accounting anomalies with raw evidence and a visible warning',()=>{
  const payload={data:[{record_date:'2025-08-04',debt_held_public_amt:'29523300148538.85',intragov_hold_amt:'7314864649375.46',tot_pub_debt_out_amt:'36828164797914.31'}]};
  assert.throws(()=>parseFiscalDebt(payload),/reconcile/i,'strict direct parser still rejects unreconciled values');
  const result=parseFiscalDebt(payload,'2026-10-23',{quarantineSourceResiduals:true});
  assert.equal(result.observations[0].value,null,'an affected row is not published as validated public debt');
  assert.equal(result.observations[0].sourceValue,'29523300148538.85');
  assert.equal(result.debtBreakdown[0].publicDebt,null);
  assert.equal(result.debtBreakdown[0].reconciliationResidualUSD,-10000000000);
  assert.equal(result.debtBreakdown[0].sourceValues.tot_pub_debt_out_amt,'36828164797914.31');
  assert.match(result.warnings[0],/2025-08-04.*unavailable.*10,000,000,000/i);
  assert.throws(()=>parseFiscalDebt({...payload,meta:{'total-count':2}},'2026-10-23',{quarantineSourceResiduals:true}),/pagination/i);
});

test('collector uses only exact approved official endpoints, retains hashes and rejects redirects', async () => {
  const fixture = tables(); const requested = [];
  const debtPayload = { data: [{ record_date: '2026-09-30', debt_held_public_amt: '30000000000000', intragov_hold_amt: '7000000000000', tot_pub_debt_out_amt: '37000000000000' }], meta: { count: 1, 'total-count': 1, 'total-pages': 1 }, links: { next: null } };
  const fetchImpl = async url => {
    requested.push(url);
    const path = new URL(url).pathname;
    const payload = path.endsWith('mts_table_9') ? fixture.table9 : path.endsWith('mts_table_2') ? fixture.table2 : path.endsWith('mts_receipts_outlays_deficit_surplus') ? fixture.unitCheck : debtPayload;
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const result = await collectFiscal({ fetchImpl, now: new Date('2026-10-21T20:00:00Z') });
  assert.equal(requested.length, 4);
  for(const url of requested.filter(url=>!url.includes('debt_to_penny')))assert.equal(new URL(url).searchParams.get('filter'),'record_date:gte:2015-03-01,record_date:lte:2026-10-21');
  assert.equal(result.id, 'fiscal');
  assert.equal(result.provenance.length, 4);
  assert.ok(result.provenance.every(x => /^[a-f0-9]{64}$/.test(x.sha256)));
  assert.equal(result.series.receipts.observations[0].value, 500);
  assert.equal(result.series.publicDebt.observations[0].value, 30);
  const debtReceipt = result.provenance.find(row => row.url === result.series.publicDebt.sourceUrl);
  assert.deepEqual(result.series.publicDebt.provenance, [debtReceipt], 'monthly receipts stay at source level');
  assert.equal(result.series.publicDebt.provenance[0].sha256, createHash('sha256').update(JSON.stringify(debtPayload)).digest('hex'));
  assert.equal(result.series.publicDebt.fetchedAt, debtReceipt.retrievedAt);
  assert.ok(result.series.publicDebt.observations.every(row => !('provenance' in row) && !('sourceUrl' in row)));
  assert.ok(result.warnings.some(x => /revis/i.test(x)));
  await assert.rejects(() => collectFiscal({ now: new Date('2026-10-21T20:00:00Z'), fetchImpl: async () => Object.defineProperty(new Response('{}'), 'redirected', { value: true }) }), /redirect|source URL/i);
});

test('full MTS history restores existing first-year trailing totals and ratios without filling incomplete windows',async()=>{
  const statements=Array.from({length:24},(_,index)=>tables(new Date(Date.UTC(2019,index+1,0)).toISOString().slice(0,10)));
  const debt={data:[{record_date:'2020-12-31',debt_held_public_amt:amount(30000),intragov_hold_amt:amount(7000),tot_pub_debt_out_amt:amount(37000)}],meta:{count:1,'total-count':1,'total-pages':1},links:{next:null}};
  const fetchImpl=async url=>{
    const target=new URL(url),start=/record_date:gte:(\d{4}-\d{2}-\d{2})/.exec(target.searchParams.get('filter'))?.[1];
    const key=target.pathname.endsWith('mts_table_9')?'table9':target.pathname.endsWith('mts_table_2')?'table2':target.pathname.endsWith('mts_receipts_outlays_deficit_surplus')?'unitCheck':null;
    const data=key?statements.flatMap(item=>item[key].data).filter(row=>row.record_date>=start):null;
    return new Response(JSON.stringify(key?{data,meta:{count:data.length,'total-count':data.length,'total-pages':1},links:{next:null}}:debt));
  };
  const source=await collectFiscal({fetchImpl,now:new Date('2026-10-21T20:00:00Z')}),derived=deriveFiscalSeries(source);
  assert.equal(source.monthly.length,24);
  assert.equal(source.monthly[0].date,'2019-01-01');
  const earlier={series:Object.fromEntries(Object.entries(source.series).filter(([id])=>['receipts','outlays','netInterest'].includes(id)).map(([id,item])=>[id,{...item,observations:item.observations.filter(row=>row.date>='2020-01-01')}]))};
  const previous=deriveFiscalSeries(earlier),expected={receiptsTtm:6000,outlaysTtm:7200,netInterestTtm:900,primaryDeficitTtm:300,interestRevenueRatio:15};
  let recovered=0;
  for(const [id,value]of Object.entries(expected)){
    for(const row of previous[id].observations){
      const next=derived[id].observations.find(next=>next.date===row.date);
      if(row.value===null){assert.equal(next.value,value);recovered++;}else assert.equal(next.value,row.value);
      assert.equal(next.publishedAt,null);
    }
    assert.ok(derived[id].observations.slice(0,11).every(row=>row.value===null));
    assert.equal(derived[id].observations[11].value,value);
  }
  assert.equal(recovered,55);
});

test('fiscal collection requests full debt coverage and rejects incomplete history before publishing composition', async () => {
  const fixture = tables();
  const data = [
    { record_date: '1993-04-01', debt_held_public_amt: 'null', intragov_hold_amt: 'null', tot_pub_debt_out_amt: '4225873987843.44' },
    { record_date: '1997-09-30', debt_held_public_amt: '3789667546849.60', intragov_hold_amt: '1623478464547.74', tot_pub_debt_out_amt: '5413146011397.34' },
    { record_date: '2026-10-20', debt_held_public_amt: '32566198492042.62', intragov_hold_amt: '7873347523996.46', tot_pub_debt_out_amt: '40439546016039.08' },
  ];
  const fetchImpl = incomplete => async url => {
    const target = new URL(url), path = target.pathname;
    let payload = path.endsWith('mts_table_9') ? fixture.table9 : path.endsWith('mts_table_2') ? fixture.table2 : path.endsWith('mts_receipts_outlays_deficit_surplus') ? fixture.unitCheck : null;
    if (!payload) {
      assert.equal(target.searchParams.get('filter'), 'record_date:gte:1993-04-01,record_date:lte:2026-10-21');
      payload = { data, meta: { count: 3, 'total-count': 3, 'total-pages': incomplete ? 2 : 1 }, links: { next: null } };
    }
    return new Response(JSON.stringify(payload));
  };
  const result = await collectFiscal({ now: new Date('2026-10-21T20:00:00Z'), fetchImpl: fetchImpl(false) });
  assert.deepEqual(result.series.publicDebt.observations.map(row => row.date), ['1993-04-01', '1997-09-30', '2026-10-20']);
  assert.equal(result.series.publicDebt.observations[0].value, null);
  assert.equal(result.fiscal.debtBreakdown[0].grossDebt, 4.22587398784344);
  assert.equal(result.series.publicDebt.observations.at(-1).value, 32.56619849204262);
  assert.equal(result.provenance.find(row => row.url.includes('debt_to_penny')).url, result.series.publicDebt.sourceUrl);
  await assert.rejects(() => collectFiscal({ now: new Date('2026-10-21T20:00:00Z'), fetchImpl: fetchImpl(true) }), /debt.*(pagin|page|count|metadata|bound)/i);
});
