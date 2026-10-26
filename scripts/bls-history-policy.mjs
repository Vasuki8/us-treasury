import {BLS_API_V1,matchesBlsApiFeed} from './bls-api-policy.mjs';

export const BLS_HISTORY_STARTS={unrate:'1948-01-01',cpiIndex:'1913-01-01',cpiCoreIndex:'1957-01-01',cpiSaIndex:'1947-01-01',cpiCoreSaIndex:'1957-01-01'};
export const BLS_HISTORY_CODES={unrate:'LNS14000000',cpiIndex:'CUUR0000SA0',cpiCoreIndex:'CUUR0000SA0L1E',cpiSaIndex:'CUSR0000SA0',cpiCoreSaIndex:'CUSR0000SA0L1E'};
export const BLS_HISTORY_OUTPUTS=['unrate','cpi','cpiIndex','cpiCoreIndex','cpiSaIndex','cpiCoreSaIndex','cpiCore','cpiMonthly','cpiCoreMonthly','cpiAnnualized3m','cpiAnnualized6m','cpiCoreAnnualized3m','cpiCoreAnnualized6m'];
export const BLS_HISTORY_PROFILE={version:1,scope:'unemployment-cpi',firstPeriods:BLS_HISTORY_STARTS,contextYears:1};
export const BLS_LABOR_HISTORY_STARTS={...BLS_HISTORY_STARTS,payrollLevel:'1939-01-01',participation:'1948-01-01',employmentPopulation:'1948-01-01',underemployment:'1994-01-01'};
export const BLS_LABOR_HISTORY_CODES={...BLS_HISTORY_CODES,payrollLevel:'CES0000000001',participation:'LNS11300000',employmentPopulation:'LNS12300000',underemployment:'LNS13327709'};
export const BLS_LABOR_HISTORY_OUTPUTS=[...BLS_HISTORY_OUTPUTS,'payrollLevel','payroll','payrollAverage3m','participation','employmentPopulation','underemployment'];
export const BLS_LABOR_HISTORY_PROFILE={version:2,scope:'unemployment-cpi-core-labor',firstPeriods:BLS_LABOR_HISTORY_STARTS,contextYears:1};
const definitions=[
 {profile:BLS_HISTORY_PROFILE,starts:BLS_HISTORY_STARTS,codes:BLS_HISTORY_CODES,outputs:BLS_HISTORY_OUTPUTS},
 {profile:BLS_LABOR_HISTORY_PROFILE,starts:BLS_LABOR_HISTORY_STARTS,codes:BLS_LABOR_HISTORY_CODES,outputs:BLS_LABOR_HISTORY_OUTPUTS},
];
export function blsHistoryDefinition(source){
 const profile=source?.historyProfile,starts=profile?.firstPeriods;
 if(!profile||typeof profile!=='object'||Array.isArray(profile)||!starts||typeof starts!=='object'||Array.isArray(starts))return;
 return definitions.find(definition=>Object.keys(profile).length===Object.keys(definition.profile).length&&Object.keys(starts).length===Object.keys(definition.starts).length
  &&Object.entries(definition.profile).every(([key,value])=>Object.hasOwn(profile,key)&&(key==='firstPeriods'||profile[key]===value))
  &&Object.entries(definition.starts).every(([id,date])=>Object.hasOwn(starts,id)&&starts[id]===date));
}
export const hasBlsHistory=source=>blsHistoryDefinition(source)!==undefined;
export const blsReceiptKey=receipt=>`${receipt.url}|${receipt.retrievedAt}|${receipt.sha256}`;
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;

/** Profiled captures only: old immutable BLS captures retain their original contract. */
export function assertBlsHistoryData(source) {
 if(source?.historyProfile===undefined)return;
 const fail=()=>{throw new Error('Invalid BLS historical observation scope or capture provenance');};
 const definition=blsHistoryDefinition(source);
 if(!definition||!timestamp(source.fetchedAt))fail();
 for(const id of BLS_LABOR_HISTORY_OUTPUTS.filter(id=>!definition.outputs.includes(id))){
  const series=source.series?.[id];
  if(series?.inputProvenanceScope==='observation-source-urls'||series?.observations?.some(row=>Object.hasOwn(row,'sourceUrl')||Object.hasOwn(row,'sourceUrls')))fail();
 }
 const receipts=new Map();
 for(const receipt of source.provenance??[]){
  if(!matchesBlsApiFeed(receipt?.url)||!timestamp(receipt.retrievedAt)||receipt.retrievedAt>source.fetchedAt||!/^[a-f0-9]{64}$/.test(receipt.sha256))fail();
  if(!Number.isInteger(receipt.startYear)||!Number.isInteger(receipt.endYear)||receipt.startYear>receipt.endYear||receipt.endYear-receipt.startYear>(receipt.url===BLS_API_V1?9:19))fail();
  receipts.set(blsReceiptKey(receipt),receipt);
 }
 for(const id of definition.outputs){
  const series=source.series?.[id];
  if(series?.inputProvenanceScope!=='observation-source-urls'||!series.observations?.length)fail();
  if(definition.starts[id]&&series.observations[0].date!==definition.starts[id])fail();
  for(const row of series.observations){
   const receipt=receipts.get(blsReceiptKey({url:row.sourceUrl,retrievedAt:row.retrievedAt,sha256:row.sourceSha256}));
   if(!receipt||!Array.isArray(receipt.seriesIds)||!series.sourceIds?.every(code=>receipt.seriesIds.includes(code)))fail();
   const inputs=[row.date,...(row.baseDate?[row.baseDate]:[]),...(row.inputDates??[]).filter((date,index)=>row.inputValues?.[index]!==null)];
   if(inputs.some(date=>typeof date!=='string'||Number(date.slice(0,4))<receipt.startYear||Number(date.slice(0,4))>receipt.endYear))fail();
   if(Object.hasOwn(row,'sourceUrls')||row.publishedAt!==null)fail();
  }
 }
}
