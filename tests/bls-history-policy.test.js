import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../scripts/bls-history-policy.mjs';
import {BLS_API_V1 as V1,BLS_API_V2 as V2} from '../scripts/bls-api-policy.mjs';
import {BLS_IDS,BLS_DEPTH_IDS,parseBls,parseBlsEconomicDepth} from '../scripts/sources/bls.mjs';
import {addMomentumSeries} from '../src/momentum.js';
import {assertMacroCoverageData} from '../scripts/macro-coverage-policy.mjs';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {assertVintageData} from '../scripts/vintage-policy.mjs';
import {canPublishCachedBlsData} from '../scripts/sources/refresh.mjs';
import {recordVintages,asKnownOn} from '../src/vintages.js';

const startsV1={unrate:'1948-01-01',cpiIndex:'1913-01-01',cpiCoreIndex:'1957-01-01',cpiSaIndex:'1947-01-01',cpiCoreSaIndex:'1957-01-01'};
const codesV1={unrate:'LNS14000000',cpiIndex:'CUUR0000SA0',cpiCoreIndex:'CUUR0000SA0L1E',cpiSaIndex:'CUSR0000SA0',cpiCoreSaIndex:'CUSR0000SA0L1E'};
const outputsV1=['unrate','cpi','cpiIndex','cpiCoreIndex','cpiSaIndex','cpiCoreSaIndex','cpiCore','cpiMonthly','cpiCoreMonthly','cpiAnnualized3m','cpiAnnualized6m','cpiCoreAnnualized3m','cpiCoreAnnualized6m'];
const laborOutputs=['payrollLevel','payroll','payrollAverage3m','participation','employmentPopulation','underemployment'];
const startsV2={...startsV1,payrollLevel:'1939-01-01',participation:'1948-01-01',employmentPopulation:'1948-01-01',underemployment:'1994-01-01'};
const codesV2={...codesV1,payrollLevel:'CES0000000001',participation:'LNS11300000',employmentPopulation:'LNS12300000',underemployment:'LNS13327709'};
const profileV1={version:1,scope:'unemployment-cpi',firstPeriods:startsV1,contextYears:1};
const profileV2={version:2,scope:'unemployment-cpi-core-labor',firstPeriods:startsV2,contextYears:1};
const outputsV2=[...outputsV1,...laborOutputs];
const stamp='2026-10-25T12:00:00.000Z';

// The real parsers supply the full existing BLS family. Two native years are
// enough to exercise admission, annual-growth inputs and momentum warm-up.
function fixture(version=2,fetchedAt=stamp){
 const starts=version===1?startsV1:startsV2,codes=version===1?codesV1:codesV2,outputs=new Set(version===1?outputsV1:outputsV2);
 const births=new Map(Object.entries(codes).map(([id,code])=>[code,Number(starts[id].slice(0,4))]));
 const native=[...new Set([...Object.values(BLS_IDS),...Object.values(BLS_DEPTH_IDS)])],quarterly=new Set(['CIS1010000000000I','PRS85006092','PRS85006112']);
 const payload={status:'REQUEST_SUCCEEDED',message:[],Results:{series:native.map(seriesID=>{
  const born=births.get(seriesID)??2017,data=[];
  for(let year=born;year<=born+1;year++)for(let month=1;month<=12;month++){
   if(quarterly.has(seriesID)&&![1,4,7,10].includes(month))continue;
   data.push({year:String(year),period:quarterly.has(seriesID)?`Q0${(month-1)/3+1}`:`M${String(month).padStart(2,'0')}`,value:String(100+(year-born)*12+month),footnotes:[]});
  }
  return {seriesID,data};
 })}};
 const receipts=new Map([...births].map(([code,born],index)=>[code,{url:V2,retrievedAt:fetchedAt,sha256:(index+1).toString(16).repeat(64),startYear:born,endYear:born+1,seriesIds:[code]}]));
 const current={url:V1,retrievedAt:fetchedAt,sha256:'f'.repeat(64),startYear:2017,endYear:2018,seriesIds:native};
 const series={...parseBls(payload),...parseBlsEconomicDepth(payload)};
 for(const [id,value]of Object.entries(series)){
  const receipt=outputs.has(id)?receipts.get(value.sourceIds[0]):current;
  value.sourceUrl=receipt.url;
  if(outputs.has(id)){
   value.inputProvenanceScope='observation-source-urls';
   value.observations=value.observations.map(row=>({...row,sourceUrl:receipt.url,retrievedAt:receipt.retrievedAt,sourceSha256:receipt.sha256}));
  }
 }
 return addMomentumSeries({id:'bls',status:'ok',fetchedAt,historyProfile:structuredClone(version===1?profileV1:profileV2),series,provenance:[...receipts.values(),current],warnings:[]});
}

test('exact historical markers select their own unchanged version-1 or expanded version-2 definition',()=>{
 assert.equal(typeof policy.blsHistoryDefinition,'function');
 assert.deepEqual(policy.BLS_HISTORY_STARTS,startsV1);assert.deepEqual(policy.BLS_HISTORY_CODES,codesV1);
 assert.deepEqual(policy.BLS_HISTORY_OUTPUTS,outputsV1);assert.deepEqual(policy.BLS_HISTORY_PROFILE,profileV1);
 assert.deepEqual(policy.BLS_LABOR_HISTORY_STARTS,startsV2);assert.deepEqual(policy.BLS_LABOR_HISTORY_CODES,codesV2);
 assert.deepEqual(policy.BLS_LABOR_HISTORY_OUTPUTS,outputsV2);assert.deepEqual(policy.BLS_LABOR_HISTORY_PROFILE,profileV2);
 for(const [profile,starts,codes,outputs]of [[profileV1,startsV1,codesV1,outputsV1],[profileV2,startsV2,codesV2,outputsV2]]){
  const source={historyProfile:structuredClone(profile)};
  assert.deepEqual(policy.blsHistoryDefinition(source),{profile,starts,codes,outputs});
  assert.equal(policy.hasBlsHistory(source),true);
  source.historyProfile=Object.fromEntries(Object.entries(source.historyProfile).reverse());
  source.historyProfile.firstPeriods=Object.fromEntries(Object.entries(source.historyProfile.firstPeriods).reverse());
  assert.deepEqual(policy.blsHistoryDefinition(source),{profile,starts,codes,outputs});
 }
});

test('partial, forged and mixed-version profile markers never grant history admission',()=>{
 assert.equal(typeof policy.blsHistoryDefinition,'function');
 for(const mutate of [
  s=>{s.historyProfile.version=1;},s=>{s.historyProfile.scope='unemployment-cpi';},
  s=>{delete s.historyProfile.contextYears;},s=>{s.historyProfile.contextYears='1';},s=>{s.historyProfile.contextYears=2;},s=>{s.historyProfile.extra=true;},
  s=>{delete s.historyProfile.firstPeriods.payrollLevel;},s=>{s.historyProfile.firstPeriods.extra='1939-01-01';},
  s=>{s.historyProfile.firstPeriods.payrollLevel='1939-02-01';},s=>{s.historyProfile.firstPeriods=Object.entries(startsV2);},
  s=>{s.historyProfile=null;},s=>{delete s.historyProfile;},
 ]){
  const source={historyProfile:structuredClone(profileV2)};mutate(source);
  assert.equal(policy.blsHistoryDefinition(source),undefined,mutate.toString());
  assert.equal(policy.hasBlsHistory(source),false,mutate.toString());
 }
 const source=fixture();source.historyProfile.version=1;
 assert.throws(()=>policy.assertBlsHistoryData(source),/BLS historical/i);
});

test('core labor admission requires all nineteen outputs and each independently native starting month',()=>{
 const source=fixture();assert.doesNotThrow(()=>assertCommercialData({sources:{bls:source}}));
 for(const id of outputsV2){
  const invalid=structuredClone(source);delete invalid.series[id];
  assert.throws(()=>policy.assertBlsHistoryData(invalid),/BLS historical/i,id);
 }
 for(const [id,date]of Object.entries(startsV2)){
  assert.equal(source.series[id].observations[0].date,date);
  const invalid=structuredClone(source);invalid.series[id].observations.shift();
  assert.throws(()=>policy.assertBlsHistoryData(invalid),/BLS historical/i,id);
 }
});

test('every historical output requires its exact captured receipt, complete input scope and unknown publication time',()=>{
 const source=fixture();assert.doesNotThrow(()=>policy.assertBlsHistoryData(source));
 for(const id of outputsV2)for(const mutate of [
  row=>{row.sourceSha256='0'.repeat(64);},row=>{delete row.retrievedAt;},row=>{row.sourceUrl=V2+'?registrationkey=private';},
  row=>{row.sourceUrls=[V2];},row=>{row.publishedAt=stamp;},row=>{row.baseDate='1900-01-01';},
  row=>{row.inputDates=['1900-01-01'];row.inputValues=[1];},
 ]){
  const invalid=structuredClone(source);mutate(invalid.series[id].observations[0]);
  assert.throws(()=>policy.assertBlsHistoryData(invalid),/BLS historical/i,`${id}: ${mutate}`);
 }
 for(const id of outputsV2){
  const invalid=structuredClone(source),row=invalid.series[id].observations[0];
  invalid.provenance.find(receipt=>receipt.sha256===row.sourceSha256).seriesIds=[];
  assert.throws(()=>policy.assertBlsHistoryData(invalid),/BLS historical/i,id);
 }
});

test('version-1 history grants no historical row receipt permissions to any of the six added labor outputs',()=>{
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:fixture(1)}}));
 for(const id of laborOutputs)for(const mutate of [
  series=>{series.inputProvenanceScope='observation-source-urls';},
  series=>{series.observations[0].sourceUrl=V1;},
  series=>{series.observations[0].sourceUrls=[V1];},
 ]){
  const source=fixture(1);mutate(source.series[id]);
  assert.throws(()=>policy.assertBlsHistoryData(source),/BLS historical/i,id);
 }
 const downgraded=fixture();downgraded.historyProfile=structuredClone(profileV1);
 assert.throws(()=>assertMacroCoverageData({sources:{bls:downgraded}}),/BLS historical|override/i);
});

test('old version-1 archive replay remains exact and accepted before a new core labor capture',()=>{
 const old=fixture(1),next=fixture(2,'2026-10-26T12:00:00.000Z');
 const initial=recordVintages(null,{}, {bls:old},{checkedAt:stamp}),before=structuredClone(initial);
 assert.doesNotThrow(()=>assertVintageData(initial,assertCommercialData));
 const replay=asKnownOn(initial,stamp).sources.bls;
 assert.deepEqual(replay.historyProfile,profileV1);assert.deepEqual(replay.series,old.series);assert.deepEqual(replay.provenance,old.provenance);
 const archive=recordVintages(initial,{bls:old},{bls:next},{checkedAt:next.fetchedAt});
 assert.deepEqual(initial,before);assert.deepEqual(archive.captures.slice(0,initial.captures.length),before.captures);
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:next},vintages:archive}));
 assert.deepEqual(asKnownOn(archive,stamp).sources.bls,replay);
});

test('core labor HTTP503 caching requires a complete admitted profile and exact credential-free endpoint evidence',()=>{
 const source=fixture(),now=new Date('2026-10-26T00:00:00.000Z');
 const cached={...source,status:'error',failure:{kind:'http',status:503,requestedUrl:V2,url:V2,redirected:false}};
 assert.equal(canPublishCachedBlsData(cached,now),true);
 for(const mutate of [
  s=>{delete s.historyProfile;},s=>{s.historyProfile.version=1;},s=>{delete s.series.participation;},
  s=>{s.series.payrollLevel.observations.shift();},s=>{s.failure.status=429;},s=>{s.failure.status=403;},
  s=>{s.failure.redirected=true;},s=>{s.failure.url=V1;},s=>{s.failure.requestedUrl=V2+'?registrationkey=private';s.failure.url=s.failure.requestedUrl;},
  s=>{s.provenance[0].url=V2+'?registrationkey=private';},s=>{s.series.payroll.observations[0].sourceUrl=V2+'?registrationkey=private';},
 ]){
  const invalid=structuredClone(cached);mutate(invalid);
  assert.equal(canPublishCachedBlsData(invalid,now),false,mutate.toString());
 }
});
