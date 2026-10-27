import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {series,dataStatus} from '../src/data.js';
import {parseRoute} from '../src/router.js';
import {buildPinContext} from '../src/research-context.js';
import * as packages from '../src/research-packages.js';
import {canonicalJson} from '../src/research-workspaces.js';
import {marketFunctioningCsv,marketFunctioningPage} from '../src/market-functioning-page.js';
import {researchPage} from '../src/research-page.js';
import {fundingDistributionPanels} from '../src/funding-distribution-view.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const now='2026-10-26T12:00:00.000Z';
const source=()=>({status:'ok',fetchedAt:now,lastAttemptAt:now,coverageStart:'2024-07-03',coverageEnd:'2026-10-23',
 provenance:[{url:'https://example.gov/frozen',sha256:'a'.repeat(64),retrievedAt:now}],series:{
 dealerNetTreasury:{observations:[{date:'2024-07-03',value:400}]},
 dealerRepo:{observations:[{date:'2024-07-03',value:3000}]},
 dealerReverseRepo:{observations:[{date:'2024-07-03',value:2000}]},
 dealerFailsDeliver:{observations:[{date:'2024-07-03',value:100}]},
 dealerFailsReceive:{observations:[{date:'2024-07-03',value:90}]},
 sofr:{sourceIds:['SOFR'],sourceUrl:'https://example.gov/sofr',observations:[{date:'2018-04-02',value:1.8,percentile1:1.25,percentile25:1.77,percentile75:1.89,percentile99:2.25},{date:'2019-05-31',value:2.49,percentile1:null,percentile25:null,percentile75:null,percentile99:null,volumeInBillions:1136,footnoteId:2,footnotes:['Survey contingency; percentiles unavailable.']}]},
 effr:{sourceIds:['EFFR'],sourceUrl:'https://example.gov/effr',observations:[{date:'2016-03-01',value:.36},{date:'2020-03-02',value:1.59,revisionIndicator:'r',footnoteId:1,footnotes:['Reduced reported volume.']}]},
 sofrEffrSpread:{sourceIds:['SOFR','EFFR'],sourceUrls:['https://example.gov/sofr','https://example.gov/effr'],observations:[{date:'2018-04-02',value:5}]},
}});
function args(input=source(),route='#/market?window=custom&start=2019-05-01&end=2019-05-31'){
 const catalog={...series};for(const id of ['sofr','effr','sofrEffrSpread'])catalog[id]={...series[id],...input.series[id],fetchedAt:input.fetchedAt,provenance:input.provenance};
 return buildPinContext(parseRoute(route),{catalog,sources:{...dataStatus.sources,marketFunctioning:input}});
}
const create=options=>packages.createResearchPackage({id:'funding-frozen',name:'Frozen funding',now,...args(),...options});
function rehash(value){delete value.checksum;value.checksum={algorithm:'SHA-256',value:createHash('sha256').update(canonicalJson(value)).digest('hex')};return JSON.stringify(value);}

test('new market freezes retain every source date and generate full specialist CSV through the existing attachment action',async()=>{
 const input=source(),options=args(input),profile=options.context.fundingDistributions;
 assert.deepEqual(profile,{version:2,range:{preset:'custom',startDate:'2019-05-01',endDate:'2019-05-31'},csvMode:'generated-full-retained-v1'});
 assert.deepEqual(options.context.attachments,[]);
 assert.equal(options.context.moduleSources.marketFunctioning,input);
 assert.match(options.context.scope,/generated.*full.retained/i);
 const pkg=await create(options),json=packages.exportResearchPackage(pkg),restored=await packages.importResearchPackage(json);
 assert.equal(packages.exportResearchPackage(restored),json);
 assert.deepEqual(packages.researchPackageAttachments(restored),[{name:'market-functioning.csv',type:'text/csv',generated:true}]);
 const file=packages.researchPackageAttachment(pkg,0),again=packages.researchPackageAttachment(restored,0);
 assert.equal(file.content,again.content);assert.match(file.content,/2016-03-01/);assert.match(file.content,/2018-04-02/);
 assert.deepEqual(restored.context.moduleSources.marketFunctioning,JSON.parse(canonicalJson(input)));
 const html=researchPage(parseRoute('#/research?view=packages&package='+pkg.id),{library:{packages:[restored]}});
 assert.match(html,/FROZEN SOFR RATE DISTRIBUTION/);assert.match(html,/data-package-attachment="0"/);assert.match(html,/generated.*full.retained/i);
 assert.throws(()=>packages.researchPackageAttachment(restored,1),/unavailable/i);
 assert.throws(()=>packages.researchPackageAttachment({...restored},0),/validated/i);
});

test('generated exports remain bound to frozen source after current funding inputs change',async()=>{
 const pkg=await create(),first=packages.researchPackageAttachment(pkg,0).content,original=dataStatus.sources.marketFunctioning;
 dataStatus.sources.marketFunctioning={series:{sofr:{observations:[{date:'2099-01-01',value:999}]}}};
 try{assert.equal(packages.researchPackageAttachment(await packages.importResearchPackage(packages.exportResearchPackage(pkg)),0).content,first);}finally{dataStatus.sources.marketFunctioning=original;}
});

test('legacy stored funding attachments remain exact and absent profiles never infer a generated export',async()=>{
 const options=args(),original='legacy,value\r\nOriginal,1\r\n';
 options.context.fundingDistributions={version:1,range:{preset:'all'}};options.context.attachments=[{name:'market-functioning.csv',type:'text/csv',content:original}];
 options.context.moduleSources.marketFunctioning.series={};
 const pkg=await create(options),json=packages.exportResearchPackage(pkg),restored=await packages.importResearchPackage(json);
 assert.equal(packages.exportResearchPackage(restored),json);assert.equal(packages.researchPackageAttachment(restored,0).content,original);
 assert.deepEqual(packages.researchPackageAttachments(restored),[{name:'market-functioning.csv',type:'text/csv',generated:false}]);
 delete options.context.fundingDistributions;options.context.attachments=[];
 assert.deepEqual(packages.researchPackageAttachments(await create(options)),[]);
});

test('imports reject unsupported generated profiles, conflicting copies and malformed retained market inputs',async()=>{
 const json=packages.exportResearchPackage(await create());
 for(const change of [
  value=>{value.context.fundingDistributions.version=3;},
  value=>{value.context.fundingDistributions.csvMode='fetch-current';},
  value=>{value.context.fundingDistributions.inputUrl='https://example.gov/live';},
  value=>{value.context.attachments=[{name:'market-functioning.csv',type:'text/csv',content:'x\r\n1\r\n'}];},
  value=>{delete value.context.moduleSources.marketFunctioning;},
  value=>{value.context.moduleSources.marketFunctioning.series.sofr.observations[0].value='1.8';},
  value=>{value.context.moduleSources.marketFunctioning.series.effr.observations[1].date='2016-03-01';},
  value=>{value.context.moduleSources.marketFunctioning.series.sofr.observations[0].percentile1='1.25';},
  value=>{value.context.moduleSources.marketFunctioning.series.effr.observations[0].footnotes=[{}];},
  value=>{value.context.moduleSources.marketFunctioning.series.effr.observations[0].sourceUrl='javascript:alert(1)';},
  value=>{value.context.moduleSources.marketFunctioning.series.sofr.observations[1].percentileSourceValues={percentile1:'NA'};},
  value=>{value.context.moduleSources.marketFunctioning.series.effr.observations=new Array(50001).fill({date:'2016-03-01',value:1});},
 ]){const value=JSON.parse(json);change(value);await assert.rejects(packages.importResearchPackage(rehash(value)),/funding|market|source URL|observations/i);}
});

test('generated full history imports reject any missing or empty source series independently of the primary catalog',async()=>{
 const json=packages.exportResearchPackage(await create());
 const ids=['dealerNetTreasury','dealerRepo','dealerReverseRepo','dealerFailsDeliver','dealerFailsReceive','sofr','effr','sofrEffrSpread'];
 for(const id of ids)for(const empty of [false,true]){
  const value=JSON.parse(json),originalCatalog=canonicalJson(value.catalog);
  if(empty)value.context.moduleSources.marketFunctioning.series[id].observations=[];
  else delete value.context.moduleSources.marketFunctioning.series[id];
  assert.equal(canonicalJson(value.catalog),originalCatalog);
  await assert.rejects(packages.importResearchPackage(rehash(value)),/complete frozen source|nonempty.*observations/i,`${id}: ${empty?'empty observations':'missing series'}`);
 }
 const value=JSON.parse(json);value.context.moduleSources.marketFunctioning.series={};
 await assert.rejects(packages.importResearchPackage(rehash(value)),/complete frozen source/i);
});

test('generated full CSV rejects receipt amplification at 32 MiB while stored attachment cap stays 8 MiB',async()=>{
 const json=packages.exportResearchPackage(await create()),value=JSON.parse(json),input=value.context.moduleSources.marketFunctioning;
 input.provenance[0].note='source evidence '.repeat(5000);
 input.series.effr.observations=Array.from({length:500},(_,index)=>({date:new Date(Date.UTC(2016,2,1+index)).toISOString().slice(0,10),value:1}));
 const amplified=rehash(value);assert.ok(Buffer.byteLength(amplified)<200000);
 await assert.rejects(packages.importResearchPackage(amplified),/CSV byte limit/i);
 await assert.rejects(create({context:{attachments:[{name:'too-big.csv',type:'text/csv',content:'x\r\n'+'x'.repeat(8*1024*1024)}]}}),/CSV byte limit/i);
});

test('funding source flags are visible and optional CSV columns retain exact raw revision and footnote values',()=>{
 const input=source(),html=marketFunctioningPage(input),panels=fundingDistributionPanels(input,{preset:'all'},{frozen:true});
 assert.match(html,/REVISED.*r/);assert.match(html,/Reduced reported volume/);assert.match(html,/Dealer coverage.*2024-07-03/i);assert.match(html,/EFFR.*2016-03-01/);
 assert.match(panels,/Survey contingency; percentiles unavailable/);assert.match(panels,/Reduced reported volume/);
 const [headers,...rows]=parseCsv(marketFunctioningCsv(input));assert.deepEqual(headers.slice(-2),['footnote_id','source_notes']);
 const fields=rows.map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]]))),effr=fields.find(row=>row.date==='2020-03-02'),sofr=fields.find(row=>row.date==='2019-05-31');
 assert.equal(effr.revision_indicator,'r');assert.equal(effr.footnote_id,'1');assert.equal(effr.source_notes,'Reduced reported volume.');
 assert.equal(sofr.percentile_1,'');assert.equal(sofr.value,'2.49');assert.equal(sofr.footnote_id,'2');
 const old={series:{effr:{observations:[{date:'2016-03-01',value:.36}]}}};assert.equal(parseCsv(marketFunctioningCsv(old))[0].length,30);
});

test('frozen full CSV preserves official NA percentile strings beside null numeric endpoints and footnote 2',async()=>{
 const input=source(),row=input.series.sofr.observations[1];
 row.percentileSourceValues={percentile99:'NA',percentile25:'NA',percentile1:'NA',percentile75:'NA'};
 assert.ok(parseCsv(marketFunctioningCsv(input))[0].includes('percentile_source_values_json'));
 const pkg=await create(args(input)),restored=await packages.importResearchPackage(packages.exportResearchPackage(pkg));
 const [headers,...rows]=parseCsv(packages.researchPackageAttachment(restored,0).content),record=Object.fromEntries(headers.map((header,index)=>[header,rows.find(row=>row[2]==='2019-05-31')[index]]));
 assert.equal(record.percentile_source_values_json,'{"percentile1":"NA","percentile25":"NA","percentile75":"NA","percentile99":"NA"}');
 assert.equal(record.percentile_1,'');assert.equal(record.percentile_25,'');assert.equal(record.percentile_75,'');assert.equal(record.percentile_99,'');assert.equal(record.footnote_id,'2');
 assert.equal(packages.researchPackageAttachment(pkg,0).content,packages.researchPackageAttachment(restored,0).content);
});

test('source footnote punctuation and markup are escaped once in existing distribution notes',()=>{
 const input=source();input.series.effr.observations[1].footnotes=["The prior day's rate & source <note>."];
 const html=fundingDistributionPanels(input,{preset:'all'});
 assert.match(html,/prior day&#39;s rate &amp; source &lt;note&gt;/);assert.doesNotMatch(html,/&amp;#39;|&amp;lt;/);
});

test('generated CSV neutralizes formula-active retained text after control characters',async()=>{
 const input=source();input.series.effr.observations[1].footnotes=['\u0001=HYPERLINK("https://example.gov")'];
 const pkg=await create(args(input)),[headers,...rows]=parseCsv(packages.researchPackageAttachment(pkg,0).content),row=rows.find(row=>row[2]==='2020-03-02');
 assert.ok(row[headers.indexOf('source_notes')].startsWith("'\u0001="));
});
