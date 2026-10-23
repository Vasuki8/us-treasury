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

test('new external pins record the selected component and method while preserving all five original attachment bytes',async()=>{
 const state=parseRoute('#/economy?family=external&measure=itaServicesBalance&window=custom&start=2024-04-01&end=2025-01-01'),before=canonicalJson(snapshot.sources),args=buildPinContext(state),retained=args.context.currentAccountGdpComponentEffects,range={preset:'custom',startDate:'2024-04-01',endDate:'2025-01-01'};
 assert.ok(retained,'Component history reconstruction requires its own optional selection envelope.');assert.deepEqual(retained,{version:1,method:'symmetric-two-order-v1',measure:'itaServicesBalance',range,inputContext:'currentAccountGdpBreakdown'});assert.equal(Object.hasOwn(retained,'sources'),false);
 const sources=args.context[retained.inputContext].sources;for(const [agency,source]of Object.entries(sources))for(const [id,item]of Object.entries(source.series))assert.deepEqual(item,snapshot.sources[agency].series[id]);assert.equal(canonicalJson(snapshot.sources),before);
 assert.deepEqual(args.context.attachments,[['current-account-current-prior.csv',currentAccountCsv(snapshot.sources.beaIta)],['current-account-gdp.csv',currentAccountGdpCsv(snapshot.sources)],['current-account-gdp-history.csv',currentAccountGdpHistoryCsv(snapshot.sources,range)],['current-account-gdp-breakdown.csv',currentAccountGdpBreakdownCsv(snapshot.sources,range)],['current-account-gdp-trailing.csv',currentAccountGdpTrailingCsv(snapshot.sources,range,{comparisonMeasure:'itaServicesBalance'})]].map(([name,content])=>({name,content,type:'text/csv'})));
 assert.match(args.context.scope,/selected component/i);assert.match(args.context.scope,/reconstruct/i);
 const pkg=await createResearchPackage({name:'Frozen selected-component effects',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpComponentEffects,retained);
 const html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-component-effects"/);assert.match(html,new RegExp(`data-export-frozen-current-account-gdp-component-effects="${pkg.id}"`));assert.doesNotMatch(html,/data-export-current-account-gdp-component-effects(?:[\s=>])|id="current-account-effect-component"/);assert.match(html,/Services/i);
});

test('pinning resolves component-only history to Goods for total or unrelated focus and preserves all four admitted selections',()=>{
 for(const measure of ['currentAccountBalance','nominalTradeBalance','nominalGdp','gdp']){const args=buildPinContext({...parseRoute('#/economy?family=external&window=1y'),macroMeasure:measure});assert.equal(args.context.currentAccountGdpComponentEffects?.measure,'itaGoodsBalance');}
 for(const measure of ['itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance']){const args=buildPinContext(parseRoute(`#/economy?family=external&measure=${measure}&window=1y`));assert.equal(args.context.currentAccountGdpComponentEffects?.measure,measure);}
});

test('frozen component history and selected CSV use the recorded component, sources and window despite later live changes',async()=>{
 const sources=structuredClone(snapshot.sources),args=buildPinContext(parseRoute('#/economy?family=external&measure=itaPrimaryIncomeBalance&window=custom&start=2026-04-01&end=2026-04-01'),{sources}),retained=args.context.currentAccountGdpComponentEffects;assert.ok(retained);
 const pkg=await createResearchPackage({name:'Independent selected component CSV',...args}),restored=await importResearchPackage(exportResearchPackage(pkg)),{currentAccountGdpComponentEffectsCsv}=await import('../src/current-account-gdp-component-effects-view.js'),inputs=restored.context[retained.inputContext].sources,expected=currentAccountGdpComponentEffectsCsv(inputs,retained.range,retained.measure),html=renderFrozen(restored);
 assert.match(expected.split(/\r?\n/,1)[0],/component_measure_id/);assert.match(expected,/itaPrimaryIncomeBalance/);assert.doesNotMatch(expected,/itaGoodsBalance|itaServicesBalance|itaSecondaryIncomeBalance/);
 for(const item of Object.values(sources.beaIta.series))for(const row of item.observations)if(row.value!==null)row.value*=3;
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen reconstruction must not fetch.');};
 try{assert.equal(currentAccountGdpComponentEffectsCsv(inputs,retained.range,retained.measure),expected);assert.notEqual(currentAccountGdpComponentEffectsCsv(sources,retained.range,retained.measure),expected);assert.equal(renderFrozen(restored),html);assert.equal(Object.isFrozen(restored.context.currentAccountGdpBreakdown.sources.beaIta.series.itaPrimaryIncomeBalance.observations),true);}finally{globalThis.fetch=originalFetch;}
});

test('partial frozen component history keeps unavailable components and denominator without current-source fallback',async()=>{
 const sources={beaIta:{status:'error',error:'Cached partial capture',fetchedAt:'2026-10-23T20:00:00.000Z',series:{itaGoodsBalance:snapshot.sources.beaIta.series.itaGoodsBalance}},bea:{status:'unavailable',error:'No GDP capture',series:{}}},args=buildPinContext(parseRoute('#/economy?family=external&measure=itaServicesBalance&window=all'),{sources}),retained=args.context.currentAccountGdpComponentEffects;assert.ok(retained);
 const inputs=args.context[retained.inputContext].sources;assert.deepEqual(Object.keys(inputs.beaIta.series),['itaGoodsBalance']);assert.deepEqual(inputs.bea.series,{});
 const pkg=await createResearchPackage({name:'Unavailable frozen component history',...args}),restored=await importResearchPackage(exportResearchPackage(pkg));assert.deepEqual(restored.context.currentAccountGdpBreakdown.sources,inputs);
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen viewers must not fetch missing inputs.');};
 try{const html=renderFrozen(restored);assert.match(html,/FROZEN[^<]*COMPONENT|data-chart-catalog="current-account-gdp-component-effects"/);assert.doesNotMatch(html,/data-export-current-account-gdp-component-effects(?:[\s=>])/);const {currentAccountGdpComponentEffectsCsv}=await import('../src/current-account-gdp-component-effects-view.js');assert.match(currentAccountGdpComponentEffectsCsv(inputs,retained.range,retained.measure),/unavailable|missing/i);}finally{globalThis.fetch=originalFetch;}
});

test('legacy frozen packages acquire no component-history panel, selection or reconstruction action',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=1y'));delete args.context.currentAccountGdpComponentEffects;delete args.context.currentAccountGdpAllComponentEffects;args.context.scope='Legacy retained total balance effects and combined ratio contributions.';
 const pkg=await createResearchPackage({name:'Legacy total balance effects',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text),html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-balance-effects"/);assert.doesNotMatch(html,/data-chart-catalog="current-account-gdp-component-effects"|data-export-frozen-current-account-gdp-component-effects|id="current-account-effect-component"/);assert.equal(exportResearchPackage(restored),text);
});

test('component history renders independently of the other optional ratio, contribution and total effect panels',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&measure=itaSecondaryIncomeBalance&window=1y'));assert.ok(args.context.currentAccountGdpComponentEffects);for(const key of ['currentAccountGdpHistory','currentAccountGdpTrailing','currentAccountGdpComparison','currentAccountGdpContributions','currentAccountGdpBalanceEffects','currentAccountGdpAllComponentEffects'])delete args.context[key];
 const pkg=await createResearchPackage({name:'Only component effect history supplement',...args}),restored=await importResearchPackage(exportResearchPackage(pkg)),html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-component-effects"/);assert.doesNotMatch(html,/data-chart-catalog="current-account-gdp-balance-effects"|data-chart-catalog="current-account-gdp-contributions"/);
});

test('all-history component reconstruction remains durable inside the unchanged 3 MiB storage cap',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=all'));assert.ok(args.context.currentAccountGdpComponentEffects);const pkg=await createResearchPackage({name:'Durable all-history component effects',...args}),text=exportResearchPackage(pkg);assert.ok(Buffer.byteLength(text)<3*1024*1024);assert.equal(pkg.context.attachments.length,5);
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},locks=researchLocks(),library=await createResearchLibrary(storage,{locks});assert.equal((await library.pinPackage(pkg)).persisted,true);assert.equal(library.getState().sessionOnly,false);
 const reopened=await createResearchLibrary(storage,{locks}),restored=reopened.getPackage(pkg.id);assert.ok(restored);assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpComponentEffects,pkg.context.currentAccountGdpComponentEffects);assert.deepEqual(restored.context.currentAccountGdpBreakdown,pkg.context.currentAccountGdpBreakdown);
});
