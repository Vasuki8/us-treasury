import { readingGroup, supportingDetails } from './page-hierarchy.js';
import { getSeries, latest, formatValue, periodLabel } from './model.js';
import { routeFor } from './router.js';
import { indicatorHref } from './workspace-context.js';
import { heading, button, panel, table, emptyState, sourceLink, seriesStatus, escapeHtml as esc } from './ui.js';
import { series, releases } from './data.js';
import { measurementChange } from './measurement-change.js';
import {humanTimestamp,humanDate} from './ui-time.js';
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
export function watchlistPage(input = {},{changes={},checkpoint={},events=releases,now=new Date()}={}) {
  const saved = validIds(input.saved);
  const selected = validIds(input.selected).slice(0, 4);
  const state = { ...input, page: 'watchlist', saved, selected };
  const comparisonHref = routeFor({ ...state, page: 'explore', exploreMode: 'compare', returnTo: routeFor(state) });
  const catalogHref = routeFor({ ...state, page: 'explore', exploreMode: 'catalog', returnTo: routeFor(state) });
  const link = (label, href) => `<a class="action" href="${esc(href)}">${esc(label)}</a>`;
  const persistence = state.storageAvailable === false
    ? 'Browser storage is unavailable. Your watchlist lasts for this session only.'
    : 'Saved in this browser. Use Follow on an indicator to add it to this watchlist.';
  const actions = link('FIND SERIES', catalogHref) + (selected.length ? link(`VIEW COMPARISON · ${selected.length}/4`, comparisonHref) : '');
  const rows = watchlistMonitor(saved,{catalog:series,events,now,sort:state.watchlistSort,group:state.watchlistGroup}).map(({id,nextEvent,nextCatalyst}) => {
    const current = getSeries(id), observation = latest(current);
    const inComparison = selected.includes(id), full = selected.length >= 4 && !inComparison;
    const compare = button(inComparison ? 'VIEW COMPARISON' : 'ADD TO COMPARISON', `data-add-compare="${esc(id)}"${full ? ' disabled title="Comparison holds four series. Remove one before adding another."' : ''}`)+`<p class="small"><span class="pill">${esc(monitorUpdateLabel(id,changes,checkpoint))}</span></p>`;
    const remove = button('REMOVE', `data-save="${esc(id)}" aria-label="Remove ${esc(current.name)} from watchlist" aria-pressed="true"`, 'link-button');
    const order=state.watchlistSort&&state.watchlistSort!=='manual'?'':button('↑',`data-watch-move="${esc(id)}" data-direction="-1" aria-label="Move ${esc(current.name)} up"${saved.indexOf(id)===0?' disabled':''}`)+button('↓',`data-watch-move="${esc(id)}" data-direction="1" aria-label="Move ${esc(current.name)} down"${saved.indexOf(id)===saved.length-1?' disabled':''}`);
    const eventLink=event=>link(`${event.name} · ${humanDate(event.date)}${event.time?' '+event.time+' ET':''}`,`#/calendar?month=${
  event.date.slice(0,7)}&event=${encodeURIComponent(event.id)}`);
    const schedule=(nextEvent?`<p class="small muted">${nextEvent.sourceId==='fomc'?'Next policy update':'Next release'}</p>${eventLink(nextEvent)}`:'<p class="small muted">Next release not in retained schedule.</p>')+(nextCatalyst?`<p class="small muted">Related catalyst · does not publish this measurement</p>${eventLink(nextCatalyst)}`:'');
    return `<tr><th scope="row"><a href="${esc(indicatorHref(id, state))}">${esc(current.name)}</a><span class="table-code mono muted">${esc
  (current.code)}</span><span class="table-code muted">${esc(state.watchlistGroup?current.topic+' · ':'')}${esc(current.frequency)} · ${esc
  (seriesStatus(current))}</span>${current.error ? `<span class="table-code amber">${esc(current.error)}</span>` : ''
  }</th><td class="num" data-label="Latest value"><strong>${esc(formatValue(current, observation?.value))
  }</strong><span class="table-code muted">${esc(current.unit)}</span></td><td class="mono" data-label="Observation period">${esc(observation ?
   periodLabel(current, observation.date) : 'Unavailable')}</td><td data-label="Change and next release"><p>${esc(measurementChange
  (current).text)}</p><p class="small muted">${observation?.revisionIndicator==='Y'?'Source revision flag; reason unknown. ':''
  }Latest retained period; collected ${esc(humanTimestamp(current.fetchedAt)||'No successful retrieval')}.</p>${schedule}${supportingDetails
  (`watchlist:${id}:source`, 'Source & coverage', `${sourceLink(current)}<span class="table-code muted">Reference dates: ${esc(coverage(current))
  }</span>`)}</td><td data-label="Actions"><div class="actions">${link('OPEN', indicatorHref(id, state))}${compare}${supportingDetails
  (`watchlist:${id}:edit`,'Edit order or remove',`<div class="actions">${order}${remove}</div>`)}</div></td></tr>`;
  }).join('');
  const body = rows
    ? table(['SAVED INDICATOR / CODE', {label:'LATEST',numeric:true}, 'OBSERVATION', 'CHANGE / NEXT RELEASE / EVIDENCE', 'ACTIONS'], rows, 'Saved indicators, actual reference-date coverage and separate source retrieval times')
    : emptyState('No saved series.', 'Find an indicator in the catalog and use Follow to add it to your watchlist.', link('FIND SERIES', catalogHref));
  const lists=input.watchlists?.length?input.watchlists:[{id:'default',name:'My watchlist',saved}],active=lists.find(row=>row.id===input.activeWatchlistId)??lists[0];
  const named=`<div class="toolbar"><label for="watchlist-active">Named watchlist<select id="watchlist-active">${lists.map(row=>`<option value="${esc(row.id)}"${row.id===active.id?' selected':''}>${esc(row.name)}</option>`).join('')}</select></label>${button('NEW LIST','data-create-watchlist')}</div>${supportingDetails('watchlist:edit','Edit watchlist name or remove list',`<div class="toolbar"><label for="watchlist-name">List name<input id="watchlist-name" value="${esc(active.name)}" maxlength="80"></label>${button('RENAME LIST','data-rename-watchlist')}${button('DELETE LIST',`data-delete-watchlist${lists.length<2?' disabled':''}`,'link-button')}</div>`)} `;
  const portable=supportingDetails('watchlist:settings','Portable settings',
  (`<p class="panel-note">Export or import named watchlists, their order, saved view `+
  `configurations and display preferences. Saved snapshots are separate JSON packages. Import `+
  `keeps existing lists and views; different records sharing an ID are added as separate `+
  `copies.</p><div class="actions">${button('EXPORT SETTINGS','data-export-settings')
  }</div><label for="research-settings-import">Import settings (JSON)<input `+
  `id="research-settings-import" type="file" accept=".json,application/json"></label>`));
  return heading('WATCHLIST', 'Saved indicators · source coverage and comparison workspace', actions)
    + `<div class="workspace-basis">`+readingGroup('Named watchlists',named)+`</div><div class="workspace-analysis">`+panel('01', 'SAVED SERIES',
   body, `<span class="small muted">${saved.length} SERIES</span>`, `Comparison: ${selected.length
  }/4 series. Add up to four series; each keeps its own units and observation dates.`)+`</div><div class="workspace-basis">`+readingGroup
  ('Monitor scope',(`<p class="panel-note">${checkpoint.enabled?`Captured changes since ${esc(humanTimestamp(checkpoint.since)
  ||'your local checkpoint')}.`:'Data updates on return are off.'} <a href="#/research?view=changes">Manage comparison checkpoint</a>. A captured value `+
  `change is separate from a verified publication revision.</p>${changes.status==='error'?`<p class="panel-note amber">${esc(changes.error)} ${
  button('RETRY UPDATE HISTORY','data-retry-changes')}</p>`:''}`)
    + `<div class="toolbar"><label for="watchlist-sort">Order<select id="watchlist-sort">${[['manual','My order'],['updated','Newest retrieval'],['next','Next release']].map(([id,label])=>`<option value="${id}"${(state.watchlistSort??'manual')===id?' selected':''}>${label}</option>`).join('')}</select></label><label class="check-label"><input type="checkbox" id="watchlist-group"${state.watchlistGroup?' checked':''}>Group by topic</label></div>`
    + `<p class="panel-note"${state.storageAvailable === false ? ' role="status"' : ''}>${esc(persistence)}</p>`)+portable+`</div>`
    + '';
}
