import {getSeries} from './model.js';
import {isIsoDate,resolveDateWindow} from './date-window.js';
import {annualizedMomentum} from './momentum.js';

export const dashboardChartDefaults=Object.freeze({growth:'2y',inflation:'1y',inflationFamily:'core'});

/** Dashboard choices are session settings, separate from native history routes. */
export function normalizeDashboardChartSettings(input={}){
 return Object.fromEntries(Object.entries({growth:['2y','5y','10y','all'],inflation:['1y','3y','5y','all'],inflationFamily:['core','headline']})
  .map(([key,allowed])=>[key,allowed.includes(input?.[key])?input[key]:dashboardChartDefaults[key]]));
}

/** Use existing inclusive custom windows without adding dashboard presets to routes. */
export function dashboardChartRange(preset,measurements=[]){
 if(preset==='all')return {preset:'all'};
 if(!['1y','2y','3y','5y','10y'].includes(preset))return {preset:'custom',startDate:'',endDate:''};
 const endDate=resolveDateWindow({preset:'all'},Array.isArray(measurements)?measurements:[]).fullEndDate;
 if(!endDate)return {preset:'custom',startDate:'',endDate:''};
 const year=String(Number(endDate.slice(0,4))-Number.parseInt(preset,10)).padStart(4,'0');
 const anniversary=year+endDate.slice(4),startDate=isIsoDate(anniversary)?anniversary:endDate.endsWith('-02-29')?`${year}-02-28`:anniversary;
 return {preset:'custom',startDate,endDate};
}

/** Explicit chart aliases never enter the registered catalog or source captures. */
export function pceHorizonChartCatalog({lookup=getSeries}={}){
 const catalog={};
 for(const [family,prefix,indexId,yoyId,threeMonthId] of [
  ['Core','corePce','pceCoreIndex','pceCore','pceCoreAnnualized3m'],
  ['Headline','headlinePce','pceIndex','pce','pceAnnualized3m'],
 ]){
  for(const [suffix,inputId,short,horizon] of [
   ['Yoy',yoyId,'YoY','year over year'],
   ['3m',threeMonthId,'3M annualized','3-month annualized'],
   ['1m',indexId,'1M annualized','1-month annualized'],
  ]){
   const input=lookup(inputId),oneMonth=suffix==='1m';
   const observations=oneMonth?annualizedMomentum(input?.observations??[],1):input?.observations??[];
   const calculation=oneMonth?observations[0]?.calculation??'100 × [(index(t) / index(t-1 months))^12 − 1]; exact SA index endpoints in the same retrieval vintage.':input?.calculation??'';
   const id=prefix+suffix;
   catalog[id]={
    agency:'bea',source:{name:'Bureau of Economic Analysis',url:'https://www.bea.gov/',seriesIds:[]},adjustment:'Seasonally adjusted',
    ...input,id,name:`${family} PCE · ${horizon}`,short,unit:'Percent · annual rate',frequency:'Monthly',format:'percent',precision:2,comparisonClass:'growth',
    observations,calculation,
    ...(oneMonth?{observationType:'calculated',definition:'100 × [(seasonally adjusted PCE price index at t / index at the exact previous calendar month)^12 − 1]. Exact retained index endpoints; distinct from the published monthly rate and year-over-year inflation.'}:{}),
    ...(!input?{dataStatus:'unavailable',error:`Retained ${inputId} observations are unavailable.`}:{}),
   };
  }
 }
 return {'pce-horizons':{catalog,evidenceLabel:'Calculated from retained BEA indexes'}};
}
