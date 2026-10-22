import { parseCsv, requestBytes } from './http.mjs';
import { extractZipEntry } from './zip.mjs';

export const HOUSING_URL='https://www.census.gov/econ_getzippedfile/?programCode=RESCONST';
const program='New Residential Construction';
const definitions={housingStarts:'ASTARTS',housingPermits:'APERMITS',housingCompletions:'ACOMPLETIONS'};
const sectionsRequired=['CATEGORIES','DATA TYPES','ERROR TYPES','GEO LEVELS','TIME PERIODS','NOTES','DATA UPDATED ON','DATA'];
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const fail=message=>{throw new Error(`Invalid Census housing data: ${message}`);};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
function table(sections,name,header) {
  const [actual,...rows]=sections.get(name)??[];
  if(!actual||actual.join(',')!==header||rows.some(row=>row.length!==actual.length))fail(`${name} headers or row schema`);
  return rows;
}
function metadata(rows,code) {
  const found=rows.filter(row=>row[1]===code);
  if(found.length!==1)fail(`missing or duplicate metadata ${code}`);
  return found[0];
}

/** Native published thousands of units at SAAR; never multiply by twelve again. */
export function parseHousingCsv(text,{now=new Date()}={}) {
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail('capture date');
  const sections=new Map();let current;
  for(const row of parseCsv(text)) {
    if(row.length===1&&sectionsRequired.includes(row[0])) {
      if(sections.has(row[0]))fail(`duplicate section ${row[0]}`);
      current=[];sections.set(row[0],current);
    } else {if(!current)fail('missing section marker');current.push(row);}
  }
  if(sectionsRequired.some(name=>!sections.has(name)))fail('missing required section');
  const categories=table(sections,'CATEGORIES','cat_idx,cat_code,cat_desc,cat_indent');
  const types=table(sections,'DATA TYPES','dt_idx,dt_code,dt_desc,dt_unit');
  const geographies=table(sections,'GEO LEVELS','geo_idx,geo_code,geo_desc');
  for(const rows of [categories,types,geographies])if(new Set(rows.map(row=>row[0])).size!==rows.length)fail('duplicate metadata index');
  const type=metadata(types,'TOTAL'),geo=metadata(geographies,'US');
  if(type[3]!=='K')fail('housing total units must be thousands');
  const ids=new Map(Object.entries(definitions).map(([id,code])=>[metadata(categories,code)[0],id]));
  const periods=new Map(),dates=new Set();
  for(const [index,name]of table(sections,'TIME PERIODS','per_idx,per_name')) {
    const match=/^([A-Z][a-z]{2})-(\d{4})$/.exec(name),month=match?months.indexOf(match[1]):-1;
    if(!/^\d+$/.test(index)||month<0||Number(match[2])<1900)fail('invalid monthly period');
    const date=`${match[2]}-${String(month+1).padStart(2,'0')}-01`;
    if(periods.has(index)||dates.has(date))fail('duplicate monthly period');
    periods.set(index,date);dates.add(date);
  }
  const values=Object.fromEntries(Object.keys(definitions).map(id=>[id,new Map()]));
  for(const [period,category,datatype,error,geography,adjusted,raw]of table(sections,'DATA','per_idx,cat_idx,dt_idx,et_idx,geo_idx,is_adj,val')) {
    const id=ids.get(category);
    if(!id||datatype!==type[0]||error!=='0'||geography!==geo[0]||adjusted!=='1')continue;
    const date=periods.get(period);if(!date)fail('unknown observation period');
    if(values[id].has(date))fail('duplicate housing observation');
    const sourceValue=raw.trim(),missing=['','NA','(NA)','(S)','(D)','Z','-'].includes(sourceValue);
    if(!missing&&!/^\d+(?:\.\d+)?$/.test(sourceValue))fail('invalid numeric housing value');
    const value=missing?null:Number(sourceValue);
    if(value!==null&&!finite(value))fail('nonfinite housing value');
    values[id].set(date,{date,value,sourceValue,publishedAt:null,footnotes:[]});
  }
  const cutoff=now.toISOString().slice(0,10),series={};
  for(const [id,code]of Object.entries(definitions)) {
    const observations=[...values[id].values()].filter(row=>row.date>='2000-01-01'&&row.date<=cutoff).sort((a,b)=>a.date.localeCompare(b.date));
    if(!observations.some(row=>finite(row.value)))fail(`no usable ${id} observations`);
    series[id]={observations,sourceIds:[`RESCONST:${code}:TOTAL:US:SA`]};
  }
  const update=sections.get('DATA UPDATED ON');
  if(update.length!==1||!update[0].length)fail('file update metadata');
  return {series,fileUpdatedAt:update[0].join(','),notes:sections.get('NOTES').flat()};
}

export async function collectHousing({fetchImpl=globalThis.fetch,now=new Date()}={}) {
  const request=await requestBytes(HOUSING_URL,{maxBytes:8*1024*1024,headers:{Accept:'application/zip, application/octet-stream'},fetchImpl:async(url,options)=>{
    const response=await fetchImpl(url,options);
    if(response.redirected||(response.url&&response.url!==url))throw new Error('Unreviewed Census housing source URL or redirect');
    return response;
  }});
  const parsed=parseHousingCsv(extractZipEntry(request.bytes,'RESCONST-mf.csv').toString('utf8'),{now});
  const readme=extractZipEntry(request.bytes,'/README',{maxOutputBytes:128*1024}).toString('utf8');
  const usageNote=/Data Usage and Attribution\s*\n[=]+\s*\n([^]*?)(?:\nContacts|$)/.exec(readme)?.[1]?.trim();
  if(!usageNote?.includes('U.S. Census Bureau')||!usageNote.includes('originating'))fail('missing source attribution instructions');
  const coverageNote='Total new privately owned housing units, United States, from January 2000, monthly seasonally adjusted annual rates in thousands of units. These are annual rate estimates, not actual monthly construction counts. Permits cover permit-issuing places; starts and completions use the Survey of Construction. Estimates are revisable; published missing values remain unavailable. Earlier reference dates are first captured on the actual new retrieval date, not backdated publication vintages.';
  const series=Object.fromEntries(Object.entries(parsed.series).map(([id,item])=>[id,{...item,sourceUrl:HOUSING_URL,sourceTitle:program,unit:'Thousands of units, SAAR',frequency:'Monthly',adjustment:'Seasonally adjusted annual rate',observationType:'official',dataStatus:'official',calculation:'Published Census total United States annual-rate series, seasonally adjusted, in thousands of housing units. No extra annualization or unit conversion.',coverageNote,licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',attribution:`Source: U.S. Census Bureau, ${program}.`,programName:program}]));
  const {bytes,...metadata}=request;
  return {id:'housing',fetchedAt:request.retrievedAt,series,coverageNote,provenance:[{...metadata,filename:'RESCONST-mf.csv',fileUpdatedAt:parsed.fileUpdatedAt,usageNote}],warnings:parsed.notes};
}
