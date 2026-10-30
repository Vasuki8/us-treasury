import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import * as storage from '../scripts/snapshot-storage.mjs';
import {currentSnapshotAssets} from '../scripts/current-snapshot.mjs';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {series,dataStatus,hydrateSource} from '../src/data.js';
import {registry} from '../src/registry.js';
import {recordVintages,asKnownOn} from '../src/vintages.js';
import {currentAccountGdpHistory} from '../src/current-account-gdp.js';
import {buildCoverageInventory} from '../src/coverage-inventory.js';
import {transformSeries,toCsv} from '../src/model.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {buildPinContext} from '../src/research-context.js';
import {parseRoute} from '../src/router.js';
import {yieldCurvesCsv} from '../src/yields-page.js';
import {vintagesCsv} from '../src/vintages-page.js';
import * as packages from '../src/research-packages.js';
import * as workspaces from '../src/research-workspaces.js';
import * as api from '../src/research-library.js';
import {researchLocks} from './helpers/research-locks.js';
import {researchIndexedDB} from './helpers/research-indexeddb.js';

const {createResearchPackage,exportResearchPackage,importResearchPackage}=packages;
const {snapshotModule}=storage;
const moduleValue=async source=>(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).snapshot;
const codecUrl=new URL('../src/source-codec.js',import.meta.url).href;
const projectedValue=source=>moduleValue(source.replace("'./source-codec.js'",JSON.stringify(codecUrl)));
const starts={
 yield:'2003-01-02',realYield10:'2003-01-02',inflationComp10:'2003-01-02',industrialProduction:'1919-01-01',
 capacityUtilization:'1967-01-01',housingStarts:'1959-01-01',housingPermits:'1960-01-01',housingCompletions:'1968-01-01',
};
const now='2026-10-22T15:00:00.000Z';
function storeFixture(){
 const values=new Map([['meridian.preferences.v1','original preferences']]);
 return {values,locks:researchLocks(),getItem:key=>values.get(key)??null,setItem(key,value){values.set(key,value);}};
}
const openLibrary=store=>api.createResearchLibrary(store,{locks:store?.locks??researchLocks()});
const workspace=()=>workspaces.createWorkspace({
 id:'workspace-one',name:'Saved comparison',now,
 state:{page:'explore',selected:['sofr','effr'],window:'all',exploreMode:'compare'},
});
function historicalYieldInputs(){
 const ids=['yield','realYield10','spread2s10s','spread3m10y','inflationComp10','nominalYield2','nominalYield3m'];
 const catalog={...series,...Object.fromEntries(ids.map(id=>[id,{...series[id],inputProvenanceScope:'observation-source-urls'}]))};
 const sources={...dataStatus.sources,...Object.fromEntries(['treasury','yields'].map(id=>[id,{
  ...dataStatus.sources[id],series:Object.fromEntries(Object.entries(dataStatus.sources[id].series).map(([key,item])=>[
   key,{...item,...(ids.includes(key)?{inputProvenanceScope:'observation-source-urls'}:{})},
  ])),
 }]))};
 return {catalog,sources};
}
function auctionArgs(input,route){
 const item=input.series.auctionOfferingMonthly;
 const catalog={...series,auctionOfferingMonthly:{
  ...series.auctionOfferingMonthly,...item,provenance:input.provenance,fetchedAt:input.fetchedAt,
 }};
 return buildPinContext(parseRoute(route),{catalog,sources:{...dataStatus.sources,auctions:input}});
}

function assertRetainedContributions(source,history){
 const captures=history.captures.filter(row=>row.sourceId==='macroContributions');
 const retained={version:history.version,captures},replay=cutoff=>asKnownOn(retained,cutoff).sources.macroContributions;
 const backfill=captures.find(row=>row.capturedAt==='2026-10-24T03:06:14.124Z');
 assert.ok(backfill,'the original admitted backfill remains in immutable capture history');
 assert.equal(backfill.recordedAt,'2026-10-24T03:06:15.081Z');
 const original=replay(backfill.capturedAt);
 assert.equal(original.coverageStart,'1947-04-01');assert.equal(original.coverageEnd,'2026-04-01');
 const fields={
  total:['gdpTotalContribution',2.2],consumption:['gdpConsumptionContribution',2.51],investment:['gdpInvestmentContribution',.82],
  government:['gdpGovernmentContribution',-.01],exports:['gdpExportsContribution',.56],imports:['gdpImportsContribution',-1.66],
  fixedInvestment:['gdpFixedInvestmentContribution',1.35],inventories:['gdpInventoriesContribution',-.53],
  consumptionGoods:['gdpConsumptionGoodsContribution',.94],consumptionServices:['gdpConsumptionServicesContribution',1.57],
 };
 const historicalDates=Array.from({length:317},(_,i)=>new Date(Date.UTC(1947,3+i*3,1)).toISOString().slice(0,10));
 const ids=Object.values(fields).map(([id])=>id).sort();
 assert.deepEqual(Object.keys(original.series).sort(),ids);assert.deepEqual(Object.keys(source.series).sort(),ids);
 const q2=Object.fromEntries(Object.entries(fields).map(([field,[id]])=>[field,original.series[id].observations.at(-1).value]));
 assert.equal(Math.round(100*(q2.total-q2.consumption-q2.investment-q2.government-q2.exports-q2.imports))/100,-.02);
 const earlier=captures.filter(row=>row.capturedAt<backfill.capturedAt);
 assert.ok(earlier.length>=2);
 const beforeBackfill=replay(earlier.at(-1).capturedAt),latest=captures.at(-1),current=replay(source.fetchedAt);
 assert.equal(latest.capturedAt,source.fetchedAt);
 assert.ok(earlier.every(row=>row.capturedAt<latest.capturedAt));
 const previous=asKnownOn({version:history.version,captures:captures.slice(0,-1)},source.fetchedAt).sources.macroContributions;
 assert.equal(source.status,'ok');assert.match(source.coverageEnd,/^\d{4}-(01|04|07|10)-01$/);
 assert.ok(source.coverageEnd>='2026-04-01','current coverage cannot lose the admitted backfill endpoint');
 const quarters=(Number(source.coverageEnd.slice(0,4))-1947)*4+(Number(source.coverageEnd.slice(5,7))-4)/3+1;
 // Count from 1947 Q2, then apply the collector's existing 400-quarter retention bound.
 const dates=Array.from({length:Math.min(quarters,400)},(_,i)=>
  new Date(Date.UTC(1947,3+3*(Math.max(0,quarters-400)+i),1)).toISOString().slice(0,10));
 assert.equal(source.coverageStart,dates[0]);assert.deepEqual(source.quarterly.map(row=>row.date),dates);
 assert.equal(source.provenance[0].retrievedAt,source.fetchedAt);
 assert.match(source.coverageNote,/first captured on the actual retrieval date/i);
 for(const [field,[id,value]]of Object.entries(fields)){
  const originalRows=original.series[id].observations,rows=source.series[id].observations;
  assert.deepEqual(originalRows.map(row=>row.date),historicalDates,id);
  assert.equal(originalRows.at(-1).value,value,id);
  assert.equal(backfill.series[id].upserts.length,281,id);assert.deepEqual(backfill.series[id].deletedDates,[],id);
  assert.deepEqual(beforeBackfill.series[id].observations.map(row=>row.date),historicalDates.slice(-36),id);
  assert.deepEqual(rows.map(row=>row.date),dates,id);
  assert.ok(rows.every(row=>row.publishedAt===null&&Object.hasOwn(row,'sourceValue')),id);
  assert.deepEqual(source.quarterly.map(row=>row[field]),rows.map(row=>row.value),id);
  assert.deepEqual(current.series[id].observations,rows,id);
  const dropped=previous.series[id].observations.filter(row=>row.date<dates[0]).map(row=>row.date);
  assert.deepEqual(latest.series[id]?.deletedDates??[],dropped,id);
 }
 for(const row of source.quarterly){
  const headline=[row.consumption,row.investment,row.government,row.exports,row.imports];
  const complete=[row.total,...headline].every(Number.isFinite);
  const residual=complete?(Math.round(100*(row.total-headline.reduce((sum,value)=>sum+value,0)))/100||0):null;
  assert.equal(row.complete,complete,row.date);assert.equal(row.reconciliationResidual,residual,row.date);
 }
}

// Synthetic quarters exercise refresh growth without changing any retained snapshot or immutable capture.
function futureContributions(original,history,additionalQuarters){
 const source=structuredClone(original),last=new Date(original.coverageEnd+'T00:00:00Z');
 for(let i=1;i<=additionalQuarters;i++){
  const date=new Date(Date.UTC(last.getUTCFullYear(),last.getUTCMonth()+3*i,1)).toISOString().slice(0,10);
  source.quarterly.push({...original.quarterly.at(-1),date});
  for(const [id,item]of Object.entries(source.series))item.observations.push({...original.series[id].observations.at(-1),date});
 }
 source.quarterly=source.quarterly.slice(-400);
 for(const item of Object.values(source.series))item.observations=item.observations.slice(-400);
 source.coverageStart=source.quarterly[0].date;source.coverageEnd=source.quarterly.at(-1).date;
 source.fetchedAt=new Date(Math.max(Date.UTC(Number(source.coverageEnd.slice(0,4))+1,0,1),Date.parse(original.fetchedAt)+86400000))
  .toISOString();
 source.provenance=source.provenance.map(row=>({...row,retrievedAt:source.fetchedAt}));
 const revised=source.quarterly.find(row=>row.date==='2026-04-01')??source.quarterly.at(-1);
 revised.imports=Math.round((revised.imports-.09)*100)/100;revised.exports=Math.round((revised.exports+.09)*100)/100;
 for(const [id,value]of [['gdpImportsContribution',revised.imports],['gdpExportsContribution',revised.exports]]){
  Object.assign(source.series[id].observations.find(row=>row.date===revised.date),{value,sourceValue:String(value)});
 }
 const next=recordVintages(history,{}, {macroContributions:source},{checkedAt:source.fetchedAt,seriesMetadata:registry});
 return {source,history:next};
}

// Only this worker decodes the growing canonical root. Ordinary npm tests use the bounded fixture.
test('retained production snapshot preserves admission, history and portable evidence at full scale',async t=>{
 const bytes=await readFile(new URL('../src/official-snapshot.json.gz',import.meta.url)).catch(error=>{
  assert.fail('The canonical gzip snapshot must exist: '+error.code);
 });
 const snapshot=storage.decodeStoredSnapshot(bytes);
 const history=await storage.loadSnapshotHistory(snapshot,{directory:fileURLToPath(new URL('../src/',import.meta.url))});
 const stableSources=dataStatus.sources;
 for(const [id,source] of Object.entries(snapshot.sources))hydrateSource(id,source);
 for(const [key,value] of Object.entries(snapshot))if(key!=='sources')dataStatus[key]=value;
 assert.equal(dataStatus.sources,stableSources);
 await t.test('every complete current source and retained capture passes commercial admission',()=>{
  assert.doesNotThrow(()=>assertCommercialData({...snapshot,vintages:history}));
 });
 await t.test('the complete canonical snapshot is gzip JSON and the Node adapter contains no large data payload',async()=>{
   const decoded=JSON.parse(gunzipSync(bytes));
   const adapter=(await readFile(new URL('../src/official-snapshot.js',import.meta.url),'utf8'))
    .replace("'../scripts/snapshot-storage.mjs'",JSON.stringify(new URL('../scripts/snapshot-storage.mjs',import.meta.url).href))
    .replaceAll('import.meta.url',JSON.stringify(new URL('../src/official-snapshot.js',import.meta.url).href));
   assert.deepEqual(await moduleValue(adapter),snapshot);
   assert.deepEqual(decoded,snapshot);
   assert.equal(JSON.stringify(decoded),JSON.stringify(snapshot));
   assert.ok(bytes.length<=20*1024**2,'The tracked snapshot must fit the repository file budget');
   const reader=await readFile(new URL('../src/official-snapshot.js',import.meta.url));
   assert.ok(reader.length<2048,'The JS entry is a small Node reader, not a second copy of the data');
 });

 await t.test('gzip storage preserves the entire real snapshot and regenerates the same browser module', () => {
   const before = storage.snapshotModule(snapshot);
   const decoded = storage.decodeStoredSnapshot(storage.encodeStoredSnapshot(snapshot));
   assert.deepEqual(decoded, snapshot);
   assert.equal(storage.snapshotModule(decoded), before);
 });

 await t.test('every complete current source has exact bytes, original JSON property order and all observations', async () => {
   const result = currentSnapshotAssets(snapshot, snapshotModule);
   assert.ok(gzipSync(result.module).length < 300000, 'The eager current data module must leave room for supplementary data');
   assert.deepEqual(await projectedValue(result.module), result.snapshot);
   assert.equal(result.files.size, Object.keys(snapshot.sources).length);
   for (const [sourceId, descriptor] of Object.entries(result.snapshot.sourceArchive.sources)) {
     const bytes = result.files.get(descriptor.url.slice(2)), original = snapshot.sources[sourceId];
     assert.equal(bytes.length, descriptor.bytes);
     assert.equal(createHash('sha256').update(bytes).digest('hex'), descriptor.sha256);
     assert.ok(bytes.length < 20 * 1024 ** 2, `${sourceId} must fit the deployment file limit`);
     assert.deepEqual(bytes, Buffer.from(snapshotModule({ source:original })));
     const module = await moduleValue(bytes);
     assert.deepEqual(module.source, original);
     assert.equal(JSON.stringify(module.source), JSON.stringify(original));
     for (const [id, item] of Object.entries(result.snapshot.sources[sourceId].series ?? {})) {
       const full = original.series[id].observations;
       assert.deepEqual(item.retainedCoverage, { startDate:full[0]?.date ?? null, endDate:full.at(-1)?.date ?? null, count:full.length });
       assert.deepEqual(item.observations.at(-1), full.at(-1));
       if (full.length > 1) assert.deepEqual(item.observations.at(-2), full.at(-2));
     }
   }
 });

 await t.test('full browser partitions retain exact bytes and reconstruct every capture',async()=>{
  const result=storage.browserSnapshotAssets({...snapshot,vintages:history}),projected=await projectedValue(result.module);
  assert.equal(projected.vintages,undefined);
  assert.equal(projected.vintageArchive,undefined);
  assert.equal(projected.historyArchive.version,2);
  assert.equal(projected.historyArchive.captureCount,history.captures.length);
  assert.ok(projected.historyArchive.captureCount>=25);
  const reconstructed=[];
  for(const [sourceId,descriptor] of Object.entries(projected.historyArchive.sources)){
   for(const kind of ['fallback','compressed']){
    const file=descriptor[kind],content=result.files.get(file.url.slice(2));
    assert.equal(content.length,file.bytes);
    assert.equal(createHash('sha256').update(content).digest('hex'),file.sha256);
    const partition=JSON.parse(kind==='compressed'?gunzipSync(content):content);
    assert.equal(partition.sourceId,sourceId);
    assert.equal(partition.captures.length,descriptor.captureCount);
    partition.captures.forEach((capture,index)=>{
     assert.equal(capture.sourceId,sourceId);
     assert.deepEqual(capture,history.captures[partition.captureIndexes[index]]);
     if(kind==='fallback')reconstructed.push([partition.captureIndexes[index],capture]);
    });
   }
  }
  assert.deepEqual(reconstructed.sort((a,b)=>a[0]-b[0]).map(([,capture])=>capture),history.captures);
  for(const [sourceId,descriptor] of Object.entries(projected.sourceArchive.sources)){
   const content=result.files.get(descriptor.url.slice(2));
   assert.equal(content.length,descriptor.bytes);
   assert.equal(createHash('sha256').update(content).digest('hex'),descriptor.sha256);
   assert.deepEqual((await moduleValue(content)).source,snapshot.sources[sourceId]);
  }
 });

 await t.test('recording the real stored sources again preserves every existing immutable capture under the expanded registry',async()=>{
    const original=JSON.stringify(history);
   const checkedAt=[...history.captures.map(c=>c.recordedAt),...Object.values(snapshot.sources).map(s=>s.fetchedAt)].filter(Boolean).sort().at(-1);
   const replay=recordVintages(history,snapshot.sources,snapshot.sources,{checkedAt,seriesMetadata:registry});
   assert.equal(JSON.stringify(replay),original,'reusing real retrieval keys must neither collide nor reinterpret old source metadata');
   assert.equal(JSON.stringify(history),original,'the supplied archive remains untouched');
 });

 await t.test('retained contribution backfill has all approved history with original capture clocks and earlier captures intact',async()=>{
  assertRetainedContributions(snapshot.sources.macroContributions,history);
 });

 await t.test('retained contribution checks accept new quarters and legitimate current revisions',async t=>{
  const retained={version:history.version,captures:history.captures.filter(row=>row.sourceId==='macroContributions')};
  for(const additional of [1,3,84])await t.test(`${additional} later quarters`,()=>{
   const candidate=futureContributions(snapshot.sources.macroContributions,retained,additional);
   assertRetainedContributions(candidate.source,candidate.history);
  });
 });

 await t.test('retained contribution checks reject damaged historical or current evidence',async t=>{
  const retained={version:history.version,captures:history.captures.filter(row=>row.sourceId==='macroContributions')};
  const candidate=futureContributions(snapshot.sources.macroContributions,retained,1);
  const backfill=input=>input.history.captures.find(row=>row.capturedAt==='2026-10-24T03:06:14.124Z');
  const cases=[
   ['missing original backfill',input=>{input.history.captures=input.history.captures.filter(row=>row!==backfill(input));}],
   ['lost original backfilled row',input=>backfill(input).series.gdpTotalContribution.upserts.shift()],
   ['altered immutable Q2 value',input=>{
    for(const capture of input.history.captures.filter(row=>row.capturedAt<=backfill(input).capturedAt)){
     for(const row of capture.series.gdpImportsContribution?.upserts??[])if(row.date==='2026-04-01')row.value=99;
    }
   }],
   ['lost earlier capture coverage',input=>input.history.captures[0].series.gdpTotalContribution.upserts.shift()],
   ['missing current interior quarter',input=>{
    input.source.quarterly.splice(10,1);
    for(const item of Object.values(input.source.series))item.observations.splice(10,1);
   }],
   ['current replay mismatch',input=>{
    input.source.series.gdpTotalContribution.observations[0].value+=1;input.source.quarterly[0].total+=1;
    input.source.series.gdpConsumptionContribution.observations[0].value+=1;input.source.quarterly[0].consumption+=1;
   }],
   ['lost raw source value',input=>{delete input.source.series.gdpTotalContribution.observations[0].sourceValue;}],
   ['changed original recording clock',input=>{backfill(input).recordedAt='2026-10-24T03:06:14.124Z';}],
  ];
  for(const [name,corrupt]of cases)await t.test(name,()=>{
   const changed=structuredClone(candidate);corrupt(changed);
   assert.throws(()=>assertRetainedContributions(changed.source,changed.history),{code:'ERR_ASSERTION'});
  });
 });

 await t.test('all retained official current-account quarters match exact nominal GDP quarters, covering at least 266 quarters', () => {
   const result = currentAccountGdpHistory(snapshot.sources), balances = snapshot.sources.beaIta.series.currentAccountBalance.observations;
   const nominalGdp = new Map(snapshot.sources.bea.series.nominalGdp.observations.map(point => [point.date, point]));
   assert.equal(result.error, null);
   assert.equal(result.observations.length, balances.length);
   assert.ok(result.observations.length >= 266);
   assert.equal(result.observations[0].date, '1960-01-01');
   assert.equal(result.observations.at(-1).date, balances.at(-1).date);
   for (const [index, balance] of balances.entries()) {
     const point = result.observations[index], gdp = nominalGdp.get(balance.date);
     assert.equal(point.date, balance.date);
     const available = Number.isFinite(balance.value) && Number.isFinite(gdp?.value) && gdp.value > 0;
     assert.equal(point.value, available ? 100 * balance.value / (gdp.value / 4) : null);
     assert.equal(point.numeratorObservation, balance);
     assert.equal(point.denominatorObservation, gdp ?? null);
   }
 });

 await t.test('published historical coverage reaches the same earliest rows through inventory, All and custom windows',()=>{
  const inventory=buildCoverageInventory(series);
  for(const [id,start] of Object.entries(starts)){
   const item=series[id],coverage=inventory.rows.find(row=>row.id===id);
   assert.equal(coverage.firstReference,start,id);
   assert.equal(coverage.totalCount,item.observations.length,id);
   assert.equal(transformSeries(item,'level',{preset:'all'}).observations[0].date,start,id);
   const exact=transformSeries(item,'level',{preset:'custom',startDate:start,endDate:start});
   assert.deepEqual(exact.observations.map(row=>row.date),[start],id);
   assert.equal(exact.observations[0].value,item.observations[0].value,id);
  }
 });

 await t.test('historical Treasury indicator CSV uses only its actual annual inputs and keeps publication dates unknown',()=>{
  for(const [id,count] of [['yield',1],['realYield10',1],['inflationComp10',2]]){
   const csv=toCsv([id],{range:{preset:'custom',startDate:'2003-01-02',endDate:'2003-01-06'}});
   const [headers,...rows]=parseCsv(csv);
   assert.equal(rows.length,3,id);
   for(const row of rows){
    const data=Object.fromEntries(headers.map((key,index)=>[key,row[index]]));
    const receipts=JSON.parse(data.capture_provenance_json);
    assert.equal(receipts.length,count,id);
    assert.ok(receipts.every(receipt=>receipt.url.includes('.csv/2003/all')),id);
    assert.ok(receipts.every(receipt=>/^[a-f0-9]{64}$/.test(receipt.sha256)),id);
    assert.equal(data.publication_date,'',id);
    assert.equal(data.retrieved_at,receipts.map(receipt=>receipt.retrievedAt).sort().at(-1),id);
   }
  }
 });

 await t.test('yield pins freeze the analysis window and selected overlays within portable limits at retained-history scale',async()=>{
  const inputs=historicalYieldInputs();
  assert.ok(inputs.catalog.realYield10.observations.length>5000,'exercise the full 2003 onward retained history');
  for(const state of [parseRoute('#/yields'),parseRoute('#/yields?window=custom&start=2008-11-01&end=2008-12-31&curveA=2008-11-28&curveB=2008-12-01')]){
   const args=buildPinContext(state,inputs),pkg=await createResearchPackage({name:'Windowed yield evidence',...args}),text=exportResearchPackage(pkg);
   assert.equal(exportResearchPackage(await importResearchPackage(text)),text);
   assert.match(pkg.context.scope,/analysis window.*lookback/i);
   assert.ok(pkg.catalog.realYield10.observations.length<400);
   assert.ok(pkg.catalog.realYield10.observations.filter(row=>row.date<pkg.resolvedWindow.startDate).length<=1);
   assert.ok(pkg.csv===toCsv(args.state.selected,{catalog:inputs.catalog,range:pkg.request.range}),
    'scoping must preserve every displayed CSV value and receipt');
   assert.equal(pkg.context.attachments[0].content,yieldCurvesCsv(inputs.sources.yields,state));
   const selected=pkg.context.yieldOverlayDates;
   assert.equal(selected.length,2);
   assert.deepEqual(pkg.context.moduleSources.yields.curveHistory,inputs.sources.yields.curveHistory.filter(row=>selected.includes(row.date)));
   assert.ok(pkg.context.moduleSources.yields.provenance.length<=6);
   assert.deepEqual(pkg.context.yieldCurrentReadings.map(item=>item.id),[
    'spread2s10s','spread3m10y','realYield10','inflationComp10','policyTargetLower','policyTargetUpper','effr','sofr',
   ]);
   for(const item of pkg.context.yieldCurrentReadings)assert.deepEqual(item.observations,inputs.catalog[item.id].observations.slice(-2));
   if(state.window==='custom'){
    assert.equal(pkg.catalog.realYield10.observations[0].date,'2008-10-31','retain the actual predecessor for the first displayed change');
    const firstChange=transformSeries(pkg.catalog.yield,'change',pkg.request.range).observations[0];
    assert.deepEqual({date:firstChange.date,value:firstChange.value},{date:'2008-11-03',value:-5});
    assert.deepEqual(pkg.context.yieldOverlayDates,['2008-11-28','2008-12-01']);
    assert.deepEqual(pkg.context.moduleSources.yields.methodologyBreaks.map(row=>row.date),['2008-12-01','2021-12-06']);
    assert.ok(pkg.context.yieldCurrentReadings.every(item=>item.observations.at(-1).date>'2008-12-31'));
    assert.ok(pkg.context.moduleSources.yields.series.spread3m10y.observations.every(row=>row.date<='2008-12-31'));
   }
  }
 });

 await t.test('All yield pins retain every requested history row and report the existing size limit without truncation',async()=>{
  const inputs=historicalYieldInputs(),args=buildPinContext(parseRoute('#/yields?window=all'),inputs);
  for(const id of args.state.selected)assert.deepEqual(args.catalog[id].observations,inputs.catalog[id].observations);
  await assert.rejects(createResearchPackage({name:'All yield history',...args}),/byte limit/i);
 });

 await t.test('earliest actual Treasury capture pins exclude future backfills without discarding rows at the size limit',async()=>{
  for(const [agency,id] of [['treasury','yield'],['yields','realYield10']]){
   const captures=history.captures.filter(row=>row.sourceId===agency);
   const capturedHistory={version:1,captures},original=JSON.stringify(capturedHistory),cutoff=captures.map(row=>row.capturedAt).sort()[0];
   assert.ok(captures.some(row=>row.capturedAt>cutoff),'exercise old captures alongside later historical backfills');
   const args=buildPinContext({...parseRoute(`#/vintages?series=${id}`),vintageCutoff:cutoff},{
    historyState:{status:'ready',history:capturedHistory,latestCaptureAt:captures.at(-1).capturedAt},
   });
   const retained=args.context.selectedCaptureHistory;
   assert.ok(retained.captures.every(row=>row.sourceId===agency&&row.capturedAt<=cutoff));
   assert.ok(retained.captures.every(row=>Object.keys(row.series).every(key=>key===id)&&row.removedSeries.every(key=>key===id)));
   const expected=asKnownOn(capturedHistory,cutoff).sources[agency];
   assert.deepEqual(asKnownOn(retained,cutoff).sources,{[agency]:{...expected,series:{[id]:expected.series[id]}}});
   assert.deepEqual(args.catalog[id].observations,expected.series[id].observations);
   assert.equal(args.catalog[id].inputProvenanceScope,undefined);
   assert.equal(args.context.attachments[0].content,vintagesCsv(capturedHistory,{seriesId:id,cutoff}),'the original legacy CSV is unchanged');
   if(id==='yield'){
    const pkg=await createResearchPackage({name:'Earliest retained Treasury capture',...args}),text=exportResearchPackage(pkg);
    assert.equal(exportResearchPackage(await importResearchPackage(text)),text);
   }else await assert.rejects(createResearchPackage({name:'Complete legacy real-yield capture',...args}),/byte limit/i,
    'the two original full-history CSVs still exceed the existing portable limit');
   assert.equal(JSON.stringify(capturedHistory),original,'scoping must not mutate immutable source captures');
  }
 });

 await t.test('complete SOFR All history above the library cap stays downloadable in session without changing durable bytes',async()=>{
  const store=storeFixture(),library=await openLibrary(store);assert.equal((await library.saveWorkspace(workspace())).persisted,true);
  const durable=store.values.get(api.RESEARCH_LIBRARY_KEY),pkg=await packages.createResearchPackage({
   id:'full-sofr-session',name:'Complete SOFR history',now,state:{selected:['sofr'],window:'all'},
  }),json=packages.exportResearchPackage(pkg);
  assert.ok(workspaces.researchByteLength(json)>3*1024*1024);assert.ok(workspaces.researchByteLength(json)<workspaces.MAX_RESEARCH_JSON_BYTES);
  const result=await library.pinPackage(pkg);assert.equal(result.ok,true);assert.equal(result.persisted,false);assert.equal(result.reason,'quota');
  assert.equal(library.getState().sessionOnly,true);assert.match(library.getState().warning,/storage limit.*session-only/i);
  const session=library.getPackage(pkg.id);
  assert.deepEqual(session.catalog.sofr.observations,series.sofr.observations);
  assert.equal(session.catalog.sofr.observations[0].date,'2018-04-02');
  assert.equal(session.panels[0].observations.length,series.sofr.observations.length);assert.equal(packages.researchPackageCsv(session),pkg.csv);
  assert.equal(packages.exportResearchPackage(session),json);assert.equal(packages.exportResearchPackage(await packages.importResearchPackage(json)),json);
  assert.equal(store.values.get(api.RESEARCH_LIBRARY_KEY),durable);assert.equal(store.values.get('meridian.preferences.v1'),'original preferences');
  const reopened=await openLibrary(store);
  assert.equal(reopened.getWorkspace('workspace-one').name,workspace().name);
  assert.equal(reopened.getPackage(pkg.id),undefined);
 });

 await t.test('a session-only full-history package does not prevent a later small workspace from surviving reload',async()=>{
  const store=storeFixture(),library=await openLibrary(store);
  const pkg=await packages.createResearchPackage({id:'full-history-isolated',name:'Complete SOFR history',now,state:{selected:['sofr'],window:'all'}});
  assert.equal((await library.pinPackage(pkg)).persisted,false);
  const result=await library.saveWorkspace(workspace());
  assert.equal(result.persisted,true,'unrelated small saves must not reserialize the failed package');
  const reopened=await openLibrary(store);assert.equal(reopened.getWorkspace('workspace-one').name,'Saved comparison');
  assert.equal(reopened.getPackage(pkg.id),undefined);
  assert.equal(library.getState().durability.packages[pkg.id].status,'session');
  assert.equal(library.getState().durability.workspaces['workspace-one'].status,'durable');
 });

 await t.test('full SOFR package above the former shared cap is durable, validated and downloadable after reopening',async()=>{
  const indexedDB=researchIndexedDB(),values=new Map();
  const store={values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  const openDatabase=()=>api.createResearchLibrary(store,{indexedDB,locks:researchLocks()});
  const library=await openDatabase(),pkg=await createResearchPackage({
   id:'full-sofr-durable',name:'Frozen study',now,state:{selected:['sofr'],range:0,window:'all'},
  }),json=exportResearchPackage(pkg);
  assert.ok(workspaces.researchByteLength(json)>3*1024*1024);
  assert.equal((await library.pinPackage(pkg)).persisted,true);
  assert.equal((await library.saveWorkspace(workspaces.createWorkspace({
   id:'durable-workspace',name:'Durable study',now,state:{page:'explore',selected:['sofr'],window:'all'},
  }))).persisted,true);
  const reopened=await openDatabase(),record=reopened.getPackage(pkg.id);
  assert.equal(exportResearchPackage(record),json);
  assert.equal(packages.researchPackageCsv(record),pkg.csv);
  assert.equal(reopened.getWorkspace('durable-workspace').name,'Durable study');
  assert.equal(reopened.getState().durability.packages[pkg.id].status,'durable');
  assert.equal(reopened.getState().sessionOnly,false);
  assert.equal(store.values.has(api.RESEARCH_LIBRARY_KEY),false,'new database writes must not recreate the capped envelope');
 });

 await t.test('retained-scale default, All, Bill and 2008-selected packages preserve full inputs within unchanged limits',async()=>{
  const input=dataStatus.sources.auctions;
  assert.ok(input.auctions.length>6000,'exercise the complete admitted history');assert.equal(input.coverageStart,'2008-04-07');
  const first=input.auctions[0],routes=['#/auctions','#/auctions?window=all','#/auctions?type=Bill','#/auctions?window=all&auction='+first.id];
  for(const [index,route]of routes.entries()){
   const options=auctionArgs(input,route),pkg=await createResearchPackage({
    name:'Frozen auction',now:'2026-10-27T12:00:00.000Z',...options,id:'auction-retained-'+index,
   }),text=packages.exportResearchPackage(pkg),restored=await packages.importResearchPackage(text);
   assert.ok(Buffer.byteLength(text)<=12*1024*1024);assert.equal(packages.exportResearchPackage(restored),text);
   assert.equal(workspaces.canonicalJson(restored.context.moduleSources.auctions),workspaces.canonicalJson(input));
   assert.equal(restored.catalog.auctionOfferingMonthly.observations.length,input.series.auctionOfferingMonthly.observations.length);
   assert.equal(packages.researchPackageCsv(restored),packages.researchPackageCsv(pkg));
   for(const fileIndex of [0,1]){
    const file=packages.researchPackageAttachment(restored,fileIndex);
    assert.ok(Buffer.byteLength(file.content)<=32*1024*1024);assert.equal(file.content,packages.researchPackageAttachment(pkg,fileIndex).content);
    if(fileIndex===0)assert.equal(parseCsv(file.content).length,input.auctions.filter(row=>
     options.context.auctionExports.securityType==='All'||row.securityType===options.context.auctionExports.securityType).length+1);
   }
   let stored=null;
   const storage={getItem:()=>stored,setItem:(_key,value)=>{stored=value;}};
   const library=await api.createResearchLibrary(storage,{locks:{request:async(_name,_options,callback)=>callback()}});
   const result=await library.pinPackage(pkg);
   assert.equal(result.persisted,false);
   assert.equal(result.reason,'quota');
   assert.equal(stored,null);
   assert.match(library.getState().warning,/session-only/);
  }
 });
});
