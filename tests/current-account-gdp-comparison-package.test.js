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
const comparison=()=>({version:1,range:{preset:'custom',startDate:'2025-01-01',endDate:'2026-04-01'},measure:'itaGoodsBalance',inputContext:'currentAccountGdpBreakdown'});
const base=exportResearchPackage(await createResearchPackage({id:'current-account-comparison-validation',name:'Retained quarterly and trailing comparison',now:'2026-10-23T21:00:00.000Z',state:{selected:['gdp'],window:'all'},catalog:{gdp:{...series.gdp,observations:series.gdp.observations.slice(-2)}}}));
function withContext(context){const plain=JSON.parse(base);plain.context=context;delete plain.checksum;plain.checksum={algorithm:'SHA-256',value:createHash('sha256').update(canonicalJson(plain)).digest('hex')};return JSON.stringify(plain);}
async function rejects(change){const context={currentAccountGdpBreakdown:retained(),currentAccountGdpComparison:comparison()};change(context);await assert.rejects(importResearchPackage(withContext(context)),/current.account.*comparison|current.account.*breakdown|date.window/i);}

test('comparison supplement accepts only its four-key versioned envelope and shared retained input reference',async()=>{
 for(const replacement of [null,[],1,'all',{}, {...comparison(),version:2}, {...comparison(),sources:{}}, {...comparison(),extra:true}])await rejects(context=>{context.currentAccountGdpComparison=replacement;});
 for(const field of ['version','range','measure','inputContext'])await rejects(context=>{delete context.currentAccountGdpComparison[field];});
 for(const inputContext of ['currentAccountGdpHistory','currentAccountGdpTrailing','live',null,['currentAccountGdpBreakdown']])await rejects(context=>{context.currentAccountGdpComparison.inputContext=inputContext;});
});

test('comparison requires the existing validated breakdown and restricts the selected measurement',async()=>{
 await rejects(context=>{delete context.currentAccountGdpBreakdown;});
 await rejects(context=>{context.currentAccountGdpBreakdown=null;});
 await rejects(context=>{context.currentAccountGdpBreakdown.sources.bea.series={nominalGdp:{observations:[observation('2026-02-01',30000)]}};});
 for(const measure of ['itaGoodsServicesBalance','nominalGdp','gdp','currentAccountToGdp','__proto__',null,[],{}])await rejects(context=>{context.currentAccountGdpComparison.measure=measure;});
 for(const measure of ['currentAccountBalance','itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance']){
  const context={currentAccountGdpBreakdown:retained(),currentAccountGdpComparison:{...comparison(),measure}};
  const pkg=await importResearchPackage(withContext(context));assert.equal(pkg.context.currentAccountGdpComparison.measure,measure);
 }
});

test('comparison validates its own endpoint window without changing retained input coverage',async()=>{
 for(const range of [null,'all',-1,50001,{}, {preset:'10y'}, {preset:'all',fallback:'live'}, {preset:'all',startDate:123}, {preset:'custom',startDate:'2026-02-30',endDate:'2026-04-01'}, {preset:'custom',startDate:'2026-04-01',endDate:'2026-01-01'}])await rejects(context=>{context.currentAccountGdpComparison.range=range;});
 const context={currentAccountGdpBreakdown:retained(),currentAccountGdpComparison:comparison()},pkg=await importResearchPackage(withContext(context));
 assert.deepEqual(pkg.context.currentAccountGdpComparison.range,context.currentAccountGdpComparison.range);assert.notDeepEqual(pkg.context.currentAccountGdpComparison.range,pkg.context.currentAccountGdpBreakdown.range);
});

test('partial comparison inputs round-trip immutably without copied histories or current-data fetches',async()=>{
 const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('Frozen imports must not fetch.');};
 try{for(const input of [retained(),{version:1,range:{preset:'all'},sources:{beaIta:{},bea:{}}}]){
  const context={currentAccountGdpBreakdown:input,currentAccountGdpComparison:comparison()},text=withContext(context),pkg=await importResearchPackage(text);
  assert.deepEqual(pkg.context,context);assert.equal(exportResearchPackage(pkg),canonicalJson(JSON.parse(text)));assert.equal(Object.isFrozen(pkg.context.currentAccountGdpComparison),true);assert.equal(Object.hasOwn(pkg.context.currentAccountGdpComparison,'sources'),false);
 }}finally{globalThis.fetch=originalFetch;}
});

test('legacy package imports stay byte-identical and do not acquire comparison context',async()=>{
 for(const text of [base,withContext({currentAccountGdpBreakdown:retained()})]){const pkg=await importResearchPackage(text);assert.equal(exportResearchPackage(pkg),canonicalJson(JSON.parse(text)));assert.equal(Object.hasOwn(pkg.context,'currentAccountGdpComparison'),false);}
});
