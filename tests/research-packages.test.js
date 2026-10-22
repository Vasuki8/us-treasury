import test from 'node:test';import assert from 'node:assert/strict';
import {series as liveSeries}from'../src/data.js';
import {compareSeries,toCsv}from'../src/model.js';
import {createHash}from'node:crypto';
import {canonicalJson}from'../src/research-workspaces.js';
let api;try{api=await import('../src/research-packages.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('research-packages.js'))throw error;}
const use=()=>{assert.ok(api,'Frozen research packages must exist');return api;};
const now='2026-10-22T15:00:00.000Z';
const catalog=()=>({removedMeasure:{id:'removedMeasure',code:'OFFICIAL:OLD',name:'Retained old level',short:'Old level',topic:'Growth',agency:'oldAgency',frequency:'Monthly',unit:'Units',format:'number',precision:2,adjustment:'Not seasonally adjusted',comparisonClass:'level',definition:'Captured definition',observationType:'official',dataStatus:'official',source:{name:'Original official agency',url:'https://example.gov/data',seriesIds:['OFFICIAL:OLD']},sourceUrl:'https://example.gov/data',fetchedAt:'2026-10-21T12:00:00.000Z',calculation:'Published level',sourceNotice:'Original copyright and downstream terms.',licenseUrl:'https://example.gov/terms',attribution:'Source: Original official agency.',sourceTitle:'Original source title',provenance:[{url:'https://example.gov/data',sha256:'a'.repeat(64),retrievedAt:'2026-10-21T12:00:00.000Z'}],observations:[{date:'2026-06-01',value:10,publishedAt:null,sourceValue:'10'},{date:'2026-07-01',value:12,publishedAt:null,sourceValue:'12'},{date:'2026-08-01',value:null,publishedAt:null,sourceValue:'NA'},{date:'2026-09-01',value:15,publishedAt:null,sourceValue:'15'}]}});
const state=()=>({page:'indicator',seriesId:'removedMeasure',selected:['removedMeasure'],transform:'change',comparison:'native',window:'custom',startDate:'2026-07-01',endDate:'2026-09-30'});
const create=extra=>use().createResearchPackage({id:'package-one',name:'Frozen study',now,state:state(),catalog:catalog(),sources:{oldAgency:{status:'ok',fetchedAt:'2026-10-21T12:00:00.000Z',lastAttemptAt:'2026-10-21T12:00:00.000Z',provenance:catalog().removedMeasure.provenance}},snapshot:{generatedAt:now},context:{route:'#/series/removedMeasure',moduleSources:{notes:'Annualized scenario assumption'},attachments:[{name:'official-extra.csv',content:'measure,value\r\nAmount,-2.5\r\n',type:'text/csv'}]},assumptions:{noFill:true},...extra});

test('catalog-injected model exports removed series without reading or changing the current catalog',()=>{
 const frozen=catalog(),before=JSON.stringify(liveSeries);
 const result=compareSeries(['removedMeasure'],'native',{preset:'all'},frozen);
 assert.equal(result.error,null);assert.equal(result.panels[0].observations.length,4);
 assert.match(toCsv(['removedMeasure'],{catalog:frozen,range:{preset:'all'}}),/removedMeasure/);
 assert.equal(JSON.stringify(liveSeries),before);
});

test('frozen package retains full inputs, exact shown gaps/changes/CSV, rights, assumptions and retrieval state',async()=>{
 const pkg=await create();
 assert.equal(pkg.schema,'meridian.research-package');assert.equal(pkg.version,1);
 assert.equal(pkg.catalog.removedMeasure.observations.length,4);
 const panels=use().packagePanels(pkg);
 assert.deepEqual(panels[0].observations.map(row=>[row.date,row.value]),[['2026-07-01',2],['2026-08-01',null],['2026-09-01',null]]);
 assert.equal(pkg.resolvedWindow.startDate,'2026-07-01');assert.equal(pkg.resolvedWindow.endDate,'2026-09-30');
 assert.equal(pkg.catalog.removedMeasure.definition,'Captured definition');assert.match(pkg.catalog.removedMeasure.sourceNotice,/downstream terms/);
 assert.equal(pkg.sources.oldAgency.status,'ok');assert.deepEqual(pkg.assumptions,{noFill:true});
 assert.equal(pkg.context.attachments[0].content,'measure,value\r\nAmount,-2.5\r\n');
 assert.match(use().researchPackageCsv(pkg),/,2026-07-01,2,Units,/);
 assert.match(pkg.checksum.value,/^[a-f0-9]{64}$/);assert.equal(Object.isFrozen(pkg.catalog.removedMeasure.observations),true);
});

test('package import remains self-contained after current data changes and detects corrupt or unchecked derived content',async()=>{
 const pkg=await create(),text=use().exportResearchPackage(pkg),before=JSON.stringify(liveSeries);
 const imported=await use().importResearchPackage(text);
 assert.equal(use().exportResearchPackage(imported),text);assert.equal(use().researchPackageCsv(imported),use().researchPackageCsv(pkg));
 assert.equal(imported.catalog.removedMeasure.id,'removedMeasure');assert.equal(JSON.stringify(liveSeries),before);
 const tampered=JSON.parse(text);tampered.catalog.removedMeasure.observations[0].value=999;
 await assert.rejects(use().importResearchPackage(JSON.stringify(tampered)),/checksum|integrity/i);
 await assert.rejects(use().importResearchPackage('{bad json'),/JSON|package/i);
 const unchecked={...pkg,csv:'=HYPERLINK("bad")'};assert.throws(()=>use().researchPackageCsv(unchecked),/verified|validated|package/i);
});

test('pinning and canonical JSON round trips preserve the exact displayed CSV bytes including provenance JSON order',async()=>{
 const pkg=await create(),expected=toCsv(['removedMeasure'],{catalog:catalog(),transform:'change',comparison:'native',range:{preset:'custom',startDate:'2026-07-01',endDate:'2026-09-30'}});
 assert.equal(pkg.csv,expected);
 assert.equal(use().researchPackageCsv(await use().importResearchPackage(use().exportResearchPackage(pkg))),expected);
});

test('package CSV attachments reject active formulas and unsafe names while retaining safe negative numeric cells',async()=>{
 const {createResearchPackage}=use();
 for(const content of ['name,value\r\nExample,=1+1\r\n','name\r\n"\t@SUM(1)"\r\n','name\r\n-1+2\r\n'])await assert.rejects(create({context:{attachments:[{name:'bad.csv',content,type:'text/csv'}]}}),/formula|CSV/i);
 await assert.rejects(create({context:{attachments:[{name:'../escape.csv',content:'x\r\n1\r\n',type:'text/csv'}]}}),/attachment|name/i);
 await assert.rejects(createResearchPackage({name:'Empty',state:{selected:[]},catalog:catalog(),now}),/selection|series/i);
});

test('captured comparison classification governs frozen outputs independently of a current known series ID',async()=>{
 const captured=catalog().removedMeasure;
 const frozen={cpi:{...captured,id:'cpi',comparisonClass:'level',observations:[{date:'2026-06-01',value:10,publishedAt:null},{date:'2026-07-01',value:20,publishedAt:null}]}};
 const pkg=await create({catalog:frozen,state:{selected:['cpi'],comparison:'indexed',transform:'level',window:'all'}});
 assert.deepEqual(use().packagePanels(pkg)[0].observations.map(o=>o.value),[100,200]);
 const restored=await use().importResearchPackage(use().exportResearchPackage(pkg));
 assert.equal(restored.panels[0].formula,'100 × value / baseline');
});

async function rehashed(change){
 const plain=JSON.parse(use().exportResearchPackage(await create()));
 change(plain);delete plain.checksum;
 plain.checksum={algorithm:'SHA-256',value:createHash('sha256').update(canonicalJson(plain)).digest('hex')};
 return JSON.stringify(plain);
}

test('a valid checksum cannot admit altered panels, unchecked CSV or unsupported measurement requests',async()=>{
 for(const change of [
  value=>{value.csv=value.csv.replace(',2026-07-01,2,',',2026-07-01,200,');},
  value=>{value.csv=value.csv.replace('a'.repeat(64),'b'.repeat(64));},
  value=>{value.panels[0].observations[0].value=200;},
  value=>{value.request.range='silently-use-twelve';},
  value=>{value.request.range={preset:'custom',startDate:'2026-07-01',endDate:'2026-09-30',hiddenRange:12};},
  value=>{value.createdAt=0;},
  value=>{value.name=' Frozen study ';},
 ])await assert.rejects(use().importResearchPackage(await rehashed(change)),/package|request|range|timestamp|name/i);
});

test('imports reject unsupported schemas, malformed source inputs, unsafe URLs and prototype keys',async()=>{
 for(const change of [
  value=>{value.version=2;},
  value=>{value.catalog.removedMeasure.observations[1].date='2026-06-01';},
  value=>{value.catalog.removedMeasure.observations[0].value='10';},
  value=>{value.catalog.removedMeasure.sourceUrl='javascript:alert(1)';},
  value=>{value.catalog.removedMeasure.provenance[0].url='https://user:secret@example.gov/file';},
  value=>{value.context.attachments[0].content='safe\r\n"\u0001=1+1"\r\n';},
 ])await assert.rejects(use().importResearchPackage(await rehashed(change)),/package|source|CSV|URL|observation|date|schema/i);
 const text=await rehashed(value=>{value.context.notes={};});
 await assert.rejects(use().importResearchPackage(text.replace('"notes":{}','"notes":{"__proto__":{"polluted":true}}')),/key/i);
 assert.equal({}.polluted,undefined);
 await assert.rejects(use().importResearchPackage(' '.repeat(12*1024*1024+1)),/byte limit/i);
});

test('primary CSV may exceed 8 MiB when the full frozen package fits 12 MiB, while attachments keep their smaller cap',async()=>{
 const item={...catalog().removedMeasure,frequency:'Daily',sourceNotice:'Retained source rights. '.repeat(780),observations:Array.from({length:500},(_,index)=>({date:new Date(Date.UTC(2000,0,1+index)).toISOString().slice(0,10),value:index+1,publishedAt:null}))};
 const pkg=await create({catalog:{removedMeasure:item},state:{selected:['removedMeasure'],window:'all',transform:'level',comparison:'native'}});
 const serialized=use().exportResearchPackage(pkg);assert.ok(Buffer.byteLength(pkg.csv)>8*1024*1024);assert.ok(Buffer.byteLength(serialized)<=12*1024*1024);
 assert.equal(use().researchPackageCsv(await use().importResearchPackage(serialized)),pkg.csv);
 await assert.rejects(create({context:{attachments:[{name:'oversize.csv',content:'label\r\n'+'x'.repeat(8*1024*1024),type:'text/csv'}]}}),/CSV byte limit/i);
});

test('the complete package byte cap includes its checksum envelope',async()=>{
 const baseline=await create({context:{padding:''}}),bytes=Buffer.byteLength(use().exportResearchPackage(baseline));
 const padding='x'.repeat(12*1024*1024-bytes+1);
 await assert.rejects(create({context:{padding}}),/JSON.*byte limit/i);
});

test('CSV generation enforces its byte budget before repeated source metadata can amplify an imported file',async()=>{
 assert.throws(()=>toCsv(['removedMeasure'],{catalog:catalog(),range:{preset:'all'},maxBytes:100}),/CSV.*byte limit/i);
 const text=await rehashed(value=>{
  const item=value.catalog.removedMeasure;item.frequency='Daily';item.sourceNotice='Official note '.repeat(1600);
  item.observations=Array.from({length:1000},(_,index)=>({date:new Date(Date.UTC(2000,0,1+index)).toISOString().slice(0,10),value:index}));
  value.request={ids:['removedMeasure'],comparison:'native',transform:'level',range:{preset:'all'}};
 });
 assert.ok(Buffer.byteLength(text)<150000);
 await assert.rejects(use().importResearchPackage(text),/CSV.*byte limit/i);
});
