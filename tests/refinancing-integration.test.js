import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
import {getSeries} from '../src/model.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
test('refinancing routes preserve validated scenario controls and registry units',()=>{
  const state=parseRoute('#/refinancing?horizon=24&shock=200');
  assert.equal(state.page,'refinancing');assert.equal(state.refinancingHorizon,24);assert.equal(state.refinancingShock,200);
  assert.equal(routeFor(state),'#/refinancing?horizon=24&shock=200');
  assert.equal(parseRoute('#/refinancing?horizon=999&shock=-200').refinancingHorizon,12);
  assert.equal(getSeries('marketableDebt')?.observationType,'calculated');
});
test('MSPD admission excludes unrelated feeds and raw third-party identifiers',()=>{
  const source={sources:{refinancing:{series:{marketableDebt:{sourceIds:['mspd_table_3_market:unmatured-outstanding'],sourceUrl:'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/mspd_table_3_market'}},securities:[{cusip:'123456789'}]}}};
  assert.throws(()=>assertCommercialData(source),/identifier|CUSIP/);
  source.sources.refinancing.securities=[];
  source.sources.refinancing.series.marketableDebt.sourceUrl='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/mspd_table_4';
  assert.throws(()=>assertCommercialData(source),/feed/);
});
