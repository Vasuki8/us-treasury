import test from 'node:test';
import assert from 'node:assert/strict';
import {zipFixture} from './helpers/zip.mjs';
let api;
try{api=await import('../scripts/sources/housing.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('housing.mjs'))throw error;}
const use=()=>{assert.ok(api,'Census housing collector must exist');return api;};
const now=new Date('2026-10-22T15:00:00Z');
const usage='Data Usage and Attribution\n==========================\nAll products developed using these data files must attribute the datasource as the U.S. Census Bureau and must contain the originating program name.\nContacts\n';
const csv=(rows=['1,4,1,0,7,1,1200','2,4,1,0,7,1,(S)','1,1,1,0,7,1,1300','2,1,1,0,7,1,1350','1,6,1,0,7,1,1100','2,6,1,0,7,1,1150'])=>['CATEGORIES','cat_idx,cat_code,cat_desc,cat_indent','1,APERMITS,Annual Rate for Housing Units Authorized in Permit-Issuing Places,0','4,ASTARTS,Annual Rate for Housing Units Started,0','6,ACOMPLETIONS,Annual Rate for Housing Units Completed,0','2,STARTS,Housing Units Started,0','DATA TYPES','dt_idx,dt_code,dt_desc,dt_unit','1,TOTAL,Total Units,K','2,SINGLE,Single-family Units,K','ERROR TYPES','et_idx,err_code,err_desc,err_unit','1,E_TOTAL,Relative Standard Error for Total Units,PCT','GEO LEVELS','geo_idx,geo_code,geo_desc','7,US,United States','TIME PERIODS','per_idx,per_name','1,Jan-2017','2,Sep-2026','3,Jan-2027','NOTES','"Estimates are revisable."','DATA UPDATED ON','Tuesday, 20-Oct-26 07:37:46 EDT','DATA','per_idx,cat_idx,dt_idx,et_idx,geo_idx,is_adj,val',...rows,'2,2,1,0,7,0,999','2,4,2,0,7,1,999','2,4,1,1,7,1,999','3,4,1,0,7,1,999'].join('\r\n');
const historicalCsv=()=>csv().replace('7,US,United States','7,US,United States\r\n8,NE,Northeast')
 .replace('3,Jan-2027','3,Jan-2027\r\n4,Jan-1959\r\n5,Mar-1959\r\n6,Jan-1960\r\n7,Jan-1968\r\n8,Dec-1999\r\n9,Jan-2000')+'\r\n'+[
  '4,4,1,0,7,1,1657.2500','5,4,1,0,7,1,0','6,4,1,0,7,1,(S)',
  '6,1,1,0,7,1,1092.50','7,6,1,0,7,1,1029.125',
  '8,4,1,0,7,1,999','8,1,1,0,7,1,999','8,6,1,0,7,1,999',
  '9,4,1,0,7,1,(S)','9,1,1,0,7,1,1250.7500','9,6,1,0,7,1,1150',
  '4,4,1,0,8,1,9999','4,4,1,0,7,0,9999','4,2,1,0,7,1,9999','4,4,2,0,7,1,9999','4,4,1,1,7,1,9999',
 ].join('\r\n');

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
 const bytes=zipFixture([{name:'RESCONST-mf.csv',text:historicalCsv()},{name:'/README',text:usage}]);
 const before=Date.now();
 const result=await use().collectHousing({now,fetchImpl:async url=>{assert.equal(url,'https://www.census.gov/econ_getzippedfile/?programCode=RESCONST');return new Response(bytes);}});
 const after=Date.now();
 assert.equal(result.id,'housing');assert.deepEqual(result.series.housingStarts.sourceIds,['RESCONST:ASTARTS:TOTAL:US:SA']);
 assert.deepEqual(result.series.housingStarts.observations[0],{date:'1959-01-01',value:1657.25,sourceValue:'1657.2500',publishedAt:null,footnotes:[]});
 assert.match(result.series.housingStarts.attribution,/U.S. Census Bureau.*New Residential Construction/);
 assert.match(result.series.housingStarts.coverageNote,/annual rate.*actual|actual.*annual rate/i);
 assert.match(result.provenance[0].usageNote,/originating program name/);assert.match(result.provenance[0].sha256,/^[a-f0-9]{64}$/);
 assert.equal(result.provenance[0].fileUpdatedAt,'Tuesday, 20-Oct-26 07:37:46 EDT');
 assert.equal(result.fetchedAt,result.provenance[0].retrievedAt);
 assert.ok(Date.parse(result.fetchedAt)>=before&&Date.parse(result.fetchedAt)<=after);
});

test('housing collector rejects missing README conditions, unavailable downloads and redirects',async()=>{
 const bytes=zipFixture([{name:'RESCONST-mf.csv',text:csv()},{name:'/README',text:'No attribution details'}]);
 await assert.rejects(use().collectHousing({now,fetchImpl:async()=>new Response(bytes)}),/attribution|usage/i);
 await assert.rejects(use().collectHousing({now,fetchImpl:async()=>new Response('blocked',{status:403})}),/403/);
 await assert.rejects(use().collectHousing({now,fetchImpl:async()=>({ok:true,redirected:true,url:'https://example.com'})}),/redirect|URL/i);
});

test('housing retains each published history from its own start without filling gaps or changing native SAAR precision',()=>{
 const result=use().parseHousingCsv(historicalCsv(),{now});
 const expected={
  housingStarts:[['1959-01-01',1657.25,'1657.2500'],['1959-03-01',0,'0'],['1960-01-01',null,'(S)'],['1999-12-01',999,'999'],['2000-01-01',null,'(S)'],['2017-01-01',1200,'1200'],['2026-09-01',null,'(S)']],
  housingPermits:[['1960-01-01',1092.5,'1092.50'],['1999-12-01',999,'999'],['2000-01-01',1250.75,'1250.7500'],['2017-01-01',1300,'1300'],['2026-09-01',1350,'1350']],
  housingCompletions:[['1968-01-01',1029.125,'1029.125'],['1999-12-01',999,'999'],['2000-01-01',1150,'1150'],['2017-01-01',1100,'1100'],['2026-09-01',1150,'1150']],
 };
 for(const [id,rows]of Object.entries(expected)){
  assert.deepEqual(result.series[id].observations.map(o=>[o.date,o.value,o.sourceValue]),rows);
  assert.ok(result.series[id].observations.every(o=>o.publishedAt===null));
 }
});
