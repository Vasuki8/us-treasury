import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
import {renderPage} from '../src/pages.js';
import {getSeries,toCsv} from '../src/model.js';
import {getFreshness} from '../src/freshness.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
test('Fiscal pressure is a first-class route with existing detail/comparison/export navigation',()=>{
  assert.equal(parseRoute('#/fiscal').page,'fiscal');
  assert.equal(routeFor({page:'fiscal'}),'#/fiscal');
  const html=renderPage({page:'fiscal'});
  for(const label of ['FISCAL PRESSURE','WHAT CHANGED','WHAT CONTRIBUTED','WHY IT MATTERS','LIMITATIONS','gross debt','debt held by the public','net budget interest','cash balance'])assert.ok(html.toLowerCase().includes(label.toLowerCase()),label);
  assert.match(html,/data-compare=/);
  assert.match(html,/data-export-fiscal/);
});
test('fiscal series cannot substitute another reviewed Treasury dataset for its admitted feed',()=>{
  const base='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/';
  const invalid={sources:{fiscal:{series:{receipts:{sourceIds:['mts_table_9:Receipts:Total:current_month_rcpt_outly_amt'],sourceUrl:base+'v2/accounting/od/debt_to_penny'}}}}};
  assert.throws(()=>assertCommercialData(invalid),/feed/);
});
test('fiscal registry definitions distinguish calculated arithmetic and preserve metadata in CSV',()=>{
  assert.equal(getSeries('receipts')?.unit,'USD billions');
  assert.equal(getSeries('interestRevenueRatio')?.observationType,'calculated');
  assert.match(toCsv(['receipts','primaryDeficit']),/observation_type/);
});
test('research captures join the existing freshness system without replacing any old target',()=>{
  const input={sources:{fiscal:{status:'ok',fetchedAt:'2026-10-21T23:50:00.000Z'}}};
  const entries=getFreshness(input,{now:new Date('2026-10-22T02:00:00Z')}).entries;
  assert.equal(entries.length,12);
  assert.equal(entries.find(e=>e.id==='data:fiscal').status,'available');
  assert.equal(entries.find(e=>e.id==='calendar:bls').status,'unavailable');
});
