import { easternFields } from './calendar-utils.mjs';
import { assertCommercialData } from '../data-policy.mjs';
import { OfficialSourceHttpError } from './http.mjs';
import { recordVintages } from '../../src/vintages.js';
import { registry } from '../../src/registry.js';
import {isIsoDate} from '../../src/date-window.js';
import {harmonizeTreasuryYieldHistory} from './treasury.mjs';

const calendarLinks=[{name:'BLS release calendar',url:'https://www.bls.gov/schedule/'},{name:'BEA release schedule',url:'https://www.bea.gov/news/schedule/'},{name:'Census release schedule',url:'https://www.census.gov/economic-indicators/calendar-listview.html'},{name:'DOL claims release schedule',url:'https://oui.doleta.gov/unemploy/claims_arch.asp'},{name:'Treasury Fiscal Data release calendar',url:'https://fiscaldata.treasury.gov/release-calendar/'},{name:'Treasury yield publication timing',url:'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology'}];
const calendarCoverage='Schedules cover Employment Situation, CPI, JOLTS, national GDP, Personal Income and Outlays, Census advance retail sales and New Residential Construction, DOL weekly claims and Treasury Debt to the Penny. Treasury debt entries retain the agency calendar\'s estimated dates and times. Treasury yield publication timing appears separately as ongoing guidance when a verified capture is available; it adds no dated events. DOL dates expand its published Thursday rule and explicit holiday exceptions within a 90-day upcoming window. Auctions are not ingested. Dates can change; a scheduled time does not confirm publication or results.';

export function validateCalendarEventTiming(id,event) {
  if(id==='fomc'){
    if(event.sourceId!=='fomc'||!isIsoDate(event.date)||event.datePrecision!=='day'||event.time!==null||event.scheduledAt!==null)throw new Error('Invalid date-only FOMC date/time precision');
    return;
  }
  const fields=easternFields(event.scheduledAt);
  if(fields.date!==event.date||fields.time!==event.time)throw new Error(`Invalid calendar Eastern date/time for ${id}`);
}

function validateCalendar(id,result) {
  if(!result||result.id!==id||!Array.isArray(result.events)||result.events.length>2000||!Number.isFinite(Date.parse(result.fetchedAt))||!result.provenance?.length)throw new Error(`Invalid official calendar response for ${id}`);
  const seen=new Set();
  for(const event of result.events) {
    if(seen.has(event.id)||typeof event.name!=='string'||!event.name.trim()||event.name.length>1000)throw new Error(`Invalid or duplicate calendar event for ${id}`);
    seen.add(event.id);
    validateCalendarEventTiming(id,event);
    if(['actual','consensus','forecast','publishedAt'].some(key=>Object.hasOwn(event,key)))throw new Error('Calendar schedules cannot establish publication results');
  }
  assertCommercialData({calendar:{sources:{[id]:result}},releases:result.events});
}

async function refreshCalendar(previous,collectors,checkedAt,now) {
  if(!Object.keys(collectors).length)return previous??{status:'unavailable',message:'Release schedules have not been ingested. Follow the official release schedules for publication dates.',sources:{},links:calendarLinks};
  const sources={...previous?.sources};
  await Promise.all(Object.entries(collectors).map(async([id,collect])=>{
    try {
      const result=await collect({now});validateCalendar(id,result);
      if(result.failedYears?.some(year=>sources[id]?.coveredYears?.includes(year)))throw new Error(`Calendar refresh could not replace previously captured year(s): ${result.failedYears.join(', ')}. Retained the last successful agency schedule.`);
      sources[id]={...result,status:'ok',lastAttemptAt:checkedAt,error:null,failure:null};
    } catch(error) {
      const prior=sources[id];
      const failure=error instanceof OfficialSourceHttpError?{kind:'http',status:error.status,requestedUrl:error.requestedUrl,url:error.url,redirected:error.redirected}:null;
      sources[id]={...(prior??{id,events:[],fetchedAt:null,provenance:[],warnings:[]}),status:prior?.fetchedAt?'error':'unavailable',lastAttemptAt:checkedAt,error:String(error.message||error),failure};
    }
  }));
  const values=Object.values(sources),success=values.some(source=>source.status==='ok'),captured=values.some(source=>source.fetchedAt);
  const complete=['bls','bea','census','dol','treasury','treasury-yield-timing'].every(id=>sources[id]?.status==='ok'&&!sources[id]?.failedYears?.length);
  const status=complete?'ok':success?'partial':captured?'error':'unavailable';
  return {status,message:calendarCoverage,sources,links:calendarLinks,checkedAt};
}

export function canPublishCachedBls(source,now) {
  const failure=source?.failure;
  const year=Number(easternFields(now.toISOString()).date.slice(0,4));
  const annualUrls=[year,year+1].map(value=>`https://www.bls.gov/schedule/${value}/home.htm`);
  if(source?.status!=='error'||failure?.kind!=='http'||failure.status!==403||failure.redirected!==false||!annualUrls.includes(failure.requestedUrl)||failure.url!==failure.requestedUrl||!source.events?.length||Date.parse(source.fetchedAt)>now.getTime())return false;
  try {validateCalendar('bls',source);return true;}
  catch {return false;}
}
function validate(result,cutoff) {
  if(!result || !result.series || !Object.keys(result.series).length)throw new Error('Official source returned no series');
  for(const [id,series] of Object.entries(result.series)) {
    if(!Array.isArray(series.observations)||!series.observations.length)throw new Error(`No official observations for ${id}`);
    let previous='';
    for(const {date,value} of series.observations) {
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<=previous||date>cutoff || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw new Error(`Invalid or duplicate official date for ${id}`);
      if(value!==null && (typeof value!=='number'||!Number.isFinite(value)))throw new Error(`Invalid official value for ${id}`);
      previous=date;
    }
    if(!series.observations.some(o=>typeof o.value==='number'&&Number.isFinite(o.value)))throw new Error(`No numeric official observations for ${id}`);
  }
}

export async function refreshSnapshot({previous={},collectors={},calendarCollectors={},now=new Date(),requireAll=false,allowCachedBlsCalendar=false}={}) {
  if(requireAll&&allowCachedBlsCalendar)throw new Error('requireAll and allowCachedBlsCalendar are mutually exclusive');
  const checkedAt=now.toISOString(),sources={...previous.sources};
  const calendarPromise=refreshCalendar(previous.calendar,calendarCollectors,checkedAt,now);
  await Promise.all(Object.entries(collectors).map(async([id,collect])=>{
    try {
      const result=await collect({now});validate(result,checkedAt.slice(0,10));
      sources[id]={...result,status:'ok',lastAttemptAt:checkedAt,error:null};
    } catch(error) {
      const prior=sources[id];
      sources[id]={...(prior||{id,series:{},fetchedAt:null,provenance:[],warnings:[]}),status:prior?.fetchedAt?'error':'unavailable',lastAttemptAt:checkedAt,error:String(error.message||error)};
    }
  }));
  // A partial refresh must not replace the retained main 10Y history with only
  // this year's rows. Actual per-row capture times choose overlapping values.
  if((Object.hasOwn(collectors,'treasury')||Object.hasOwn(collectors,'yields'))&&sources.treasury?.series?.yield&&sources.yields?.curveHistory?.length){
    try{
      const harmonized=harmonizeTreasuryYieldHistory(sources.treasury,sources.yields,{previousTreasury:previous.sources?.treasury});
      validate(harmonized,checkedAt.slice(0,10));
      assertCommercialData({sources:{treasury:harmonized}});
      sources.treasury=harmonized;
    }catch(error){
      const prior=previous.sources?.treasury;
      sources.treasury={...(prior??{id:'treasury',series:{},fetchedAt:null,provenance:[],warnings:[]}),status:prior?.fetchedAt?'error':'unavailable',lastAttemptAt:checkedAt,error:`Treasury 10Y history reconciliation failed: ${String(error.message||error)}`};
    }
  }
  const calendar=await calendarPromise;
  const cachedCalendarSources=allowCachedBlsCalendar&&Object.hasOwn(calendarCollectors,'bls')&&canPublishCachedBls(calendar.sources.bls,now)?['bls']:[];
  if(requireAll||allowCachedBlsCalendar) {
    const failures=[
      ...Object.keys(collectors).filter(id=>sources[id]?.status!=='ok').map(id=>`${id}: ${sources[id]?.error||'Source did not refresh successfully'}`),
      ...Object.keys(calendarCollectors).filter(id=>calendar.sources[id]?.status!=='ok'&&!cachedCalendarSources.includes(id)).map(id=>`${id} calendar: ${calendar.sources[id]?.error||'Schedule did not refresh successfully'}`),
    ];
    if(failures.length)throw new Error(`Required official refresh failed; snapshot was not replaced. ${failures.join('; ')}`);
  }
  const releases=Object.values(calendar.sources??{}).flatMap(source=>source.events??[]).sort((a,b)=>(a.scheduledAt??a.date).localeCompare(b.scheduledAt??b.date)||a.id.localeCompare(b.id));
  const generatedAt=new Date(Math.max(Date.now(),Date.parse(checkedAt),...[...Object.values(sources),...Object.values(calendar.sources??{})].map(source=>Date.parse(source.fetchedAt)||0))).toISOString();
  const publicationPolicy=allowCachedBlsCalendar?{mode:'allow-cached-bls-calendar',cachedCalendarSources}:Object.keys(calendarCollectors).length===0?previous.publicationPolicy:null;
  const seriesMetadata=Object.fromEntries(Object.entries(registry).map(([id,metadata])=>[id,{...metadata,observationType:metadata.observationType??'official'}]));
  const vintages=recordVintages(previous.vintages,previous.sources,sources,{checkedAt:generatedAt,seriesMetadata});
  return {schemaVersion:1,generatedAt,checkedAt,sources,releases,calendar,vintages,...(publicationPolicy?{publicationPolicy}:{})};
}
