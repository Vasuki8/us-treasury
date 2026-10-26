import test from 'node:test';
import assert from 'node:assert/strict';
import * as adapter from '../scripts/sources/yields.mjs';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {parseCsv} from '../scripts/sources/http.mjs';
import {yieldCurvesCsv} from '../src/yields-page.js';
import {selectCurveOverlays} from '../src/yields.js';
import {toCsv} from '../src/model.js';
import {registry} from '../src/registry.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {buildPinContext} from '../src/research-context.js';
import {parseRoute} from '../src/router.js';
import {recordVintages,asKnownOn} from '../src/vintages.js';

const h15Url='https://www.federalreserve.gov/datadownload/Output.aspx?rel=H15&series=bf17364827e38702b42a58cf8eaa3f78&lastobs=&from=&to=&filetype=csv&label=include&layout=seriescolumn&type=package';
const dates=['2008-12-10','2008-12-18','2008-12-24'];
const codes=['RIFLGFCM01_N.B','RIFLGFCM03_N.B','RIFLGFCM06_N.B','RIFLGFCY01_N.B','RIFLGFCY02_N.B','RIFLGFCY03_N.B','RIFLGFCY05_N.B','RIFLGFCY07_N.B','RIFLGFCY10_N.B','RIFLGFCY20_N.B','RIFLGFCY30_N.B'];
const descriptions=['1-month','3-month','6-month','1-year','2-year','3-year','5-year','7-year','10-year','20-year','30-year'].map(term=>`Market yield on U.S. Treasury securities at ${term}  constant maturity, quoted on investment basis`);
const csvRow=values=>values.map(v=>`"${v}"`).join(',');
const h15=[csvRow(['Series Description',...descriptions]),csvRow(['Unit:',...codes.map(()=>'Percent:_Per_Year')]),csvRow(['Multiplier:',...codes.map(()=>'1')]),csvRow(['Currency:',...codes.map(()=>'NA')]),csvRow(['Unique Identifier:',...codes.map(c=>'H15/H15/'+c)]),csvRow(['Time Period',...codes]),'2008-12-10,0.00,0.00,0.21,0.49,0.86,1.21,1.62,2.05,2.69,3.39,3.09','2008-12-18,0.03,0.00,0.15,0.43,0.68,0.92,1.26,1.59,2.08,2.86,2.53','2008-12-24,0.00,0.00,0.23,0.40,0.90,1.14,1.54,1.83,2.20,2.94,2.63','2010-10-11,ND,ND,ND,ND,ND,ND,ND,ND,ND,ND,ND'].join('\n');
const nominal2008='Date,1 Mo,3 Mo,6 Mo,1 Yr,2 Yr,3 Yr,5 Yr,7 Yr,10 Yr,20 Yr,30 Yr\n12/10/2008,0,N/A,0.21,0.49,0.86,1.21,1.62,2.05,2.69,3.39,3.09\n12/18/2008,0.03,N/A,0.15,0.43,0.68,0.92,1.26,1.59,2.08,2.86,2.53\n12/24/2008,0,N/A,0.23,0.4,0.9,1.14,1.54,1.83,2.2,2.94,2.63\n';
function fixture({supplement=h15,nominal=nominal2008,calls=[]}={}){return async url=>{calls.push(url);if(url===h15Url)return new Response(supplement);const u=new URL(url),year=Number(u.searchParams.get('field_tdr_date_value')),real=u.searchParams.get('type').includes('real'),day=year===2026?'10/21':'12/31';return new Response(year===2008&&!real?nominal:real?`Date,10 YR\n${day}/${year},1.5\n`:`Date,3 Mo,2 Yr,10 Yr,30 Yr\n${day}/${year},3.2,3.8,4.2,N/A\n`);};}
const collect=options=>adapter.collectYields({fetchImpl:fixture(options),now:new Date('2026-10-26T23:00:00Z')});

test('official H15 supplies only the three reviewed missing 3M CMT values and keeps both input receipts',async()=>{
 const calls=[],source=await collect({calls});
 assert.equal(calls.filter(url=>url===h15Url).length,1);
 for(const date of dates){const curve=source.curveHistory.find(r=>r.date===date),supplement=curve.nominalSupplements?.['3M'];assert.equal(curve.nominal['3M'],0);assert.equal(supplement.primaryValue,null);assert.equal(supplement.sourceValue,'0.00');assert.equal(supplement.sourceUrl,h15Url);assert.equal(supplement.sourceSeriesId,'RIFLGFCM03_N.B');assert.equal(supplement.primarySourceUrl,adapter.treasuryParYieldUrl(2008));assert.ok(source.provenance.some(r=>r.url===h15Url&&r.sha256===supplement.sourceSha256&&r.retrievedAt===supplement.retrievedAt));for(const id of ['nominalYield3m','spread3m10y']){const row=source.series[id].observations.find(r=>r.date===date);assert.equal(row.value,id==='nominalYield3m'?0:Number((curve.nominal['10Y']*100).toFixed(10)));assert.deepEqual(row.sourceUrls,[adapter.treasuryParYieldUrl(2008),h15Url]);assert.equal(row.publishedAt,null);}}
 assert.equal(source.curveHistory.find(r=>r.date==='2003-12-31').nominal['30Y'],null);
 assert.equal(source.curveHistory.find(r=>r.date==='2010-12-31').nominal['3M'],3.2);
 assert.doesNotThrow(()=>assertCommercialData({sources:{yields:source}}));
});

test('H15 supplements fail closed for mismatched controls, nonzero replacement, metadata, duplicates and unavailable evidence',async()=>{
 for(const supplement of [h15.replace('2.69,3.39','2.68,3.39'),h15.replace('2008-12-10,0.00,0.00','2008-12-10,0.00,0.01'),h15.replace('Percent:_Per_Year','Basis points'),h15+'\n'+h15.split('\n')[6],h15.replace('2008-12-24','2008-12-23'),''])await assert.rejects(collect({supplement}),/H15|H\.15|supplement|constant.maturity/i);
 const noGap=await collect({nominal:nominal2008.replaceAll('N/A','0'),supplement:''});
 assert.ok(!noGap.provenance.some(r=>r.url===h15Url),'An already published Treasury zero needs no supplement');
});

test('H15 admission rejects a forged date, altered value, missing primary null and use for another measure',async()=>{
 const source=await collect();
 for(const mutate of [s=>{s.curveHistory.find(r=>r.nominalSupplements).nominalSupplements['3M'].primaryValue=0;},s=>{s.series.nominalYield3m.observations.find(r=>r.date===dates[0]).date='2008-12-11';},s=>{s.series.nominalYield3m.observations.find(r=>r.date===dates[0]).value=1;},s=>{s.series.nominalYield2.observations[0].sourceUrls.push(h15Url);},s=>{s.provenance=s.provenance.filter(r=>r.url!==h15Url);}]){const invalid=structuredClone(source);mutate(invalid);assert.throws(()=>assertCommercialData({sources:{yields:invalid}}),/H15|yield|provenance|supplement/i);}
});

test('selected curves and their CSV preserve the exact supplemental 3M receipt without changing other tenor receipts',async()=>{
 const source={...await collect(),status:'ok'},curves=selectCurveOverlays(source,[dates[0]]);
 assert.equal(curves[0].nominalSupplements['3M'].primaryValue,null);
 const [header,...rows]=parseCsv(yieldCurvesCsv(source,{yieldDateA:dates[0],yieldDateB:dates[0]})),records=rows.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]])));
 const three=records.find(r=>r.tenor==='3M'&&r.measure==='nominal');assert.equal(three.value,'0');assert.ok(JSON.parse(three.input_provenance).some(r=>r.url===h15Url));assert.match(three.source,/Federal Reserve/);
 const ten=records.find(r=>r.tenor==='10Y'&&r.measure==='nominal');assert.ok(!JSON.parse(ten.input_provenance).some(r=>r.url===h15Url));
});

test('supplement admission requires real receipt clocks and prevents explicit-row evidence from bypassing both inputs',async()=>{
 const source=await collect();
 for(const mutate of [s=>{s.series.nominalYield3m.observations.find(r=>r.date===dates[0]).inputProvenance=[s.provenance[0]];},s=>{const m=s.curveHistory.find(r=>r.nominalSupplements).nominalSupplements['3M'];m.retrievedAt=s.provenance.find(r=>r.url===h15Url).retrievedAt='2099-01-01T00:00:00.000Z';},s=>{const m=s.curveHistory.find(r=>r.nominalSupplements).nominalSupplements['3M'];m.sourceSha256=s.provenance.find(r=>r.url===h15Url).sha256='invalid';},s=>{delete s.series.nominalYield3m.inputProvenanceScope;}]){const invalid=structuredClone(source);mutate(invalid);assert.throws(()=>assertCommercialData({sources:{yields:invalid}}),/H15|yield|provenance|supplement/i);}
});

test('recovered indicator CSV and selected-curve frozen inputs retain the H15 identifier and roundtrip',async()=>{
 const source={...await collect(),status:'ok'},catalog=Object.fromEntries(Object.entries(source.series).map(([id,item])=>[id,{...registry[id],...item,source:{...registry[id].source,seriesIds:item.sourceIds},fetchedAt:source.fetchedAt,provenance:source.provenance}]));
 const [header,...rows]=parseCsv(toCsv(['nominalYield3m','spread3m10y'],{catalog,range:{preset:'custom',startDate:dates[0],endDate:dates[2]}}));
 for(const fields of rows){const row=Object.fromEntries(header.map((h,i)=>[h,fields[i]]));assert.match(row.source_notes,/RIFLGFCM03_N.B/);assert.deepEqual(JSON.parse(row.capture_provenance_json).map(r=>r.url),[adapter.treasuryParYieldUrl(2008),h15Url]);assert.equal(row.publication_date,'');}
 const args=buildPinContext(parseRoute('#/yields?window=custom&start=2008-12-10&end=2008-12-24&curveA=2008-12-10&curveB=2008-12-18'),{catalog,sources:{yields:source}}),pkg=await createResearchPackage({name:'Recovered Treasury CMT evidence',...args}),text=exportResearchPackage(pkg);
 assert.equal(exportResearchPackage(await importResearchPackage(text)),text);
 assert.ok(pkg.context.moduleSources.yields.provenance.some(r=>r.url===h15Url));
 assert.equal(pkg.context.moduleSources.yields.curveHistory[0].nominalSupplements['3M'].primaryValue,null);
 assert.match(pkg.context.attachments[0].content,/RIFLGFCM03_N.B/);
});

test('H15 evidence survives immutable vintage normalization and strict replay admission without changing an old capture',async()=>{
 const next=await collect(),old=structuredClone(next);old.fetchedAt='2026-10-25T12:00:00.000Z';old.provenance=old.provenance.filter(r=>r.url!==h15Url).map(r=>({...r,retrievedAt:old.fetchedAt}));delete old.h15GapEvidence;
 for(const curve of old.curveHistory)if(curve.nominalSupplements){curve.nominal['3M']=null;delete curve.nominalSupplements;}
 for(const id of ['nominalYield3m','spread3m10y'])for(const row of old.series[id].observations)if(dates.includes(row.date)){row.value=null;row.sourceUrls=row.sourceUrls.filter(url=>url!==h15Url);delete row.sourceValue;delete row.primaryValue;delete row.footnotes;}
 const before=recordVintages(null,{}, {yields:old},{checkedAt:old.fetchedAt}),bytes=JSON.stringify(before.captures),after=recordVintages(before,{yields:old},{yields:next},{checkedAt:next.fetchedAt}),replay=asKnownOn(after,next.fetchedAt).sources.yields;
 assert.equal(JSON.stringify(after.captures.slice(0,before.captures.length)),bytes);
 assert.doesNotThrow(()=>assertCommercialData({sources:{yields:replay}}));
 assert.doesNotThrow(()=>assertCommercialData({sources:{yields:next},vintages:after}));
 assert.equal(replay.h15GapEvidence.version,1);assert.equal(replay.h15GapEvidence.curves.length,3);
 assert.equal(replay.h15GapEvidence.curves[0].nominalSupplements['3M'].primaryValue,null);
 const invalid=structuredClone(replay);invalid.h15GapEvidence.version=2;assert.throws(()=>assertCommercialData({sources:{yields:invalid}}),/H15|supplement/i);
});

test('current and replayed H15 admission require finite numeric 2Y and 10Y controls before deriving a spread',async()=>{
 const current=await collect(),archive=recordVintages(null,{}, {yields:current},{checkedAt:current.fetchedAt}),replayed=asKnownOn(archive,current.fetchedAt).sources.yields;
 for(const [kind,source]of [['current',current],['replayed',replayed]])for(const tenor of ['2Y','10Y'])for(const invalid of [undefined,null,'2.69',NaN]){
  const altered=structuredClone(source),evidence=altered.h15GapEvidence.curves.find(r=>r.date===dates[0]),curve=altered.curveHistory?.find(r=>r.date===dates[0]);
  for(const row of [evidence,curve].filter(Boolean)){if(invalid===undefined)delete row.nominal[tenor];else row.nominal[tenor]=invalid;}
  if(tenor==='10Y')altered.series.spread3m10y.observations.find(r=>r.date===dates[0]).value=Number.isFinite(Number(invalid))?Number(invalid)*100:0;
  assert.throws(()=>assertCommercialData({sources:{yields:altered}}),/H15|supplement/i,`${kind} ${tenor} control ${String(invalid)}`);
 }
});

test('scoped yield sources admit exactly the H15 evidence needed by registered inputs and selected overlays',async()=>{
 const source={...await collect(),status:'ok'},catalog=Object.fromEntries(Object.entries(source.series).map(([id,item])=>[id,{...registry[id],...item,source:{...registry[id].source,seriesIds:item.sourceIds},fetchedAt:source.fetchedAt,provenance:source.provenance}]));
 for(const [window,expected]of [['custom&start=2008-12-10&end=2008-12-24',dates],['1y',dates.slice(0,2)]]){
  const args=buildPinContext(parseRoute(`#/yields?window=${window}&curveA=2008-12-10&curveB=2008-12-18`),{catalog,sources:{yields:source}}),scoped=args.context.moduleSources.yields;
  assert.doesNotThrow(()=>assertCommercialData({sources:args.context.moduleSources}));
  assert.deepEqual(scoped.curveHistory.map(r=>r.date),dates.slice(0,2));
  assert.equal(scoped.h15GapEvidence.version,2);assert.equal(scoped.h15GapEvidence.scope,'selected-inputs');
  assert.deepEqual(scoped.h15GapEvidence.curves.map(r=>r.date),expected);
  assert.deepEqual(scoped.h15GapEvidence.overlayDates,dates.slice(0,2));
  assert.ok(scoped.provenance.some(r=>r.url===h15Url));
  const missing=structuredClone(scoped);missing.h15GapEvidence.curves.pop();assert.throws(()=>assertCommercialData({sources:{yields:missing}}),/H15|supplement/i);
  const altered=structuredClone(scoped);altered.curveHistory[0].nominal['3M']=1;assert.throws(()=>assertCommercialData({sources:{yields:altered}}),/H15|supplement/i);
 }
});
