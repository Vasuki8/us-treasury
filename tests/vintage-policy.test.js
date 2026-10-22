import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import { assertVintageData } from '../scripts/vintage-policy.mjs';
import { assertCommercialData } from '../scripts/data-policy.mjs';
import {loadSnapshotHistory} from '../scripts/snapshot-storage.mjs';
import {snapshot as stored} from '../src/official-snapshot.js';
import {registry} from '../src/registry.js';
import { asKnownOn, recordVintages } from '../src/vintages.js';

const t1='2026-10-20T12:00:00.000Z',t2='2026-10-21T12:00:00.000Z';
const url='https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
const source=(fetchedAt,value)=>({id:'bea',fetchedAt,series:{gdp:{sourceIds:['A191RL'],sourceUrl:url,dataStatus:'official',calculation:'Published real GDP growth',observations:[{date:'2026-07-01',value,publishedAt:null,sourceValue:String(value)}]}},provenance:[{url,sha256:'a'.repeat(64),retrievedAt:fetchedAt,lastModified:null}]});
const fixture=()=>recordVintages(null,{bea:source(t1,2.2)},{bea:source(t2,2.4)},{checkedAt:t2});

test('archive admission checks every actual retrieval state with its captured metadata',()=>{
  const vintages=fixture(),seen=[];
  assertVintageData(vintages,snapshot=>{
    assertCommercialData(snapshot);
    seen.push({time:snapshot.sources.bea.fetchedAt,value:snapshot.sources.bea.series.gdp.observations[0].value,sourceId:snapshot.sources.bea.series.gdp.sourceIds[0],provenance:snapshot.sources.bea.provenance[0].retrievedAt});
  });
  assert.deepEqual(seen,[{time:t1,value:2.2,sourceId:'A191RL',provenance:t1},{time:t2,value:2.4,sourceId:'A191RL',provenance:t2}]);
});

test('a valid latest state cannot hide an unreviewed historical series identifier, feed, source or provenance',()=>{
  for(const mutate of [
    capture=>{capture.series.gdp.metadata.sourceIds=['UNREVIEWED'];},
    capture=>{capture.series.gdp.metadata.sourceUrl='https://vendor.example/gdp';},
    capture=>{capture.provenance[0].url='https://vendor.example/gdp';},
    capture=>{capture.series.unreviewed=structuredClone(capture.series.gdp);},
  ]){
    const vintages=fixture();mutate(vintages.captures[0]);
    if(vintages.captures[0].series.unreviewed)vintages.captures[1].removedSeries=['unreviewed'];
    assert.doesNotThrow(()=>assertCommercialData(asKnownOn(vintages,t2)),'latest-only admission misses the historical substitution');
    assert.throws(()=>assertVintageData(vintages,assertCommercialData),/review|feed|provenance|identifier|series/i);
  }
  const vintages=fixture(),unreviewed=structuredClone(vintages.captures[0]);
  unreviewed.sourceId='vendor';
  vintages.captures.unshift(unreviewed);
  assert.throws(()=>assertVintageData(vintages,assertCommercialData),/review.*source|source.*review/i);
});

test('captured supplemental input URLs must identify an actual response in that retrieval provenance',()=>{
  for(const mutate of [
    capture=>{capture.metadata.sourceUrls=['https://vendor.example/source'];},
    capture=>{capture.series.gdp.metadata.sourceUrls=['https://vendor.example/input'];},
    capture=>{capture.series.gdp.upserts[0].sourceUrl='https://vendor.example/observation';},
    capture=>{capture.series.gdp.upserts[0].sourceUrls=['https://vendor.example/input'];},
  ]){
    const vintages=fixture();mutate(vintages.captures[0]);
    assert.throws(()=>assertVintageData(vintages,assertCommercialData),/input|provenance|capture/i);
  }
});

test('archives reject missing, malformed or inconsistent original retrieval provenance',()=>{
  for(const mutate of [
    capture=>{capture.provenance=[];},
    capture=>{capture.provenance[0].sha256='invalid';},
    capture=>{delete capture.provenance[0].retrievedAt;},
    capture=>{capture.provenance[0].retrievedAt='2026-10-20T11:59:59.000Z';},
    capture=>{capture.provenance[0].retrievedAt='2026-10-21T12:00:01.000Z';},
    capture=>{capture.recordedAt='2026-10-20T11:59:59.000Z';},
    capture=>{capture.series.gdp.upserts[0].date='2026-11-01';},
    capture=>{capture.provenance[0].text='Unreviewed copied response body';},
  ]){
    const vintages=fixture();mutate(vintages.captures[0]);
    assert.throws(()=>assertVintageData(vintages,assertCommercialData),/vintage|provenance|retrieval|capture|date|record|content/i);
  }
});

test('archives enforce baseline order, timestamp identity and valid coverage tombstones',()=>{
  for(const mutate of [
    vintages=>{vintages.captures[0].baseline=false;},
    vintages=>{vintages.captures[1].baseline=true;},
    vintages=>{vintages.captures.reverse();},
    vintages=>{const duplicate=structuredClone(vintages.captures[0]);duplicate.capturedAt='2026-10-20T12:00:00Z';vintages.captures.push(duplicate);},
    vintages=>{vintages.captures[1].removedSeries=['neverCaptured'];},
    vintages=>{vintages.captures[1].series.gdp.deletedDates=['2026-01-01'];},
    vintages=>{vintages.captures[1].series.gdp.deletedDates=['2026-07-01'];},
    vintages=>{vintages.captures[0].body='Unreviewed content';},
  ]){
    const vintages=fixture();mutate(vintages);
    assert.throws(()=>assertVintageData(vintages,assertCommercialData),/vintage|baseline|order|duplicate|tombstone|capture|content/i);
  }
  assert.throws(()=>assertVintageData({version:2,captures:[]},assertCommercialData),/version|format|vintage/i);
  assert.throws(()=>assertVintageData(fixture()),/admission|callback|policy/i);
});

test('unchanged retrieval confirmations and genuine coverage removals remain admissible',()=>{
  const initial=source(t1,2.2),confirmed=source(t2,2.2);
  const vintages=recordVintages(null,{bea:initial},{bea:confirmed},{checkedAt:t2});
  assert.deepEqual(vintages.captures[1].series,{});
  assert.doesNotThrow(()=>assertVintageData(vintages,assertCommercialData));
  const removed={...source('2026-10-22T12:00:00.000Z',0),series:{}};
  const withoutSeries=recordVintages(vintages,{}, {bea:removed},{checkedAt:removed.fetchedAt});
  assert.doesNotThrow(()=>assertVintageData(withoutSeries,assertCommercialData));
  const legacy=structuredClone(vintages);
  for(const capture of legacy.captures){capture.capturedAt=capture.capturedAt.replace('.000Z','Z');capture.recordedAt=capture.recordedAt.replace('.000Z','Z');capture.provenance[0].retrievedAt=capture.provenance[0].retrievedAt.replace('.000Z','Z');}
  assert.doesNotThrow(()=>assertVintageData(legacy,assertCommercialData));
  assert.doesNotThrow(()=>assertVintageData(undefined,assertCommercialData));
});

test('Census archive provenance retains reviewed ZIP member identity, update text and attribution conditions',()=>{
  const censusUrl='https://www.census.gov/econ_getzippedfile/?programCode=MARTS';
  const census={id:'census',fetchedAt:t1,series:{retail:{observations:[{date:'2026-09-01',value:.5,publishedAt:null}],sourceIds:['MARTS:44X72:SM:US:SA'],sourceUrl:censusUrl,dataStatus:'official'}},provenance:[{url:censusUrl,sha256:'b'.repeat(64),retrievedAt:t1,lastModified:null,filename:'MARTS-mf.csv',fileUpdatedAt:'October 16, 2026',usageNote:'Attribute U.S. Census Bureau and the originating program.'}]};
  const vintages=recordVintages(null,{}, {census},{checkedAt:t2}),seen=[];
  assertVintageData(vintages,snapshot=>{assertCommercialData(snapshot);seen.push(snapshot.sources.census.provenance[0]);});
  assert.equal(seen[0].filename,'MARTS-mf.csv');
  assert.equal(seen[0].fileUpdatedAt,'October 16, 2026');
  assert.equal(seen[0].usageNote,'Attribute U.S. Census Bureau and the originating program.');
});

test('archive admission receives the captured structural regime and series reporting basis',()=>{
  const sourceUrl='https://markets.newyorkfed.org/api/rates/secured/sofr/search.json?startDate=2024-07-03&endDate=2026-10-20';
  const capture={id:'marketFunctioning',fetchedAt:t1,structuralBreak:'SBN2024',coverageStart:'2024-07-03',coverageEnd:'2026-10-20',series:{sofr:{sourceUrl,sourceIds:['SOFR:percentRate'],periodType:'effective-day',dateConvention:'business-day',measure:'Published daily volume-weighted median rate',observations:[{date:'2026-10-19',value:4,publishedAt:null}]}},provenance:[{url:sourceUrl,sha256:'c'.repeat(64),retrievedAt:t1}]};
  const vintages=recordVintages(null,{}, {marketFunctioning:capture},{checkedAt:t2});
  let validated=false;
  assertVintageData(vintages,snapshot=>{
    const known=snapshot.sources.marketFunctioning;
    assert.equal(known.structuralBreak,'SBN2024');
    assert.equal(known.coverageStart,'2024-07-03');
    assert.equal(known.coverageEnd,'2026-10-20');
    assert.equal(known.series.sofr.periodType,'effective-day');
    assert.equal(known.series.sofr.dateConvention,'business-day');
    assert.equal(known.series.sofr.measure,'Published daily volume-weighted median rate');
    validated=true;
  });
  assert.equal(validated,true);
});

const housingUrl='https://www.census.gov/econ_getzippedfile/?programCode=RESCONST';
function housingSource(fetchedAt=t2){
  const series=Object.fromEntries([
    ['housingStarts','ASTARTS',1330],['housingPermits','APERMITS',1440],['housingCompletions','ACOMPLETIONS',1570],
  ].map(([id,code,value])=>[id,{
    observations:[{date:'2026-09-01',value,sourceValue:String(value),publishedAt:null,footnotes:[]}],
    sourceIds:[`RESCONST:${code}:TOTAL:US:SA`],sourceUrl:housingUrl,sourceTitle:'New Residential Construction',programName:'New Residential Construction',
    unit:'Thousands of units, SAAR',frequency:'Monthly',adjustment:'Seasonally adjusted annual rate',observationType:'official',dataStatus:'official',
    calculation:'Published Census total United States annual-rate series, seasonally adjusted, in thousands of housing units. No extra annualization or unit conversion.',
    licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',attribution:'Source: U.S. Census Bureau, New Residential Construction.',
  }]));
  return {id:'housing',fetchedAt,series,provenance:[{url:housingUrl,sha256:'d'.repeat(64),retrievedAt:fetchedAt,lastModified:null,filename:'RESCONST-mf.csv',fileUpdatedAt:'October 21, 2026',usageNote:'Attribute the U.S. Census Bureau and originating New Residential Construction program; retain published precision.'}]};
}

test('Census housing captures round-trip native units, named program and original ZIP attribution conditions',()=>{
  const original=fixture(),retained=JSON.stringify(original.captures),housing=housingSource();
  const next=recordVintages(original,{}, {housing},{checkedAt:t2});
  assert.equal(JSON.stringify(next.captures.slice(0,original.captures.length)),retained,'existing capture contents remain byte-identical');
  const replayed=asKnownOn(next,t2).sources.housing;
  for(const id of ['housingStarts','housingPermits','housingCompletions']){
    assert.equal(replayed.series[id].programName,'New Residential Construction');
    assert.equal(replayed.series[id].unit,'Thousands of units, SAAR');
    assert.equal(replayed.series[id].adjustment,'Seasonally adjusted annual rate');
    assert.equal(replayed.series[id].licenseUrl,'https://creativecommons.org/publicdomain/zero/1.0/');
    assert.equal(replayed.series[id].attribution,'Source: U.S. Census Bureau, New Residential Construction.');
    assert.deepEqual(replayed.series[id].observations,housing.series[id].observations);
  }
  assert.deepEqual(replayed.provenance,housing.provenance);
  assert.doesNotThrow(()=>assertCommercialData({sources:{housing:replayed}}));
  assert.doesNotThrow(()=>assertVintageData(next,assertCommercialData));
});

test('housing archive admits only its exact RESCONST member and typed attribution extras',()=>{
  const recorded=()=>recordVintages(null,{}, {housing:housingSource()},{checkedAt:t2});
  for(const mutate of [
    h=>{h.captures[0].provenance[0].filename='MARTS-mf.csv';},
    h=>{h.captures[0].provenance[0].filename='../RESCONST-mf.csv';},
    h=>{h.captures[0].provenance[0].fileUpdatedAt={html:'unreviewed'};},
    h=>{h.captures[0].provenance[0].usageNote='Unknown attribution';},
    h=>{h.captures[0].provenance[0].unreviewedDescription='Copied source prose';},
    h=>{h.captures[0].series.housingStarts.metadata.unreviewedProgram='Other';},
  ]){const history=recorded();mutate(history);assert.throws(()=>assertVintageData(history,assertCommercialData),/vintage|provenance|Census|capture/i);}
});

test('housing provenance additions do not loosen another provider or the existing MARTS member',()=>{
  const history=fixture();
  Object.assign(history.captures[0].provenance[0],{filename:'RESCONST-mf.csv',fileUpdatedAt:'October 21, 2026',usageNote:'Attribute U.S. Census Bureau and originating program.'});
  assert.throws(()=>assertVintageData(history,assertCommercialData),/provenance/i);
  const censusUrl='https://www.census.gov/econ_getzippedfile/?programCode=MARTS';
  const census={id:'census',fetchedAt:t1,series:{retail:{sourceIds:['MARTS:44X72:SM:US:SA'],sourceUrl:censusUrl,observations:[{date:'2026-09-01',value:.5,publishedAt:null}]}},provenance:[{url:censusUrl,sha256:'b'.repeat(64),retrievedAt:t1,filename:'RESCONST-mf.csv'}]};
  assert.throws(()=>assertVintageData(recordVintages(null,{}, {census},{checkedAt:t2}),assertCommercialData),/member|provenance/i);
});

test('recording the real stored sources again preserves every existing immutable capture under the expanded registry',async()=>{
  const history=await loadSnapshotHistory(stored,{directory:fileURLToPath(new URL('../src/',import.meta.url))});
  const original=JSON.stringify(history);
  const checkedAt=[...history.captures.map(c=>c.recordedAt),...Object.values(stored.sources).map(s=>s.fetchedAt)].filter(Boolean).sort().at(-1);
  const replay=recordVintages(history,stored.sources,stored.sources,{checkedAt,seriesMetadata:registry});
  assert.equal(JSON.stringify(replay),original,'reusing real retrieval keys must neither collide nor reinterpret old source metadata');
  assert.equal(JSON.stringify(history),original,'the supplied archive remains untouched');
});
