import test from 'node:test';
import assert from 'node:assert/strict';
import {creditContextRegistry} from '../src/credit-context-registry.js';
import {parseFomcCalendar} from '../scripts/sources/calendar-fomc.mjs';
import {comparisonClassification,indexEligibilityError} from '../src/comparison-policy.js';
let policy;
try{policy=await import('../scripts/credit-context-policy.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('credit-context-policy.mjs'))throw error;}
const rules=()=>{assert.ok(policy,'Dataset-specific credit context policy must exist');return policy;};
const h8='https://www.federalreserve.gov/releases/h8/data/FRB_h8_xml.zip';
function fixture(){return {sources:{bankCredit:{id:'bankCredit',fetchedAt:'2026-10-22T23:00:00.000Z',provenance:[{url:h8,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T23:00:00.000Z',filename:'H8_data.xml'}],series:Object.fromEntries([['bankLoans','14182513.2',14182.5132],['bankDeposits','19771474.9',19771.4749]].map(([id,sourceValue,value])=>[id,{sourceIds:[id==='bankLoans'?'B1020NCBA':'B1058NCBA'],sourceUrl:h8,sourceTitle:'H.8 Assets and Liabilities of Commercial Banks in the United States',unit:'USD billions',frequency:'Weekly',adjustment:'Seasonally adjusted',observationType:'official',licenseUrl:'https://www.federalreserve.gov/disclaimer.htm',attribution:'Source: Board of Governors of the Federal Reserve System, H.8 Assets and Liabilities of Commercial Banks in the United States.',observations:[{date:'2026-10-07',value,sourceValue,publishedAt:null}]}]))}}};}

test('policy admits exact credited Board H8 data and rejects changed units, scope, dates, publication clocks and override feeds',()=>{
  const api=rules();assert.doesNotThrow(()=>api.assertCreditContextData(fixture()));
  for(const mutate of [p=>p.sources.bankCredit.series.bankLoans.unit='USD millions',p=>p.sources.bankCredit.series.bankLoans.sourceIds=['B1020NDMA'],p=>p.sources.bankCredit.series.bankLoans.observations[0].publishedAt='2026-10-16T20:15:00Z',p=>p.sources.bankCredit.series.bankLoans.observations[0].date='2026-10-08',p=>p.sources.bankCredit.series.bankLoans.observations[0].value=1,p=>p.sources.bankCredit.series.bankLoans.observations[0].sourceUrl='https://example.com/',p=>p.sources.bankCredit.provenance[0].sha256='missing',p=>delete p.sources.bankCredit.series.bankDeposits]){
    const p=fixture();mutate(p);assert.throws(()=>api.assertCreditContextData(p),/credit|Board|scope|metadata|source|clock|date|provenance|amount|series/i);
  }
  assert.equal(creditContextRegistry.bankLoans.periodType,'stock');assert.equal(creditContextRegistry.onRrpAccepted.periodType,'operation');
});

test('H8 admission accepts the 1990 retention boundary and preserves legacy captures without admitting earlier history',()=>{
  const api=rules(),legacy=fixture(),before=JSON.stringify(legacy);
  assert.doesNotThrow(()=>api.assertCreditContextData(legacy));assert.equal(JSON.stringify(legacy),before);
  const expanded=fixture();
  expanded.sources.bankCredit.series.bankLoans.observations.unshift({date:'1990-01-03',value:1964.4146,sourceValue:'1964414.6',publishedAt:null});
  expanded.sources.bankCredit.series.bankDeposits.observations.unshift({date:'1990-01-03',value:2252.8719,sourceValue:'2252871.9',publishedAt:null});
  assert.doesNotThrow(()=>api.assertCreditContextData(expanded));
  const early=structuredClone(expanded);early.sources.bankCredit.series.bankLoans.observations[0].date='1989-12-27';
  assert.throws(()=>api.assertCreditContextData(early),/date|credit/i);
});

test('SLOOS admission accepts independently dated 1990 standards and 1991 demand without changing legacy labels',()=>{
  const url='https://www.federalreserve.gov/releases/sloos/data/FRB_SLOOS_xml.zip',title='Senior Loan Officer Opinion Survey on Bank Lending Practices';
  const first={ciStandardsLarge:['1990-04-01','1990-06-30','54.4'],ciStandardsSmall:['1990-04-01','1990-06-30','52.7'],ciDemandLarge:['1991-10-01','1991-12-31','-33.3'],ciDemandSmall:['1991-10-01','1991-12-31','-25.4']};
  const series=Object.fromEntries(Object.entries(first).map(([id,[date,sourcePeriodLabel,sourceValue]])=>{const definition=creditContextRegistry[id];return [id,{sourceIds:[definition.code],sourceUrl:url,sourceTitle:title,unit:definition.unit,frequency:definition.frequency,adjustment:definition.adjustment,observationType:'official',licenseUrl:'https://www.federalreserve.gov/disclaimer.htm',attribution:`Source: Board of Governors of the Federal Reserve System, ${title}.`,dateConvention:'source-quarter-start-label',observations:[{date,value:Number(sourceValue),sourceValue,publishedAt:null,sourcePeriodLabel}]}];}));
  const source={id:'lendingSurvey',fetchedAt:'2026-10-27T03:36:53.830Z',provenance:[{url,sha256:'d0777da3d40816e2db6abdb6b362a2d0e513401933d7577ca4164220d68693cc',retrievedAt:'2026-10-27T03:36:53.830Z',filename:'SLOOS_data.xml'}],series};
  assert.doesNotThrow(()=>rules().assertCreditContextData({sources:{lendingSurvey:source}}));
  const early=structuredClone(source);Object.assign(early.series.ciStandardsLarge.observations[0],{date:'1989-10-01',sourcePeriodLabel:'1989-12-31'});
  assert.throws(()=>rules().assertCreditContextData({sources:{lendingSurvey:early}}),/date|credit/i);
});

test('feed policy rejects unreviewed query variants, hosts, suffixes and fragments',()=>{
  const api=rules();assert.equal(api.matchesCreditContextFeed(h8,'board-h8-credit'),true);
  assert.equal(api.matchesCreditContextFeed(h8+'?x=1','board-h8-credit'),false);
  assert.equal(api.matchesCreditContextFeed(h8+'#x','board-h8-credit'),false);
  const url='https://markets.newyorkfed.org/api/rp/results/search.json?startDate=2024-01-01&endDate=2026-10-22&operationTypes=Reverse%20Repo&method=fixed&securityType=tsy&term=overnight';
  assert.equal(api.matchesCreditContextFeed(url,'nyfed-onrrp'),true);
  assert.equal(api.matchesCreditContextFeed(url.replace('method=fixed','method=allotment'),'nyfed-onrrp'),false);
  assert.equal(api.matchesCreditContextFeed(url.replace('securityType=tsy','securityType=agency'),'nyfed-onrrp'),false);
  assert.equal(api.matchesCreditContextFeed(url+'&startDate=2020-01-01','nyfed-onrrp'),false);
});

test('net SLOOS response balances cannot be ratio indexed while positive monetary stocks can',()=>{
  for(const id of ['ciDemandLarge','ciDemandSmall','ciStandardsLarge','ciStandardsSmall']){
    assert.equal(comparisonClassification(creditContextRegistry[id]),'balance');
    assert.match(indexEligibilityError({series:creditContextRegistry[id],observations:[{value:5}]}),/cannot be ratio-indexed/);
  }
  assert.equal(indexEligibilityError({series:creditContextRegistry.bankLoans,observations:[{value:100}]}),null);
});

test('SLOOS policy never converts missing raw source amounts into a zero response balance',()=>{
  const api=rules(),url='https://www.federalreserve.gov/releases/sloos/data/FRB_SLOOS_xml.zip';
  const series=Object.fromEntries(Object.entries(creditContextRegistry).filter(([,row])=>row.agency==='lendingSurvey').map(([id,row])=>[id,{sourceIds:[row.code],sourceUrl:url,sourceTitle:'Senior Loan Officer Opinion Survey on Bank Lending Practices',unit:row.unit,frequency:row.frequency,adjustment:row.adjustment,observationType:'official',licenseUrl:'https://www.federalreserve.gov/disclaimer.htm',attribution:'Source: Board of Governors of the Federal Reserve System, Senior Loan Officer Opinion Survey on Bank Lending Practices.',observations:[{date:'2026-09-30',value:0,sourceValue:'0.0',publishedAt:null}]}]));
  const sources={lendingSurvey:{id:'lendingSurvey',fetchedAt:'2026-10-22T23:00:00.000Z',series,provenance:[{url,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T23:00:00.000Z',filename:'SLOOS_data.xml'}]}};
  assert.doesNotThrow(()=>api.assertCreditContextData({sources}));
  for(const sourceValue of [null,'',false]){const invalid=structuredClone(sources);invalid.lendingSurvey.series.ciStandardsLarge.observations[0].sourceValue=sourceValue;assert.throws(()=>api.assertCreditContextData({sources:invalid}),/SLOOS|percentage|source/i);}
});

test('SLOOS admission keeps immutable legacy labels and validates new quarter-start dates against raw future quarter-end labels',()=>{
  const api=rules(),url='https://www.federalreserve.gov/releases/sloos/data/FRB_SLOOS_xml.zip';
  const item=row=>({sourceIds:[row.code],sourceUrl:url,sourceTitle:'Senior Loan Officer Opinion Survey on Bank Lending Practices',unit:row.unit,frequency:row.frequency,adjustment:row.adjustment,observationType:'official',licenseUrl:'https://www.federalreserve.gov/disclaimer.htm',attribution:'Source: Board of Governors of the Federal Reserve System, Senior Loan Officer Opinion Survey on Bank Lending Practices.',observations:[{date:'2026-09-30',value:0,sourceValue:'0.0',publishedAt:null}]});
  const source={id:'lendingSurvey',fetchedAt:'2026-10-22T23:00:00.000Z',series:Object.fromEntries(Object.entries(creditContextRegistry).filter(([,row])=>row.agency==='lendingSurvey').map(([id,row])=>[id,item(row)])),provenance:[{url,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T23:00:00.000Z',filename:'SLOOS_data.xml'}]};
  const original=JSON.stringify(source);assert.doesNotThrow(()=>api.assertCreditContextData({sources:{lendingSurvey:source}}));assert.equal(JSON.stringify(source),original,'Validation never rewrites an immutable legacy capture');
  const legacy=structuredClone(source);for(const series of Object.values(legacy.series))series.dateConvention='source-quarter-end-label';assert.doesNotThrow(()=>api.assertCreditContextData({sources:{lendingSurvey:legacy}}));
  const modern=structuredClone(source);modern.fetchedAt=modern.provenance[0].retrievedAt='2026-08-04T15:00:00.000Z';
  for(const series of Object.values(modern.series)){series.dateConvention='source-quarter-start-label';series.observations[0].date='2026-07-01';series.observations[0].sourcePeriodLabel='2026-09-30';}
  assert.doesNotThrow(()=>api.assertCreditContextData({sources:{lendingSurvey:modern}}));
  for(const mutate of [row=>row.sourcePeriodLabel='2026-09-29',row=>row.sourcePeriodLabel='2026-06-30',row=>row.sourcePeriodLabel='2026-06-31',row=>delete row.sourcePeriodLabel,row=>row.date='2026-07-02']){
    const bad=structuredClone(modern);mutate(bad.series.ciStandardsLarge.observations[0]);assert.throws(()=>api.assertCreditContextData({sources:{lendingSurvey:bad}}),/SLOOS|date|label/i);
  }
});

test('FOMC policy accepts exact date-only references and rejects fabricated clocks, source paths and inferred minutes dates',()=>{
  const api=rules(),html='<h4>2026 FOMC Meetings</h4><div class="row fomc-meeting"><div class="fomc-meeting__month">September</div><div class="fomc-meeting__date">15-16*</div><a href="/newsevents/pressreleases/monetary20260916a.htm">HTML</a><a href="/monetarypolicy/fomcminutes20260916.htm">HTML</a>(Released October 07, 2026)</div>';
  const parsed=parseFomcCalendar(html,{years:[2026]});
  const fixture=()=>({id:'fomc',...structuredClone(parsed),fetchedAt:'2026-10-22T23:00:00.000Z',provenance:[{url:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',sha256:'a'.repeat(64)}]});
  assert.doesNotThrow(()=>api.assertFomcCalendarData(fixture()));
  for(const mutate of [p=>p.events[0].time='14:00',p=>p.events[0].scheduledAt='2026-09-16T18:00:00Z',p=>p.documents[0].url='https://example.com/decision.htm',p=>p.documents[0].documentDate='2026-09-17',p=>p.events[0].meetingDate='2026-09-17',p=>p.events[1].date='2026-10-08']){
    const p=fixture();mutate(p);assert.throws(()=>api.assertFomcCalendarData(p),/FOMC|credit context/i);
  }
});
