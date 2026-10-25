import {setTimeout as delay} from 'node:timers/promises';
import {OfficialSourceHttpError,requestText} from './http.mjs';
import {decodeHtmlText,easternFields,easternInstant} from './calendar-utils.mjs';
import {NYFED_BLS_CALENDAR_TITLE,NYFED_BLS_CALENDAR_TERMS,NYFED_BLS_CALENDAR_MODIFICATION_NOTICE,NYFED_BLS_CALENDAR_SOURCE_NOTICE,nyFedBlsCalendarAttribution,matchesNyFedBlsCalendarFeed} from '../bls-alternate-policy.mjs';

const INDEX='https://www.newyorkfed.org/research/calendars/nationalecon_cal.html';
const MAX_BYTES=2*1024*1024;
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const programs={
 'Employment Situation':{program:'employment-situation',name:'Employment Situation',seriesId:'unrate',seriesIds:['unrate','payroll','participation','wages'],topic:'Labor',path:'/news.release/empsit.toc.htm'},
 'Consumer Price Index':{program:'consumer-price-index',name:'Consumer Price Index',seriesId:'cpi',seriesIds:['cpi'],topic:'Inflation',path:'/news.release/cpi.toc.htm'},
 JOLTS:{program:'job-openings',name:'Job Openings and Labor Turnover Survey',seriesId:'openings',seriesIds:['openings'],topic:'Labor',path:'/news.release/jolts.toc.htm'},
};
const shiftMonth=(month,offset)=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1+offset,1)).toISOString().slice(0,7);
const monthEnd=month=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
const hasClass=(attributes,name)=>new RegExp(`\\bclass\\s*=\\s*["'][^"']*\\b${name}\\b[^"']*["']`,'i').test(attributes);
class UnpublishedFutureMonth extends Error{
 constructor(url){super('New York Fed future calendar returned HTTP 302 redirect to /errors/404');this.status=302;this.requestedUrl=url;}
}
function sourceUrl(value){
 if(!matchesNyFedBlsCalendarFeed(value))throw new Error('Unreviewed New York Fed calendar source URL');
 return new URL(value);
}
function pathMonth(url){
 const match=/\/i-([a-z]{3})(\d{2})\.html$/.exec(url.pathname);
 return match?`20${match[2]}-${String(months.findIndex(month=>month.slice(0,3).toLowerCase()===match[1])+1).padStart(2,'0')}`:null;
}

/** Read only the listed BLS identities, calendar dates and Eastern times. */
export function parseNyFedBlsCalendar(html,{url,expectedMonth}={}){
 const source=sourceUrl(url);
 if(typeof html!=='string')throw new Error('Invalid New York Fed calendar HTML');
 if(Buffer.byteLength(html,'utf8')>MAX_BYTES)throw new Error('New York Fed calendar exceeds the 2 MiB size limit');
 html=html.replace(/<!--[^]*?-->/g,'').replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi,'');
 const title=/<title\b[^>]*>([^]*?)<\/title>/i.exec(html);
 const introduction=[...html.matchAll(/<div\b([^>]*)>([^]*?)<\/div>/gi)].find(match=>hasClass(match[1],'ts-article-text'));
 if(!title||decodeHtmlText(title[1])!==`${NYFED_BLS_CALENDAR_TITLE} - FEDERAL RESERVE BANK of NEW YORK`||!introduction||!decodeHtmlText(introduction[2]).includes('(all Eastern Time)'))throw new Error('Unrecognized New York Fed calendar title or time zone');
 const headings=[...html.matchAll(/<td\b([^>]*)>([^]*?)<\/td>/gi)].filter(match=>hasClass(match[1],'ts-data-table-head'));
 const heading=headings.length===1?/^([A-Za-z]+) (20\d{2})$/.exec(decodeHtmlText(headings[0][2])):null;
 const monthIndex=heading?months.indexOf(heading[1]):-1;
 if(!heading||monthIndex<0)throw new Error('Unrecognized New York Fed calendar month/year header');
 const month=`${heading[2]}-${String(monthIndex+1).padStart(2,'0')}`;
 if(expectedMonth!==undefined&&expectedMonth!==month||pathMonth(source)&&pathMonth(source)!==month)throw new Error('Unexpected New York Fed calendar source month');
 const nextLinks=[...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([^]*?)<\/a>/gi)].filter(match=>decodeHtmlText(match[2])==='NEXT MONTH');
 if(nextLinks.length>1)throw new Error('Ambiguous New York Fed next-month calendar link');
 const nextUrl=nextLinks.length?sourceUrl(new URL(nextLinks[0][1],source).href).href:null;
 if(nextUrl&&pathMonth(new URL(nextUrl))!==shiftMonth(month,1))throw new Error('Nonsequential New York Fed next-month calendar link');
 const tables=[...html.matchAll(/<table\b([^>]*)>([^]*?)<\/table>/gi)].filter(match=>hasClass(match[1],'research-table-1col')&&hasClass(match[1],'greyborder'));
 if(tables.length!==1||/<table\b/i.test(tables[0][2]))throw new Error('Unrecognized New York Fed calendar table schema');
 const rows=[...tables[0][2].matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)];
 const cells=row=>[...row.matchAll(/<td\b([^>]*)>([^]*?)<\/td>/gi)];
 if(rows.length<2||cells(rows[0][1]).map(cell=>decodeHtmlText(cell[2])).join('|')!=='|Monday|Tuesday|Wednesday|Thursday|Friday|')throw new Error('Unrecognized New York Fed calendar weekday header');
 const events=[],seen=new Set(),dates=new Set();
 for(const [rowIndex,row] of rows.entries()){
  if(!rowIndex)continue;
  const columns=cells(row[1]);
  const end=monthEnd(month),lastDay=/<div\b[^>]*>\s*(\d{2})(?=\s*<)/i.exec(columns.at(-1)?.[2]??'');
  const partialEnd=rowIndex===rows.length-1&&columns.length>=2&&columns.length<=6&&lastDay?.[1]===end.slice(8)&&columns.length===new Date(`${end}T12:00:00Z`).getUTCDay()+1;
  if((columns.length!==7&&!partialEnd)||(row[1].match(/<td\b/gi)||[]).length!==columns.length||decodeHtmlText(columns[0][2])||columns.length===7&&decodeHtmlText(columns[6][2]))throw new Error('Unrecognized New York Fed calendar row schema');
  while(columns.length<7)columns.push(['','','']);
  for(let weekday=1;weekday<=5;weekday++){
   const [,_attributes,content]=columns[weekday];
   if(!decodeHtmlText(content))continue;
   const day=/^\s*<div\b[^>]*>\s*(\d{2})\s*(?:<br\s*\/?>|<\/div>)/i.exec(content);
   const date=day?`${month}-${day[1]}`:'';
   const stamp=Date.parse(`${date}T12:00:00Z`);
   if(!day||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date||new Date(stamp).getUTCDay()!==weekday||dates.has(date))throw new Error('Invalid or duplicate New York Fed calendar date or weekday cell');
   dates.add(date);
   if(decodeHtmlText(content)===day[1])continue;
   const releases=[...content.matchAll(/<span\b([^>]*)>([^]*?)<\/span>/gi)].filter(match=>hasClass(match[1],'ts-accordion-content'));
   if(releases.length!==1||/<span\b/i.test(releases[0][2]))throw new Error('Unrecognized New York Fed calendar release cell schema');
   const links=[...releases[0][2].matchAll(/<a\b([^>]*)>([^]*?)<\/a>/gi)];
   for(let index=0;index<links.length;index++){
    const link=links[index],name=decodeHtmlText(link[2]),program=Object.hasOwn(programs,name)?programs[name]:null;
    const hrefs=[...link[1].matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)];
    const knownUrl=Object.values(programs).some(item=>hrefs.some(href=>href[1]===`https://www.bls.gov${item.path}`));
    if(!program&&!knownUrl)continue;
    if(!program||hrefs.length!==1||hrefs[0][1]!==`https://www.bls.gov${program.path}`||/(?:^|\s)hidden(?:\s|=|$)/i.test(_attributes))throw new Error('Unrecognized New York Fed BLS release link identity or row');
    const following=releases[0][2].slice(link.index+link[0].length,links[index+1]?.index??releases[0][2].length);
    const clock=/^\(((?:[01]\d|2[0-3]):[0-5]\d)\)$/.exec(decodeHtmlText(following));
    if(!clock)throw new Error('Missing or invalid New York Fed BLS release time');
    const id=`bls-${program.program}-${date}`;
    if(seen.has(id))throw new Error('Duplicate or conflicting New York Fed BLS calendar event');
    seen.add(id);
    const {path:_path,...mapping}=program;
    events.push({id,sourceId:'bls',provider:'new-york-fed',...mapping,seriesIds:[...program.seriesIds],agency:'BLS',date,time:clock[1],scheduledAt:easternInstant(date,clock[1]),period:null,periodLabel:null,sourceUrl:source.href,sourceUid:null,scheduleBasis:'secondary-calendar'});
   }
  }
 }
 return {month,events:events.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.id.localeCompare(b.id)),nextUrl};
}

/** At most current + two next months, or four pages when the index lags a month. */
export async function collectNyFedBlsCalendar({fetchImpl=globalThis.fetch,now=new Date(),pause=delay}={}){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new RangeError('A valid calendar date is required');
 const currentMonth=easternFields(now.toISOString()).date.slice(0,7),planned=[0,1,2].map(offset=>shiftMonth(currentMonth,offset));
 const provenance=[];
 const read=async(url,expectedMonth,allowUnpublished=false)=>{
  sourceUrl(url);
  if(provenance.length)await pause(1000);
  const response=await requestText(url,{fetchImpl:async(requested,options)=>{
   const result=await fetchImpl(requested,{...options,redirect:'manual'});
   if(result.redirected||result.url&&result.url!==requested)throw new Error('Unexpected New York Fed calendar response URL or redirect');
   if(allowUnpublished&&result.status===302){
    let location;
    try{location=new URL(result.headers.get('location')??'',requested).href;}catch{/* Other redirects remain failures. */}
    if(location==='https://www.newyorkfed.org/errors/404'){
     await result.body?.cancel();
     throw new UnpublishedFutureMonth(requested);
    }
   }
   if(result.status>=300&&result.status<400)throw new Error('Unexpected New York Fed calendar response URL or redirect');
   if(result.ok&&result.status!==200)throw new Error('Unexpected New York Fed calendar response status');
   return result;
  },maxBytes:MAX_BYTES,timeoutMs:30000,headers:{Accept:'text/html','User-Agent':'us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)'}});
  const parsed=parseNyFedBlsCalendar(response.text,{url,expectedMonth});
  const {text:_text,...receipt}=response;
  provenance.push(receipt);
  return parsed;
 };
 let page=await read(INDEX);
 const indexMonth=page.month;
 if(indexMonth!==currentMonth){
  if(indexMonth!==shiftMonth(currentMonth,-1)||!page.nextUrl)throw new Error('New York Fed index does not provide the current month or a reviewed next-month link');
  page=await read(page.nextUrl,currentMonth);
 }
 const accepted=[page],warnings=[];
 for(const month of planned.slice(1)){
  if(!page.nextUrl){warnings.push(`New York Fed ${month} calendar has no published next-month link; coverage ends at ${monthEnd(page.month)}.`);break;}
  try {page=await read(page.nextUrl,month,true);accepted.push(page);}
  catch(error){
   const unpublished=error instanceof UnpublishedFutureMonth;
   if(!unpublished&&(!(error instanceof OfficialSourceHttpError)||error.status!==404||error.redirected))throw error;
   warnings.push(`New York Fed ${month} calendar returned ${unpublished?'HTTP 302 redirect to /errors/404':'HTTP 404'}; coverage ends at ${monthEnd(page.month)}.`);
   break;
  }
 }
 const coveredMonths=accepted.map(item=>item.month),unavailableMonths=planned.filter(month=>!coveredMonths.includes(month));
 const events=accepted.flatMap(item=>item.events).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.id.localeCompare(b.id));
 if(new Set(events.map(event=>event.id)).size!==events.length)throw new Error('Duplicate New York Fed BLS events across monthly calendars');
 const fetchedAt=provenance.at(-1).retrievedAt,coverageStart=`${currentMonth}-01`,coverageEnd=monthEnd(coveredMonths.at(-1));
 return {id:'bls',provider:'new-york-fed',agency:'BLS · calendar via New York Fed',indexMonth,events,provenance,warnings,fetchedAt,coveredMonths,unavailableMonths,coverageStart,coverageEnd,
  sourceTitle:NYFED_BLS_CALENDAR_TITLE,licenseUrl:NYFED_BLS_CALENDAR_TERMS,termsUrl:NYFED_BLS_CALENDAR_TERMS,attribution:nyFedBlsCalendarAttribution(Number(fetchedAt.slice(0,4))),modificationNotice:NYFED_BLS_CALENDAR_MODIFICATION_NOTICE,sourceNotice:NYFED_BLS_CALENDAR_SOURCE_NOTICE,
  coverageNote:`BLS Employment Situation, Consumer Price Index and JOLTS dates as listed on the New York Fed ${NYFED_BLS_CALENDAR_TITLE}, ${coverageStart} through ${coverageEnd}. Reference periods are not supplied. Dates and times are tentative and subject to change; this secondary calendar does not verify publication.`};
}
