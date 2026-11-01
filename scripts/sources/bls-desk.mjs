import {setTimeout as delay} from 'node:timers/promises';
import {requestText} from './http.mjs';
import {BLS_DESK_API,BLS_DESK_COVERAGE_NOTE,blsDeskDefinitions,blsDeskNativeCodes} from '../../src/bls-desk-definitions.js';
import {buildBlsDeskSeries,parseBlsDeskNumber,validateBlsDeskSource} from '../../src/bls-desk-schema.js';
const quarterlyCodes=new Set(Object.values(blsDeskDefinitions).filter(item=>item.nativeCode&&item.frequency==='Quarterly').map(item=>item.nativeCode));
const fail=message=>{throw new Error(`BLS desk ${message}`);};
/** One exact public v1 batch, rejecting unexpected series and all malformed observations. */
export function parseBlsDeskBatch(payload,codes){
  if(!Array.isArray(codes)||!codes.length||codes.length>25||new Set(codes).size!==codes.length||codes.some(code=>!blsDeskNativeCodes.includes(code)))fail('invalid requested batch scope');
  if(payload?.status!=='REQUEST_SUCCEEDED'||!Array.isArray(payload.message)||payload.message.length||!Array.isArray(payload.Results?.series)||payload.Results.series.length!==codes.length)fail('failed or incomplete batch response');
  const raw={};
  for(const item of payload.Results.series){
    const code=item?.seriesID;if(!codes.includes(code)||Object.hasOwn(raw,code)||!Array.isArray(item.data)||!item.data.length||item.data.length>1310)fail('duplicate, missing or unrequested batch series');
    const quarterly=quarterlyCodes.has(code),seen=new Set(),observations=[];
    for(const row of item.data){
      if(!row||typeof row.year!=='string'||!/^\d{4}$/.test(row.year)||row.year==='0000'||!(quarterly?/^Q0[1-5]$/:/^M(?:0[1-9]|1[0-3])$/).test(row.period)||!Array.isArray(row.footnotes)||row.footnotes.length>40)fail('invalid observation period or footnotes');
      const value=parseBlsDeskNumber(row.value);
      if(row.period===(quarterly?'Q05':'M13'))continue;
      const month=quarterly?(Number(row.period.slice(1))-1)*3+1:Number(row.period.slice(1));
      const date=`${row.year}-${String(month).padStart(2,'0')}-01`;
      if(seen.has(date))fail('duplicate observation');seen.add(date);
      const footnotes=[];
      for(const note of row.footnotes){if(!note||typeof note!=='object'||note.text!==undefined&&typeof note.text!=='string'||typeof note.text==='string'&&note.text.length>4000)fail('invalid footnote text');if(note.text?.trim())footnotes.push(note.text);}
      observations.push({date,value,sourceValue:row.value,publishedAt:null,footnotes});
    }
    if(!observations.length)fail('missing periodic observations');
    raw[code]=observations.sort((a,b)=>a.date.localeCompare(b.date));
  }
  return raw;
}
/** Public-only collection; no credential is read, transmitted or retained. */
export async function collectBlsDesk({fetchImpl=globalThis.fetch,now=new Date(),pause=delay,maxAttempts=1}={}){
  if(!(now instanceof Date)||!Number.isFinite(+now))fail('invalid collection clock');
  const endYear=now.getUTCFullYear(),startYear=endYear-9,coverageStart=`${startYear}-01-01`,coverageEnd=now.toISOString().slice(0,10),raw={},provenance=[];
  for(let offset=0;offset<blsDeskNativeCodes.length;offset+=25){
    if(offset)await pause(1200);
    const requestedSeries=blsDeskNativeCodes.slice(offset,offset+25);
    const response=await requestText(BLS_DESK_API,{fetchImpl:async(url,options)=>{
      const result=await fetchImpl(url,{...options,redirect:'manual'});
      if(result.redirected||result.url&&result.url!==BLS_DESK_API||result.status>=300&&result.status<400)fail('redirect rejected');return result;
    },method:'POST',body:JSON.stringify({seriesid:requestedSeries,startyear:String(startYear),endyear:String(endYear)}),headers:{'Content-Type':'application/json'},maxBytes:4*1024*1024,maxAttempts,sleepImpl:pause});
    let payload;try{payload=JSON.parse(response.text);}catch{fail('malformed JSON response');}
    const batch=parseBlsDeskBatch(payload,requestedSeries);
    for(const [code,observations]of Object.entries(batch)){
      if(observations.some(row=>Number(row.date.slice(0,4))<startYear||Number(row.date.slice(0,4))>endYear))fail('observation outside requested years');
      raw[code]=observations.filter(row=>row.date<=coverageEnd);
    }
    const {text,...receipt}=response;provenance.push({...receipt,requestedSeries,startYear,endYear});
  }
  const source={id:'blsDesk',status:'ok',fetchedAt:provenance.map(item=>item.retrievedAt).sort().at(-1),coverageStart,coverageEnd,series:buildBlsDeskSeries(raw),provenance,coverageNote:BLS_DESK_COVERAGE_NOTE,warnings:[BLS_DESK_COVERAGE_NOTE]};
  if(!validateBlsDeskSource(source))fail('collected source failed shared admission');return source;
}
