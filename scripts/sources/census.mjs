import { parseCsv, requestBytes } from './http.mjs';
import { extractZipEntry } from './zip.mjs';

export const CENSUS_URL='https://www.census.gov/econ_getzippedfile/?programCode=MARTS';
const PROGRAM='Advance Monthly Retail Trade Survey (MARTS)';
const SECTIONS=['CATEGORIES','DATA TYPES','ERROR TYPES','GEO LEVELS','TIME PERIODS','NOTES','DATA UPDATED ON','DATA'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const fail=message=>{throw new Error(`Invalid Census MARTS data: ${message}`);};

function table(sections,name,header) {
  const [actual,...rows]=sections.get(name)||[];
  if(!actual||actual.join(',')!==header)fail(`${name} headers`);
  if(rows.some(row=>row.length!==actual.length))fail(`${name} row schema`);
  return rows;
}
function metadataIndex(rows,code,column=1) {
  const matches=rows.filter(row=>row[column]===code);
  if(matches.length!==1)fail(`missing or duplicate metadata code ${code}`);
  return matches[0];
}
function sales(raw) {
  const text=raw.trim();
  if(['','NA','(NA)','(S)','(D)','Z','-'].includes(text))return null;
  if(!/^\d+(?:\.\d+)?$/.test(text)||!Number.isFinite(Number(text)))fail('invalid numeric sales value');
  return Number(text);
}
function previousMonth(date) {
  const parsed=new Date(`${date}T00:00:00Z`);parsed.setUTCMonth(parsed.getUTCMonth()-1);
  return parsed.toISOString().slice(0,10);
}

export function parseCensusCsv(text,{now=new Date()}={}) {
  const sections=new Map();let current;
  for(const row of parseCsv(text)) {
    if(row.length===1&&SECTIONS.includes(row[0])) {
      if(sections.has(row[0]))fail(`duplicate ${row[0]} section`);
      current=[];sections.set(row[0],current);
    } else {
      if(!current)fail('missing section marker');
      current.push(row);
    }
  }
  if(SECTIONS.some(name=>!sections.has(name)))fail('missing required section');
  const categories=table(sections,'CATEGORIES','cat_idx,cat_code,cat_desc,cat_indent');
  const types=table(sections,'DATA TYPES','dt_idx,dt_code,dt_desc,dt_unit');
  const geographies=table(sections,'GEO LEVELS','geo_idx,geo_code,geo_desc');
  const category=metadataIndex(categories,'44X72'),type=metadataIndex(types,'SM'),geography=metadataIndex(geographies,'US');
  if(type[3]!=='MLN$')fail('sales metadata must use millions of dollars');
  for(const rows of [categories,types,geographies])if(new Set(rows.map(row=>row[0])).size!==rows.length)fail('duplicate metadata index');
  const periods=new Map(),dates=new Set();
  for(const [index,name] of table(sections,'TIME PERIODS','per_idx,per_name')) {
    const match=/^([A-Z][a-z]{2})-(\d{4})$/.exec(name),month=match?MONTHS.indexOf(match[1]):-1;
    if(!/^\d+$/.test(index)||month<0)fail('invalid monthly period');
    const date=`${match[2]}-${String(month+1).padStart(2,'0')}-01`;
    if(periods.has(index)||dates.has(date))fail('duplicate monthly period');
    periods.set(index,date);dates.add(date);
  }
  const values=new Map(),cutoff=now.toISOString().slice(0,10);
  for(const [period,cat,datatype,error,geo,adjusted,raw] of table(sections,'DATA','per_idx,cat_idx,dt_idx,et_idx,geo_idx,is_adj,val')) {
    if(cat!==category[0]||datatype!==type[0]||error!=='0'||geo!==geography[0]||adjusted!=='1')continue;
    const date=periods.get(period);if(!date)fail('unknown observation period');
    if(values.has(date))fail(`duplicate observation ${date}`);
    values.set(date,{date,value:sales(raw),sourceValue:raw,publishedAt:null,footnotes:[]});
  }
  const latestDate=[...values.keys()].sort().at(-1);
  let observations=[...values.values()].filter(row=>row.date<=cutoff).sort((a,b)=>a.date.localeCompare(b.date));
  observations=observations.map(row=>{
    const baseline=values.get(previousMonth(row.date));
    return {...row,value:finite(row.value)&&finite(baseline?.value)&&baseline.value!==0?100*(row.value/baseline.value-1):null,
      baseDate:baseline?.date??null,baseValue:baseline?.sourceValue??null,
      footnotes:row.date===latestDate?['Advance estimate; subject to revision. Nominal sales adjusted for seasonal, holiday and trading-day differences, not price changes.']:[]};
  }).slice(-36);
  if(!observations.some(row=>finite(row.value)))fail('no usable monthly growth observations');
  const update=sections.get('DATA UPDATED ON');
  if(update.length!==1||!update[0].length)fail('file update metadata');
  return {observations,fileUpdatedAt:update[0].join(','),notes:sections.get('NOTES').flat()};
}

export async function collectCensus({fetchImpl=globalThis.fetch,now=new Date()}={}) {
  const request=await requestBytes(CENSUS_URL,{fetchImpl,maxBytes:8*1024*1024,headers:{Accept:'application/zip, application/octet-stream'}});
  const parsed=parseCensusCsv(extractZipEntry(request.bytes,'MARTS-mf.csv').toString('utf8'),{now});
  const readme=extractZipEntry(request.bytes,'/README',{maxOutputBytes:128*1024}).toString('utf8');
  const usageNote=/Data Usage and Attribution\s*\n[=]+\s*\n([\s\S]*?)(?:\nContacts|$)/.exec(readme)?.[1]?.trim();
  if(!usageNote||!usageNote.includes('U.S. Census Bureau')||!usageNote.includes('originating'))fail('missing source attribution instructions');
  const {bytes,...metadata}=request;
  return {id:'census',fetchedAt:request.retrievedAt,series:{retail:{observations:parsed.observations,sourceUrl:CENSUS_URL,
    sourceIds:['MARTS:44X72:SM:US:SA'],dataStatus:'official',calculation:'100 × (seasonally adjusted nominal sales / exact previous-month sales − 1)',
    attribution:`Source: U.S. Census Bureau, ${PROGRAM}. Monthly percent changes calculated from published sales levels.`,programName:PROGRAM}},
    provenance:[{...metadata,filename:'MARTS-mf.csv',fileUpdatedAt:parsed.fileUpdatedAt,usageNote}],warnings:parsed.notes};
}
