// Dataset-specific commercial reuse review. Evidence and limitations: docs/data-sources.md.
// An official-looking hostname alone does not establish reuse rights.
export const dataPolicies = [
  {
    id:'bls-statistics', agency:'bls', reviewedOn:'2026-10-21', commercialUse:true,
    basis:'Public-domain BLS statistics; API attribution and disclaimer conditions apply',
    terms:['https://www.bls.gov/opub/copyright-information.htm','https://www.bls.gov/developers/termsOfService.htm'],
    series:{unrate:['LNS14000000'],payroll:['CES0000000001'],cpi:['CUUR0000SA0'],participation:['LNS11300000'],wages:['CES0500000003'],openings:['JTS000000000000000JOL']},
    feed:'bls-api',
  },
  {
    id:'bea-nipa', agency:'bea', reviewedOn:'2026-10-21', commercialUse:true,
    basis:'BEA public-domain policy; NIPA GDP and PCE statistical data',
    terms:['https://www.bea.gov/help/faq/147','https://www.bea.gov/help/guidelines-for-citing-bea'],
    series:{gdp:['A191RL'],pce:['DPCERG']}, feed:'bea-nipa',
  },
  {
    id:'treasury-debt', agency:'treasury', reviewedOn:'2026-10-21', commercialUse:true,
    basis:'Fiscal Data explicitly permits commercial copying, adaptation and redistribution',
    terms:['https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization'],
    series:{debt:['tot_pub_debt_out_amt']}, feed:'treasury-debt',
  },
  {
    id:'treasury-par-yields', agency:'treasury', reviewedOn:'2026-10-21', commercialUse:true,
    basis:'Treasury dataset 015-DO-020 is listed as CC0 1.0 in its official Data.gov catalog record; includes the par yield curve',
    terms:['https://catalog.data.gov/dataset/interest-rate-statistics-daily-treasury-yield-curve-rates','https://creativecommons.org/publicdomain/zero/1.0/'],
    series:{yield:['BC_10YEAR']}, feed:'treasury-par-yields',
  },
  {
    id:'dol-national-claims', agency:'dol', reviewedOn:'2026-10-21', commercialUse:true,
    basis:'DOL public-domain federal statistical compilation; credit ETA and do not imply endorsement',
    terms:['https://beta.dol.gov/about/notices/website-content-and-publication-practices/public-domain-copyright-trademarks-patents','https://catalog.data.gov/dataset/historical-unemployment-insurance-seasonally-adjusted-and-unadjusted-weekly-claims-data'],
    series:{claims:['InitialClaims/SA']}, feed:'dol-national-claims',
  },
  {
    id:'census-advance-retail', agency:'census', reviewedOn:'2026-10-21', commercialUse:true,
    basis:'Census MARTS dataset is listed as CC0; bulk download requires Census Bureau and originating program attribution',
    terms:['https://catalog.data.gov/dataset/time-series-economic-indicators-time-series-advance-monthly-sales-for-retail-and-food-serv','https://www.census.gov/about/policies/citation.html','https://www.census.gov/econ_datasets/'],
    series:{retail:['MARTS:44X72:SM:US:SA']}, feed:'census-advance-retail',
  },
];

function matchesFeed(value, feed) {
  try {
    const url=new URL(value);
    if(url.username || url.password)return false;
    const endpoint=url.origin+url.pathname;
    if(feed==='bls-api')return endpoint==='https://api.bls.gov/publicAPI/v1/timeseries/data/';
    if(feed==='bea-nipa')return ['https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt','https://apps.bea.gov/national/Release/TXT/NipaDataM.txt'].includes(endpoint);
    if(feed==='treasury-debt')return endpoint==='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny';
    if(feed==='treasury-par-yields')return url.origin==='https://home.treasury.gov' && /^\/resource-center\/data-chart-center\/interest-rates\/daily-treasury-rates\.csv\/\d{4}\/all$/.test(url.pathname) && url.searchParams.get('type')==='daily_treasury_yield_curve';
    if(feed==='dol-national-claims')return endpoint==='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
    if(feed==='census-advance-retail')return endpoint==='https://www.census.gov/econ_getzippedfile/' && url.searchParams.get('programCode')==='MARTS';
  } catch { /* A malformed URL is never an approved feed. */ }
  return false;
}

export const calendarPolicies = {
  bls: {
    reviewedOn:'2026-10-21',commercialUse:true,
    basis:'BLS public-domain electronic publications; agency-authored release schedule metadata, with source credit',
    terms:['https://www.bls.gov/opub/copyright-information.htm'],
    programs:{'employment-situation':['unrate','payroll','participation','wages'],'consumer-price-index':['cpi'],'job-openings':['openings']},
  },
  bea: {
    reviewedOn:'2026-10-21',commercialUse:true,
    basis:'BEA website information is public domain unless otherwise noted; national release schedule metadata has no contrary notice',
    terms:['https://www.bea.gov/help/faq/147','https://www.bea.gov/help/guidelines-for-citing-bea'],
    programs:{gdp:['gdp'],'personal-income-outlays':['pce']},
  },
};

function calendarFeed(value,id) {
  try {
    const url=new URL(value);
    if(url.username||url.password||url.search||url.hash)return false;
    if(id==='bls')return url.origin==='https://www.bls.gov' && /^\/schedule\/\d{4}\/home\.htm$/.test(url.pathname);
    if(id==='bea')return url.href==='https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics';
  } catch { /* Invalid calendar URLs are outside the reviewed scope. */ }
  return false;
}

function assertCalendarData(snapshot) {
  const captured=new Map();
  for(const [id,source] of Object.entries(snapshot.calendar?.sources??{})) {
    const policy=calendarPolicies[id];
    if(!Object.hasOwn(calendarPolicies,id)||!policy.commercialUse)throw new Error(`Commercial reuse review required for calendar source: ${id}`);
    for(const item of source.provenance??[]) {
      if(!calendarFeed(item.url,id)||!/^[a-f0-9]{64}$/.test(item.sha256))throw new Error(`Unreviewed calendar provenance for ${id}`);
    }
    for(const event of source.events??[]) {
      const approved=Object.hasOwn(policy.programs,event.program)?policy.programs[event.program]:null;
      if(event.sourceId!==id||!approved||event.seriesId!==approved[0]||!Array.isArray(event.seriesIds)||event.seriesIds.length!==approved.length||!approved.every((value,index)=>event.seriesIds[index]===value))throw new Error(`Unreviewed calendar program or indicator mapping for ${id}`);
      if(!calendarFeed(event.sourceUrl,id)||!source.provenance?.some(item=>item.url===event.sourceUrl))throw new Error(`Unreviewed calendar feed for ${id}`);
      if(!event.id||captured.has(event.id))throw new Error('Invalid or duplicate captured calendar identifier');
      captured.set(event.id,event);
    }
  }
  const releases=snapshot.releases??[];
  if(releases.length!==captured.size||new Set(releases.map(event=>event.id)).size!==releases.length||releases.some(event=>JSON.stringify(captured.get(event.id))!==JSON.stringify(event)))throw new Error('Commercial reuse review required for uncaptured calendar records');
}

/** Stop publication or snapshot replacement when data exceed the reviewed scope. */
export function assertCommercialData(snapshot) {
  assertCalendarData(snapshot);
  for(const [agency,source] of Object.entries(snapshot.sources ?? {})) {
    const policies=dataPolicies.filter(policy=>policy.agency===agency && policy.commercialUse===true);
    if(!policies.length)throw new Error(`Commercial reuse review required for source: ${agency}`);
    for(const [id,series] of Object.entries(source.series ?? {})) {
      const policy=policies.find(policy=>Object.hasOwn(policy.series,id));
      if(!policy)throw new Error(`Commercial reuse review required for series: ${agency}/${id}`);
      const approvedIds=policy.series[id];
      if(!Array.isArray(series.sourceIds) || series.sourceIds.length!==approvedIds.length || !approvedIds.every((value,index)=>series.sourceIds[index]===value))throw new Error(`Unreviewed source identifier for ${agency}/${id}`);
      if(!matchesFeed(series.sourceUrl,policy.feed))throw new Error(`Unreviewed feed for ${agency}/${id}`);
    }
    for(const item of source.provenance ?? []) {
      if(!policies.some(policy=>matchesFeed(item.url,policy.feed)))throw new Error(`Unreviewed provenance for ${agency}: ${item.url}`);
    }
  }
}
