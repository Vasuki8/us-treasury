import test from'node:test';import assert from'node:assert/strict';
import {researchLocks}from'./helpers/research-locks.js';
let api,workspaces,packages;
try{api=await import('../src/research-library.js');workspaces=await import('../src/research-workspaces.js');packages=await import('../src/research-packages.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const use=()=>{assert.ok(api,'Research library persistence must exist');return api;};
const now='2026-10-22T15:00:00.000Z';
function storage(){const values=new Map([['meridian.preferences.v1','original preferences']]);return{values,locks:researchLocks(),getItem:key=>values.get(key)??null,setItem(key,value){values.set(key,value);}};}
const openLibrary=store=>use().createResearchLibrary(store,{locks:store?.locks??researchLocks()});
const workspace=()=>workspaces.createWorkspace({id:'workspace-one',name:'Saved comparison',now,state:{page:'explore',selected:['sofr','effr'],window:'all',exploreMode:'compare'}});

test('research library persists validated workspaces atomically in its namespace without changing preferences',async()=>{
 const store=storage(),library=await openLibrary(store);
 const result=await library.saveWorkspace(workspace());assert.equal(result.persisted,true);
 assert.equal(store.values.get('meridian.preferences.v1'),'original preferences');
 assert.ok(store.values.has('meridian.research-library.v1'));
 const reopened=await openLibrary(store);assert.equal(reopened.getWorkspace('workspace-one').name,'Saved comparison');
 assert.equal(reopened.getState().workspaces.length,1);assert.equal(reopened.listWorkspaces().length,1);
});

test('quota and unavailable storage retain session work without partially changing durable contents',async()=>{
 const store=storage(),library=await openLibrary(store);await library.saveWorkspace(workspace());
 const durable=store.values.get('meridian.research-library.v1');store.setItem=()=>{const e=new Error('Quota');e.name='QuotaExceededError';throw e;};
 const record=workspaces.createWorkspace({id:'workspace-two',name:'Session only',now,state:{page:'explore'}});
 const result=await library.saveWorkspace(record);assert.equal(result.ok,true);assert.equal(result.persisted,false);assert.equal(result.reason,'quota');
 assert.equal(library.getWorkspace('workspace-two').name,'Session only');assert.equal(store.values.get('meridian.research-library.v1'),durable);
 const unavailable=await openLibrary(undefined);assert.equal((await unavailable.saveWorkspace(workspace())).persisted,false);assert.equal(unavailable.getState().sessionOnly,true);
});

test('a required durable workspace update keeps the prior record on storage failure',async()=>{
 const store=storage(),library=await openLibrary(store),original=workspace();await library.saveWorkspace(original);
 const priorStatus=library.getState().durability.workspaces[original.id];
 store.setItem=()=>{const error=Error('Full');error.name='QuotaExceededError';throw error;};
 const result=await library.saveWorkspace({...original,name:'Unsaved rename'},{requireDurable:true});
 assert.equal(result.ok,false);assert.equal(result.persisted,false);assert.equal(result.reason,'quota');assert.deepEqual(library.getWorkspace(original.id),original);assert.deepEqual(library.getState().durability.workspaces[original.id],priorStatus);
});

test('pinned package IDs never overwrite different evidence and malformed stored JSON remains session-only',async()=>{
 const library=await openLibrary(storage());
 const make=name=>packages.createResearchPackage({id:'package-one',name,now,state:{page:'indicator',selected:['sofr'],transform:'level',comparison:'native',window:'all'}});
 const first=await make('First'),second=await make('Second');
 assert.equal((await library.pinPackage(first)).ok,true);
 const duplicate=await library.pinPackage(second);assert.equal(duplicate.ok,false);assert.equal(duplicate.reason,'duplicate-id');
 assert.equal(library.getPackage('package-one').name,'First');assert.equal(library.listPackages().length,1);
 const bad=await openLibrary({getItem:()=>'{broken',setItem:()=>{throw Error('Must not replace corrupt evidence automatically');}});
 assert.equal(bad.getState().storageAvailable,false);assert.equal((await bad.saveWorkspace(workspace())).persisted,false);
});

test('persisted package reopens as validated immutable evidence and identical IDs are an idempotent no-op',async()=>{
 const store=storage(),library=await openLibrary(store);
 const pkg=await packages.createResearchPackage({id:'package-reopened',name:'Pinned SOFR',now,state:{selected:['sofr'],window:'1y'}});
 assert.equal((await library.pinPackage(pkg)).persisted,true);
 const durable=store.values.get('meridian.research-library.v1'),reopened=await openLibrary(store),record=reopened.getPackage(pkg.id);
 assert.equal(packages.researchPackageCsv(record),pkg.csv);assert.equal(Object.isFrozen(record.catalog.sofr.observations),true);
 assert.equal((await reopened.pinPackage(record)).reason,'already-pinned');assert.equal(store.values.get('meridian.research-library.v1'),durable);
 assert.throws(()=>reopened.listPackages().push(pkg),TypeError);
});

test('a stale open library preserves another instance durable bytes and retains its conflicting work for the session',async()=>{
 const store=storage(),first=await openLibrary(store),second=await openLibrary(store);
 assert.equal((await first.saveWorkspace(workspace())).persisted,true);
 const durable=store.values.get('meridian.research-library.v1');
 const local=workspaces.createWorkspace({id:'second-tab-study',name:'Unsaved second tab study',now,state:{page:'indicator',seriesId:'gdp'}});
 const result=await second.saveWorkspace(local);
 assert.equal(result.ok,true);assert.equal(result.persisted,false);assert.equal(result.reason,'conflict');
 assert.equal(store.values.get('meridian.research-library.v1'),durable);assert.equal(second.getWorkspace(local.id).name,local.name);
 assert.equal(second.getState().sessionOnly,true);assert.match(second.getState().warning,/another tab|changed elsewhere/i);assert.match(second.getState().warning,/session-only/i);
 const later=workspaces.createWorkspace({id:'more-session-work',name:'Still in this session',now,state:{page:'explore'}});
 assert.equal((await second.saveWorkspace(later)).reason,'conflict');assert.equal(store.values.get('meridian.research-library.v1'),durable);
 const reopened=await openLibrary(store);assert.equal(reopened.getWorkspace('workspace-one').name,workspace().name);assert.equal(reopened.getWorkspace(local.id),undefined);
});

test('a stale package pin or removal never overwrites newer durable evidence',async()=>{
 const store=storage(),first=await openLibrary(store),second=await openLibrary(store);
 const make=(id,name)=>packages.createResearchPackage({id,name,now,state:{selected:['gdp'],range:1}});
 const original=await make('first-tab-evidence','First tab evidence'),local=await make('second-tab-evidence','Second tab evidence');
 await first.pinPackage(original);const durable=store.values.get('meridian.research-library.v1');
 assert.equal((await second.pinPackage(local)).reason,'conflict');assert.equal(second.getPackage(local.id).checksum.value,local.checksum.value);
 await second.removePackage(original.id);assert.equal(store.values.get('meridian.research-library.v1'),durable);
 assert.equal((await openLibrary(store)).getPackage(original.id).checksum.value,original.checksum.value);
 const cleared=await openLibrary(store);store.values.delete('meridian.research-library.v1');
 assert.equal((await cleared.saveWorkspace(workspace())).reason,'conflict');assert.equal(store.values.has('meridian.research-library.v1'),false);
});

test('racing instances serialize the byte check and write inside one named exclusive critical section',async()=>{
 const store=storage(),first=await openLibrary(store),second=await openLibrary(store),originalGet=store.getItem.bind(store),originalSet=store.setItem.bind(store);
 let reads=0,writes=0;
 store.getItem=key=>{assert.equal(store.locks.active,1,'durable byte comparisons require the exclusive lock');reads++;return originalGet(key);};
 store.setItem=(key,value)=>{assert.equal(store.locks.active,1,'durable writes require the same exclusive lock');writes++;originalSet(key,value);};
 const local=workspaces.createWorkspace({id:'racing-second',name:'Second racing tab',now,state:{page:'indicator',seriesId:'gdp'}});
 const [a,b]=await Promise.all([first.saveWorkspace(workspace()),second.saveWorkspace(local)]);
 assert.equal(a.persisted,true);assert.equal(b.persisted,false);assert.equal(b.reason,'conflict');assert.equal(writes,1);assert.equal(reads,2);
 assert.equal(store.locks.requests.length,2);assert.ok(store.locks.requests.every(row=>row.name===api.RESEARCH_LIBRARY_LOCK&&row.mode==='exclusive'));
 store.getItem=originalGet;const reopened=await openLibrary(store);assert.equal(reopened.getWorkspace('workspace-one').name,workspace().name);assert.equal(reopened.getWorkspace(local.id),undefined);
});

test('missing or rejected lock services preserve readable durable data and explicitly fall back to session-only edits',async()=>{
 const store=storage(),first=await openLibrary(store);await first.saveWorkspace(workspace());const durable=store.values.get('meridian.research-library.v1');
 for(const locks of [null,{}, {request:async()=>{throw new Error('Lock access denied');}}]){
  const library=await use().createResearchLibrary(store,{locks});assert.equal(library.getWorkspace('workspace-one').name,workspace().name);
  const local=workspaces.createWorkspace({id:'without-lock',name:'Session without lock',now,state:{page:'explore'}});
  const result=await library.saveWorkspace(local);assert.equal(result.ok,true);assert.equal(result.persisted,false);assert.equal(result.reason,'locking-unavailable');
  assert.equal(library.getWorkspace(local.id).name,local.name);assert.equal(library.getState().sessionOnly,true);assert.match(library.getState().warning,/lock.*unavailable|locking.*unavailable/i);assert.match(library.getState().warning,/session-only/i);
  await library.removeWorkspace('workspace-one');assert.equal(store.values.get('meridian.research-library.v1'),durable);
 }
});

test('reimporting an already-known package validates durable state after another tab removes it',async()=>{
 const store=storage(),first=await openLibrary(store),pkg=await packages.createResearchPackage({id:'removed-elsewhere',name:'Originally pinned',now,state:{selected:['gdp'],range:1}});
 await first.pinPackage(pkg);const stale=await openLibrary(store),other=await openLibrary(store);
 await other.removePackage(pkg.id);const durable=store.values.get('meridian.research-library.v1');
 const result=await stale.pinPackage(pkg);assert.equal(result.persisted,false);assert.equal(result.reason,'conflict');
 assert.equal(stale.getPackage(pkg.id).checksum.value,pkg.checksum.value);assert.equal(stale.getState().sessionOnly,true);
 assert.equal(store.values.get('meridian.research-library.v1'),durable);assert.equal((await openLibrary(store)).getPackage(pkg.id),undefined);
});
