import test from 'node:test';
import assert from 'node:assert/strict';
import * as contexts from '../src/research-context.js';
import {parseRoute} from '../src/router.js';
import {series,dataStatus,releases} from '../src/data.js';
import {publicationArchive} from '../src/publication-archive.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageAttachment} from '../src/research-packages.js';
import {buildCoverageInventory} from '../src/coverage-inventory.js';
import {researchPage} from '../src/research-page.js';
import {renderPage} from '../src/pages.js';
import {cpiPublicationCsv,selectCpiPublicationHistory} from '../src/cpi-publication-history.js';
import {parseCsv} from '../scripts/sources/http.mjs';

test('CPI calendar and all four indicator measurements link to published evidence without claiming an exact publication time',()=>{
 const event=releases.find(row=>row.sourceId==='bls'&&row.program==='consumer-price-index');assert.ok(event);
 const calendar=renderPage(parseRoute('#/calendar?event='+event.id+'&month='+event.date.slice(0,7)));
 assert.match(calendar,/Open release evidence/);assert.match(calendar,/publicationSeries=cpiMonthly/);
 for(const id of ['cpi','cpiCore','cpiMonthly','cpiCoreMonthly']){
  const html=renderPage(parseRoute('#/series/'+id));
  assert.match(html,/Verified release &amp; publication evidence/);assert.match(html,new RegExp('publicationSeries='+id));
  assert.match(html,/Published CPI rates use the dated release/);
 }
});

test('the actual market page dispatch passes its selected window to every funding chart',()=>{
 const html=renderPage(parseRoute('#/market?window=custom&start=2026-09-01&end=2026-10-22'));
 const charts=[...html.matchAll(/<div[^>]*data-chart-catalog="funding"[^>]*>/g)].map(x=>x[0]);assert.equal(charts.length,3);
 for(const chart of charts){assert.match(chart,/2026-09-01/);assert.match(chart,/2026-10-22/);assert.match(chart,/custom/);}
});

test('funding freeze retains the exact selected range, complete source percentiles and generated full specialist CSV',async()=>{
 const args=contexts.buildPinContext(parseRoute('#/market?window=custom&start=2026-09-01&end=2026-10-22'));
 assert.deepEqual(args.context.fundingDistributions,{version:2,range:{preset:'custom',startDate:'2026-09-01',endDate:'2026-10-22'},csvMode:'generated-full-retained-v1'});
 assert.equal(args.context.attachments.some(x=>x.name==='market-functioning.csv'),false);
 const pkg=await createResearchPackage({name:'Funding distributions',...args}),original=researchPackageAttachment(pkg,0).content,restored=await importResearchPackage(exportResearchPackage(pkg));
 assert.deepEqual(restored.context.moduleSources.marketFunctioning.series.sofr.observations,args.context.moduleSources.marketFunctioning.series.sofr.observations);
 assert.equal(researchPackageAttachment(restored,0).content,original);
 const html=researchPage(parseRoute('#/research?view=packages&package='+pkg.id),{library:{packages:[restored]}});
 assert.match(html,/data-chart-catalog="funding"/);
});

test('coverage freeze reconstructs metadata from retained inputs and puts inventory before scalar histories',async()=>{
 const state=parseRoute('#/explore?mode=coverage&q=unemployment&topic=Labor');
 const live=buildCoverageInventory(series,state),args=contexts.buildPinContext(state);
 assert.ok(args.context.coverageInventory);assert.equal(args.context.coverageInventory.version,1);
 const pkg=await createResearchPackage({name:'Coverage inventory',...args}),restored=await importResearchPackage(exportResearchPackage(pkg));
 const frozen=restored.context.coverageInventory,replayed=buildCoverageInventory(frozen.catalog,{...frozen.filters,registeredCount:frozen.registeredCount,publicationContexts:frozen.publicationContexts});
 assert.deepEqual(replayed.rows.map(x=>[x.id,x.firstReference,x.lastReference,x.usableCount,x.totalCount]),live.rows.map(x=>[x.id,x.firstReference,x.lastReference,x.usableCount,x.totalCount]));
 assert.ok(restored.context.attachments.some(x=>x.name==='coverage-inventory.csv'));
 const html=researchPage(parseRoute('#/research?view=packages&package='+pkg.id),{library:{packages:[restored]}});
 assert.match(html,/class="panel coverage-inventory"/);assert.doesNotMatch(html,/data-chart/);
});

test('full GDP matrix pins retain archive cutoff and original CSV inside the portable limit',async()=>{
 assert.equal(typeof contexts.buildGdpMatrixPin,'function');
 const args=contexts.buildGdpMatrixPin(publicationArchive,'2026-09-30');
 assert.equal(args.context.gdpRevisionMatrix.version,1);assert.equal(args.context.gdpRevisionMatrix.cutoff,'2026-09-30');
 const original=args.context.attachments.find(x=>x.name==='gdp-revision-matrix.csv').content;
 const pkg=await createResearchPackage({name:'GDP revision matrix',...args}),json=exportResearchPackage(pkg);assert.ok(Buffer.byteLength(json)<12*1024*1024);
 const restored=await importResearchPackage(json);assert.equal(restored.context.attachments.find(x=>x.name==='gdp-revision-matrix.csv').content,original);
 assert.equal(restored.context.gdpRevisionMatrix.archive.releases.length,publicationArchive.releases.length);
 const html=researchPage(parseRoute('#/research?view=packages&package='+pkg.id),{library:{packages:[restored]}});
 assert.match(html,/data-page-disclosure="research:gdp-matrix:methods"/);
 assert.match(html,/Frozen publication cutoff: 2026-09-30/);
 assert.doesNotMatch(html,/id="publication-cutoff"|data-pin-gdp-matrix|data-chart/);
});

test('CPI publication pins preserve published rates and source basis rather than the live index-derived history',async()=>{
 assert.equal(typeof contexts.buildCpiPublicationPin,'function');const {cpiPublicationArchive}=await import('../src/cpi-publication-archive.js');
 for(const id of ['cpiMonthly','cpiCoreMonthly','cpi','cpiCore']){
  const args=contexts.buildCpiPublicationPin(cpiPublicationArchive,id,'2026-10-14','2026-09-01'),captured=args.catalog[id];
  assert.equal(captured.observationType,'official');assert.equal(captured.precision,1);assert.equal(captured.observations[0].publishedAt,null);assert.ok(captured.unit);
  assert.equal(captured.adjustment,id.includes('Monthly')?'Seasonally adjusted':'Not seasonally adjusted');
  const pkg=await createResearchPackage({name:'CPI published '+id,...args}),restored=await importResearchPackage(exportResearchPackage(pkg));
  assert.equal(restored.context.publicationSeries,id);assert.ok(restored.context.attachments.some(x=>x.name==='cpi-publication-history.csv'));assert.equal(restored.catalog[id].observations[0].value,captured.observations[0].value);
 }
});

test('CPI publication pins discard live API capture scope and preserve exact publication exports',async()=>{
 const {cpiPublicationArchive}=await import('../src/cpi-publication-archive.js');
 const apiTime='2099-12-31T23:59:59.000Z',apiHash='a'.repeat(64),apiUrl='https://api.bls.gov/publicAPI/v2/timeseries/data/';
 for(const id of ['cpiMonthly','cpiCoreMonthly','cpi','cpiCore']){
  const original=series[id];
  series[id]={...original,inputProvenanceScope:'observation-source-urls',fetchedAt:apiTime,lastAttemptAt:apiTime,provenance:[{url:apiUrl,sha256:apiHash,retrievedAt:apiTime}],sourceUrl:apiUrl,sourceUrls:[apiUrl],observations:[{date:'2099-12-01',value:999,sourceUrl:apiUrl,retrievedAt:apiTime,sourceSha256:apiHash}]};
  try{
   const options={seriesId:id,cutoff:'2026-10-14',period:'2026-09-01'},row=selectCpiPublicationHistory(cpiPublicationArchive,options).latest;
   const args=contexts.buildCpiPublicationPin(cpiPublicationArchive,id,options.cutoff,options.period);
   const pkg=await createResearchPackage({name:'Published CPI with live API history '+id,...args});
   const text=exportResearchPackage(pkg),restored=await importResearchPackage(text),captured=restored.catalog[id];
   assert.equal(exportResearchPackage(restored),text);assert.equal(restored.csv,pkg.csv);
   assert.notEqual(captured.inputProvenanceScope,'observation-source-urls');assert.equal(captured.lastAttemptAt,null);
   assert.deepEqual(captured.provenance,row.provenance);assert.equal(captured.fetchedAt,row.provenance.at(-1).retrievedAt);assert.equal(captured.sourceUrl,row.sourceUrl);
   assert.equal(restored.context.attachments.find(item=>item.name==='cpi-publication-history.csv').content,cpiPublicationCsv(cpiPublicationArchive,options));
   const [headers,values]=parseCsv(restored.csv),csv=Object.fromEntries(headers.map((key,index)=>[key,values[index]]));
   assert.deepEqual(JSON.parse(csv.capture_provenance_json),row.provenance);assert.equal(csv.retrieved_at,row.provenance.at(-1).retrievedAt);assert.equal(csv.source_url,row.sourceUrl);
   for(const marker of [apiTime,apiHash,apiUrl])assert.equal(text.includes(marker),false,marker);
  }finally{series[id]=original;}
 }
});
