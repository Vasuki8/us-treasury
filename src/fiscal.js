/** Arithmetic from aligned MTS monthly values; never a forecast or release clock. */
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const month=(date,offset=0)=>new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7))-1+offset,1)).toISOString().slice(0,10);
function index(observations=[]){
  const result=new Map();
  for(const row of observations){
    if(!/^\d{4}-\d{2}-01$/.test(row.date)||month(row.date)!==row.date)throw new Error('Invalid fiscal month date');
    if(result.has(row.date))throw new Error('Duplicate fiscal month');
    result.set(row.date,finite(row.value)?row.value:null);
  }
  return result;
}
function inputs(source){return Object.fromEntries(['receipts','outlays','netInterest'].map(id=>[id,index(source?.series?.[id]?.observations)]));}
const subtract=(a,b)=>finite(a)&&finite(b)?a-b:null;
function trailing(values,date){const window=Array.from({length:12},(_,i)=>values.get(month(date,-i)));return window.every(finite)?window.reduce((a,b)=>a+b,0):null;}
const calculations={
  budgetDeficit:'Monthly outlays minus receipts; positive is deficit, negative is surplus',
  primaryDeficit:'Monthly outlays minus receipts minus net budget interest; positive is primary deficit',
  receiptsTtm:'Sum of receipts over 12 exact consecutive calendar months; incomplete windows are missing',
  outlaysTtm:'Sum of outlays over 12 exact consecutive calendar months; incomplete windows are missing',
  netInterestTtm:'Sum of net budget interest over 12 exact consecutive calendar months; incomplete windows are missing',
  primaryDeficitTtm:'Trailing 12-month outlays minus receipts minus net budget interest',
  interestRevenueRatio:'100 × trailing 12-month net budget interest / trailing 12-month receipts; zero denominator is missing',
};
export function deriveFiscalSeries(source={}){
  const maps=inputs(source),dates=[...new Set(Object.values(maps).flatMap(map=>[...map.keys()]))].sort();
  const result=Object.fromEntries(Object.entries(calculations).map(([id,calculation])=>[id,{observations:[],calculation,sourceIds:['MTS:calculated:'+id],sourceUrl:source.series?.receipts?.sourceUrl,coverageNote:source.coverageNote??''}]));
  for(const date of dates){
    const receipts=maps.receipts.get(date),outlays=maps.outlays.get(date),interest=maps.netInterest.get(date);
    const r=trailing(maps.receipts,date),o=trailing(maps.outlays,date),n=trailing(maps.netInterest,date);
    const values={budgetDeficit:subtract(outlays,receipts),primaryDeficit:subtract(subtract(outlays,receipts),interest),receiptsTtm:r,outlaysTtm:o,netInterestTtm:n,primaryDeficitTtm:subtract(subtract(o,r),n),interestRevenueRatio:finite(n)&&finite(r)&&r!==0?100*n/r:null};
    for(const [id,value] of Object.entries(values))result[id].observations.push({date,value:finite(value)?Number(value.toFixed(10)):null,publishedAt:null});
  }
  return result;
}
/** Accounting attribution, not a causal model. Positive contributors widen a deficit. */
export function fiscalContributors(source={}){
  const maps=inputs(source),date=[...maps.receipts.keys()].sort().at(-1);
  if(!date)return null;
  const priorDate=month(date,-12);
  if(!Object.values(maps).every(map=>finite(map.get(date))&&finite(map.get(priorDate))))return null;
  const delta=id=>maps[id].get(date)-maps[id].get(priorDate);
  return {date,priorDate,basis:'Monthly year over year',receipts:-delta('receipts'),primaryOutlays:delta('outlays')-delta('netInterest'),netInterest:delta('netInterest'),deficitChange:delta('outlays')-delta('receipts')};
}
export function fiscalCategoryChanges(source={}){
  const latest=source.monthly?.at(-1),prior=source.monthly?.find(row=>row.date===month(latest.date,-12));
  if(!latest||!prior)return [];
  return ['receipts','outlays'].flatMap(group=>{
    const previous=new Map((prior.contributors?.[group]??[]).map(row=>[row.name,row.value]));
    return (latest.contributors?.[group]??[]).filter(row=>finite(row.value)&&finite(previous.get(row.name))).map(row=>({group:group==='receipts'?'Receipts':'Outlays',name:row.name,current:row.value,prior:previous.get(row.name),deficitContribution:(row.value-previous.get(row.name))*(group==='receipts'?-1:1)}));
  }).sort((a,b)=>Math.abs(b.deficitContribution)-Math.abs(a.deficitContribution));
}
