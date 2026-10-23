import {dataStatus} from './data.js';
import {getSeries} from './model.js';
import {calendarRelatedIds} from './macro-calendar.js';
import {panel,seriesLink,escapeHtml as esc} from './ui.js';
const seriesIds=values=>[...new Set(values)].filter(id=>getSeries(id));
const releaseDate = date => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const scheduleLinks = () => (dataStatus.calendar?.links ?? []).map(source => `<a class="action" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a>`).join('');
const calendarSourceNames = {
  bls: 'Bureau of Labor Statistics', bea: 'Bureau of Economic Analysis',
  census: 'U.S. Census Bureau, Advance Monthly Retail Trade Survey and New Residential Construction',
  dol: 'U.S. Department of Labor, Employment and Training Administration',
  treasury: 'U.S. Department of the Treasury, Bureau of the Fiscal Service',
  'treasury-yield-timing': 'U.S. Department of the Treasury, Office of Debt Management',
};
const relatedSeries = event => seriesIds(calendarRelatedIds(event));
const scheduledPeriod = event => event.periodLabel || 'Observation period not supplied';
const scheduleSource = event => dataStatus.calendar?.sources?.[event.sourceId];
const scheduleBasisLabel = event => event.scheduleBasis === 'recurring-rule' ? 'AGENCY RULE' : event.scheduleBasis === 'published-exception' ? 'AGENCY EXCEPTION' : event.scheduleBasis === 'calendar-estimate' ? 'ESTIMATED' : '';
const scheduleState = event => scheduleSource(event)?.status !== 'ok' && scheduleSource(event)?.fetchedAt ? 'CACHED SCHEDULE' : scheduleBasisLabel(event) || 'SCHEDULED';
const scheduleBasisPrefix = event => ['dol', 'treasury'].includes(event.sourceId) && scheduleBasisLabel(event) ? `${scheduleBasisLabel(event)} · ` : '';
function scheduledTime(event) {
  const instant = new Date(event.scheduledAt);
  return event.scheduledAt && Number.isFinite(instant.getTime())
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(instant)
    : event.time ? `${event.time} ET` : 'Time not supplied';
}
function scheduleBasisNote(event) {
  if (event.scheduleBasis === 'recurring-rule') return 'Generated from the DOL agency rule: Thursday at 08:30 Eastern Time. This future date was not individually listed and may change; check the official schedule for exceptions.';
  if (event.scheduleBasis === 'published-exception') return `The official DOL schedule lists this exception to its usual Thursday rule.${event.nominalDate ? ` Nominal Thursday: ${releaseDate(event.nominalDate)}.` : ''}`;
  if (event.scheduleBasis === 'calendar-estimate') return 'Individually listed estimate on the official Fiscal Data calendar. The date and time may change; this estimate does not confirm publication.';
  if (event.scheduleBasis === 'listed-date') return 'Individually listed date on the official agency schedule.';
  return '';
}

function yieldTimingPanel() {
  const source = dataStatus.calendar?.sources?.['treasury-yield-timing'];
  const timing = source?.fetchedAt ? source.timing : null;
  const status = timing ? source.status === 'ok' ? 'CAPTURED TIMING' : 'CACHED TIMING' : 'TIMING UNAVAILABLE';
  const sourceUrl = timing?.sourceUrl ?? 'https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology';
  const guidance = timing
    ? `<p>Treasury par yields are usually available by <strong class="mono">${esc(timing.availableBy)} Eastern Time</strong> (6 p.m.) each trading day. Publication can be delayed.</p><p class="small muted">Ongoing guidance, independent of selected dates. This is not a dated release or confirmation of publication. Eastern Time follows EST / EDT.</p>`
    : '<p>No verified yield publication timing is available in this snapshot. Consult the official Treasury methodology.</p>';
  const metadata = `<div class="context-strip"><span class="pill">${status}</span><span>Timing source retrieved <b class="mono">${esc(source?.fetchedAt ?? 'No successful retrieval')}</b></span><span>Last attempt <b class="mono">${esc(source?.lastAttemptAt ?? 'Not attempted')}</b></span></div><p class="small muted">${esc(calendarSourceNames['treasury-yield-timing'])} · <a href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">OFFICIAL METHODOLOGY ↗</a></p>`;
  const notes = `${source?.error ? `<p class="panel-note amber">${esc(source.error)}${timing ? ' · retained timing guidance may have changed.' : ''}</p>` : ''}${source?.coverageNote ? `<p class="panel-note">${esc(source.coverageNote)}</p>` : ''}${(source?.warnings ?? []).map(warning => `<p class="panel-note">${esc(warning)}</p>`).join('')}`;
  return `<div class="grid">${panel('T', 'TREASURY YIELD PUBLICATION TIMING', `<div class="panel-body">${guidance}${metadata}</div>${notes}`, '<span class="pill">ONGOING TIMING</span>' + seriesLink('yield', '10Y DETAIL ↗', 'link-button'), '', 'yield-timing')}</div>`;
}

export {releaseDate,scheduleLinks,calendarSourceNames,relatedSeries,scheduledPeriod,scheduleSource,scheduleState,scheduleBasisPrefix,scheduledTime,scheduleBasisNote,yieldTimingPanel};
