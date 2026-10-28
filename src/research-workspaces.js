import {defaults,parseRoute,routeFor} from './router.js';
import {series} from './data.js';
import {isIsoDate} from './date-window.js';

export const MAX_RESEARCH_JSON_BYTES=12*1024*1024;
export const researchByteLength=value=>new TextEncoder().encode(value).byteLength;
export function deepFreeze(value){
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;
}
export function canonicalJson(value){
 if(value===null||typeof value!=='object')return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(canonicalJson).join(',')}]`;
 return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}
/** Bounded data-only copy. Imports never acquire executable behavior or prototypes. */
export function researchJsonCopy(value,{maxBytes=MAX_RESEARCH_JSON_BYTES}={}){
 let nodes=0;
 const copy=(item,depth)=>{
  if(++nodes>3000000||depth>24)throw new Error('Research JSON exceeds its structure limit.');
  if(item===null||typeof item==='boolean')return item;
  if(typeof item==='number'){if(!Number.isFinite(item))throw new Error('Research JSON numbers must be finite.');return item;}
  if(typeof item==='string')return item;
  if(Array.isArray(item))return item.map(entry=>copy(entry,depth+1));
  if(!item||typeof item!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(item)))throw new Error('Research JSON must contain only data.');
  const result={};
  for(const key of Object.keys(item)){
   if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsupported research JSON key.');
   if(item[key]!==undefined)result[key]=copy(item[key],depth+1);
  }
  return result;
 };
 const result=copy(value,0),text=canonicalJson(result);
 if(researchByteLength(text)>maxBytes)throw new Error('Research JSON exceeds its byte limit.');
 return JSON.parse(text);
}
export function researchId(value){if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value))throw new Error('Invalid research ID.');return value;}
export function researchName(value){if(typeof value!=='string'||!value.trim()||value.trim().length>80||/[\u0000-\u001f\u007f]/.test(value))throw new Error('Research name must contain 1 to 80 readable characters.');return value.trim();}
export function researchTimestamp(value){
 if(!(value instanceof Date)&&(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)))throw new Error('Invalid research timestamp; use exact UTC ISO time.');
 const date=value instanceof Date?value:new Date(value);
 if(!Number.isFinite(date.getTime())||typeof value==='string'&&date.toISOString()!==value)throw new Error('Invalid research timestamp.');return date.toISOString();
}

/** A workspace stores navigation/configuration; opening it uses current official data. */
export function normalizeWorkspaceState(input={}){
 const safe=researchJsonCopy(input,{maxBytes:64000}),state=parseRoute(routeFor({...safe,returnTo:null}));
 if(Array.isArray(safe.selected))state.selected=[...new Set(safe.selected.filter(id=>typeof id==='string'&&Object.hasOwn(series,id)))].slice(0,4);
 // Some routes intentionally omit comparison controls from the URL.
 if(['native','indexed','difference'].includes(safe.comparison))state.comparison=safe.comparison;
 state.returnTo=null;
 return Object.fromEntries(Object.keys(defaults).map(key=>[key,state[key]]));
}
export function createWorkspace({name,state={},id=globalThis.crypto.randomUUID(),now=new Date(),researchQuestion}={}){
 return deepFreeze({version:1,id:researchId(id),name:researchName(name),createdAt:researchTimestamp(now),state:normalizeWorkspaceState(state),...(researchQuestion===undefined||researchQuestion===null?{}:{researchQuestion:parseResearchQuestion(researchQuestion)})});
}
export function parseWorkspace(input){
 const value=researchJsonCopy(input,{maxBytes:64000});
 if(!value||value.version!==1||Object.keys(value).some(key=>!['version','id','name','createdAt','state','researchQuestion'].includes(key))||['version','id','name','createdAt','state'].some(key=>!Object.hasOwn(value,key))||!value.state||typeof value.state!=='object'||Array.isArray(value.state))throw new Error('Invalid named workspace record.');
 if(researchName(value.name)!==value.name)throw new Error('Invalid stored workspace name.');
 return createWorkspace({id:value.id,name:value.name,now:value.createdAt,state:value.state,researchQuestion:value.researchQuestion});
}
export function openWorkspace(record){return normalizeWorkspaceState(parseWorkspace(record).state);}

export function parseResearchQuestion(input){
 const value=researchJsonCopy(input,{maxBytes:16000}),allowed=['version','hypothesis','supportingSeriesIds','contradictingSeriesIds','baselinePackageId','reviewDate','reviewEvent','conditions'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!allowed.includes(key))||(value.version??1)!==1)throw Error('Invalid research question.');
 const text=(item,max,label)=>{if(typeof item!=='string'||item.length>max||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(item))throw Error(`Invalid research question ${label}.`);return item.trim();};
 const hypothesis=text(value.hypothesis,1000,'hypothesis');if(!hypothesis)throw Error('Research question hypothesis is required.');
 const ids=items=>{if(!Array.isArray(items)||items.length>20)throw Error('Invalid research question series.');return[...new Set(items.map(researchId))];};
 const baselinePackageId=value.baselinePackageId===undefined||value.baselinePackageId===''?'':researchId(value.baselinePackageId),reviewDate=value.reviewDate??'',reviewEvent=text(value.reviewEvent??'',200,'review event');
 if(typeof reviewDate!=='string'||reviewDate&&!isIsoDate(reviewDate))throw Error('Invalid research question review date.');
 if(!Array.isArray(value.conditions??[])||(value.conditions??[]).length>20)throw Error('Invalid research question conditions.');
 const conditions=(value.conditions??[]).map(row=>{
  if(!row||typeof row!=='object'||Object.keys(row).length!==3||!['seriesId','operator','value'].every(key=>Object.hasOwn(row,key))||!['>','>=','<','<=','==','!='].includes(row.operator)||typeof row.value!=='number'||!Number.isFinite(row.value))throw Error('Invalid threshold condition or operator.');
  return{seriesId:researchId(row.seriesId),operator:row.operator,value:row.value};
 });
 return deepFreeze({version:1,hypothesis,supportingSeriesIds:ids(value.supportingSeriesIds??[]),contradictingSeriesIds:ids(value.contradictingSeriesIds??[]),baselinePackageId,reviewDate,reviewEvent,conditions});
}

/** Summaries describe the controls that actually govern each saved page. */
export function workspaceSummary(input){
 const state=parseWorkspace(input).state;
 const names=ids=>ids.map(id=>series[id]?.short??series[id]?.name??id).join(' / ');
 const window=state.window==='custom'?`${state.startDate} to ${state.endDate}`:state.window==='observations'?`${state.range} observations`:state.window==='all'?'All retained history':state.window;
 const dates=label=>`${label} · ${window}`;
 const summaries={overview:()=>dates('Overview'),indicator:()=>dates(`${names([state.seriesId])} · ${state.transform}`),explore:()=>dates(state.exploreMode==='compare'?`Comparison · ${names(state.selected)} · ${state.comparison} · ${state.alignment==='quarter'?'declared reference-quarter baseline':'exact-date baseline'}`:`${state.exploreMode==='coverage'?'Coverage inventory':'Series catalog'} · ${state.topic} · ${state.frequency}${state.query?' · '+state.query:''}`),macroCoverage:()=>dates(`Economy · ${state.macroFamily} · ${state.macroFamily==='external'?state.externalView:names([state.macroMeasure])}`),labor:()=>dates(`Labor market · ${state.laborGroup}`),yields:()=>dates(`Rates & curves · overlays ${state.yieldDateA||'latest'} / ${state.yieldDateB||'previous'}`),auctions:()=>dates(`Auction demand · ${state.auctionType}${state.auctionId?' · '+state.auctionId:''}`),refinancing:()=>`Refinancing risk · ${state.refinancingHorizon} months · +${state.refinancingShock} bp hypothetical shock`,macro:()=>dates('GDP contributions'),fiscal:()=>dates('Fiscal pressure'),market:()=>dates('Funding & market functioning'),credit:()=>dates('Credit & banking'),ownership:()=>dates('Debt ownership'),watchlist:()=>dates('Watchlist'),calendar:()=>`Calendar · ${state.calendarMonth} · ${state.calendarTopic} · ${state.watchOnly?'watchlist':'all series'}${state.eventId?' · '+state.eventId:''}`,vintages:()=>`Captured history · ${names([state.vintageSeries])} · ${state.vintageCutoff||'latest capture'}`,release:()=>`Release evidence · ${state.publicationSeries} · ${state.publicationPeriod||'latest period'} · ${state.publicationCutoff||'latest retained'}`,research:()=>`Research library · ${state.researchView}`};
 const summary=(summaries[state.page]??(()=>dates(state.page)))();
 return summary+(state.page==='macroCoverage'&&state.macroFamily==='prices'?` · Conditional ${state.pceBaseIndex==='pceCoreIndex'?'core':'headline'} PCE: ${state.pceMonthlyRate}% monthly, ${state.pceHorizonMonths} months, ${state.pceTargetAnnualRate}% annual target`:'');
}
