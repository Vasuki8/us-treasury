/** Deterministic same-origin exclusive lock service for browser-free tests. */
export function researchLocks(){
 const tails=new Map();let active=0;const requests=[];
 return {requests,get active(){return active;},request(name,options,callback){
  if(options?.mode!=='exclusive'||typeof callback!=='function')throw new Error('Expected a named exclusive lock request.');
  requests.push({name,mode:options.mode});
  const pending=(tails.get(name)??Promise.resolve()).then(async()=>{active++;try{return await callback();}finally{active--;}});
  tails.set(name,pending.then(()=>undefined,()=>undefined));return pending;
 }};
}
