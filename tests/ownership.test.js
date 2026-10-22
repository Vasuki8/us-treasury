import test from 'node:test';
import assert from 'node:assert/strict';
let model;
try { model=await import('../src/ownership.js'); }
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('ownership.js'))throw error;}
const api=()=>{assert.ok(model,'Ownership summary must exist');return model;};
const source=()=>({z1:{asOf:'2026-06-30',releaseDate:'2026-09-11',assets:100,liabilities:105,valuationDiscrepancy:5,reconciled:true,sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'},{code:'LM263061105.Q',label:'Rest of the world',value:30,valuation:'market value'}],history:[{date:'2026-03-31',sectors:[{code:'LM713061103.Q',value:19},{code:'LM263061105.Q',value:31}]}]},soma:{asOf:'2026-10-14',principal:24,inflationCompensation:1,adjustedPrincipal:25,history:[{date:'2026-10-07',adjustedPrincipal:26},{date:'2026-10-14',adjustedPrincipal:25}]},limitations:['Source limitations']});

test('ownership reports matched-quarter sector position changes and separately dated SOMA par holdings',()=>{
  const result=api().summarizeOwnership(source());
  assert.equal(result.status,'ok');
  assert.equal(result.asOf,'2026-06-30');
  assert.equal(result.releaseDate,'2026-09-11');
  assert.equal(result.sectors[0].change,1);
  assert.equal(result.sectors[1].change,-1);
  assert.equal(result.soma.change,-1);
  assert.equal(result.soma.asOf,'2026-10-14');
  assert.ok(result.limitations.some(text=>/market.*par|valuation.*date/i.test(text)));
  assert.ok(result.limitations.some(text=>/purchase|sale/i.test(text)));
  assert.ok(!('combinedTotal'in result),'Incompatible Z1 and SOMA measures are never summed');
});

test('ownership gaps and missing values do not become zero changes or inferred purchases',()=>{
  const data=source();data.z1.history[0].date='2025-12-31';data.z1.sectors[1].value=null;
  const result=api().summarizeOwnership(data);
  assert.equal(result.sectors[0].change,null);
  assert.equal(result.sectors[1].change,null);
  assert.equal(api().summarizeOwnership(undefined).status,'unavailable');
});
