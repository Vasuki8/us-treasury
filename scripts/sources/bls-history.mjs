import {setTimeout as delay} from 'node:timers/promises';
import {collectBls,parseBlsHistory,BLS_IDS,BLS_DEPTH_IDS} from './bls.mjs';
import {OfficialSourceHttpError,requestText} from './http.mjs';
import {BLS_API_V2} from '../bls-api-policy.mjs';
import {BLS_HISTORY_STARTS,BLS_HISTORY_CODES,BLS_HISTORY_OUTPUTS,BLS_HISTORY_PROFILE,hasBlsHistory,blsReceiptKey,assertBlsHistoryData} from '../bls-history-policy.mjs';
import {addMomentumSeries} from '../../src/momentum.js';

const historyIds=new Set(BLS_HISTORY_OUTPUTS);
const nativeIds=[...new Set([...Object.values(BLS_IDS),...Object.values(BLS_DEPTH_IDS)])];
const coverageNote='Official unemployment and CPI history retained from the actual dated BLS API captures identified on each observation. Recent updates refresh a ten-calendar-year window with its first year reserved as calculation context; older observations retain their original retrieval receipts. Exact CPI inputs come from the same response, with matching overlapping values checked before stitching. Historical publication timestamps are unknown; this is revised statistical history, not a reconstruction of first releases.';
function containsKey(value,key){
 if(typeof value==='string')return value.includes(key)||value.includes(encodeURIComponent(key));
 return value&&typeof value==='object'&&Object.entries(value).some(([name,item])=>containsKey(name,key)||containsKey(item,key));
}
const receiptWithScope=(receipt,startYear,endYear,seriesIds)=>({...receipt,startYear,endYear,seriesIds});
function annotated(source){
 const receipt=source.provenance[0];
 const series=Object.fromEntries(Object.entries(source.series).map(([id,value])=>[id,historyIds.has(id)?{...value,inputProvenanceScope:'observation-source-urls',coverageNote,observations:value.observations.map(row=>({...row,sourceUrl:receipt.url,retrievedAt:receipt.retrievedAt,sourceSha256:receipt.sha256}))}:value]));
 return addMomentumSeries({...source,series});
}

async function collectWindow({fetchImpl,now,apiKey,pause,maxAttempts,startYear,endYear}){
 const seriesIds=Object.entries(BLS_HISTORY_CODES).filter(([id])=>Number(BLS_HISTORY_STARTS[id].slice(0,4))<=endYear).map(([,code])=>code);
 try{
  const request=await requestText(BLS_API_V2,{method:'POST',maxAttempts,sleepImpl:pause,headers:{'Content-Type':'application/json'},body:JSON.stringify({seriesid:seriesIds,startyear:String(startYear),endyear:String(endYear),registrationkey:apiKey}),fetchImpl:async(url,options)=>{
   const response=await fetchImpl(url,{...options,redirect:'manual'});
   if(response.redirected||response.url&&response.url!==BLS_API_V2||response.status>=300&&response.status<400)throw new Error('Rejected BLS history redirect');
   if([...response.headers].some(([name,value])=>containsKey(`${name}:${value}`,apiKey)))throw new Error('Rejected BLS history credential echo');
   return response;
  }});
  const payload=JSON.parse(request.text);
  if(containsKey(payload,apiKey)||payload.status!=='REQUEST_SUCCEEDED'||!Array.isArray(payload.message)||payload.message.some(message=>!seriesIds.includes(typeof message==='string'?/^Unable to get Catalog Data for series ([A-Z0-9]+)$/.exec(message)?.[1]:null)))throw new Error('Rejected registered BLS history response');
  const responses=payload.Results?.series;
  if(!Array.isArray(responses)||responses.length!==seriesIds.length)throw new Error('Incomplete BLS history response');
  for(const response of responses){
   if(!seriesIds.includes(response?.seriesID)||!Array.isArray(response.data)||response.data.some(row=>!/^M(?:0[1-9]|1[0-3])$/.test(row?.period)||!/^\d{4}$/.test(row.year)||Number(row.year)<startYear||Number(row.year)>endYear))throw new Error('Invalid BLS history period');
  }
  const series=parseBlsHistory(payload,seriesIds),cutoff=now.toISOString().slice(0,10);
  for(const [id,value]of Object.entries(series)){
   value.sourceUrl=BLS_API_V2;value.observations=value.observations.filter(row=>row.date<=cutoff);
   if(!value.observations.length||BLS_HISTORY_STARTS[id]&&!value.observations.some(row=>Number.isFinite(row.value)))throw new Error('Missing BLS history observations');
  }
  const {text:_text,...receipt}=request;
  return annotated({id:'bls',fetchedAt:receipt.retrievedAt,provenance:[receiptWithScope(receipt,startYear,endYear,seriesIds)],series,warnings:[]});
 }catch(error){
  if(error instanceof OfficialSourceHttpError&&error.requestedUrl===BLS_API_V2&&error.url===BLS_API_V2&&!error.redirected)throw new OfficialSourceHttpError(error.status,BLS_API_V2);
  throw new Error('Registered BLS historical request failed or its response could not be validated');
 }
}

function assertContext(previous,current,year){
 for(const id of Object.keys(BLS_HISTORY_CODES)){
  if(!previous.series?.[id])continue;
  const rows=source=>(source.series?.[id]?.observations??[]).filter(row=>row.date.startsWith(`${year}-`));
  const before=rows(previous),after=rows(current),byDate=new Map(after.map(row=>[row.date,row.value]));
  if(!before.length||before.length!==after.length||before.some(row=>!byDate.has(row.date)||byDate.get(row.date)!==row.value))throw new Error('BLS historical overlap context changed or lost coverage');
 }
}
function stitch(previous,current,contextYear){
 const series={...current.series},boundary=`${contextYear+1}-01-01`;
 for(const id of BLS_HISTORY_OUTPUTS){
  const before=previous.series?.[id],after=current.series?.[id];
  if(!before)continue;
  series[id]={...(after??before),observations:[...before.observations.filter(row=>row.date<boundary),...(after?.observations??[]).filter(row=>row.date>=boundary)]};
 }
 return {...current,series,provenance:[...previous.provenance,...current.provenance]};
}
async function backfill(options){
 let retained=null;
 for(let startYear=1913;startYear<=options.now.getUTCFullYear();startYear+=19){
  const endYear=Math.min(startYear+19,options.now.getUTCFullYear());
  await options.pause(1000);
  const current=await collectWindow({...options,startYear,endYear});
  if(retained){assertContext(retained,current,startYear);retained=stitch(retained,current,startYear);}else retained=current;
  if(endYear===options.now.getUTCFullYear())break;
 }
 return retained;
}
function retainCoverage(previous,current){
 for(const id of BLS_HISTORY_OUTPUTS){
  const before=previous?.series?.[id]?.observations??[],after=current.series[id]?.observations??[],dates=new Set(after.map(row=>row.date));
  const latest=rows=>rows.findLast(row=>Number.isFinite(row.value))?.date??'';
  if(before.some(row=>!dates.has(row.date))||latest(after)<latest(before))throw new Error('BLS historical refresh regressed retained coverage');
 }
}
function finish(fresh,historical,previous){
 const series={...fresh.series};
 for(const id of BLS_HISTORY_OUTPUTS)series[id]=historical.series[id];
 const references=new Set(BLS_HISTORY_OUTPUTS.flatMap(id=>series[id].observations.map(row=>blsReceiptKey({url:row.sourceUrl,retrievedAt:row.retrievedAt,sha256:row.sourceSha256}))));
 // The unchanged 18 other outputs still reference this full-family response.
 for(const receipt of fresh.provenance)references.add(blsReceiptKey(receipt));
 const provenance=[...new Map([...fresh.provenance,...historical.provenance].filter(receipt=>references.has(blsReceiptKey(receipt))).map(receipt=>[blsReceiptKey(receipt),receipt])).values()];
 const source=addMomentumSeries({...fresh,fetchedAt:provenance.map(receipt=>receipt.retrievedAt).sort().at(-1),series,provenance,historyProfile:BLS_HISTORY_PROFILE,coverageNote});
 for(const id of BLS_HISTORY_OUTPUTS)source.series[id].coverageNote=coverageNote;
 retainCoverage(previous,source);assertBlsHistoryData(source);return source;
}

/** Bootstrap once with the private registered key; routine v1/v2 stays one window. */
export async function collectBlsWithHistory({fetchImpl=globalThis.fetch,now=new Date(),apiKey=process.env.BLS_API_KEY,pause=delay,previous,maxAttempts=process.env.SOURCE_RETRY_ATTEMPTS==='3'?3:1}={}){
 if(previous?.historyProfile!==undefined&&!hasBlsHistory(previous))throw new Error('Unrecognized BLS historical profile; retained history was not replaced');
 const key=typeof apiKey==='string'?apiKey.trim():'',options={fetchImpl,now,apiKey:key,pause,maxAttempts};
 const fresh=await collectBls({...options,previous});
 if(!hasBlsHistory(previous)&&!key)return addMomentumSeries(fresh);
 const year=now.getUTCFullYear();fresh.provenance=fresh.provenance.map(receipt=>receiptWithScope(receipt,year-9,year,nativeIds));
 const current=annotated(fresh);
 if(!hasBlsHistory(previous))return finish(current,await backfill(options),previous);
 assertBlsHistoryData(previous);
 try{assertContext(previous,current,year-9);}
 catch(error){if(!key)throw error;return finish(current,await backfill(options),previous);}
 return finish(current,stitch(previous,current,year-9),previous);
}
