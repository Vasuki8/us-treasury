import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../src/official-snapshot.js';
import {parseRoute} from '../src/router.js';
import {renderPage} from '../src/pages.js';
import {buildPinContext} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {canonicalJson} from '../src/research-workspaces.js';
import {createResearchLibrary} from '../src/research-library.js';
import {researchLocks} from './helpers/research-locks.js';
import {currentAccountCsv} from '../src/current-account-view.js';
import {currentAccountGdpCsv,currentAccountGdpHistoryCsv} from '../src/current-account-gdp-view.js';
import {currentAccountGdpBreakdownCsv} from '../src/current-account-gdp-breakdown-view.js';
import {currentAccountGdpTrailingCsv} from '../src/current-account-gdp-trailing-view.js';

const renderFrozen=pkg=>renderPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[pkg],workspaces:[]}});

test('new external pins retain the symmetric balance-effects method and window while preserving all five original attachment bytes',async()=>{
 const state=parseRoute('#/economy?family=external&measure=itaServicesBalance&window=custom&start=2024-04-01&end=2025-01-01'),before=canonicalJson(snapshot.sources),args=buildPinContext(state),retained=args.context.currentAccountGdpBalanceEffects,range={preset:'custom',startDate:'2024-04-01',endDate:'2025-01-01'};
 assert.ok(retained,'Balance/GDP effect reconstruction requires its own optional method envelope.');
 assert.deepEqual(retained,{version:1,method:'symmetric-two-order-v1',range,inputContext:'currentAccountGdpBreakdown'});assert.equal(Object.hasOwn(retained,'sources'),false);
 const sources=args.context[retained.inputContext].sources;
 for(const [agency,source]of Object.entries(sources))for(const [id,item]of Object.entries(source.series))assert.deepEqual(item,snapshot.sources[agency].series[id]);
 assert.equal(canonicalJson(snapshot.sources),before);
 assert.deepEqual(args.context.attachments,[
  ['current-account-current-prior.csv',currentAccountCsv(snapshot.sources.beaIta)],['current-account-gdp.csv',currentAccountGdpCsv(snapshot.sources)],['current-account-gdp-history.csv',currentAccountGdpHistoryCsv(snapshot.sources,range)],['current-account-gdp-breakdown.csv',currentAccountGdpBreakdownCsv(snapshot.sources,range)],['current-account-gdp-trailing.csv',currentAccountGdpTrailingCsv(snapshot.sources,range,{comparisonMeasure:'itaServicesBalance'})],
 ].map(([name,content])=>({name,content,type:'text/csv'})));
 assert.match(args.context.scope,/symmetric|two.order/i);assert.match(args.context.scope,/reconstruct/i);
 const pkg=await createResearchPackage({name:'Frozen balance and GDP-denominator effects',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpBalanceEffects,retained);
 const html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-balance-effects"/);assert.match(html,new RegExp(`data-export-frozen-current-account-gdp-balance-effects="${pkg.id}"`));assert.doesNotMatch(html,/data-export-current-account-gdp-balance-effects(?:[\s=>])/);
});

test('balance-effects frozen reconstruction uses only retained sources and the recorded endpoint range despite later live changes',async()=>{
 const sources=structuredClone(snapshot.sources),args=buildPinContext(parseRoute('#/economy?family=external&window=custom&start=2026-04-01&end=2026-04-01'),{sources}),retained=args.context.currentAccountGdpBalanceEffects;assert.ok(retained);
 const pkg=await createResearchPackage({name:'Independent frozen effects CSV',...args}),restored=await importResearchPackage(exportResearchPackage(pkg));
 const {currentAccountGdpBalanceEffectsCsv}=await import('../src/current-account-gdp-balance-effects-view.js');
 const inputs=restored.context[retained.inputContext].sources,expected=currentAccountGdpBalanceEffectsCsv(inputs,retained.range);
 for(const item of Object.values(sources.beaIta.series))for(const row of item.observations)if(row.value!==null)row.value*=3;
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen reconstruction must not fetch.');};
 try{assert.equal(currentAccountGdpBalanceEffectsCsv(inputs,retained.range),expected);assert.notEqual(currentAccountGdpBalanceEffectsCsv(sources,retained.range),expected);assert.equal(Object.isFrozen(restored.context.currentAccountGdpBreakdown.sources.beaIta.series.itaGoodsBalance.observations),true);}finally{globalThis.fetch=originalFetch;}
});

test('partial frozen balance effects preserve unavailable denominator and components without current-source fallback',async()=>{
 const sources={beaIta:{status:'error',error:'Cached partial capture',fetchedAt:'2026-10-23T20:00:00.000Z',series:{itaGoodsBalance:snapshot.sources.beaIta.series.itaGoodsBalance}},bea:{status:'unavailable',error:'No GDP capture',series:{}}};
 const args=buildPinContext(parseRoute('#/economy?family=external&measure=itaGoodsBalance&window=all'),{sources}),retained=args.context.currentAccountGdpBalanceEffects;assert.ok(retained);
 const inputs=args.context[retained.inputContext].sources;assert.deepEqual(Object.keys(inputs.beaIta.series),['itaGoodsBalance']);assert.deepEqual(inputs.bea.series,{});
 const pkg=await createResearchPackage({name:'Unavailable frozen balance effects',...args}),restored=await importResearchPackage(exportResearchPackage(pkg));assert.deepEqual(restored.context.currentAccountGdpBreakdown.sources,inputs);
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen viewers must not fetch missing inputs.');};
 try{const html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-balance-effects"|FROZEN[^<]*BALANCE/i);
  assert.doesNotMatch(html,/data-export-current-account-gdp-balance-effects(?:[\s=>])/);const {currentAccountGdpBalanceEffectsCsv}=await import
  ('../src/current-account-gdp-balance-effects-view.js');assert.match(currentAccountGdpBalanceEffectsCsv(inputs,retained.range),
  /unavailable|missing/i);}finally{globalThis.fetch=originalFetch;}
});

test('legacy frozen packages do not acquire balance-effects panels, reconstruction actions or method claims',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=1y'));delete args.context.currentAccountGdpBalanceEffects;delete args.context.currentAccountGdpComponentEffects;delete args.context.currentAccountGdpAllComponentEffects;args.context.scope='Legacy retained combined ratio contributions, original CSVs and breakdown input histories.';
 const pkg=await createResearchPackage({name:'Legacy combined ratio contributions',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 const html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-contributions"/);assert.doesNotMatch(html,/data-chart-catalog="current-account-gdp-balance-effects"|data-export-frozen-current-account-gdp-balance-effects|symmetric-two-order-v1/);assert.equal(exportResearchPackage(restored),text);
});

test('balance-effects frozen context renders independently of the optional combined-contributions panel',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=1y'));assert.ok(args.context.currentAccountGdpBalanceEffects);delete args.context.currentAccountGdpContributions;
 const pkg=await createResearchPackage({name:'Only balance-effects supplement',...args}),restored=await importResearchPackage(exportResearchPackage(pkg)),html=renderFrozen(restored);
 assert.match(html,/data-chart-catalog="current-account-gdp-balance-effects"/);assert.doesNotMatch(html,/data-chart-catalog="current-account-gdp-contributions"|data-export-frozen-current-account-gdp-contributions/);
});

test('all-history balance-effects reconstruction remains durable inside the unchanged 3 MiB storage cap',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=all'));assert.ok(args.context.currentAccountGdpBalanceEffects);
 const pkg=await createResearchPackage({name:'Durable all-history balance and GDP effects',...args}),text=exportResearchPackage(pkg);assert.ok(Buffer.byteLength(text)<3*1024*1024);assert.equal(pkg.context.attachments.length,5);
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},locks=researchLocks(),library=await createResearchLibrary(storage,{locks});
 assert.equal((await library.pinPackage(pkg)).persisted,true);assert.equal(library.getState().sessionOnly,false);
 const reopened=await createResearchLibrary(storage,{locks}),restored=reopened.getPackage(pkg.id);assert.ok(restored);assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpBalanceEffects,pkg.context.currentAccountGdpBalanceEffects);assert.deepEqual(restored.context.currentAccountGdpBreakdown,pkg.context.currentAccountGdpBreakdown);
});
