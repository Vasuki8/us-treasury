import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshot } from '../src/official-snapshot.js';
import { assertCommercialData } from '../scripts/data-policy.mjs';

test('all published datasets and provenance have a recorded commercial reuse review', () => {
  assert.doesNotThrow(() => assertCommercialData(snapshot));
});

test('a new agency or series is rejected until its reuse rights are reviewed', () => {
  const unknownAgency = structuredClone(snapshot);
  unknownAgency.sources.vendor = structuredClone(snapshot.sources.bls);
  assert.throws(() => assertCommercialData(unknownAgency), /commercial reuse.*vendor/i);
  const unknownSeries = structuredClone(snapshot);
  unknownSeries.sources.bls.series.vendorIndex = structuredClone(snapshot.sources.bls.series.cpi);
  assert.throws(() => assertCommercialData(unknownSeries), /commercial reuse.*vendorIndex/i);
});

test('a familiar label cannot substitute an unreviewed source identifier or feed', () => {
  const changedId = structuredClone(snapshot);
  changedId.sources.bea.series.gdp.sourceIds = ['VENDOR_GDP'];
  assert.throws(() => assertCommercialData(changedId), /source identifier.*gdp/i);
  const changedFeed = structuredClone(snapshot);
  changedFeed.sources.bls.series.cpi.sourceUrl = 'https://vendor.example/cpi';
  assert.throws(() => assertCommercialData(changedFeed), /feed.*cpi/i);
  const differentTreasuryDataset = structuredClone(snapshot);
  differentTreasuryDataset.sources.treasury.series.yield.sourceUrl = snapshot.sources.treasury.series.yield.sourceUrl.replace('daily_treasury_yield_curve', 'third_party_index');
  assert.throws(() => assertCommercialData(differentTreasuryDataset), /feed.*yield/i);
});

test('unreviewed supporting provenance cannot enter the published snapshot', () => {
  const changed = structuredClone(snapshot);
  changed.sources.bea.provenance.push({url:'https://vendor.example/inputs.csv'});
  assert.throws(() => assertCommercialData(changed), /provenance.*bea/i);
});

test('a first refresh failure with no observations is allowed without approving a dataset', () => {
  assert.doesNotThrow(() => assertCommercialData({sources:{bls:{series:{},provenance:[]}}}));
});

test('calendar observations cannot be published before their reuse rights are reviewed', () => {
  const changed = structuredClone(snapshot);
  changed.releases = [{id:'vendor-release',sourceUrl:'https://vendor.example/calendar',seriesId:'unrate'}];
  assert.throws(() => assertCommercialData(changed), /commercial reuse.*calendar/i);
});

test('reviewed DOL national claims and Census MARTS feeds are allowed without approving other datasets', () => {
  const dolUrl='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
  const censusUrl='https://www.census.gov/econ_getzippedfile/?programCode=MARTS';
  const next={sources:{
    dol:{series:{claims:{sourceIds:['InitialClaims/SA'],sourceUrl:dolUrl}},provenance:[{url:dolUrl}]},
    census:{series:{retail:{sourceIds:['MARTS:44X72:SM:US:SA'],sourceUrl:censusUrl}},provenance:[{url:censusUrl}]},
  }};
  assert.doesNotThrow(()=>assertCommercialData(next));
  next.sources.census.series.retail.sourceUrl=censusUrl.replace('MARTS','MRTS');
  assert.throws(()=>assertCommercialData(next),/feed.*retail/i);
  next.sources.census.series.retail.sourceUrl=censusUrl;
  next.sources.dol.series.claims.sourceIds=['InitialClaims/NSA'];
  assert.throws(()=>assertCommercialData(next),/identifier.*claims/i);
});

test('calendar policy permits only reviewed program mappings with matching agency provenance',()=>{
  const event={id:'bea-example',sourceId:'bea',program:'gdp',seriesId:'gdp',seriesIds:['gdp'],sourceUrl:'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics'};
  const calendar={sources:{bea:{events:[event],provenance:[{url:event.sourceUrl,sha256:'a'.repeat(64)}]}}};
  assert.doesNotThrow(()=>assertCommercialData({calendar,releases:[event]}));
  for(const change of [
    {sourceUrl:'https://vendor.example/calendar'},
    {program:'county-gdp'},
    {seriesIds:['gdp','retail']},
    {sourceId:'census'},
  ]) {
    const changed=structuredClone({calendar,releases:[event]});
    Object.assign(changed.calendar.sources.bea.events[0],change);
    changed.releases=structuredClone(changed.calendar.sources.bea.events);
    assert.throws(()=>assertCommercialData(changed),/calendar/i);
  }
  const changed=structuredClone({calendar,releases:[event]});
  changed.calendar.sources.bea.provenance[0].url='https://vendor.example/input';
  assert.throws(()=>assertCommercialData(changed),/calendar/i);
});

test('an approved agency label cannot introduce calendar records outside its captured source list',()=>{
  const event={id:'bea-example',sourceId:'bea',program:'gdp',seriesId:'gdp',seriesIds:['gdp'],sourceUrl:'https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics'};
  const calendar={sources:{bea:{events:[event],provenance:[{url:event.sourceUrl,sha256:'a'.repeat(64)}]}}};
  assert.throws(()=>assertCommercialData({calendar,releases:[{...event,id:'fabricated'}]}),/calendar/i);
});
