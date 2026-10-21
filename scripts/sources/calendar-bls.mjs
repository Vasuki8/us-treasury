import { requestText } from './http.mjs';
import { decodeHtmlText, easternFields, easternInstant } from './calendar-utils.mjs';
import { setTimeout as delay } from 'node:timers/promises';

const MAX_BYTES=2*1024*1024;
const annual=year=>`https://www.bls.gov/schedule/${year}/home.htm`;
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const programs={
  'Employment Situation':{program:'employment-situation',seriesId:'unrate',seriesIds:['unrate','payroll','participation','wages'],topic:'Labor'},
  'Consumer Price Index':{program:'consumer-price-index',seriesId:'cpi',seriesIds:['cpi'],topic:'Inflation'},
  'Job Openings and Labor Turnover Survey':{program:'job-openings',seriesId:'openings',seriesIds:['openings'],topic:'Labor'},
};

function dateField(text,year) {
  const match=/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), ([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(text);
  const month=match?months.indexOf(match[2]):-1;
  if (!match || month<0 || Number(match[4])!==year) throw new Error('Invalid BLS calendar date or source year');
  const date=`${match[4]}-${String(month+1).padStart(2,'0')}-${match[3].padStart(2,'0')}`;
  const parsed=new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10)!==date || weekdays[parsed.getUTCDay()]!==match[1]) throw new Error('Invalid BLS calendar date or weekday');
  return date;
}

function timeField(text) {
  const match=/^(0[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(text);
  if (!match) throw new Error('Invalid BLS release time');
  return `${String(Number(match[1])%12+(match[3]==='PM'?12:0)).padStart(2,'0')}:${match[2]}`;
}

/** Bounded reader for BLS annual release-list tables; unrelated programs are excluded. */
export function parseBlsCalendar(html,{year}={}) {
  if (!Number.isInteger(year) || year<2000 || year>2100) throw new Error('Invalid BLS source year');
  if (typeof html!=='string') throw new Error('Invalid BLS calendar HTML');
  if (Buffer.byteLength(html,'utf8')>MAX_BYTES) throw new Error('BLS calendar exceeds the 2 MiB size limit');
  const title=/<title\b[^>]*>([^]*?)<\/title>/i.exec(html);
  if (!title || decodeHtmlText(title[1])!==`Schedule of Selected Releases ${year}` || !/All times on calendar are Eastern Time\./.test(decodeHtmlText(html))) throw new Error('Unrecognized BLS annual calendar or source year/time zone');
  const tables=[...html.matchAll(/<table\b(?=[^>]*\bclass\s*=\s*["'][^"']*\brelease-list\b[^"']*["'])([^>]*)>([^]*?)<\/table>/gi)];
  if (!tables.length) throw new Error('Unrecognized BLS calendar table schema');
  const events=[],ids=new Set();
  for (const table of tables) {
    const header=/<thead\b[^>]*>([^]*?)<\/thead>/i.exec(table[2]);
    const body=/<tbody\b[^>]*>([^]*?)<\/tbody>/i.exec(table[2]);
    const labels=header?[...header[1].matchAll(/<th\b[^>]*>([^]*?)<\/th>/gi)].map(match=>decodeHtmlText(match[1])):[];
    if (!body || labels.join('|')!=='Date|Time|Release') throw new Error('Unrecognized BLS calendar header/body schema');
    for (const match of body[1].matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)) {
      const cells=[...match[1].matchAll(/<td\b([^>]*)>([^]*?)<\/td>/gi)];
      const strong=cells[2]?/<strong\b[^>]*>([^]*?)<\/strong>/i.exec(cells[2][2]):null;
      const name=strong?decodeHtmlText(strong[1]):'';
      if (!Object.hasOwn(programs,name)) continue;
      if (cells.length!==3 || !['date-cell','time-cell','desc-cell'].every((label,index)=>new RegExp(`\\bclass\\s*=\\s*["'][^"']*\\b${label}\\b[^"']*["']`,'i').test(cells[index][1]))) throw new Error('Unrecognized BLS release row schema');
      const date=dateField(decodeHtmlText(cells[0][2]),year);
      const time=timeField(decodeHtmlText(cells[1][2]));
      const description=decodeHtmlText(cells[2][2]);
      const periodLabel=description.startsWith(`${name} for `)?description.slice(name.length+5):'';
      const reference=/^([A-Za-z]+) (\d{4})$/.exec(periodLabel);
      if (!reference || !months.includes(reference[1])) throw new Error('Missing or invalid explicit BLS reference period');
      const program=programs[name];
      const id=`bls-${program.program}-${periodLabel.toLowerCase().replaceAll(' ','-')}`;
      if (ids.has(id)) throw new Error(`Duplicate BLS release reference period: ${id}`);
      ids.add(id);
      events.push({id,sourceId:'bls',...program,seriesIds:[...program.seriesIds],name,agency:'BLS',date,time,scheduledAt:easternInstant(date,time),period:null,periodLabel,sourceUrl:annual(year),sourceUid:null});
    }
  }
  if (!events.length) throw new Error('No matching BLS schedule events or usable coverage');
  return events.sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.id.localeCompare(b.id));
}

export async function collectBlsCalendar({fetchImpl=globalThis.fetch,now=new Date(),pause=delay}={}) {
  const year=Number(easternFields(now.toISOString()).date.slice(0,4));
  const read=async sourceYear=>{
    const response=await requestText(annual(sourceYear),{fetchImpl,maxBytes:MAX_BYTES,headers:{Accept:'text/html','User-Agent':'us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)'}});
    if (response.url!==annual(sourceYear)) throw new Error('Unexpected BLS calendar source URL or redirect');
    const events=parseBlsCalendar(response.text,{year:sourceYear});
    const {text:_text,...provenance}=response;
    return {events,provenance};
  };
  // BLS asks bots to identify their owner and avoid excessive requests: /bls/blsterms.htm.
  const accepted=[await read(year)];
  await pause(1000);
  const failedYears=[],warnings=[];
  try { accepted.push(await read(year+1)); }
  catch(error) {
    failedYears.push(year+1);
    warnings.push(`BLS ${year+1} annual calendar unavailable: ${error.message}. Current-year schedule retained; previously captured next-year coverage must remain marked stale.`);
  }
  const events=accepted.flatMap(result=>result.events).sort((a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.id.localeCompare(b.id));
  if (new Set(events.map(event=>event.id)).size!==events.length) throw new Error('Duplicate BLS release period across annual schedules');
  const coverage=Object.keys(programs).map(name=>{
    const rows=events.filter(event=>event.name===name);
    return `${name}: ${rows.length?`through ${rows.at(-1).date}`:'no published dates in the retrieved calendars'}`;
  }).join('; ');
  const provenance=accepted.map(result=>result.provenance);
  return {id:'bls',agency:'U.S. Bureau of Labor Statistics',events,provenance,warnings,
    coverageNote:`Official BLS annual schedules; ${coverage}. ${failedYears.length?`${year+1} calendar unavailable. `:''}Dates can change; coverage differs by release program.`,
    fetchedAt:provenance.at(-1).retrievedAt,coveredYears:failedYears.length?[year]:[year,year+1],failedYears};
}
