import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {series,dataStatus} from '../src/data.js';
import {parseRoute} from '../src/router.js';
import {buildPinContext} from '../src/research-context.js';
import {createStitchEvidence,validateStitchEvidence,stitchEvidenceCatalog,stitchFrozenSources,validateStitchLegacySources,stitchEvidenceSourceIds} from '../src/stitch-evidence.js';
import {stitchDeskContracts} from '../src/stitch-desk-contracts.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv,researchPackageAttachments,researchPackageAttachment} from '../src/research-packages.js';
import {canonicalJson} from '../src/research-workspaces.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {parseBlsDeskBatch} from '../scripts/sources/bls-desk.mjs';
import {buildBlsDeskSeries,validateBlsDeskSource} from '../src/bls-desk-schema.js';
import {BLS_DESK_COVERAGE_NOTE} from '../src/bls-desk-definitions.js';

const json=async path=>JSON.parse(await readFile(new URL('./fixtures/'+path,import.meta.url),'utf8'));
const market=Object.fromEntries(await Promise.all(['fedSep','fedFx','ecbFx','ecbPolicy'].map(async id=>[id,await json('market-desks/'+id+'-candidate.json')])));
const fomcCalendar=await json('market-desks/fomc-calendar.json');
const blsFixture=await json('bls-desk-response.json');
const now='2026-11-01T22:00:00.000Z';
const copy=structuredClone;
const hash=text=>createHash('sha256').update(text).digest('hex');
function rows(text){const [header,...data]=parseCsv(text);return data.map(values=>Object.fromEntries(header.map((key,index)=>[key,values[index]??''])));}
function generated(pkg,name){const index=researchPackageAttachments(pkg).findIndex(file=>file.name===name);assert.ok(index>=0,name+' attachment exists');return researchPackageAttachment(pkg,index).content;}
function resealed(pkg,change){const value=JSON.parse(exportResearchPackage(pkg));delete value.checksum;change(value);value.checksum={algorithm:'SHA-256',value:hash(canonicalJson(value))};return canonicalJson(value);}
function blsSource(){
 const raw={};for(const batch of blsFixture.batches)Object.assign(raw,parseBlsDeskBatch(batch.payload,batch.receipt.requestedSeries));
 const provenance=copy(blsFixture.batches.map(batch=>batch.receipt));
 return {id:'blsDesk',status:'ok',fetchedAt:provenance.map(row=>row.retrievedAt).sort().at(-1),coverageStart:'2017-01-01',coverageEnd:'2026-11-01',series:buildBlsDeskSeries(raw),provenance,coverageNote:BLS_DESK_COVERAGE_NOTE,warnings:[BLS_DESK_COVERAGE_NOTE]};
}
function pin(state,sources){return buildPinContext(state,{catalog:{...series,...stitchEvidenceCatalog(sources)},sources,snapshot:{generatedAt:now,...(state.page==='fomc'?{calendar:{sources:{fomc:copy(fomcCalendar)}}}:{})},now:new Date(now)});}
async function makePackage(state,sources,id){return createResearchPackage({id,name:'Frozen '+id,now,...pin(state,sources)});}
function fomcSources(){return {...copy(dataStatus.sources),fedSep:copy(market.fedSep)};}
function fxSources(){return {fedFx:copy(market.fedFx),ecbFx:copy(market.ecbFx),ecbPolicy:copy(market.ecbPolicy),policyRates:copy(dataStatus.sources.policyRates)};}
const fomcState=()=>({...parseRoute('#/rates/fomc'),window:'all',specialistRange:'MAX',freezeSelection:['policyTargetUpper']});
const fxState=()=>({...parseRoute('#/market/fx-basis'),window:'all',specialistRange:'MAX',fxScenario:'policy-divergence',fxFedShock:-50,fxForeignShock:-25,fxHorizon:3,freezeSelection:['fxUsdEur']});

test('BLS specialist freezing retains every official input and derived null independently of the one-series selection',async()=>{
 const specialist=blsSource();assert.equal(validateBlsDeskSource(specialist),true);
 const sources={bls:copy(dataStatus.sources.bls),blsDesk:specialist},state={...parseRoute('#/series/payroll'),window:'all',freezeSelection:['payroll']};
 const args=pin(state,sources);
 assert.deepEqual(args.state.selected,['payroll']);
 assert.deepEqual(args.context.stitchEvidence.sources.blsDesk.series,specialist.series);
 assert.ok(Object.keys(specialist.series).length>100);
 assert.ok(!args.state.selected.includes('payrollConstructionAverage12m'));
 const pkg=await createResearchPackage({id:'bls-specialist',name:'BLS specialist',now,...args});
 const primaryCsv=researchPackageCsv(pkg),supportingCsv=generated(pkg,'specialist-evidence.csv'),encoded=exportResearchPackage(pkg);
 const captured=pkg.context.stitchEvidence.sources.blsDesk;
 const construction=captured.series.payrollConstructionAverage12m.observations.find(row=>row.value!==null);
 assert.ok(construction,'a source-backed twelve-month sector average is retained');
 const records=rows(supportingCsv),record=records.find(row=>row.source_id==='blsDesk'&&row.series_id==='payrollConstructionAverage12m'&&row.date===construction.date);
 assert.equal(Number(record.value),construction.value);
 for(const [id,code]of [
  ['payrollConstructionAverage12m','CES2000000001'],
  ['eciCivilianCompensationQuarterly','CIS1010000000000I'],
  ['eciCivilianCompensationAnnual','CIU1010000000000I'],
  ['productivityAnnual','PRS85006091'],
  ['hoursWorkedQuarterly','PRS85006032'],
  ['nominalHourlyCompensationAnnual','PRS85006101'],
 ]){
  const observation=captured.series[id].observations.find(row=>row.value!==null),csvRow=records.find(row=>row.source_id==='blsDesk'&&row.series_id===id&&row.date===observation.date);
  const {inputReceipts,...original}=JSON.parse(csvRow.observation_metadata);
  assert.deepEqual(original,observation,id+' original observation fields are unchanged');
  const years=[observation.date,observation.baseDate].filter(Boolean).map(date=>Number(date.slice(0,4)));
  const expected=specialist.provenance.filter(receipt=>receipt.requestedSeries.includes(code)&&years.every(year=>year>=receipt.startYear&&year<=receipt.endYear));
  assert.equal(expected.length,1,id+' has one native code/year batch');
  const actual=inputReceipts??specialist.provenance.filter(receipt=>receipt.url===csvRow.source_url&&receipt.sha256===csvRow.source_sha256&&receipt.retrievedAt===csvRow.retrieved_at);
  assert.deepEqual(actual,expected,id+' CSV cites only its native input batch');
  assert.equal(csvRow.source_url,expected[0].url);assert.equal(csvRow.source_sha256,expected[0].sha256);assert.equal(csvRow.retrieved_at,expected[0].retrievedAt);
 }
 const missing=captured.series.payrollAnnual.observations.find(row=>row.value===null);assert.ok(missing);
 assert.equal(records.find(row=>row.source_id==='blsDesk'&&row.series_id==='payrollAnnual'&&row.date===missing.date).value,'');
 for(const receipt of specialist.provenance)assert.ok(records.some(row=>row.record_type==='source-receipt'&&row.source_sha256===receipt.sha256&&row.source_url===receipt.url&&row.retrieved_at===receipt.retrievedAt));
 specialist.series.payrollConstructionAverage12m.observations.at(-1).value=999999;
 const restored=await importResearchPackage(encoded);
 assert.equal(exportResearchPackage(restored),encoded);assert.equal(researchPackageCsv(restored),primaryCsv);assert.equal(generated(restored,'specialist-evidence.csv'),supportingCsv);
 assert.notEqual(restored.context.stitchEvidence.sources.blsDesk.series.payrollConstructionAverage12m.observations.at(-1).value,999999);
});

test('SEP named-table capture preserves all anonymous dots, horizons and receipts outside the comparison selection',async()=>{
 const sources=fomcSources(),pkg=await makePackage(fomcState(),sources,'sep-specialist');
 assert.deepEqual(pkg.request.ids,['policyTargetUpper']);
 assert.deepEqual(pkg.context.stitchEvidence.sources.fedSep.tables,sources.fedSep.tables);
 assert.deepEqual(pkg.context.stitchCalendar,{version:1,asOf:now,source:fomcCalendar});
 const calendarBytes=canonicalJson(pkg.context.stitchCalendar);
 assert.deepEqual(Object.keys(pkg.context.stitchEvidence.sources.fedSep.series),[],'projections never become observed indicator series');
 const content=generated(pkg,'specialist-evidence.csv'),records=rows(content);
 const dots=records.filter(row=>row.record_type==='table-row'&&row.source_id==='fedSep'&&row.series_id==='dots');
 assert.equal(dots.length,sources.fedSep.tables.dots.rows.length);assert.ok(dots.length>4);
 assert.deepEqual(dots.map(row=>JSON.parse(row.source_value)),sources.fedSep.tables.dots.rows);
 assert.ok(dots.some(row=>row.value==='0'),'an actual zero participant count stays zero');
 assert.ok(dots.every(row=>row.observation_type==='official-projection'));
 const complete=records.find(row=>row.record_type==='named-table-capture'&&row.source_id==='fedSep');
 assert.deepEqual(JSON.parse(complete.source_value),sources.fedSep.tables);
 const missingMedian=records.find(row=>row.record_type==='table-row'&&row.series_id==='projections'&&JSON.parse(row.source_value).variable==='corePceInflation'&&row.horizon==='Longer run');
 assert.equal(missingMedian.value,'');
 for(const receipt of sources.fedSep.provenance)assert.ok(records.some(row=>row.record_type==='source-receipt'&&row.source_id==='fedSep'&&row.source_sha256===receipt.sha256&&row.retrieved_at===receipt.retrievedAt));
 const events=records.filter(row=>row.record_type==='calendar-event'),documents=records.filter(row=>row.record_type==='calendar-document-reference');
 assert.deepEqual(events.map(row=>JSON.parse(row.source_value)),fomcCalendar.events);
 assert.deepEqual(documents.map(row=>JSON.parse(row.source_value)),fomcCalendar.documents);
 assert.ok(events.every(row=>row.observation_type==='scheduled-date-only'&&JSON.parse(row.observation_metadata).referenceDay===now.slice(0,10)));
 const receipt=fomcCalendar.provenance[0];
 assert.ok(records.some(row=>row.record_type==='source-receipt'&&row.source_id==='fomc'&&row.source_url===receipt.url&&row.source_sha256===receipt.sha256&&row.retrieved_at===receipt.retrievedAt));
 const encoded=exportResearchPackage(pkg),restored=await importResearchPackage(encoded);
 assert.equal(exportResearchPackage(restored),encoded);assert.equal(generated(restored,'specialist-evidence.csv'),content);
 assert.equal(canonicalJson(restored.context.stitchCalendar),calendarBytes);
});

test('FX frozen packages keep all four anchor families and byte-exact generated CSVs without later live fallback',async()=>{
 const sources=fxSources(),pkg=await makePackage(fxState(),sources,'fx-specialist');
 assert.deepEqual(pkg.request.ids,['fxUsdEur']);
 const frozen=stitchFrozenSources(pkg.context);
 assert.deepEqual(Object.keys(frozen).sort(),['ecbFx','ecbPolicy','fedFx','policyRates']);
 for(const id of ['ecbFx','ecbPolicy','fedFx'])assert.deepEqual(frozen[id],sources[id]);
 assert.deepEqual(frozen.policyRates,sources.policyRates);
 const files=Object.fromEntries(researchPackageAttachments(pkg).map((file,index)=>[file.name,researchPackageAttachment(pkg,index).content]));
 assert.deepEqual(Object.keys(files).sort(),['fx-policy-matrix.csv','fx-sensitivity.csv','specialist-evidence.csv']);
 assert.match(files['fx-policy-matrix.csv'],/scenario-assumption/);assert.match(files['fx-policy-matrix.csv'],/USD per foreign currency/);
 const encoded=exportResearchPackage(pkg),primary=researchPackageCsv(pkg),saved={};
 try{
  for(const [id,source]of Object.entries(sources)){
   saved[id]=dataStatus.sources[id];dataStatus.sources[id]={...source,series:Object.fromEntries(Object.entries(source.series).map(([key,value])=>[key,{...value,observations:[{date:'2030-01-01',value:999999}]}]))};
   for(const value of Object.values(source.series))value.observations.at(-1).value=-999999;
  }
  const restored=await importResearchPackage(encoded);
  assert.equal(exportResearchPackage(restored),encoded);assert.equal(researchPackageCsv(restored),primary);
  assert.deepEqual(stitchFrozenSources(restored.context),frozen);
  for(const [name,content]of Object.entries(files))assert.equal(generated(restored,name),content,name);
  assert.doesNotMatch(generated(restored,'fx-policy-matrix.csv'),/999999/);
 }finally{for(const [id,source]of Object.entries(saved)){if(source===undefined)delete dataStatus.sources[id];else dataStatus.sources[id]=source;}}
});

test('required specialist families reject absent, partial, unrelated and untrusted sources',()=>{
 assert.throws(()=>createStitchEvidence(fomcState(),{}, {preset:'all'}),/source|evidence|capture|missing/i);
 assert.throws(()=>createStitchEvidence(fxState(),{fedFx:copy(market.fedFx)}, {preset:'all'}),/source|evidence|capture|missing/i);
 const wrong={version:1,page:'fomc',scope:'Retained official sources',sources:{fedFx:copy(market.fedFx)}};
 assert.equal(validateStitchEvidence(wrong),false);
 const untrusted=fxSources();untrusted.ecbFx.provenance[0].url='https://example.com/unreviewed-currency-feed';
 assert.throws(()=>createStitchEvidence(fxState(),untrusted,{preset:'all'}),/source|evidence|capture|admission/i);
});

test('checksummed specialist imports still reject forged native values, dot identities, units and missing families',async()=>{
 const pkg=await makePackage(fxState(),fxSources(),'fx-admission');
 for(const change of [
  body=>{delete body.context.stitchEvidence.sources.ecbPolicy;},
  body=>{body.context.stitchEvidence.sources.ecbFx.series.fxUsdEur.unit='EUR per USD';},
  body=>{body.context.stitchEvidence.sources.fedFx.series.fxUsdJpy.observations.at(-1).value=999;},
  body=>{body.context.stitchEvidence.sources.ecbPolicy.provenance[0].url='https://example.com/rate';},
 ])await assert.rejects(importResearchPackage(resealed(pkg,change)),/specialist|native|source|measurement|evidence/i);
 const sep=await makePackage(fomcState(),fomcSources(),'sep-admission');
 await assert.rejects(importResearchPackage(resealed(sep,body=>{body.context.stitchEvidence.sources.fedSep.tables.dots.rows[0].participant='Governor';})),/specialist|native|source|evidence/i);
 await assert.rejects(importResearchPackage(resealed(sep,body=>{body.context.stitchEvidence.sources.fedSep.tables.projections.rows[0].median+=1;})),/specialist|native|source|evidence/i);
 for(const change of [
  body=>{delete body.context.stitchCalendar;},
  body=>{body.context.stitchCalendar.asOf='2026-11-01T00:00:00.000Z';},
  body=>{body.context.stitchCalendar.source.events[0].scheduledAt=body.context.stitchCalendar.source.events[0].date+'T14:00:00.000Z';},
  body=>{body.context.stitchCalendar.source.events[0].meetingDate='2026-01-29';},
  body=>{body.context.stitchCalendar.source.documents[0].url='https://example.com/decision';},
  body=>{body.context.stitchCalendar.source.provenance[0].url='https://example.com/calendar';},
 ])await assert.rejects(importResearchPackage(resealed(sep,change)),/specialist|calendar|source|native/i);
});

test('a genuine legacy package remains byte-identical and gains no live specialist inputs or generated exports',async()=>{
 const directory=new URL('./fixtures/auction-frozen-baseline/',import.meta.url),manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
 const encoded=gunzipSync(await readFile(new URL('default.json.gz',directory))).toString('utf8'),prior=dataStatus.sources.fedSep;
 try{
  dataStatus.sources.fedSep={...copy(market.fedSep),coverageNote:'LIVE SPECIALIST SENTINEL'};
  const pkg=await importResearchPackage(encoded);
  assert.equal(hash(exportResearchPackage(pkg)),manifest.packages.default.jsonSha256);assert.equal(exportResearchPackage(pkg),encoded);
  assert.equal(hash(researchPackageCsv(pkg)),manifest.packages.default.primaryCsvSha256);
  assert.equal(pkg.context.stitchEvidence,undefined);assert.equal(stitchFrozenSources(pkg.context).fedSep,undefined);
  const descriptors=researchPackageAttachments(pkg);assert.deepEqual(descriptors.map(file=>file.name),manifest.packages.default.attachments.map(file=>file.name));
  for(const [index,expected]of manifest.packages.default.attachments.entries())assert.equal(hash(researchPackageAttachment(pkg,index).content),expected.sha256);
  assert.doesNotMatch(exportResearchPackage(pkg),/LIVE SPECIALIST SENTINEL/);
 }finally{if(prior===undefined)delete dataStatus.sources.fedSep;else dataStatus.sources.fedSep=prior;}
});

test('new FX packages reject rechecksummed corruption of supporting administered-rate inputs independently of the primary selection',async()=>{
 const pkg=await makePackage(fxState(),fxSources(),'fx-supporting-admission');
 assert.deepEqual(pkg.request.ids,['fxUsdEur']);
 const changes=[
  body=>{const source=body.context.moduleSources.policyRates;source.series.policyTargetUpper.observations.at(-1).value=999;source.series.policyTargetUpper.unit='USD billions';source.provenance[0].url='https://example.com/unreviewed-policy';},
  body=>{body.context.moduleSources.policyRates.series.policyTargetUpper.observations.at(-1).value=999;},
  body=>{body.context.moduleSources.policyRates.series.policyTargetUpper.unit='USD billions';},
  body=>{body.context.moduleSources.policyRates.series.policyTargetUpper.adjustment='Seasonally adjusted';},
  body=>{body.context.moduleSources.policyRates.series.policyTargetUpper.sourceIds=['EFFR:percentRate'];},
  body=>{body.context.moduleSources.policyRates.series.policyTargetUpper.calculation='Multiply the native policy rate by 1000.';},
  body=>{body.context.moduleSources.policyRates.provenance[0].url='https://example.com/unreviewed-policy';},
  body=>{body.context.moduleSources.policyRates.series.policyTargetUpper.observations.at(-1).sourceUrl='https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip';},
  body=>{const row=body.context.moduleSources.policyRates.series.policyTargetLower.observations.at(-1);row.value=100;row.sourceValue='100';},
  body=>{delete body.context.moduleSources.policyRates;},
  body=>{delete body.context.moduleSources.policyRates.series.iorb;},
  body=>{body.context.moduleSources.bls=copy(dataStatus.sources.bls);},
 ];
 for(const change of changes)await assert.rejects(importResearchPackage(resealed(pkg,change)),/specialist supporting source|native|lineage/i);
 const missing=fxSources();delete missing.policyRates;
 assert.throws(()=>pin(fxState(),missing),/supporting inputs|native|receipt|lineage/i);
});

test('every new desk validates its exact required legacy families and reconstructs native statistical, funding and Treasury calculations',()=>{
 const context=page=>({stitchEvidence:{page},moduleSources:Object.fromEntries(stitchDeskContracts[page].sources.filter(id=>!stitchEvidenceSourceIds.includes(id)).map(id=>[id,copy(dataStatus.sources[id])]))});
 for(const page of Object.keys(stitchDeskContracts))assert.equal(validateStitchLegacySources(context(page)),true,page+' genuine captured supporting families');
 const changes=[
  ['fomc',sources=>{sources.bls.series.payroll.observations.at(-1).value+=1;}],
  ['fomc',sources=>{sources.bls.series.payrollAverage3m.observations.at(-1).inputValues[0]+=1;}],
  ['fomc',sources=>{sources.bea.series.pce.observations.at(-1).value+=1;}],
  ['fomc',sources=>{sources.bea.series.pceAnnualized3m.observations.at(-1).value+=1;}],
  ['dealers',sources=>{sources.marketFunctioning.series.dealerNetTreasury.observations.at(-1).value+=1;}],
  ['money',sources=>{sources.marketFunctioning.series.sofrEffrSpread.observations.at(-1).value+=1;}],
  ['money',sources=>{sources.marketFunctioning.fundingRates.effr.at(-1).value+=1;}],
  ['qt',sources=>{sources.fedBalance.series.fedAssets.observations.at(-1).value+=1;}],
  ['qt',sources=>{sources.onRrp.series.onRrpAccepted.observations.at(-1).value+=1;}],
  ['qt',sources=>{sources.onRrp.series.onRrpAccepted.observations.at(-1).termCalendarDays=30;}],
  ['tips',sources=>{sources.yields.series.inflationComp10.observations.at(-1).value+=1;}],
  ['tips',sources=>{const row=sources.yields.series.realYield10.observations.at(-1),wrong=sources.yields.provenance.find(r=>r.url.includes('.csv/2003/all')&&r.url.includes('real_yield_curve')).url;row.sourceUrl=wrong;row.sourceUrls=[wrong];}],
  ['tips',sources=>{const row=sources.yields.series.realYield10.observations.at(-1),wrong=sources.yields.provenance.find(r=>r.url.includes('.csv/'+row.date.slice(0,4)+'/all')&&new URL(r.url).searchParams.get('type')==='daily_treasury_yield_curve').url;row.sourceUrl=wrong;row.sourceUrls=[wrong];}],
  ['tips',sources=>{sources.yields.curveHistory.find(row=>row.nominalSupplements).nominalSupplements['3M'].value=99;}],
  ['tips',sources=>{sources.yields.h15GapEvidence.curves[0].nominalSupplements['3M'].sourceSha256='f'.repeat(64);}],
  ['tips',sources=>{sources.yields.h15GapEvidence.curves[0].nominalSupplements['3M'].primarySourceUrl='https://example.com/primary';}],
  ['tips',sources=>{sources.yields.h15GapEvidence.curves[0].nominal['10Y']+=1;}],
  ['tips',sources=>{sources.treasury.series.yield.observations.at(-1).value+=1;}],
  ['tips',sources=>{sources.auctions.auctions[0].allocations.primaryDealerShare+=1;}],
  ['refunding',sources=>{sources.refinancing.securities[0].principal+=1;}],
  ['refunding',sources=>{sources.auctions.series.auctionOfferingMonthly.observations.at(-1).value+=1;}],
  ['debtCeiling',sources=>{sources.treasury.series.debt.observations.at(-1).value+=1;}],
  ['wedge',sources=>{sources.pcePriceContributions.series.pceGoodsPriceContribution.observations.at(-1).value+=1;}],
 ];
 for(const [page,mutate]of changes){const value=context(page);mutate(value.moduleSources);assert.equal(validateStitchLegacySources(value),false,page+' changed native calculation rejected');}
 for(const page of Object.keys(stitchDeskContracts)){
  const value=context(page),id=Object.keys(value.moduleSources)[0];
  delete value.moduleSources[id];assert.equal(validateStitchLegacySources(value),false,page+' missing supporting family rejected');
 }
});
