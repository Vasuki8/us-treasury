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

test('new external pins retain a contributions method and window without duplicating sources or growing the five CSV attachments',async()=>{
 const state=parseRoute('#/economy?family=external&measure=itaServicesBalance&window=custom&start=2024-04-01&end=2025-01-01'),before=canonicalJson(snapshot.sources),args=buildPinContext(state),retained=args.context.currentAccountGdpContributions;
 assert.ok(retained,'Contribution reconstruction requires its own optional versioned frozen supplement.');
 assert.deepEqual(retained,{version:1,range:{preset:'custom',startDate:'2024-04-01',endDate:'2025-01-01'},inputContext:'currentAccountGdpBreakdown'});
 assert.equal(Object.hasOwn(retained,'sources'),false);
 const sources=args.context[retained.inputContext].sources;
 for(const [agency,source]of Object.entries(sources))for(const [id,item]of Object.entries(source.series))assert.deepEqual(item,snapshot.sources[agency].series[id]);
 assert.equal(canonicalJson(snapshot.sources),before);assert.equal(args.context.attachments.length,5);
 assert.deepEqual(args.context.attachments.map(file=>file.name),['current-account-current-prior.csv','current-account-gdp.csv','current-account-gdp-history.csv','current-account-gdp-breakdown.csv','current-account-gdp-trailing.csv']);
 assert.ok(args.context.attachments.every(file=>!file.name.includes('contributions')),'Contributions are reconstructed from frozen inputs, not a sixth retained CSV.');
 assert.match(args.context.scope,/reconstruct/i);
 const pkg=await createResearchPackage({name:'Frozen quarterly and trailing ratio change contributions',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpContributions,retained);
 const html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-contributions"/);assert.match(html,new RegExp(`data-export-frozen-current-account-gdp-contributions="${pkg.id}"`));assert.doesNotMatch(html,/data-export-current-account-gdp-contributions(?:[\s=>])/);
});

test('contributions frozen CSV reconstruction uses retained sources and endpoint range independently of later live data',async()=>{
 const sources=structuredClone(snapshot.sources),args=buildPinContext(parseRoute('#/economy?family=external&window=custom&start=2026-04-01&end=2026-04-01'),{sources}),retained=args.context.currentAccountGdpContributions;assert.ok(retained);
 const pkg=await createResearchPackage({name:'Independent frozen contributions CSV',...args}),restored=await importResearchPackage(exportResearchPackage(pkg));
 const {currentAccountGdpContributionsCsv}=await import('../src/current-account-gdp-contributions-view.js');
 const inputs=restored.context[retained.inputContext].sources,expected=currentAccountGdpContributionsCsv(inputs,retained.range);
 for(const item of Object.values(sources.beaIta.series))for(const row of item.observations)if(row.value!==null)row.value*=3;
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen CSV reconstruction must not fetch.');};
 try{assert.equal(currentAccountGdpContributionsCsv(inputs,retained.range),expected);assert.notEqual(currentAccountGdpContributionsCsv(sources,retained.range),expected);assert.equal(Object.isFrozen(restored.context.currentAccountGdpBreakdown.sources.beaIta.series.itaGoodsBalance.observations),true);}finally{globalThis.fetch=originalFetch;}
});

test('partial frozen contributions preserve missing denominator and components with no current-source fallback',async()=>{
 const sources={beaIta:{status:'error',error:'Cached partial capture',fetchedAt:'2026-10-23T20:00:00.000Z',series:{itaGoodsBalance:snapshot.sources.beaIta.series.itaGoodsBalance}},bea:{status:'unavailable',error:'No GDP capture',series:{}}};
 const args=buildPinContext(parseRoute('#/economy?family=external&measure=itaGoodsBalance&window=all'),{sources}),retained=args.context.currentAccountGdpContributions;assert.ok(retained);
 const inputs=args.context[retained.inputContext].sources;assert.deepEqual(Object.keys(inputs.beaIta.series),['itaGoodsBalance']);assert.deepEqual(inputs.bea.series,{});
 const pkg=await createResearchPackage({name:'Unavailable frozen contributions',...args}),restored=await importResearchPackage(exportResearchPackage(pkg));assert.deepEqual(restored.context.currentAccountGdpBreakdown.sources,inputs);
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen viewers must not fetch missing inputs.');};
 try{const html=renderFrozen(restored);assert.match(html,/FROZEN[^<]*CONTRIBUTIONS|data-chart-catalog="current-account-gdp-contributions"/i);
  assert.doesNotMatch(html,/data-export-current-account-gdp-contributions(?:[\s=>])/);const {currentAccountGdpContributionsCsv}=await import
  ('../src/current-account-gdp-contributions-view.js');const csv=currentAccountGdpContributionsCsv(inputs,retained.range);assert.match(csv,
  /unavailable|missing/i);}finally{globalThis.fetch=originalFetch;}
});

test('legacy frozen packages never acquire contribution panels, reconstruction buttons or inputs',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=1y'));delete args.context.currentAccountGdpContributions;
 const pkg=await createResearchPackage({name:'Legacy quarterly and trailing component ratios',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 const html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-comparison"/);assert.doesNotMatch(html,/data-chart-catalog="current-account-gdp-contributions"|data-export-frozen-current-account-gdp-contributions/);assert.equal(exportResearchPackage(restored),text);
});

test('all-history contribution reconstruction remains durable within the unchanged 3 MiB storage cap',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=all'));assert.ok(args.context.currentAccountGdpContributions);
 const pkg=await createResearchPackage({name:'Durable all-history ratio change contributions',...args}),text=exportResearchPackage(pkg);assert.ok(Buffer.byteLength(text)<3*1024*1024);assert.equal(pkg.context.attachments.length,5);
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},locks=researchLocks(),library=await createResearchLibrary(storage,{locks});
 assert.equal((await library.pinPackage(pkg)).persisted,true);assert.equal(library.getState().sessionOnly,false);
 const reopened=await createResearchLibrary(storage,{locks}),restored=reopened.getPackage(pkg.id);assert.ok(restored);assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpContributions,pkg.context.currentAccountGdpContributions);assert.deepEqual(restored.context.currentAccountGdpBreakdown,pkg.context.currentAccountGdpBreakdown);
});
