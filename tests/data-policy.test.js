import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import { snapshot as stored } from '../src/official-snapshot.js';
import { assertCommercialData } from '../scripts/data-policy.mjs';
import {loadSnapshotHistory} from '../scripts/snapshot-storage.mjs';
import {currentBlsSource} from './helpers/bls-current-source.js';
const snapshot={...stored,vintages:await loadSnapshotHistory(stored,{directory:fileURLToPath(new URL('../src/',import.meta.url))})};

test('all published datasets and provenance have a recorded commercial reuse review', () => {
  assert.doesNotThrow(() => assertCommercialData(snapshot));
});

const blsV1='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const blsV2='https://api.bls.gov/publicAPI/v2/timeseries/data/';
function blsCapture(endpoint){
  return currentBlsSource(stored.sources.bls,{endpoint});
}

test('all 31 BLS outputs admit the exact registered endpoint with their actual matching receipt',()=>{
  const source=blsCapture(blsV2);
  assert.equal(Object.keys(source.series).length,31);
  assert.equal(source.historyProfile,undefined);assert.equal(source.provenance.length,1);
  for(const series of Object.values(source.series))for(const row of series.observations){assert.equal(Object.hasOwn(row,'sourceUrl'),false);assert.equal(Object.hasOwn(row,'sourceSha256'),false);assert.equal(Object.hasOwn(row,'retrievedAt'),false);}
  assert.doesNotThrow(()=>assertCommercialData({sources:{bls:source}}));
  assert.doesNotThrow(()=>assertCommercialData({sources:{bls:blsCapture(blsV1)}}));
  for(const id of Object.keys(source.series)){
    const missing=blsCapture(blsV1);missing.series[id].sourceUrl=blsV2;
    assert.throws(()=>assertCommercialData({sources:{bls:missing}}),/provenance/i,id);
    missing.provenance.push({...missing.provenance[0],url:blsV2});
    assert.doesNotThrow(()=>assertCommercialData({sources:{bls:missing}}),id);
  }
  for(const change of [source=>{source.provenance=[];},source=>{source.provenance[0].sha256='invalid';}]){
    const invalid=blsCapture(blsV2);change(invalid);
    assert.throws(()=>assertCommercialData({sources:{bls:invalid}}),/provenance/i);
  }
});

test('BLS admission rejects query, hash, credential, port and path endpoint lookalikes in series and receipts',()=>{
  for(const endpoint of [blsV1,blsV2])for(const url of [endpoint+'?registrationkey=secret',endpoint+'?',endpoint+'#',endpoint+'#data',endpoint.replace('https://','https://user:secret@'),endpoint.replace('api.bls.gov','api.bls.gov:443'),endpoint.replace('api.bls.gov','api.bls.gov:444'),endpoint.replace('/data/','/data/extra'),endpoint.replace('/publicAPI/','/publicAPI/../publicAPI/')]){
    const series=blsCapture(blsV1);series.series.unrate.sourceUrl=url;
    assert.throws(()=>assertCommercialData({sources:{bls:series}}),/feed|provenance/i,url);
    const provenance=blsCapture(blsV1);provenance.provenance.push({...provenance.provenance[0],url});
    assert.throws(()=>assertCommercialData({sources:{bls:provenance}}),/provenance/i,url);
  }
});
test('a stored archive index cannot bypass admission of historical states',()=>{
 assert.throws(()=>assertCommercialData({sources:{},vintageArchive:{version:1,captures:[]}}),/hydrat/i);
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

const treasuryCalendarFeed='https://api.fiscaldata.treasury.gov/services/calendar/release';
const treasuryMetadataFeed='https://api.fiscaldata.treasury.gov/services/dtg/metadata/';
function treasuryCalendarSnapshot(change={},sourceChange={}) {
  const event={id:'treasury-debt-to-the-penny-2026-11-02',sourceId:'treasury',program:'debt-to-the-penny',name:'Debt to the Penny',agency:'Treasury Fiscal Data',seriesId:'debt',seriesIds:['debt'],topic:'Fiscal',date:'2026-11-02',time:'16:15',scheduledAt:'2026-11-02T21:15:00.000Z',period:null,periodLabel:null,sourceUrl:treasuryCalendarFeed,sourceUid:null,scheduleBasis:'calendar-estimate',sourceDatasetId:'015-BFS-2014Q3-065',sourceDate:'2026-11-02',sourceTime:'21:15',sourceTimeZone:'UTC',...change};
  return {calendar:{sources:{treasury:{events:[event],datasetIdentity:{datasetId:'015-BFS-2014Q3-065',title:'Debt to the Penny',path:'debt-to-the-penny'},provenance:[treasuryCalendarFeed,treasuryMetadataFeed].map(url=>({url,sha256:'a'.repeat(64)})),...sourceChange}}},releases:[event]};
}

test('Treasury calendar reuse covers only factual Debt to the Penny estimates with verified UTC source metadata',()=>{
  assert.doesNotThrow(()=>assertCommercialData(treasuryCalendarSnapshot()));
  for(const change of [
    {sourceUrl:treasuryMetadataFeed}, {sourceUrl:treasuryCalendarFeed+'?dataset=debt'},
    {program:'daily-treasury-statement'}, {seriesId:'yield',seriesIds:['yield']},
    {sourceDatasetId:'unreviewed-dataset'}, {name:'Monthly Treasury Statement'},
    {scheduleBasis:'listed-date'}, {sourceTimeZone:'EST'}, {sourceTime:'25:15'},
    {sourceDate:'2026-02-30'}, {time:'15:15'}, {scheduledAt:'2026-11-02T20:15:00.000Z'},
    {date:'2026-11-03'}, {periodLabel:'November 2026'}, {period:'2026-11-01'},
    {description:'Unreviewed copied narrative'}, {html:'<b>Copied source</b>'},
  ]) assert.throws(()=>assertCommercialData(treasuryCalendarSnapshot(change)),/calendar/i,JSON.stringify(change));
  assert.throws(()=>assertCommercialData(treasuryCalendarSnapshot({}, {datasetIdentity:{datasetId:'wrong',title:'Debt to the Penny',path:'debt-to-the-penny'}})),/calendar/i);
  assert.throws(()=>assertCommercialData(treasuryCalendarSnapshot({}, {provenance:[{url:treasuryCalendarFeed,sha256:'a'.repeat(64)}]})),/calendar/i);
});

const yieldTimingUrl='https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology';
const yieldTiming=()=>({program:'daily-par-yields',seriesIds:['yield'],topic:'Rates',scheduleBasis:'usual-availability',frequency:'each-trading-day',availableBy:'18:00',timeZone:'America/New_York',delaysPossible:true,sourceUrl:yieldTimingUrl});
const yieldTimingSnapshot=(timing=yieldTiming(),extra={})=>({calendar:{sources:{'treasury-yield-timing':{events:[],timing,provenance:[{url:yieldTimingUrl,sha256:'b'.repeat(64)}],...extra}}},releases:[]});

test('Treasury yield timing reuse is scoped to factual ongoing availability with delay caveats and no dated events',()=>{
  assert.doesNotThrow(()=>assertCommercialData(yieldTimingSnapshot()));
  for(const change of [{availableBy:'15:30'},{frequency:'weekdays'},{scheduleBasis:'scheduled-release'},{timeZone:'EST'},{delaysPossible:false},{seriesIds:['debt']},{program:'third-party-yields'},{topic:'Fiscal'},{sourceUrl:yieldTimingUrl+'?mirror=1'},{date:'2026-11-02'},{scheduledAt:'2026-11-02T23:00:00Z'},{publishedAt:'2026-11-02T23:00:00Z'},{description:'Unreviewed copied narrative'}]) {
    assert.throws(()=>assertCommercialData(yieldTimingSnapshot({...yieldTiming(),...change})),/timing|calendar/i,JSON.stringify(change));
  }
  assert.throws(()=>assertCommercialData(yieldTimingSnapshot(undefined,{provenance:[]})),/timing|calendar/i);
  assert.throws(()=>assertCommercialData(yieldTimingSnapshot(null,{fetchedAt:'2026-10-21T12:00:00Z'})),/timing|calendar/i);
  assert.throws(()=>assertCommercialData(yieldTimingSnapshot(undefined,{events:[{id:'fake-yield-release',sourceId:'treasury-yield-timing'}]})),/timing|calendar/i);
  const elsewhere={calendar:{sources:{bls:{events:[],timing:yieldTiming(),provenance:[]}}},releases:[]};
  assert.throws(()=>assertCommercialData(elsewhere),/timing|calendar/i);
});

const newCalendarEvent=(sourceId,extra={})=>({id:`${sourceId}-example`,sourceId,program:sourceId==='census'?'retail-sales':'weekly-claims',seriesId:sourceId==='census'?'retail':'claims',seriesIds:[sourceId==='census'?'retail':'claims'],sourceUrl:sourceId==='census'?'https://www.census.gov/economic-indicators/calendar-listview.html':'https://oui.doleta.gov/unemploy/claims_arch.asp',scheduleBasis:sourceId==='census'?'listed-date':'recurring-rule',date:'2026-10-22',time:'08:30',nominalDate:'2026-10-22',period:null,periodLabel:null,...extra});
const dolCalendarSource=events=>({events,provenance:[{url:'https://oui.doleta.gov/unemploy/claims_arch.asp',sha256:'a'.repeat(64)}],scheduleMethod:'recurring-rule-with-exceptions',rawScheduleRule:'Publication Schedule: The UI Weekly Claims News Release is published each week on Thursday morning at 8:30am EST.',coverageStart:'2026-10-21',coverageEnd:'2027-01-18',publishedExceptions:[{date:'2026-11-25',time:'08:30',nominalDate:'2026-11-26'},{date:'2027-11-10',time:'08:30',nominalDate:'2027-11-11'}]});
function calendarSnapshot(id,source) { return {calendar:{sources:{[id]:source}},releases:source.events}; }

test('Census calendar approval covers factual retail metadata on exact annual schedule feeds',()=>{
  const event=newCalendarEvent('census');
  const source={events:[event],provenance:[{url:event.sourceUrl,sha256:'a'.repeat(64)}]};
  assert.doesNotThrow(()=>assertCommercialData(calendarSnapshot('census',source)));
  const archived=structuredClone(source);
  archived.events[0].sourceUrl='https://www.census.gov/economic-indicators/calendar-listview-2026.html';
  archived.provenance[0].url=archived.events[0].sourceUrl;
  assert.doesNotThrow(()=>assertCommercialData(calendarSnapshot('census',archived)));
  for(const change of [{program:'durable-goods'},{seriesIds:['retail','gdp']},{sourceUrl:'https://www.census.gov/retail/release_schedule.html'},{scheduleBasis:'recurring-rule'},{description:'Unreviewed copied narrative'}]) {
    const changed=structuredClone(source);Object.assign(changed.events[0],change);
    assert.throws(()=>assertCommercialData(calendarSnapshot('census',changed)),/calendar/i);
  }
});

test('DOL recurring calendar approval requires the reviewed rule and exact published exceptions',()=>{
  const recurring=newCalendarEvent('dol');
  const exception=newCalendarEvent('dol',{id:'dol-exception',date:'2026-11-25',nominalDate:'2026-11-26',scheduleBasis:'published-exception'});
  assert.doesNotThrow(()=>assertCommercialData(calendarSnapshot('dol',dolCalendarSource([recurring,exception]))));
  for(const change of [
    {date:'2026-11-26',nominalDate:'2026-11-26',scheduleBasis:'recurring-rule'},
    {date:'2026-11-24',nominalDate:'2026-11-26',scheduleBasis:'published-exception'},
    {scheduleBasis:'listed-date'},
    {time:'09:30'},
    {nominalDate:'2026-10-23'},
    {periodLabel:'Week ending 17 Oct 2026'},
    {sourceUrl:'https://oui.doleta.gov/unemploy/archive.asp'},
  ]) {
    const changed=dolCalendarSource([{...recurring,...change}]);
    assert.throws(()=>assertCommercialData(calendarSnapshot('dol',changed)),/calendar/i);
  }
  for(const change of [{scheduleMethod:'guessed-holidays'},{rawScheduleRule:''},{coverageEnd:'2027-12-31'}]) {
    const changed={...dolCalendarSource([recurring]),...change};
    assert.throws(()=>assertCommercialData(calendarSnapshot('dol',changed)),/calendar/i);
  }
});
