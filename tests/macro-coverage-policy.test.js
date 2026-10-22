import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot as stored} from '../src/official-snapshot.js';
import {NY_FED_TERMS_URL,NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE} from '../src/market-functioning.js';

let policy;
try {policy=await import('../scripts/macro-coverage-policy.mjs');}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('macro-coverage-policy.mjs'))throw error;}
const api=()=>{assert.ok(policy,'Macro coverage admission policy must exist');return policy;};
const bls='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const monthly='https://apps.bea.gov/national/Release/TXT/NipaDataM.txt';
const quarterly='https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
const dol='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const target='https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=2017-01-01&endDate=2026-10-22';
const iorb='https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip';
const ip='https://www.federalreserve.gov/releases/g17/Current/ipdisk/ip_sa.txt';
const utilization='https://www.federalreserve.gov/releases/g17/Current/ipdisk/utl_sa.txt';
const housing='https://www.census.gov/econ_getzippedfile/?programCode=RESCONST';
const boardTerms='https://www.federalreserve.gov/disclaimer.htm';
const copyright=[NY_FED_DATA_NOTICE,NY_FED_PRODUCT_NOTICE,NY_FED_REFERENCE_RATE_NOTICE].join(' ');
const newBls={cpiIndex:'CUUR0000SA0',cpiCoreIndex:'CUUR0000SA0L1E',cpiSaIndex:'CUSR0000SA0',cpiCoreSaIndex:'CUSR0000SA0L1E',cpiCore:'CUUR0000SA0L1E',cpiMonthly:'CUSR0000SA0',cpiCoreMonthly:'CUSR0000SA0L1E',payrollLevel:'CES0000000001',underemployment:'LNS13327709',employmentPopulation:'LNS12300000',weeklyHours:'CES0500000002'};
const newBea={pceIndex:'DPCERG',pceCoreIndex:'DPCCRG',pceCore:'DPCCRG',pceMonthly:'DPCERGM',pceCoreMonthly:'DPCCRGM',realSpending:'DPCERX',realSpendingMonthly:'DPCERAM',realDisposableIncome:'A067RX',realDisposableIncomeMonthly:'A067RM'};
const point={date:'2026-09-01',value:1,publishedAt:null,sourceValue:'1'};
const measure=(code,url,extra={})=>({sourceIds:[code],sourceUrl:url,observations:[{...point}],...extra});
const source=(series,urls,extra={})=>({fetchedAt:'2026-10-22T16:00:00.000Z',series,provenance:urls.map(url=>({url})),...extra});
function fixture(){
  const targetMetadata={sourceTitle:'Effective Federal Funds Rate',sourceNotice:copyright,licenseUrl:NY_FED_TERMS_URL,attribution:'Source: Federal Reserve Bank of New York, Effective Federal Funds Rate.',unit:'Percent',frequency:'Daily',adjustment:'Not seasonally adjusted',observationType:'official'};
  const board={licenseUrl:boardTerms,observationType:'official'};
  const g17={...board,frequency:'Monthly',adjustment:'Seasonally adjusted',attribution:'Source: Board of Governors of the Federal Reserve System, G.17 Industrial Production and Capacity Utilization.'};
  const residential={sourceTitle:'New Residential Construction',programName:'New Residential Construction',unit:'Thousands of units, SAAR',frequency:'Monthly',adjustment:'Seasonally adjusted annual rate',licenseUrl:'https://creativecommons.org/publicdomain/zero/1.0/',attribution:'Source: U.S. Census Bureau, New Residential Construction.',observationType:'official'};
  return {sources:{
    bls:source(Object.fromEntries(Object.entries(newBls).map(([id,code])=>[id,measure(code,bls)])),[bls]),
    bea:source({...Object.fromEntries(Object.entries(newBea).map(([id,code])=>[id,measure(code,monthly)])),gdp:measure('A191RL',quarterly)},[quarterly,monthly]),
    dol:source({continuedClaims:measure('ContinuedClaims/SA',dol),claims:measure('InitialClaims/SA',dol)},[dol]),
    policyRates:source({policyTargetLower:measure('EFFR:targetRateFrom',target,targetMetadata),policyTargetUpper:measure('EFFR:targetRateTo',target,targetMetadata),iorb:measure('RESBM_N.D',iorb,{...board,sourceTitle:'Interest on Reserve Balances',unit:'Percent',frequency:'Daily',adjustment:'Not seasonally adjusted',attribution:'Source: Board of Governors of the Federal Reserve System, Interest on Reserve Balances.'})},[target,iorb]),
    activity:source({industrialProduction:measure('IP.B50001.SA',ip,{...g17,sourceTitle:'G.17 Total Industrial Production',unit:'Index 2017=100'}),capacityUtilization:measure('CAPUTL.B50001.SA',utilization,{...g17,sourceTitle:'G.17 Total Industry Capacity Utilization',unit:'Percent'})},[ip,utilization]),
    housing:source({housingStarts:measure('RESCONST:ASTARTS:TOTAL:US:SA',housing,residential),housingPermits:measure('RESCONST:APERMITS:TOTAL:US:SA',housing,residential),housingCompletions:measure('RESCONST:ACOMPLETIONS:TOTAL:US:SA',housing,residential)},[housing],{provenance:[{url:housing,filename:'RESCONST-mf.csv',usageNote:'Cite the U.S. Census Bureau and the originating program.'}]}),
  }};
}

test('macro policy entries admit exactly the reviewed new identifiers with separate provider policies',()=>{
  const entries=api().macroCoveragePolicies;
  const admitted=agency=>Object.assign({},...entries.filter(p=>p.agency===agency).map(p=>p.series));
  assert.deepEqual(admitted('bls'),Object.fromEntries(Object.entries(newBls).map(([id,code])=>[id,[code]])));
  assert.deepEqual(admitted('bea'),Object.fromEntries(Object.entries(newBea).map(([id,code])=>[id,[code]])));
  assert.deepEqual(admitted('dol'),{continuedClaims:['ContinuedClaims/SA']});
  assert.deepEqual(admitted('policyRates'),{policyTargetLower:['EFFR:targetRateFrom'],policyTargetUpper:['EFFR:targetRateTo'],iorb:['RESBM_N.D']});
  assert.deepEqual(admitted('activity'),{industrialProduction:['IP.B50001.SA'],capacityUtilization:['CAPUTL.B50001.SA']});
  assert.deepEqual(admitted('housing'),{housingStarts:['RESCONST:ASTARTS:TOTAL:US:SA'],housingPermits:['RESCONST:APERMITS:TOTAL:US:SA'],housingCompletions:['RESCONST:ACOMPLETIONS:TOTAL:US:SA']});
  assert.equal(entries.filter(p=>p.agency==='policyRates').length,2);
  assert.ok(entries.every(p=>p.commercialUse===true&&p.terms.length&&p.terms.every(url=>url.startsWith('https://'))));
});

test('new feed matching admits exact reviewed paths, valid dates and dataset-qualified query types only',()=>{
  const match=api().matchesMacroCoverageFeed;
  for(const [url,feed]of [[target,'nyfed-policy-targets'],[iorb,'board-iorb'],[ip,'board-g17'],[utilization,'board-g17'],[ip,'board-ip'],[utilization,'board-capacity'],[housing,'census-resconst'],[monthly,'bea-macro-monthly']])assert.equal(match(url,feed),true,`${feed}: ${url}`);
  for(const [url,feed]of [
    [target.replace('unsecured/effr','secured/sofr'),'nyfed-policy-targets'],[target.replace('2017-01-01','2016-12-31'),'nyfed-policy-targets'],[target.replace('2026-10-22','2026-02-30'),'nyfed-policy-targets'],[target.replace('2026-10-22','2016-12-31'),'nyfed-policy-targets'],
    [target+'&type=target','nyfed-policy-targets'],[target+'&endDate=2026-10-22','nyfed-policy-targets'],[target.replace('https://','http://'),'nyfed-policy-targets'],[target+'#notice','nyfed-policy-targets'],[target.replace('https://','https://user:pass@'),'nyfed-policy-targets'],
    [iorb.replace('FRB_PRATES','FRB_H15'),'board-iorb'],[iorb+'?format=xml','board-iorb'],[ip.replace('ip_sa','ip_nsa'),'board-g17'],[utilization,'board-ip'],[ip,'board-capacity'],
    [housing.replace('RESCONST','MARTS'),'census-resconst'],[housing+'&programCode=RESCONST','census-resconst'],[housing+'&category=TOTAL','census-resconst'],[housing.replace('www.census.gov','vendor.example'),'census-resconst'],[quarterly,'bea-macro-monthly'],
  ])assert.equal(match(url,feed),false,`${feed}: ${url}`);
});

test('macro admission accepts exact family captures and leaves older captured source scopes valid',()=>{
  assert.doesNotThrow(()=>api().assertMacroCoverageData(fixture()));
  assert.doesNotThrow(()=>api().assertMacroCoverageData(stored));
  assert.doesNotThrow(()=>api().assertMacroCoverageData({sources:{policyRates:{series:{},provenance:[]},activity:{series:{},provenance:[]},housing:{series:{},provenance:[]}}}));
});

test('wrong identifiers, unreviewed source files and per-observation substitutions reject the candidate capture',()=>{
  for(const mutate of [
    s=>{s.sources.bls.series.cpiCore.sourceIds=['CUSR0000SA0L1E'];},
    s=>{s.sources.bea.series.pceCoreMonthly.sourceIds=['DPCCRG'];},
    s=>{s.sources.bea.series.realSpending.sourceUrl=quarterly;},
    s=>{s.sources.dol.series.continuedClaims.sourceIds=['InitialClaims/SA'];},
    s=>{s.sources.activity.series.industrialProduction.sourceUrl=utilization;},
    s=>{s.sources.activity.series.capacityUtilization.sourceUrl=ip;},
    s=>{s.sources.policyRates.series.policyTargetLower.sourceIds=['EFFR:targetRateTo'];},
    s=>{s.sources.policyRates.series.iorb.sourceUrl=target;},
    s=>{s.sources.housing.series.housingStarts.sourceIds=['RESCONST:STARTS:TOTAL:US:SA'];},
    s=>{s.sources.housing.series.housingStarts.sourceUrl=housing.replace('RESCONST','MARTS');},
    s=>{s.sources.housing.series.housingStarts.observations[0].sourceUrl=housing.replace('RESCONST','MARTS');},
    s=>{s.sources.policyRates.series.policyTargetLower.observations[0].sourceUrls=[iorb];},
  ]){const data=fixture();mutate(data);assert.throws(()=>api().assertMacroCoverageData(data),/identifier|feed|source|override/i);}
});

test('provider provenance permits the exact reviewed union while rejecting missing inputs or unrelated files',()=>{
  for(const mutate of [
    s=>{s.sources.policyRates.provenance.pop();},s=>{s.sources.policyRates.provenance.push({url:'https://www.federalreserve.gov/releases/h15/data.xml'});},
    s=>{s.sources.activity.provenance[1].url=ip;},s=>{s.sources.bea.provenance.push({url:'https://apps.bea.gov/national/Release/TXT/CountyData.txt'});},
    s=>{s.sources.housing.provenance[0].url=housing.replace('RESCONST','MARTS');},
    s=>{s.sources.policyRates.series.unreviewed=measure('IORR',iorb);},
  ]){const data=fixture();mutate(data);assert.throws(()=>api().assertMacroCoverageData(data),/provenance|source|scope|series/i);}
});

test('both New York Fed bounds retain the exact title, attribution, terms and all redistribution notices',()=>{
  for(const id of ['policyTargetLower','policyTargetUpper'])for(const change of [
    {sourceTitle:'Federal funds policy target'}, {licenseUrl:boardTerms}, {attribution:'Source: Federal Reserve.'},
    {sourceNotice:NY_FED_DATA_NOTICE}, {sourceNotice:NY_FED_PRODUCT_NOTICE+' '+NY_FED_REFERENCE_RATE_NOTICE},
    {sourceNotice:NY_FED_DATA_NOTICE+' '+NY_FED_PRODUCT_NOTICE},
  ]){const data=fixture();Object.assign(data.sources.policyRates.series[id],change);assert.throws(()=>api().assertMacroCoverageData(data),/New York Fed|notice|title|attribution|terms/i);}
  const historical=fixture();historical.sources.policyRates.fetchedAt='2027-01-02T12:00:00.000Z';
  for(const id of ['policyTargetLower','policyTargetUpper'])historical.sources.policyRates.series[id].sourceNotice=copyright.replace('2026','2027');
  assert.doesNotThrow(()=>api().assertMacroCoverageData(historical),'copyright year follows capture rather than the current runtime year');
});

test('Board data cannot inherit New York Fed notices and every new dataset preserves its reviewed measurement scope',()=>{
  for(const mutate of [
    s=>{s.sources.policyRates.series.iorb.licenseUrl=NY_FED_TERMS_URL;},s=>{s.sources.policyRates.series.iorb.sourceNotice=copyright;},
    s=>{s.sources.policyRates.series.iorb.sourceIds=['IOER'];},s=>{s.sources.activity.series.capacityUtilization.licenseUrl=NY_FED_TERMS_URL;},
    s=>{s.sources.activity.series.industrialProduction.unit='Percent';},s=>{s.sources.activity.series.capacityUtilization.unit='Index 2017=100';},
    s=>{s.sources.housing.series.housingStarts.programName='Advance Monthly Retail Trade Survey';},s=>{s.sources.housing.series.housingCompletions.attribution='Source: Census Bureau.';},
    s=>{s.sources.housing.series.housingPermits.unit='Housing units';},s=>{s.sources.housing.provenance[0].filename='MARTS-mf.csv';},s=>{s.sources.housing.provenance[0].usageNote='Unknown.';},
  ]){const data=fixture();mutate(data);assert.throws(()=>api().assertMacroCoverageData(data),/identifier|terms|notice|attribution|scope|program|unit|provenance/i);}
});
