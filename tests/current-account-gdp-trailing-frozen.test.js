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

test('external pins retain one trailing window reference and reuse full breakdown evidence including pre-window lookback',async()=>{
 const state=parseRoute('#/economy?family=external&window=custom&start=2024-04-01&end=2025-01-01'),before=canonicalJson(snapshot.sources),args=buildPinContext(state),retained=args.context.currentAccountGdpTrailing;
 assert.ok(retained,'Trailing evidence requires an explicit optional frozen supplement.');
 assert.deepEqual(retained,{version:1,range:{preset:'custom',startDate:'2024-04-01',endDate:'2025-01-01'},inputContext:'currentAccountGdpBreakdown'});
 assert.equal(Object.hasOwn(retained,'sources'),false,'Shared input histories must not be duplicated for another calculated window.');
 const sources=args.context[retained.inputContext].sources;
 for(const [agency,source]of Object.entries(sources))for(const [id,item]of Object.entries(source.series))assert.deepEqual(item,snapshot.sources[agency].series[id]);
 assert.ok(sources.beaIta.series.currentAccountBalance.observations.some(row=>row.date<'2023-07-01'),'Full retained input evidence must preserve all three lookback quarters independently of displayed endpoints.');
 assert.equal(canonicalJson(snapshot.sources),before);
 const {currentAccountGdpTrailingCsv}=await import('../src/current-account-gdp-trailing-view.js');
 const csv=args.context.attachments.find(file=>file.name==='current-account-gdp-trailing.csv');assert.ok(csv);assert.equal(csv.content,currentAccountGdpTrailingCsv(sources,retained.range));
 const pkg=await createResearchPackage({name:'Trailing-four-quarter frozen ratios',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpTrailing,retained);assert.equal(restored.context.attachments.find(file=>file.name===csv.name).content,csv.content);
 const html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-trailing"/);assert.match(html,/FROZEN[^<]*(?:TRAILING|T4Q)/);assert.doesNotMatch(html,/data-export-current-account-gdp-trailing/);
});

test('partial trailing inputs remain frozen without current GDP or missing component substitution',async()=>{
 const sources={beaIta:{status:'error',error:'Cached partial capture',fetchedAt:'2026-10-23T20:00:00.000Z',series:{itaGoodsBalance:snapshot.sources.beaIta.series.itaGoodsBalance}},bea:{status:'unavailable',error:'No GDP capture',series:{}}};
 const args=buildPinContext(parseRoute('#/economy?family=external&window=all'),{sources});assert.ok(args.context.currentAccountGdpTrailing);
 const retained=args.context.currentAccountGdpBreakdown.sources;assert.deepEqual(Object.keys(retained.beaIta.series),['itaGoodsBalance']);assert.deepEqual(retained.bea.series,{});
 const pkg=await createResearchPackage({name:'Unavailable trailing component ratios',...args}),restored=await importResearchPackage(exportResearchPackage(pkg));
 assert.deepEqual(restored.context.currentAccountGdpBreakdown.sources,retained);
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen viewers must not fetch missing inputs.');};
 try{const html=renderFrozen(restored);assert.match(html,/FROZEN[^<]*(?:TRAILING|T4Q)/);assert.doesNotMatch(html,/data-export-current-account-gdp-trailing/);}finally{globalThis.fetch=originalFetch;}
});

test('older breakdown packages never acquire a trailing chart or attachment when reopened',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=1y'));
 delete args.context.currentAccountGdpTrailing;args.context.attachments=args.context.attachments.filter(file=>file.name!=='current-account-gdp-trailing.csv');
 const pkg=await createResearchPackage({name:'Legacy historical breakdown',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 const html=renderFrozen(restored);assert.match(html,/data-chart-catalog="current-account-gdp-breakdown"/);assert.doesNotMatch(html,/data-chart-catalog="current-account-gdp-trailing"|current-account-gdp-trailing\.csv/);assert.equal(exportResearchPackage(restored),text);
});

test('one all-history external pin with trailing ratios persists within the existing 3 MiB research-library cap',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=all'));assert.ok(args.context.currentAccountGdpTrailing);
 const pkg=await createResearchPackage({name:'Durable all-history trailing ratios',...args}),text=exportResearchPackage(pkg);assert.ok(Buffer.byteLength(text)<3*1024*1024,'All-history evidence and compact CSV must fit the existing durable storage cap.');
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},locks=researchLocks(),library=await createResearchLibrary(storage,{locks});
 assert.equal((await library.pinPackage(pkg)).persisted,true);assert.equal(library.getState().sessionOnly,false);
 const reopened=await createResearchLibrary(storage,{locks}),restored=reopened.getPackage(pkg.id);assert.ok(restored);assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpTrailing,pkg.context.currentAccountGdpTrailing);assert.deepEqual(restored.context.currentAccountGdpBreakdown,pkg.context.currentAccountGdpBreakdown);
});
