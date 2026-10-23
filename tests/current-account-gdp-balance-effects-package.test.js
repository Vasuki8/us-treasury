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
const effects=()=>({version:1,method:'symmetric-two-order-v1',range:{preset:'custom',startDate:'2025-01-01',endDate:'2026-04-01'},inputContext:'currentAccountGdpBreakdown'});
const base=exportResearchPackage(await createResearchPackage({id:'current-account-effects-validation',name:'Retained balance and GDP effects',now:'2026-10-23T21:00:00.000Z',state:{selected:['gdp'],window:'all'},catalog:{gdp:{...series.gdp,observations:series.gdp.observations.slice(-2)}}}));
function withContext(context){const plain=JSON.parse(base);plain.context=context;delete plain.checksum;plain.checksum={algorithm:'SHA-256',value:createHash('sha256').update(canonicalJson(plain)).digest('hex')};return JSON.stringify(plain);}
async function rejects(change){const context={currentAccountGdpBreakdown:retained(),currentAccountGdpBalanceEffects:effects()};change(context);await assert.rejects(importResearchPackage(withContext(context)),/current.account.*balance.effects|current.account.*breakdown|date.window/i);}

test('balance-effects supplement requires the exact four-key versioned symmetric-method envelope',async()=>{
 for(const replacement of [null,[],1,'all',{}, {...effects(),version:2}, {...effects(),sources:{}}, {...effects(),extra:true}])await rejects(context=>{context.currentAccountGdpBalanceEffects=replacement;});
 for(const field of ['version','method','range','inputContext'])await rejects(context=>{delete context.currentAccountGdpBalanceEffects[field];});
 for(const method of ['prior-gdp-first','symmetric-two-order-v2','Symmetric-two-order-v1',null,1,{}])await rejects(context=>{context.currentAccountGdpBalanceEffects.method=method;});
 for(const inputContext of ['currentAccountGdpHistory','currentAccountGdpContributions','currentAccountGdpTrailing','live',null,['currentAccountGdpBreakdown']])await rejects(context=>{context.currentAccountGdpBalanceEffects.inputContext=inputContext;});
});

test('balance effects require the existing validated breakdown rather than fetching or accepting other retained inputs',async()=>{
 await rejects(context=>{delete context.currentAccountGdpBreakdown;});
 await rejects(context=>{context.currentAccountGdpBreakdown=null;});
 await rejects(context=>{context.currentAccountGdpBreakdown.sources.bea.series={nominalGdp:{observations:[observation('2026-02-01',30000)]}};});
 await rejects(context=>{context.currentAccountGdpBreakdown.sources.beaIta.series.itaGoodsBalance.observations[0].value='-300';});
});

test('balance effects validate their own endpoint window independently of the retained input window',async()=>{
 for(const range of [null,'all',-1,50001,{}, {preset:'10y'}, {preset:'all',fallback:'live'}, {preset:'all',startDate:123}, {preset:'custom',startDate:'2026-02-30',endDate:'2026-04-01'}, {preset:'custom',startDate:'2026-04-01',endDate:'2026-01-01'}])await rejects(context=>{context.currentAccountGdpBalanceEffects.range=range;});
 const context={currentAccountGdpBreakdown:retained(),currentAccountGdpBalanceEffects:effects()},pkg=await importResearchPackage(withContext(context));
 assert.deepEqual(pkg.context.currentAccountGdpBalanceEffects.range,context.currentAccountGdpBalanceEffects.range);assert.notDeepEqual(pkg.context.currentAccountGdpBalanceEffects.range,pkg.context.currentAccountGdpBreakdown.range);
});

test('partial balance-effects inputs round-trip immutably without copied histories, contributions context or network access',async()=>{
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen imports must not fetch.');};
 try{for(const input of [retained(),{version:1,range:{preset:'all'},sources:{beaIta:{},bea:{}}}]){
  const context={currentAccountGdpBreakdown:input,currentAccountGdpBalanceEffects:effects()},text=withContext(context),pkg=await importResearchPackage(text);
  assert.deepEqual(pkg.context,context);assert.equal(exportResearchPackage(pkg),canonicalJson(JSON.parse(text)));assert.equal(Object.isFrozen(pkg.context.currentAccountGdpBalanceEffects),true);assert.equal(Object.hasOwn(pkg.context.currentAccountGdpBalanceEffects,'sources'),false);assert.equal(Object.hasOwn(pkg.context,'currentAccountGdpContributions'),false);
 }}finally{globalThis.fetch=originalFetch;}
});

test('legacy package exports remain byte-identical and never acquire balance-effects context or a method',async()=>{
 for(const text of [base,withContext({currentAccountGdpBreakdown:retained()}),withContext({currentAccountGdpBreakdown:retained(),currentAccountGdpContributions:{version:1,range:{preset:'all'},inputContext:'currentAccountGdpBreakdown'}})]){const pkg=await importResearchPackage(text);assert.equal(exportResearchPackage(pkg),canonicalJson(JSON.parse(text)));assert.equal(Object.hasOwn(pkg.context,'currentAccountGdpBalanceEffects'),false);}
});
