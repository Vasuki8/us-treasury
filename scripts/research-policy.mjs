// Dataset-specific admissions. Evidence: docs/fiscal-source-review.md,
// docs/yields-source-review.md. This does not license unrelated agency content.
const fiscalBase='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/';
const fiscalPaths=['v1/accounting/mts/mts_table_9','v1/accounting/mts/mts_table_2','v1/accounting/mts/mts_receipts_outlays_deficit_surplus','v2/accounting/od/debt_to_penny'];
const fiscalDerived=['budgetDeficit','primaryDeficit','receiptsTtm','outlaysTtm','netInterestTtm','primaryDeficitTtm','interestRevenueRatio'];
export const researchPolicies=[{
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
}];
export function matchesResearchFeed(value,feed){
  try{
    const url=new URL(value);if(url.username||url.password||url.hash)return false;
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
export function assertResearchData(snapshot){
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
