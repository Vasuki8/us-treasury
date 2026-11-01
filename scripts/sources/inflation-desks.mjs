import {requestText,parseCsv} from './http.mjs';
import {parseBeaBatch} from './bea.mjs';
import {inflationDeskDefinitions,BEA_MONTHLY_URL,BEA_SERIES_URL,BEA_TABLES_URL,CLEVELAND_MEDIAN_URL,CLEVELAND_TRIMMED_URL,INFLATION_INPUT_LIMIT} from '../../src/inflation-desk-definitions.js';
import {buildInflationDeskSeries,validateInflationDeskSource} from '../../src/inflation-desk-schema.js';
export {inflationDeskDefinitions,inflationDeskRegistry} from '../../src/inflation-desk-definitions.js';
const fail=message=>{throw new Error('Inflation desk source: '+message);};
function cutoff(now){if(!(now instanceof Date)||!Number.isFinite(+now))fail('capture clock');return now.toISOString().slice(0,10);}
function register(text,header){if(typeof text!=='string'||Buffer.byteLength(text)>2*1024*1024)fail('metadata byte limit');const rows=parseCsv(text);if(rows[0]?.map(v=>v.replace(/^%/,'')).join(',')!==header.join(','))fail('metadata header');return rows.slice(1).map(row=>{if(row.length!==header.length)fail('metadata row width');return Object.fromEntries(header.map((k,i)=>[k,row[i]]));});}
function verifyMetadata(seriesText,tableText){
 const series=register(seriesText,['SeriesCode','SeriesLabel','MetricName','CalculationType','DefaultScale','TableId:LineNo','SeriesCodeParents']),tables=register(tableText,['TableId','TableTitle']);
 for(const [code,d]of Object.entries(inflationDeskDefinitions.inflationBea.native)){
  const found=series.filter(r=>r.SeriesCode===code),table=tables.filter(r=>r.TableId===d.table);
  if(found.length!==1||table.length!==1||table[0].TableTitle!==d.title||found[0].SeriesLabel!==d.label||found[0].MetricName!==d.metric||found[0].CalculationType!==d.calculation||found[0].DefaultScale!==String(d.scale)||!found[0]['TableId:LineNo'].split('|').includes(d.table+':'+d.line))fail('unreviewed BEA metadata for '+code);
 }
}
export function parseInflationBea(monthly,seriesText,tableText,{now=new Date()}={}){
 verifyMetadata(seriesText,tableText);if(typeof monthly!=='string'||Buffer.byteLength(monthly)>64*1024*1024)fail('BEA monthly byte limit');
 const end=cutoff(now),parsed=parseBeaBatch(monthly,Object.keys(inflationDeskDefinitions.inflationBea.native),'M');
 for(const [code,d]of Object.entries(inflationDeskDefinitions.inflationBea.native))if(d.metric==='Fisher Price Index'&&d.calculation==='Level'){
  const base=parsed[code].filter(r=>r.date.startsWith('2017-'));
  if(base.length!==12||base.some(r=>r.value===null)||Math.abs(base.reduce((sum,r)=>sum+r.value,0)/12-100)>.00050001)fail('unreviewed BEA price-index reference year for '+code);
 }
 const inputs=Object.fromEntries(Object.entries(parsed).map(([code,rows])=>[code,rows.filter(r=>r.date<=end).slice(-INFLATION_INPUT_LIMIT)]));buildInflationDeskSeries('inflationBea',inputs,{cutoff:end});return inputs;
}
function clevelandCsv(text,prefix,now){
 if(typeof text!=='string'||Buffer.byteLength(text)>256*1024)fail('Cleveland CSV byte limit');const [head,...rows]=parseCsv(text),expected=['date',prefix+'_monthly_chg',prefix+'_ann_monthly_chg'];
 if(head?.map(v=>v.trim()).join(',')!==expected.join(',')||rows.length>2000)fail('Cleveland headers or row count');
 const result=Object.fromEntries(expected.slice(1).map(code=>[code,[]])),seen=new Set(),end=cutoff(now);
 for(const row of rows){if(row.length!==3)fail('Cleveland row width');const m=/^(\d{1,2})\/1\/(\d{4})$/.exec(row[0]);if(!m||Number(m[1])<1||Number(m[1])>12||Number(m[2])<1983)fail('Cleveland source month');const date=m[2]+'-'+m[1].padStart(2,'0')+'-01';if(seen.has(date))fail('duplicate Cleveland month');seen.add(date);
  for(let n=1;n<3;n++){const sourceValue=row[n].trim();if(!/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(sourceValue)||!Number.isFinite(Number(sourceValue)))fail('Cleveland numeric fraction/rate');if(date<=end)result[expected[n]].push({date,value:Number(sourceValue),sourceValue,publishedAt:null});}
 }
 return Object.fromEntries(Object.entries(result).map(([code,values])=>[code,values.sort((a,b)=>a.date.localeCompare(b.date)).slice(-INFLATION_INPUT_LIMIT)]));
}
export function parseClevelandInflation(median,trimmed,{now=new Date()}={}){
 const inputs={...clevelandCsv(median,'mcpi',now),...clevelandCsv(trimmed,'trim',now)};buildInflationDeskSeries('inflationCleveland',inputs,{cutoff:cutoff(now)});return inputs;
}
async function capture(url,fetchImpl,maxBytes){return requestText(url,{maxBytes,headers:{'User-Agent':'MeridianMacroResearch/0.1 (official public inflation statistics; https://github.com/Vasuki8/us-treasury)'},fetchImpl:async(u,o)=>{const r=await fetchImpl(u,{...o,redirect:'manual'});if(r.redirected||r.url&&r.url!==u||r.status>=300&&r.status<400)fail('unreviewed source redirect');return r;}});}
function assembled(id,inputs,captures){
 const d=inflationDeskDefinitions[id],provenance=captures.map(({text,...receipt})=>receipt),fetchedAt=provenance.map(r=>r.retrievedAt).sort().at(-1);
 return validateInflationDeskSource({id,status:'ok',definitionVersion:1,fetchedAt,coverageNote:d.coverageNote,warnings:[...d.warnings],inputs,series:buildInflationDeskSeries(id,inputs,{cutoff:fetchedAt.slice(0,10)}),provenance});
}
export async function collectInflationBea({fetchImpl=globalThis.fetch,now=new Date()}={}){
 cutoff(now);const captures=await Promise.all([[BEA_MONTHLY_URL,64*1024*1024],[BEA_SERIES_URL,2*1024*1024],[BEA_TABLES_URL,128*1024]].map(([url,max])=>capture(url,fetchImpl,max)));
 return assembled('inflationBea',parseInflationBea(...captures.map(r=>r.text),{now}),captures);
}
export async function collectInflationCleveland({fetchImpl=globalThis.fetch,now=new Date()}={}){
 cutoff(now);const captures=await Promise.all([CLEVELAND_MEDIAN_URL,CLEVELAND_TRIMMED_URL].map(url=>capture(url,fetchImpl,256*1024)));
 return assembled('inflationCleveland',parseClevelandInflation(...captures.map(r=>r.text),{now}),captures);
}
export const inflationDeskCollectors={inflationBea:collectInflationBea,inflationCleveland:collectInflationCleveland};
