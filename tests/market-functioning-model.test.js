import test from 'node:test';
import assert from 'node:assert/strict';
let model;
try {model=await import('../src/market-functioning.js');}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('market-functioning.js'))throw error;}
const market=()=>{assert.ok(model,'The market-functioning model must exist');return model;};

test('funding-rate difference matches exact effective dates and preserves zero, missing and revised inputs',()=>{
  const sofr=[{date:'2026-10-19',value:3.87,revisionIndicator:'Y'},{date:'2026-10-20',value:3.88}];
  const effr=[{date:'2026-10-16',value:3.88},{date:'2026-10-20',value:3.88}];
  const rows=market().fundingRateDifference(sofr,effr);
  assert.deepEqual(rows.map(({date,value})=>({date,value})),[{date:'2026-10-16',value:null},{date:'2026-10-19',value:null},{date:'2026-10-20',value:0}]);
  assert.ok(rows.every(row=>row.publishedAt===null));
  assert.throws(()=>market().fundingRateDifference([...sofr,sofr[0]],effr),/duplicate/i);
});

test('weekly indicator changes require the exact prior week and never replace suppressed latest values',()=>{
  const source={series:{dealerRepo:{observations:[{date:'2026-09-23',value:2200},{date:'2026-10-07',value:null}]},dealerNetTreasury:{observations:[{date:'2026-09-30',value:432.032},{date:'2026-10-07',value:444.683}]}}};
  const rows=market().dealerWeeklyChanges(source);
  assert.equal(rows.find(row=>row.id==='dealerRepo').current,null);
  assert.equal(rows.find(row=>row.id==='dealerRepo').change,null);
  assert.equal(rows.find(row=>row.id==='dealerNetTreasury').change,12.651);
  assert.equal(rows.find(row=>row.id==='dealerNetTreasury').previousDate,'2026-09-30');
  assert.ok(rows.every(row=>row.unit==='USD billions'));
  assert.deepEqual(market().dealerWeeklyChanges({}),[]);
});
