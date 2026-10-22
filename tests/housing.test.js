import test from 'node:test';
import assert from 'node:assert/strict';
import {zipFixture} from './helpers/zip.mjs';
let api;
try{api=await import('../scripts/sources/housing.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('housing.mjs'))throw error;}
const use=()=>{assert.ok(api,'Census housing collector must exist');return api;};
const now=new Date('2026-10-22T15:00:00Z');
const usage='Data Usage and Attribution\n==========================\nAll products developed using these data files must attribute the datasource as the U.S. Census Bureau and must contain the originating program name.\nContacts\n';
const csv=(rows=['1,4,1,0,7,1,1200','2,4,1,0,7,1,(S)','1,1,1,0,7,1,1300','2,1,1,0,7,1,1350','1,6,1,0,7,1,1100','2,6,1,0,7,1,1150'])=>['CATEGORIES','cat_idx,cat_code,cat_desc,cat_indent','1,APERMITS,Annual Rate for Housing Units Authorized in Permit-Issuing Places,0','4,ASTARTS,Annual Rate for Housing Units Started,0','6,ACOMPLETIONS,Annual Rate for Housing Units Completed,0','2,STARTS,Housing Units Started,0','DATA TYPES','dt_idx,dt_code,dt_desc,dt_unit','1,TOTAL,Total Units,K','2,SINGLE,Single-family Units,K','ERROR TYPES','et_idx,err_code,err_desc,err_unit','1,E_TOTAL,Relative Standard Error for Total Units,PCT','GEO LEVELS','geo_idx,geo_code,geo_desc','7,US,United States','TIME PERIODS','per_idx,per_name','1,Jan-2017','2,Sep-2026','3,Jan-2027','NOTES','"Estimates are revisable."','DATA UPDATED ON','Tuesday, 20-Oct-26 07:37:46 EDT','DATA','per_idx,cat_idx,dt_idx,et_idx,geo_idx,is_adj,val',...rows,'2,2,1,0,7,0,999','2,4,2,0,7,1,999','2,4,1,1,7,1,999','3,4,1,0,7,1,999'].join('\r\n');

test('housing parser selects total US SAAR categories without substituting NSA, single-family or error estimates',()=>{
 const result=use().parseHousingCsv(csv(),{now});
 assert.deepEqual(result.series.housingStarts.observations.map(row=>[row.date,row.value]),[['2017-01-01',1200],['2026-09-01',null]]);
 assert.deepEqual(result.series.housingPermits.observations.map(row=>row.value),[1300,1350]);
 assert.deepEqual(result.series.housingCompletions.observations.map(row=>row.value),[1100,1150]);
 assert.equal(result.series.housingStarts.observations.at(-1).sourceValue,'(S)');
 assert.ok(Object.values(result.series).every(s=>s.observations.every(row=>row.publishedAt===null)));
});

test('housing parser fails closed on unknown categories, units, selected periods, duplicates and invalid values',()=>{
 const {parseHousingCsv}=use();
 for(const value of [csv().replace('ASTARTS','WRONG'),csv().replace('Total Units,K','Total Units,PCT'),csv().replace('7,US,','7,XX,'),csv(['9,4,1,0,7,1,1200']),csv()+'\r\n2,4,1,0,7,1,1300',csv().replace('0,7,1,1200','0,7,1,-1200'),csv().replace('per_idx,cat_idx,dt_idx,et_idx,geo_idx,is_adj,val','bad,header')])assert.throws(()=>parseHousingCsv(value,{now}),/Census|housing|metadata|duplicate|period|numeric|header/i);
});

test('housing collector reuses official ZIP/README attribution and retains exact native thousands-SAAR values',async()=>{
 const bytes=zipFixture([{name:'RESCONST-mf.csv',text:csv()},{name:'/README',text:usage}]);
 const result=await use().collectHousing({now,fetchImpl:async url=>{assert.equal(url,'https://www.census.gov/econ_getzippedfile/?programCode=RESCONST');return new Response(bytes);}});
 assert.equal(result.id,'housing');assert.deepEqual(result.series.housingStarts.sourceIds,['RESCONST:ASTARTS:TOTAL:US:SA']);
 assert.equal(result.series.housingStarts.observations[0].value,1200);
 assert.match(result.series.housingStarts.attribution,/U.S. Census Bureau.*New Residential Construction/);
 assert.match(result.series.housingStarts.coverageNote,/annual rate.*actual|actual.*annual rate/i);
 assert.match(result.provenance[0].usageNote,/originating program name/);assert.match(result.provenance[0].sha256,/^[a-f0-9]{64}$/);
 assert.equal(result.provenance[0].fileUpdatedAt,'Tuesday, 20-Oct-26 07:37:46 EDT');
});

test('housing collector rejects missing README conditions, unavailable downloads and redirects',async()=>{
 const bytes=zipFixture([{name:'RESCONST-mf.csv',text:csv()},{name:'/README',text:'No attribution details'}]);
 await assert.rejects(use().collectHousing({now,fetchImpl:async()=>new Response(bytes)}),/attribution|usage/i);
 await assert.rejects(use().collectHousing({now,fetchImpl:async()=>new Response('blocked',{status:403})}),/403/);
 await assert.rejects(use().collectHousing({now,fetchImpl:async()=>({ok:true,redirected:true,url:'https://example.com'})}),/redirect|URL/i);
});

test('housing backfill retains January 2000 onward without filling gaps, changing SAAR scale or losing zero/null distinctions',()=>{
 const earlier=['4,4,1,0,7,1,999','4,1,1,0,7,1,999','4,6,1,0,7,1,999','5,4,1,0,7,1,(S)','5,1,1,0,7,1,1250','5,6,1,0,7,1,1150','6,4,1,0,7,1,0'];
 const input=csv().replace('3,Jan-2027','3,Jan-2027\r\n4,Dec-1999\r\n5,Jan-2000\r\n6,Mar-2000')+'\r\n'+earlier.join('\r\n');
 const result=use().parseHousingCsv(input,{now});
 assert.deepEqual(result.series.housingStarts.observations.slice(0,2).map(o=>[o.date,o.value,o.sourceValue]),[['2000-01-01',null,'(S)'],['2000-03-01',0,'0']]);
 assert.deepEqual(result.series.housingPermits.observations[0],{date:'2000-01-01',value:1250,sourceValue:'1250',publishedAt:null,footnotes:[]});
 assert.equal(result.series.housingCompletions.observations[0].value,1150);
 assert.ok(Object.values(result.series).every(s=>!s.observations.some(o=>o.date<'2000-01-01'||o.date==='2000-02-01')));
 assert.equal(result.series.housingPermits.observations.at(-1).value,1350);
});
