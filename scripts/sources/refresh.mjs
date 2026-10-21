import { easternFields } from './calendar-utils.mjs';
import { assertCommercialData } from '../data-policy.mjs';

const calendarLinks=[{name:'BLS release calendar',url:'https://www.bls.gov/schedule/'},{name:'BEA release schedule',url:'https://www.bea.gov/news/schedule/'},{name:'Census release schedule',url:'https://www.census.gov/economic-indicators/calendar-listview.html'},{name:'DOL claims release information',url:'https://oui.doleta.gov/unemploy/archive.asp'}];
const calendarCoverage='Captured schedules cover Employment Situation, CPI, JOLTS, national GDP and Personal Income and Outlays. Census retail, DOL claims and Treasury publication schedules are not ingested. Dates can change; a scheduled time does not confirm publication or results.';

function validateCalendar(id,result) {
  if(!result||result.id!==id||!Array.isArray(result.events)||result.events.length>2000||!Number.isFinite(Date.parse(result.fetchedAt))||!result.provenance?.length)throw new Error(`Invalid official calendar response for ${id}`);
  const seen=new Set();
  for(const event of result.events) {
    if(seen.has(event.id)||typeof event.name!=='string'||!event.name.trim()||event.name.length>1000)throw new Error(`Invalid or duplicate calendar event for ${id}`);
    seen.add(event.id);
    const fields=easternFields(event.scheduledAt);
    if(fields.date!==event.date||fields.time!==event.time)throw new Error(`Invalid calendar Eastern date/time for ${id}`);
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
      sources[id]={...result,status:'ok',lastAttemptAt:checkedAt,error:null};
    } catch(error) {
      const prior=sources[id];
      sources[id]={...(prior??{id,events:[],fetchedAt:null,provenance:[],warnings:[]}),status:prior?.fetchedAt?'error':'unavailable',lastAttemptAt:checkedAt,error:String(error.message||error)};
    }
  }));
  const values=Object.values(sources),success=values.some(source=>source.status==='ok'),captured=values.some(source=>source.fetchedAt);
  const complete=['bls','bea'].every(id=>sources[id]?.status==='ok'&&!sources[id]?.failedYears?.length);
  const status=complete?'ok':success?'partial':captured?'error':'unavailable';
  return {status,message:calendarCoverage,sources,links:calendarLinks,checkedAt};
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

export async function refreshSnapshot({previous={},collectors={},calendarCollectors={},now=new Date()}={}) {
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
  const calendar=await calendarPromise;
  const releases=Object.values(calendar.sources??{}).flatMap(source=>source.events??[]).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.id.localeCompare(b.id));
  const generatedAt=new Date(Math.max(Date.now(),Date.parse(checkedAt),...[...Object.values(sources),...Object.values(calendar.sources??{})].map(source=>Date.parse(source.fetchedAt)||0))).toISOString();
  return {schemaVersion:1,generatedAt,checkedAt,sources,releases,calendar};
}
