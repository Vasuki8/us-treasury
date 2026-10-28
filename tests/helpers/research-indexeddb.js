/** Small transaction-level IndexedDB double for Node, which has no browser database.
 * Queues transactions, clones records, and applies writes only at completion.
 * Native browser IndexedDB is also checked in the browser acceptance workflow.
 */
export function researchIndexedDB(){
 const databases=new Map(),controls={openError:null,blocked:false,writeError:null,commitError:null,commitGate:null};
 const error=name=>Object.assign(new Error(name),{name});
 const factory={controls,databases,open(name,version){
  const request={result:null,error:null};
  setTimeout(()=>{
   if(controls.openError){request.error=error(controls.openError);request.onerror?.({target:request});return;}
   if(controls.blocked){request.onblocked?.({target:request});return;}
   let state=databases.get(name),upgrade=!state;
   if(!state){state={stores:new Map(),tail:Promise.resolve(),version};databases.set(name,state);}
   const db={objectStoreNames:{contains:key=>state.stores.has(key)},createObjectStore(key){state.stores.set(key,new Map());},close(){},transaction(names,mode){
    names=Array.isArray(names)?names:[names];
    let finish,active=false,ended=false,pending=0,commitScheduled=false;const done=new Promise(resolve=>{finish=resolve;}),queue=[],copies=new Map();
    const tx={error:null,objectStore(key){
     if(!names.includes(key))throw error('NotFoundError');
     const issue=(operation,value,lookup)=>{
      if(ended)throw error('TransactionInactiveError');
      const req={result:undefined,error:null};pending++;
      const execute=()=>setTimeout(()=>{
       if(ended)return;
       try{
        const map=copies.get(key);
        if(['put','delete'].includes(operation)&&controls.writeError)throw error(controls.writeError);
        if(operation==='get')req.result=structuredClone(map.get(value));
        if(operation==='getAll')req.result=structuredClone([...map.values()]);
        if(operation==='put'){map.set(lookup??value.key,structuredClone(value));req.result=lookup??value.key;}
        if(operation==='delete')map.delete(value);
        req.onsuccess?.({target:req});pending--;scheduleCommit();
       }catch(cause){req.error=cause;tx.error=cause;req.onerror?.({target:req});tx.abort();}
      },0);
      if(active)execute();else queue.push(execute);return req;
     };
     return{get:value=>issue('get',value),getAll:()=>issue('getAll'),put:(value,key)=>issue('put',value,key),delete:value=>issue('delete',value)};
    },abort(){if(ended)return;ended=true;tx.error??=error('AbortError');setTimeout(()=>{tx.onabort?.({target:tx});finish();},0);}};
    const scheduleCommit=()=>{
     if(pending||commitScheduled||ended)return;commitScheduled=true;
     setTimeout(async()=>{
      if(controls.commitGate)await controls.commitGate;
      if(ended)return;
      if(controls.commitError){tx.error=error(controls.commitError);tx.abort();return;}
      if(mode==='readwrite')for(const [key,map]of copies)state.stores.set(key,map);
      ended=true;tx.oncomplete?.({target:tx});finish();
     },0);
    };
    const prior=state.tail;state.tail=done;
    prior.then(()=>{if(ended)return;for(const key of names)copies.set(key,new Map(state.stores.get(key)));active=true;for(const execute of queue)execute();scheduleCommit();});
    return tx;
   }};
   request.result=db;if(upgrade)request.onupgradeneeded?.({target:request});request.onsuccess?.({target:request});
  },0);return request;
 }};
 return factory;
}
