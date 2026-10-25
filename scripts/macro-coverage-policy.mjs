// Exact statistical admissions and conditions, reviewed in the BLS/DOL family
// reviews, docs/data-sources.md, and docs/macro-coverage-source-review.md.
import {NY_FED_TERMS_URL,NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE} from '../src/market-functioning.js';
import {matchesBlsApiFeed} from './bls-api-policy.mjs';

const reviewedOn='2026-10-22';
const boardTerms='https://www.federalreserve.gov/disclaimer.htm';
const beaMonthly='https://apps.bea.gov/national/Release/TXT/NipaDataM.txt';
const beaQuarterly='https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
const dolUrl='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const iorbUrl='https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip';
const productionUrl='https://www.federalreserve.gov/releases/g17/Current/ipdisk/ip_sa.txt';
const utilizationUrl='https://www.federalreserve.gov/releases/g17/Current/ipdisk/utl_sa.txt';
const housingUrl='https://www.census.gov/econ_getzippedfile/?programCode=RESCONST';
const housingProgram='New Residential Construction';
const housingTerms='https://creativecommons.org/publicdomain/zero/1.0/';
const targetStart='2017-01-01';
const ids=values=>Object.fromEntries(Object.entries(values).map(([id,code])=>[id,[code]]));
const blsSeries=ids({cpiIndex:'CUUR0000SA0',cpiCoreIndex:'CUUR0000SA0L1E',cpiSaIndex:'CUSR0000SA0',cpiCoreSaIndex:'CUSR0000SA0L1E',cpiCore:'CUUR0000SA0L1E',cpiMonthly:'CUSR0000SA0',cpiCoreMonthly:'CUSR0000SA0L1E',payrollLevel:'CES0000000001',underemployment:'LNS13327709',employmentPopulation:'LNS12300000',weeklyHours:'CES0500000002'});
const beaSeries=ids({pceIndex:'DPCERG',pceCoreIndex:'DPCCRG',pceCore:'DPCCRG',pceMonthly:'DPCERGM',pceCoreMonthly:'DPCCRGM',realSpending:'DPCERX',realSpendingMonthly:'DPCERAM',realDisposableIncome:'A067RX',realDisposableIncomeMonthly:'A067RM'});

/** Compatible with the shared dataPolicies series/feed admission contract. */
export const macroCoveragePolicies=[{
  id:'bls-inflation-labor-family',agency:'bls',reviewedOn,commercialUse:true,
  basis:'Scoped public-domain CPI-U, CES and CPS statistics with BLS attribution, retrieval date, required disclaimer and calculated-growth labeling',
  terms:['https://www.bls.gov/opub/copyright-information.htm','https://www.bls.gov/developers/termsOfService.htm'],feed:'bls-api',series:blsSeries,
},{
  id:'bea-monthly-macro-family',agency:'bea',reviewedOn,commercialUse:true,
  basis:'BEA public-domain NIPA monthly price, consumption and disposable-income statistics, credited with native annual-rate units and explicit calculation labels',
  terms:['https://www.bea.gov/help/faq/147','https://www.bea.gov/help/guidelines-for-citing-bea'],feed:'bea-nipa',series:beaSeries,
  seriesFeeds:Object.fromEntries(Object.keys(beaSeries).map(id=>[id,'bea-macro-monthly'])),
},{
  id:'dol-national-continued-claims',agency:'dol',reviewedOn,commercialUse:true,
  basis:'Public-domain ETA national continued-claims statistical compilation, credited without endorsement and with its actual independent reference-week coverage',
  terms:['https://www.dol.gov/general/aboutdol/copyright','https://oui.doleta.gov/unemploy/claims.asp'],feed:'dol-national-claims',series:{continuedClaims:['ContinuedClaims/SA']},
},{
  id:'nyfed-published-policy-targets',agency:'policyRates',reviewedOn,commercialUse:true,
  basis:'Conditional New York Fed business redistribution of the two published EFFR target-bound fields; original title, source attribution, copyright, product and reference-rate notices retained',
  terms:[NY_FED_TERMS_URL],feed:'nyfed-policy-targets',
  series:{policyTargetLower:['EFFR:targetRateFrom'],policyTargetUpper:['EFFR:targetRateTo']},
  seriesFeeds:{policyTargetLower:'nyfed-policy-targets',policyTargetUpper:'nyfed-policy-targets'},
},{
  id:'board-interest-on-reserve-balances',agency:'policyRates',reviewedOn,commercialUse:true,
  basis:'Board-authored public-domain PRATES IORB statistical rate only; Board attribution; no transfer of New York Fed copyright conditions or IOER/IORR history',
  terms:[boardTerms],feed:'board-iorb',series:{iorb:['RESBM_N.D']},seriesFeeds:{iorb:'board-iorb'},
},{
  id:'board-g17-total-industry',agency:'activity',reviewedOn,commercialUse:true,
  basis:'Board public-domain G.17 total-industry production and utilization statistics in their separately identified native files and units',
  terms:[boardTerms],feed:'board-g17',series:{industrialProduction:['IP.B50001.SA'],capacityUtilization:['CAPUTL.B50001.SA']},
  seriesFeeds:{industrialProduction:'board-ip',capacityUtilization:'board-capacity'},
},{
  id:'census-new-residential-construction',agency:'housing',reviewedOn,commercialUse:true,
  basis:'RESCONST dataset CC0 statistical values under the bulk-file instructions to credit Census and the originating New Residential Construction program; native published SAAR precision retained',
  terms:['https://catalog.data.gov/dataset/time-series-economic-indicators-time-series-new-residential-construction',housingTerms,'https://www.census.gov/econ_datasets/'],
  feed:'census-resconst',series:{housingStarts:['RESCONST:ASTARTS:TOTAL:US:SA'],housingPermits:['RESCONST:APERMITS:TOTAL:US:SA'],housingCompletions:['RESCONST:ACOMPLETIONS:TOTAL:US:SA']},
}];

const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

/** Only these exact files and the bounded EFFR date query are newly admitted. */
export function matchesMacroCoverageFeed(value,feed){
  try{
    const url=new URL(value);
    if(url.username||url.password||url.href.includes('#'))return false;
    if(feed==='nyfed-policy-targets')return url.origin==='https://markets.newyorkfed.org'&&url.pathname==='/api/rates/unsecured/effr/search.json'&&url.searchParams.size===2&&url.searchParams.get('startDate')===targetStart&&date(url.searchParams.get('endDate'))&&url.searchParams.get('endDate')>=targetStart;
    const files={
      'bea-macro-monthly':[beaMonthly],'board-iorb':[iorbUrl],
      'board-g17':[productionUrl,utilizationUrl],'board-ip':[productionUrl],'board-capacity':[utilizationUrl],
      'census-resconst':[housingUrl],
    };
    return Object.hasOwn(files,feed)&&files[feed].includes(url.href);
  }catch{return false;}
}

// Existing providers keep their old policy feed names. Their provenance can
// include both NIPA files, while each new monthly output has a narrower feed.
function matchesSourceFeed(value,feed){
  if(matchesMacroCoverageFeed(value,feed))return true;
  if(feed==='bls-api')return matchesBlsApiFeed(value);
  if(feed==='bea-nipa')return [beaMonthly,beaQuarterly].includes(value);
  if(feed==='dol-national-claims')return value===dolUrl;
  return false;
}

function requireFields(item,expected,label){
  for(const [key,value]of Object.entries(expected))if(item[key]!==value)throw new Error(`Unreviewed ${label} ${key} terms, attribution or measurement scope`);
}

function assertBoard(item,expected){
  requireFields(item,{licenseUrl:boardTerms,observationType:'official',...expected},'Board');
  if(item.sourceNotice||item.redistributionNotice||item.termsUrl&&item.termsUrl!==boardTerms)throw new Error('Unreviewed Board notice or inherited provider terms');
}

function assertTarget(item,source){
  requireFields(item,{sourceTitle:'Effective Federal Funds Rate',licenseUrl:NY_FED_TERMS_URL,attribution:'Source: Federal Reserve Bank of New York, Effective Federal Funds Rate.',unit:'Percent',frequency:'Daily',adjustment:'Not seasonally adjusted',observationType:'official'},'New York Fed');
  const year=typeof source.fetchedAt==='string'?new Date(source.fetchedAt).getUTCFullYear():NaN;
  if(!Number.isInteger(year))throw new Error('New York Fed copyright requires its captured retrieval year');
  const notices=[NY_FED_DATA_NOTICE.replace('2026',String(year)),NY_FED_PRODUCT_NOTICE,NY_FED_REFERENCE_RATE_NOTICE];
  if(notices.some(notice=>!item.sourceNotice?.includes(notice)))throw new Error('Required New York Fed copyright or redistribution notice missing');
}

function assertNewMetadata(agency,id,item,source){
  if(agency==='policyRates'){
    if(id==='iorb')assertBoard(item,{sourceTitle:'Interest on Reserve Balances',unit:'Percent',frequency:'Daily',adjustment:'Not seasonally adjusted',attribution:'Source: Board of Governors of the Federal Reserve System, Interest on Reserve Balances.'});
    else assertTarget(item,source);
  }
  if(agency==='activity')assertBoard(item,{sourceTitle:id==='industrialProduction'?'G.17 Total Industrial Production':'G.17 Total Industry Capacity Utilization',unit:id==='industrialProduction'?'Index 2017=100':'Percent',frequency:'Monthly',adjustment:'Seasonally adjusted',attribution:'Source: Board of Governors of the Federal Reserve System, G.17 Industrial Production and Capacity Utilization.'});
  if(agency==='housing'){
    requireFields(item,{sourceTitle:housingProgram,programName:housingProgram,unit:'Thousands of units, SAAR',frequency:'Monthly',adjustment:'Seasonally adjusted annual rate',observationType:'official',licenseUrl:housingTerms,attribution:`Source: U.S. Census Bureau, ${housingProgram}.`},'Census housing');
    const capture=source.provenance?.find(row=>row.url===housingUrl);
    if(capture?.filename!=='RESCONST-mf.csv'||!capture.usageNote?.includes('U.S. Census Bureau')||!capture.usageNote.includes('originating'))throw new Error('Census housing provenance must retain the RESCONST file and originating-program attribution instructions');
  }
}

/** Check only the new scope, so old immutable captures keep their old meanings. */
export function assertMacroCoverageData(snapshot){
  const newProviders=new Set(['policyRates','activity','housing']);
  for(const [agency,source]of Object.entries(snapshot.sources??{})){
    const policies=macroCoveragePolicies.filter(policy=>policy.agency===agency);
    if(!policies.length)continue;
    const entries=Object.entries(source.series??{});
    const selected=entries.filter(([id])=>policies.some(policy=>Object.hasOwn(policy.series,id)));
    if(newProviders.has(agency)&&entries.some(([id])=>!policies.some(policy=>Object.hasOwn(policy.series,id))))throw new Error(`Unreviewed macro coverage series scope: ${agency}`);
    if(!selected.length){
      if(newProviders.has(agency)&&source.fetchedAt)throw new Error(`Missing captured macro coverage series scope: ${agency}`);
      continue;
    }
    const inputs=new Set((source.provenance??[]).map(row=>row.url));
    for(const url of inputs)if(!policies.some(policy=>matchesSourceFeed(url,policy.feed)))throw new Error(`Unreviewed macro coverage provenance for ${agency}`);
    for(const [id,item]of selected){
      const policy=policies.find(policy=>Object.hasOwn(policy.series,id)),expected=policy.series[id],feed=policy.seriesFeeds?.[id]??policy.feed;
      if(!Array.isArray(item.sourceIds)||item.sourceIds.length!==expected.length||expected.some((code,index)=>item.sourceIds[index]!==code))throw new Error(`Unreviewed source identifier for ${agency}/${id}`);
      if(!matchesSourceFeed(item.sourceUrl,feed))throw new Error(`Unreviewed macro coverage feed for ${agency}/${id}`);
      if(!inputs.has(item.sourceUrl))throw new Error(`Macro coverage source lacks captured provenance: ${agency}/${id}`);
      for(const url of item.sourceUrls??[])if(!matchesSourceFeed(url,feed)||!inputs.has(url))throw new Error(`Unreviewed supporting source feed for ${agency}/${id}`);
      assertNewMetadata(agency,id,item,source);
      for(const row of item.observations??[]){
        if(Object.hasOwn(row,'sourceUrl')||Object.hasOwn(row,'sourceUrls'))throw new Error(`Unreviewed per-observation source override for ${agency}/${id}`);
        if(newProviders.has(agency)&&row.publishedAt!==null)throw new Error(`Unreviewed historical publication source timing for ${agency}/${id}`);
      }
    }
  }
}
