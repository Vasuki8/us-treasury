import test from 'node:test';
import assert from 'node:assert/strict';
import {series} from '../src/data.js';
import {buildCoverageInventory} from '../src/coverage-inventory.js';
import {transformSeries,toCsv} from '../src/model.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const starts={yield:'2003-01-02',realYield10:'2003-01-02',inflationComp10:'2003-01-02',industrialProduction:'1919-01-01',capacityUtilization:'1967-01-01',housingStarts:'1959-01-01',housingPermits:'1960-01-01',housingCompletions:'1968-01-01'};

test('published historical coverage reaches the same earliest rows through inventory, All and custom windows',()=>{
 const inventory=buildCoverageInventory(series);
 for(const [id,start] of Object.entries(starts)){
  const item=series[id],coverage=inventory.rows.find(row=>row.id===id);
  assert.equal(coverage.firstReference,start,id);
  assert.equal(coverage.totalCount,item.observations.length,id);
  assert.equal(transformSeries(item,'level',{preset:'all'}).observations[0].date,start,id);
  const exact=transformSeries(item,'level',{preset:'custom',startDate:start,endDate:start});
  assert.deepEqual(exact.observations.map(row=>row.date),[start],id);
  assert.equal(exact.observations[0].value,item.observations[0].value,id);
 }
});

test('historical Treasury indicator CSV uses only its actual annual inputs and keeps publication dates unknown',()=>{
 for(const [id,count] of [['yield',1],['realYield10',1],['inflationComp10',2]]){
  const csv=toCsv([id],{range:{preset:'custom',startDate:'2003-01-02',endDate:'2003-01-06'}});
  const [headers,...rows]=parseCsv(csv);
  assert.equal(rows.length,3,id);
  for(const row of rows){
   const data=Object.fromEntries(headers.map((key,index)=>[key,row[index]]));
   const receipts=JSON.parse(data.capture_provenance_json);
   assert.equal(receipts.length,count,id);
   assert.ok(receipts.every(receipt=>receipt.url.includes('.csv/2003/all')),id);
   assert.ok(receipts.every(receipt=>/^[a-f0-9]{64}$/.test(receipt.sha256)),id);
   assert.equal(data.publication_date,'',id);
   assert.equal(data.retrieved_at,receipts.map(receipt=>receipt.retrievedAt).sort().at(-1),id);
  }
 }
});
