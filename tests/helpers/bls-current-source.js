import {BLS_IDS,BLS_DEPTH_IDS,parseBls,parseBlsEconomicDepth} from '../../scripts/sources/bls.mjs';
import {BLS_API_V2} from '../../scripts/bls-api-policy.mjs';
import {addMomentumSeries} from '../../src/momentum.js';

/** Rebuild a fresh primitive response; stored history is input data, not a fixture contract. */
export function currentBlsSource(previous,{now=new Date(previous.fetchedAt),endpoint=BLS_API_V2}={}){
 const start=`${now.getUTCFullYear()-9}-01-01`,cutoff=now.toISOString().slice(0,10);
 const native=new Map(),quarterly=new Set(['eciCompensation','laborProductivity','unitLaborCosts']);
 for(const [id,code]of Object.entries({...BLS_IDS,...BLS_DEPTH_IDS}))if(!native.has(code)){
  const data=previous.series[id].observations.filter(row=>row.date>=start&&row.date<=cutoff).map(row=>({
   year:row.date.slice(0,4),period:quarterly.has(id)?`Q0${Math.floor((Number(row.date.slice(5,7))-1)/3)+1}`:`M${row.date.slice(5,7)}`,
   value:row.sourceValue,footnotes:(row.footnotes??[]).map(text=>({text})),
  }));
  native.set(code,{seriesID:code,data});
 }
 const payload={status:'REQUEST_SUCCEEDED',message:[],Results:{series:[...native.values()]}};
 const series={...parseBls(payload),...parseBlsEconomicDepth(payload)};
 for(const value of Object.values(series)){value.sourceUrl=endpoint;value.observations=value.observations.slice(-120);}
 return addMomentumSeries({id:'bls',fetchedAt:now.toISOString(),series,provenance:[{url:endpoint,sha256:'a'.repeat(64),retrievedAt:now.toISOString(),lastModified:null}],warnings:[]});
}
