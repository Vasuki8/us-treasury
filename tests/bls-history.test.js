import test from 'node:test';
import assert from 'node:assert/strict';
import {BLS_IDS,BLS_DEPTH_IDS,parseBls} from '../scripts/sources/bls.mjs';
import {BLS_API_V1 as V1,BLS_API_V2 as V2} from '../scripts/bls-api-policy.mjs';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {canPublishCachedBlsData} from '../scripts/sources/refresh.mjs';
import {OfficialSourceHttpError} from '../scripts/sources/http.mjs';
import {recordVintages,asKnownOn} from '../src/vintages.js';
import {assertVintageData} from '../scripts/vintage-policy.mjs';

let history;
try{history=await import('../scripts/sources/bls-history.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const KEY='private-test-only-history-key',NOW=new Date('2026-10-25T23:59:59.000Z');
const born={LNS14000000:1948,CUUR0000SA0:1913,CUUR0000SA0L1E:1957,CUSR0000SA0:1947,CUSR0000SA0L1E:1957};
const quarterlies=new Set(['CIS1010000000000I','PRS85006092','PRS85006112']);
const outputIds=['unrate','cpi','cpiIndex','cpiCoreIndex','cpiSaIndex','cpiCoreSaIndex','cpiCore','cpiMonthly','cpiCoreMonthly','cpiAnnualized3m','cpiAnnualized6m','cpiCoreAnnualized3m','cpiCoreAnnualized6m'];
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
 const service=server(options),source=await history.collectBlsWithHistory({now:NOW,apiKey:KEY,pause:async()=>{},fetchImpl:service.fetchImpl});
 return {source,service};
}

test('automatic registered bootstrap retains official starts and exact chunk-seam calculations without changing the full parser',async()=>{
 const {source,service}=await bootstrap();
 assert.equal(Object.keys(source.series).length,31);assert.equal(source.historyProfile.version,1);
 assert.equal(service.calls.length,10);assert.equal(service.calls[0].url,V1);
 assert.equal(Object.hasOwn(service.calls[0].body,'registrationkey'),false);
 assert.deepEqual(service.calls.slice(1).map(call=>[call.body.startyear,call.body.endyear]),[['1913','1932'],['1932','1951'],['1947','1951'],['1948','1951'],['1951','1970'],['1957','1970'],['1970','1989'],['1989','2008'],['2008','2026']]);
 assert.deepEqual(service.calls.slice(1).map(call=>call.body.seriesid),[['CUUR0000SA0'],['CUUR0000SA0'],['CUSR0000SA0'],['LNS14000000'],['LNS14000000','CUUR0000SA0','CUSR0000SA0'],['CUUR0000SA0L1E','CUSR0000SA0L1E'],['LNS14000000','CUUR0000SA0','CUUR0000SA0L1E','CUSR0000SA0','CUSR0000SA0L1E'],['LNS14000000','CUUR0000SA0','CUUR0000SA0L1E','CUSR0000SA0','CUSR0000SA0L1E'],['LNS14000000','CUUR0000SA0','CUUR0000SA0L1E','CUSR0000SA0','CUSR0000SA0L1E']]);
 for(const call of service.calls.slice(1)){assert.equal(call.url,V2);assert.equal(call.body.registrationkey,KEY);assert.equal(call.redirect,'manual');assert.ok(call.body.seriesid.length<=5);for(const code of call.body.seriesid)assert.ok(Number(call.body.startyear)>=born[code]);}
 for(const [id,date]of Object.entries({unrate:'1948-01-01',cpiIndex:'1913-01-01',cpiCoreIndex:'1957-01-01',cpiSaIndex:'1947-01-01',cpiCoreSaIndex:'1957-01-01'}))assert.equal(source.series[id].observations[0].date,date);
 assert.equal(source.series.cpi.observations.find(row=>row.date==='1913-12-01').value,null);
 assert.ok(Number.isFinite(source.series.cpi.observations.find(row=>row.date==='1914-01-01').value));
 for(const year of [1933,1952,1971,1990,2009])assert.ok(Number.isFinite(source.series.cpi.observations.find(row=>row.date===`${year}-01-01`).value),String(year));
 assert.ok(Number.isFinite(source.series.cpiAnnualized6m.observations.find(row=>row.date==='1952-01-01').value));
 for(const id of outputIds){assert.equal(source.series[id].inputProvenanceScope,'observation-source-urls');assert.match(source.series[id].coverageNote,/older observations retain their original retrieval receipts/);for(const row of source.series[id].observations){assert.ok(source.provenance.some(receipt=>receipt.url===row.sourceUrl&&receipt.sha256===row.sourceSha256&&receipt.retrievedAt===row.retrievedAt));}}
 assert.ok(source.series.payroll.observations.length<=120);assert.ok(source.series.cpiIndex.observations.length>1300);
 assert.equal(JSON.stringify(source).includes(KEY),false);assert.doesNotThrow(()=>assertCommercialData({sources:{bls:source}}));
 const partial=payload({seriesid:['CUUR0000SA0'],startyear:'1913',endyear:'1920'});assert.throws(()=>parseBls(partial),/Missing BLS series/);
});

test('routine v1 to v2 to v1 refreshes keep historical dates, receipts and context-year calculations',async()=>{
 let {source}=await bootstrap();const oldest=structuredClone(source.series.cpi.observations[0]);
 for(const primary503 of [false,true,false]){
  const service=server({primary503,change:(code,y)=>y>=2021?1:0});
  const next=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:KEY,pause:async()=>{},fetchImpl:service.fetchImpl});
  assert.equal(service.calls.length,primary503?2:1);assert.deepEqual(next.series.cpi.observations[0],oldest);
  for(const id of outputIds)assert.deepEqual(next.series[id].observations.map(row=>row.date),source.series[id].observations.map(row=>row.date));
  assert.doesNotThrow(()=>assertCommercialData({sources:{bls:next}}));source=next;
 }
 const service=server();const noKey=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:service.fetchImpl});
 assert.equal(service.calls.length,1);assert.equal(noKey.series.cpiIndex.observations[0].date,'1913-01-01');
 const rollover=server({year:2027});const next=await history.collectBlsWithHistory({previous:noKey,now:new Date('2027-10-25T23:59:59Z'),apiKey:'',fetchImpl:rollover.fetchImpl});
 assert.equal(rollover.calls.length,1);assert.equal(next.series.unrate.observations[0].date,'1948-01-01');assert.equal(next.series.unrate.observations.at(-1).date,'2027-09-01');
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:next}}));
});

test('changed retained context triggers one full registered backfill and fails closed without a key',async()=>{
 const {source}=await bootstrap();const service=server({change:(code,y)=>y===2017?2:0});
 const before=structuredClone(source);const next=await history.collectBlsWithHistory({previous:source,now:NOW,apiKey:KEY,pause:async()=>{},fetchImpl:service.fetchImpl});
 assert.equal(service.calls.length,10);assert.deepEqual(source,before);assert.equal(next.series.cpiIndex.observations[0].date,'1913-01-01');
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:next}}));
 const denied=server({change:(code,y)=>y===2017?2:0});await assert.rejects(history.collectBlsWithHistory({previous:source,now:NOW,apiKey:'',fetchImpl:denied.fetchImpl}),/context|overlap/i);assert.equal(denied.calls.length,1);
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
 assert.deepEqual(replay.historyProfile,source.historyProfile);assert.deepEqual(replay.series.cpiIndex.observations,source.series.cpiIndex.observations);
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
 const {source}=await bootstrap();const invalid=structuredClone(source);invalid.historyProfile.version=2;
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
