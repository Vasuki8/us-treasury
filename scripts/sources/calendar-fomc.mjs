import {requestText} from './http.mjs';
import {decodeHtmlText,easternFields} from './calendar-utils.mjs';
export const FOMC_CALENDAR_URL='https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
const origin='https://www.federalreserve.gov';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const fail=message=>{throw new Error(`Invalid FOMC calendar: ${message}`);};
function dateKey(year,month,day){const date=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;if(!Number.isInteger(year)||!Number.isInteger(month)||!Number.isInteger(day)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)fail('meeting date');return date;}
function namedDate(value){const match=/^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})$/.exec(value);if(!match)fail('minutes release date');return dateKey(Number(match[3]),months.indexOf(match[1])+1,Number(match[2]));}
const mapping={seriesId:'policyTargetUpper',seriesIds:['policyTargetUpper','policyTargetLower'],topic:'Policy'};
function event(program,date,name,extra={}){return {id:`${program}-${date}`,sourceId:'fomc',program,...mapping,name,agency:'Federal Reserve',date,time:null,scheduledAt:null,datePrecision:'day',period:null,periodLabel:null,sourceUrl:FOMC_CALENDAR_URL,scheduleBasis:'listed-date',...extra};}

/** Factual meeting dates and official document references; no 14:00 time or 21-day minutes dates are inferred. */
export function parseFomcCalendar(html,{years}={}){
  if(typeof html!=='string'||Buffer.byteLength(html)>2*1024*1024)fail('framing or byte limit');
  if(!Array.isArray(years)||!years.length||new Set(years).size!==years.length||years.some(year=>!Number.isInteger(year)||year<2021||year>2100))fail('reviewed years');
  const clean=html.replace(/<!--[^]*?-->/g,'').replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi,'');
  const headings=[...clean.matchAll(/(?:^|>)(\d{4}) FOMC Meetings</g)];
  const events=[],documents=[],seen=new Set();
  for(const year of years){
    const chosen=headings.filter(match=>Number(match[1])===year);
    if(chosen.length!==1)fail(`missing or duplicate year ${year}`);
    const head=chosen[0],next=headings.find(match=>match.index>head.index),section=clean.slice(head.index,next?.index??clean.length);
    const rows=[...section.matchAll(/<div\b[^>]*class="[^"\n]*\bfomc-meeting(?:\s|"|$)[^>]*>/g)];
    if(!rows.length||rows.length>16)fail('missing or excess meeting rows');
    for(let i=0;i<rows.length;i++){
      const block=section.slice(rows[i].index,rows[i+1]?.index??section.length);
      const field=name=>decodeHtmlText(block.match(new RegExp(`<div\\b[^>]*class="[^"]*fomc-meeting__${name}\\b[^"]*"[^>]*>([^]*?)<\\/div>`))?.[1]??'');
      const month=field('month'),days=field('date'),parts=/^(\d{1,2})(?:-(\d{1,2}))?(\*)?$/.exec(days);
      if(!months.includes(month)||!parts)fail('meeting month or day range');
      const startDate=dateKey(year,months.indexOf(month)+1,Number(parts[1])),date=dateKey(year,months.indexOf(month)+1,Number(parts[2]??parts[1]));
      if(startDate>date||seen.has(date))fail('duplicate or reversed meeting dates');seen.add(date);
      const projections=Boolean(parts[3]);
      events.push(event('fomc-decision',date,`FOMC meeting decision${projections?' · projections meeting':''}`,{meetingStartDate:startDate,meetingDate:date,projectionsAssociated:projections}));
      let minutesUrl=null;
      for(const match of block.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^]*?)<\/a>/g)){
        const raw=match[1];
        if(!/(?:monetary\d{8}a\.htm|fomcminutes\d{8}\.htm|fomcprojtabl\d{8}\.htm)$/.test(raw))continue;
        const url=new URL(raw,origin);
        if(url.origin!==origin||url.search||url.hash||url.username||url.password)fail('unreviewed document source link');
        const matched=/^(?:\/newsevents\/pressreleases\/monetary(\d{8})a|\/monetarypolicy\/fomc(minutes|projtabl)(\d{8}))\.htm$/.exec(url.pathname);
        if(!matched)fail('unreviewed document path');
        const code=matched[1]??matched[3],documentDate=`${code.slice(0,4)}-${code.slice(4,6)}-${code.slice(6,8)}`;
        if(documentDate!==date)fail('document and meeting date mismatch');
        const kind=matched[1]?'decision':matched[2]==='minutes'?'minutes':'projections';
        if(kind==='projections'&&!projections)fail('projection link without associated meeting marker');
        if(documents.some(row=>row.kind===kind&&row.meetingDate===date))fail('duplicate document reference');
        if(kind==='minutes')minutesUrl=url.href;
        documents.push({kind,meetingDate:date,documentDate:kind==='minutes'?null:date,url:url.href,sourceUrl:FOMC_CALENDAR_URL,datePrecision:'day',publicationEvidence:'Official calendar document reference; the linked document contents have not been captured or parsed.'});
      }
      const released=[...decodeHtmlText(block).matchAll(/\(Released ([A-Za-z]+ \d{1,2}, \d{4})\)/g)];
      if(released.length>1||minutesUrl&&!released.length||released.length&&!minutesUrl)fail('minutes reference or explicit release date');
      if(released.length){
        const releaseDate=namedDate(released[0][1]);
        if(releaseDate<date)fail('minutes release precedes meeting');
        documents.find(row=>row.kind==='minutes'&&row.meetingDate===date).documentDate=releaseDate;
        events.push(event('fomc-minutes',releaseDate,'FOMC minutes',{meetingDate:date,documentUrl:minutesUrl}));
      }
    }
  }
  return {events:events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)),documents:documents.sort((a,b)=>a.meetingDate.localeCompare(b.meetingDate)||a.kind.localeCompare(b.kind)),coveredYears:[...years].sort()};
}

export async function collectFomcCalendar({fetchImpl=globalThis.fetch,now=new Date()}={}){
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))fail('capture date');
  const year=Number(easternFields(now.toISOString()).date.slice(0,4));
  const response=await requestText(FOMC_CALENDAR_URL,{maxBytes:2*1024*1024,fetchImpl:async(url,options)=>{const result=await fetchImpl(url,options);if(result.redirected||result.url&&result.url!==url)fail('unreviewed source redirect');return result;}});
  const cleaned=response.text.replace(/<!--[^]*?-->/g,'').replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi,'');
  const followingYear=new RegExp(`(?:^|>)${year+1} FOMC Meetings<`).test(cleaned),years=followingYear?[year,year+1]:[year];
  const result=parseFomcCalendar(response.text,{years}),{text,...provenance}=response;
  return {id:'fomc',agency:'Board of Governors of the Federal Reserve System',...result,fetchedAt:response.retrievedAt,provenance:[provenance],coverageNote:'Official listed FOMC meeting end dates and explicitly dated minutes references for the current year and, when published, the following year. Date precision is day; no release hour is inferred. Projection-associated meetings and dated official decision/minutes/projection links are retained separately from numeric market expectations. Linked documents have not been captured as verified publication results.',warnings:['Meeting dates can change. Links and calendar dates are distinct from captured decision or projection contents and do not establish an exact publication instant.',...(!followingYear?[`The following year (${year+1}) is not listed in this capture; no dates are generated.`]:[])]};
}
