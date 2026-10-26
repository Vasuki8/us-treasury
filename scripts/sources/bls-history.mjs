import {setTimeout as delay} from 'node:timers/promises';
import {collectBls,parseBlsHistory,summarizeApiResponse,BLS_IDS,BLS_DEPTH_IDS} from './bls.mjs';
import {OfficialSourceHttpError,requestText} from './http.mjs';
import {BLS_API_V2} from '../bls-api-policy.mjs';
import {BLS_LABOR_HISTORY_PROFILE,blsHistoryDefinition,blsReceiptKey,assertBlsHistoryData} from '../bls-history-policy.mjs';
import {addMomentumSeries} from '../../src/momentum.js';

const nativeIds=[...new Set([...Object.values(BLS_IDS),...Object.values(BLS_DEPTH_IDS)])];
const coverageNote='Official unemployment and CPI history retained from the actual dated BLS API captures identified on each observation. Recent updates refresh a ten-calendar-year window with its first year reserved as calculation context; older observations retain their original retrieval receipts. Exact CPI inputs come from the same response, with matching overlapping values checked before stitching. Historical publication timestamps are unknown; this is revised statistical history, not a reconstruction of first releases.';
const laborCoverageNote=coverageNote.replace('unemployment and CPI','core labor').replace('Exact CPI inputs','Exact labor inputs');
function noteFor(definition,id){
 if(definition.profile.version===1)return coverageNote;
 if(id===undefined)return coverageNote.replace('unemployment and CPI','unemployment, CPI and core labor');
 if(['payrollLevel','payroll','payrollAverage3m'].includes(id))return laborCoverageNote+' CES counts jobs rather than unique people; payroll levels can be benchmark-revised.';
 if(['participation','employmentPopulation','underemployment'].includes(id))return laborCoverageNote+' CPS measures people; the 1994 survey redesign and population controls affect comparability. No artificial step adjustment is applied.'+(id==='underemployment'?' U-6 reference history begins in 1994; regular publication began in 1996, so its first historical month does not establish an original publication date.':'');
 return coverageNote;
}
function containsKey(value,key){
 if(typeof value==='string')return value.includes(key)||value.includes(encodeURIComponent(key));
 return value&&typeof value==='object'&&Object.entries(value).some(([name,item])=>containsKey(name,key)||containsKey(item,key));
}
const receiptWithScope=(receipt,startYear,endYear,seriesIds)=>({...receipt,startYear,endYear,seriesIds});
function annotated(source,definition){
 const receipt=source.provenance[0];
 const series=Object.fromEntries(Object.entries(source.series).map(([id,value])=>[id,definition.outputs.includes(id)?{...value,inputProvenanceScope:'observation-source-urls',coverageNote:noteFor(definition,id),observations:value.observations.map(row=>({...row,sourceUrl:receipt.url,retrievedAt:receipt.retrievedAt,sourceSha256:receipt.sha256}))}:value]));
 return addMomentumSeries({...source,series});
}

async function collectWindow({fetchImpl,now,apiKey,pause,maxAttempts,startYear,endYear,seriesIds,definition}){
 let stage='transport',payload=null;
 try{
  const request=await requestText(BLS_API_V2,{method:'POST',maxAttempts,sleepImpl:pause,headers:{'Content-Type':'application/json'},body:JSON.stringify({seriesid:seriesIds,startyear:String(startYear),endyear:String(endYear),registrationkey:apiKey}),fetchImpl:async(url,options)=>{
   const response=await fetchImpl(url,{...options,redirect:'manual'});
   if(response.redirected||response.url&&response.url!==BLS_API_V2||response.status>=300&&response.status<400)throw new Error('Rejected BLS history redirect');
   if([...response.headers].some(([name,value])=>containsKey(`${name}:${value}`,apiKey))){stage='credential-echo';throw new Error('Rejected BLS history credential echo');}
   return response;
  }});
  stage='json';payload=JSON.parse(request.text);
  stage='credential-echo';if(containsKey(payload,apiKey))throw new Error('Rejected BLS history credential echo');
  stage='api-status';if(payload?.status!=='REQUEST_SUCCEEDED')throw new Error('Rejected registered BLS history status');
  stage='message';if(!Array.isArray(payload.message)||payload.message.some(message=>!seriesIds.includes(typeof message==='string'?/^Unable to get Catalog Data for series ([A-Z0-9]+)$/.exec(message)?.[1]:null)))throw new Error('Rejected registered BLS history response');
  stage='native-response';
  const responses=payload.Results?.series;
  if(!Array.isArray(responses)||responses.length!==seriesIds.length||seriesIds.some(code=>responses.filter(response=>response?.seriesID===code).length!==1)||responses.some(response=>!Array.isArray(response?.data)))throw new Error('Incomplete BLS history response');
  stage='period';
  for(const response of responses){
   if(!seriesIds.includes(response?.seriesID)||!Array.isArray(response.data)||response.data.some(row=>!/^M(?:0[1-9]|1[0-3])$/.test(row?.period)||!/^\d{4}$/.test(row.year)||Number(row.year)<startYear||Number(row.year)>endYear))throw new Error('Invalid BLS history period');
  }
  stage='parser';const series=parseBlsHistory(payload,seriesIds),cutoff=now.toISOString().slice(0,10);
  stage='usable';
  for(const [id,value]of Object.entries(series)){
   value.sourceUrl=BLS_API_V2;value.observations=value.observations.filter(row=>row.date<=cutoff);
   if(!value.observations.length||definition.starts[id]&&!value.observations.some(row=>Number.isFinite(row.value)))throw new Error('Missing BLS history observations');
  }
  const {text:_text,...receipt}=request;
  return annotated({id:'bls',fetchedAt:receipt.retrievedAt,provenance:[receiptWithScope(receipt,startYear,endYear,seriesIds)],series,warnings:[]},definition);
 }catch(error){
  const http=error instanceof OfficialSourceHttpError&&error.requestedUrl===BLS_API_V2&&error.url===BLS_API_V2&&!error.redirected&&Number.isInteger(error.status)&&error.status>=100&&error.status<=599;
  const diagnostics={startYear,endYear,stage,httpStatus:http?error.status:null,apiSummary:payload&&stage!=='credential-echo'?summarizeApiResponse(payload,apiKey):null};
  if(['parser','usable'].includes(stage))diagnostics.nativeCoverage=seriesIds.map(seriesId=>{
   const matches=payload.Results.series.filter(response=>response.seriesID===seriesId),rows=matches.length===1&&Array.isArray(matches[0].data)?matches[0].data:null;
   const periods=(rows??[]).filter(row=>/^\d{4}$/.test(row?.year)&&/^M(?:0[1-9]|1[0-2])$/.test(row?.period)).map(row=>`${row.year}-${row.period}`).sort();
   return {seriesId,observationCount:rows&&rows.length<=300?rows.length:null,firstPeriod:periods[0]??null,lastPeriod:periods.at(-1)??null};
  });
  const failure=http?new OfficialSourceHttpError(error.status,BLS_API_V2):new Error('Registered BLS historical request failed or its response could not be validated');
  failure.historyDiagnostics=diagnostics;
  failure.message+=` [historical diagnostics: ${JSON.stringify(diagnostics)}]`;
  throw failure;
 }
}

function assertContext(previous,current,year,definition){
 for(const id of Object.keys(definition.codes)){
  if(!previous.series?.[id])continue;
  const rows=source=>(source.series?.[id]?.observations??[]).filter(row=>row.date.startsWith(`${year}-`));
  const before=rows(previous),after=rows(current),byDate=new Map(after.map(row=>[row.date,row.value]));
  if(!before.length||before.length!==after.length||before.some(row=>!byDate.has(row.date)||byDate.get(row.date)!==row.value))throw new Error('BLS historical overlap context changed or lost coverage');
 }
}
function stitch(previous,current,contextYear,definition){
 const series={...current.series},boundary=`${contextYear+1}-01-01`;
 for(const id of definition.outputs){
  const before=previous.series?.[id],after=current.series?.[id];
  if(!before)continue;
  series[id]={...(after??before),observations:[...before.observations.filter(row=>row.date<boundary),...(after?.observations??[]).filter(row=>row.date>=boundary)]};
 }
 return {...current,series,provenance:[...previous.provenance,...current.provenance]};
}
async function backfill(options){
 const {definition}=options;
 let retained=null;
 for(let startYear=Math.min(...Object.values(definition.starts).map(date=>Number(date.slice(0,4))));startYear<=options.now.getUTCFullYear();startYear+=19){
  const endYear=Math.min(startYear+19,options.now.getUTCFullYear());
  // The API emits one advisory per pre-birth year. Request only actual coverage
  // instead of weakening advisory validation or manufacturing missing periods.
  const groups=new Map();
  for(const [id,code]of Object.entries(definition.codes)){
   const effectiveStart=Math.max(startYear,Number(definition.starts[id].slice(0,4)));
   if(effectiveStart>endYear)continue;
   if(!groups.has(effectiveStart))groups.set(effectiveStart,[]);
   groups.get(effectiveStart).push(code);
  }
  const parts=[];
  for(const [effectiveStart,seriesIds]of [...groups].sort(([a],[b])=>a-b)){
   await options.pause(1000);
   parts.push(await collectWindow({...options,startYear:effectiveStart,endYear,seriesIds}));
  }
  const current={id:'bls',fetchedAt:parts.map(part=>part.fetchedAt).sort().at(-1),series:Object.assign({},...parts.map(part=>part.series)),provenance:parts.flatMap(part=>part.provenance),warnings:[]};
  if(retained){assertContext(retained,current,startYear,definition);retained=stitch(retained,current,startYear,definition);}else retained=current;
  if(endYear===options.now.getUTCFullYear())break;
 }
 return retained;
}
function retainCoverage(previous,current,definition){
 for(const id of definition.outputs){
  const before=previous?.series?.[id]?.observations??[],after=current.series[id]?.observations??[],dates=new Set(after.map(row=>row.date));
  const latest=rows=>rows.findLast(row=>Number.isFinite(row.value))?.date??'';
  if(before.some(row=>!dates.has(row.date))||latest(after)<latest(before))throw new Error('BLS historical refresh regressed retained coverage');
 }
}
function finish(fresh,historical,previous,definition){
 const series={...fresh.series};
 for(const id of definition.outputs)series[id]=historical.series[id];
 const references=new Set(definition.outputs.flatMap(id=>series[id].observations.map(row=>blsReceiptKey({url:row.sourceUrl,retrievedAt:row.retrievedAt,sha256:row.sourceSha256}))));
 // The other outputs still reference this full-family response.
 for(const receipt of fresh.provenance)references.add(blsReceiptKey(receipt));
 const provenance=[...new Map([...fresh.provenance,...historical.provenance].filter(receipt=>references.has(blsReceiptKey(receipt))).map(receipt=>[blsReceiptKey(receipt),receipt])).values()];
 const source=addMomentumSeries({...fresh,fetchedAt:provenance.map(receipt=>receipt.retrievedAt).sort().at(-1),series,provenance,historyProfile:definition.profile,coverageNote:noteFor(definition)});
 for(const id of definition.outputs)source.series[id].coverageNote=noteFor(definition,id);
 retainCoverage(previous,source,definition);assertBlsHistoryData(source);return source;
}

/** Bootstrap once with the private registered key; routine v1/v2 stays one window. */
export async function collectBlsWithHistory({fetchImpl=globalThis.fetch,now=new Date(),apiKey=process.env.BLS_API_KEY,pause=delay,previous,maxAttempts=process.env.SOURCE_RETRY_ATTEMPTS==='3'?3:1}={}){
 const previousDefinition=blsHistoryDefinition(previous);
 if(previous?.historyProfile!==undefined&&!previousDefinition)throw new Error('Unrecognized BLS historical profile; retained history was not replaced');
 const key=typeof apiKey==='string'?apiKey.trim():'',definition=key?blsHistoryDefinition({historyProfile:BLS_LABOR_HISTORY_PROFILE}):previousDefinition,options={fetchImpl,now,apiKey:key,pause,maxAttempts,definition};
 const fresh=await collectBls({...options,previous});
 if(!definition)return addMomentumSeries(fresh);
 const year=now.getUTCFullYear();fresh.provenance=fresh.provenance.map(receipt=>receiptWithScope(receipt,year-9,year,nativeIds));
 const current=annotated(fresh,definition);
 if(previousDefinition)assertBlsHistoryData(previous);
 if(!previousDefinition||previousDefinition.profile.version!==definition.profile.version)return finish(current,await backfill(options),previous,definition);
 try{assertContext(previous,current,year-9,definition);}
 catch(error){if(!key)throw error;return finish(current,await backfill(options),previous,definition);}
 return finish(current,stitch(previous,current,year-9,definition),previous,definition);
}
