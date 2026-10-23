import { formatChange, periodLabel } from './model.js';

const finite=Number.isFinite;
/** A subtraction describes the measurement that changed, never an economic surprise. */
export function measurementChange(series) {
 const current=series?.observations?.at(-1),prior=series?.observations?.at(-2);
 const yieldRate=series?.id==='yield'||series?.changeInBasisPoints;
 const annual=/year over year|annual/i.test(series?.unit??'')&&!/annualized/i.test(series?.unit??'');
 const horizon=/(3|6)m$/i.exec(series?.id??'')?.[1];
 const label=series?.id==='payrollAverage3m'?'Change in three-month average job gains':series?.id==='wages'?'Change in annual wage growth':series?.id==='payroll'?'Change in monthly job gains':['gdp','gdpTotalContribution'].includes(series?.id)?'Change in reported growth rate':yieldRate?(series?.id==='yield'||series?.agency==='yields'?'Yield change':'Rate change'):series?.topic==='Inflation'||/cpi|pce/i.test(series?.id??'')?series.format==='index'?'Change in price index':`Change in ${horizon?horizon+'-month annualized':annual?'annual':'monthly'} inflation`:'Change between observations';
 const unit=series?.format==='percent'?(yieldRate?'Basis points':'Percentage points'):series?.unit??'';
 const value=finite(current?.value)&&finite(prior?.value)?Number(((current.value-prior.value)*(series.format==='percent'&&yieldRate?100:1)).toFixed(12)):null;
 const period=current?periodLabel(series,current.date):'Unavailable',priorPeriod=prior?periodLabel(series,prior.date):'Unavailable';
 return {label,unit,value,period,priorPeriod,currentDate:current?.date??null,priorDate:prior?.date??null,
  text:value===null?`${label}: unavailable; an available latest and prior retained observation are required.`:`${label}: ${formatChange(series)} · ${period} versus ${priorPeriod} (previous retained observation).`};
}
