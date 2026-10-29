import {getSeries,transformSeries} from './model.js';
import {resolveDateWindow} from './date-window.js';
import {viewRange} from './workspace-context.js';
import {button,escapeHtml as esc} from './ui.js';

export function rangeControls(state,ids,{catalog,observationDescription='Each series uses its own observation count; choose a year preset for a shared calendar window.'}={}) {
  const sources=ids.map(id=>catalog?catalog[id]:getSeries(id)).filter(Boolean),range=viewRange(state),resolved=resolveDateWindow(range,sources);
  const shown=resolved.mode==='observations'?sources.flatMap(s=>transformSeries(s,'level',range).observations.map(o=>o.date)).sort():[];
  const custom=state.window==='custom';
  const start=custom?state.startDate:shown[0]??resolved.startDate??'',end=custom?state.endDate:shown.at(-1)??resolved.endDate??'';
  return `<div class="date-window-controls"><div class="actions" role="group" aria-label="Date window">${[['1y','1Y'],['3y','3Y'],['5y','5Y'],['all','ALL HISTORY']].map(([value,label])=>button(label,`data-window="${value}" aria-pressed="${state.window===value}"`)).join('')}${[6,12].map(value=>button(`${value} OBS`,`data-range="${value}" aria-pressed="${state.window==='observations'&&state.range===value}"`)).join('')}</div><div class="date-window-inputs"><label for="window-start">Start reference date (UTC)<input id="window-start" type="date" value="${esc(start)}" aria-describedby="window-description"></label><label for="window-end">End reference date (UTC)<input id="window-end" type="date" value="${esc(end)}" aria-describedby="window-description"></label></div><p class="small muted" id="window-description">${esc(resolved.label)}. ${resolved.mode==='observations'?esc(observationDescription):'Calendar presets end at the latest retained reference date; comparisons use one shared window.'} Original frequencies and missing values are preserved.</p>${resolved.error?`<p class="window-error amber" role="alert">${esc(resolved.error)}</p>`:''}</div>`;
}

export function coverageSummary(panel) {
  const all=panel.series?.observations??[],shown=panel.observations??[],missing=shown.filter(o=>!Number.isFinite(o.value)).length;
  const bounds=rows=>rows.length?`${rows[0].date} to ${rows.at(-1).date}`:'no observations';
  const retained=panel.series?.retainedCoverage;
  const count=retained?.count??all.length;
  const retainedDates=retained?.startDate?`${retained.startDate} to ${retained.endDate}`:bounds(all);
  return '<p class="panel-note coverage-summary">'
    +`Retained: ${count} observations · reference dates ${esc(retainedDates)}. `
    +`Displayed: ${shown.length} observations · ${esc(bounds(shown))}`
    +(missing?` · ${missing} missing or suppressed`:'')
    +`. Retrieval: ${esc(panel.series?.fetchedAt??'unavailable')}. Reference dates are not verified release times.</p>`;
}

export function measureLabel(current){return current.observationType==='calculated'?'Calculated metric':current.observationType==='modeled'?'Model estimate':'Official observation';}
export function changeLabel(current){return current.format==='index'?'Index-point change':current.format==='percent'?(current.id==='yield'||current.changeInBasisPoints?'Basis-point change':'Percentage-point change'):['percentagePoints','basisPoints'].includes(current.format)?`${current.format==='basisPoints'?'Basis-point':'Percentage-point'} change`:'Change between observations';}
