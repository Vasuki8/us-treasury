import {parseWorkspace,researchId,researchJsonCopy,researchByteLength,deepFreeze}from'./research-workspaces.js';
import {importResearchPackage,exportResearchPackage}from'./research-packages.js';
import {openResearchDatabase}from'./research-database.js';

export const RESEARCH_LIBRARY_KEY='meridian.research-library.v1';
export const RESEARCH_LIBRARY_LOCK='meridian.research-library.v1.write';
const MAX_LIBRARY_BYTES=3*1024*1024,limits={workspaces:50,packages:20};
const recordKey=(kind,id)=>`${kind}:${id}`;
const encode=(kind,record)=>kind==='packages'?exportResearchPackage(record):JSON.stringify(record);
const decode=(kind,text)=>kind==='packages'?importResearchPackage(text):parseWorkspace(JSON.parse(text));
const reasonFor=error=>error?.name==='QuotaExceededError'?'quota':'unavailable';

/** IndexedDB owns normal records. The legacy envelope is retained as recovery data. */
export async function createResearchLibrary(storage,{locks=globalThis.navigator?.locks,indexedDB=globalThis.indexedDB,...databaseOptions}={}){
 let records={workspaces:[],packages:[]},durable={workspaces:[],packages:[]},durability={workspaces:{},packages:{}},known=new Map(),invalidKeys=new Set();
 let storageAvailable=Boolean(storage),backend='session',durableText=null,storageConflict=false,database=null,databaseUnavailable=false,notice='',warning='';
 const setStatus=(kind,id,status,reason=null)=>{durability[kind][id]={status,reason};};
 const sessionOnly=()=>Object.values(durability).some(group=>Object.values(group).some(row=>row.status!=='durable'));
 const describe=reason=>({quota:'Browser research storage is full or its storage limit was reached; this record is session-only.',conflict:'This research record changed in another tab. Local changes are session-only; the latest stored record was preserved.',unavailable:'Browser research storage is unavailable; this record is session-only.','locking-unavailable':'Browser storage locking is unavailable. Research changes are session-only; existing stored records were preserved.','invalid-record':'Stored research could not be validated; its bytes were preserved. This change is session-only.',limit:'The browser research record limit was reached; this record is session-only.'}[reason]??'Research changes are session-only.');
 const updateWarning=reason=>{warning=reason?describe(reason):sessionOnly()?warning:'';};
 // A malformed legacy envelope is never overwritten. IndexedDB can still hold
 // independent new records; these original bytes remain available for recovery.
 let legacyValid=true,legacy={workspaces:[],packages:[]};
 try{
  durableText=storage?.getItem(RESEARCH_LIBRARY_KEY)??null;
  if(durableText){
   const value=researchJsonCopy(JSON.parse(durableText),{maxBytes:MAX_LIBRARY_BYTES});
   if(value.version!==1||Object.keys(value).some(key=>!['version','workspaces','packages'].includes(key))||Object.keys(limits).some(kind=>!Array.isArray(value[kind])||value[kind].length>limits[kind]))throw Error('Invalid research library.');
   for(const kind of Object.keys(limits)){
    const ids=new Set();
    for(const input of value[kind]){const record=await decode(kind,JSON.stringify(input));if(ids.has(record.id))throw Error('Duplicate stored research ID.');ids.add(record.id);legacy[kind].push(record);}
   }
  }
 }catch{legacyValid=false;legacy={workspaces:[],packages:[]};notice='Stored research could not be validated. Existing stored bytes were preserved.';}
 if(indexedDB?.open){
  try{database=await openResearchDatabase(indexedDB,databaseOptions);await database.read();backend='indexeddb';storageAvailable=true;}
  catch{databaseUnavailable=true;notice=[notice,'The research database could not be opened. Legacy records remain readable; new changes are session-only.'].filter(Boolean).join(' ');}
 }
 if(database&&backend==='indexeddb'){
  // A tombstone is a committed deletion, so migration must never resurrect it.
  // Each legacy record migrates in its own transaction. A failed migration
  // cannot poison other records or later independent saves.
  for(const kind of Object.keys(limits))for(const record of legacy[kind]){
   try{const result=await database.write({key:recordKey(kind,record.id),kind,id:record.id,text:encode(kind,record)},null,{migration:true,limit:limits[kind]});if(!result.persisted){records[kind].push(record);setStatus(kind,record.id,'session',result.reason);updateWarning(result.reason);}}
   catch(error){const reason=reasonFor(error);records[kind].push(record);setStatus(kind,record.id,'session',reason);updateWarning(reason);}
  }
  try{
   for(const row of await database.read()){
    try{
     if(!row||!Object.hasOwn(limits,row.kind)||recordKey(row.kind,researchId(row.id))!==row.key||typeof row.revision!=='string'||!row.revision)throw Error('Invalid stored record.');
     known.set(row.key,row.revision);
     if(row.text===null){records[row.kind]=records[row.kind].filter(item=>item.id!==row.id);delete durability[row.kind][row.id];continue;}
     const record=await decode(row.kind,row.text);if(record.id!==row.id)throw Error('Stored record ID mismatch.');
     records[row.kind]=[...records[row.kind].filter(item=>item.id!==row.id),record];setStatus(row.kind,row.id,'durable');
    }catch{if(typeof row?.key==='string')invalidKeys.add(row.key);notice=[notice,'A stored database record could not be validated; its bytes were preserved.'].filter(Boolean).join(' ');}
   }
  }catch{notice=[notice,'Stored database records could not be read. New changes are session-only.'].filter(Boolean).join(' ');database=null;backend='session';storageAvailable=false;}
 }else{
  storageAvailable=Boolean(storage)&&legacyValid;backend=storageAvailable?'localstorage':'session';
  records={workspaces:[...legacy.workspaces],packages:[...legacy.packages]};durable={workspaces:[...legacy.workspaces],packages:[...legacy.packages]};
  for(const kind of Object.keys(limits))for(const record of records[kind])setStatus(kind,record.id,'durable');
 }
 const persist=async(kind,id,record,{requireDurable=false}={})=>{
  let result;
  if(backend==='indexeddb'){
   if(invalidKeys.has(recordKey(kind,id)))result={persisted:false,reason:'invalid-record'};
   else try{
    result=await database.write({key:recordKey(kind,id),kind,id,text:record?encode(kind,record):null},known.get(recordKey(kind,id))??null,{limit:limits[kind]});
    if(result.persisted)known.set(recordKey(kind,id),result.record.revision);
   }catch(error){result={persisted:false,reason:reasonFor(error)};}
  }else if(!storageAvailable||backend==='session'||databaseUnavailable)result={persisted:false,reason:'unavailable'};
  else if(typeof locks?.request!=='function')result={persisted:false,reason:'locking-unavailable'};
  else try{
   result=await locks.request(RESEARCH_LIBRARY_LOCK,{mode:'exclusive'},()=>{
    try{
     if(storageConflict||(storage.getItem(RESEARCH_LIBRARY_KEY)??null)!==durableText){storageConflict=true;return{persisted:false,reason:'conflict'};}
     const next={...durable,[kind]:[...durable[kind].filter(item=>item.id!==id),...(record?[record]:[])]},text=JSON.stringify({version:1,...next});
     if(researchByteLength(text)>MAX_LIBRARY_BYTES)return{persisted:false,reason:'quota'};
     storage.setItem(RESEARCH_LIBRARY_KEY,text);durableText=text;durable=next;return{persisted:true,reason:null};
    }catch(error){return{persisted:false,reason:reasonFor(error)};}
   });
  }catch{result={persisted:false,reason:'locking-unavailable'};}
  if(result.persisted){if(record)setStatus(kind,id,'durable');else delete durability[kind][id];}
  else if(!requireDurable)setStatus(kind,id,result.reason==='quota'||result.reason==='locking-unavailable'||result.reason==='limit'?'session':'failed',result.reason);
  if(result.persisted||!requireDurable)updateWarning(result.reason);return{ok:!requireDurable||result.persisted,persisted:result.persisted,reason:result.reason??null};
 };
 // Keep operations within one library in invocation order. The native write
 // transaction also serializes the compare/write across separate tabs.
 let tail=Promise.resolve();
 const enqueue=operation=>{const result=tail.then(operation);tail=result.catch(()=>{});return result;};
 return{
  getState:()=>deepFreeze({version:1,...records,backend,durability:structuredClone(durability),storageAvailable,sessionOnly:sessionOnly()||backend==='session',warning:[notice,warning].filter(Boolean).join(' ')}),
  listWorkspaces:()=>Object.freeze([...records.workspaces]),listPackages:()=>Object.freeze([...records.packages]),
  getWorkspace:id=>records.workspaces.find(row=>row.id===id),getPackage:id=>records.packages.find(row=>row.id===id),
  saveWorkspace:(input,{requireDurable=false}={})=>enqueue(async()=>{
   const record=parseWorkspace(input),index=records.workspaces.findIndex(row=>row.id===record.id);
   if(index<0&&records.workspaces.length>=limits.workspaces)return{ok:false,persisted:false,reason:'limit'};
   const replace=()=>{records.workspaces=index<0?[...records.workspaces,record]:records.workspaces.map((row,position)=>position===index?record:row);};
   if(!requireDurable)replace();
   const result=await persist('workspaces',record.id,record,{requireDurable});
   if(requireDurable&&result.persisted)replace();
   return{...result,record:requireDurable&&!result.persisted?records.workspaces[index]:record};
  }),
  removeWorkspace:id=>enqueue(async()=>{researchId(id);const result=await persist('workspaces',id,null);if(result.persisted)records.workspaces=records.workspaces.filter(row=>row.id!==id);return result;}),
  pinPackage:input=>enqueue(async()=>{
   const record=await importResearchPackage(exportResearchPackage(input)),prior=records.packages.find(row=>row.id===record.id);
   if(prior&&prior.checksum.value!==record.checksum.value)return{ok:false,persisted:false,reason:'duplicate-id'};
   if(!prior&&records.packages.length>=limits.packages)return{ok:false,persisted:false,reason:'limit'};
   if(!prior)records.packages=[...records.packages,record];
   const result=await persist('packages',record.id,prior??record);return{...result,reason:result.reason??(prior?'already-pinned':null),record:prior??record};
  }),
  removePackage:id=>enqueue(async()=>{researchId(id);const result=await persist('packages',id,null);if(result.persisted)records.packages=records.packages.filter(row=>row.id!==id);return result;}),
 };
}
