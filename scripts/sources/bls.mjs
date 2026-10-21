import { requestText } from './http.mjs';

export const BLS_IDS={unrate:'LNS14000000',payroll:'CES0000000001',cpi:'CUUR0000SA0',participation:'LNS11300000',wages:'CES0500000003',openings:'JTS000000000000000JOL'};
const endpoint='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const finite=value=>typeof value==='number' && Number.isFinite(value);
function offsetMonth(date,offset) {
  const parsed=new Date(`${date}T00:00:00Z`);parsed.setUTCMonth(parsed.getUTCMonth()+offset);
  return parsed.toISOString().slice(0,10);
}
function numeric(value) {
  const text=String(value??'').trim().replaceAll(',','');
  if(['','-','—','(D)','(S)','null'].includes(text))return null;
  if(!/^-?\d+(?:\.\d+)?$/.test(text))throw new Error('Invalid BLS numeric observation');
  return Number(text);
}

export function parseBls(payload) {
  if(payload.status!=='REQUEST_SUCCEEDED')throw new Error(`BLS request failed: ${(payload.message||[]).join('; ')}`);
  const responses=payload.Results?.series;
  if(!Array.isArray(responses))throw new Error('Missing BLS series response');
  const result={};
  for(const [id,code] of Object.entries(BLS_IDS)) {
    const source=responses.find(item=>item.seriesID===code);
    if(!source?.data?.length)throw new Error(`Missing BLS series: ${id} (${code})`);
    const values=new Map();
    for(const item of source.data) {
      if(!/^M(0[1-9]|1[0-2])$/.test(item.period))continue; // M13 is an annual average, not December.
      if(!/^\d{4}$/.test(item.year))throw new Error(`Invalid BLS year for ${code}`);
      const date=`${item.year}-${item.period.slice(1)}-01`;
      if(values.has(date))throw new Error(`Duplicate BLS observation ${code}: ${date}`);
      values.set(date,{date,value:numeric(item.value),publishedAt:null,sourceValue:item.value,footnotes:(item.footnotes||[]).filter(note=>note.text).map(note=>note.text)});
    }
    if(!values.size)throw new Error(`Missing monthly BLS observations for ${id}`);
    const observations=[...values.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(item=>{
      if(id==='openings')return {...item,value:finite(item.value)?item.value/1000:null};
      if(['payroll','cpi','wages'].includes(id)) {
        const baseline=values.get(offsetMonth(item.date,id==='payroll'?-1:-12));
        const valid=finite(item.value)&&finite(baseline?.value);
        const value=!valid?null:id==='payroll'?item.value-baseline.value:baseline.value===0?null:100*(item.value/baseline.value-1);
        return {...item,value,baseDate:baseline?.date??null,baseValue:baseline?.sourceValue??null};
      }
      return item;
    });
    result[id]={observations,sourceUrl:endpoint,sourceIds:[code],dataStatus:'official',calculation:id==='payroll'?'Employment level minus exact previous month, thousands of jobs':id==='openings'?'Published thousands of openings / 1000':id==='cpi'||id==='wages'?'100 × (level / exact year-ago month level − 1)':'Published seasonally adjusted percent'};
  }
  return result;
}

export async function collectBls({fetchImpl=globalThis.fetch,now=new Date()}={}) {
  const year=now.getUTCFullYear();
  const request=await requestText(endpoint,{fetchImpl,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seriesid:Object.values(BLS_IDS),startyear:String(year-2),endyear:String(year)})});
  let payload;try{payload=JSON.parse(request.text);}catch{throw new Error('BLS did not return valid JSON');}
  const series=parseBls(payload),cutoff=now.toISOString().slice(0,10);
  for(const value of Object.values(series))value.observations=value.observations.filter(observation=>observation.date<=cutoff).slice(-36);
  const {text,...provenance}=request;
  return {id:'bls',fetchedAt:request.retrievedAt,series,provenance:[provenance],warnings:payload.message||[]};
}
