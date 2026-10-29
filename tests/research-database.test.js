import test from'node:test';import assert from'node:assert/strict';
import {researchIndexedDB}from'./helpers/research-indexeddb.js';
import {researchLocks}from'./helpers/research-locks.js';
import {createResearchLibrary,RESEARCH_LIBRARY_KEY}from'../src/research-library.js';
import {createWorkspace}from'../src/research-workspaces.js';
import {createResearchPackage,exportResearchPackage}from'../src/research-packages.js';
import {RESEARCH_DATABASE_NAME}from'../src/research-database.js';
const now='2026-10-22T15:00:00.000Z';
const workspace=(id='durable-workspace',name='Durable study')=>createWorkspace({id,name,now,state:{page:'explore',selected:['sofr'],window:'all'}});
const packageOf=(id='durable-package')=>createResearchPackage({id,name:'Frozen study',now,state:{selected:['gdp'],range:1,window:'all'}});
const localStore=text=>{const values=new Map(text?[[RESEARCH_LIBRARY_KEY,text]]:[]);return{values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
const open=(indexedDB,storage=localStore(),options={})=>createResearchLibrary(storage,{indexedDB,locks:researchLocks(),...options});

test('a failed record remains exportable while an unrelated small save commits and reopens',async()=>{
 const indexedDB=researchIndexedDB(),library=await open(indexedDB),pkg=await packageOf();
 indexedDB.controls.writeError='QuotaExceededError';
 const failed=await library.pinPackage(pkg);assert.equal(failed.persisted,false);assert.equal(failed.reason,'quota');
 indexedDB.controls.writeError=null;
 assert.equal((await library.saveWorkspace(workspace())).persisted,true);
 assert.equal(library.getState().durability.packages[pkg.id].status,'session');
 assert.equal(library.getState().durability.workspaces['durable-workspace'].status,'durable');
 assert.equal(exportResearchPackage(library.getPackage(pkg.id)),exportResearchPackage(pkg));
 const reopened=await open(indexedDB);assert.equal(reopened.getPackage(pkg.id),undefined);assert.ok(reopened.getWorkspace('durable-workspace'));
});

test('database changes become durable only after transaction completion and an abort preserves prior contents',async()=>{
 const indexedDB=researchIndexedDB(),library=await open(indexedDB);await library.saveWorkspace(workspace());
 let release;indexedDB.controls.commitGate=new Promise(resolve=>{release=resolve;});
 let settled=false;const saving=library.saveWorkspace(workspace('durable-workspace','Changed study')).then(value=>{settled=true;return value;});
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(settled,false);
 indexedDB.controls.commitError='AbortError';release();assert.equal((await saving).persisted,false);
 indexedDB.controls.commitGate=null;indexedDB.controls.commitError=null;
 assert.equal((await open(indexedDB)).getWorkspace('durable-workspace').name,'Durable study');
 assert.equal(library.getState().durability.workspaces['durable-workspace'].status,'failed');
});

test('unrelated tabs can save independently but stale edits and removals cannot overwrite the same record',async()=>{
 const indexedDB=researchIndexedDB(),first=await open(indexedDB),second=await open(indexedDB);
 const [a,b]=await Promise.all([first.saveWorkspace(workspace()),second.saveWorkspace(workspace('other-study','Other study'))]);
 assert.equal(a.persisted,true);assert.equal(b.persisted,true);
 const stale=await open(indexedDB);assert.equal((await first.saveWorkspace(workspace('durable-workspace','Newer evidence'))).persisted,true);
 const edit=await stale.saveWorkspace(workspace('durable-workspace','Stale edit'));assert.equal(edit.reason,'conflict');assert.equal(edit.persisted,false);
 assert.equal((await stale.removeWorkspace('durable-workspace')).reason,'conflict');
 const reopened=await open(indexedDB);assert.equal(reopened.getWorkspace('durable-workspace').name,'Newer evidence');assert.equal(reopened.getWorkspace('other-study').name,'Other study');
});

test('legacy records migrate without removing original bytes and deleted migrated records stay deleted',async()=>{
 const indexedDB=researchIndexedDB(),pkg=await packageOf(),text=JSON.stringify({version:1,workspaces:[workspace()],packages:[pkg]}),store=localStore(text),library=await open(indexedDB,store);
 assert.equal(store.getItem(RESEARCH_LIBRARY_KEY),text);assert.equal(library.getState().backend,'indexeddb');
 assert.equal(library.getState().durability.packages[pkg.id].status,'durable');
 assert.equal((await library.removePackage(pkg.id)).persisted,true);
 assert.equal((await library.removeWorkspace('durable-workspace')).persisted,true);
 const reopened=await open(indexedDB,store);assert.equal(reopened.getPackage(pkg.id),undefined);assert.equal(reopened.getWorkspace('durable-workspace'),undefined);
 assert.equal(store.getItem(RESEARCH_LIBRARY_KEY),text);
});

test('a migration abort keeps recoverable legacy bytes and can retry on the next opening',async()=>{
 const indexedDB=researchIndexedDB(),text=JSON.stringify({version:1,workspaces:[workspace()],packages:[]}),store=localStore(text);
 indexedDB.controls.writeError='QuotaExceededError';const library=await open(indexedDB,store);
 assert.equal(library.getWorkspace('durable-workspace').name,'Durable study');assert.equal(library.getState().durability.workspaces['durable-workspace'].status,'session');
 assert.equal(store.getItem(RESEARCH_LIBRARY_KEY),text);
 indexedDB.controls.writeError=null;const reopened=await open(indexedDB,store);assert.equal(reopened.getState().durability.workspaces['durable-workspace'].status,'durable');
});

test('corrupt legacy bytes do not block valid new database records or get replaced',async()=>{
 const indexedDB=researchIndexedDB(),store=localStore('{broken'),library=await open(indexedDB,store);
 assert.equal((await library.saveWorkspace(workspace())).persisted,true);assert.equal(store.getItem(RESEARCH_LIBRARY_KEY),'{broken');
 assert.ok((await open(indexedDB,store)).getWorkspace('durable-workspace'));
 assert.match(library.getState().warning,/validat|preserv|legacy/i);
});

test('unavailable and blocked database openings fall back without hanging or destroying legacy bytes',async()=>{
 for(const controls of [{blocked:true},{openError:'SecurityError'}]){
  const indexedDB=researchIndexedDB();Object.assign(indexedDB.controls,controls);
  const text=JSON.stringify({version:1,workspaces:[workspace()],packages:[]}),store=localStore(text),library=await open(indexedDB,store,{openTimeoutMs:20});
  assert.equal(library.getWorkspace('durable-workspace').name,'Durable study');
  assert.equal(library.getState().backend,'localstorage');assert.equal(store.getItem(RESEARCH_LIBRARY_KEY),text);
  assert.equal((await library.saveWorkspace(workspace('after-blocked-open'))).persisted,false,'fallback must not create a competing authority when an existing database may hold newer records');
  assert.equal(store.getItem(RESEARCH_LIBRARY_KEY),text);
 }
});

test('an invalid database package is isolated, preserved and cannot be overwritten or removed automatically',async()=>{
 const indexedDB=researchIndexedDB(),pkg=await packageOf('corrupted-package'),library=await open(indexedDB);await library.pinPackage(pkg);await library.saveWorkspace(workspace());
 const rows=indexedDB.databases.get(RESEARCH_DATABASE_NAME).stores.get('records'),key=`packages:${pkg.id}`,corrupt={...rows.get(key),text:exportResearchPackage(pkg).replace('Frozen study','Tampered study')};rows.set(key,corrupt);
 const reopened=await open(indexedDB);assert.equal(reopened.getPackage(pkg.id),undefined);assert.ok(reopened.getWorkspace('durable-workspace'));
 assert.equal((await reopened.pinPackage(pkg)).reason,'invalid-record');assert.equal((await reopened.removePackage(pkg.id)).reason,'invalid-record');
 assert.deepEqual(rows.get(key),corrupt);
 assert.equal((await reopened.saveWorkspace(workspace('new-valid-record'))).persisted,true);
 assert.ok((await open(indexedDB)).getWorkspace('new-valid-record'));
});

test('a failed deletion retains local evidence for export and does not silently claim removal',async()=>{
 const indexedDB=researchIndexedDB(),library=await open(indexedDB),pkg=await packageOf();await library.pinPackage(pkg);
 indexedDB.controls.commitError='AbortError';const removed=await library.removePackage(pkg.id);assert.equal(removed.persisted,false);
 assert.equal(exportResearchPackage(library.getPackage(pkg.id)),exportResearchPackage(pkg));
 assert.equal(library.getState().durability.packages[pkg.id].status,'failed');
 indexedDB.controls.commitError=null;assert.equal((await library.removePackage(pkg.id)).persisted,true);assert.equal(library.getPackage(pkg.id),undefined);
});

test('delete and recreate revisions prevent stale tabs from overwriting an apparently absent record',async()=>{
 const indexedDB=researchIndexedDB(),first=await open(indexedDB),stale=await open(indexedDB);
 await first.saveWorkspace(workspace());await first.removeWorkspace('durable-workspace');
 const result=await stale.saveWorkspace(workspace('durable-workspace','Stale recreation'));assert.equal(result.reason,'conflict');
 const fresh=await open(indexedDB);assert.equal(fresh.getWorkspace('durable-workspace'),undefined);
 assert.equal((await fresh.saveWorkspace(workspace())).persisted,true);
});

test('native database storage does not depend on Web Locks or usable localStorage',async()=>{
 const indexedDB=researchIndexedDB(),store={getItem(){throw new Error('Storage denied');},setItem(){throw new Error('Storage denied');}},library=await open(indexedDB,store,{locks:null});
 assert.equal((await library.saveWorkspace(workspace())).persisted,true);assert.equal(library.getState().backend,'indexeddb');
 assert.ok((await open(indexedDB,store,{locks:null})).getWorkspace('durable-workspace'));
});
