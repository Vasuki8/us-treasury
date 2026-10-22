import test from 'node:test';import assert from 'node:assert/strict';
import {registry} from '../src/registry.js';import {macroRegistry,coverageFamilies} from '../src/macro-registry.js';
import {comparisonClassification,transformSeries} from '../src/model.js';import {getFreshness} from '../src/freshness.js';

test('macro families register exact measurement metadata and comparison eligibility without unknown classes',()=>{
 assert.equal(Object.keys(macroRegistry).length,29);
 for(const [id,item]of Object.entries(macroRegistry)){
  assert.equal(registry[id],item);assert.ok(item.unit&&item.definition&&item.adjustment&&item.frequency&&item.code,id);
  assert.match(item.source.url,/^https:\/\//,id);assert.notEqual(comparisonClassification(item),'unknown',id);
 }
 for(const family of Object.values(coverageFamilies)){
  assert.ok(family.question&&family.context&&family.limitations);assert.ok(family.ids.includes(family.defaultMeasure));
  assert.ok(family.compare.length<=4&&family.compare.every(id=>family.ids.includes(id)));
  assert.ok(family.ids.every(id=>Object.hasOwn(registry,id)));
 }
 assert.equal(registry.cpiMonthly.adjustment,'Seasonally adjusted');assert.equal(registry.cpiCore.adjustment,'Not seasonally adjusted');
 assert.match(registry.realSpending.unit,/2017.*SAAR/);assert.match(registry.realSpendingMonthly.definition,/not annualized/);
 for(const id of ['policyTargetLower','policyTargetUpper','iorb'])assert.equal(registry[id].dateConvention,'source-effective-date');
 assert.equal(registry.continuedClaims.dateConvention,'week-ending');
});

test('new collectors are required freshness targets even if their source objects disappear',()=>{
 const result=getFreshness({});
 for(const id of ['policyRates','activity','housing'])assert.equal(result.entries.find(row=>row.id===`data:${id}`)?.status,'unavailable',id);
 assert.equal(result.entries.length,21);
});

test('differences of price and activity indexes are explicitly index-point changes',()=>{
 const s={...macroRegistry.pceIndex,observations:[{date:'2026-07-01',value:130},{date:'2026-08-01',value:131}]};
 const panel=transformSeries(s,'change',{preset:'all'});
 assert.equal(panel.observations[1].value,1);assert.match(panel.unit,/Index.point change.*2017=100/i);
});
