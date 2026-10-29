import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
import {getSeries,toCsv} from '../src/model.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {parseCsv} from '../scripts/sources/http.mjs';
import {readFile} from 'node:fs/promises';
import {nearestCurveDate} from '../src/yields.js';
import {yieldOverlayDates,yieldCurvesCsv} from '../src/yields-page.js';

test('live date changes navigate, compare and export the snapped dates while incomplete edits preserve the prior date',async()=>{
 const application=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const handler=/root\.addEventListener\('change',async event=>\{([^]*?)\n\}\);/.exec(application);assert.ok(handler);
 const state=parseRoute('#/yields?curveA=2026-10-21&curveB=2026-10-16'),messages=[];
 const source={curveHistory:['2026-10-16','2026-10-19','2026-10-21'].map(date=>({date,nominal:{'10Y':4},real:{'10Y':2}}))};
 const run=new Function('nearestCurveDate','dataStatus','navigate','announce',`return async event=>{${handler[1]}};`)(
  nearestCurveDate,{sources:{yields:source}},patch=>Object.assign(state,patch),message=>messages.push(message));
 const target={id:'yield-curve-date-a',value:'2026-10-20',defaultValue:'2026-10-21',dataset:{},matches:()=>false};await run({target});
 assert.equal(state.yieldDateA,'2026-10-19');assert.match(messages.at(-1),/2026-10-19/);
 assert.deepEqual(yieldOverlayDates(source,parseRoute(routeFor(state))),['2026-10-19','2026-10-16']);
 const [, ...rows]=parseCsv(yieldCurvesCsv(source,state));
 assert.deepEqual([...new Set(rows.map(row=>row[0]))],['2026-10-19','2026-10-16']);
 target.value='';await run({target});assert.equal(state.yieldDateA,'2026-10-19');assert.equal(target.value,target.defaultValue);
});
test('historical curve route preserves dated overlays and registered yield changes use basis points',()=>{
  const state=parseRoute('#/yields?curveA=2026-10-21&curveB=2025-10-21');
  assert.equal(state.page,'yields');assert.equal(state.yieldDateA,'2026-10-21');assert.equal(state.yieldDateB,'2025-10-21');assert.equal(routeFor(state),'#/yields?curveA=2026-10-21&curveB=2025-10-21');assert.equal(getSeries('realYield10')?.changeInBasisPoints,true);
});
test('matched yield CSV retains both input URLs and observation-specific historical provenance',()=>{
  const [headers,...rows]=parseCsv(toCsv(['inflationComp10'],{range:10000}));
  assert.ok(headers.includes('source_urls'));
  for(const row of rows){const data=Object.fromEntries(headers.map((key,i)=>[key,row[i]]));assert.match(data.source_urls,/daily_treasury_real_yield_curve/);assert.match(data.source_url,new RegExp('/'+data.date.slice(0,4)+'/all'));assert.equal(data.observation_type,'calculated');}
});
test('yield admission rejects nominal/real substitutions and unapproved observation input URLs',()=>{
  const feed='https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026';
  const invalid={sources:{yields:{series:{realYield10:{sourceIds:['TC_10YEAR'],sourceUrl:feed}}}}};
  assert.throws(()=>assertCommercialData(invalid),/feed/);
});
