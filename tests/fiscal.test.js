import test from 'node:test';
import assert from 'node:assert/strict';
let model;
try {model=await import('../src/fiscal.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const fiscal=()=>{assert.ok(model,'Fiscal calculation module exists');return model;};
const obs=(date,value)=>({date,value,publishedAt:null});
const months=(count,fn)=>Array.from({length:count},(_,i)=>obs(new Date(Date.UTC(2024,i,1)).toISOString().slice(0,10),fn(i)));
function source(count=24){return {series:{receipts:{observations:months(count,i=>100+i)},outlays:{observations:months(count,i=>150+2*i)},netInterest:{observations:months(count,i=>10+i)}}};}
test('fiscal deficit and primary deficit use same-month net budget interest without inventing releases',()=>{
  const result=fiscal().deriveFiscalSeries(source());
  assert.equal(result.budgetDeficit.observations[0].value,50);
  assert.equal(result.primaryDeficit.observations[0].value,40);
  assert.equal(result.primaryDeficit.observations.at(-1).value,40);
  assert.equal(result.budgetDeficit.observations[0].publishedAt,null);
});
test('TTM sums require twelve exact calendar months and ratio divides aligned trailing sums',()=>{
  const result=fiscal().deriveFiscalSeries(source());
  assert.equal(result.receiptsTtm.observations[10].value,null);
  assert.equal(result.receiptsTtm.observations[11].value,1266);
  assert.equal(result.outlaysTtm.observations[11].value,1932);
  assert.equal(result.netInterestTtm.observations[11].value,186);
  assert.ok(Math.abs(result.interestRevenueRatio.observations[11].value-186/1266*100)<1e-10);
  const missing=source();missing.series.receipts.observations.splice(4,1);
  assert.equal(fiscal().deriveFiscalSeries(missing).receiptsTtm.observations.find(o=>o.date==='2024-12-01').value,null);
});
test('missing interest remains missing and cannot make a primary deficit or zero ratio',()=>{
  const input=source();input.series.netInterest.observations[23].value=null;
  const result=fiscal().deriveFiscalSeries(input);
  assert.equal(result.primaryDeficit.observations.at(-1).value,null);
  assert.equal(result.interestRevenueRatio.observations.at(-1).value,null);
  input.series.receipts.observations.forEach(o=>o.value=0);
  assert.equal(fiscal().deriveFiscalSeries(input).interestRevenueRatio.observations.at(-1).value,null);
});
test('year-over-year contributors sum exactly to the deficit change, with receipts sign reversed',()=>{
  const result=fiscal().fiscalContributors(source());
  assert.equal(result.basis,'Monthly year over year');
  assert.equal(result.date,'2025-12-01');
  assert.equal(result.priorDate,'2024-12-01');
  assert.equal(result.receipts,-12);
  assert.equal(result.primaryOutlays,12);
  assert.equal(result.netInterest,12);
  assert.equal(result.deficitChange,12);
  assert.equal(result.receipts+result.primaryOutlays+result.netInterest,result.deficitChange);
});
test('no year-ago matching month produces an unavailable explanation, not previous-row substitution',()=>{
  assert.equal(fiscal().fiscalContributors(source(11)),null);
  const input=source();input.series.outlays.observations.splice(11,1);
  assert.equal(fiscal().fiscalContributors(input),null);
});
test('fiscal calculations reject duplicate/invalid month dates and preserve surpluses as negative deficits',()=>{
  const input=source();input.series.receipts.observations.push(obs('2024-01-01',2));
  assert.throws(()=>fiscal().deriveFiscalSeries(input),/duplicate/i);
  assert.throws(()=>fiscal().deriveFiscalSeries({series:{receipts:{observations:[obs('2024-02-30',1)]}}}),/month|date/i);
  const surplus=source();surplus.series.receipts.observations[0].value=200;
  assert.equal(fiscal().deriveFiscalSeries(surplus).budgetDeficit.observations[0].value,-50);
});
test('category changes match exact year-ago names and keep unmatched or missing categories unavailable',()=>{
  const source={monthly:[{date:'2024-09-01',contributors:{receipts:[{name:'Income taxes',value:80},{name:'Unknown',value:null}],outlays:[{name:'Defense',value:50}]}},{date:'2025-09-01',contributors:{receipts:[{name:'Income taxes',value:100},{name:'Unknown',value:2},{name:'New',value:5}],outlays:[{name:'Defense',value:55}]}}]};
  const rows=fiscal().fiscalCategoryChanges(source);
  assert.deepEqual(rows.map(r=>[r.group,r.name,r.deficitContribution]),[['Receipts','Income taxes',-20],['Outlays','Defense',5]]);
});
