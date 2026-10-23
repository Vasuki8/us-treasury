import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshSnapshot} from '../scripts/sources/refresh.mjs';

const url=year=>`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
const capture=(year,time,sha)=>({url:url(year),retrievedAt:time,sha256:sha.repeat(64)});
const measurement=observations=>({sourceIds:['BC_10YEAR'],sourceUrl:url(2026),observations,observationType:'official',dataStatus:'official'});
test('partial Treasury refresh preserves prior history and newer readings when curve refresh fails',async()=>{
  const previous={sources:{treasury:{id:'treasury',status:'ok',fetchedAt:'2026-10-22T01:00:00Z',series:{yield:measurement([{date:'2022-01-03',value:1.63,publishedAt:null,sourceUrl:url(2022)},{date:'2026-10-21',value:4.9,publishedAt:null}])},provenance:[capture(2022,'2026-10-22T01:00:00Z','a'),capture(2026,'2026-10-22T01:00:00Z','b')]},yields:{id:'yields',status:'ok',fetchedAt:'2026-10-22T01:00:00Z',series:{nominalYield2:{sourceIds:['BC_2YEAR'],sourceUrl:url(2026),observations:[{date:'2026-10-21',value:4.1,publishedAt:null}]}},curveHistory:[{date:'2022-01-03',nominal:{'10Y':1.63}},{date:'2026-10-21',nominal:{'10Y':4.9}}],provenance:[capture(2022,'2026-10-22T01:00:00Z','a'),capture(2026,'2026-10-22T01:00:00Z','b')]}}};
  const now=new Date('2026-10-23T02:00:00Z');
  const fresh={id:'treasury',fetchedAt:now.toISOString(),series:{yield:measurement([{date:'2026-10-21',value:4.95,publishedAt:null},{date:'2026-10-22',value:4.96,publishedAt:null}])},provenance:[capture(2026,now.toISOString(),'c')]};
  const result=await refreshSnapshot({previous,collectors:{treasury:async()=>fresh,yields:async()=>{throw new Error('Official curve feed unavailable');}},now});
  assert.equal(result.sources.treasury.status,'ok');assert.equal(result.sources.yields.status,'error');
  assert.deepEqual(result.sources.treasury.series.yield.observations.map(row=>[row.date,row.value]),[['2022-01-03',1.63],['2026-10-21',4.95],['2026-10-22',4.96]]);
  assert.equal(result.sources.treasury.series.yield.observations[0].retrievedAt,'2026-10-22T01:00:00Z');
  assert.equal(result.sources.treasury.series.yield.observations.at(-1).retrievedAt,now.toISOString());
  assert.equal(previous.sources.treasury.series.yield.observations.length,2,'historical captures remain immutable');
});
