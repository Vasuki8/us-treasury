import { series, releases, yieldCurve, dataStatus } from './data.js';
import { getSeries, filterSeries, latest, formatValue, formatChange, periodLabel, transformSeries, compareSeries } from './model.js';
import { escapeHtml as esc, button, heading, panel, chart, metrics, seriesTable, seriesLink, table, emptyState, sourceLink, seriesStatus, sourceStatusList, coverageBadge } from './ui.js';

const defaults = {
  page: 'overview', seriesId: 'unrate', range: 12, transform: 'level', tab: 'data',
  query: '', topic: 'All topics', frequency: 'All frequencies', selected: ['unrate', 'cpi'],
  exploreMode: 'catalog', comparison: 'native', calendarMonth: 'upcoming', day: 'all', calendarTopic: 'All topics',
  watchOnly: false, eventId: '', saved: [], density: 'compact',
};
const allSeries = () => Object.values(series);
const options = (values, selected) => values.map(value => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(value)}</option>`).join('');
const link = (label, href, className = 'action') => `<a class="${esc(className)}" href="${esc(href)}">${esc(label)}</a>`;
const number = (value, precision = 2) => value == null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: precision, minimumFractionDigits: precision }).format(value);
const valueForPanel = (item, value, transform = 'level') => transform === 'level' ? formatValue(item.series, value) : value == null ? '—' : `${number(value, item.series.precision)} ${item.unit}`;
const seriesIds = values => [...new Set(values)].filter(id => getSeries(id));
const rangeControls = state => `<div class="actions" aria-label="Observation range">${[6, 12].map(range => button(`${range} OBS`, `data-range="${range}" aria-pressed="${state.range === range}"`)).join('')}</div>`;
const saveButton = (id, state, labels = ['☆ SAVE', '★ SAVED']) => button(state.saved.includes(id) ? labels[1] : labels[0], `data-save="${esc(id)}" aria-pressed="${state.saved.includes(id)}"`);
const releaseDate = date => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const scheduleLinks = () => (dataStatus.calendar?.links ?? []).map(source => `<a class="action" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.name)} ↗</a>`).join('');
const calendarSourceNames = {
  bls: 'Bureau of Labor Statistics', bea: 'Bureau of Economic Analysis',
  census: 'U.S. Census Bureau, Advance Monthly Retail Trade Survey',
  dol: 'U.S. Department of Labor, Employment and Training Administration',
};
const relatedSeries = event => seriesIds(event.seriesIds ?? [event.seriesId]);
const scheduledPeriod = event => event.periodLabel || 'Observation period not supplied';
const scheduleSource = event => dataStatus.calendar?.sources?.[event.sourceId];
const scheduleBasisLabel = event => event.scheduleBasis === 'recurring-rule' ? 'AGENCY RULE' : event.scheduleBasis === 'published-exception' ? 'AGENCY EXCEPTION' : '';
const scheduleState = event => scheduleSource(event)?.status !== 'ok' && scheduleSource(event)?.fetchedAt ? 'CACHED SCHEDULE' : scheduleBasisLabel(event) || 'SCHEDULED';
const scheduleBasisPrefix = event => event.sourceId === 'dol' && scheduleBasisLabel(event) ? `${scheduleBasisLabel(event)} · ` : '';
const orderedReleases = () => [...releases].sort((a, b) => a.date.localeCompare(b.date) || String(a.time ?? '').localeCompare(String(b.time ?? '')) || a.id.localeCompare(b.id));
function upcomingReleases() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const end = new Date(Date.parse(`${today}T12:00:00Z`) + 29 * 86400000).toISOString().slice(0, 10);
  return orderedReleases().filter(event => event.date >= today && event.date <= end);
}
function scheduledTime(event) {
  const instant = new Date(event.scheduledAt);
  return event.scheduledAt && Number.isFinite(instant.getTime())
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' }).format(instant)
    : event.time ? `${event.time} ET` : 'Time not supplied';
}
function scheduleBasisNote(event) {
  if (event.scheduleBasis === 'recurring-rule') return 'Generated from the DOL agency rule: Thursday at 08:30 Eastern Time. This future date was not individually listed and may change; check the official schedule for exceptions.';
  if (event.scheduleBasis === 'published-exception') return `The official DOL schedule lists this exception to its usual Thursday rule.${event.nominalDate ? ` Nominal Thursday: ${releaseDate(event.nominalDate)}.` : ''}`;
  if (event.scheduleBasis === 'listed-date') return 'Individually listed date on the official agency schedule.';
  return '';
}

function releaseWatch() {
  if (!releases.length) return emptyState('No verified releases have been ingested.', 'Consult the official release schedules for publication dates.', scheduleLinks());
  const upcoming = upcomingReleases().filter(event => !event.scheduledAt || Date.parse(event.scheduledAt) >= Date.now()).slice(0, 4);
  if (!upcoming.length) return emptyState('No scheduled releases in the next 30 days.', 'The captured schedules may cover other dates; check the calendar and source status.', link('OPEN CALENDAR ↗', '#/calendar') + scheduleLinks());
  return upcoming.map(event => `<div class="release-item"><span class="mono muted">${esc(event.time ?? '—')}</span><div>${button(event.name, `data-event="${esc(event.id)}"`, 'link-button')}<small>${esc(scheduleBasisPrefix(event))}${esc(releaseDate(event.date))} · ${esc(scheduledTime(event))} · ${esc(event.agency)} · ${esc(scheduledPeriod(event))}</small></div><span class="pill">${esc(scheduleState(event))}</span></div>`).join('');
}

function overview() {
  const twoYear = yieldCurve.find(point => point.years === 2);
  const tenYear = yieldCurve.find(point => point.years === 10);
  const spread = finite(twoYear?.value) && finite(tenYear?.value) ? `${tenYear.value - twoYear.value >= 0 ? '+' : ''}${number(tenYear.value - twoYear.value, 2)} pp` : '—';
  const trends = `<div class="chart-stack"><section class="chart-small"><h3 class="chart-caption"><span class="swatch"></span>CPI · ${esc(getSeries('cpi').unit)}</h3>${chart(['cpi'], { height: 122 })}</section><section class="chart-small"><h3 class="chart-caption"><span class="swatch blue"></span>Unemployment · ${esc(getSeries('unrate').unit)}</h3>${chart(['unrate'], { height: 122 })}</section></div>`;
  return heading('US ECONOMIC OVERVIEW', 'National accounts / labor / prices / fiscal / funding', link('CALENDAR ↗', '#/calendar') + link('EXPLORE ↗', '#/explore'))
    + metrics(['gdp', 'unrate', 'pce', 'yield', 'debt', 'payroll'])
    + `<div class="grid g21">${panel('01', 'INFLATION & LABOR', trends, button('COMPARE ↗', 'data-compare="cpi,unrate"', 'link-button'), 'Separate native-unit scales · official monthly observations')}${panel('02', 'TREASURY YIELD CURVE', `<div class="context-strip"><span class="mono">10Y–2Y <strong class="amber">${esc(spread)}</strong></span><span class="muted">${esc(dataStatus.curveDate ?? 'Date unavailable')} / ${esc(dataStatus.previousCurveDate ?? 'Prior unavailable')}</span></div>${chart([], { kind: 'curve', height: 254 })}`, seriesLink('yield', '10Y DETAIL ↗', 'link-button'), 'Official par yields · schematic tenor spacing · solid: latest / dashed: prior')}</div>`
    + `<div class="grid g21">${panel('03', 'MACRO MONITOR', seriesTable(['gdp', 'cpi', 'pce', 'unrate', 'claims', 'retail', 'debt']), link('ALL SERIES ↗', '#/explore', 'link-button'), 'Period changes preserve units; definitions are available on each indicator page.')}${panel('04', 'RELEASE WATCH', releaseWatch() + `<nav class="mini-nav" aria-label="Featured indicators">${link('LABOR', '#/economy/labor')}${seriesLink('cpi', 'PRICES', 'action')}${seriesLink('debt', 'DEBT', 'action')}</nav>`, link('CALENDAR ↗', '#/calendar', 'link-button'), 'Upcoming planned dates; agency rules and posted exceptions are labeled.')}</div>`
    + panel('05', 'OFFICIAL SNAPSHOT / SOURCE STATUS', `<div class="definitions">${sourceStatusList(dataStatus.sources)}</div>`, '', `Snapshot assembled: ${dataStatus.generatedAt ?? 'unavailable'}. Retrieval times describe when sources were captured; observation periods remain distinct.`);
}

function labor() {
  const definitions = ['payroll', 'unrate', 'claims'].map(id => `<div class="definition"><h3>${seriesLink(id, getSeries(id).short)}</h3><p>${esc(getSeries(id).definition)}</p>${getSeries(id).coverageNote ? `<p class="amber">${esc(getSeries(id).coverageNote)}</p>` : ''}</div>`).join('');
  return heading('LABOR MARKET', 'Employment, wages and participation · monthly + weekly', button('COMPARE SERIES', 'data-compare="unrate,claims"') + link('RELEASES ↗', '#/calendar'))
    + metrics(['payroll', 'unrate', 'participation', 'wages', 'claims', 'openings'])
    + `<div class="grid g11">${panel('01', 'NONFARM PAYROLL CHANGE', chart(['payroll'], { kind: 'bar', height: 190 }), seriesLink('payroll', 'DETAIL ↗', 'link-button'), `${getSeries('payroll').adjustment} · ${getSeries('payroll').unit}`)}${panel('02', 'UNEMPLOYMENT RATE', chart(['unrate'], { height: 190 }), seriesLink('unrate', 'UNRATE ↗', 'link-button'), `${getSeries('unrate').adjustment} · ${getSeries('unrate').unit}`)}</div>`
    + `<div class="grid g21">${panel('03', 'LABOR DASHBOARD', seriesTable(['participation', 'wages', 'claims', 'openings', 'payroll', 'unrate']), link('EXPLORE ↗', '#/explore', 'link-button'), 'Monthly and weekly frequencies remain distinct.')}${panel('04', 'DEFINITIONS & COVERAGE', `<div class="definitions">${definitions}</div>`, '', 'Official national observations · establishment and household surveys measure different concepts.')}</div>`;
}

function detailData(item, state) {
  if (!item.observations.length) return emptyState('No observations available.', item.series.error ?? 'The official source has no available observations in this snapshot.', link('EXPLORE DATA ↗', '#/explore'));
  const originals = new Map(item.series.observations.map(observation => [observation.date, observation]));
  const rows = [...item.observations].reverse().map(observation => {
    const original = originals.get(observation.date);
    return `<tr><th scope="row"><time datetime="${esc(observation.date)}">${esc(periodLabel(item.series, observation.date))}</time></th><td class="num">${esc(valueForPanel(item, observation.value, state.transform))}</td><td class="mono muted">${esc(original?.publishedAt ?? '—')}</td><td class="muted">${esc((original?.footnotes ?? []).join('; ') || '—')}</td></tr>`;
  }).join('');
  return `<p class="panel-note">${state.transform === 'change' ? 'Period changes from adjacent observations' : 'Published measure'} · ${esc(item.unit)} · most recent first. ${esc(item.series.publicationNote ?? 'Historical publication dates are not supplied by this feed; — means unknown.')}</p>${table(['OBSERVATION PERIOD', state.transform === 'change' ? 'PERIOD CHANGE' : 'VALUE', 'PUBLISHED', 'SOURCE NOTES'], rows, 'Official indicator observations and source footnotes')}`;
}

function detailRevisions(current) {
  if (!current.revisions.length) return emptyState('No revision history has been captured.', 'A current snapshot does not establish earlier published values. This series may be revised by its source.');
  const rows = [...current.revisions].reverse().map(revision => `<tr><th scope="row">${esc(periodLabel(current, revision.period))}</th><td class="num">${esc(formatValue(current, revision.initial))}</td><td class="num">${esc(formatValue(current, revision.revised))}</td><td class="mono muted">${esc(revision.publishedAt)}</td></tr>`).join('');
  return `<p class="panel-note">Verified publication snapshots · initial and revised values are distinct.</p>${table(['OBSERVATION PERIOD', 'INITIAL', 'REVISED', 'REVISION PUBLISHED'], rows, 'Captured official revision history')}`;
}

function detailMethodology(current) {
  return `<div class="explain"><p><strong>Definition.</strong> ${esc(current.definition)}</p><p><strong>Frequency and units.</strong> ${esc(current.frequency)} · ${esc(current.unit)} · ${esc(current.adjustment)}.</p><p><strong>Calculation.</strong> ${esc(current.calculation ?? 'No calculation metadata is available.')}</p>${current.coverageNote ? `<p><strong>Coverage.</strong> ${esc(current.coverageNote)}</p>` : ''}<p><strong>Observation and publication dates.</strong> The observation period describes when activity was measured. Retrieval is when the source was captured. ${esc(current.publicationNote ?? 'Historical publication dates are not supplied by this feed and remain unknown.')}</p><p><strong>Period change.</strong> Each observation is compared with the immediately preceding observation. Missing observations remain missing; no values are filled. Changes in percentage measures use percentage points; yield changes use basis points.</p><p><strong>Source.</strong> ${sourceLink(current)} · ${esc((current.source.seriesIds ?? []).join(', ') || current.code)}. ${esc(seriesStatus(current))}; retrieved ${esc(current.fetchedAt ?? 'unavailable')}.${current.error ? ` ${esc(current.error)}` : ''}</p><p>Source footnotes, including preliminary estimates, are preserved in the data table. Revision history requires separate captured publication snapshots.</p></div>`;
}

function indicator(state) {
  const current = getSeries(state.seriesId) ?? getSeries('unrate');
  const observation = latest(current);
  const previous = current.observations.at(-2);
  const transformed = transformSeries(current, state.transform, state.range);
  const tabs = [['data', 'DATA TABLE'], ['methodology', 'METHODOLOGY'], ['revisions', 'REVISIONS']];
  const activeTab = tabs.some(([id]) => state.tab === id) ? state.tab : 'data';
  const content = activeTab === 'methodology' ? detailMethodology(current) : activeTab === 'revisions' ? detailRevisions(current) : detailData(transformed, state);
  const metadata = `<dl class="facts"><dt>Series</dt><dd class="mono cyan">${esc(current.code)}</dd><dt>Source IDs</dt><dd class="mono">${esc((current.source.seriesIds ?? []).join(', ') || '—')}</dd><dt>Frequency</dt><dd>${esc(current.frequency)}</dd><dt>Unit</dt><dd>${esc(current.unit)}</dd><dt>Adjustment</dt><dd>${esc(current.adjustment)}</dd><dt>Observation</dt><dd>${esc(observation ? periodLabel(current, observation.date) : '—')}</dd><dt>Published</dt><dd class="mono">${esc(observation?.publishedAt ?? 'Unknown')}</dd><dt>Retrieved</dt><dd class="mono">${esc(current.fetchedAt ?? 'No successful retrieval')}</dd><dt>Source</dt><dd>${sourceLink(current)}</dd><dt>Data status</dt><dd class="amber">${esc(seriesStatus(current))}</dd></dl>${current.error ? `<p class="panel-note amber">${esc(current.error)}</p>` : ''}<p class="panel-note">${esc(current.definition)}</p><p class="panel-note">${esc(current.publicationNote ?? 'Historical publication dates are not supplied by this feed.')}</p>`;
  return heading(current.name.toUpperCase(), `${current.code} · ${current.source.name} · ${current.adjustment}`, saveButton(current.id, state) + button('COMPARE ↗', `data-compare="${esc(current.id)}"`) + button('CSV EXPORT', 'data-export') + button('COPY LINK', 'data-copy-link'))
    + `<div class="context-strip indicator-context"><strong class="big-value">${esc(formatValue(current, observation?.value))}</strong><span class="cyan mono">${esc(formatChange(current))}</span><span>OBSERVATION <b class="mono">${esc(observation ? periodLabel(current, observation.date) : '—')}</b></span><span>PRIOR <b class="mono">${esc(formatValue(current, previous?.value))}</b></span><span class="pill">${esc(seriesStatus(current).toUpperCase())}</span></div>`
    + (current.coverageNote ? `<p class="panel-note amber">${esc(current.coverageNote)}</p>` : '')
    + `<div class="grid g21">${panel('01', `${current.code} / HISTORICAL SERIES`, `<div class="toolbar">${rangeControls(state)}<label for="transform-select">View <select id="transform-select">${options(['level', 'change'], state.transform).replace('>level<', '>Published measure<').replace('>change<', '>Period change<')}</select></label></div>${chart([current.id], { height: 230, transform: state.transform, range: state.range })}`, '', `${current.frequency} · ${transformed.unit} · ${seriesStatus(current)}`)}${panel('02', 'SERIES INFORMATION', metadata, link('CALENDAR ↗', '#/calendar', 'link-button'))}</div>`
    + `<section class="panel"><div class="tabs" role="tablist" aria-label="Indicator detail sections">${tabs.map(([id, label]) => button(label, `role="tab" id="detail-tab-${id}" aria-controls="detail-content" aria-selected="${activeTab === id}" data-tab="${id}"`, '')).join('')}</div><div class="tab-panel" id="detail-content" role="tabpanel" aria-labelledby="detail-tab-${activeTab}">${content}</div></section>`
    + `<nav class="context-strip related-series" aria-label="Related indicators"><span class="muted">RELATED</span>${['unrate', 'payroll', 'claims', 'participation', 'cpi'].filter(id => id !== current.id).slice(0, 4).map(id => seriesLink(id, getSeries(id).code, 'action')).join('')}</nav>`;
}

function calendarPreview(event, state) {
  if (!event) return panel('02', 'RELEASE PREVIEW', emptyState('No release selected.', releases.length ? 'Choose a release from the filtered schedule.' : 'No verified schedule has been ingested. Use the official agency schedules below.'), '', '', 'calendar-detail');
  const source = scheduleSource(event);
  const indicators = relatedSeries(event).map(id => `<div class="panel-body actions">${seriesLink(id, getSeries(id).short + ' ↗', 'action')}${saveButton(id, state, ['☆ FOLLOW', '★ FOLLOWING'])}</div>`).join('');
  const basis = scheduleBasisNote(event);
  return panel('02', 'RELEASE PREVIEW', `<h3 class="detail-title">${esc(event.name)}</h3><p class="detail-sub">${esc(event.agency)} / ${esc(scheduledPeriod(event))}<br>${esc(releaseDate(event.date))} · ${esc(scheduledTime(event))}</p><p class="panel-note"><span class="pill">${esc(scheduleState(event))}</span> Schedule information describes planned publication timing. A past scheduled time does not establish that a result was published.</p>${basis ? `<p class="panel-note"><strong>Schedule basis.</strong> ${esc(basis)}</p>` : ''}<dl class="facts"><dt>Schedule source</dt><dd>${esc(calendarSourceNames[event.sourceId] ?? event.agency)}</dd><dt>Retrieved</dt><dd class="mono">${esc(source?.fetchedAt ?? 'Unavailable')}</dd></dl>${source?.error ? `<p class="panel-note amber">${esc(source.error)} · retained schedule may have changed.</p>` : ''}<p class="panel-note"><a href="${esc(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">OFFICIAL SCHEDULE ↗</a></p>${indicators}`, '', 'Related indicators use their own observation snapshots. Follow saves each series to your browser watchlist.', 'calendar-detail');
}

function calendar(state) {
  const months = [...new Set(releases.map(event => event.date.slice(0, 7)))].sort();
  const month = months.includes(state.calendarMonth) ? state.calendarMonth : 'upcoming';
  const windowEvents = month === 'upcoming' ? upcomingReleases() : orderedReleases().filter(event => event.date.startsWith(month));
  const days = [...new Set(windowEvents.map(event => event.date))];
  const filtered = windowEvents.filter(event => (state.day === 'all' || event.date === state.day)
    && (state.calendarTopic === 'All topics' || event.topic === state.calendarTopic)
    && (!state.watchOnly || relatedSeries(event).some(id => state.saved.includes(id))));
  const selected = filtered.find(event => event.id === state.eventId) ?? filtered[0];
  let previousDay = '';
  const rows = filtered.map(event => {
    const dayHeader = previousDay === event.date ? '' : `<tr class="calendar-day"><th scope="rowgroup" colspan="3">${esc(releaseDate(event.date))}</th></tr>`;
    previousDay = event.date;
    return dayHeader + `<tr class="calendar-event${selected?.id === event.id ? ' selected-row' : ''}"><td class="mono">${esc(scheduledTime(event))}</td><th scope="row">${button(event.name, `data-event="${esc(event.id)}" aria-pressed="${selected?.id === event.id}"`, 'link-button')}<span class="table-code muted">${esc(scheduleBasisPrefix(event))}${esc(scheduledPeriod(event))} · ${esc(event.agency)}</span></th><td><span class="pill">${esc(scheduleState(event))}</span></td></tr>`;
  }).join('');
  const schedule = filtered.length ? `<div class="table-wrap"><table><caption class="sr-only">Official agency release dates and labeled recurring-rule dates; times are Eastern Time.</caption><thead><tr><th scope="col">TIME / ET</th><th scope="col">RELEASE / PERIOD</th><th scope="col">STATE</th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState(releases.length ? 'No releases match these filters.' : 'No verified releases have been ingested.', releases.length ? state.watchOnly && !state.saved.length ? 'Your watchlist is empty. Follow a series from an indicator page or clear the filters.' : 'Try another day or topic, or clear the filters.' : dataStatus.calendar?.message ?? 'Consult the official release schedules for publication dates.', button('CLEAR FILTERS', 'data-reset-calendar') + scheduleLinks());
  const monthSelect = `<label for="calendar-month">Window <select id="calendar-month"><option value="upcoming"${month === 'upcoming' ? ' selected' : ''}>Next 30 days</option>${months.map(value => `<option value="${value}"${month === value ? ' selected' : ''}>${esc(new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value + '-01T12:00:00Z')))}</option>`).join('')}</select></label>`;
  const daySelect = `<label for="calendar-day">Day <select id="calendar-day"><option value="all"${state.day === 'all' ? ' selected' : ''}>All days in window</option>${days.map(date => `<option value="${date}"${state.day === date ? ' selected' : ''}>${esc(releaseDate(date))}</option>`).join('')}</select></label>`;
  const sources = Object.entries(dataStatus.calendar?.sources ?? {}).map(([id, source]) => `<div class="definition"><h3>${esc(calendarSourceNames[id] ?? source.agency ?? id)}</h3><p>${source.status === 'ok' ? 'Captured official schedule' : source.fetchedAt ? 'Cached schedule · refresh failed' : 'Schedule unavailable'}</p><dl class="facts"><dt>Retrieved</dt><dd class="mono">${esc(source.fetchedAt ?? 'No successful retrieval')}</dd><dt>Last attempt</dt><dd class="mono">${esc(source.lastAttemptAt ?? 'Not attempted')}</dd></dl>${source.error ? `<p class="amber">${esc(source.error)}</p>` : ''}${source.coverageNote ? `<p>${esc(source.coverageNote)}</p>` : ''}${(source.warnings ?? []).map(warning => `<p class="muted">${esc(warning)}</p>`).join('')}</div>`).join('');
  return heading('ECONOMIC CALENDAR', 'Official release schedules / Eastern Time', button('RESET FILTERS', 'data-reset-calendar'))
    + `<div class="toolbar calendar-toolbar">${monthSelect}${daySelect}<label for="calendar-topic">Topic <select id="calendar-topic">${options(['All topics', ...new Set(releases.map(event => event.topic))], state.calendarTopic)}</select></label><label class="check-label" for="calendar-watch-only"><input type="checkbox" id="calendar-watch-only"${state.watchOnly ? ' checked' : ''}>Watchlist only</label></div>`
    + `<div class="calendar-layout">${panel('01', 'RELEASE SCHEDULE', schedule, `<span class="small muted">${filtered.length} RELEASES</span>`, 'Individually listed dates, agency rules and posted exceptions retain their source basis.')}${calendarPreview(selected, state)}</div>`
    + `<div class="grid g11 calendar-context">${panel('03', 'READING THIS CALENDAR', `<div class="explain"><p>Observation periods and retrieval timestamps do not establish publication dates. This calendar uses separately captured official agency schedules. Times follow America/New_York, including daylight saving time.</p><p>Schedules may change. A past scheduled time does not confirm publication. No release results, forecasts or revision records have been ingested. Indicator observations remain available through each series page.</p><div class="actions">${scheduleLinks()}</div></div>`)}${panel('04', 'SCHEDULE CONTEXT', `<dl class="facts"><dt>Timezone</dt><dd>Eastern Time (EST / EDT)</dd><dt>Schedule status</dt><dd>${esc(dataStatus.calendar?.status ?? 'Unavailable')}</dd><dt>Captured events</dt><dd>${releases.length}</dd></dl><p class="panel-note">${esc(dataStatus.calendar?.message ?? 'A verified schedule feed is unavailable.')}</p><div class="definitions">${sources}</div>`)}</div>`;
}

function selectionTray(state) {
  return `<div class="series-tray"><span class="small muted">SELECTED ${state.selected.length}/4</span>${state.selected.map(id => `<span class="series-chip"><span>${esc(getSeries(id).code)}</span>${button('×', `data-remove="${esc(id)}" aria-label="Remove ${esc(getSeries(id).name)}"`, 'link-button')}</span>`).join('')}${button('COMPARE SELECTED ↗', 'data-explore-mode="compare"', 'action primary')}</div>`;
}

function catalog(state) {
  const matching = filterSeries({ query: state.query, topic: state.topic, frequency: state.frequency });
  const filters = `<div class="filter-body"><label for="topic-filter">Topic<select id="topic-filter">${options(['All topics', ...new Set(allSeries().map(item => item.topic))], state.topic)}</select></label><label for="frequency-filter">Frequency<select id="frequency-filter">${options(['All frequencies', ...new Set(allSeries().map(item => item.frequency))], state.frequency)}</select></label><div class="small muted">Geography<br><span class="mono">United States</span></div><div class="small muted">Data mode<br><span class="amber">OFFICIAL SNAPSHOT</span></div></div>`;
  const rows = matching.map(current => {
    const observation = latest(current);
    return `<tr${state.selected.includes(current.id) ? ' class="selected-row"' : ''}><td><input type="checkbox" data-select="${esc(current.id)}" aria-label="Select ${esc(current.name)}"${state.selected.includes(current.id) ? ' checked' : ''}></td><th scope="row">${seriesLink(current.id)}<span class="table-code mono muted">${esc(current.code)}</span><span class="table-code muted">${esc(seriesStatus(current))}${!observation && current.error ? ` · ${esc(current.error)}` : ''}</span>${coverageBadge(current)}</th><td class="num">${esc(formatValue(current, observation?.value))}</td><td class="mono muted">${esc(observation ? periodLabel(current, observation.date) : '—')}</td><td>${esc(current.frequency)}</td><td class="muted">${esc(current.source.name)}</td></tr>`;
  }).join('');
  const catalogTable = rows ? `<div class="table-wrap"><table><caption class="sr-only">Official series catalog, including unavailable indicators</caption><thead><tr><th scope="col"><span class="sr-only">Select</span></th><th scope="col">INDICATOR / CODE</th><th scope="col" class="num">LATEST</th><th scope="col">OBSERVATION</th><th scope="col">FREQ</th><th scope="col">SOURCE</th></tr></thead><tbody>${rows}</tbody></table></div>` : emptyState('No series match your filters.', 'Search a series name, code, topic or agency, or clear the filters.', button('CLEAR FILTERS', 'data-reset-filters'));
  return `<div class="explore-layout">${panel('', 'FILTERS', filters, button('CLEAR', 'data-reset-filters', 'link-button'))}${panel('01', 'SERIES CATALOG', `<div class="panel-body"><label class="catalog-search-label" for="catalog-search">Search series</label><input id="catalog-search" class="searchbox" type="search" placeholder="Name, code, topic or agency…" value="${esc(state.query)}"></div>${catalogTable}${selectionTray(state)}`, `<span class="small muted" id="catalog-result-count">${matching.length} SERIES</span>`)}</div>`;
}

function comparison(state) {
  const result = compareSeries(state.selected, state.comparison, state.range);
  const selected = state.selected.map((id, index) => {
    const current = getSeries(id);
    return `<div class="builder-series"><span class="mono ${index % 2 ? 'cyan' : 'amber'}">${index + 1} / ${esc(current.code)}</span><h3>${seriesLink(id)}</h3><p class="muted">${esc(current.unit)} · ${esc(current.frequency)}</p>${coverageBadge(current)}${current.coverageNote ? `<p class="small amber">${esc(current.coverageNote)}</p>` : ''}${button('REMOVE', `data-remove="${esc(id)}"`, 'link-button')}</div>`;
  }).join('');
  let workspace;
  if (!state.selected.length) workspace = emptyState('No series selected.', 'Choose up to four series from the catalog.', button('OPEN CATALOG', 'data-explore-mode="catalog"'));
  else if (result.error) workspace = emptyState('Comparison unavailable.', result.error, button('EDIT SELECTION', 'data-explore-mode="catalog"'));
  else if (state.comparison === 'indexed') workspace = `<p class="panel-note">Index (common baseline = 100) · shared starting date; original observation dates thereafter · no fill or frequency aggregation</p>${chart(state.selected, { height: 275, range: state.range, comparison: 'indexed' })}`;
  else workspace = result.panels.map(item => `<section class="comparison-panel"><h3 class="chart-caption"><span class="swatch"></span>${esc(item.series.short)} · ${esc(item.unit)}</h3>${chart([item.series.id], { height: 150, range: state.range })}</section>`).join('');
  const controls = `<div class="toolbar"><label for="comparison-select">Comparison <select id="comparison-select"><option value="native"${state.comparison === 'native' ? ' selected' : ''}>Native units · separate panels</option><option value="indexed"${state.comparison === 'indexed' ? ' selected' : ''}>Index · common baseline = 100</option></select></label>${rangeControls(state)}</div>`;
  return `<div class="grid g12">${panel('01', 'SELECTED SERIES', `<div class="builder-list">${selected || '<p class="muted">Select series in the catalog to compare.</p>'}<p class="small muted">Native units and observation dates are preserved. Indexing requires a common nonzero baseline.</p></div>`, button('EDIT', 'data-explore-mode="catalog"', 'link-button'))}${panel('02', 'COMPARISON WORKSPACE', controls + workspace, '', 'Official snapshots · native panels use independent labeled scales')}</div>`
    + panel('03', 'EXPORT CONFIGURATION', `<div class="context-strip"><span>FORMAT <b class="mono">LONG CSV</b></span><span>UNITS <b class="mono">${state.comparison === 'indexed' ? 'INDEXED' : 'NATIVE'}</b></span><span>ALIGNMENT <b class="mono">NO FILL</b></span><span>DATA <b class="mono">OFFICIAL SNAPSHOT</b></span></div><p class="panel-note">${state.comparison === 'indexed' ? 'CSV exports contain the indexed values displayed, with a shared starting date and original observation dates thereafter.' : 'CSV exports retain each series’ native units and original observation dates.'} Per-series status and retrieval times identify cached observations.</p>`, button('CSV SELECTED', `data-export${state.selected.length ? '' : ' disabled'}`, 'link-button'));
}

function explore(state) {
  return heading('EXPLORE DATA', 'Find series, inspect definitions and compare observations', button('CSV SELECTED', `data-export${state.selected.length ? '' : ' disabled'}`))
    + `<div class="tabs explore-tabs" role="tablist" aria-label="Explore views">${[['catalog', 'SERIES CATALOG'], ['compare', 'COMPARE SERIES']].map(([id, label]) => button(label, `role="tab" id="explore-tab-${id}" aria-controls="explore-content" aria-selected="${state.exploreMode === id}" data-explore-mode="${id}"`, '')).join('')}</div><div id="explore-content" class="tab-panel" role="tabpanel" aria-labelledby="explore-tab-${state.exploreMode}">${state.exploreMode === 'compare' ? comparison(state) : catalog(state)}</div>`;
}

export function renderPage(input = {}) {
  const state = { ...defaults, ...input };
  state.selected = seriesIds(Array.isArray(state.selected) ? state.selected : []).slice(0, 4);
  state.saved = seriesIds(Array.isArray(state.saved) ? state.saved : []);
  return ({ overview, labor, indicator, calendar, explore }[state.page] ?? overview)(state);
}
