// Dataset-specific admissions. Evidence: docs/fiscal-source-review.md,
// docs/yields-source-review.md. This does not license unrelated agency content.
import {marketPolicies,matchesMarketFeed,assertMarketData} from './market-policy.mjs';
import {normalizeVintageTimestamp} from '../src/vintages.js';
import {SOMA_2014_GAP_URL,SOMA_2014_GAP_DATES} from '../src/ownership.js';
const fiscalBase='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/';
const fiscalPaths=['v1/accounting/mts/mts_table_9','v1/accounting/mts/mts_table_2','v1/accounting/mts/mts_receipts_outlays_deficit_surplus','v2/accounting/od/debt_to_penny'];
const fiscalDerived=['budgetDeficit','primaryDeficit','receiptsTtm','outlaysTtm','netInterestTtm','primaryDeficitTtm','interestRevenueRatio'];
export const researchPolicies=[...marketPolicies,{
  id:'treasury-mts-fiscal',agency:'fiscal',reviewedOn:'2026-10-21',commercialUse:true,
  basis:'Fiscal Data explicitly permits commercial copying, adaptation and redistribution; MTS fiscal observations and calculated monthly arithmetic, not copied narrative or imagery',
  terms:['https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization'],feed:'treasury-mts-fiscal',
  seriesFeeds:{publicDebt:'fiscal-public-debt',...Object.fromEntries(['receipts','outlays','netInterest',...fiscalDerived].map(id=>[id,'fiscal-table9']))},
  series:{receipts:['mts_table_9:Receipts:Total:current_month_rcpt_outly_amt'],outlays:['mts_table_9:Net Outlays:Total:current_month_rcpt_outly_amt'],netInterest:['mts_table_9:Net Interest:current_month_rcpt_outly_amt'],publicDebt:['debt_held_public_amt'],...Object.fromEntries(fiscalDerived.map(id=>[id,['MTS:calculated:'+id]]))},
},{
  id:'treasury-mspd-maturities',agency:'refinancing',reviewedOn:'2026-10-21',commercialUse:true,
  basis:'Fiscal Data commercial copying/adaptation/redistribution for MSPD marketable principal facts; raw third-party security identifiers omitted',
  terms:['https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization'],feed:'treasury-mspd',
  seriesFeeds:{marketableDebt:'treasury-mspd-market'},
  series:{marketableDebt:['mspd_table_3_market:unmatured-outstanding']},
},{
  id:'treasury-nominal-real-par',agency:'yields',reviewedOn:'2026-10-21',commercialUse:true,
  basis:'Treasury nominal dataset 015-DO-020 and separate real dataset 015-DO-036 list CC0 1.0; source credit and calculated-spread labeling retained',
  terms:['https://catalog.data.gov/dataset/interest-rate-statistics-daily-treasury-yield-curve-rates','https://catalog.data.gov/dataset/daily-treasury-real-yield-curve-rates','https://creativecommons.org/publicdomain/zero/1.0/'],feed:'research-par-yields',
  seriesFeeds:{realYield10:'research-real-par',spread2s10s:'research-nominal-par',spread3m10y:'research-nominal-par',inflationComp10:'research-nominal-par',nominalYield2:'research-nominal-par',nominalYield3m:'research-nominal-par'},
  series:{spread2s10s:['BC_10YEAR','BC_2YEAR'],spread3m10y:['BC_10YEAR','BC_3MONTH'],realYield10:['TC_10YEAR'],inflationComp10:['BC_10YEAR','TC_10YEAR'],nominalYield2:['BC_2YEAR'],nominalYield3m:['BC_3MONTH']},
},{
  id:'treasury-auction-results',agency:'auctions',reviewedOn:'2026-10-21',commercialUse:true,
  basis:'Fiscal Data permits commercial copying, adaptation and redistribution; auction facts excluding third-party security identifier fields',terms:['https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization'],feed:'treasury-auctions',
  series:{auctionOfferingMonthly:['offering_amt','auction_date','bid_to_cover_ratio']},
},{
 id:'fed-z1-treasury-positions',agency:'ownership',reviewedOn:'2026-10-21',commercialUse:true,
 basis:'Federal Reserve Board public-domain statistical data with credit; selected Z.1 Treasury sector positions and dictionary only',terms:['https://www.federalreserve.gov/disclaimer.htm'],feed:'fed-z1',
 seriesFeeds:{foreignTreasuryHoldings:'fed-z1-values',fedTreasuryHoldings:'fed-z1-values'},
 series:{foreignTreasuryHoldings:['LM263061105.Q'],fedTreasuryHoldings:['LM713061103.Q']},
},{
 id:'nyfed-soma-treasury',agency:'ownership',reviewedOn:'2026-10-21',commercialUse:true,
 basis:'Conditional commercial/business reuse under New York Fed Terms of Use; titles, copyright, source/terms links and downstream same-conditions notice retained; modified aggregation labeled',terms:['https://www.newyorkfed.org/privacy/termsofuse.html'],feed:'nyfed-soma',
 series:{somaTreasuryHoldings:['SOMA:treasury-adjusted-par']},
},{
 id:'bea-published-growth-contributions',agency:'macroContributions',reviewedOn:'2026-10-23',commercialUse:true,
 basis:'BEA public-domain NIPA 1.1.2 published statistical contributions with citation; no chained-dollar approximations',terms:['https://www.bea.gov/help/faq/147','https://www.bea.gov/help/guidelines-for-citing-bea'],feed:'bea-contributions',
 series:{gdpTotalContribution:['A191RL'],gdpConsumptionContribution:['DPCERY'],gdpInvestmentContribution:['A006RY'],gdpGovernmentContribution:['A822RY'],gdpExportsContribution:['A020RY'],gdpImportsContribution:['A021RY'],gdpFixedInvestmentContribution:['A007RY'],gdpInventoriesContribution:['A014RY'],gdpConsumptionGoodsContribution:['DGDSRY'],gdpConsumptionServicesContribution:['DSERRY']},
}];
export function matchesResearchFeed(value,feed){
  if(matchesMarketFeed(value,feed))return true;
  try{
    const url=new URL(value);if(url.username||url.password||url.hash)return false;
    if(feed==='bea-contributions')return url.href==='https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
    if(feed==='fed-z1')return !url.search&&['https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip','https://www.federalreserve.gov/releases/z1/default.htm'].includes(url.href);
    if(feed==='fed-z1-values')return url.href==='https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip';
    if(feed==='nyfed-soma')return ['https://markets.newyorkfed.org/api/soma/summary.json',SOMA_2014_GAP_URL].includes(url.href);
    if(feed==='treasury-mts-fiscal')return fiscalPaths.some(part=>url.origin+url.pathname===fiscalBase+part);
    if(feed==='fiscal-public-debt')return url.origin+url.pathname===fiscalBase+fiscalPaths[3];
    if(feed==='fiscal-table9')return url.origin+url.pathname===fiscalBase+fiscalPaths[0];
    if(feed==='treasury-mspd')return ['mspd_table_3_market','mspd_table_1'].some(table=>url.origin+url.pathname===fiscalBase+'v1/debt/mspd/'+table);
    if(feed==='treasury-mspd-market')return url.origin+url.pathname===fiscalBase+'v1/debt/mspd/mspd_table_3_market';
    if(feed==='treasury-auctions')return url.origin+url.pathname===fiscalBase+'v1/accounting/od/auctions_query';
    if(['research-par-yields','research-nominal-par','research-real-par'].includes(feed)){
      const match=/^\/resource-center\/data-chart-center\/interest-rates\/daily-treasury-rates\.csv\/(\d{4})\/all$/.exec(url.pathname);
      const allowed=feed==='research-nominal-par'?['daily_treasury_yield_curve']:feed==='research-real-par'?['daily_treasury_real_yield_curve']:['daily_treasury_yield_curve','daily_treasury_real_yield_curve'];
      return url.origin==='https://home.treasury.gov'&&Boolean(match)&&url.searchParams.get('field_tdr_date_value')===match[1]&&allowed.includes(url.searchParams.get('type'));
    }
  }catch{/* Unreviewed URLs remain rejected. */}
  return false;
}
function assertOwnershipObservationReceipts(source){
  if(!source)return;
  const fail=()=>{throw new Error('Invalid ownership observation source provenance');};
  let supplementalUsed=false;
  for(const [id,item]of Object.entries(source.series??{})){
    const rows=item.observations??[];
    if(!Array.isArray(rows))fail();
    const alternate=rows.some(row=>row.sourceUrl===SOMA_2014_GAP_URL);
    if(item.sourceUrl===SOMA_2014_GAP_URL)fail();
    if(alternate){
      if(id!=='somaTreasuryHoldings'||!Array.isArray(item.sourceUrls)||item.sourceUrls.length!==2||item.sourceUrls[0]!==item.sourceUrl||item.sourceUrls[1]!==SOMA_2014_GAP_URL||new Set(rows.map(row=>row.date)).size!==rows.length)fail();
      supplementalUsed=true;
    }else if(item.sourceUrls?.includes?.(SOMA_2014_GAP_URL))fail();
    if(item.inputProvenanceScope!=='observation-source-urls'){
      if(rows.some(row=>['sourceUrl','sourceUrls','sourceSha256','retrievedAt','inputProvenance'].some(key=>Object.hasOwn(row,key))))fail();
      continue; // Earlier immutable ownership captures use the original receipt scope.
    }
    const expected=id==='somaTreasuryHoldings'?'https://markets.newyorkfed.org/api/soma/summary.json':['foreignTreasuryHoldings','fedTreasuryHoldings'].includes(id)?'https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip':null;
    if(!expected||item.sourceUrl!==expected||!rows.length||!Array.isArray(source.provenance))fail();
    let sourceTime;try{sourceTime=normalizeVintageTimestamp(source.fetchedAt);}catch{fail();}
    for(const row of rows){
      const supplemental=row.sourceUrl===SOMA_2014_GAP_URL;
      if(supplemental&&(!SOMA_2014_GAP_DATES.includes(row.date)||typeof row.value!=='number'||!Number.isFinite(row.value)))fail();
      if((row.sourceUrl!==expected&&!supplemental)||Object.hasOwn(row,'sourceUrls')||Object.hasOwn(row,'inputProvenance')||typeof row.sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(row.sourceSha256)||typeof row.retrievedAt!=='string'||row.publishedAt!==null)fail();
      let retrievedAt;try{retrievedAt=normalizeVintageTimestamp(row.retrievedAt);}catch{fail();}
      if(retrievedAt>sourceTime||source.provenance.filter(receipt=>receipt.url===row.sourceUrl&&receipt.sha256===row.sourceSha256&&receipt.retrievedAt===row.retrievedAt).length!==1)fail();
    }
  }
  if(!supplementalUsed&&source.provenance?.some(receipt=>receipt.url===SOMA_2014_GAP_URL))fail();
}
export function assertResearchData(snapshot){
  assertMarketData(snapshot.sources?.marketFunctioning);
  assertOwnershipObservationReceipts(snapshot.sources?.ownership);
  if((snapshot.sources?.macroContributions?.cpiCategoryEffects?.observations??[]).length)throw new Error('CPI effects observations require separate source admission');
  const contributionSource=snapshot.sources?.macroContributions;
  const subcomponents={gdpFixedInvestmentContribution:'gdpInvestmentContribution',gdpInventoriesContribution:'gdpInvestmentContribution',gdpConsumptionGoodsContribution:'gdpConsumptionContribution',gdpConsumptionServicesContribution:'gdpConsumptionContribution'};
  for(const [id,parentContribution]of Object.entries(subcomponents)){
    const item=contributionSource?.series?.[id];
    if(!item)continue; // Earlier immutable captures retain their original six measurements.
    if(item.contributionScope!=='subcomponent'||item.parentContribution!==parentContribution||item.observationType!=='official')throw new Error(`Unreviewed GDP subcomponent measurement scope: ${id}`);
    if(!contributionSource.provenance?.some(capture=>capture.url===item.sourceUrl&&/^[a-f0-9]{64}$/.test(capture.sha256)))throw new Error(`Missing GDP subcomponent captured provenance: ${id}`);
    if(item.observations?.some(row=>row.publishedAt!==null))throw new Error(`Unreviewed GDP subcomponent historical publication timing: ${id}`);
  }
  for(const item of Object.values(snapshot.sources?.ownership?.series??{}))if(item.sourceUrl?.startsWith('https://markets.newyorkfed.org/')){
    if(item.sourceTitle!=='SOMA Holdings'||item.termsUrl!=='https://www.newyorkfed.org/privacy/termsofuse.html'||!item.attribution?.includes('Federal Reserve Bank of New York')||!item.redistributionNotice?.includes('permissions, conditions and restrictions'))throw new Error('Required SOMA commercial redistribution conditions missing');
  }
  const source=snapshot.sources?.fiscal;
  for(const row of source?.monthly??[]){
    if(!/^\d{4}-\d{2}-01$/.test(row.date)||!/^\d{4}-\d{2}-\d{2}$/.test(row.periodEnd)||row.periodEnd.slice(0,7)!==row.date.slice(0,7)||row.recordDate!==row.periodEnd)throw new Error('Unreviewed fiscal month or reference date');
    if(['html','body','logo','publishedAt','forecast'].some(key=>Object.hasOwn(row,key)))throw new Error('Unreviewed fiscal content');
    for(const key of ['receipts','outlays','deficit','borrowingPublic','cashReduction','otherFinancing'])if(typeof row[key]!=='number'||!Number.isFinite(row[key]))throw new Error('Invalid fiscal actual amount');
  }
  for(const row of snapshot.sources?.refinancing?.securities??[]){
    if(Object.hasOwn(row,'cusip')||!/^meridian-[a-f0-9]{20}$/.test(row.securityId))throw new Error('Unreviewed published security identifier; raw CUSIPs are excluded');
    if(!['Bill','Note','Bond','FRN','TIPS'].includes(row.type)||typeof row.principal!=='number'||!Number.isFinite(row.principal)||row.principal<=0)throw new Error('Invalid marketable debt principal or instrument');
  }
  const yieldSource=snapshot.sources?.yields;
  if(yieldSource){
    const captured=new Set((yieldSource.provenance??[]).map(item=>item.url));
    for(const series of Object.values(yieldSource.series??{}))for(const row of series.observations??[]){
      for(const url of row.sourceUrls??[]){if(!matchesResearchFeed(url,'research-par-yields')||!captured.has(url)||!url.includes(`.csv/${row.date.slice(0,4)}/all`))throw new Error('Unreviewed yield observation input provenance');}
    }
  }
  for(const row of snapshot.sources?.auctions?.auctions??[]){
    if(Object.hasOwn(row,'cusip')||Object.hasOwn(row,'tail')||row.publishedAt!==null||!['Bill','Note','Bond','FRN','TIPS'].includes(row.securityType))throw new Error('Unreviewed auction identifier, tail, publication time or instrument');
  }
}
