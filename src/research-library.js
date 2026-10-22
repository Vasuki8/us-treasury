import {parseWorkspace,researchId,researchJsonCopy,researchByteLength,deepFreeze}from'./research-workspaces.js';
import {importResearchPackage,exportResearchPackage}from'./research-packages.js';

export const RESEARCH_LIBRARY_KEY='meridian.research-library.v1';
export const RESEARCH_LIBRARY_LOCK='meridian.research-library.v1.write';
const MAX_LIBRARY_BYTES=3*1024*1024,MAX_WORKSPACES=50,MAX_PACKAGES=20;

/** Exclusive same-origin locks serialize each bounded envelope comparison/write. */
export async function createResearchLibrary(storage,{locks=globalThis.navigator?.locks}={}){
 let lockingAvailable=typeof locks?.request==='function';
 const lockingWarning='Browser storage locking is unavailable. Research changes are session-only; existing stored records were preserved. Download pinned JSON before reloading.';
 let workspaces=[],packages=[],storageAvailable=Boolean(storage),sessionOnly=!storage||!lockingAvailable,warning=storage&&!lockingAvailable?lockingWarning:'',durableText=null,storageConflict=false;
 try{
  const text=storage?.getItem(RESEARCH_LIBRARY_KEY)??null;durableText=text;
  if(text){
   if(researchByteLength(text)>MAX_LIBRARY_BYTES)throw Error('Research library exceeds its byte limit.');
   const value=researchJsonCopy(JSON.parse(text),{maxBytes:MAX_LIBRARY_BYTES});
   if(value.version!==1||Object.keys(value).some(key=>!['version','workspaces','packages'].includes(key))||!Array.isArray(value.workspaces)||!Array.isArray(value.packages)||value.workspaces.length>MAX_WORKSPACES||value.packages.length>MAX_PACKAGES)throw Error('Invalid research library.');
   workspaces=value.workspaces.map(parseWorkspace);packages=await Promise.all(value.packages.map(pkg=>importResearchPackage(JSON.stringify(pkg))));
   if(new Set(workspaces.map(row=>row.id)).size!==workspaces.length||new Set(packages.map(row=>row.id)).size!==packages.length)throw Error('Duplicate stored research ID.');
  }
 }catch(error){workspaces=[];packages=[];storageAvailable=false;sessionOnly=true;warning='Stored research could not be validated. New work is session-only; existing stored bytes were preserved.';}
 const persistLocked=()=>{
  if(!storageAvailable){sessionOnly=true;return{ok:true,persisted:false,reason:'unavailable'};}
  try{
   // Keep a stale tab from replacing records written or removed elsewhere.
   // A conflict remains session-only until a fresh library is opened.
   if(storageConflict||(storage.getItem(RESEARCH_LIBRARY_KEY)??null)!==durableText){
    storageConflict=true;sessionOnly=true;warning='Research library changed in another tab. Local changes are session-only; the latest stored records were preserved. Download pinned JSON before reloading.';
    return{ok:true,persisted:false,reason:'conflict'};
   }
   const text=JSON.stringify({version:1,workspaces,packages});
   if(researchByteLength(text)>MAX_LIBRARY_BYTES){sessionOnly=true;warning='Browser research storage limit reached; changes are session-only.';return{ok:true,persisted:false,reason:'quota'};}
   storage.setItem(RESEARCH_LIBRARY_KEY,text);durableText=text;sessionOnly=false;warning='';return{ok:true,persisted:true,reason:null};
  }catch(error){sessionOnly=true;const reason=error?.name==='QuotaExceededError'?'quota':'unavailable';if(reason==='unavailable')storageAvailable=false;warning=reason==='quota'?'Browser research storage is full; changes are session-only.':'Browser research storage is unavailable; changes are session-only.';return{ok:true,persisted:false,reason};}
 };
 const lockFallback=()=>{lockingAvailable=false;sessionOnly=true;warning=lockingWarning;return{ok:true,persisted:false,reason:'locking-unavailable'};};
 const persist=async()=>{
  if(!storageAvailable){sessionOnly=true;return{ok:true,persisted:false,reason:'unavailable'};}
  if(!lockingAvailable)return lockFallback();
  try{return await locks.request(RESEARCH_LIBRARY_LOCK,{mode:'exclusive'},persistLocked);}
  catch{return lockFallback();}
 };
 return{
  getState:()=>deepFreeze({version:1,workspaces:[...workspaces],packages:[...packages],storageAvailable,sessionOnly,warning}),
  listWorkspaces:()=>Object.freeze([...workspaces]),listPackages:()=>Object.freeze([...packages]),
  getWorkspace:id=>workspaces.find(row=>row.id===id),getPackage:id=>packages.find(row=>row.id===id),
  async saveWorkspace(input){
   const record=parseWorkspace(input),index=workspaces.findIndex(row=>row.id===record.id);
   if(index<0&&workspaces.length>=MAX_WORKSPACES)return{ok:false,persisted:false,reason:'limit'};
   workspaces=index<0?[...workspaces,record]:workspaces.map((row,position)=>position===index?record:row);
   return{...await persist(),record};
  },
  async removeWorkspace(id){researchId(id);workspaces=workspaces.filter(row=>row.id!==id);return persist();},
  async pinPackage(input){
   const record=await importResearchPackage(exportResearchPackage(input)),prior=packages.find(row=>row.id===record.id);
   if(prior){
    if(prior.checksum.value!==record.checksum.value)return{ok:false,persisted:false,reason:'duplicate-id'};
    const result=await persist();return{...result,reason:result.reason??'already-pinned',record:prior};
   }
   if(packages.length>=MAX_PACKAGES)return{ok:false,persisted:false,reason:'limit'};
   packages=[...packages,record];return{...await persist(),record};
  },
  async removePackage(id){researchId(id);packages=packages.filter(row=>row.id!==id);return persist();},
 };
}
