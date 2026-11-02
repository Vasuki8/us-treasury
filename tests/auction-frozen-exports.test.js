import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {series,dataStatus} from '../src/data.js';
import {parseRoute} from '../src/router.js';
import {buildPinContext} from '../src/research-context.js';
import * as packages from '../src/research-packages.js';
import * as view from '../src/auctions-page.js';
import {canonicalJson} from '../src/research-workspaces.js';
import {researchPage} from '../src/research-page.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {aggregateAuctionOfferings} from '../src/auctions.js';

const directory=new URL('./fixtures/auction-frozen-baseline/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
const baseline=Object.fromEntries(await Promise.all(Object.keys(manifest.packages).map(async name=>[name,gunzipSync(await readFile(new URL(name+'.json.gz',directory))).toString('utf8')])));
const hash=text=>createHash('sha256').update(text).digest('hex');
function source(){
 const input=JSON.parse(baseline.default).context.moduleSources.auctions;
 input.inputProvenanceScope='auction-response-page-v1';
 input.provenance.push({...input.provenance[0],url:'https://example.gov/page-2',sha256:'b'.repeat(64)});
 input.auctions=input.auctions.slice(0,4).map((row,index)=>({...row,sourceReceiptIndex:index%2}));
 input.series.auctionOfferingMonthly.observations=aggregateAuctionOfferings(input.auctions,{startDate:input.coverageStart,endDate:input.coverageEnd});
 return input;
}
function args(input=source(),route='#/auctions?window=all'){
 const item=input.series.auctionOfferingMonthly;
 const catalog={...series,auctionOfferingMonthly:{...series.auctionOfferingMonthly,...item,provenance:input.provenance,fetchedAt:input.fetchedAt}};
 return buildPinContext(parseRoute(route),{catalog,sources:{...dataStatus.sources,auctions:input}});
}
const create=options=>packages.createResearchPackage({id:'auction-frozen',name:'Frozen auction',now:'2026-10-27T12:00:00.000Z',...args(),...options});
function rehash(value){delete value.checksum;value.checksum={algorithm:'SHA-256',value:hash(canonicalJson(value))};return JSON.stringify(value);}

test('new auction chart pins retain mode/range and replay chart CSV independently of live auctions',async()=>{
 const pkg=await create(args(source(),'#/auctions?auctionView=allocations&auctionRange=36&window=all'));
 assert.equal(pkg.context.stitchRenderState.auctionView,'allocations');
 assert.equal(pkg.context.stitchRenderState.auctionRange,36);
 const index=packages.researchPackageAttachments(pkg).findIndex(row=>row.name==='auction-chart.csv');assert.ok(index>=0);
 const csv=packages.researchPackageAttachment(pkg,index).content,original=dataStatus.sources.auctions;
 try{
  dataStatus.sources.auctions={auctions:[]};
  const imported=await packages.importResearchPackage(packages.exportResearchPackage(pkg));
  assert.equal(packages.researchPackageAttachment(imported,index).content,csv);
  const html=researchPage({researchView:'packages',packageId:imported.id},{library:{packages:[imported]}});
  assert.match(html,/Frozen retained-data chart/);assert.match(html,/data-chart-catalog="auction-demand"/);
 }finally{dataStatus.sources.auctions=original;}
 const forged=JSON.parse(packages.exportResearchPackage(pkg));forged.context.stitchRenderState.auctionId='different-selection';
 await assert.rejects(packages.importResearchPackage(rehash(forged)),/auction.*selection|display state/);
});

test('four genuine baseline auction packages retain exact JSON, primary CSV and both stored exports',async()=>{
 for(const [name,text]of Object.entries(baseline)){
  const expected=manifest.packages[name],pkg=await packages.importResearchPackage(text);
  assert.equal(hash(packages.exportResearchPackage(pkg)),expected.jsonSha256);
  assert.equal(packages.exportResearchPackage(pkg),text);
  assert.equal(hash(packages.researchPackageCsv(pkg)),expected.primaryCsvSha256);
  assert.deepEqual(packages.researchPackageAttachments(pkg),expected.attachments.map(file=>({name:file.name,type:'text/csv',generated:false})));
  for(const [index,file]of expected.attachments.entries())assert.equal(hash(packages.researchPackageAttachment(pkg,index).content),file.sha256);
  assert.equal(hash(view.auctionsCsv(pkg.context.moduleSources.auctions,{securityType:pkg.workspace.auctionType,auctionId:pkg.workspace.auctionId})),expected.attachments[0].sha256);
  assert.equal(hash(view.auctionsCsv(pkg.context.moduleSources.auctions,{securityType:pkg.workspace.auctionType,auctionId:pkg.workspace.auctionId,benchmark:true})),expected.attachments[1].sha256);
 }
});

test('auction CSV resolves the actual indexed page receipt only for explicitly opted-in sources',()=>{
 const input=source(),[headers,...rows]=parseCsv(view.auctionsCsv(input));
 const idColumn=headers.indexOf('auction_id'),receiptsColumn=headers.indexOf('capture_provenance_json');
 for(const row of rows){const auction=input.auctions.find(item=>item.id===row[idColumn]);assert.deepEqual(JSON.parse(row[receiptsColumn]),[input.provenance[auction.sourceReceiptIndex]]);}
 delete input.inputProvenanceScope;
 assert.throws(()=>view.auctionsCsv(input),/receipt|scope/i);
 for(const row of input.auctions)delete row.sourceReceiptIndex;
 for(const row of parseCsv(view.auctionsCsv(input)).slice(1))assert.deepEqual(JSON.parse(row[receiptsColumn]),input.provenance);
 input.inputProvenanceScope='auction-response-page-v1';input.auctions[0].sourceReceiptIndex=4;
 assert.throws(()=>view.auctionsCsv(input),/receipt/i);
});

test('new auction profiles retain complete inputs and expose both generated exports through the existing attachment action',async()=>{
 const input=source(),options=args(input),profile=options.context.auctionExports;
 assert.equal(profile?.version,1);assert.equal(profile.csvMode,'generated-full-retained-v1');assert.equal(profile.securityType,'All');
 assert.ok(input.auctions.some(row=>row.id===profile.auctionId));assert.deepEqual(options.context.attachments,[]);
 const pkg=await create(options),json=packages.exportResearchPackage(pkg),restored=await packages.importResearchPackage(json);
 assert.equal(packages.exportResearchPackage(restored),json);assert.deepEqual(restored.context.moduleSources.auctions,JSON.parse(canonicalJson(input)));
 assert.deepEqual(packages.researchPackageAttachments(restored),['auction-results.csv','auction-peers.csv','auction-chart.csv'].map(name=>({name,type:'text/csv',generated:true})));
 for(const index of [0,1]){
  const file=packages.researchPackageAttachment(restored,index);
  assert.equal(file.content,packages.researchPackageAttachment(pkg,index).content);
  const records=parseCsv(file.content);assert.equal(records.length,index===0?input.auctions.length+1:2);
 }
 const html=researchPage(parseRoute('#/research?view=packages&package='+pkg.id),{library:{packages:[restored]}});
 const actions=[...html.matchAll(/<button\b[^>]*data-package-attachment="(\d+)"[^>]*>([^<]*)<\/button>/g)];
 assert.deepEqual(actions.map(([,index,label])=>({index:Number(index),label})),[
  {index:0,label:'auction-results.csv'},{index:1,label:'auction-peers.csv'},{index:2,label:'auction-chart.csv'},
 ]);
 assert.throws(()=>packages.researchPackageAttachment({...restored},0),/validated/i);
 assert.throws(()=>packages.researchPackageAttachment(restored,3),/unavailable/i);
 const prior=dataStatus.sources.auctions;dataStatus.sources.auctions={auctions:[]};
 try{assert.equal(packages.researchPackageAttachment(restored,0).content,packages.researchPackageAttachment(pkg,0).content);}finally{dataStatus.sources.auctions=prior;}
});

test('new auction import rejects unsupported profiles, missing inputs, malformed lineage and conflicting copies',async()=>{
 const json=packages.exportResearchPackage(await create());
 for(const change of [
  value=>{value.context.auctionExports.version=2;},
  value=>{value.context.auctionExports.csvMode='fetch-current';},
  value=>{value.context.auctionExports.securityType='Equity';},
  value=>{value.context.auctionExports.auctionId='missing';},
  value=>{delete value.context.moduleSources.auctions;},
  value=>{value.context.moduleSources.auctions.auctions=[];},
  value=>{value.context.moduleSources.auctions.auctions[1].id=value.context.moduleSources.auctions.auctions[0].id;},
  value=>{value.context.moduleSources.auctions.auctions[0].competitiveAccepted='10';},
  value=>{value.context.moduleSources.auctions.auctions[0].auctionDate='2026-02-30';},
  value=>{value.context.moduleSources.auctions.auctions[0].sourceUrl='javascript:alert(1)';},
  value=>{delete value.context.moduleSources.auctions.auctions[0].sourceReceiptIndex;},
  value=>{value.context.moduleSources.auctions.auctions[0].sourceReceiptIndex=.5;},
  value=>{value.context.moduleSources.auctions.auctions[0].sourceReceiptIndex=99;},
  value=>{value.context.moduleSources.auctions.provenance=[];},
  value=>{delete value.context.moduleSources.auctions.inputProvenanceScope;},
  value=>{value.context.moduleSources.auctions.series.auctionOfferingMonthly.observations.pop();},
  value=>{value.context.moduleSources.auctions.series.auctionOfferingMonthly.observations[0].value=0;},
  value=>{value.context.moduleSources.auctions.series.auctionOfferingMonthly.observations[0].auctionCount=0;},
  value=>{delete value.context.moduleSources.auctions.series.auctionOfferingMonthly.observations[0].partial;},
  value=>{value.context.moduleSources.auctions.series.auctionOfferingMonthly.observations[0].publishedAt='2024-10-01';},
  value=>{value.context.attachments=[{name:'auction-results.csv',type:'text/csv',content:'x\r\n1\r\n'}];},
 ]){const value=JSON.parse(json);change(value);await assert.rejects(packages.importResearchPackage(rehash(value)),/auction|receipt|source URL/i);}
});

test('generated auction CSV enforces the unchanged 32 MiB amplification bound and stored CSV keeps its 8 MiB cap',async()=>{
 assert.equal(view.MAX_GENERATED_AUCTIONS_CSV_BYTES,32*1024*1024);
 const input=source();input.coverageNote='x'.repeat(9*1024*1024);
 assert.throws(()=>view.generatedAuctionsCsv(input,{validateOnly:true}),/CSV byte limit/i);
 await assert.rejects(create({context:{attachments:[{name:'too-big.csv',type:'text/csv',content:'x\r\n'+'x'.repeat(8*1024*1024)}]}}),/CSV byte limit/i);
 const value=JSON.parse(packages.exportResearchPackage(await create()));
 value.context.moduleSources.auctions.coverageNote='x'.repeat(9*1024*1024);
 assert.ok(Buffer.byteLength(rehash(value))<12*1024*1024);
 await assert.rejects(packages.importResearchPackage(rehash(value)),/CSV byte limit/i);
});

test('generated auction CSV neutralizes control-prefixed formulas and absent profiles never invent attachments',async()=>{
 const input=source();input.coverageNote='\u0001=HYPERLINK("https://example.gov")';
 const pkg=await create(args(input)),[headers,...rows]=parseCsv(packages.researchPackageAttachment(pkg,0).content);
 assert.ok(rows[0][headers.indexOf('coverage_note')].startsWith("'\u0001="));
 const options=args();delete options.context.auctionExports;
 await assert.rejects(create(options),/display state/);
 delete options.context.stitchRenderState;
 assert.deepEqual(packages.researchPackageAttachments(await create(options)),[]);
});
