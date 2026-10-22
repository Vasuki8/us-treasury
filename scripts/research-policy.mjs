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
}];
export function matchesResearchFeed(value,feed){
  try{
    const url=new URL(value);if(url.username||url.password||url.hash)return false;
    if(feed==='treasury-mts-fiscal')return fiscalPaths.some(part=>url.origin+url.pathname===fiscalBase+part);
    if(feed==='fiscal-public-debt')return url.origin+url.pathname===fiscalBase+fiscalPaths[3];
    if(feed==='fiscal-table9')return url.origin+url.pathname===fiscalBase+fiscalPaths[0];
    if(feed==='treasury-mspd')return ['mspd_table_3_market','mspd_table_1'].some(table=>url.origin+url.pathname===fiscalBase+'v1/debt/mspd/'+table);
    if(feed==='treasury-mspd-market')return url.origin+url.pathname===fiscalBase+'v1/debt/mspd/mspd_table_3_market';
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
}
