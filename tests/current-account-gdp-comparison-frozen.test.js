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

const renderFrozen=pkg=>renderPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[pkg],workspaces:[]}});

test('new external pins retain selected quarterly/trailing comparison and reuse full breakdown inputs and one self-contained CSV',async()=>{
 const state=parseRoute('#/economy?family=external&measure=itaServicesBalance&window=custom&start=2024-04-01&end=2025-01-01'),before=canonicalJson(snapshot.sources),args=buildPinContext(state),retained=args.context.currentAccountGdpComparison;
 assert.ok(retained,'Comparison evidence requires its own optional frozen supplement.');
 assert.deepEqual(retained,{version:1,range:{preset:'custom',startDate:'2024-04-01',endDate:'2025-01-01'},measure:'itaServicesBalance',inputContext:'currentAccountGdpBreakdown'});
 assert.equal(Object.hasOwn(retained,'sources'),false);
 const sources=args.context[retained.inputContext].sources;
 for(const [agency,source]of Object.entries(sources))for(const [id,item]of Object.entries(source.series))assert.deepEqual(item,snapshot.sources[agency].series[id]);
 assert.equal(canonicalJson(snapshot.sources),before);assert.equal(args.context.attachments.length,5,'The comparison must share the trailing export, not duplicate the six source histories.');
 const {currentAccountGdpTrailingCsv}=await import('../src/current-account-gdp-trailing-view.js'),{currentAccountGdpComparisonCsv}=await import('../src/current-account-gdp-comparison-view.js');
 const csv=args.context.attachments.find(file=>file.name==='current-account-gdp-trailing.csv');assert.ok(csv);assert.equal(csv.content,currentAccountGdpTrailingCsv(sources,retained.range,{comparisonMeasure:retained.measure}));assert.equal(csv.content,currentAccountGdpComparisonCsv(sources,retained.range,retained.measure));
 const pkg=await createResearchPackage({name:'Frozen quarterly and trailing comparison',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpComparison,retained);assert.equal(restored.context.attachments.find(file=>file.name===csv.name).content,csv.content);
 const html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-comparison"/);assert.match(html,
  /FROZEN[^<]*(?:QUARTERLY|COMPARISON)/i);assert.doesNotMatch(html,/data-export-current-account-gdp-comparison|data-current-account-comparison-measure/);
});

test('comparison selection resolves combined trade to the admitted current-account total',()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&measure=itaGoodsServicesBalance&window=1y'));
 assert.equal(args.context.currentAccountGdpComparison?.measure,'currentAccountBalance');
});

test('partial frozen comparison inputs keep missing denominator and components unavailable',async()=>{
 const sources={beaIta:{status:'error',error:'Cached partial capture',fetchedAt:'2026-10-23T20:00:00.000Z',series:{itaGoodsBalance:snapshot.sources.beaIta.series.itaGoodsBalance}},bea:{status:'unavailable',error:'No GDP capture',series:{}}};
 const args=buildPinContext(parseRoute('#/economy?family=external&measure=itaGoodsBalance&window=all'),{sources}),retained=args.context.currentAccountGdpComparison;assert.ok(retained);
 const inputs=args.context[retained.inputContext].sources;assert.deepEqual(Object.keys(inputs.beaIta.series),['itaGoodsBalance']);assert.deepEqual(inputs.bea.series,{});
 const pkg=await createResearchPackage({name:'Unavailable frozen comparison',...args}),restored=await importResearchPackage(exportResearchPackage(pkg));assert.deepEqual(restored.context.currentAccountGdpBreakdown.sources,inputs);
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen viewers must not fetch missing inputs.');};
 try{const html=renderFrozen(restored);assert.match(html,
  /data-chart-catalog="current-account-gdp-comparison"|FROZEN[^<]*(?:QUARTERLY|COMPARISON)/i);assert.doesNotMatch(html,
  /data-export-current-account-gdp-comparison/);}finally{globalThis.fetch=originalFetch;}
});

test('older quarterly and trailing pins never acquire comparison panels or inputs',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=1y'));delete args.context.currentAccountGdpComparison;
 const pkg=await createResearchPackage({name:'Legacy trailing component ratios',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 const html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-trailing"/);assert.doesNotMatch(html,/data-chart-catalog="current-account-gdp-comparison"/);assert.equal(exportResearchPackage(restored),text);
});

test('all-history comparison evidence remains durable within the existing 3 MiB storage cap',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&measure=itaPrimaryIncomeBalance&window=all'));assert.ok(args.context.currentAccountGdpComparison);
 const pkg=await createResearchPackage({name:'Durable all-history quarterly comparison',...args}),text=exportResearchPackage(pkg);assert.ok(Buffer.byteLength(text)<3*1024*1024);
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},locks=researchLocks(),library=await createResearchLibrary(storage,{locks});
 assert.equal((await library.pinPackage(pkg)).persisted,true);assert.equal(library.getState().sessionOnly,false);
 const reopened=await createResearchLibrary(storage,{locks}),restored=reopened.getPackage(pkg.id);assert.ok(restored);assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpComparison,pkg.context.currentAccountGdpComparison);assert.deepEqual(restored.context.currentAccountGdpBreakdown,pkg.context.currentAccountGdpBreakdown);
});
