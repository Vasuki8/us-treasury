import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseReferenceRates,collectMarketFunctioning} from '../scripts/sources/market-functioning.mjs';
import {matchesMarketFeed,assertMarketData} from '../scripts/market-policy.mjs';
import {recordVintages,asKnownOn} from '../src/vintages.js';

const fixture=JSON.parse(await readFile(new URL('./fixtures/nyfed-funding-history.json',import.meta.url),'utf8'));
const dealerKeys=['PDPOSGST-TOT','PDSORA-UTSETTOT','PDSIRRA-UTSETTOT','PDFTD-USTET','PDFTR-USTET'];
const nativeUrl=kind=>`https://markets.newyorkfed.org/api/rates/${kind==='sofr'?'secured/sofr':'unsecured/effr'}/search.json?startDate=${kind==='sofr'?'2018-04-02':'2016-03-01'}&endDate=2026-10-26`;
const fetchFixture=async url=>{
 const path=new URL(url).pathname;
 const payload=path.includes('seriesbreaks')?{pd:{seriesbreaks:[{seriesbreak:'SBN2024',startdate:'2024-07-03',enddate:'9999-12-31'}]}}
  :path.includes('/pd/get/')?{pd:{timeseries:dealerKeys.flatMap(keyid=>[{asofdate:'2026-10-07',keyid,value:'1000'},{asofdate:'2026-10-14',keyid,value:keyid==='PDSORA-UTSETTOT'?'*':'1000'}])}}
  :path.includes('/sofr/')?fixture.sofr:{refRates:[...fixture.effr.refRates,fixture.holidayEffr,fixture.surveyEffr]};
 return new Response(JSON.stringify(payload));
};
const captured=()=>collectMarketFunctioning({fetchImpl:fetchFixture,now:new Date('2026-10-26T23:00:00Z')});

test('official SOFR history retains survey-contingency medians and volume while leaving all missing percentiles null',()=>{
 const rows=parseReferenceRates(fixture.sofr,'SOFR');
 assert.equal(rows.length,6);assert.equal(rows[0].date,'2018-04-02');assert.equal(rows[0].value,1.8);
 for(const [date,median,volume] of [['2019-05-31',2.49,1136],['2021-08-05',.05,901]]){
  const row=rows.find(row=>row.date===date);
  assert.equal(row.value,median);assert.equal(row.volumeInBillions,volume);assert.equal(row.footnoteId,2);
  assert.deepEqual([row.percentile1,row.percentile25,row.percentile75,row.percentile99],[null,null,null,null]);
  assert.deepEqual(row.percentileSourceValues,{percentile1:'NA',percentile25:'NA',percentile75:'NA',percentile99:'NA'});
  assert.match(row.footnotes.join(' '),/survey data.*percentile statistics were not published/i);
 }
 assert.ok(rows.every(row=>row.publishedAt===null));assert.equal(Object.hasOwn(rows[0],'footnoteId'),false);
});

test('official modern EFFR preserves its raw revised marker and reduced-volume source note',()=>{
 const rows=parseReferenceRates(fixture.effr,'EFFR'),revised=rows.find(row=>row.date==='2017-05-31'),reduced=rows.find(row=>row.date==='2023-07-25');
 assert.equal(rows.length,6);assert.equal(rows[0].date,'2016-03-01');assert.equal(rows[0].value,.36);
 assert.equal(revised.revisionIndicator,'r');assert.match(revised.footnotes.join(' '),/r.*Revised/);
 assert.equal(reduced.footnoteId,1);assert.equal(reduced.volumeInBillions,89);assert.match(reduced.footnotes.join(' '),/reduced volume/);
 assert.ok(rows.every(row=>row.publishedAt===null));
});

test('source missing markers cannot become numeric medians, volumes or unsupported contingency stories',()=>{
 const survey=fixture.sofr.refRates.find(row=>row.footnoteId===2);
 for(const mutate of [row=>{row.percentRate='NA';},row=>{row.volumeInBillions='NA';},row=>{delete row.footnoteId;},row=>{row.footnoteId=1;},row=>{row.footnoteId=3;},row=>{row.footnoteId='2';},row=>{row.footnoteId=99;},row=>{row.percentPercentile25=0.05;},row=>{row.type='EFFR';},row=>{delete row.revisionIndicator;}]){
  const row=structuredClone(survey);mutate(row);assert.throws(()=>parseReferenceRates({refRates:[row]},'SOFR'));
 }
 for(const [type,date] of [['SOFR','2018-04-01'],['EFFR','2016-02-29']]){
  const row={...fixture[type.toLowerCase()].refRates.at(-1),effectiveDate:date};
  assert.throws(()=>parseReferenceRates({refRates:[row]},type),/inception|methodology|coverage/i);
 }
});

test('funding collector uses native rate histories independently from dealer coverage and reconciles the 2019 repo episode',async()=>{
 const source=await captured();assert.doesNotThrow(()=>assertMarketData(source));
 assert.equal(source.series.sofr.sourceUrl,nativeUrl('sofr'));assert.equal(source.series.effr.sourceUrl,nativeUrl('effr'));
 assert.equal(source.coverageStart,'2024-07-03');assert.equal(source.structuralBreak,'SBN2024');
 assert.equal(source.series.sofr.observations[0].date,'2018-04-02');assert.equal(source.series.effr.observations[0].date,'2016-03-01');
 assert.equal(source.series.sofrEffrSpread.observations[0].date,'2018-04-02');
 assert.equal(source.series.sofr.observations.find(row=>row.date==='2019-09-17').value,5.25);
 assert.equal(source.series.effr.observations.find(row=>row.date==='2019-09-17').value,2.30);
 assert.equal(source.series.sofrEffrSpread.observations.find(row=>row.date==='2019-09-17').value,295);
 assert.equal(source.series.sofrEffrSpread.observations.find(row=>row.date==='2018-12-05').value,null);
 const surveySpread=source.series.sofrEffrSpread.observations.find(row=>row.date==='2019-05-31');
 assert.equal(source.series.effr.observations.find(row=>row.date==='2019-05-31').value,2.40);
 assert.equal(surveySpread.value,9);assert.deepEqual(surveySpread.footnotes,['SOFR: Rate was calculated using survey data; percentile statistics were not published.']);
 assert.equal(Object.hasOwn(surveySpread,'percentileSourceValues'),false);
 assert.equal(source.series.dealerRepo.observations.at(-1).value,null);assert.equal(source.series.dealerRepo.observations.at(-1).suppressed,true);
 assert.ok(Object.values(source.series).every(series=>series.observations.every(row=>row.publishedAt===null)));
 assert.ok(source.provenance.every(receipt=>/^[a-f0-9]{64}$/.test(receipt.sha256)));
});

test('feed admission accepts exact native and legacy histories but rejects swapped, arbitrary or duplicate date ranges',()=>{
 for(const kind of ['sofr','effr']){
  const url=nativeUrl(kind);assert.equal(matchesMarketFeed(url,`nyfed-${kind}`),true);
  assert.equal(matchesMarketFeed(url.replace(kind==='sofr'?'2018-04-02':'2016-03-01','2024-07-03'),`nyfed-${kind}`),true);
  for(const bad of [url.replace(kind==='sofr'?'2018-04-02':'2016-03-01',kind==='sofr'?'2016-03-01':'2018-04-02'),url.replace('startDate=','startDate=2020-01-01&ignored='),url+'&startDate=2018-04-02',url.replace('2026-10-26','2010-01-01')])assert.equal(matchesMarketFeed(bad,`nyfed-${kind}`),false,bad);
 }
});

test('native admission binds row dates, contingency meaning and revision provenance to each exact reviewed input',async()=>{
 const valid=await captured();
 for(const mutate of [
  source=>{source.series.sofr.observations[0].date='2018-04-01';},
  source=>{source.series.effr.observations[0].date='2016-02-29';},
  source=>{source.series.sofrEffrSpread.observations[0].date='2017-05-31';},
  source=>{source.series.dealerNetTreasury.observations[0].date='2019-09-17';},
  source=>{source.series.sofr.sourceUrl=nativeUrl('effr');},
  source=>{source.series.effr.observations.find(row=>row.revisionIndicator==='r').revisionIndicator='R';},
  source=>{source.series.sofr.observations.find(row=>row.footnoteId===2).footnotes=['Rate was calculated with reduced volume.'];},
  source=>{source.series.sofr.observations.find(row=>row.footnoteId===2).percentile25=.05;},
  source=>{source.series.sofr.observations.find(row=>row.footnoteId===2).footnoteId=1;},
  source=>{const row=source.series.sofr.observations.find(row=>row.footnoteId===2);row.percentileSourceValues={percentile1:'NA',percentile25:'0.05',percentile75:'NA',percentile99:'NA'};},
  source=>{source.series.sofr.observations.find(row=>row.footnoteId===2).percentileSourceValues={percentile1:'NA',percentile25:'NA',percentile75:'NA'};},
  source=>{source.series.effr.observations[0].percentileSourceValues={percentile1:'NA',percentile25:'NA',percentile75:'NA',percentile99:'NA'};},
  source=>{source.series.sofrEffrSpread.observations.find(row=>row.date==='2019-05-31').footnotes=['EFFR: Rate was calculated with reduced volume.'];},
  source=>{delete source.series.sofrEffrSpread.observations.find(row=>row.date==='2019-05-31').footnotes;},
  source=>{source.series.sofr.observations[0].date='2018-02-30';},
  source=>{source.provenance.find(row=>row.url.includes('/sofr/')).url+='&extra=1';},
 ]){const source=structuredClone(valid);mutate(source);assert.throws(()=>assertMarketData(source));}
 const legacy=structuredClone(valid),replace=url=>url.replace('startDate=2018-04-02','startDate=2024-07-03').replace('startDate=2016-03-01','startDate=2024-07-03');
 for(const receipt of legacy.provenance)receipt.url=replace(receipt.url);
 for(const series of Object.values(legacy.series)){series.sourceUrl=replace(series.sourceUrl);if(series.sourceUrls)series.sourceUrls=series.sourceUrls.map(replace);series.observations=series.observations.filter(row=>row.date>='2024-07-03');}
 for(const kind of ['sofr','effr'])legacy.fundingRates[kind]=legacy.fundingRates[kind].filter(row=>row.date>='2024-07-03');
 assert.doesNotThrow(()=>assertMarketData(legacy));
 const beforeQuery=structuredClone(legacy);beforeQuery.series.effr.observations[0].date='2020-03-16';assert.throws(()=>assertMarketData(beforeQuery));
});

test('immutable normalization preserves native source floors, missing-marker evidence and derived source notes',async()=>{
 const source=await captured(),history=recordVintages(null,{}, {marketFunctioning:source},{checkedAt:source.fetchedAt});
 const replay=asKnownOn(history,source.fetchedAt).sources.marketFunctioning;
 assert.doesNotThrow(()=>assertMarketData(replay));assert.equal(replay.coverageStart,'2024-07-03');
 assert.equal(replay.series.effr.observations[0].date,'2016-03-01');assert.equal(replay.series.sofr.observations[0].date,'2018-04-02');
 for(const id of ['sofr','effr','sofrEffrSpread'])assert.deepEqual(replay.series[id].observations,source.series[id].observations);
 assert.match(replay.series.sofr.coverageNote,/2018-04-02/);assert.match(replay.series.effr.coverageNote,/2016-03-01/);
});

test('detached supplemental rates cannot erase displayed contingency evidence or license removal of spread notes',async()=>{
 const source=await captured();source.fundingRates.sofr=structuredClone(source.fundingRates.sofr);
 for(const row of source.fundingRates.sofr.filter(row=>row.footnoteId===2)){
  delete row.footnoteId;delete row.footnotes;delete row.percentileSourceValues;
 }
 for(const row of source.series.sofrEffrSpread.observations.filter(row=>['2019-05-31','2021-08-05'].includes(row.date)))delete row.footnotes;
 assert.equal(source.series.sofr.observations.find(row=>row.date==='2019-05-31').footnoteId,2);
 assert.throws(()=>assertMarketData(source),/contradict|disagree|duplicate/i);
});

test('duplicate funding inputs must agree on numeric and source evidence while scoped absent dates can use supplemental rows',async()=>{
 const original=await captured();
 for(const mutate of [
  source=>{source.fundingRates.sofr.find(row=>row.date==='2019-05-31').volumeInBillions+=1;},
  source=>{delete source.fundingRates.sofr.find(row=>row.date==='2019-05-31').percentileSourceValues;},
  source=>{source.series.sofr.observations.find(row=>row.date==='2019-05-31').value=2.50;},
  source=>{const row=source.fundingRates.effr.find(row=>row.revisionIndicator==='r');row.revisionIndicator='';delete row.footnotes;},
 ]){
  const source=structuredClone(original);source.fundingRates=structuredClone(source.fundingRates);mutate(source);
  assert.throws(()=>assertMarketData(source),/contradict|disagree|duplicate/i);
 }
 const reordered=structuredClone(original);reordered.fundingRates.sofr=reordered.fundingRates.sofr.map(row=>Object.fromEntries(Object.entries(row).reverse().map(([key,value])=>[key,key==='percentileSourceValues'?Object.fromEntries(Object.entries(value).reverse()):value])));
 assert.doesNotThrow(()=>assertMarketData(reordered));
 const scoped=structuredClone(original);scoped.series.sofr.observations=scoped.series.sofr.observations.filter(row=>row.date!=='2019-05-31');
 assert.doesNotThrow(()=>assertMarketData(scoped));
});
