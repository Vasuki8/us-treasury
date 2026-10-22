import { requestText } from './http.mjs';

export const BLS_IDS={
  unrate:'LNS14000000',payroll:'CES0000000001',cpi:'CUUR0000SA0',participation:'LNS11300000',wages:'CES0500000003',openings:'JTS000000000000000JOL',
  cpiIndex:'CUUR0000SA0',cpiCoreIndex:'CUUR0000SA0L1E',cpiSaIndex:'CUSR0000SA0',cpiCoreSaIndex:'CUSR0000SA0L1E',
  cpiCore:'CUUR0000SA0L1E',cpiMonthly:'CUSR0000SA0',cpiCoreMonthly:'CUSR0000SA0L1E',
  payrollLevel:'CES0000000001',underemployment:'LNS13327709',employmentPopulation:'LNS12300000',weeklyHours:'CES0500000002',
};
const endpoint='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const finite=value=>typeof value==='number' && Number.isFinite(value);
const annualGrowth=new Set(['cpi','wages','cpiCore']);
const monthlyGrowth=new Set(['cpiMonthly','cpiCoreMonthly']);
const familyMetadata={
  cpiIndex:{measure:'CPI-U all-items index, U.S. city average, 1982-84=100, not seasonally adjusted',calculation:'Published all-items CPI-U index; 1982-84=100; not seasonally adjusted'},
  cpiCoreIndex:{measure:'CPI-U all items less food and energy index, U.S. city average, 1982-84=100, not seasonally adjusted',calculation:'Published CPI-U all items less food and energy index; 1982-84=100; not seasonally adjusted'},
  cpiSaIndex:{measure:'CPI-U all-items index, U.S. city average, 1982-84=100, seasonally adjusted',calculation:'Published all-items CPI-U index; 1982-84=100; seasonally adjusted'},
  cpiCoreSaIndex:{measure:'CPI-U all items less food and energy index, U.S. city average, 1982-84=100, seasonally adjusted',calculation:'Published CPI-U all items less food and energy index; 1982-84=100; seasonally adjusted'},
  cpiCore:{observationType:'calculated',measure:'Twelve-month percent change in unadjusted CPI-U all items less food and energy',calculation:'100 × (unadjusted core CPI-U index / exact year-ago month unadjusted core CPI-U index − 1)'},
  cpiMonthly:{observationType:'calculated',measure:'One-month percent change in seasonally adjusted all-items CPI-U',calculation:'100 × (seasonally adjusted all-items CPI-U index / exact previous calendar-month seasonally adjusted all-items CPI-U index − 1)'},
  cpiCoreMonthly:{observationType:'calculated',measure:'One-month percent change in seasonally adjusted CPI-U all items less food and energy',calculation:'100 × (seasonally adjusted core CPI-U index / exact previous calendar-month seasonally adjusted core CPI-U index − 1)'},
  payrollLevel:{measure:'Thousands of payroll jobs, total nonfarm, seasonally adjusted; counts jobs rather than unique people',calculation:'Published total nonfarm payroll employment level in thousands of jobs; no scaling or differencing'},
  underemployment:{measure:'U-6 labor underutilization rate: unemployed plus marginally attached plus employed part time for economic reasons, as a percent of the civilian labor force plus marginally attached; seasonally adjusted',calculation:'Published seasonally adjusted U-6 percent; no additional calculation'},
  employmentPopulation:{measure:'Employed people as a percent of the civilian noninstitutional population age 16 and over; seasonally adjusted',calculation:'Published seasonally adjusted employment-population ratio, percent; no additional calculation'},
  weeklyHours:{measure:'Average paid weekly hours of all employees on total private nonfarm payrolls, seasonally adjusted',calculation:'Published seasonally adjusted average weekly hours of all employees, total private; hours include paid leave'},
};
function offsetMonth(date,offset) {
  const parsed=new Date(`${date}T00:00:00Z`);parsed.setUTCMonth(parsed.getUTCMonth()+offset);
  return parsed.toISOString().slice(0,10);
}
function numeric(value) {
  const text=String(value??'').trim().replaceAll(',','');
  if(['','-','—','(D)','(S)','null'].includes(text))return null;
  if(!/^-?\d+(?:\.\d+)?$/.test(text))throw new Error('Invalid BLS numeric observation');
  const number=Number(text);
  if(!finite(number))throw new Error('Invalid nonfinite BLS numeric observation');
  return number;
}

export function parseBls(payload) {
  if(payload.status!=='REQUEST_SUCCEEDED')throw new Error(`BLS request failed: ${(payload.message||[]).join('; ')}`);
  const responses=payload.Results?.series;
  if(!Array.isArray(responses))throw new Error('Missing BLS series response');
  const rawSeries=new Map(),required=[...new Set(Object.values(BLS_IDS))];
  for(const code of required) {
    const matches=responses.filter(item=>item.seriesID===code);
    if(matches.length>1)throw new Error(`Duplicate BLS series: ${code}`);
    const source=matches[0];
    if(!Array.isArray(source?.data)||!source.data.length)throw new Error(`Missing BLS series: ${code}`);
    const values=new Map();
    for(const item of source.data) {
      if(!/^M(0[1-9]|1[0-2])$/.test(item.period))continue; // M13 is an annual average, not December.
      if(!/^\d{4}$/.test(item.year))throw new Error(`Invalid BLS year for ${code}`);
      const date=`${item.year}-${item.period.slice(1)}-01`;
      if(values.has(date))throw new Error(`Duplicate BLS observation ${code}: ${date}`);
      values.set(date,{date,value:numeric(item.value),publishedAt:null,sourceValue:item.value,footnotes:(item.footnotes||[]).filter(note=>note.text).map(note=>note.text)});
    }
    if(!values.size)throw new Error(`Missing monthly BLS observations for ${code}`);
    rawSeries.set(code,values);
  }
  const result={};
  for(const [id,code] of Object.entries(BLS_IDS)) {
    const values=rawSeries.get(code);
    const observations=[...values.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(item=>{
      if(id==='openings')return {...item,value:finite(item.value)?item.value/1000:null};
      if(id==='payroll'||annualGrowth.has(id)||monthlyGrowth.has(id)) {
        const baseline=values.get(offsetMonth(item.date,annualGrowth.has(id)?-12:-1));
        const valid=finite(item.value)&&finite(baseline?.value);
        const value=!valid?null:id==='payroll'?item.value-baseline.value:baseline.value===0?null:100*(item.value/baseline.value-1);
        return {...item,value,baseDate:baseline?.date??null,baseValue:baseline?.sourceValue??null};
      }
      return item;
    });
    result[id]={observations,sourceUrl:endpoint,sourceIds:[code],dataStatus:'official',calculation:id==='payroll'?'Employment level minus exact previous month, thousands of jobs':id==='openings'?'Published thousands of openings / 1000':id==='cpi'||id==='wages'?'100 × (level / exact year-ago month level − 1)':'Published seasonally adjusted percent',...(familyMetadata[id]?{observationType:'official',...familyMetadata[id]}:{})};
  }
  return result;
}

export async function collectBls({fetchImpl=globalThis.fetch,now=new Date()}={}) {
  const year=now.getUTCFullYear();
  const request=await requestText(endpoint,{fetchImpl,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seriesid:[...new Set(Object.values(BLS_IDS))],startyear:String(year-9),endyear:String(year)})});
  let payload;try{payload=JSON.parse(request.text);}catch{throw new Error('BLS did not return valid JSON');}
  const series=parseBls(payload),cutoff=now.toISOString().slice(0,10);
  for(const value of Object.values(series))value.observations=value.observations.filter(observation=>observation.date<=cutoff).slice(-120);
  const {text,...provenance}=request;
  return {id:'bls',fetchedAt:request.retrievedAt,series,provenance:[provenance],warnings:payload.message||[]};
}
