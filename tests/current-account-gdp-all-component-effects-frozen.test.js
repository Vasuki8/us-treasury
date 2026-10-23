import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {snapshot} from '../src/official-snapshot.js';
import {parseRoute} from '../src/router.js';
import {buildPinContext} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {canonicalJson} from '../src/research-workspaces.js';
import {createResearchLibrary} from '../src/research-library.js';
import {researchLocks} from './helpers/research-locks.js';
import {currentAccountCsv} from '../src/current-account-view.js';
import {currentAccountGdpCsv,currentAccountGdpHistoryCsv} from '../src/current-account-gdp-view.js';
import {currentAccountGdpBreakdownCsv} from '../src/current-account-gdp-breakdown-view.js';
import {currentAccountGdpTrailingCsv} from '../src/current-account-gdp-trailing-view.js';
import {currentAccountGdpBalanceEffectsCsv} from '../src/current-account-gdp-balance-effects-view.js';

const range={preset:'custom',startDate:'2024-04-01',endDate:'2025-01-01'};
const state=()=>parseRoute('#/economy?family=external&measure=itaServicesBalance&window=custom&start=2024-04-01&end=2025-01-01');
const envelope=()=>({version:1,method:'symmetric-two-order-v1',range,inputContext:'currentAccountGdpBreakdown'});
const args=()=>buildPinContext(state());
async function renderFrozen(pkg){const {renderPage}=await import('../src/pages.js');return renderPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[pkg],workspaces:[]}});}

test('all-component comparison pins record an independent four-key envelope and leave the original attachment bytes unchanged',async()=>{
 const before=canonicalJson(snapshot.sources),captured=args(),retained=captured.context.currentAccountGdpAllComponentEffects;
 assert.deepEqual(retained,envelope());assert.equal(Object.hasOwn(retained,'sources'),false);assert.equal(Object.hasOwn(retained,'measure'),false);
 const sources=captured.context[retained.inputContext].sources;
 assert.deepEqual(Object.keys(sources.beaIta.series),['currentAccountBalance','itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance']);assert.deepEqual(Object.keys(sources.bea.series),['nominalGdp']);
 for(const [agency,source]of Object.entries(sources))for(const [id,item]of Object.entries(source.series))assert.deepEqual(item,snapshot.sources[agency].series[id]);assert.equal(canonicalJson(snapshot.sources),before);
 assert.deepEqual(captured.context.attachments,[['current-account-current-prior.csv',currentAccountCsv(snapshot.sources.beaIta)],['current-account-gdp.csv',currentAccountGdpCsv(snapshot.sources)],['current-account-gdp-history.csv',currentAccountGdpHistoryCsv(snapshot.sources,range)],['current-account-gdp-breakdown.csv',currentAccountGdpBreakdownCsv(snapshot.sources,range)],['current-account-gdp-trailing.csv',currentAccountGdpTrailingCsv(snapshot.sources,range,{comparisonMeasure:'itaServicesBalance'})]].map(([name,content])=>({name,content,type:'text/csv'})));
 const pkg=await createResearchPackage({name:'All-component effect comparison',...captured}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpAllComponentEffects,retained);assert.equal(Object.isFrozen(restored.context.currentAccountGdpAllComponentEffects),true);
 const html=await renderFrozen(restored);assert.match(html,new RegExp(`data-export-frozen-current-account-gdp-all-component-effects="${pkg.id}"`));assert.doesNotMatch(html,/data-export-current-account-gdp-all-component-effects(?:[\s=>])/);
});

test('all-component comparison validates exact envelope keys, method, independent endpoint window and input reference',async()=>{
 const mutations=[context=>{context.currentAccountGdpAllComponentEffects=null;},context=>{context.currentAccountGdpAllComponentEffects=[];},context=>{context.currentAccountGdpAllComponentEffects={};},...['version','method','range','inputContext'].map(field=>context=>{delete context.currentAccountGdpAllComponentEffects[field];}),context=>{context.currentAccountGdpAllComponentEffects.version=2;},context=>{context.currentAccountGdpAllComponentEffects.method='prior-gdp-first';},context=>{context.currentAccountGdpAllComponentEffects.measure='itaGoodsBalance';},context=>{context.currentAccountGdpAllComponentEffects.sources={};},context=>{context.currentAccountGdpAllComponentEffects.inputContext='currentAccountGdpHistory';},context=>{context.currentAccountGdpAllComponentEffects.inputContext=['currentAccountGdpBreakdown'];},context=>{delete context.currentAccountGdpBreakdown;},context=>{context.currentAccountGdpBreakdown.sources.bea.series.nominalGdp.observations[0].value=Infinity;},...[-1,50001,null,'all',{preset:'10y'},{preset:'all',fallback:'live'},{preset:'custom',startDate:'2026-04-01',endDate:'2026-01-01'},{preset:'custom',startDate:'2026-02-30',endDate:'2026-04-01'}].map(range=>context=>{context.currentAccountGdpAllComponentEffects.range=range;})];
 for(const change of mutations){const captured=args();captured.context={currentAccountGdpBreakdown:structuredClone(captured.context.currentAccountGdpBreakdown),currentAccountGdpAllComponentEffects:envelope()};change(captured.context);await assert.rejects(createResearchPackage({name:'Invalid comparison',...captured}),/all.component|breakdown|date.window|finite|non.finite|JSON number/i);}
 const captured=args();captured.context.currentAccountGdpAllComponentEffects={...envelope(),range:{preset:'all'}};const pkg=await createResearchPackage({name:'Independent comparison window',...captured});assert.notDeepEqual(pkg.context.currentAccountGdpAllComponentEffects.range,pkg.context.currentAccountGdpBreakdown.range);
});

test('checksum-valid imports still reject unsupported all-component reconstruction methods and redirected or malformed contexts',async()=>{
 const captured=args();captured.context={currentAccountGdpBreakdown:{version:1,range:{preset:'all'},sources:{beaIta:{series:{}},bea:{series:{}}}},currentAccountGdpAllComponentEffects:envelope()};
 const text=exportResearchPackage(await createResearchPackage({name:'Imported comparison validation',...captured}));
 for(const change of [context=>{context.currentAccountGdpAllComponentEffects={...envelope(),version:2};},context=>{context.currentAccountGdpAllComponentEffects.method='symmetric-two-order-v2';},context=>{context.currentAccountGdpAllComponentEffects.extra=true;},context=>{context.currentAccountGdpAllComponentEffects.inputContext='live';},context=>{delete context.currentAccountGdpBreakdown;},context=>{context.currentAccountGdpAllComponentEffects.range={preset:'custom',startDate:'2026-02-30',endDate:'2026-04-01'};}]){
  const plain=JSON.parse(text);change(plain.context);delete plain.checksum;plain.checksum={algorithm:'SHA-256',value:createHash('sha256').update(canonicalJson(plain)).digest('hex')};await assert.rejects(importResearchPackage(JSON.stringify(plain)),/all.component|breakdown|date.window/i);
 }
});

test('all-component comparison renders independently of selected-component and other optional history contexts',async()=>{
 const captured=args();assert.ok(captured.context.currentAccountGdpAllComponentEffects);for(const key of ['currentAccountGdpHistory','currentAccountGdpTrailing','currentAccountGdpComparison','currentAccountGdpContributions','currentAccountGdpBalanceEffects','currentAccountGdpComponentEffects'])delete captured.context[key];
 const pkg=await createResearchPackage({name:'Only all-component comparison',...captured}),restored=await importResearchPackage(exportResearchPackage(pkg)),html=await renderFrozen(restored);
 assert.equal((html.match(/data-chart-catalog="current-account-gdp-component-effects"/g)??[]).length,8);assert.doesNotMatch(html,/data-export-frozen-current-account-gdp-component-effects|data-chart-catalog="current-account-gdp-balance-effects"|id="current-account-effect-component"/);
 for(const id of ['itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance'])assert.match(html,new RegExp(id));
});

test('legacy pins acquire no all-component comparison panel or export action and round-trip byte for byte',async()=>{
 const captured=args();delete captured.context.currentAccountGdpAllComponentEffects;
 const pkg=await createResearchPackage({name:'Legacy selected component',...captured}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text),html=await renderFrozen(restored);assert.equal(Object.hasOwn(restored.context,'currentAccountGdpAllComponentEffects'),false);assert.doesNotMatch(html,/data-export-frozen-current-account-gdp-all-component-effects/);assert.equal(exportResearchPackage(restored),text);
});

test('frozen comparison and all-component effect CSV use only retained inputs despite current data mutation',async()=>{
 const sources=structuredClone(snapshot.sources),captured=buildPinContext(state(),{sources}),retained=captured.context.currentAccountGdpAllComponentEffects;assert.ok(retained);
 const pkg=await createResearchPackage({name:'Frozen all-component evidence',...captured}),restored=await importResearchPackage(exportResearchPackage(pkg)),inputs=restored.context[retained.inputContext].sources,expected=currentAccountGdpBalanceEffectsCsv(inputs,retained.range),html=await renderFrozen(restored);
 for(const item of Object.values(sources.beaIta.series))for(const row of item.observations)if(row.value!==null)row.value*=3;
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen comparison must never fetch.');};
 try{assert.equal(currentAccountGdpBalanceEffectsCsv(inputs,retained.range),expected);assert.notEqual(currentAccountGdpBalanceEffectsCsv(sources,retained.range),expected);assert.equal(await renderFrozen(restored),html);assert.equal(Object.isFrozen(inputs.beaIta.series.itaGoodsBalance.observations),true);}finally{globalThis.fetch=originalFetch;}
});

test('partial frozen comparison retains missing component and denominator evidence without current-source fallback',async()=>{
 const sources={beaIta:{status:'error',error:'Cached partial capture',series:{itaGoodsBalance:snapshot.sources.beaIta.series.itaGoodsBalance}},bea:{status:'unavailable',error:'No GDP capture',series:{}}},captured=buildPinContext(parseRoute('#/economy?family=external&window=all'),{sources}),retained=captured.context.currentAccountGdpAllComponentEffects;assert.ok(retained);
 const pkg=await createResearchPackage({name:'Partial all-component comparison',...captured}),restored=await importResearchPackage(exportResearchPackage(pkg)),inputs=restored.context[retained.inputContext].sources;
 assert.deepEqual(Object.keys(inputs.beaIta.series),['itaGoodsBalance']);assert.deepEqual(inputs.bea.series,{});
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Missing frozen inputs must remain missing.');};
 try{const html=await renderFrozen(restored);assert.match(html,/unavailable|missing/i);assert.match(html,/data-export-frozen-current-account-gdp-all-component-effects/);assert.doesNotMatch(html,/data-export-current-account-gdp-all-component-effects(?:[\s=>])/);assert.match(currentAccountGdpBalanceEffectsCsv(inputs,retained.range),/unavailable|missing/i);}finally{globalThis.fetch=originalFetch;}
});

test('full retained comparison persists under the unchanged 3 MiB research-library cap without new attachments',async()=>{
 const captured=buildPinContext(parseRoute('#/economy?family=external&window=all'));assert.ok(captured.context.currentAccountGdpAllComponentEffects);
 const pkg=await createResearchPackage({name:'Durable all-component comparison',...captured}),text=exportResearchPackage(pkg);assert.ok(Buffer.byteLength(text)<3*1024*1024);assert.equal(pkg.context.attachments.length,5);
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},locks=researchLocks(),library=await createResearchLibrary(storage,{locks});assert.equal((await library.pinPackage(pkg)).persisted,true);assert.equal(library.getState().sessionOnly,false);
 const reopened=await createResearchLibrary(storage,{locks}),restored=reopened.getPackage(pkg.id);assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpAllComponentEffects,pkg.context.currentAccountGdpAllComponentEffects);assert.deepEqual(restored.context.currentAccountGdpBreakdown,pkg.context.currentAccountGdpBreakdown);
});
