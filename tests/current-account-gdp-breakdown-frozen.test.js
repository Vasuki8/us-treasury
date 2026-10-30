import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../src/official-snapshot.js';
import {series} from '../src/data.js';
import {parseRoute} from '../src/router.js';
import {renderPage} from '../src/pages.js';
import {buildPinContext} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {MAX_RESEARCH_JSON_BYTES,canonicalJson} from '../src/research-workspaces.js';
import {createResearchLibrary} from '../src/research-library.js';
import {researchLocks} from './helpers/research-locks.js';

const itaIds=['currentAccountBalance','itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance'];

test('external pins retain exactly five complete ITA input histories and one GDP history for the selected breakdown window',async()=>{
 const state=parseRoute('#/economy?family=external&window=custom&start=2020-01-01&end=2026-06-30'),before=canonicalJson(snapshot.sources),args=buildPinContext(state),retained=args.context.currentAccountGdpBreakdown;
 assert.ok(retained,'Breakdown evidence must be retained separately from the legacy total-ratio supplement.');
 assert.equal(retained.version,1);assert.deepEqual(retained.range,{preset:'custom',startDate:'2020-01-01',endDate:'2026-06-30'});
 assert.deepEqual(Object.keys(retained.sources).sort(),['bea','beaIta']);assert.deepEqual(Object.keys(retained.sources.beaIta.series).sort(),[...itaIds].sort());assert.deepEqual(Object.keys(retained.sources.bea.series),['nominalGdp']);
 for(const id of itaIds)assert.deepEqual(retained.sources.beaIta.series[id],snapshot.sources.beaIta.series[id]);
 assert.deepEqual(retained.sources.bea.series.nominalGdp,snapshot.sources.bea.series.nominalGdp);
 assert.equal(retained.sources.beaIta.fetchedAt,snapshot.sources.beaIta.fetchedAt);assert.equal(retained.sources.bea.fetchedAt,snapshot.sources.bea.fetchedAt);
 assert.deepEqual(Object.keys(args.context.currentAccountGdpHistory.sources.beaIta.series),['currentAccountBalance']);assert.equal(canonicalJson(snapshot.sources),before);
 const {currentAccountGdpBreakdownCsv}=await import('../src/current-account-gdp-breakdown-view.js');
 assert.equal(args.context.attachments.find(file=>file.name==='current-account-gdp-breakdown.csv')?.content,currentAccountGdpBreakdownCsv(snapshot.sources,retained.range));
 const pkg=await createResearchPackage({name:'Frozen historical component ratios',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 assert.equal(exportResearchPackage(restored),text);assert.ok(Buffer.byteLength(text)<MAX_RESEARCH_JSON_BYTES);assert.deepEqual(restored.context.currentAccountGdpBreakdown,retained);
 const html=renderPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[restored],workspaces:[]}});
 assert.match(html,/FROZEN HISTORICAL CURRENT ACCOUNT \/ GDP · BREAKDOWN/i);assert.match(html,
  /data-chart-catalog="current-account-gdp-breakdown"/);assert.doesNotMatch(html,/data-export-current-account-gdp-breakdown/);
});

test('pins retain missing component and denominator evidence without filling from current data',async()=>{
 const sources={beaIta:{status:'error',error:'Cached partial capture',fetchedAt:'2026-10-23T20:00:00.000Z',series:{itaGoodsBalance:snapshot.sources.beaIta.series.itaGoodsBalance}},bea:{status:'unavailable',error:'No GDP capture',series:{}}};
 const state=parseRoute('#/economy?family=external&window=all'),args=buildPinContext(state,{sources}),retained=args.context.currentAccountGdpBreakdown;
 assert.ok(retained,'Partial inputs still require their own frozen breakdown record.');assert.deepEqual(Object.keys(retained.sources.beaIta.series),['itaGoodsBalance']);assert.deepEqual(retained.sources.bea.series,{});assert.equal(retained.sources.beaIta.error,'Cached partial capture');
 const pkg=await createResearchPackage({name:'Unavailable component ratio evidence',...args}),restored=await importResearchPackage(exportResearchPackage(pkg));assert.deepEqual(restored.context.currentAccountGdpBreakdown,retained);
 const html=renderPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[restored],workspaces:[]}});
 assert.match(html,/FROZEN HISTORICAL CURRENT ACCOUNT \/ GDP · BREAKDOWN/i);assert.doesNotMatch(html,/data-export-current-account-gdp-breakdown/);
});

test('the frozen viewer never adds a breakdown to an older package',async()=>{
 const pkg=await createResearchPackage({name:'Legacy frozen GDP result',state:{selected:['gdp'],window:'all'},catalog:{gdp:{...series.gdp,observations:series.gdp.observations.slice(-2)}}}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen viewers must not fetch missing evidence.');};
 try{const html=renderPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[restored],workspaces:[]}});
  assert.doesNotMatch(html,/data-chart-catalog="current-account-gdp-breakdown"|HISTORICAL CURRENT ACCOUNT \/ GDP · BREAKDOWN/i);assert.equal
  (exportResearchPackage(restored),text);}finally{globalThis.fetch=originalFetch;}
});

test('one all-history external package fits durable browser storage and reopens with all breakdown evidence intact',async()=>{
 const args=buildPinContext(parseRoute('#/economy?family=external&window=all')),pkg=await createResearchPackage({name:'Durable all-history component ratios',...args}),text=exportResearchPackage(pkg);
 assert.ok(Buffer.byteLength(text)<3*1024*1024,'A single all-history package must fit the existing 3 MiB research-library cap.');
 const values=new Map(),storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)},locks=researchLocks(),library=await createResearchLibrary(storage,{locks});
 const result=await library.pinPackage(pkg);assert.equal(result.persisted,true);assert.equal(library.getState().sessionOnly,false);
 const reopened=await createResearchLibrary(storage,{locks}),restored=reopened.getPackage(pkg.id);assert.ok(restored);assert.equal(exportResearchPackage(restored),text);assert.deepEqual(restored.context.currentAccountGdpBreakdown,pkg.context.currentAccountGdpBreakdown);
});
