import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {series} from '../src/data.js';
import {canonicalJson} from '../src/research-workspaces.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';

const itaIds=['currentAccountBalance','itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance'];
const locators={currentAccountBalance:30,itaGoodsBalance:32,itaServicesBalance:33,itaPrimaryIncomeBalance:34,itaSecondaryIncomeBalance:35};
const observation=(date,value)=>({date,value,sourceValue:value===null?'...':String(value),publishedAt:null,footnotes:[]});
const source=(id,items)=>({id,status:'ok',fetchedAt:'2026-10-23T20:00:00.000Z',warnings:[],error:null,provenance:[{url:'https://www.bea.gov/data',sha256:'a'.repeat(64),retrievedAt:'2026-10-23T20:00:00.000Z'}],series:items});
const breakdown=()=>({version:1,range:{preset:'all'},sources:{
 beaIta:source('beaIta',Object.fromEntries(itaIds.map((id,index)=>[id,{sourceIds:[`ITA:T1.1:line${locators[id]}:World:SA:Q`],sourceUrl:'https://www.bea.gov/data',observations:[observation('2025-07-01',-300+index),observation('2026-01-01',-400+index),observation('2026-04-01',index===2?null:-500+index)]}]))),
 bea:source('bea',{nominalGdp:{sourceIds:['A191RC'],sourceUrl:'https://www.bea.gov/data',observations:[observation('2025-07-01',30000),observation('2025-10-01',31000),observation('2026-01-01',32000),observation('2026-04-01',33000)]}}),
}});
const base=exportResearchPackage(await createResearchPackage({id:'current-account-breakdown-validation',name:'Retained component history',now:'2026-10-23T21:00:00.000Z',state:{selected:['gdp'],window:'all'},catalog:{gdp:{...series.gdp,observations:series.gdp.observations.slice(-2)}}}));
function withBreakdown(value){const plain=JSON.parse(base);plain.context.currentAccountGdpBreakdown=value;delete plain.checksum;plain.checksum={algorithm:'SHA-256',value:createHash('sha256').update(canonicalJson(plain)).digest('hex')};return JSON.stringify(plain);}
async function rejects(change){const value=breakdown(),replacement=change(value);await assert.rejects(importResearchPackage(withBreakdown(replacement===undefined?value:replacement)),/current.account.*breakdown|date.window/i);}

test('breakdown supplement rejects unsupported envelopes, sources and unrelated series even with a valid checksum',async()=>{
 for(const change of [()=>null,()=>[],()=>1,value=>{value.version=2;},value=>{delete value.version;},value=>{value.extra='ignored';},value=>{delete value.range;},value=>{value.sources=[];},value=>{delete value.sources.bea;},value=>{delete value.sources.beaIta;},value=>{value.sources.live={};},value=>{value.sources.bea=null;},value=>{value.sources.beaIta.series=[];},value=>{value.sources.beaIta.series.itaGoodsServicesBalance=value.sources.beaIta.series.itaGoodsBalance;},value=>{value.sources.bea.series.realGdp=value.sources.bea.series.nominalGdp;}])await rejects(change);
});

test('breakdown supplements validate their own selected date window',async()=>{
 for(const range of [null,'all',-1,50001,{},{preset:'10y'},{preset:'all',fallback:'live'},{preset:'all',startDate:123},{preset:'custom',startDate:'2026-02-30',endDate:'2026-04-01'},{preset:'custom',startDate:'2026-04-01',endDate:'2026-01-01'}])await rejects(value=>{value.range=range;});
});

test('every retained breakdown input requires ordered bounded quarter rows and safe evidence metadata',async()=>{
 for(const [agency,id]of [...itaIds.map(id=>['beaIta',id]),['bea','nominalGdp']]){
  for(const change of [item=>{item.observations={};},item=>{item.observations=[null];},item=>{item.observations[0].date='2025-08-01';},item=>{item.observations[0].date='2025-02-30';},item=>{item.observations[1].date=item.observations[0].date;},item=>{item.observations.reverse();},item=>{item.observations[0].value='-300';},item=>{delete item.observations[0].value;},item=>{item.observations[0].footnotes='Note';},item=>{item.observations[0].sourceValue={};},item=>{item.sourceIds='Wrong shape';},item=>{item.unit=[];},item=>{item.publicationNote={};},item=>{item.provenance=[null];}])await rejects(value=>{change(value.sources[agency].series[id]);});
  await rejects(value=>{value.sources[agency].series[id].observations=Array.from({length:5001},(_,index)=>observation(`${1000+Math.floor(index/4)}-${['01','04','07','10'][index%4]}-01`,index));});
  for(const change of [item=>{item.status=[];},item=>{item.fetchedAt=123;},item=>{item.tableReleaseDate='2026-02-30';},item=>{item.provenance=[null];},item=>{item.provenance[0].retrievedAt={};}])await rejects(value=>{change(value.sources[agency]);});
 }
 await rejects(value=>{value.sources.bea.series.nominalGdp.dataStatus=[];});
});

test('sparse spans are bounded for every component, GDP and the combined ITA calendar',async()=>{
 for(const [agency,id]of [...itaIds.map(id=>['beaIta',id]),['bea','nominalGdp']])await rejects(value=>{value.range=1;value.sources[agency].series[id].observations=[observation('1000-01-01',null),observation('2250-01-01',-100)];});
 await rejects(value=>{value.sources.beaIta.series.itaGoodsBalance.observations=[observation('1000-01-01',-300)];value.sources.beaIta.series.itaServicesBalance.observations=[observation('2250-01-01',100)];});
 const value=breakdown();for(const id of itaIds)value.sources.beaIta.series[id].observations=[observation('1000-01-01',null),observation('2249-10-01',-100)];
 const pkg=await importResearchPackage(withBreakdown(value));assert.deepEqual(pkg.context.currentAccountGdpBreakdown,value);
});

test('complete, partial and unavailable breakdown claims round-trip without filling or discarding missing data',async()=>{
 const partial=breakdown();delete partial.sources.beaIta.series.itaPrimaryIncomeBalance;partial.sources.beaIta.status='error';partial.sources.beaIta.error='Cached captured inputs';partial.sources.bea.series.nominalGdp.dataStatus='official';
 const empty=breakdown();for(const input of Object.values(empty.sources))for(const item of Object.values(input.series))item.observations=[];
 for(const input of [breakdown(),partial,empty,{version:1,range:12,sources:{beaIta:{status:'unavailable',series:{},error:'No ITA capture'},bea:{status:'error',series:{},error:'No GDP capture'}}},{version:1,range:{preset:'all'},sources:{beaIta:{},bea:{}}}]){
  const pkg=await importResearchPackage(withBreakdown(input));assert.deepEqual(pkg.context.currentAccountGdpBreakdown,input);assert.equal(exportResearchPackage(pkg),canonicalJson(JSON.parse(withBreakdown(input))));assert.equal(Object.isFrozen(pkg.context.currentAccountGdpBreakdown.sources),true);
 }
});

test('legacy packages stay byte-identical and imports never add breakdown data or fetch current inputs',async()=>{
 const originalFetch=globalThis.fetch,before=canonicalJson(series);globalThis.fetch=()=>{throw new Error('Frozen imports must not fetch.');};
 try{const legacy=await importResearchPackage(base);assert.equal(exportResearchPackage(legacy),base);assert.equal(Object.hasOwn(legacy.context,'currentAccountGdpBreakdown'),false);const input=breakdown(),restored=await importResearchPackage(withBreakdown(input));assert.deepEqual(restored.context.currentAccountGdpBreakdown,input);assert.equal(canonicalJson(series),before);}finally{globalThis.fetch=originalFetch;}
});
