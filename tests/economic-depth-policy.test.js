import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {parseBeaEconomicDepth} from '../scripts/sources/bea.mjs';
import {snapshot as stored} from '../src/official-snapshot.js';
import {assertEconomicDepthData} from '../scripts/economic-depth-policy.mjs';

const codes=['A191RC','LB000003','PB000003','A261RC','A261RL','A008RL','A011RL','A009RL','Y033RL','Y001RL','B020RC','B021RC','A019RC'];
const quarterly='https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt',monthly='https://apps.bea.gov/national/Release/TXT/NipaDataM.txt';
const series=()=>parseBeaEconomicDepth('%SeriesCode,Period,Value\n'+codes.map(code=>`${code},2026Q2,1000`).join('\n'),'%SeriesCode,Period,Value\nA072RC,2026M08,4');
const snapshot=()=>({sources:{bea:{series:series(),provenance:[{url:quarterly,sha256:'a'.repeat(64)},{url:monthly,sha256:'b'.repeat(64)}]}}});
test('economic depth admission accepts only exact reviewed codes with correct quarterly/monthly files and unknown publication dates',()=>{
  assert.doesNotThrow(()=>assertCommercialData(snapshot()));
  for(const change of [s=>s.sources.bea.series.nominalGdp.sourceIds=['A191RX'],s=>s.sources.bea.series.nominalGdp.sourceUrl=monthly,s=>s.sources.bea.series.savingRate.sourceUrl=quarterly,s=>s.sources.bea.series.nominalGdp.observations[0].publishedAt='2026-09-30',s=>s.sources.bea.provenance=[]]){
    const value=snapshot();change(value);assert.throws(()=>assertCommercialData(value),/identifier|feed|publication|provenance/i);
  }
});

test('BLS economic depth permits either exact API with a matching hashed capture',()=>{
  for(const endpoint of ['https://api.bls.gov/publicAPI/v1/timeseries/data/','https://api.bls.gov/publicAPI/v2/timeseries/data/']){
    const source=structuredClone(stored.sources.bls);
    for(const series of Object.values(source.series))series.sourceUrl=endpoint;
    for(const receipt of source.provenance)receipt.url=endpoint;
    assert.doesNotThrow(()=>assertEconomicDepthData({sources:{bls:source}}));
    source.provenance[0].url=endpoint.replace('/data/','/data/?key=secret');
    assert.throws(()=>assertEconomicDepthData({sources:{bls:source}}),/provenance/i);
  }
});

test('harmonized main 10Y row capture timestamps and hashes must identify a retained annual response',()=>{
  const url='https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2022/all?type=daily_treasury_yield_curve&field_tdr_date_value=2022&page&_format=csv';
  const row={date:'2022-01-03',value:1.63,publishedAt:null,sourceUrl:url,retrievedAt:'2026-10-23T02:40:33Z',sourceSha256:'a'.repeat(64)};
  const source={series:{yield:{sourceIds:['BC_10YEAR'],sourceUrl:url,observations:[row]}},provenance:[{url,retrievedAt:row.retrievedAt,sha256:row.sourceSha256}]};
  assert.doesNotThrow(()=>assertCommercialData({sources:{treasury:source}}));
  for(const change of [{retrievedAt:'2020-01-01T00:00:00Z'},{sourceSha256:'b'.repeat(64)},{sourceUrl:url.replace('2022/all','2023/all')}]){
    const edited=structuredClone(source);Object.assign(edited.series.yield.observations[0],change);
    assert.throws(()=>assertCommercialData({sources:{treasury:edited}}),/provenance|capture/i);
  }
});
