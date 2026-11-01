import {requestText,requestBytes,parseCsv} from './http.mjs';
import {extractZipEntry} from './zip.mjs';
import {decodeHtmlText,easternFields} from './calendar-utils.mjs';
import {FOMC_CALENDAR_URL} from './calendar-fomc.mjs';
import {fedProjectionRegistry} from '../../src/market-desk-definitions.js';
export {fedProjectionDefinitions,fedProjectionRegistry} from '../../src/market-desk-definitions.js';

export const FED_FX_URL='https://www.federalreserve.gov/releases/h10/data/FRB_h10_xml.zip';
export const ECB_FX_BASE='https://data-api.ecb.europa.eu/service/data/EXR/D.USD+GBP+JPY.EUR.SP00.A';
export const ECB_POLICY_BASE='https://data-api.ecb.europa.eu/service/data/FM/D.U2.EUR.4F.KR.DFR.LEV';
export const BOARD_TERMS='https://www.federalreserve.gov/disclaimer.htm';
export const ECB_TERMS='https://www.ecb.europa.eu/stats/ecb_statistics/governance_and_quality_framework/html/usage_policy.en.html';
export const ECB_DISCLAIMER='https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html';
const startDate='2020-01-01',fail=message=>{throw new Error(`Invalid official SEP/FX data: ${message}`);};
const specs={
 fxUsdJpy:{agency:'fedFx',code:'RXI_N.B.JA',name:'USD/JPY · H.10 spot',unit:'JPY per USD',sourceCurrency:'JPY',definition:'Board H.10 daily Japanese yen per US dollar. Weekly published business-date observations, distinct from a live tradable quote.'},
 fxUsdEur:{agency:'ecbFx',code:'EXR.D.USD.EUR.SP00.A',name:'EUR/USD · ECB reference',unit:'USD per EUR',sourceCurrency:'USD',definition:'ECB daily US dollars per euro reference exchange rate; not a transaction or forward quote.'},
 fxGbpEur:{agency:'ecbFx',code:'EXR.D.GBP.EUR.SP00.A',name:'EUR/GBP · ECB reference',unit:'GBP per EUR',sourceCurrency:'GBP',definition:'ECB daily pounds sterling per euro reference exchange rate; not a transaction or forward quote.'},
 fxJpyEur:{agency:'ecbFx',code:'EXR.D.JPY.EUR.SP00.A',name:'EUR/JPY · ECB reference',unit:'JPY per EUR',sourceCurrency:'JPY',definition:'ECB daily yen per euro reference exchange rate; not a transaction or forward quote.'},
 ecbDepositRate:{agency:'ecbPolicy',code:'FM.D.U2.EUR.4F.KR.DFR.LEV',name:'ECB deposit facility rate',unit:'Percent',sourceCurrency:'EUR',definition:'ECB published deposit facility policy rate in percent per annum, separate from €STR or a term OIS rate. Source daily observations are retained without adding dates.'},
};
export const fedProjectionSourceDefinitions={
 fedFx:{id:'fedFx',title:'Foreign Exchange Rates - H.10',feed:FED_FX_URL,filename:'H10_data.xml',licenseUrl:BOARD_TERMS,seriesIds:['fxUsdJpy']},
 ecbFx:{id:'ecbFx',title:'ECB reference exchange rates',feed:ECB_FX_BASE,licenseUrl:ECB_TERMS,seriesIds:['fxUsdEur','fxGbpEur','fxJpyEur']},
 ecbPolicy:{id:'ecbPolicy',title:'ECB key interest rate - Deposit facility',feed:ECB_POLICY_BASE,licenseUrl:ECB_TERMS,seriesIds:['ecbDepositRate']},
 fedSep:{id:'fedSep',title:'Summary of Economic Projections',feed:FOMC_CALENDAR_URL,licenseUrl:BOARD_TERMS,seriesIds:[],tables:['projections','dots']},
};
function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail('observation date');return value;}
function endDay(now){if(!(now instanceof Date)||!Number.isFinite(+now))fail('capture date');return easternFields(now.toISOString()).date;}
function xmlAttributes(text){const result={};for(const match of text.matchAll(/([A-Z_]+)="([^"<>]*)"/g)){if(Object.hasOwn(result,match[1]))fail('duplicate XML attribute');result[match[1]]=match[2];}return result;}
function cleanXml(text){if(typeof text!=='string'||Buffer.byteLength(text)>32*1024*1024)fail('H10 XML byte limit');text=text.replace(/<!--([^]*?)-->/g,(_m,body)=>{if(body.includes('--'))fail('XML comment');return '';});if(/<!--|-->|<!DOCTYPE|<!ENTITY/i.test(text)||!/<\/message:MessageGroup>\s*$/.test(text)||!/<frb:DataSet\b[^>]*id="H10"/.test(text))fail('H10 XML framing');return text;}
/** Exact Board daily yen series only: monthly/annual series and indexes cannot enter. */
export function parseFedFxXml(text,{now=new Date()}={}){
 const endDate=endDay(now),clean=cleanXml(text),selected=[...clean.matchAll(/<kf:Series\b([^>]*)>([^]*?)<\/kf:Series>/g)].filter(m=>xmlAttributes(m[1]).SERIES_NAME==='RXI_N.B.JA');
 if(selected.length!==1)fail('missing or duplicate H10 daily yen series');const meta=xmlAttributes(selected[0][1]);
 if(meta.CURRENCY!=='JPY'||meta.FREQ!=='9'||meta.FX!=='JPY'||meta.UNIT!=='Currency'||meta.UNIT_MULT!=='1')fail('H10 unit or daily dimensions');
 const seen=new Set(),rows=[];
 const tags=selected[0][2].match(/<frb:Obs\b[^>]*>/g)??[];
 for(const tag of tags){
  if(!/\/>$/.test(tag))fail('H10 malformed XML observation');const match=/^<frb:Obs\b([^>]*?)\/>$/.exec(tag);
  const r=xmlAttributes(match[1]),date=day(r.TIME_PERIOD);if(seen.has(date))fail('duplicate H10 observation date');seen.add(date);
  let value=null;if(r.OBS_STATUS==='ND'&&r.OBS_VALUE==='-9999')value=null;else if(r.OBS_STATUS==='A'&&/^\d+(?:\.\d+)?$/.test(r.OBS_VALUE)&&Number(r.OBS_VALUE)>0)value=Number(r.OBS_VALUE);else fail('H10 status or numeric quote');
  if(date>=startDate&&date<=endDate)rows.push({date,value,sourceValue:r.OBS_VALUE,publishedAt:null,observationStatus:r.OBS_STATUS});
 }
 if(!rows.some(r=>r.value!==null))fail('missing H10 observations');return {fxUsdJpy:rows.sort((a,b)=>a.date.localeCompare(b.date))};
}

/** ECB own reference FX and policy rates, preserving the native EUR-base quotation. */
export function parseEcbCsv(text,{sourceId,now=new Date()}={}){
 if(!['ecbFx','ecbPolicy'].includes(sourceId)||typeof text!=='string'||Buffer.byteLength(text)>5*1024*1024)fail('ECB scope or byte limit');
 const endDate=endDay(now),[header,...rows]=parseCsv(text);if(!header||new Set(header).size!==header.length||rows.length>20000)fail('ECB headers or row limit');
 const required=['KEY','FREQ','CURRENCY','TIME_PERIOD','OBS_VALUE','OBS_STATUS','OBS_CONF','OBS_PRE_BREAK','BREAKS','TIME_FORMAT','COLLECTION','UNIT','UNIT_MULT',...(sourceId==='ecbFx'?['CURRENCY_DENOM','EXR_TYPE','EXR_SUFFIX']:['REF_AREA','PROVIDER_FM','INSTRUMENT_FM','PROVIDER_FM_ID','DATA_TYPE_FM'])];
 if(required.some(key=>!header.includes(key)))fail('ECB required header');
 const definitions=Object.entries(specs).filter(([,s])=>s.agency===sourceId),result=Object.fromEntries(definitions.map(([id])=>[id,[]])),seen=new Set();
 for(const cells of rows){
  if(cells.length!==header.length)fail('ECB row width');const r=Object.fromEntries(header.map((key,i)=>[key,cells[i]])),entry=definitions.find(([,s])=>s.code===r.KEY);
  if(!entry)fail('ECB unreviewed key');const[id,s]=entry,date=day(r.TIME_PERIOD),key=`${id}/${date}`;if(seen.has(key))fail('ECB duplicate observation');seen.add(key);
  const expected=sourceId==='ecbFx'?{FREQ:'D',CURRENCY:s.sourceCurrency,CURRENCY_DENOM:'EUR',EXR_TYPE:'SP00',EXR_SUFFIX:'A',UNIT:s.sourceCurrency,UNIT_MULT:'0',TIME_FORMAT:'P1D',COLLECTION:'A'}:{FREQ:'D',CURRENCY:'EUR',REF_AREA:'U2',PROVIDER_FM:'4F',INSTRUMENT_FM:'KR',PROVIDER_FM_ID:'DFR',DATA_TYPE_FM:'LEV',UNIT:'PCPA',UNIT_MULT:'0',TIME_FORMAT:'P1D',COLLECTION:'E'};
  if(Object.entries(expected).some(([k,v])=>r[k]!==v))fail('ECB dimensions or unit');
  let value=null;if(r.OBS_STATUS==='M'&&r.OBS_VALUE==='')value=null;else if(r.OBS_STATUS==='A'&&/^-?\d+(?:\.\d+)?$/.test(r.OBS_VALUE)&&Number.isFinite(Number(r.OBS_VALUE))&&(sourceId==='ecbPolicy'||Number(r.OBS_VALUE)>0))value=Number(r.OBS_VALUE);else fail('ECB observation status or numeric value');
  if(r.OBS_CONF!=='F'||r.OBS_PRE_BREAK||r.BREAKS)fail('ECB confidentiality or unreviewed structural break');
  if(date>=startDate&&date<=endDate)result[id].push({date,value,sourceValue:r.OBS_VALUE,publishedAt:null,observationStatus:r.OBS_STATUS});
 }
 for(const rows of Object.values(result)){rows.sort((a,b)=>a.date.localeCompare(b.date));if(!rows.some(r=>r.value!==null))fail('ECB missing required series observations');}return result;
}
function oneTable(html,label){const tables=[...html.matchAll(/<table\b([^>]*)>([^]*?)<\/table>/gi)].filter(m=>new RegExp(`\\baria-labelledby="${label}"`).test(m[1]));if(tables.length!==1)fail('SEP missing or duplicate named table');return tables[0][2];}
function tableRows(table,section){const content=table.match(new RegExp(`<${section}\\b[^>]*>([^]*?)<\\/${section}>`,'i'))?.[1];if(!content)fail('SEP table section');return [...content.matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<(th|td)\b([^>]*)>([^]*?)<\/\1>/gi)].map(c=>({tag:c[1].toLowerCase(),attrs:c[2],text:decodeHtmlText(c[3].replace(/<sup\b[^>]*>[^]*?<\/sup>/gi,''))})));}
function horizons(cells,asOf){const result=cells.map(c=>c.text),years=result.slice(0,-1);if(result.at(-1)!=='Longer run'||years.length<3||years.length>4||years.some((v,i)=>v!==String(Number(asOf.slice(0,4))+i)))fail('SEP horizon headings');return result;}
function numeric(text){if(!/^-?\d+(?:\.\d+)?$/.test(text)||!Number.isFinite(Number(text)))fail('SEP numeric projection');return Number(text);}
function interval(text){if(!text)return null;const parts=text.split('–');if(parts.length>2)fail('SEP range');const result=parts.map(numeric);if(result.length===1)result.push(result[0]);if(result[0]>result[1])fail('SEP reversed range');return result;}
/** Current Table 1 vintage and Figure 2 counts. Anonymous dots are never connected across horizons. */
export function parseSepProjectionHtml(html,{asOf}={}){
 day(asOf);if(typeof html!=='string'||Buffer.byteLength(html)>2*1024*1024)fail('SEP HTML byte limit');
 html=html.replace(/<!--[^]*?-->/g,'').replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi,'');
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'],namedDate=`${monthNames[Number(asOf.slice(5,7))-1]} ${Number(asOf.slice(8,10))}, ${asOf.slice(0,4)}`;
 if(!decodeHtmlText(html).includes(`${namedDate}: FOMC Projections materials, accessible version`))fail('SEP source date mismatch');
 const table=oneTable(html,'xt1 xt1p1b'),heads=tableRows(table,'thead');if(heads.length!==2||heads[0].map(c=>c.text).join('|')!=='Variable|Median|Central Tendency|Range')fail('SEP projection column heading');
 if(heads[1].length%3)fail('SEP projection column count');const width=heads[1].length/3,hs=horizons(heads[1].slice(0,width),asOf);if(heads[1].map(c=>c.text).join('|')!==[...hs,...hs,...hs].join('|'))fail('SEP projection horizon group');
 const variables={'Change in real GDP':'realGdpGrowth','Unemployment rate':'unemploymentRate','PCE inflation':'pceInflation','Core PCE inflation':'corePceInflation','Federal funds rate':'federalFundsRate'},projectionRows=[],seen=new Set();
 for(const row of tableRows(table,'tbody')){
  const variable=variables[row[0]?.text];if(!variable){if(!/^(?:[A-Z][a-z]+ projection|Memo: Projected appropriate policy path)$/.test(row[0]?.text??''))fail('SEP unknown projection row');continue;}
  if(seen.has(variable)||row.length!==1+3*width)fail('SEP duplicate variable or row width');seen.add(variable);
  for(let i=0;i<width;i++){
   const text=row[i+1].text,median=text?numeric(text):null,centralTendency=interval(row[i+width+1].text),range=interval(row[i+2*width+1].text),horizon=hs[i];
   if(median===null&&(variable!=='corePceInflation'||horizon!=='Longer run')||median!==null&&(!centralTendency||!range||median<range[0]||median>range[1]||centralTendency[0]<range[0]||centralTendency[1]>range[1]))fail('SEP projection range or missing field');
   projectionRows.push({asOf,horizon,variable,median,centralTendency,range,sourceValue:text,unit:'Percent',observationType:'official-projection',horizonBasis:horizon==='Longer run'?(variable==='federalFundsRate'?'Longer-run target midpoint or level':'Longer-run convergence'):variable==='federalFundsRate'?'Year-end target midpoint or level':variable==='unemploymentRate'?'Fourth-quarter average':'Fourth-quarter over fourth-quarter percent change'});
  }
 }
 if(seen.size!==5)fail('SEP missing projection variables');
 const dotsTable=oneTable(html,'xt6 xt6p1b'),dotHeads=tableRows(dotsTable,'thead');if(dotHeads.length!==1||dotHeads[0][0]?.text!=='Midpoint of target range or target level (Percent)')fail('SEP dot heading');const dh=horizons(dotHeads[0].slice(1),asOf);if(dh.join('|')!==hs.join('|'))fail('SEP dot horizon mismatch');
 const dotRows=[],levels=new Set(),horizonCounts=Object.fromEntries(dh.map(h=>[h,0]));
 for(const row of tableRows(dotsTable,'tbody')){
  if(row.length!==dh.length+1)fail('SEP dot row width');const rate=numeric(row[0].text);if(levels.has(rate)||Math.abs(rate*8-Math.round(rate*8))>1e-8)fail('SEP duplicate or invalid dot level');levels.add(rate);
  for(let i=0;i<dh.length;i++){
   const c=row[i+1],sourceValue=c.text;if(!/^(?:\d+)?$/.test(sourceValue)||!sourceValue&&!/\bclass="emptydata"/.test(c.attrs))fail('SEP participant count');const count=sourceValue?Number(sourceValue):0;if(!Number.isInteger(count)||count>25)fail('SEP participant count');horizonCounts[dh[i]]+=count;
   dotRows.push({asOf,horizon:dh[i],rate,count,sourceValue,unit:'Percent',countUnit:'Participants',observationType:'official-projection',horizonBasis:dh[i]==='Longer run'?'Longer-run target midpoint or level':'Year-end target midpoint or level'});
  }
 }
 if(!levels.size||Object.values(horizonCounts).some(n=>n<7||n>25))fail('SEP missing participant counts');
 return {projections:{asOf,sourceTable:'Table 1',unit:'Percent',rows:projectionRows},dots:{asOf,sourceTable:'Figure 2',unit:'Percent',countUnit:'Participants',rounding:'Nearest 1/8 percentage point',horizonCounts,rows:dotRows}};
}
async function capture(url,{fetchImpl,maxBytes=5*1024*1024,bytes=false}={}){const fn=bytes?requestBytes:requestText;return fn(url,{maxBytes,fetchImpl:async(value,options)=>{const response=await fetchImpl(value,options);if(response.redirected||response.url&&response.url!==value)fail('unreviewed source redirect');return response;}});}
const receipt=({text,bytes,...metadata})=>metadata;
function baseSource(id,parsed,responses,coverageNote){const def=fedProjectionSourceDefinitions[id],series=Object.fromEntries(Object.entries(parsed).map(([key,observations])=>{const meta=fedProjectionRegistry[key],url=responses[0].url;return[key,{observations,sourceIds:[meta.code],sourceUrl:url,sourceTitle:def.title,unit:meta.unit,frequency:meta.frequency,adjustment:meta.adjustment,calculation:meta.definition,observationType:'official',dataStatus:'official',licenseUrl:def.licenseUrl,attribution:id==='fedFx'?`Source: Board of Governors of the Federal Reserve System, ${def.title}.`:'Source: ECB statistics.',coverageNote}];}));const provenance=responses.map(receipt);return{id,status:'ok',fetchedAt:provenance.map(r=>r.retrievedAt).sort().at(-1),series,provenance,coverageNote};}
export async function collectFedFx({fetchImpl=globalThis.fetch,now=new Date()}={}){endDay(now);const response=await capture(FED_FX_URL,{fetchImpl,bytes:true,maxBytes:5*1024*1024}),xml=extractZipEntry(response.bytes,'H10_data.xml',{maxOutputBytes:32*1024*1024}).toString('utf8');return baseSource('fedFx',parseFedFxXml(xml,{now}),[{...response,filename:'H10_data.xml'}],'H.10 daily yen per US dollar from 2020. Weekly releases describe the preceding week, not current market quotes. ND source dates remain null. No interpolation or release timestamp is invented.');}
async function collectEcb(id,{fetchImpl=globalThis.fetch,now=new Date()}={}){const endDate=endDay(now),base=id==='ecbFx'?ECB_FX_BASE:ECB_POLICY_BASE,url=`${base}?startPeriod=${startDate}&endPeriod=${endDate}&format=csvdata`,response=await capture(url,{fetchImpl});return baseSource(id,parseEcbCsv(response.text,{sourceId:id,now}),[response],id==='ecbFx'?'ECB daily EUR-base reference FX rates from 2020. Original values, currencies and dates are retained; reference quotes are not live transaction prices, forwards, cross-currency basis or OIS rates.':'ECB own daily deposit facility policy rate from 2020, including source-published non-business dates and historical negative rates. It is not €STR or a term OIS rate.');}
export const collectEcbFx=options=>collectEcb('ecbFx',options);
export const collectEcbPolicy=options=>collectEcb('ecbPolicy',options);
export async function collectFedSep({fetchImpl=globalThis.fetch,now=new Date()}={}){
 const endDate=endDay(now),calendar=await capture(FOMC_CALENDAR_URL,{fetchImpl,maxBytes:2*1024*1024});
 const matches=[...calendar.text.matchAll(/href="((?:https:\/\/www\.federalreserve\.gov)?\/monetarypolicy\/fomcprojtabl(\d{8})\.htm)"/g)].map(m=>({url:new URL(m[1],'https://www.federalreserve.gov').href,asOf:`${m[2].slice(0,4)}-${m[2].slice(4,6)}-${m[2].slice(6,8)}`})).filter(r=>day(r.asOf)<=endDate).sort((a,b)=>a.asOf.localeCompare(b.asOf));
 const latest=matches.at(-1);if(!latest)fail('SEP no dated accessible projections link');const response=await capture(latest.url,{fetchImpl,maxBytes:2*1024*1024}),tables=parseSepProjectionHtml(response.text,{asOf:latest.asOf}),provenance=[calendar,response].map(receipt);
 return{id:'fedSep',status:'ok',fetchedAt:provenance.map(r=>r.retrievedAt).sort().at(-1),series:{},tables,provenance,coverageNote:'Latest published accessible SEP vintage linked from the official FOMC calendar. Table 1 current-vintage official medians, central tendencies and ranges; Figure 2 anonymous rate-level counts with separate horizon totals. These are individual appropriate-policy projections, not market probabilities or a commitment. Previous-vintage comparison rows and named participant paths are excluded.',warnings:['No participant identity is published or inferred, and anonymous dots are never linked across horizons. Horizon participant counts can differ.','Official rounded medians are retained separately from exact 1/8-point dot levels; no futures probabilities, OIS quote or invented forecast vintage.']};
}
export const fedProjectionCollectors={fedSep:collectFedSep,fedFx:collectFedFx,ecbFx:collectEcbFx,ecbPolicy:collectEcbPolicy};
