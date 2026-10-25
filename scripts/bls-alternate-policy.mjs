import {easternFields,easternInstant} from './sources/calendar-utils.mjs';


export const NYFED_BLS_CALENDAR_TITLE='Economic Indicators Calendar';
export const NYFED_BLS_CALENDAR_TERMS='https://www.newyorkfed.org/privacy/termsofuse';
export const NYFED_BLS_CALENDAR_MODIFICATION_NOTICE='BLS release dates and times extracted and Eastern Time converted to UTC by Meridian. The New York Fed did not make these modifications or endorse Meridian.';
export const NYFED_BLS_CALENDAR_SOURCE_NOTICE='Dates and times are tentative and subject to change. Calendar metadata is redistributed under the New York Fed Terms of Use; those permissions, conditions and restrictions continue to apply. Underlying BLS release metadata is public domain.';
export const nyFedBlsCalendarAttribution=year=>`© ${year} Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.`;

function utcTime(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))return null;
  const time=Date.parse(value);
  return Number.isFinite(time)&&new Date(time).toISOString()===(value.includes('.')?value:value.replace('Z','.000Z'))?time:null;
}

const calendarIndex='https://www.newyorkfed.org/research/calendars/nationalecon_cal.html';
const monthNames=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const shiftMonth=(month,offset)=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1+offset,1)).toISOString().slice(0,7);
const monthEnd=month=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
const monthUrl=month=>`https://www.newyorkfed.org/research/calendars/i-${monthNames[Number(month.slice(5,7))-1]}${month.slice(2,4)}.html`;
const calendarPrograms={
  'employment-situation':{name:'Employment Situation',seriesIds:['unrate','payroll','participation','wages'],topic:'Labor'},
  'consumer-price-index':{name:'Consumer Price Index',seriesIds:['cpi'],topic:'Inflation'},
  'job-openings':{name:'Job Openings and Labor Turnover Survey',seriesIds:['openings'],topic:'Labor'},
};
const eventFields=new Set(['id','sourceId','provider','program','seriesId','seriesIds','name','agency','topic','date','time','scheduledAt','period','periodLabel','sourceUrl','sourceUid','scheduleBasis']);

export function matchesNyFedBlsCalendarFeed(value){
  try{
    const url=new URL(value);
    return url.href===value&&!url.username&&!url.password&&!url.search&&!url.hash&&url.origin==='https://www.newyorkfed.org'&&/^\/research\/calendars\/(?:nationalecon_cal|i-(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\d{2})\.html$/.test(url.pathname);
  }catch{return false;}
}

export function assertNyFedBlsCalendar(source){
  const events=Array.isArray(source?.events)?source.events:[],provenance=Array.isArray(source?.provenance)?source.provenance:[];
  const fail=()=>{throw new Error('Unreviewed New York Fed calendar scope, rights or provenance');};
  if(source?.provider!==undefined&&source.provider!=='new-york-fed'||events.some(event=>event?.provider!==undefined&&event.provider!=='new-york-fed'))fail();
  const referencesNyFed=value=>{try{return new URL(value).hostname==='www.newyorkfed.org';}catch{return false;}};
  if(source?.provider!=='new-york-fed'&&!events.some(event=>event?.provider==='new-york-fed'||referencesNyFed(event?.sourceUrl))&&!provenance.some(item=>referencesNyFed(item?.url)))return;
  if(source?.provider!=='new-york-fed')fail();
  const capturedAt=utcTime(source.fetchedAt);
  if(capturedAt===null||source.id!=='bls'||source.agency!=='BLS · calendar via New York Fed'||source.sourceTitle!==NYFED_BLS_CALENDAR_TITLE||source.termsUrl!==NYFED_BLS_CALENDAR_TERMS||source.licenseUrl!==NYFED_BLS_CALENDAR_TERMS||source.attribution!==nyFedBlsCalendarAttribution(new Date(capturedAt).getUTCFullYear())||source.modificationNotice!==NYFED_BLS_CALENDAR_MODIFICATION_NOTICE||source.sourceNotice!==NYFED_BLS_CALENDAR_SOURCE_NOTICE)fail();
  if(['description','html','content','body','image','logo','publishedAt','publicationDate','publicationConfirmed'].some(key=>Object.hasOwn(source,key)))fail();
  const currentMonth=easternFields(source.fetchedAt).date.slice(0,7),planned=[0,1,2].map(offset=>shiftMonth(currentMonth,offset));
  if(!Array.isArray(source.coveredMonths)||!source.coveredMonths.length||source.coveredMonths.length>3||source.coveredMonths.some((month,index)=>month!==planned[index])||!Array.isArray(source.unavailableMonths)||JSON.stringify(source.unavailableMonths)!==JSON.stringify(planned.slice(source.coveredMonths.length))||![currentMonth,shiftMonth(currentMonth,-1)].includes(source.indexMonth)||source.coverageStart!==`${currentMonth}-01`||source.coverageEnd!==monthEnd(source.coveredMonths.at(-1)))fail();
  const expectedUrls=new Set([calendarIndex,...source.coveredMonths.filter(month=>month!==source.indexMonth).map(monthUrl)]),receipts=new Map();
  if(!Array.isArray(source.provenance)||source.provenance.length!==expectedUrls.size)fail();
  for(const item of source.provenance){
    const retrievedAt=utcTime(item?.retrievedAt);
    if(!expectedUrls.has(item?.url)||receipts.has(item.url)||!/^[a-f0-9]{64}$/.test(item.sha256)||retrievedAt===null||retrievedAt>capturedAt)fail();
    receipts.set(item.url,item);
  }
  if(Math.max(...source.provenance.map(item=>utcTime(item.retrievedAt)))!==capturedAt||!Array.isArray(source.events)||!source.events.length)fail();
  const ids=new Set();
  for(const event of source.events){
    const program=Object.hasOwn(calendarPrograms,event?.program)?calendarPrograms[event.program]:null,month=typeof event?.date==='string'?event.date.slice(0,7):null;
    if(!program||Object.keys(event).some(key=>!eventFields.has(key))||event.id!==`bls-${event.program}-${event.date}`||ids.has(event.id)||event.sourceId!=='bls'||event.provider!=='new-york-fed'||event.agency!=='BLS'||event.name!==program.name||event.topic!==program.topic||event.seriesId!==program.seriesIds[0]||JSON.stringify(event.seriesIds)!==JSON.stringify(program.seriesIds)||event.period!==null||event.periodLabel!==null||event.sourceUid!==null||event.scheduleBasis!=='secondary-calendar'||!source.coveredMonths.includes(month)||!receipts.has(event.sourceUrl)||event.sourceUrl!==(month===source.indexMonth?calendarIndex:monthUrl(month)))fail();
    try{if(event.scheduledAt!==easternInstant(event.date,event.time))fail();}catch{fail();}
    ids.add(event.id);
  }
}

