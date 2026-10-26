import { requestText } from './http.mjs';

export const INDUSTRIAL_PRODUCTION_URL='https://www.federalreserve.gov/releases/g17/Current/ipdisk/ip_sa.txt';
export const CAPACITY_UTILIZATION_URL='https://www.federalreserve.gov/releases/g17/Current/ipdisk/utl_sa.txt';
const terms='https://www.federalreserve.gov/disclaimer.htm';
const fail=message=>{throw new Error(`Invalid G17 data: ${message}`);};
const finite=value=>typeof value==='number'&&Number.isFinite(value);

/** Annual text rows carry twelve monthly source values, not annual averages. */
export function parseG17Total(text,{now=new Date(),kind='production'}={}) {
  if (!(now instanceof Date)||!Number.isFinite(now.getTime())||!['production','utilization'].includes(kind))fail('capture date or measure');
  if(typeof text!=='string'||(text.match(/^"B50001: Total index"\s*$/gm)??[]).length!==1)fail('missing or duplicate total index description');
  const years=new Map();
  for(const line of text.split(/\r?\n/)) {
    if(!/^"B50001"/.test(line))continue;
    const match=/^"B50001"\s+(\d{4})\s+(.+?)\s*$/.exec(line);
    if(!match)fail('total index annual row');
    const year=Number(match[1]),tokens=match[2].split(/\s+/);
    if(year<1919||tokens.length<1||tokens.length>12)fail('total index year or month count');
    if(years.has(year))fail('duplicate total index year');
    const rows=tokens.map((sourceValue,index)=>{
      const missing=['NA','ND','n.a.','.'].includes(sourceValue);
      if(!missing&&!/^\d+(?:\.\d+)?$/.test(sourceValue))fail('numeric total index value');
      const value=missing?null:Number(sourceValue);
      if(value!==null&&!finite(value))fail('nonfinite total index value');
      return {date:`${year}-${String(index+1).padStart(2,'0')}-01`,value,sourceValue,publishedAt:null};
    });
    years.set(year,rows);
  }
  // A rebasing must not silently retain the old Index 2017=100 label.
  if(kind==='production') {
    const base=years.get(2017);
    if(base?.length!==12||base.some(row=>!finite(row.value))||Math.abs(base.reduce((sum,row)=>sum+row.value,0)/12-100)>0.01)fail('industrial production index base changed or missing');
  }
  const cutoff=now.toISOString().slice(0,10);
  const observations=[...years.values()].flat().filter(row=>row.date<=cutoff).sort((a,b)=>a.date.localeCompare(b.date));
  if(!observations.some(row=>finite(row.value)))fail('no usable total index observations');
  return observations;
}

async function capture(url,fetchImpl) {
  return requestText(url,{maxBytes:5*1024*1024,fetchImpl:async(value,options)=>{
    const response=await fetchImpl(value,options);
    if(response.redirected||(response.url&&response.url!==value))throw new Error('Unreviewed G17 source URL or redirect');
    return response;
  }});
}

export async function collectActivity({fetchImpl=globalThis.fetch,now=new Date()}={}) {
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail('capture date');
  const [production,utilization]=await Promise.all([INDUSTRIAL_PRODUCTION_URL,CAPACITY_UTILIZATION_URL].map(url=>capture(url,fetchImpl)));
  const coverageNote='Full published monthly seasonally adjusted total U.S. industrial-sector histories, with production from January 1919 and capacity utilization from January 1967, covering manufacturing, mining, and utilities. Latest revised history; monthly and annual revisions can change previous observations. Earlier reference dates are first captured on the actual new retrieval date. Historical release dates are not inferred.';
  const common={frequency:'Monthly',adjustment:'Seasonally adjusted',observationType:'official',dataStatus:'official',attribution:'Source: Board of Governors of the Federal Reserve System, G.17 Industrial Production and Capacity Utilization.',licenseUrl:terms,coverageNote};
  const series={
    industrialProduction:{...common,observations:parseG17Total(production.text,{now,kind:'production'}),sourceIds:['IP.B50001.SA'],sourceUrl:INDUSTRIAL_PRODUCTION_URL,sourceTitle:'G.17 Total Industrial Production',unit:'Index 2017=100',calculation:'Published B50001 total industrial production seasonally adjusted index, 2017=100. No growth rate or annualization is applied.'},
    capacityUtilization:{...common,observations:parseG17Total(utilization.text,{now,kind:'utilization'}),sourceIds:['CAPUTL.B50001.SA'],sourceUrl:CAPACITY_UTILIZATION_URL,sourceTitle:'G.17 Total Industry Capacity Utilization',unit:'Percent',calculation:'Published B50001 total industry capacity utilization, seasonally adjusted percent. This is a utilization rate, not the industrial production index.'},
  };
  const provenance=[production,utilization].map(({text,...metadata})=>metadata);
  return {id:'activity',fetchedAt:provenance.map(row=>row.retrievedAt).sort().at(-1),series,provenance,coverageNote,warnings:['Industrial production covers industry, not the entire economy.','Missing source observations remain unavailable; no dates are filled.']};
}
