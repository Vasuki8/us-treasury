import { requestText } from './http.mjs';
import { decodeHtmlText, easternFields, easternInstant } from './calendar-utils.mjs';

const MAX_BYTES=2*1024*1024;
const canonical='https://www.census.gov/economic-indicators/calendar-listview.html';
const name='Advance Monthly Sales for Retail and Food Services';
const credit='U.S. Census Bureau, Advance Monthly Retail Trade Survey';
const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
const order=(a,b)=>a.scheduledAt.localeCompare(b.scheduledAt)||a.id.localeCompare(b.id);

function calendarHtml(html) {
  if(typeof html!=='string') throw new Error('Invalid Census calendar HTML');
  if(Buffer.byteLength(html,'utf8')>MAX_BYTES) throw new Error('Census calendar exceeds the 2 MiB size limit');
  return html.replace(/<!--[^]*?-->/g,' ').replace(/<(script|style)\b[^>]*>[^]*?<\/\1\s*>/gi,' ');
}

function calendarYear(html) {
  const headings=[...html.matchAll(/<h3\b[^>]*>([^]*?)<\/h3>/gi)].map(match=>decodeHtmlText(match[1]));
  const titles=headings.map(text=>/^US Census Bureau: (\d{4}) Economic Indicator Release Schedule: List View$/.exec(text)).filter(Boolean);
  if(titles.length!==1) throw new Error('Unrecognized Census annual calendar heading or source year');
  return Number(titles[0][1]);
}

function sourceAddress(sourceUrl,year) {
  if(sourceUrl!==canonical && sourceUrl!==`https://www.census.gov/economic-indicators/calendar-listview-${year}.html`) throw new Error('Unexpected Census calendar source URL');
  return sourceUrl;
}

function hidden(attributes) {
  return /\bhidden(?:\s|=|$)|\bclass\s*=\s*["'][^"']*\b(?:hiden|hidden)\b|\bstyle\s*=\s*["'][^"']*display\s*:\s*none/i.test(attributes);
}

function dateField(text,year) {
  const match=/^([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(text);
  const month=match?months.indexOf(match[1]):-1;
  if(!match || month<0 || Number(match[3])!==year) throw new Error('Invalid Census release date or source year');
  const date=`${match[3]}-${String(month+1).padStart(2,'0')}-${match[2].padStart(2,'0')}`;
  // The shared converter validates the complete date and the actual Eastern offset.
  easternInstant(date,'08:30');
  return date;
}

function timeField(text) {
  const match=/^(0?[1-9]|1[0-2]):([0-5]\d) (AM|PM)$/.exec(text);
  if(!match) throw new Error('Invalid Census release time');
  return `${String(Number(match[1])%12+(match[3]==='PM'?12:0)).padStart(2,'0')}:${match[2]}`;
}

/** Extract only factual advance-retail metadata from the official annual table. */
export function parseCensusCalendar(input,{year,sourceUrl}={}) {
  if(!Number.isInteger(year)||year<2000||year>2100) throw new Error('Invalid Census calendar source year');
  sourceAddress(sourceUrl,year);
  const html=calendarHtml(input);
  if(calendarYear(html)!==year) throw new Error('Unexpected Census calendar source year');
  const tables=[...html.matchAll(/<table\b(?=[^>]*\bid\s*=\s*["']calendar["'])([^>]*)>([^]*?)<\/table>/gi)];
  if(tables.length!==1) throw new Error('Unrecognized Census calendar table schema');
  const table=tables[0][2];
  const rows=[...table.matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)];
  if(rows.length!==(table.match(/<tr\b/gi)||[]).length) throw new Error('Malformed Census calendar row schema');
  const header=rows[0]?.[1]||'';
  const labels=[...header.matchAll(/<th\b([^>]*)>([^]*?)<\/th>/gi)];
  if(labels.length!==4 || labels.some(cell=>hidden(cell[1])) || labels.map(cell=>decodeHtmlText(cell[2])).join('|')!=='Indicator|Release Date|Time|Period Covered') throw new Error('Unrecognized Census calendar header schema');
  const events=[],warnings=[],ids=new Set();
  let selected=0;
  for(const row of rows.slice(1)) {
    const cells=[...row[1].matchAll(/<td\b([^>]*)>([^]*?)<\/td>/gi)];
    const title=cells[0]?decodeHtmlText(cells[0][2]):'';
    const titleLink=cells[0]?/<a\b[^>]*>([^]*?)<\/a>/i.exec(cells[0][2]):null;
    if(title!==name && (!titleLink || decodeHtmlText(titleLink[1])!==name)) continue;
    selected++;
    if(title!==name || cells.length<4 || cells.length>6 || cells.length!==(row[1].match(/<td\b/gi)||[]).length || cells.slice(0,4).some(cell=>hidden(cell[1])) || cells.slice(4).some(cell=>!hidden(cell[1]))) throw new Error('Malformed Census selected release row schema');
    const periodLabel=decodeHtmlText(cells[3][2]);
    const reference=/^([A-Za-z]+) (\d{4})$/.exec(periodLabel);
    if(!reference || !months.includes(reference[1]) || Number(reference[2])<2000 || Number(reference[2])>2100) throw new Error('Invalid or missing explicit Census reference period');
    const id=`census-retail-sales-${periodLabel.toLowerCase().replaceAll(' ','-')}`;
    if(ids.has(id)) throw new Error(`Duplicate Census release program/reference period: ${id}`);
    ids.add(id);
    const dateText=decodeHtmlText(cells[1][2]);
    if(/^(?:Suspended|TBA|TBD|To be (?:announced|determined)(?: at a later date)?)\.?$/i.test(dateText)) {
      warnings.push(`Census ${name}, ${periodLabel}: ${dateText}; no dated event published from this row.`);
      continue;
    }
    const date=dateField(dateText,year),time=timeField(decodeHtmlText(cells[2][2]));
    events.push({id,sourceId:'census',program:'retail-sales',name,agency:'Census',seriesId:'retail',seriesIds:['retail'],topic:'Growth',date,time,
      scheduledAt:easternInstant(date,time),period:null,periodLabel,sourceUrl,sourceUid:null,scheduleBasis:'listed-date'});
  }
  if(!selected) throw new Error('No matching Census retail releases or usable calendar coverage');
  return {events:events.sort(order),warnings};
}

export async function collectCensusCalendar({fetchImpl=globalThis.fetch,now=new Date()}={}) {
  const currentYear=Number(easternFields(now.toISOString()).date.slice(0,4));
  const read=async(sourceUrl,year)=>{
    const response=await requestText(sourceUrl,{fetchImpl,maxBytes:MAX_BYTES,headers:{Accept:'text/html'}});
    if(response.url!==sourceUrl) throw new Error('Unexpected Census calendar source URL or redirect');
    const html=calendarHtml(response.text),actualYear=calendarYear(html);
    if(year!==undefined && actualYear!==year) throw new Error('Unexpected Census archive calendar year');
    const parsed=parseCensusCalendar(html,{year:actualYear,sourceUrl});
    const {text:_text,...provenance}=response;
    return {...parsed,html,year:actualYear,provenance};
  };
  const latest=await read(canonical);
  if(latest.year!==currentYear && latest.year!==currentYear+1) throw new Error('Stale or unexpected Census canonical calendar year');
  const sources=[latest];
  if(latest.year===currentYear+1) {
    const expected=`https://www.census.gov/economic-indicators/calendar-listview-${currentYear}.html`;
    const published=[...latest.html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi)].some(match=>{
      try{return new URL(decodeHtmlText(match[1]),canonical).href===expected;}catch{return false;}
    });
    if(!published) throw new Error('Census current-year archive link missing or unsafe after calendar rollover');
    sources.push(await read(expected,currentYear));
  }
  const events=sources.flatMap(source=>source.events).sort(order);
  if(new Set(events.map(event=>event.id)).size!==events.length) throw new Error('Duplicate Census release reference period across calendar years');
  const warnings=sources.flatMap(source=>source.warnings);
  if(latest.year===currentYear) warnings.push(`Census ${currentYear+1} calendar is not yet published in the current annual calendar; no dates are inferred.`);
  if(!events.some(event=>Date.parse(event.scheduledAt)>=now.getTime())) warnings.push('The Census calendar contains no upcoming mapped retail releases; check the official schedule for new dates.');
  const provenance=sources.map(source=>source.provenance);
  return {id:'census',agency:credit,events,provenance,warnings,fetchedAt:provenance.at(-1).retrievedAt,
    coveredYears:sources.map(source=>source.year).sort((a,b)=>a-b),
    coverageNote:`${credit}: official annual release calendar for ${name}${events.length?`, through ${events.at(-1).date}`:''}. Only explicitly dated releases are included. Times are Eastern; dates can change. Calendar records do not establish publication of statistical results.`};
}
