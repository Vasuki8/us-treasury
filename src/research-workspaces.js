import {defaults,parseRoute,routeFor} from './router.js';
import {series} from './data.js';

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
export function createWorkspace({name,state={},id=globalThis.crypto.randomUUID(),now=new Date()}={}){
 return deepFreeze({version:1,id:researchId(id),name:researchName(name),createdAt:researchTimestamp(now),state:normalizeWorkspaceState(state)});
}
export function parseWorkspace(input){
 const value=researchJsonCopy(input,{maxBytes:64000});
 if(!value||value.version!==1||Object.keys(value).length!==5||['version','id','name','createdAt','state'].some(key=>!Object.hasOwn(value,key))||!value.state||typeof value.state!=='object'||Array.isArray(value.state))throw new Error('Invalid named workspace record.');
 if(researchName(value.name)!==value.name)throw new Error('Invalid stored workspace name.');
 return createWorkspace({id:value.id,name:value.name,now:value.createdAt,state:value.state});
}
export function openWorkspace(record){return normalizeWorkspaceState(parseWorkspace(record).state);}
