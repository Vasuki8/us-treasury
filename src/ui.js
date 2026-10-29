import { getSeries, latest, formatValue, formatChange, periodLabel, BLS_DATA_NOTICE } from './model.js';
import { DAILY_REFRESH_SCHEDULE, getFreshness } from './freshness.js';
import { measurementChange } from './measurement-change.js';
import {defaultWindowPreset} from './date-window.js';
import {displayCurrencyUnit,displayUnitLabel,formatDisplayValue,formatDisplayChange} from './display-format.js';

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

const freshnessTimeFormat=new Intl.DateTimeFormat('en-US',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',timeZone:'America/New_York',timeZoneName:'short'});
const freshnessTime=value=>value?`<time datetime="${escapeHtml(value)}">${escapeHtml(freshnessTimeFormat.format(new Date(value)))}</time>`:'Not recorded';

/** Recorded source retrievals remain distinct from attempts and snapshot assembly. */
export function freshnessBanner(snapshot={}, options={}) {
  if(options.compact)return compactFreshnessBanner(snapshot,options);
  const freshness=getFreshness(snapshot, options);
  const counts=[freshness.stale.length?`${freshness.stale.length} stale`:null,freshness.cached.length?`${freshness.cached.length} cached`:null,freshness.unavailable.length?`${freshness.unavailable.length} unavailable`:null].filter(Boolean);
  const state=counts.join(' · ')||`All ${freshness.entries.length} sources captured`;
  const cached=freshness.cached.length?`<p><strong>Cached:</strong> ${freshness.cached.map(source=>escapeHtml(source.label)).join(', ')}</p>`:'';
  const unavailable=freshness.unavailable.length?`<p><strong>Unavailable:</strong> ${freshness.unavailable.length===freshness.entries.length?`All ${freshness.entries.length} official data and calendar sources`:freshness.unavailable.map(source=>escapeHtml(source.label)).join(', ')}</p>`:'';
  const stale=freshness.stale.length?`<div class="freshness-stale-warning">
    <div><p class="freshness-warning-title">Daily refresh overdue</p>
    <p><strong>Stale:</strong> ${freshness.stale.map(source=>escapeHtml(source.label)).join(', ')}</p>
    <p class="freshness-note">These captures in this snapshot predate the expected daily run. Deadline: ${freshnessTime(freshness.refreshDeadline)}. Reload to check for a newer snapshot.</p></div>
    <button type="button" class="action freshness-reload" data-reload-snapshot>Reload snapshot</button>
  </div>`:'';
  const schedule=`${String(DAILY_REFRESH_SCHEDULE.hourUTC).padStart(2,'0')}:${String(DAILY_REFRESH_SCHEDULE.minuteUTC).padStart(2,'0')} UTC`;
  const sources=freshness.entries.map(source=>`<li class="freshness-source"${source.stale?' data-stale="true"':''}><div class="freshness-source-heading"><strong>${escapeHtml(source.label)}</strong><span>${source.stale?'Stale · ':''}${source.status==='available'?'Captured':source.status==='cached'?'Cached':'Unavailable'}</span></div><p>Last successful capture: ${freshnessTime(source.fetchedAt)}</p><p>Latest attempt: ${freshnessTime(source.lastAttemptAt)}</p>${source.stale?`<p class="freshness-error">Daily refresh deadline: ${freshnessTime(source.staleSince)}</p>`:''}${source.error?`<p class="freshness-error">${escapeHtml(source.error)}</p>`:''}</li>`).join('');
  return `<section class="freshness-banner" data-state="${freshness.state}" aria-label="Data freshness">
    <div class="freshness-heading"><p class="freshness-title">DATA FRESHNESS</p><span class="freshness-state">${escapeHtml(state)}</span></div>
    <div class="freshness-times"><p><span>Last successful source refresh</span> ${freshness.lastSuccessfulRefresh?freshnessTime(freshness.lastSuccessfulRefresh):'<strong>No successful source refresh recorded</strong>'}</p><p><span>Latest attempt</span> ${freshnessTime(freshness.lastAttemptAt)}</p></div>
    ${stale}<div class="freshness-source-summary">${cached}${unavailable}</div>
    <p class="freshness-note">Daily refresh: ${schedule}, allowing ${DAILY_REFRESH_SCHEDULE.graceMinutes} minutes for completion. Retrieval times in Eastern Time; observation periods vary by source.</p>
    <details class="freshness-details"><summary>Refresh details · ${freshness.entries.length} sources</summary><ul class="freshness-source-list">${sources}</ul></details>
  </section>`;
}

export function button(label, attrs = '', className = 'action') {
  return `<button type="button" class="${escapeHtml(className)}" ${attrs}>${escapeHtml(label)}</button>`;
}

function compactFreshnessBanner(snapshot,options) {
 const freshness=getFreshness(snapshot,options),affected=freshness.entries.filter(item=>item.status!=='available');
 const relevant=affected.filter(item=>!options.relevantIds||options.relevantIds.includes(item.id));
 const counts=[freshness.stale.length?`${freshness.stale.length} collection jobs overdue`:null,freshness.cached.length?`${freshness.cached.length} cached`:null,freshness.unavailable.length?`${freshness.unavailable.length} unavailable`:null].filter(Boolean).join(' · ');
 const sources=freshness.entries.map(item=>`<li><strong>${escapeHtml(item.label)}</strong> · ${item.stale?'Daily refresh overdue · ':''}${item.status}<br>Last successful retrieval: ${freshnessTime(item.fetchedAt)} · Last attempt: ${freshnessTime(item.lastAttemptAt)}${item.error?`<p class="amber">${escapeHtml(item.error)}</p>`:''}</li>`).join('');
 return `<section class="freshness-banner compact-freshness" data-state="${freshness.state}" aria-label="Data freshness"><div class="snapshot-status"><span>Snapshot <time datetime="${escapeHtml(snapshot.generatedAt??'')}">${escapeHtml(snapshot.generatedAt?.replace('T',' ').replace('Z',' UTC')??'unavailable')}</time></span><details class="freshness-details"><summary>${escapeHtml(counts||'Source captures current')} · Refresh details</summary><p>Last successful source refresh: ${freshnessTime(freshness.lastSuccessfulRefresh)}. Latest attempt: ${freshnessTime(freshness.lastAttemptAt)}.</p><p>Daily target 23:37 UTC + 60 minutes. This describes collection jobs, not the age of the latest economic reference period or verified release coverage. A recent retrieval can contain an older reference period; a scheduled event does not verify publication. Reload to check for a newer deployed snapshot.</p><button type="button" class="action" data-reload-snapshot>Reload snapshot</button><ul class="freshness-source-list">${sources}</ul></details></div>${relevant.length?`<p class="view-source-warning"><strong>Affects this view:</strong> ${relevant.map(item=>`${escapeHtml(item.label)} — ${item.status==='cached'?'cached after failed refresh':'unavailable'}${item.error?' ('+escapeHtml(item.error)+')':''}`).join('; ')}. Last successful retrievals and attempts are in Refresh details; check the official source if timing matters.</p>`:''}</section>`;
}

export function heading(title, subtitle, actions = '') {
  return `<header class="page-heading"><div><h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(subtitle)}</p></div><div class="actions">${actions}</div></header>`;
}

export function panel(index, title, body, actions = '', note = '', extraClass = '') {
  return `<section class="panel${extraClass ? ` ${escapeHtml(extraClass)}` : ''}"><header class="panel-head"><h2><span class="index">${escapeHtml(index)}</span>${escapeHtml(title)}</h2><div class="actions">${actions}</div></header>${body}${note ? `<p class="panel-note">${escapeHtml(note)}</p>` : ''}</section>`;
}

export function chart(ids, {
  height=180,kind='line',transform='level',range={preset:defaultWindowPreset(ids.map(getSeries))},
  comparison='native',panelId='',cursorGroup='',
}={}) {
  const names = ids.map(id => getSeries(id)?.name).filter(Boolean).join(', ');
  const window=escapeHtml(typeof range==='object'?JSON.stringify(range):range);
  return `<div class="chart" data-chart data-series="${escapeHtml(ids.join(','))}" data-kind="${escapeHtml(kind)}"`
    +` data-transform="${escapeHtml(transform)}" data-range="${window}" data-comparison="${escapeHtml(comparison)}"`
    +` data-panel-id="${escapeHtml(panelId)}" data-cursor-group="${escapeHtml(cursorGroup)}" data-height="${escapeHtml(height)}">`
    +`<p class="chart-fallback muted">${escapeHtml(kind==='curve'?'Treasury yield curve':names)} chart · official snapshot</p></div>`;
}

export function seriesLink(id, label, className = '') {
  const series = getSeries(id);
  if (!series) return '';
  return `<a class="${escapeHtml(className)}" href="#/series/${encodeURIComponent(id)}">${escapeHtml(label ?? series.name)}</a>`;
}

export function coverageBadge(series) {
  return series.coverageNote ? `<span class="pill" title="${escapeHtml(series.coverageNote)}">${series.id === 'claims' ? 'Historical feed' : 'Coverage note'}</span>` : '';
}

function compactChange(series,change,formatted=formatChange(series)){
 if(change.value===null)return 'Comparison unavailable';
 const growth=['gdp','gdpTotalContribution','wages'].includes(series.id);
 const label=series.id==='payrollAverage3m'?'Change in average gains':series.id==='payroll'?'Change in gains':growth?'Growth-rate change':'Change';
 return `${label} ${formatted} vs ${change.priorPeriod}`;
}

export function metrics(ids,{label='Headline indicators',showBasis=false,currencyUnit=displayCurrencyUnit(ids.map(getSeries))}={}) {
  return `<section class="metrics" aria-label="${escapeHtml(label)}">${ids.map(id => {
    const series = getSeries(id);
    if (!series) return '';
    const observation = latest(series),change=measurementChange(series);
    const reading=formatDisplayValue(series,observation?.value,{currencyUnit});
    const formattedChange=formatDisplayChange(series,{currencyUnit});
    return `<a class="metric" href="#/series/${encodeURIComponent(id)}"${series.error?` title="${escapeHtml(series.error)}"`:''}>`
      +`<span class="metric-name">${escapeHtml(series.short)}</span><strong class="metric-value">${escapeHtml(reading)}</strong>`
      +`<span class="metric-change" title="${escapeHtml(change.text)}">${escapeHtml(compactChange(series,change,formattedChange))}</span>`
      +`<span class="metric-period">${escapeHtml(observation?periodLabel(series,observation.date):'Unavailable')}`
      +`${series.dataStatus==='cached'?' · CACHED':''}</span>`
      +(showBasis?`<span class="metric-basis">${escapeHtml(seriesStatus(series))} · `
        +`${escapeHtml(displayUnitLabel(series,{currencyUnit}))}</span>`:'')
      +`${coverageBadge(series)}<span class="metric-detail" aria-hidden="true">Details ↗</span></a>`;
  }).join('')}</section>`;
}

export function table(headers, rows, caption = '') {
  return `<div class="table-wrap"><table>${caption ? `<caption class="sr-only">${escapeHtml(caption)}</caption>` : ''}<thead><tr>${headers.map(header => `<th scope="col"${header?.numeric === true ? ' class="num"' : ''}>${escapeHtml(typeof header === 'object' ? header.label : header)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

export function seriesTable(ids) {
  const rows = ids.map(id => {
    const series = getSeries(id);
    if (!series) return '';
    const observation = latest(series),change=measurementChange(series);
    return `<tr><th scope="row">${seriesLink(id)}<span class="table-code mono muted">${escapeHtml(series.code)}${series.dataStatus === 'cached' ? ' · CACHED' : ''}</span>${coverageBadge(series)}${!observation && series.error ? `<span class="table-code muted">${escapeHtml(series.error)}</span>` : ''}</th><td class="num">${escapeHtml(formatValue(series, observation?.value))}</td><td class="num muted" title="${escapeHtml(change.text)}">${escapeHtml(compactChange(series,change))}</td><td class="mono">${escapeHtml(observation ? periodLabel(series, observation.date) : '—')}</td></tr>`;
  }).join('');
  return table(['INDICATOR', {label:'LATEST',numeric:true}, {label:'PERIOD CHANGE',numeric:true}, 'OBSERVATION'], rows, 'Official macroeconomic snapshot; unavailable observations appear as a dash');
}

export function emptyState(message, detail = '', action = '') {
  return `<div class="empty-state"><p>${escapeHtml(message)}</p>${detail ? `<p class="muted">${escapeHtml(detail)}</p>` : ''}${action ? `<div class="actions">${action}</div>` : ''}</div>`;
}

export function sourceLink(series) {
  const url = series.source?.url ?? '';
  const name = series.source?.name ?? 'Source unavailable';
  return /^https:\/\//i.test(url) ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name)} ↗</a>` : escapeHtml(name);
}

export function seriesStatus(series) {
  return series.dataStatus === 'cached' ? `Cached ${series.observationType==='calculated'?'calculated metric':'official snapshot'}` : series.dataStatus === 'official' ? (series.observationType==='calculated'?'Calculated metric':'Official snapshot') : 'Unavailable';
}

function secureSourceUrl(value) {
  if(typeof value!=='string')return '';
  try {
    const url=new URL(value);
    return url.protocol==='https:'&&!url.username&&!url.password?value.trim():'';
  }catch{return '';}
}

function newYorkFedNotices(sources) {
  const isNewYorkFed=value=>{
    try {const {hostname}=new URL(value);return hostname==='newyorkfed.org'||hostname.endsWith('.newyorkfed.org');}
    catch{return false;}
  };
  const groups=new Map();
  for(const source of Object.values(sources))for(const item of Object.values(source?.series??{})){
    if(!item?.observations?.length||![item.sourceUrl,item.licenseUrl,item.termsUrl].some(isNewYorkFed))continue;
    const notice=String(item.sourceNotice||item.redistributionNotice||''),attribution=String(item.attribution??'');
    const terms=secureSourceUrl(item.licenseUrl||item.termsUrl),key=JSON.stringify([notice,attribution,terms]);
    if(!groups.has(key))groups.set(key,{notice,attribution,terms,references:new Map()});
    const title=String(item.sourceTitle||item.title||'New York Fed data'),url=secureSourceUrl(item.sourceUrl);
    groups.get(key).references.set(JSON.stringify([title,url]),{title,url});
  }
  return [...groups.values()].map(({notice,attribution,terms,references})=>{
    const titles=[...references.values()].map(({title,url})=>url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)} ↗</a>`:escapeHtml(title)).join(' · ');
    return `<div class="source-credit"><p><strong>${titles}</strong></p>${attribution&&!notice.includes(attribution)?`<p>${escapeHtml(attribution)}</p>`:''}<p>${escapeHtml(notice||'New York Fed source notice unavailable.')}</p><p>${terms?`<a href="${escapeHtml(terms)}" target="_blank" rel="noopener noreferrer">New York Fed Terms of Use ↗</a>`:'New York Fed terms unavailable.'}</p></div>`;
  }).join('');
}

/** Required notices and last successful source captures accompany every route. */
export function sourceNotice(sources = {}) {
  const retrieved = sources.bls?.fetchedAt;
  const laborRetrieved=sources.laborEvidence?.fetchedAt;
  const laborRetrieval=laborRetrieved?` Additional BLS real earnings and diffusion retrieved <time datetime="${escapeHtml(laborRetrieved)}">${escapeHtml(laborRetrieved)}</time>.`:'';
  const retrieval = retrieved
    ? `BLS data retrieved <time datetime="${escapeHtml(retrieved)}">${escapeHtml(retrieved)}</time>.`
    : 'BLS retrieval unavailable.';
  const macroCredits=(sources.activity||sources.policyRates?'<p>Additional official statistics: <a href="https://www.federalreserve.gov/" target="_blank" rel="noopener noreferrer">Board of Governors of the Federal Reserve System</a>.</p>':'')+(sources.housing?'<p>Housing source: <a href="https://www.census.gov/construction/nrc/" target="_blank" rel="noopener noreferrer">U.S. Census Bureau, New Residential Construction</a>. Annual-rate estimates retain published units and precision.</p>':'');
  return `<p>Data sources: <a href="https://home.treasury.gov/" target="_blank" rel="noopener noreferrer">U.S. Treasury</a>, <a href="https://www.bls.gov/" target="_blank" rel="noopener noreferrer">Bureau of Labor Statistics</a>, <a href="https://www.bea.gov/" target="_blank" rel="noopener noreferrer">Bureau of Economic Analysis</a>, <a href="https://oui.doleta.gov/unemploy/claims.asp" target="_blank" rel="noopener noreferrer">U.S. Department of Labor, Employment and Training Administration</a> and <a href="https://www.census.gov/retail/index.html" target="_blank" rel="noopener noreferrer">U.S. Census Bureau, Advance Monthly Retail Trade Survey</a>. Meridian is an independent site and is not endorsed by these agencies.</p>${macroCredits}<p>${escapeHtml(BLS_DATA_NOTICE)} ${retrieval}${laborRetrieval} <a href="https://www.bls.gov/developers/termsOfService.htm" target="_blank" rel="noopener noreferrer">BLS data terms ↗</a></p>${newYorkFedNotices(sources)}`;
}

/** Last successful retrieval and latest attempt remain separate after failures. */
export function sourceStatusList(sources = {}, { compact = false } = {}) {
  const names = { treasury: 'TREASURY', bls: 'BLS', bea: 'BEA', beaIta:'BEA INTERNATIONAL TRANSACTIONS', dol: 'DOL ETA', census: 'CENSUS' };
  const entries = Object.entries(sources);
  if (!entries.length) return '<p class="panel-note">Source retrieval metadata is unavailable.</p>';
  return entries.map(([id, source]) => {
    const label = source.status === 'ok' ? 'Official snapshot' : source.fetchedAt ? 'Cached · refresh failed' : 'Unavailable';
    const warnings = source.warnings ?? [];
    const warningText = warnings.map(warning => `<p class="muted">${escapeHtml(warning)}</p>`).join('');
    const notes = `${source.coverageNote ? `<p class="amber">${escapeHtml(source.coverageNote)}</p>` : ''}${compact && warnings.length ? `<details><summary>Source notes (${warnings.length})</summary>${warningText}</details>` : warningText}`;
    if (compact) {
      const timestamp = value => value ? `<time datetime="${escapeHtml(value)}">${escapeHtml(value.slice(0,10))}<br>${escapeHtml(value.slice(11))}</time>` : 'Unavailable';
      return `<div class="definition"><h3>${escapeHtml(names[id] ?? id.toUpperCase())}</h3><p>${escapeHtml(label)}</p><p>Retrieved<br><span class="mono">${timestamp(source.fetchedAt)}</span></p><p>Last attempt<br><span class="mono">${timestamp(source.lastAttemptAt)}</span></p>${source.error ? `<p class="amber">${escapeHtml(source.error)}</p>` : ''}${notes}</div>`;
    }
    return `<div class="definition"><h3>${escapeHtml(names[id] ?? id.toUpperCase())} · ${escapeHtml(label)}</h3><dl class="facts"><dt>Retrieved</dt><dd class="mono">${escapeHtml(source.fetchedAt ?? 'No successful retrieval')}</dd><dt>Last attempt</dt><dd class="mono">${escapeHtml(source.lastAttemptAt ?? 'Not attempted')}</dd></dl>${source.error ? `<p class="amber">${escapeHtml(source.error)}</p>` : ''}${notes}</div>`;
  }).join('');
}
