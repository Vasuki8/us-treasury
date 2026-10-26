import test from 'node:test';
import assert from 'node:assert/strict';
import {BLS_IDS,BLS_DEPTH_IDS,parseBls,parseBlsHistory} from '../scripts/sources/bls.mjs';
import {addMomentumSeries} from '../src/momentum.js';
import {registry} from '../src/registry.js';
import {buildCoverageInventory} from '../src/coverage-inventory.js';
import {compareSeries,toCsv,transformSeries,comparisonClassification} from '../src/model.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv} from '../src/research-packages.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {BLS_API_V1 as V1,BLS_API_V2 as V2} from '../scripts/bls-api-policy.mjs';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {canPublishCachedBlsData} from '../scripts/sources/refresh.mjs';
import {OfficialSourceHttpError} from '../scripts/sources/http.mjs';
import {recordVintages,asKnownOn} from '../src/vintages.js';
import {assertVintageData} from '../scripts/vintage-policy.mjs';

let history;
try{history=await import('../scripts/sources/bls-history.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const KEY='private-test-only-history-key',NOW=new Date('2026-10-25T23:59:59.000Z');
const born={LNS14000000:1948,CUUR0000SA0:1913,CUUR0000SA0L1E:1957,CUSR0000SA0:1947,CUSR0000SA0L1E:1957,CES0000000001:1939,LNS11300000:1948,LNS12300000:1948,LNS13327709:1994};
const quarterlies=new Set(['CIS1010000000000I','PRS85006092','PRS85006112']);
const outputIds=['unrate','cpi','cpiIndex','cpiCoreIndex','cpiSaIndex','cpiCoreSaIndex','cpiCore','cpiMonthly','cpiCoreMonthly','cpiAnnualized3m','cpiAnnualized6m','cpiCoreAnnualized3m','cpiCoreAnnualized6m'];
const laborIds=['payrollLevel','payroll','payrollAverage3m','participation','employmentPopulation','underemployment'];
const historicalIds=[...outputIds,...laborIds];
const legacyProfile={version:1,scope:'unemployment-cpi',firstPeriods:{unrate:'1948-01-01',cpiIndex:'1913-01-01',cpiCoreIndex:'1957-01-01',cpiSaIndex:'1947-01-01',cpiCoreSaIndex:'1957-01-01'},contextYears:1};
function payload(body,{year=2026,change=()=>0}={}){
 return {status:'REQUEST_SUCCEEDED',message:[],Results:{series:body.seriesid.map(seriesID=>{
  const data=[];
  for(let y=Math.max(Number(body.startyear),born[seriesID]??1900);y<=Number(body.endyear);y++)for(let m=1;m<=12;m++){
   if(y===year&&m>9||quarterlies.has(seriesID)&&![1,4,7,10].includes(m))continue;
   data.push({year:String(y),period:quarterlies.has(seriesID)?`Q0${(m-1)/3+1}`:`M${String(m).padStart(2,'0')}`,value:String(100+(y-1913)+m/10+change(seriesID,y,m)),footnotes:[]});
  }
  return {seriesID,data};
 })}};
}
function server({year=2026,change,primary503=false,mutate}={}){
 const calls=[];
 return {calls,fetchImpl:async(url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body,redirect:options.redirect});
  if(url===V1&&primary503)return new Response('unavailable',{status:503});
  const value=payload(body,{year,change});if(mutate)mutate(value,body,url);
  return new Response(JSON.stringify(value),{status:200});
 }};
}
async function bootstrap(options={}){
 assert.equal(typeof history?.collectBlsWithHistory,'function','History wrapper must exist');
 const service=server(options),pauses=[],source=await history.collectBlsWithHistory({now:NOW,apiKey:KEY,pause:async ms=>{pauses.push(ms);},fetchImpl:service.fetchImpl});
 return {source,service,pauses};
}

async function legacyBootstrap(){
 const {source}=await bootstrap(),service=server();
 const recent=await history.collectBlsWithHistory({now:NOW,apiKey:'',fetchImpl:service.fetchImpl});
 const coverageNote='Official unemployment and CPI history retained from the actual dated BLS API captures identified on each observation. Recent updates refresh a ten-calendar-year window with its first year reserved as calculation context; older observations retain their original retrieval receipts. Exact CPI inputs come from the same response, with matching overlapping values checked before stitching. Historical publication timestamps are unknown; this is revised statistical history, not a reconstruction of first releases.';
 return {...source,coverageNote,historyProfile:structuredClone(legacyProfile),series:{...recent.series,...Object.fromEntries(outputIds.map(id=>[id,{...source.series[id],coverageNote}]))}};
}

function catalogFrom(source){return Object.fromEntries(laborIds.map(id=>[id,{...registry[id],...structuredClone(source.series[id]),source:{...registry[id].source,seriesIds:[...source.series[id].sourceIds]},comparisonClass:comparisonClassification(registry[id]),provenance:structuredClone(source.provenance),fetchedAt:source.fetchedAt,dataStatus:'official'}]));}
function csvObjects(text){const [headers,...rows]=parseCsv(text);return rows.filter(row=>row.some(Boolean)).map(row=>Object.fromEntries(headers.map((key,index)=>[key,row[index]])));}

test('historical parsing admits only approved core labor monthly inputs and preserves exact payroll warm-up and gaps',()=>{
 const monthly=(year,values)=>values.map(([month,value])=>({year:String(year),period:`M${String(month).padStart(2,'0')}`,value,footnotes:[{text:'Revised source footnote'}]}));
 const input={status:'REQUEST_SUCCEEDED',message:[],Results:{series:[
  {seriesID:'CES0000000001',data:monthly(1939,[[1,'29,923'],[2,'30200'],[3,'30100'],[4,'30500'],[6,'30600'],[7,'-'],[8,'30800'],[13,'99999']])},
  {seriesID:'LNS11300000',data:monthly(1948,[[1,'58.6']])},
  {seriesID:'LNS12300000',data:monthly(1948,[[1,'56.6']])},
  {seriesID:'LNS13327709',data:monthly(1994,[[1,'11.7']])},
 ]}};
 const parsed=addMomentumSeries({series:parseBlsHistory(input,['CES0000000001','LNS11300000','LNS12300000','LNS13327709'])}).series;
 assert.deepEqual(parsed.payroll.observations.map(row=>row.value),[null,277,-100,400,null,null,null]);
 assert.equal(parsed.payrollLevel.observations[0].sourceValue,'29,923');assert.equal(parsed.payrollLevel.observations[0].value,29923);
 assert.deepEqual(parsed.payroll.observations[1].baseDate,'1939-01-01');assert.equal(parsed.payroll.observations[1].baseValue,'29,923');
 assert.deepEqual(parsed.payrollAverage3m.observations.map(row=>row.value),[null,null,null,577/3,null,null,null]);
 assert.deepEqual(parsed.payrollAverage3m.observations[3].inputDates,['1939-02-01','1939-03-01','1939-04-01']);
 assert.equal(parsed.participation.observations[0].value,58.6);assert.equal(parsed.employmentPopulation.observations[0].value,56.6);assert.equal(parsed.underemployment.observations[0].value,11.7);
 assert.deepEqual(parsed.payrollLevel.observations[0].footnotes,['Revised source footnote']);
 for(const code of ['CES0500000003','LNS12300060','JTS000000000000000JOL','CIS1010000000000I','PRS85006092'])assert.throws(()=>parseBlsHistory(input,[code]),/historical input scope/);
 assert.throws(()=>parseBlsHistory(input,['CES0000000001','CES0000000001']),/historical input scope/);
});

test('automatic registered bootstrap retains official starts and exact chunk-seam calculations without changing the full parser',async()=>{
 const {source,service,pauses}=await bootstrap();
 assert.equal(Object.keys(source.series).length,31);assert.equal(source.historyProfile.version,2);
 assert.equal(source.historyProfile.scope,'unemployment-cpi-core-labor');
 assert.equal(service.calls.length,12);assert.equal(service.calls[0].url,V1);
 assert.equal(Object.hasOwn(service.calls[0].body,'registrationkey'),false);
 assert.deepEqual(service.calls.slice(1).map(call=>[call.body.startyear,call.body.endyear]),[['1913','1932'],['1932','1951'],['1939','1951'],['1947','1951'],['1948','1951'],['1951','1970'],['1957','1970'],['1970','1989'],['1989','2008'],['1994','2008'],['2008','2026']]);
 assert.deepEqual(pauses,Array(11).fill(1000));
 assert.deepEqual(service.calls.slice(1).map(call=>call.body.seriesid),[
  ['CUUR0000SA0'],['CUUR0000SA0'],['CES0000000001'],['CUSR0000SA0'],['LNS14000000','LNS11300000','LNS12300000'],
  ['LNS14000000','CUUR0000SA0','CUSR0000SA0','CES0000000001','LNS11300000','LNS12300000'],['CUUR0000SA0L1E','CUSR0000SA0L1E'],
  ['LNS14000000','CUUR0000SA0','CUUR0000SA0L1E','CUSR0000SA0','CUSR0000SA0L1E','CES0000000001','LNS11300000','LNS12300000'],
  ['LNS14000000','CUUR0000SA0','CUUR0000SA0L1E','CUSR0000SA0','CUSR0000SA0L1E','CES0000000001','LNS11300000','LNS12300000'],['LNS13327709'],
  ['LNS14000000','CUUR0000SA0','CUUR0000SA0L1E','CUSR0000SA0','CUSR0000SA0L1E','CES0000000001','LNS11300000','LNS12300000','LNS13327709'],
 ]);
 assert.deepEqual(service.calls.find(call=>call.body.startyear==='1939').body.seriesid,['CES0000000001']);
 assert.deepEqual(service.calls.find(call=>call.body.startyear==='1994').body.seriesid,['LNS13327709']);
 for(const call of service.calls.slice(1)){assert.equal(call.url,V2);assert.equal(call.body.registrationkey,KEY);assert.equal(call.redirect,'manual');assert.ok(call.body.seriesid.length<=9);for(const code of call.body.seriesid)assert.ok(Number(call.body.startyear)>=born[code]);}
 for(const [id,date]of Object.entries({unrate:'1948-01-01',cpiIndex:'1913-01-01',cpiCoreIndex:'1957-01-01',cpiSaIndex:'1947-01-01',cpiCoreSaIndex:'1957-01-01',payrollLevel:'1939-01-01',payroll:'1939-01-01',payrollAverage3m:'1939-01-01',participation:'1948-01-01',employmentPopulation:'1948-01-01',underemployment:'1994-01-01'}))assert.equal(source.series[id].observations[0].date,date);
 assert.equal(source.series.cpi.observations.find(row=>row.date==='1913-12-01').value,null);
 assert.ok(Number.isFinite(source.series.cpi.observations.find(row=>row.date==='1914-01-01').value));
 for(const year of [1933,1952,1971,1990,2009])assert.ok(Number.isFinite(source.series.cpi.observations.find(row=>row.date===`${year}-01-01`).value),String(year));
 assert.ok(Number.isFinite(source.series.cpiAnnualized6m.observations.find(row=>row.date==='1952-01-01').value));
 for(const id of historicalIds){assert.equal(source.series[id].inputProvenanceScope,'observation-source-urls');assert.match(source.series[id].coverageNote,/older observations retain their original retrieval receipts/);for(const row of source.series[id].observations){assert.ok(source.provenance.some(receipt=>receipt.url===row.sourceUrl&&receipt.sha256===row.sourceSha256&&receipt.retrievedAt===row.retrievedAt));}}
 assert.ok(source.series.payroll.observations.length>1000);assert.ok(source.series.cpiIndex.observations.length>1300);
 assert.equal(source.series.payroll.observations[0].value,null);assert.equal(source.series.payroll.observations.find(row=>Number.isFinite(row.value)).date,'1939-02-01');
 assert.equal(source.series.payrollAverage3m.observations.find(row=>Number.isFinite(row.value)).date,'1939-04-01');
 for(const year of [1952,1971,1990,2009]){
  const change=source.series.payroll.observations.find(row=>row.date===`${year}-01-01`),average=source.series.payrollAverage3m.observations.find(row=>row.date===`${year}-01-01`);
  assert.equal(change.baseDate,`${year-1}-12-01`);assert.equal(change.baseValue,String(100+(year-1-1913)+1.2));assert.ok(Math.abs(change.value-(-0.1))<1e-10);
  assert.deepEqual(average.inputDates,[`${year-1}-11-01`,`${year-1}-12-01`,`${year}-01-01`]);assert.ok(Math.abs(average.value-1/30)<1e-10);
 }
 for(const id of Object.keys(source.series).filter(id=>!historicalIds.includes(id)))assert.ok(source.series[id].observations.length<=120,id);
 assert.equal(JSON.stringify(source).includes(KEY),false);assert.doesNotThrow(()=>assertCommercialData({sources:{bls:source}}));
 const partial=payload({seriesid:['CUUR0000SA0'],startyear:'1913',endyear:'1920'});assert.throws(()=>parseBls(partial),/Missing BLS series/);
});

test('routine primary to registered to primary refreshes keep core labor historical dates, receipts and context-year calculations',async()=>{
 let {source}=await bootstrap();const oldest=structuredClone(source.series.cpi.observations[0]);
 for(const primary503 of [false,true,false]){
  const service=server({primary503,change:(code,y)=>y>=2021?1:0});
  const next=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:KEY,pause:async()=>{},fetchImpl:service.fetchImpl});
  assert.equal(service.calls.length,primary503?2:1);assert.deepEqual(next.series.cpi.observations[0],oldest);
  for(const id of historicalIds)assert.deepEqual(next.series[id].observations.map(row=>row.date),source.series[id].observations.map(row=>row.date));
  assert.doesNotThrow(()=>assertCommercialData({sources:{bls:next}}));source=next;
 }
 const service=server();const noKey=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:service.fetchImpl});
 assert.equal(service.calls.length,1);assert.equal(noKey.series.cpiIndex.observations[0].date,'1913-01-01');
 const rollover=server({year:2027});const next=await history.collectBlsWithHistory({previous:noKey,now:new Date('2027-10-25T23:59:59Z'),apiKey:'',fetchImpl:rollover.fetchImpl});
 assert.equal(rollover.calls.length,1);assert.equal(next.series.unrate.observations[0].date,'1948-01-01');assert.equal(next.series.unrate.observations.at(-1).date,'2027-09-01');
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:next}}));
});

test('a literal version-1 source retains its scope without a key and rebuilds the complete version-2 scope with a key',async()=>{
 const previous=await legacyBootstrap(),before=structuredClone(previous);
 const oldCsv=toCsv(laborIds,{catalog:catalogFrom(previous),range:{preset:'all'}}),checkedAt=new Date(Date.parse(previous.fetchedAt)+1000).toISOString();
 const initial=recordVintages(undefined,{}, {bls:previous},{checkedAt});
 assert.deepEqual(previous.historyProfile,legacyProfile);assert.doesNotThrow(()=>assertCommercialData({sources:{bls:previous}}));
 const noKey=server(),retained=await history.collectBlsWithHistory({previous,now:NOW,apiKey:'',fetchImpl:noKey.fetchImpl});
 assert.equal(noKey.calls.length,1);assert.deepEqual(retained.historyProfile,legacyProfile);assert.equal(retained.coverageNote,previous.coverageNote);
 for(const id of outputIds)assert.deepEqual(retained.series[id].observations[0],previous.series[id].observations[0]);
 for(const id of laborIds){assert.ok(retained.series[id].observations.length<=120,id);assert.equal(retained.series[id].inputProvenanceScope,undefined,id);}
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:retained}}));
 const withKey=server(),expanded=await history.collectBlsWithHistory({previous,now:NOW,apiKey:KEY,pause:async()=>{},fetchImpl:withKey.fetchImpl});
 assert.equal(withKey.calls.length,12);assert.equal(expanded.historyProfile.version,2);assert.equal(expanded.series.payrollLevel.observations[0].date,'1939-01-01');assert.equal(expanded.series.underemployment.observations[0].date,'1994-01-01');
 for(const id of outputIds)assert.deepEqual(expanded.series[id].observations.map(row=>row.date),previous.series[id].observations.map(row=>row.date),id);
 assert.deepEqual(previous,before);assert.doesNotThrow(()=>assertCommercialData({sources:{bls:expanded}}));
 const nextCheckedAt=new Date(Math.max(Date.parse(expanded.fetchedAt),Date.parse(checkedAt))+1000).toISOString(),vintages=recordVintages(initial,{bls:previous},{bls:expanded},{checkedAt:nextCheckedAt}),replayed=asKnownOn(vintages,previous.fetchedAt).sources.bls;
 assert.deepEqual(vintages.captures.slice(0,initial.captures.length),initial.captures);assert.deepEqual(replayed.historyProfile,legacyProfile);assert.deepEqual(replayed.series,previous.series);assert.equal(toCsv(laborIds,{catalog:catalogFrom(replayed),range:{preset:'all'}}),oldCsv);
});

test('changed retained context triggers one full registered backfill and fails closed without a key',async()=>{
 const {source}=await bootstrap();const service=server({change:(code,y)=>y===2017?2:0});
 const before=structuredClone(source);const next=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:KEY,pause:async()=>{},fetchImpl:service.fetchImpl});
 assert.equal(service.calls.length,12);assert.deepEqual(source,before);assert.equal(next.series.cpiIndex.observations[0].date,'1913-01-01');
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:next}}));
 const denied=server({change:(code,y)=>y===2017?2:0});await assert.rejects(history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:denied.fetchImpl}),/context|overlap/i);assert.equal(denied.calls.length,1);
});

test('a payroll-only context change rebuilds the active nine-input scope and retained payroll losses fail closed',async()=>{
 const {source}=await bootstrap(),changed=server({change:(code,y)=>code==='CES0000000001'&&y===2017?2:0});
 const repaired=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:KEY,pause:async()=>{},fetchImpl:changed.fetchImpl});
 assert.equal(changed.calls.length,12);assert.equal(repaired.historyProfile.version,2);assert.equal(repaired.series.payrollLevel.observations[0].date,'1939-01-01');
 const denied=server({change:(code,y)=>code==='CES0000000001'&&y===2017?2:0});
 await assert.rejects(history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:denied.fetchImpl}),/context|overlap/i);assert.equal(denied.calls.length,1);
 const missing=server({mutate:(p,b)=>{if(b.seriesid.length===20)p.Results.series.find(series=>series.seriesID==='CES0000000001').data=p.Results.series.find(series=>series.seriesID==='CES0000000001').data.filter(row=>!(row.year==='2020'&&row.period==='M06'));}});
 await assert.rejects(history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:missing.fetchImpl}),/coverage|retained/i);
 const latest=server({mutate:(p,b)=>{if(b.seriesid.length===20)p.Results.series.find(series=>series.seriesID==='CES0000000001').data.find(row=>row.year==='2026'&&row.period==='M09').value='-';}});
 await assert.rejects(history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:latest.fetchImpl}),/regressed retained coverage/);
});

test('missing payroll levels preserve exact monthly gaps, source strings and consecutive-average recovery',async()=>{
 const {source}=await bootstrap(),service=server({mutate:(p,b)=>{if(b.seriesid.length===20){const row=p.Results.series.find(series=>series.seriesID==='CES0000000001').data.find(row=>row.year==='2026'&&row.period==='M04');row.value='-';row.footnotes=[{text:'Source reports unavailable'}];}}});
 const next=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:service.fetchImpl}),row=(id,month)=>next.series[id].observations.find(item=>item.date===`2026-${month}-01`);
 assert.equal(row('payrollLevel','04').value,null);assert.equal(row('payrollLevel','04').sourceValue,'-');assert.deepEqual(row('payrollLevel','04').footnotes,['Source reports unavailable']);
 assert.equal(row('payroll','04').value,null);assert.equal(row('payroll','05').value,null);assert.equal(row('payrollAverage3m','07').value,null);assert.ok(Number.isFinite(row('payrollAverage3m','08').value));
 assert.deepEqual(row('payrollAverage3m','08').inputDates,['2026-06-01','2026-07-01','2026-08-01']);assert.doesNotThrow(()=>assertCommercialData({sources:{bls:next}}));
});

test('historical chunk disagreement, missing retained dates and secret echoes reject the whole result',async()=>{
 await assert.rejects(bootstrap({mutate:(p,body)=>{if(body.startyear==='1932')p.Results.series.find(series=>series.seriesID==='CUUR0000SA0').data.find(row=>row.year==='1932').value='999';}}),/overlap|histor/i);
 const {source}=await bootstrap();const before=structuredClone(source);
 const missing=server({mutate:(p,body)=>{if(body.seriesid.length===20)p.Results.series.find(series=>series.seriesID==='CUUR0000SA0').data=p.Results.series.find(series=>series.seriesID==='CUUR0000SA0').data.filter(row=>!(row.year==='2020'&&row.period==='M06'));}});
 await assert.rejects(history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:missing.fetchImpl}),/coverage|retained/i);assert.deepEqual(source,before);
 for(const mutate of [(p,b)=>{if(b.seriesid.length<20)p.message=[`invalid key ${KEY}`];},(p,b)=>{if(b.seriesid.length<20)p.Results.series[0].data[0].footnotes=[{text:KEY}];}]){
  try{await bootstrap({mutate});assert.fail('credential echo must reject');}catch(error){assert.equal(String(error.message).includes(KEY),false);assert.equal(JSON.stringify(error).includes(KEY),false);}
 }
});

test('new current missing inputs remain missing and historical provenance cannot be forged',async()=>{
 const {source}=await bootstrap();const service=server({mutate:(p,b)=>{if(b.seriesid.length===20)p.Results.series.find(series=>series.seriesID==='CUSR0000SA0').data.find(row=>row.year==='2026'&&row.period==='M04').value='-';}});
 const next=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:service.fetchImpl});
 assert.equal(next.series.cpiSaIndex.observations.find(row=>row.date==='2026-04-01').value,null);assert.equal(next.series.cpiAnnualized3m.observations.find(row=>row.date==='2026-07-01').value,null);
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:next}}));
 for(const mutate of [s=>{s.series.cpiIndex.observations[0].sourceSha256='a'.repeat(64);},s=>{s.series.cpiIndex.observations[0].sourceUrl=V2+'?key=bad';},s=>{delete s.series.cpiIndex.observations[0].retrievedAt;}]){const invalid=structuredClone(source);mutate(invalid);assert.throws(()=>assertCommercialData({sources:{bls:invalid}}),/BLS|observation|provenance/i);}
 const latestMissing=server({mutate:(p,b)=>{if(b.seriesid.length===20)p.Results.series.find(series=>series.seriesID==='CUSR0000SA0').data.find(row=>row.year==='2026'&&row.period==='M06').value='-';}});
 await assert.rejects(history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:latestMissing.fetchImpl}),/regressed retained coverage/);
});

test('historical profile and row receipts survive immutable capture replay, with narrow historical v2 503 caching',async()=>{
 const {source}=await bootstrap();const checkedAt=new Date(Date.parse(source.fetchedAt)+1000).toISOString();
 const vintages=recordVintages(undefined,{}, {bls:source},{checkedAt});const replay=asKnownOn(vintages,checkedAt).sources.bls;
 assert.deepEqual(replay.historyProfile,source.historyProfile);for(const id of historicalIds)assert.deepEqual(replay.series[id].observations,source.series[id].observations,id);
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:source},vintages}));
 const cached={...source,status:'error',failure:{kind:'http',status:503,requestedUrl:V2,url:V2,redirected:false}};
 assert.equal(canPublishCachedBlsData(cached,new Date(checkedAt)),true);
 for(const status of [401,403,429])assert.equal(canPublishCachedBlsData({...cached,failure:{...cached.failure,status}},new Date(checkedAt)),false);
 const noProfile=structuredClone(cached);delete noProfile.historyProfile;assert.equal(canPublishCachedBlsData(noProfile,new Date(checkedAt)),false);
 const failed=server({mutate:(p,b)=>{if(b.seriesid.length<20)throw new OfficialSourceHttpError(503,V2);}});
 await assert.rejects(history.collectBlsWithHistory({previous:{...source,historyProfile:undefined},now:NOW,apiKey:KEY,pause:async()=>{},fetchImpl:failed.fetchImpl}),error=>error instanceof OfficialSourceHttpError&&error.requestedUrl===V2&&error.status===503);
});

test('profiled bootstrap and routine receipts pass full archive admission with exact query scope',async()=>{
 const {source}=await bootstrap();
 const checkedAt=()=>new Date(Date.now()+1000).toISOString();
 const initial=recordVintages(null,{}, {bls:source},{checkedAt:checkedAt()});
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:source},vintages:initial}));
 const next=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:server().fetchImpl});
 const vintages=recordVintages(initial,{bls:source},{bls:next},{checkedAt:checkedAt()});
 assert.deepEqual(vintages.captures.slice(0,initial.captures.length),initial.captures);
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:next},vintages}));
 const v1=capture=>capture.provenance.find(row=>row.url===V1),v2=capture=>capture.provenance.find(row=>row.url===V2);
 for(const mutate of [
  c=>{v1(c).startYear=v1(c).endYear-10;},c=>{v2(c).endYear=v2(c).startYear+20;},
  c=>{v2(c).startYear='1913';},c=>{v2(c).startYear=v2(c).endYear+1;},c=>{delete v2(c).endYear;},
  c=>{v2(c).seriesIds=[];},c=>{v2(c).seriesIds.push(v2(c).seriesIds[0]);},c=>{v2(c).seriesIds=['UNREVIEWED'];},
  c=>{v2(c).seriesIds=Array(21).fill('CUUR0000SA0');},c=>{v2(c).query='unreviewed';},
  c=>{delete c.metadata.historyProfile;},c=>{c.sourceId='bea';},
 ]){
  const invalid=structuredClone(initial);mutate(invalid.captures[0]);
  assert.throws(()=>assertVintageData(invalid,()=>{}),/provenance|query|scope/i);
 }
});

test('no configured key and no historical profile preserves the existing single-request collector',async()=>{
 assert.equal(typeof history?.collectBlsWithHistory,'function');const service=server();
 const source=await history.collectBlsWithHistory({now:NOW,apiKey:'',fetchImpl:service.fetchImpl});assert.equal(service.calls.length,1);assert.equal(source.historyProfile,undefined);assert.ok(source.series.cpiIndex.observations.length<=120);
});

test('source admission enforces each BLS endpoint query limit for bootstrap and routine receipts',async()=>{
 const {source}=await bootstrap();
 const routine=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:server().fetchImpl});
 for(const capture of [source,routine]){
  assert.doesNotThrow(()=>assertCommercialData({sources:{bls:capture}}));
  for(const [url,extraYears]of [[V1,10],[V2,20]]){
   const invalid=structuredClone(capture),receipt=invalid.provenance.find(row=>row.url===url);
   receipt.startYear=receipt.endYear-extraYears;
   assert.throws(()=>assertCommercialData({sources:{bls:invalid}}),/BLS historical|provenance/i);
  }
 }
});

test('an unrecognized historical profile fails closed rather than dropping retained history',async()=>{
 const {source}=await bootstrap();const invalid=structuredClone(source);invalid.historyProfile.version=3;
 const service=server();await assert.rejects(history.collectBlsWithHistory({previous:invalid,now:NOW,apiKey:'',fetchImpl:service.fetchImpl}),/historical profile/i);
});

test('historical failures expose only fixed stages, requested windows and bounded API categories',async()=>{
 const cases=[
  ['api-status',p=>{p.status='REQUEST_FAILED';p.message=['Requested start year is out of range'];},'years'],
  ['message',p=>{p.message=['Catalog disabled for this operation'];},'catalog'],
  ['native-response',p=>{p.Results.series=[];},null],
  ['period',p=>{p.Results.series[0].data[0].year='2000';},null],
  ['parser',p=>{p.Results.series[0].data[0].value='invalid';},null],
  ['usable',p=>{p.Results.series[0].data.forEach(row=>{row.value='-';});},null],
  ['credential-echo',p=>{p.Results.series[0].data[0].footnotes=[{text:KEY}];},null],
 ];
 for(const [stage,mutate,category]of cases){
  await assert.rejects(bootstrap({mutate:(p,b)=>{if(b.seriesid.length<20)mutate(p);}}),error=>{
   assert.equal(error.historyDiagnostics?.stage,stage);assert.equal(error.historyDiagnostics.startYear,1913);assert.equal(error.historyDiagnostics.endYear,1932);
   assert.equal(error.message.includes(KEY),false);assert.equal(JSON.stringify(error).includes(KEY),false);assert.ok(error.message.includes(stage));
   if(category)assert.ok(error.historyDiagnostics.apiSummary.categories.includes(category));
   if(['parser','usable'].includes(stage))assert.deepEqual(error.historyDiagnostics.nativeCoverage,[{seriesId:'CUUR0000SA0',observationCount:240,firstPeriod:'1913-M01',lastPeriod:'1932-M12'}]);
   return true;
  });
 }
});

test('historical JSON and transport diagnostics never repeat bodies, keys or arbitrary exceptions',async()=>{
 for(const kind of ['json','transport']){
  const service=server(),fetchImpl=async(url,options)=>{
   if(JSON.parse(options.body).seriesid.length===20)return service.fetchImpl(url,options);
   if(kind==='json')return new Response(`invalid JSON ${KEY}`,{status:200});
   throw Object.assign(new Error(`remote exception ${KEY}`),{historyDiagnostics:{stage:KEY}});
  };
  await assert.rejects(history.collectBlsWithHistory({now:NOW,apiKey:KEY,pause:async()=>{},fetchImpl}),error=>{
   assert.equal(error.historyDiagnostics.stage,kind);assert.equal(error.message.includes(KEY),false);assert.equal(JSON.stringify(error).includes(KEY),false);return true;
  });
 }
});

test('a reordered historical profile retains history while unknown profile fields fail closed',async()=>{
 const {source}=await bootstrap();
 const reordered=structuredClone(source);
 reordered.historyProfile=Object.fromEntries(Object.entries(reordered.historyProfile).reverse());
 reordered.historyProfile.firstPeriods=Object.fromEntries(Object.entries(reordered.historyProfile.firstPeriods).reverse());
 const service=server();
 const next=await history.collectBlsWithHistory({previous:reordered,now:NOW,apiKey:'',fetchImpl:service.fetchImpl});
 assert.equal(service.calls.length,1);assert.equal(next.series.cpiIndex.observations[0].date,'1913-01-01');
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:reordered}}));
 for(const mutate of [s=>{s.historyProfile.extra=true;},s=>{s.historyProfile.firstPeriods.extra='1913-01-01';},s=>{delete s.historyProfile.contextYears;},s=>{s.historyProfile.contextYears='1';}]){
  const invalid=structuredClone(reordered);mutate(invalid);
  await assert.rejects(history.collectBlsWithHistory({previous:invalid,now:NOW,apiKey:'',fetchImpl:server().fetchImpl}),/historical profile/i);
 }
});

test('six historical labor outputs retain independent coverage through inventory, All and an exact 2008 comparison window',async()=>{
 const {source}=await bootstrap(),catalog=catalogFrom(source),inventory=buildCoverageInventory(catalog);
 for(const [id,start]of Object.entries({payrollLevel:'1939-01-01',payroll:'1939-01-01',payrollAverage3m:'1939-01-01',participation:'1948-01-01',employmentPopulation:'1948-01-01',underemployment:'1994-01-01'})){
  const coverage=inventory.rows.find(row=>row.id===id);assert.equal(coverage.firstReference,start,id);assert.equal(coverage.totalCount,source.series[id].observations.length,id);
  assert.deepEqual(transformSeries(catalog[id],'level',{preset:'all'}).observations,source.series[id].observations,id);
 }
 const result=compareSeries(laborIds,'native',{preset:'custom',startDate:'2008-09-01',endDate:'2008-12-01'},catalog);
 assert.equal(result.error,null);assert.equal(result.panels.length,6);
 for(const panel of result.panels){assert.deepEqual(panel.observations.map(row=>row.date),['2008-09-01','2008-10-01','2008-11-01','2008-12-01']);assert.equal(panel.coverage.fullCount,source.series[panel.series.id].observations.length);}
 const rows=csvObjects(toCsv(laborIds,{catalog,range:{preset:'custom',startDate:'2008-09-01',endDate:'2008-12-01'}}));assert.equal(rows.length,24);
 for(const row of rows){const original=source.series[row.series_id].observations.find(item=>item.date===row.date),receipts=JSON.parse(row.capture_provenance_json);assert.equal(row.value,String(original.value));assert.equal(row.source_value,original.sourceValue);assert.equal(row.publication_date,'');assert.equal(receipts.length,1);assert.equal(receipts[0].sha256,original.sourceSha256);assert.equal(receipts[0].url,original.sourceUrl);assert.ok(receipts[0].seriesIds.includes(source.series[row.series_id].sourceIds[0]));}
});

test('four selected labor histories freeze complete inputs and exact CSV under the existing portable limit',async()=>{
 const {source}=await bootstrap(),catalog=catalogFrom(source),ids=['payroll','payrollAverage3m','participation','underemployment'];
 const expectedCsv=toCsv(ids,{catalog,range:{preset:'all'}}),pkg=await createResearchPackage({id:'synthetic-core-labor-history',name:'Core labor history',now:source.fetchedAt,state:{page:'compare',selected:ids,window:'all',comparison:'native',transform:'level'},catalog,sources:{bls:source},snapshot:{generatedAt:source.fetchedAt}});
 const json=exportResearchPackage(pkg),restored=await importResearchPackage(json);assert.ok(Buffer.byteLength(json)<12*1024*1024);assert.equal(exportResearchPackage(restored),json);assert.equal(researchPackageCsv(restored),expectedCsv);
 for(const id of ids){assert.deepEqual(restored.catalog[id].observations,source.series[id].observations,id);assert.equal(restored.catalog[id].inputProvenanceScope,'observation-source-urls');assert.equal(restored.sources.bls.seriesMetadata[id].inputProvenanceScope,'observation-source-urls');}
 assert.equal(restored.resolvedWindow.startDate,'1939-01-01');assert.equal(restored.resolvedWindow.endDate,'2026-09-01');
 source.series.payroll.observations[1].value=99999;catalog.underemployment.observations.length=0;assert.equal(exportResearchPackage(restored),json);assert.equal(researchPackageCsv(restored),expectedCsv);
});
