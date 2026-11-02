import {offsetBlsDeskMonth} from './bls-desk-schema.js';
import {normalizeSourceNotes} from './source-notes.js';

/** Exact monthly endpoints; explicit nulls and absent baselines remain gaps. */
export function annualLevelGrowthSeries(input,{id,name,short}={}){
 const rows=input?.observations??[],byDate=new Map(rows.map(row=>[row.date,row]));
 return {...input,id,name,short,unit:'Percent year over year',format:'percent',precision:2,frequency:'Monthly',adjustment:input?.adjustment??'Seasonally adjusted',comparisonClass:'growth',observationType:'calculated',source:input?.source??{name:'Bureau of Labor Statistics',url:'https://www.bls.gov/ces/',seriesIds:[]},dataStatus:input?.dataStatus??'unavailable',calculation:'100 × (level / exact year-ago monthly level − 1).',observations:rows.map(row=>{
  const date=offsetBlsDeskMonth(row.date,-12),prior=byDate.get(date),valid=Number.isFinite(row.value)&&Number.isFinite(prior?.value)&&row.value>0&&prior.value>0;
  return {...row,value:valid?100*(row.value/prior.value-1):null,sourceValue:row.value,baseDate:date,baseValue:prior?.value??null,inputDates:[row.date,date],inputValues:[row.value,prior?.value??null],footnotes:normalizeSourceNotes([...(row.footnotes??[]),...(prior?.footnotes??[])]),...(row.imputed||prior?.imputed?{imputationAffected:true}:{})};
 })};
}
