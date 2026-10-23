// Exact reviewed measurement scope: docs/economic-depth-source-review.md.
const quarterly='https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
const monthly='https://apps.bea.gov/national/Release/TXT/NipaDataM.txt';
const bls='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const ids=values=>Object.fromEntries(Object.entries(values).map(([id,code])=>[id,[code]]));
export const economicDepthPolicies=[{
  id:'bea-economic-depth',agency:'bea',reviewedOn:'2026-10-23',commercialUse:true,
  basis:'BEA public-domain NIPA nominal GDP/GDI, published real private demand and investment growth, saving and national-accounts trade statistics; source credit, annual-rate units and current-vintage limits retained',
  terms:['https://www.bea.gov/help/faq/147','https://www.bea.gov/help/guidelines-for-citing-bea'],feed:'bea-nipa',
  series:ids({nominalGdp:'A191RC',privateDomesticDemand:'LB000003',privateDomesticDemandGrowth:'PB000003',nominalGdi:'A261RC',realGdiGrowth:'A261RL',nonresidentialInvestmentGrowth:'A008RL',residentialInvestmentGrowth:'A011RL',structuresInvestmentGrowth:'A009RL',equipmentInvestmentGrowth:'Y033RL',intellectualPropertyInvestmentGrowth:'Y001RL',nominalExports:'B020RC',nominalImports:'B021RC',nominalTradeBalance:'A019RC',savingRate:'A072RC'}),
  seriesFeeds:{savingRate:'economic-depth-bea-monthly'},
},{
  id:'bls-economic-depth',agency:'bls',reviewedOn:'2026-10-23',commercialUse:true,
  basis:'Public-domain BLS JOLTS rates, prime-age CPS ratios, civilian compensation ECI and nonfarm-business productivity/cost statistics with access date, attribution and required disclaimer; calculated ECI change is explicitly labeled',
  terms:['https://www.bls.gov/opub/copyright-information.htm','https://www.bls.gov/developers/termsOfService.htm'],feed:'bls-api',
  series:ids({hiresRate:'JTS000000000000000HIR',quitsRate:'JTS000000000000000QUR',layoffsRate:'JTS000000000000000LDR',primeAgeEmploymentPopulation:'LNS12300060',primeAgeParticipation:'LNS11300060',eciCompensation:'CIS1010000000000I',eciCompensationQuarterly:'CIS1010000000000I',laborProductivity:'PRS85006092',unitLaborCosts:'PRS85006112'}),
}];
for(const policy of economicDepthPolicies)if(policy.agency==='bea')for(const id of Object.keys(policy.series))if(id!=='savingRate')policy.seriesFeeds[id]='economic-depth-bea-quarterly';

export function matchesEconomicDepthFeed(value,feed){
  if(feed==='economic-depth-bea-monthly')return value===monthly;
  if(feed==='economic-depth-bea-quarterly')return value===quarterly;
  return false;
}

export function assertEconomicDepthData(snapshot){
  for(const policy of economicDepthPolicies){
    const source=snapshot.sources?.[policy.agency];
    if(!source)continue;
    for(const [id,series]of Object.entries(source.series??{})){
      if(!Object.hasOwn(policy.series,id))continue;
      const expected=policy.agency==='bls'?bls:id==='savingRate'?monthly:quarterly;
      if(series.sourceUrl!==expected)throw new Error(`Unreviewed economic-depth feed: ${policy.agency}/${id}`);
      if(!source.provenance?.some(item=>item.url===expected&&/^[a-f0-9]{64}$/.test(item.sha256)))throw new Error(`Missing captured economic-depth provenance: ${policy.agency}/${id}`);
      if(series.observationType!==(id==='eciCompensationQuarterly'?'calculated':'official'))throw new Error(`Unreviewed economic-depth measurement type: ${id}`);
      for(const row of series.observations??[])if(row.publishedAt!==null)throw new Error(`Unreviewed economic-depth historical publication timing: ${id}`);
    }
  }
  const treasury=snapshot.sources?.treasury;
  for(const row of treasury?.series?.yield?.observations??[]){
    if(!row.sourceUrl)continue; // Older immutable captures did not carry row-level lineage.
    const url=new URL(row.sourceUrl),year=row.date?.slice(0,4);
    if(url.origin!=='https://home.treasury.gov'||url.pathname!==`/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all`||url.searchParams.get('type')!=='daily_treasury_yield_curve'||url.searchParams.get('field_tdr_date_value')!==year||!treasury.provenance?.some(item=>item.url===row.sourceUrl))throw new Error('Unreviewed main 10Y yield history provenance');
    if((Object.hasOwn(row,'retrievedAt')||Object.hasOwn(row,'sourceSha256'))&&(!Number.isFinite(Date.parse(row.retrievedAt))||!treasury.provenance?.some(item=>item.url===row.sourceUrl&&item.retrievedAt===row.retrievedAt&&item.sha256===row.sourceSha256)))throw new Error('Unreviewed main 10Y yield row capture provenance');
  }
}
