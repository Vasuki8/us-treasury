const shift=(date,months)=>{const [y,m]=date.split('-').map(Number);return new Date(Date.UTC(y,m-1+months,1)).toISOString().slice(0,10);};
const finite=Number.isFinite;
export function annualizedMomentum(observations,months) {
 if(![3,6].includes(months))throw new RangeError('Momentum requires 3 or 6 months.');
 const map=new Map(observations.map(row=>[row.date,row]));
 return observations.map(row=>{
  const priorDate=shift(row.date,-months),prior=map.get(priorDate);
  return {...row,publishedAt:null,value:finite(row.value)&&row.value>0&&finite(prior?.value)&&prior.value>0?100*((row.value/prior.value)**(12/months)-1):null,inputDates:[priorDate,row.date],inputValues:[prior?.value??null,row.value],calculation:`100 × [(index(t) / index(t-${months} months))^${12/months} − 1]; exact SA index endpoints in the same retrieval vintage.`};
 });
}
export function consecutiveAverage(observations,months=3) {
 if(months!==3)throw new RangeError('Payroll average requires 3 months.');
 const map=new Map(observations.map(row=>[row.date,row]));
 return observations.map(row=>{
  const dates=[shift(row.date,-2),shift(row.date,-1),row.date],values=dates.map(date=>map.get(date)?.value??null);
  return {...row,publishedAt:null,value:values.every(finite)?values.reduce((a,b)=>a+b,0)/3:null,inputDates:dates,inputValues:values,calculation:'Arithmetic mean of three exact consecutive monthly payroll job changes in the same retrieval vintage; no gap filling.'};
 });
}
export const momentumInputs={payrollAverage3m:['payroll',3,'average'],cpiAnnualized3m:['cpiSaIndex',3],cpiAnnualized6m:['cpiSaIndex',6],cpiCoreAnnualized3m:['cpiCoreSaIndex',3],cpiCoreAnnualized6m:['cpiCoreSaIndex',6],pceAnnualized3m:['pceIndex',3],pceAnnualized6m:['pceIndex',6],pceCoreAnnualized3m:['pceCoreIndex',3],pceCoreAnnualized6m:['pceCoreIndex',6]};
/** Store calculations with each source capture; do not recompute historical vintages. */
export function addMomentumSeries(source) {
 const series={...source.series};
 for(const [id,[inputId,months,kind]] of Object.entries(momentumInputs)){
  const input=source.series?.[inputId];if(!input)continue;
  const observations=kind==='average'?consecutiveAverage(input.observations):annualizedMomentum(input.observations,months);
  series[id]={...input,observations,observationType:'calculated',calculation:observations[0]?.calculation??'',coverageNote:`Calculated only from this source's retained ${inputId} observations. Exact input reference dates and values are retained; no missing endpoints are filled. Historical publication dates are unknown.`};
 }
 return {...source,series};
}
