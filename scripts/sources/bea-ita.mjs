import {requestBytes,parseCsv} from './http.mjs';
import {currentAccountDefinitions,currentAccountRegistry,BEA_ITA_URL,BEA_ITA_LICENSE,itaLocator} from '../../src/current-account-registry.js';
import {isIsoDate} from '../../src/date-window.js';
import {itaSourceNumber,itaQuarterEnd,assertItaReconciliation} from '../bea-ita-policy.mjs';
const fail=message=>{throw new Error(`Invalid BEA ITA table: ${message}`);};
const clean=value=>String(value??'').replaceAll('\u00a0',' ').replace(/\s+/g,' ').trim();
function englishDate(value){
 const match=/^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(value),months=['January','February','March','April','May','June','July','August','September','October','November','December'];
 if(!match||!months.includes(match[1]))fail('release date format');
 const date=`${match[3]}-${String(months.indexOf(match[1])+1).padStart(2,'0')}-${match[2].padStart(2,'0')}`;
 if(!isIsoDate(date))fail('release date');return date;
}
export function parseBeaItaCsv(text,{now=new Date()}={}){
 if(typeof text!=='string'||text.length>2*1024*1024)fail('response size');
 const rows=parseCsv(text);
 if(clean(rows[0]?.[0])!=='Table 1.1. U.S. International Transactions'||clean(rows[1]?.[0])!=='[Millions of dollars]'||clean(rows[2]?.[0])!=='Bureau of Economic Analysis')fail('table identity or unit header');
 if(!rows.some(row=>clean(row[0])==='Quarterly estimates are not annualized and are expressed at quarterly rates.'))fail('quarterly annualization declaration');
 const release=/^Release Date: (.+) - Next Release Date: (.+)$/.exec(clean(rows[3]?.[0]));if(!release)fail('release header');
 const tableReleaseDate=englishDate(release[1]),nextReleaseDate=englishDate(release[2]);
 if(!Number.isFinite(now?.getTime())||tableReleaseDate>now.toISOString().slice(0,10)||nextReleaseDate<=tableReleaseDate)fail('release date sequence or future release');
 const header=rows.findIndex(row=>clean(row[0])==='Line'&&row.some(value=>clean(value)==='Seasonally adjusted'));
 if(header<0||rows[header].length>5000||rows[header+1]?.length!==rows[header].length||rows[header+2]?.length!==rows[header].length)fail('three-row quarterly header');
 const columns=[],seen=new Set();
 for(let index=2;index<rows[header].length;index++){
  if(clean(rows[header][index])!=='Seasonally adjusted')continue;
  const year=clean(rows[header+1][index]),quarter=clean(rows[header+2][index]);
  if(!/^(?:19|20)\d{2}$/.test(year)||!/^Q[1-4]$/.test(quarter))fail('SA quarter/year header');
  const date=`${year}-${String((Number(quarter[1])-1)*3+1).padStart(2,'0')}-01`;
  if(seen.has(date))fail('duplicate SA quarter column');seen.add(date);columns.push({index,date,label:year+quarter});
 }
 if(!columns.length)fail('no seasonally adjusted quarterly columns');columns.sort((a,b)=>a.date.localeCompare(b.date));
 const series={};
 for(const [id,line,label] of currentAccountDefinitions){
  const matches=rows.slice(header+3).filter(row=>clean(row[0])===line);
  if(matches.length!==1)fail('missing or duplicate balance row '+line);
  const row=matches[0],description=clean(row[1]);
  if(row.length!==rows[header].length||description.replace(/(?:\s+\/\d+\/)+$/,'')!==label)fail('balance row label or width '+line);
  const noteIds=[...description.matchAll(/\/(\d+)\//g)].map(match=>match[1]);
  const notes=noteIds.flatMap(number=>rows.filter(row=>row.length===1&&clean(row[0]).startsWith(number+'. ')).map(row=>clean(row[0]).replace(/<[^>]*>/g,'')));
  const observations=columns.flatMap(column=>{
   const raw=row[column.index],value=itaSourceNumber(raw);
   if(itaQuarterEnd(column.date)>tableReleaseDate){if(value!==null)fail('numeric future quarter');return [];}
   return [{date:column.date,value:value===null?null:value/1000,sourceValue:raw,sourcePeriodLabel:column.label,publishedAt:null,footnotes:[...notes,...(value===null?[`BEA source marker ${clean(raw)||'(blank)'}: exact amount unavailable; not treated as zero.`]:[])]}];
  });
  if(!observations.some(row=>Number.isFinite(row.value)))fail('no numeric balance history '+line);
  const definition=currentAccountRegistry[id];
  series[id]={...Object.fromEntries(['unit','frequency','adjustment','dateConvention','periodType','comparisonClass','observationType','definition'].map(key=>[key,definition[key]])),observations,sourceIds:[itaLocator(line)],sourceUrl:BEA_ITA_URL,sourceUnit:'Millions of dollars',sourceTitle:'Table 1.1. U.S. International Transactions',licenseUrl:BEA_ITA_LICENSE,attribution:'Source: U.S. Bureau of Economic Analysis.',
   calculation:`Published ITA Table 1.1 line ${line}, all countries, seasonally adjusted quarterly dollars in millions / 1000 for billions; no annualization. Line identifiers are Meridian table/column locators, not BEA API series keys.`,
   publicationNote:`Table dataset release ${tableReleaseDate} (day precision); this labels the current revised table, not every historical observation's original publication. Historical first-release dates/instants are unknown.`,
   coverageNote:'Current revised quarterly ITA history; SA quarterly amounts, not annual rates. Native signs and source strings retained. Missing/suppressed/small-value markers remain unavailable. National accounts and international transactions have different concepts; no NIPA splice.'};
 }
 assertItaReconciliation(series);
 const dates=series.currentAccountBalance.observations;
 return {id:'beaIta',tableReleaseDate,nextReleaseDate,series,coverageStart:dates[0].date,coverageEnd:dates.at(-1).date,coverageNote:`Official ITA Table 1.1 all-country seasonally adjusted balances, ${dates[0].sourcePeriodLabel}–${dates.at(-1).sourcePeriodLabel}; quarter amounts, not annualized. Dataset release ${tableReleaseDate}; next listed release ${nextReleaseDate}. Current revised history newly captured on its actual retrieval date; not historical publication vintages.`,warnings:[]};
}
export async function collectBeaIta({now=new Date(),fetchImpl=globalThis.fetch}={}){
 const response=await requestBytes(BEA_ITA_URL,{fetchImpl,maxBytes:2*1024*1024});
 if(response.url!==BEA_ITA_URL)fail('redirected response endpoint');
 const text=new TextDecoder(response.bytes.subarray(0,3).equals(Buffer.from([239,187,191]))?'utf-8':'windows-1252').decode(response.bytes);
 const {bytes:_bytes,...provenance}=response;
 return {...parseBeaItaCsv(text,{now}),fetchedAt:response.retrievedAt,provenance:[provenance]};
}
