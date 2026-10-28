export const RESEARCH_DATABASE_NAME='meridian.research-library.v2';
const failure=name=>Object.assign(new Error(`Research database ${name}.`),{name});

/** A successful request is not a committed transaction: resolve oncomplete only. */
export function openResearchDatabase(indexedDB,{databaseName=RESEARCH_DATABASE_NAME,openTimeoutMs=4000}={}){
 return new Promise((resolve,reject)=>{
  let request,settled=false;
  const timer=setTimeout(()=>fail(failure('TimeoutError')),openTimeoutMs);
  const fail=error=>{if(!settled){settled=true;clearTimeout(timer);reject(error);}};
  try{request=indexedDB.open(databaseName,1);}catch(error){fail(error);return;}
  request.onblocked=()=>fail(failure('BlockedError'));
  request.onerror=()=>fail(request.error??failure('UnknownError'));
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('records'))request.result.createObjectStore('records',{keyPath:'key'});};
  request.onsuccess=()=>{
   const db=request.result;
   if(settled){db.close();return;}
   settled=true;clearTimeout(timer);db.onversionchange=()=>db.close();
   const transaction=(mode,run)=>new Promise((accept,decline)=>{
    let tx,result;
    try{tx=db.transaction('records',mode);tx.oncomplete=()=>accept(result);tx.onabort=()=>decline(tx.error??failure('AbortError'));tx.onerror=()=>{};run(tx.objectStore('records'),value=>{result=value;});}
    catch(error){try{tx?.abort();}catch{}decline(error);}
   });
   resolve({
    read:()=>transaction('readonly',(store,done)=>{const read=store.getAll();read.onsuccess=()=>done(read.result);}),
    write(record,expected,{migration=false,limit}={}){
     return transaction('readwrite',(store,done)=>{
      const read=store.get(record.key);
      read.onsuccess=()=>{
       const prior=read.result;
       if(migration&&prior){done({persisted:true,record:prior});return;}
       if((prior?.revision??null)!==expected){done({persisted:false,reason:'conflict'});return;}
       const put=()=>{const next={...record,revision:globalThis.crypto.randomUUID()};store.put(next);done({persisted:true,record:next});};
       if(record.text!==null&&!prior?.text&&limit){
        const all=store.getAll();all.onsuccess=()=>{
         if(all.result.filter(row=>row.kind===record.kind&&row.text!==null).length>=limit)done({persisted:false,reason:'limit'});else put();
        };
       }else put();
      };
     });
    },
   });
  };
 });
}
