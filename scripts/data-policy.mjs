import { easternFields } from './sources/calendar-utils.mjs';
import { researchPolicies, matchesResearchFeed, assertResearchData } from './research-policy.mjs';
import { assertVintageData } from './vintage-policy.mjs';

// Dataset-specific commercial reuse review. Evidence and limitations: docs/data-sources.md.
// An official-looking hostname alone does not establish reuse rights.
export const dataPolicies = [
  ...researchPolicies,
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
  if(matchesResearchFeed(value,feed))return true;
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
  census: {
    reviewedOn:'2026-10-21',commercialUse:true,
    basis:'Scoped review of factual federal retail release titles, dates, times and reference periods; Census employee-work policy and Copyright Office exclusions for facts/names, with Census program credit. This is not a calendar CC0 claim.',
    terms:['https://www2.census.gov/foia/ds_policies/ds027.pdf','https://www.copyright.gov/what-is-copyright/','https://www.census.gov/about/policies/citation.html'],
    programs:{'retail-sales':['retail']},
  },
  dol: {
    reviewedOn:'2026-10-21',commercialUse:true,
    basis:'DOL public-domain federal schedule metadata; bounded future expansion of the published weekly rule with its explicit holiday exceptions, source credit and no endorsement',
    terms:['https://beta.dol.gov/about/notices/website-content-and-publication-practices/public-domain-copyright-trademarks-patents','https://oui.doleta.gov/unemploy/claims_arch.asp'],
    programs:{'weekly-claims':['claims']},
  },
  treasury: {
    reviewedOn:'2026-10-21',commercialUse:true,
    basis:'Scoped factual Debt to the Penny identity and agency-estimated release dates/times from official Fiscal Data services. General Fiscal Data commercial open-data terms and Copyright Office facts/title exclusions; no calendar-specific CC0 claim. Credit Treasury Bureau of the Fiscal Service without endorsement.',
    terms:['https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization','https://www.copyright.gov/what-is-copyright/'],
    programs:{'debt-to-the-penny':['debt']},
  },
  'treasury-yield-timing': {
    reviewedOn:'2026-10-21',commercialUse:true,
    basis:'Extracted factual yield availability deadline, trading-day scope and delay qualification with original paraphrase. Copyright Office facts/title exclusions and federal official-duty works rule; no methodology-prose or dataset CC0 transfer. Credit Treasury Office of Debt Management without endorsement.',
    terms:['https://www.copyright.gov/what-is-copyright/','https://www.copyright.gov/title17/92chap1.html#105','https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology'],
    programs:{},
  },
};

function calendarFeed(value,id) {
  try {
    const url=new URL(value);
    if(url.username||url.password||url.search||url.hash)return false;
    if(id==='bls')return url.origin==='https://www.bls.gov' && /^\/schedule\/\d{4}\/home\.htm$/.test(url.pathname);
    if(id==='bea')return url.href==='https://www.bea.gov/news/schedule/ics/online-calendar-subscription.ics';
    if(id==='census')return url.origin==='https://www.census.gov'&&/^\/economic-indicators\/calendar-listview(?:-\d{4})?\.html$/.test(url.pathname);
    if(id==='dol')return url.href==='https://oui.doleta.gov/unemploy/claims_arch.asp';
    if(id==='treasury')return ['https://api.fiscaldata.treasury.gov/services/calendar/release','https://api.fiscaldata.treasury.gov/services/dtg/metadata/'].includes(url.href);
    if(id==='treasury-yield-timing')return url.href==='https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology';
  } catch { /* Invalid calendar URLs are outside the reviewed scope. */ }
  return false;
}

function calendarDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const stamp=Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(stamp)&&new Date(stamp).toISOString().slice(0,10)===value?stamp:null;
}

function assertDolSchedule(source,event) {
  const fail=()=>{throw new Error('Unreviewed DOL calendar rule, coverage or exception');};
  const start=calendarDate(source.coverageStart),end=calendarDate(source.coverageEnd),nominal=calendarDate(event.nominalDate),date=calendarDate(event.date);
  if(source.scheduleMethod!=='recurring-rule-with-exceptions'||!source.rawScheduleRule?.startsWith('Publication Schedule: The UI Weekly Claims News Release is published each week on Thursday morning at 8:30am EST.')||start===null||end===null||end<start||end-start>89*86400000||nominal===null||new Date(nominal).getUTCDay()!==4||date===null||date<start||date>end||event.time!=='08:30'||event.period!==null||event.periodLabel!==null)fail();
  if(!Array.isArray(source.publishedExceptions)||!source.publishedExceptions.length)fail();
  const seen=new Set();
  for(const exception of source.publishedExceptions) {
    const posted=calendarDate(exception.date),replaced=calendarDate(exception.nominalDate);
    if(posted===null||replaced===null||new Date(posted).getUTCDay()!==3||replaced-posted!==86400000||exception.time!=='08:30'||seen.has(exception.nominalDate))fail();
    seen.add(exception.nominalDate);
  }
  const lastYear=Math.max(...source.publishedExceptions.map(exception=>Number(exception.date.slice(0,4))));
  if(source.coverageEnd>`${lastYear}-12-31`)fail();
  const exception=source.publishedExceptions.find(item=>item.nominalDate===event.nominalDate);
  if(exception) {
    if(event.scheduleBasis!=='published-exception'||event.date!==exception.date||event.time!==exception.time)fail();
  } else if(event.scheduleBasis!=='recurring-rule'||event.date!==event.nominalDate)fail();
}

function assertTreasurySchedule(source,event) {
  const fail=()=>{throw new Error('Unreviewed Treasury calendar metadata, estimate or UTC date/time');};
  const calendarUrl='https://api.fiscaldata.treasury.gov/services/calendar/release';
  const metadataUrl='https://api.fiscaldata.treasury.gov/services/dtg/metadata/';
  const identity=source.datasetIdentity;
  if(!identity||identity.datasetId!=='015-BFS-2014Q3-065'||identity.title!=='Debt to the Penny'||identity.path!=='debt-to-the-penny'||!source.provenance?.some(item=>item.url===metadataUrl))fail();
  if(event.sourceUrl!==calendarUrl||event.sourceDatasetId!==identity.datasetId||event.name!==identity.title||event.scheduleBasis!=='calendar-estimate'||event.sourceTimeZone!=='UTC'||event.period!==null||event.periodLabel!==null||calendarDate(event.sourceDate)===null||typeof event.sourceTime!=='string'||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(event.sourceTime))fail();
  if(['description','html','content','body','image','logo','released','publishedAt','actual','consensus','forecast'].some(key=>Object.hasOwn(event,key)))fail();
  const instant=`${event.sourceDate}T${event.sourceTime}:00.000Z`;
  let fields;
  try {fields=easternFields(instant);} catch {fail();}
  if(event.scheduledAt!==instant||event.date!==fields.date||event.time!==fields.time||event.id!==`treasury-debt-to-the-penny-${event.sourceDate}`)fail();
}

function assertYieldTiming(source) {
  const fail=()=>{throw new Error('Unreviewed Treasury yield timing scope, qualification or provenance');};
  if(!Array.isArray(source.events)||source.events.length)fail();
  if(!source.timing) {if(source.fetchedAt)fail();return;}
  const approved={program:'daily-par-yields',seriesIds:['yield'],topic:'Rates',scheduleBasis:'usual-availability',frequency:'each-trading-day',availableBy:'18:00',timeZone:'America/New_York',delaysPossible:true,sourceUrl:'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology'};
  const timing=source.timing;
  if(typeof timing!=='object'||Array.isArray(timing)||Object.keys(timing).length!==Object.keys(approved).length)fail();
  for(const [key,value] of Object.entries(approved)) {
    if(Array.isArray(value)?!Array.isArray(timing[key])||timing[key].length!==value.length||value.some((item,index)=>timing[key][index]!==item):timing[key]!==value)fail();
  }
  if(!source.provenance?.some(item=>item.url===approved.sourceUrl))fail();
}

function assertCalendarData(snapshot) {
  const captured=new Map();
  for(const [id,source] of Object.entries(snapshot.calendar?.sources??{})) {
    const policy=calendarPolicies[id];
    if(!Object.hasOwn(calendarPolicies,id)||!policy.commercialUse)throw new Error(`Commercial reuse review required for calendar source: ${id}`);
    if(id==='treasury-yield-timing')assertYieldTiming(source);
    else if(Object.hasOwn(source,'timing'))throw new Error(`Unreviewed timing metadata for calendar source: ${id}`);
    for(const item of source.provenance??[]) {
      if(!calendarFeed(item.url,id)||!/^[a-f0-9]{64}$/.test(item.sha256))throw new Error(`Unreviewed calendar provenance for ${id}`);
    }
    for(const event of source.events??[]) {
      const approved=Object.hasOwn(policy.programs,event.program)?policy.programs[event.program]:null;
      if(event.sourceId!==id||!approved||event.seriesId!==approved[0]||!Array.isArray(event.seriesIds)||event.seriesIds.length!==approved.length||!approved.every((value,index)=>event.seriesIds[index]===value))throw new Error(`Unreviewed calendar program or indicator mapping for ${id}`);
      if(!calendarFeed(event.sourceUrl,id)||!source.provenance?.some(item=>item.url===event.sourceUrl))throw new Error(`Unreviewed calendar feed for ${id}`);
      if(id==='census'&&(event.scheduleBasis!=='listed-date'||['description','html','content','body','image','logo'].some(key=>Object.hasOwn(event,key))))throw new Error('Unreviewed Census calendar content beyond listed factual metadata');
      if(id==='dol')assertDolSchedule(source,event);
      if(id==='treasury')assertTreasurySchedule(source,event);
      if(!event.id||captured.has(event.id))throw new Error('Invalid or duplicate captured calendar identifier');
      captured.set(event.id,event);
    }
  }
  const releases=snapshot.releases??[];
  if(releases.length!==captured.size||new Set(releases.map(event=>event.id)).size!==releases.length||releases.some(event=>JSON.stringify(captured.get(event.id))!==JSON.stringify(event)))throw new Error('Commercial reuse review required for uncaptured calendar records');
}

/** Stop publication or snapshot replacement when data exceed the reviewed scope. */
export function assertCommercialData(snapshot) {
  assertResearchData(snapshot);
  assertCalendarData(snapshot);
  for(const [agency,source] of Object.entries(snapshot.sources ?? {})) {
    const policies=dataPolicies.filter(policy=>policy.agency===agency && policy.commercialUse===true);
    if(!policies.length)throw new Error(`Commercial reuse review required for source: ${agency}`);
    for(const [id,series] of Object.entries(source.series ?? {})) {
      const policy=policies.find(policy=>Object.hasOwn(policy.series,id));
      if(!policy)throw new Error(`Commercial reuse review required for series: ${agency}/${id}`);
      const approvedIds=policy.series[id];
      if(!Array.isArray(series.sourceIds) || series.sourceIds.length!==approvedIds.length || !approvedIds.every((value,index)=>series.sourceIds[index]===value))throw new Error(`Unreviewed source identifier for ${agency}/${id}`);
      if(!matchesFeed(series.sourceUrl,policy.seriesFeeds?.[id]??policy.feed))throw new Error(`Unreviewed feed for ${agency}/${id}`);
    }
    for(const item of source.provenance ?? []) {
      if(!policies.some(policy=>matchesFeed(item.url,policy.feed)))throw new Error(`Unreviewed provenance for ${agency}: ${item.url}`);
    }
  }
  if(Object.hasOwn(snapshot,'vintageArchive')&&!Object.hasOwn(snapshot,'vintages'))throw new Error('Stored vintage archive must be hydrated before commercial-data admission');
  assertVintageData(snapshot.vintages,assertCommercialData);
}
