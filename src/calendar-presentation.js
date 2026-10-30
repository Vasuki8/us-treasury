import {dataStatus,series} from './data.js';
import {getSeries} from './model.js';
import {calendarRelatedIds} from './macro-calendar.js';
import {panel,seriesLink,escapeHtml as esc} from './ui.js';
import {calendarReferenceDate,humanDate,humanTimestamp} from './ui-time.js';
const seriesIds=values=>[...new Set(values)].filter(id=>getSeries(id));
const releaseDate=humanDate;
const scheduleLinks = () => (dataStatus.calendar?.links ?? []).map(source => `<a class="action" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a>`).join('');
const calendarSourceNames = {
  bls: 'Bureau of Labor Statistics', bea: 'Bureau of Economic Analysis',
  census: 'U.S. Census Bureau, Advance Monthly Retail Trade Survey and New Residential Construction',
  dol: 'U.S. Department of Labor, Employment and Training Administration',
  treasury: 'U.S. Department of the Treasury, Bureau of the Fiscal Service',
  'treasury-auctions':'U.S. Department of the Treasury, TreasuryDirect',
  'treasury-yield-timing': 'U.S. Department of the Treasury, Office of Debt Management',
};
const relatedSeries = event => seriesIds(calendarRelatedIds(event));
const scheduledPeriod=event=>event.periodLabel||'';
const scheduleSource = event => dataStatus.calendar?.sources?.[event.sourceId];
const calendarPublisherName = (id,source={}) => source.provider==='new-york-fed' ? 'New York Fed · BLS releases' : calendarSourceNames[id] ?? source.agency ?? id;
function calendarSourceNotice(source={}) {
  if(source.provider!=='new-york-fed')return '';
  return `<p class="panel-note">${esc(source.sourceTitle)} · ${esc(source.attribution)} ${esc(source.sourceNotice)} ${esc(source.modificationNotice)} <a href="https://www.newyorkfed.org/privacy/termsofuse" target="_blank" rel="noopener noreferrer">Source terms ↗</a></p>`;
}
const scheduleBasisLabel=event=>({'recurring-rule':'Agency rule','published-exception':'Agency exception',
 'calendar-estimate':'Estimated','secondary-calendar':'NY Fed calendar'})[event.scheduleBasis]??'';
const scheduleState=event=>scheduleSource(event)?.status!=='ok'&&scheduleSource(event)?.fetchedAt
 ?'Cached schedule':scheduleBasisLabel(event)||'Scheduled';
const scheduleBasisPrefix = event => ['dol', 'treasury'].includes(event.sourceId) && scheduleBasisLabel(event) ? `${scheduleBasisLabel(event)} · ` : '';
function scheduledTime(event) {
  const instant = new Date(event.scheduledAt);
  return event.scheduledAt && Number.isFinite(instant.getTime())
    ? new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',hour12:true})
      .format(instant).toLowerCase()+' ET'
    : /^\d\d:\d\d$/.test(event.time??'')
      ? new Intl.DateTimeFormat('en-US',{timeZone:'UTC',hour:'numeric',minute:'2-digit',hour12:true})
        .format(new Date(`2000-01-01T${event.time}:00Z`)).toLowerCase()+' ET':'';
}

/** A prior reference period must also be demonstrably retained before this event. */
export function calendarPrevious(event,catalog=series){
 const reference=calendarReferenceDate(event);
 if(!reference)return null;
 const current=catalog[event.seriesId]??relatedSeries(event).map(id=>catalog[id]).find(Boolean);
 if(!current)return null;
 const before=value=>{
  if(!value||!Number.isFinite(Date.parse(value)))return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value)||!event.scheduledAt
   ?value.slice(0,10)<event.date:Date.parse(value)<Date.parse(event.scheduledAt);
 };
 const observations=current.observations.filter(row=>row.date<reference&&Number.isFinite(row.value)
  &&(row.publishedAt?before(row.publishedAt):before(current.fetchedAt)));
 const observation=observations.sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
 return observation?{series:current,observation}:null;
}
function scheduleBasisNote(event) {
  if(event.scheduleBasis==='announced-date')return 'Individually announced Treasury auction or issue/settlement date. No clock is supplied by the retained source; no timestamp has been inferred. Announcements may change and do not verify an auction result.';
  if(event.scheduleBasis==='secondary-calendar')return 'BLS release date and Eastern time listed by the Federal Reserve Bank of New York. Secondary calendar; dates and times are tentative. Observation period is not supplied and publication is not confirmed.';
  if (event.scheduleBasis === 'recurring-rule') return 'Generated from the DOL agency rule: Thursday at 08:30 Eastern Time. This future date was not individually listed and may change; check the official schedule for exceptions.';
  if (event.scheduleBasis === 'published-exception') return `The official DOL schedule lists this exception to its usual Thursday rule.${event.nominalDate ? ` Nominal Thursday: ${releaseDate(event.nominalDate)}.` : ''}`;
  if (event.scheduleBasis === 'calendar-estimate') return 'Individually listed estimate on the official Fiscal Data calendar. The date and time may change; this estimate does not confirm publication.';
  if (event.scheduleBasis === 'listed-date') return 'Individually listed date on the official agency schedule.';
  return '';
}

function yieldTimingPanel() {
  const source = dataStatus.calendar?.sources?.['treasury-yield-timing'];
  const timing = source?.fetchedAt ? source.timing : null;
  const status=timing?source.status==='ok'?'Captured timing':'Cached timing':'Timing unavailable';
  const sourceUrl = timing?.sourceUrl ?? 'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology';
  const guidance = timing
    ? `<p>Treasury par yields are usually available by <strong class="mono">${esc(timing.availableBy)} Eastern Time</strong> (6 p.m.) each trading day. Publication can be delayed.</p><p class="small muted">Ongoing guidance, independent of selected dates. This is not a dated release or confirmation of publication. Eastern Time follows EST / EDT.</p>`
    : '<p>No verified yield publication timing is available in this snapshot. Consult the official Treasury methodology.</p>';
  const metadata=`<div class="context-strip"><span class="pill">${status}</span><span>Timing source retrieved `
    +`<b class="mono">${esc(humanTimestamp(source?.fetchedAt)||'No successful retrieval')}</b></span>`
    +`<span>Last attempt <b class="mono">${esc(humanTimestamp(source?.lastAttemptAt)||'Not attempted')}</b></span></div>`
    +`<p class="small muted">${esc(calendarSourceNames['treasury-yield-timing'])} · `
    +`<a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">Official methodology ↗</a></p>`;
  const notes = `${source?.error ? `<p class="panel-note amber">${esc(source.error)}${timing ? ' · retained timing guidance may have changed.' : ''}</p>` : ''}${source?.coverageNote ? `<p class="panel-note">${esc(source.coverageNote)}</p>` : ''}${(source?.warnings ?? []).map(warning => `<p class="panel-note">${esc(warning)}</p>`).join('')}`;
  return '<div class="grid">'+panel('T','Treasury yield publication timing',
    `<div class="panel-body">${guidance}${metadata}</div>${notes}`,
    '<span class="pill">Ongoing timing</span>'+seriesLink('yield','10Y detail','link-button'),'','yield-timing')+'</div>';
}

export {releaseDate,scheduleLinks,calendarSourceNames,calendarPublisherName,calendarSourceNotice,relatedSeries,scheduledPeriod,scheduleSource,scheduleState,scheduleBasisPrefix,scheduledTime,scheduleBasisNote,yieldTimingPanel};
