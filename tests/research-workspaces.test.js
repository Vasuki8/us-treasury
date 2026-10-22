import test from 'node:test';
import assert from 'node:assert/strict';
let api;
try{api=await import('../src/research-workspaces.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('research-workspaces.js'))throw error;}
const use=()=>{assert.ok(api,'Named research workspaces must exist');return api;};
const now='2026-10-22T15:00:00.000Z';

test('named workspace restores current validated research configuration without browser preferences',()=>{
 const record=use().createWorkspace({id:'workspace-one',name:' Treasury research ',now,state:{page:'explore',query:'Treasury',topic:'Fiscal',frequency:'Monthly',selected:['receipts','publicDebt'],exploreMode:'compare',comparison:'difference',window:'custom',startDate:'2025-01-01',endDate:'2026-09-30',theme:'Paper',saved:['sofr'],returnTo:'https://example.com'}});
 const state=use().openWorkspace(record);
 assert.equal(record.name,'Treasury research');assert.equal(record.createdAt,now);
 for(const [key,value]of Object.entries({page:'explore',query:'Treasury',comparison:'difference',window:'custom',startDate:'2025-01-01',endDate:'2026-09-30'}))assert.equal(state[key],value);
 assert.deepEqual(state.selected,['receipts','publicDebt']);assert.equal(state.returnTo,null);
 assert.equal(Object.hasOwn(state,'saved'),false);assert.equal(Object.hasOwn(state,'theme'),false);
});

test('workspace names and IDs are bounded and invalid local configuration cannot create external navigation',()=>{
 const {createWorkspace,parseWorkspace}=use();
 for(const name of ['', ' '.repeat(5), 'x'.repeat(81)])assert.throws(()=>createWorkspace({name,now,state:{}}),/name/i);
 assert.throws(()=>createWorkspace({id:'../escape',name:'Example',now,state:{}}),/id/i);
 const record=createWorkspace({name:'Example',now,state:{page:'macroCoverage',macroFamily:'housing',macroMeasure:'housingStarts',selected:['housingStarts'],window:'all'}});
 const restored=parseWorkspace(JSON.parse(JSON.stringify(record)));
 assert.equal(restored.state.page,'macroCoverage');assert.equal(restored.state.macroFamily,'housing');
 assert.equal(restored.state.window,'all');assert.equal(Object.isFrozen(restored),true);
});

test('stored workspace records require a complete canonical identity and exact UTC timestamp',()=>{
 const {createWorkspace,parseWorkspace}=use(),record=createWorkspace({id:'valid-workspace',name:'Example',now,state:{page:'explore'}});
 for(const changed of [{...record,createdAt:0},{...record,createdAt:'October 22, 2026'},{...record,name:' Example '},{version:1,state:{}}])assert.throws(()=>parseWorkspace(changed),/workspace|name|timestamp|id/i);
});
