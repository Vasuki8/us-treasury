import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {series} from '../src/data.js';
import {canonicalJson} from '../src/research-workspaces.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';

const observation=(date,value)=>({date,value,sourceValue:value===null?'...':String(value),publishedAt:null,footnotes:[]});
const retained=()=>({version:1,range:{preset:'all'},sources:{
 beaIta:{status:'error',error:'Partial cached inputs',series:{itaGoodsBalance:{sourceIds:['ITA:T1.1:line32:World:SA:Q'],observations:[observation('2025-07-01',-300),observation('2026-01-01',null)]}}},
 bea:{status:'unavailable',error:'No GDP capture',series:{}},
}});
const trailing=()=>({version:1,range:{preset:'custom',startDate:'2025-01-01',endDate:'2026-04-01'},inputContext:'currentAccountGdpBreakdown'});
const base=exportResearchPackage(await createResearchPackage({id:'current-account-trailing-validation',name:'Retained trailing-four-quarter inputs',now:'2026-10-23T21:00:00.000Z',state:{selected:['gdp'],window:'all'},catalog:{gdp:{...series.gdp,observations:series.gdp.observations.slice(-2)}}}));
function withContext(context){const plain=JSON.parse(base);plain.context=context;delete plain.checksum;plain.checksum={algorithm:'SHA-256',value:createHash('sha256').update(canonicalJson(plain)).digest('hex')};return JSON.stringify(plain);}
async function rejects(change){const context={currentAccountGdpBreakdown:retained(),currentAccountGdpTrailing:trailing()};change(context);await assert.rejects(importResearchPackage(withContext(context)),/current.account.*trailing|current.account.*breakdown|date.window/i);}

test('trailing supplement rejects unsupported envelopes and any input reference except the retained breakdown',async()=>{
 for(const replacement of [null,[],1,'all',{}, {version:2,range:{preset:'all'},inputContext:'currentAccountGdpBreakdown'}, {version:1,range:{preset:'all'}}, {version:1,inputContext:'currentAccountGdpBreakdown'}, {version:1,range:{preset:'all'},inputContext:'currentAccountGdpHistory'}, {version:1,range:{preset:'all'},inputContext:'live'}, {version:1,range:{preset:'all'},inputContext:['currentAccountGdpBreakdown']}, {...trailing(),sources:{}}, {...trailing(),extra:true}])await rejects(context=>{context.currentAccountGdpTrailing=replacement;});
});

test('trailing supplement requires its referenced validated retained breakdown context',async()=>{
 await rejects(context=>{delete context.currentAccountGdpBreakdown;});
 await rejects(context=>{context.currentAccountGdpBreakdown=null;});
 await rejects(context=>{context.currentAccountGdpBreakdown.sources.bea.series={nominalGdp:{observations:[observation('2026-02-01',30000)]}};});
});

test('trailing supplement validates its own window independently of the breakdown selection',async()=>{
 for(const range of [null,'all',-1,50001,{}, {preset:'10y'}, {preset:'all',fallback:'live'}, {preset:'all',startDate:123}, {preset:'custom',startDate:'2026-02-30',endDate:'2026-04-01'}, {preset:'custom',startDate:'2026-04-01',endDate:'2026-01-01'}])await rejects(context=>{context.currentAccountGdpTrailing.range=range;});
 const context={currentAccountGdpBreakdown:retained(),currentAccountGdpTrailing:trailing()};
 const restored=await importResearchPackage(withContext(context));assert.deepEqual(restored.context.currentAccountGdpTrailing.range,context.currentAccountGdpTrailing.range);assert.notDeepEqual(restored.context.currentAccountGdpTrailing.range,restored.context.currentAccountGdpBreakdown.range);
});

test('partial and unavailable trailing claims round-trip through a shared immutable input context',async()=>{
 for(const input of [retained(),{version:1,range:{preset:'all'},sources:{beaIta:{},bea:{}}}]){
  const context={currentAccountGdpBreakdown:input,currentAccountGdpTrailing:trailing()},text=withContext(context),pkg=await importResearchPackage(text);
  assert.deepEqual(pkg.context,context);assert.equal(exportResearchPackage(pkg),canonicalJson(JSON.parse(text)));assert.equal(Object.isFrozen(pkg.context.currentAccountGdpTrailing),true);assert.equal(Object.hasOwn(pkg.context.currentAccountGdpTrailing,'sources'),false);
 }
});

test('legacy imports remain byte-identical and never acquire trailing inputs or fetch current data',async()=>{
 const before=canonicalJson(series),originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen imports must not fetch.');};
 try{for(const text of [base,withContext({currentAccountGdpBreakdown:retained()})]){const pkg=await importResearchPackage(text);assert.equal(exportResearchPackage(pkg),canonicalJson(JSON.parse(text)));assert.equal(Object.hasOwn(pkg.context,'currentAccountGdpTrailing'),false);}assert.equal(canonicalJson(series),before);}finally{globalThis.fetch=originalFetch;}
});
