import {requestText} from './http.mjs';
import {LABOR_EVIDENCE_URL,laborEvidenceDefinitions,BLS_EVIDENCE_NOTICE} from '../../src/economic-evidence-definitions.js';
const fail=message=>{throw new Error(`Invalid labor evidence: ${message}`);};
const numeric=value=>{const raw=String(value??'').trim();if(['','-','—','(NA)'].includes(raw))return null;if(!/^-?\d+(?:\.\d+)?$/.test(raw))fail('numeric observation');return Number(raw);};

export function parseLaborEvidence(payload,{cutoff='9999-12-31',start='2017-01-01'}={}){
 if(payload?.status!=='REQUEST_SUCCEEDED'||!Array.isArray(payload?.Results?.series))fail('unsuccessful series response');
 const expected=Object.values(laborEvidenceDefinitions).map(row=>row.code),responses=payload.Results.series;
 if(responses.length!==expected.length||responses.some(row=>!expected.includes(row.seriesID)))fail('unexpected series scope');
 const series={};
 for(const [id,definition]of Object.entries(laborEvidenceDefinitions)){
  const matches=responses.filter(row=>row.seriesID===definition.code);if(matches.length!==1||!matches[0].data?.length)fail('missing or duplicate series');
  const seen=new Set(),observations=[];
  for(const row of matches[0].data){
   if(row.period==='M13')continue;
   if(!/^\d{4}$/.test(row.year)||row.year==='0000'||!/^M(?:0[1-9]|1[0-2])$/.test(row.period))fail('monthly period');
   const date=`${row.year}-${row.period.slice(1)}-01`;if(seen.has(date))fail('duplicate monthly period');seen.add(date);
   const value=numeric(row.value);if(value!==null&&(!Number.isFinite(value)||value<0||definition.horizonMonths&&value>100))fail('earnings or diffusion bounds');
   if(!Array.isArray(row.footnotes))fail('footnotes');
   const footnotes=row.footnotes.filter(note=>note.text||note.code).map(note=>{if(typeof note.text!=='string'||typeof note.code!=='string')fail('footnote fields');return {code:note.code,text:note.text};});
   if(date>=start&&date<=cutoff)observations.push({date,value,sourceValue:row.value,publishedAt:null,footnotes});
  }
  if(!observations.length)fail('missing covered observations');
  observations.sort((a,b)=>a.date.localeCompare(b.date));
  series[id]={...definition,observations,sourceIds:[definition.code],sourceUrl:LABOR_EVIDENCE_URL,sourceNotice:BLS_EVIDENCE_NOTICE,attribution:'Source: U.S. Bureau of Labor Statistics, Current Employment Statistics.',licenseUrl:'https://www.bls.gov/opub/copyright-information.htm',calculation:'Published official series; native values retained without scaling or recomputing the real earnings deflator or industry diffusion index.'};
 }
 return {series,coverageNote:'Selected official real earnings and private-industry diffusion histories from the 2017 application floor. Current revised API history, not first-release publication vintages. The API supplies preliminary footnotes but no historical publication dates. Missing calendar months remain gaps.'};
}

export async function collectLaborEvidence({fetchImpl=globalThis.fetch,now=new Date()}={}){
 const cutoff=now.toISOString().slice(0,10),year=now.getUTCFullYear(),start=`${Math.max(2017,year-9)}-01-01`;
 const response=await requestText(LABOR_EVIDENCE_URL,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'MeridianMacroResearch/0.1 (source reliability review; https://github.com/Vasuki8/us-treasury)'},body:JSON.stringify({seriesid:Object.values(laborEvidenceDefinitions).map(row=>row.code),startyear:start.slice(0,4),endyear:String(year)}),fetchImpl:async(url,options)=>{const result=await fetchImpl(url,{...options,redirect:'manual'});if(result.redirected||result.url&&result.url!==url||result.status>=300&&result.status<400)throw new Error('Unreviewed labor evidence redirect');return result;}});
 const {text,...receipt}=response;
 return {id:'laborEvidence',status:'ok',fetchedAt:receipt.retrievedAt,...parseLaborEvidence(JSON.parse(text),{cutoff,start}),provenance:[receipt]};
}
