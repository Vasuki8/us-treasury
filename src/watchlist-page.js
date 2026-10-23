import { getSeries, latest, formatValue, periodLabel } from './model.js';
import { routeFor } from './router.js';
import { indicatorHref } from './workspace-context.js';
import { heading, button, panel, table, emptyState, sourceLink, seriesStatus, escapeHtml as esc } from './ui.js';
import { series, releases } from './data.js';
import { measurementChange } from './measurement-change.js';
import { watchlistMonitor,monitorUpdateLabel } from './watchlist-monitor.js';

const validIds = values => [...new Set(Array.isArray(values) ? values : [])].filter(id => getSeries(id));

function coverage(current) {
  const observations = current.observations ?? [];
  if (!observations.length) return 'Observation coverage unavailable';
  const dates = observations.map(item => item.date).sort();
  const available = observations.filter(item => typeof item.value === 'number' && Number.isFinite(item.value)).length;
  return `${dates[0]} – ${dates.at(-1)} · ${observations.length} observations · ${available} available values`;
}

/** Saved IDs and storage capability come from the existing browser preferences. */
export function watchlistPage(input = {},{changes={},checkpoint={}}={}) {
  const saved = validIds(input.saved);
  const selected = validIds(input.selected).slice(0, 4);
  const state = { ...input, page: 'watchlist', saved, selected };
  const comparisonHref = routeFor({ ...state, page: 'explore', exploreMode: 'compare', returnTo: routeFor(state) });
  const catalogHref = routeFor({ ...state, page: 'explore', exploreMode: 'catalog', returnTo: routeFor(state) });
  const link = (label, href) => `<a class="action" href="${esc(href)}">${esc(label)}</a>`;
  const persistence = state.storageAvailable === false
    ? 'Browser storage is unavailable. Your watchlist lasts for this session only.'
    : 'Saved in this browser. Open an indicator to save more series.';
  const actions = link('FIND SERIES', catalogHref) + (selected.length ? link(`VIEW COMPARISON · ${selected.length}/4`, comparisonHref) : '');
  const rows = watchlistMonitor(saved,{catalog:series,events:releases,sort:state.watchlistSort,group:state.watchlistGroup}).map(({id,nextEvent}) => {
    const current = getSeries(id), observation = latest(current);
    const inComparison = selected.includes(id), full = selected.length >= 4 && !inComparison;
    const compare = button(inComparison ? 'VIEW COMPARISON' : 'ADD TO COMPARISON', `data-add-compare="${esc(id)}"${full ? ' disabled title="Comparison holds four series. Remove one before adding another."' : ''}`)+`<p class="small"><span class="pill">${esc(monitorUpdateLabel(id,changes,checkpoint))}</span></p>`;
    const remove = button('REMOVE', `data-save="${esc(id)}" aria-label="Remove ${esc(current.name)} from watchlist" aria-pressed="true"`, 'link-button');
    const order=state.watchlistSort&&state.watchlistSort!=='manual'?'':button('↑',`data-watch-move="${esc(id)}" data-direction="-1" aria-label="Move ${esc(current.name)} up"${saved.indexOf(id)===0?' disabled':''}`)+button('↓',`data-watch-move="${esc(id)}" data-direction="1" aria-label="Move ${esc(current.name)} down"${saved.indexOf(id)===saved.length-1?' disabled':''}`);
    return `<tr><th scope="row"><a href="${esc(indicatorHref(id, state))}">${esc(current.name)}</a><span class="table-code mono muted">${esc(current.code)}</span><span class="table-code muted">${esc(state.watchlistGroup?current.topic+' · ':'')}${esc(current.frequency)} · ${esc(current.unit)} · ${esc(seriesStatus(current))}</span>${current.error ? `<span class="table-code amber">${esc(current.error)}</span>` : ''}</th><td class="num" data-label="Latest value">${esc(formatValue(current, observation?.value))}</td><td class="mono" data-label="Observation period">${esc(observation ? periodLabel(current, observation.date) : 'Unavailable')}</td><td data-label="Change and next release"><p>${esc(measurementChange(current).text)}</p><p class="small muted">${observation?.revisionIndicator==='Y'?'Source revision flag; reason unknown. ':''}Latest retained period; collected ${esc(current.fetchedAt??'unknown')}.</p>${nextEvent?link(`${nextEvent.name} · ${nextEvent.date}${nextEvent.time?' '+nextEvent.time+' ET':''}`,`#/calendar?month=${nextEvent.date.slice(0,7)}&event=${encodeURIComponent(nextEvent.id)}`):'<p class="small muted">Next release not in retained schedule.</p>'}<details><summary>Source &amp; coverage</summary>${sourceLink(current)}<span class="table-code muted">Reference dates: ${esc(coverage(current))}</span><span class="table-code muted">Retrieved: <span class="mono">${esc(current.fetchedAt ?? 'No successful retrieval')}</span></span></details></td><td data-label="Actions"><div class="actions">${link('OPEN', indicatorHref(id, state))}${compare}${order}${remove}</div></td></tr>`;
  }).join('');
  const body = rows
    ? table(['SAVED INDICATOR / CODE', 'LATEST', 'OBSERVATION', 'CHANGE / NEXT RELEASE / EVIDENCE', 'ACTIONS'], rows, 'Saved indicators, actual reference-date coverage and separate source retrieval times')
    : emptyState('No saved series.', 'Find an indicator in the catalog and use SAVE to keep it in your watchlist.', link('FIND SERIES', catalogHref));
  return heading('WATCHLIST', 'Saved indicators · source coverage and comparison workspace', actions)
    + `<p class="panel-note">${checkpoint.enabled?`Captured changes since ${esc(checkpoint.since??'your local checkpoint')}.`:'Data updates on return are off.'} <a href="#/research?view=changes">Manage comparison checkpoint ↗</a>. A captured value change is separate from a verified publication revision.</p>${changes.status==='error'?`<p class="panel-note amber">${esc(changes.error)} ${button('RETRY UPDATE HISTORY','data-retry-changes')}</p>`:''}`
    + `<div class="toolbar"><label for="watchlist-sort">Order<select id="watchlist-sort">${[['manual','My order'],['updated','Newest retrieval'],['next','Next release']].map(([id,label])=>`<option value="${id}"${(state.watchlistSort??'manual')===id?' selected':''}>${label}</option>`).join('')}</select></label><label class="check-label"><input type="checkbox" id="watchlist-group"${state.watchlistGroup?' checked':''}>Group by topic</label></div>`
    + `<p class="panel-note"${state.storageAvailable === false ? ' role="status"' : ''}>${esc(persistence)}</p>`
    + panel('01', 'SAVED SERIES', body, `<span class="small muted">${saved.length} SERIES</span>`, `Comparison: ${selected.length}/4 series. Add up to four series; each keeps its own units and observation dates.`);
}
