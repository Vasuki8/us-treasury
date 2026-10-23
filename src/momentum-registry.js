import { momentumInputs } from './momentum.js';
import { macroRegistry } from './macro-registry.js';

export const momentumRegistry=Object.fromEntries(Object.entries(momentumInputs).map(([id,[input,months,kind]])=>{
 const base=input==='payroll'?{agency:'bls',topic:'Labor',frequency:'Monthly',adjustment:'Seasonally adjusted',source:{name:'Bureau of Labor Statistics',url:'https://www.bls.gov/ces/'},unit:'Thousands of jobs',format:'thousands',code:'CES0000000001',precision:1}:macroRegistry[input];
 const name=kind==='average'?'Nonfarm payroll gains · three-month average':`${input.startsWith('cpi')?'CPI':'PCE'} ${/Core/.test(input)?'core':'headline'} inflation · ${months}-month annualized`;
 return [id,{...base,id,name,short:name,comparisonClass:kind==='average'?'change':'growth',observationType:'calculated',unit:kind==='average'?base.unit:'Percent annualized',format:kind==='average'?'thousands':'percent',precision:2,code:`${base.code} ${months}M ${kind==='average'?'AVG':'ANNUALIZED'}`,definition:kind==='average'?'Average of three exact consecutive monthly payroll job-change observations from one retained source vintage; not a growth rate.':`100 × [(seasonally adjusted price index at t / index at t-${months} months)^${12/months} − 1]. Exact endpoints from one retained vintage. This is annualized short-horizon momentum, distinct from monthly and year-over-year inflation.`}];
}));
