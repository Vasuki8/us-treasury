import { setTimeout as delay } from 'node:timers/promises';
import { OfficialSourceHttpError, requestText } from './http.mjs';
import { BLS_API_V1, BLS_API_V2 } from '../bls-api-policy.mjs';
import { addMomentumSeries } from '../../src/momentum.js';

export const BLS_IDS={
  unrate:'LNS14000000',payroll:'CES0000000001',cpi:'CUUR0000SA0',participation:'LNS11300000',wages:'CES0500000003',openings:'JTS000000000000000JOL',
  cpiIndex:'CUUR0000SA0',cpiCoreIndex:'CUUR0000SA0L1E',cpiSaIndex:'CUSR0000SA0',cpiCoreSaIndex:'CUSR0000SA0L1E',
  cpiCore:'CUUR0000SA0L1E',cpiMonthly:'CUSR0000SA0',cpiCoreMonthly:'CUSR0000SA0L1E',
  payrollLevel:'CES0000000001',underemployment:'LNS13327709',employmentPopulation:'LNS12300000',weeklyHours:'CES0500000002',
};
export const BLS_DEPTH_IDS={hiresRate:'JTS000000000000000HIR',quitsRate:'JTS000000000000000QUR',layoffsRate:'JTS000000000000000LDR',primeAgeEmploymentPopulation:'LNS12300060',primeAgeParticipation:'LNS11300060',eciCompensation:'CIS1010000000000I',laborProductivity:'PRS85006092',unitLaborCosts:'PRS85006112'};
const quarterlyDepth=new Set(['eciCompensation','laborProductivity','unitLaborCosts']);
const endpoint=BLS_API_V1;
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

/** Quarterly source periods have Q01-Q04, not March/June monthly observations. */
export function parseBlsEconomicDepth(payload) {
  if(payload.status!=='REQUEST_SUCCEEDED')throw new Error(`BLS request failed: ${(payload.message||[]).join('; ')}`);
  const responses=payload.Results?.series;
  if(!Array.isArray(responses))throw new Error('Missing BLS series response');
  const result={};
  for(const [id,code]of Object.entries(BLS_DEPTH_IDS)){
    const sources=responses.filter(row=>row.seriesID===code);
    if(sources.length!==1||!Array.isArray(sources[0].data)||!sources[0].data.length)throw new Error(`Missing or duplicate BLS series: ${code}`);
    const quarterly=quarterlyDepth.has(id),seen=new Set(),observations=[];
    for(const row of sources[0].data){
      if(row.period===(quarterly?'Q05':'M13'))continue;
      if(!(quarterly?/^Q0[1-4]$/:/^M(?:0[1-9]|1[0-2])$/).test(row.period)||!/^\d{4}$/.test(row.year)||row.year==='0000')throw new Error(`Invalid BLS ${quarterly?'quarterly':'monthly'} period for ${code}`);
      const month=quarterly?(Number(row.period.slice(1))-1)*3+1:Number(row.period.slice(1));
      const date=`${row.year}-${String(month).padStart(2,'0')}-01`;
      if(seen.has(date))throw new Error(`Duplicate BLS observation ${code}: ${date}`);seen.add(date);
      observations.push({date,value:numeric(row.value),sourceValue:row.value,publishedAt:null,footnotes:(row.footnotes??[]).filter(note=>note.text).map(note=>note.text)});
    }
    if(!observations.length)throw new Error(`Missing BLS observations for ${code}`);
    observations.sort((a,b)=>a.date.localeCompare(b.date));
    const calculation=id==='eciCompensation'?'Published civilian-worker total compensation Employment Cost Index, all industries and occupations; December 2005=100, seasonally adjusted; includes wages, salaries and employer benefit costs.':id==='laborProductivity'||id==='unitLaborCosts'?`Published nonfarm business ${id==='laborProductivity'?'labor productivity (real output per hour)':'unit labor cost (hourly compensation relative to labor productivity)'} growth; percent change from the preceding quarter, seasonally adjusted annual rate; not annualized again.`:id.startsWith('primeAge')?`Published seasonally adjusted ${id==='primeAgeParticipation'?'labor force participation':'employment-population'} ratio, civilian noninstitutional population aged 25–54; percent.`:`Published total nonfarm JOLTS ${id==='hiresRate'?'hires':id==='quitsRate'?'quits':'layoffs and discharges'} during the month / employment × 100; seasonally adjusted rate, not a level or the openings-rate denominator.`;
    result[id]={observations,sourceUrl:endpoint,sourceIds:[code],calculation,observationType:'official',dataStatus:'official'};
  }
  const byDate=new Map(result.eciCompensation.observations.map(row=>[row.date,row]));
  result.eciCompensationQuarterly={...result.eciCompensation,observationType:'calculated',calculation:'100 × (seasonally adjusted civilian total compensation ECI / exact previous-quarter index − 1); quarterly percent change calculated from the published indexes, not annualized and not the independently rounded published ECI growth rate.',observations:result.eciCompensation.observations.map(row=>{
    const baseline=byDate.get(offsetMonth(row.date,-3));
    return {...row,value:finite(row.value)&&finite(baseline?.value)&&baseline.value!==0?100*(row.value/baseline.value-1):null,baseDate:baseline?.date??null,baseValue:baseline?.sourceValue??null};
  })};
  return result;
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

function configuredKey(apiKey) {
  return typeof apiKey==='string'?apiKey.trim():'';
}

function containsKey(value,apiKey) {
  if(!apiKey)return false;
  if(typeof value==='string')return [apiKey,encodeURIComponent(apiKey)].some(key=>value.includes(key));
  return value&&typeof value==='object'&&Object.entries(value).some(([key,item])=>containsKey(key,apiKey)||containsKey(item,apiKey));
}

async function collectEndpoint(url,{fetchImpl,now,apiKey,registered=false}) {
  const year=now.getUTCFullYear();
  const request=await requestText(url,{fetchImpl:async(requested,options)=>{
    const response=await fetchImpl(requested,{...options,redirect:'manual'});
    if(response.redirected||response.url&&response.url!==url||response.status>=300&&response.status<400)throw new Error('BLS source redirects are not permitted');
    if(apiKey&&[...response.headers].some(([name,value])=>containsKey(`${name}:${value}`,apiKey)))throw new Error('BLS response included credential material');
    return response;
  },method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({seriesid:[...new Set([...Object.values(BLS_IDS),...Object.values(BLS_DEPTH_IDS)])],startyear:String(year-9),endyear:String(year),...(registered?{registrationkey:apiKey}:{})})});
  let payload;try{payload=JSON.parse(request.text);}catch{throw new Error('BLS did not return valid JSON');}
  if(containsKey(payload,apiKey))throw new Error('BLS response included credential material');
  if(registered){
    if(payload?.status!=='REQUEST_SUCCEEDED'||!Array.isArray(payload.message)||payload.message.length)throw new Error('Registered BLS API response was not successful');
    const quarterlyIds=new Set([...quarterlyDepth].map(id=>BLS_DEPTH_IDS[id]));
    for(const source of payload.Results?.series??[])for(const row of source.data??[]){
      const valid=quarterlyIds.has(source.seriesID)?/^Q0[1-5]$/:/^M(?:0[1-9]|1[0-3])$/;
      if(!valid.test(row.period)||!/^\d{4}$/.test(row.year)||row.year==='0000')throw new Error('Invalid registered BLS source period');
    }
  }
  const series={...parseBls(payload),...parseBlsEconomicDepth(payload)},cutoff=now.toISOString().slice(0,10);
  for(const value of Object.values(series)){
    value.sourceUrl=url;
    value.observations=value.observations.filter(observation=>observation.date<=cutoff).slice(-120);
    if(registered&&!value.observations.some(row=>finite(row.value)))throw new Error('Missing registered BLS numeric observations within the current window');
  }
  const {text,...provenance}=request;
  return {id:'bls',fetchedAt:request.retrievedAt,series,provenance:[provenance],warnings:registered?[]:payload.message||[]};
}

/** One authenticated request, also used by the read-only credential diagnostic. */
export async function collectRegisteredBls({fetchImpl=globalThis.fetch,now=new Date(),apiKey=process.env.BLS_API_KEY,pause=delay}={}) {
  const key=configuredKey(apiKey);
  if(!key)throw new Error('A BLS_API_KEY is required for registered BLS access');
  try {
    return await collectEndpoint(BLS_API_V2,{fetchImpl,now,apiKey:key,registered:true});
  } catch(error) {
    if(error instanceof OfficialSourceHttpError&&Number.isInteger(error.status)&&error.status>=100&&error.status<=599)throw new OfficialSourceHttpError(error.status,BLS_API_V2);
    throw new Error('Registered BLS request failed or its response could not be validated');
  }
}

function assertRegisteredCoverage(result,previous,now) {
  const start=`${now.getUTCFullYear()-9}-01-01`,cutoff=now.toISOString().slice(0,10);
  for(const [id,series] of Object.entries(result.series)){
    const prior=(previous?.series?.[id]?.observations??[]).filter(row=>row.date>=start&&row.date<=cutoff);
    const dates=new Set(series.observations.map(row=>row.date));
    const latestUsable=rows=>rows.reduce((latest,row)=>finite(row.value)&&row.date>latest?row.date:latest,'');
    if(prior.some(row=>!dates.has(row.date))||latestUsable(series.observations)<latestUsable(prior))throw new Error('Registered BLS response regressed retained coverage');
  }
}

export async function collectBls({fetchImpl=globalThis.fetch,now=new Date(),apiKey=process.env.BLS_API_KEY,pause=delay,previous}={}) {
  const key=configuredKey(apiKey);
  try {
    return await collectEndpoint(BLS_API_V1,{fetchImpl,now,apiKey:key});
  } catch(error) {
    if(!key||!(error instanceof OfficialSourceHttpError)||error.status!==503||error.redirected||error.requestedUrl!==BLS_API_V1||error.url!==BLS_API_V1)throw error;
    try {
      await pause(1000);
      const result=await collectRegisteredBls({fetchImpl,now,apiKey:key,pause});
      assertRegisteredCoverage(addMomentumSeries(result),previous,now);
      result.warnings.push('Primary BLS v1 returned HTTP 503; collected the complete family from registered BLS v2.');
      return result;
    } catch(backupError) {
      const diagnosis=backupError instanceof OfficialSourceHttpError&&Number.isInteger(backupError.status)&&backupError.status>=100&&backupError.status<=599?`HTTP ${backupError.status}`:'request or validation failure';
      error.message+=`; registered BLS backup failed (${diagnosis}).`;
      throw error;
    }
  }
}
