import {currentAccountGdpHistory} from './current-account-gdp.js';
import {currentAccountGdpSourceStatus} from './current-account-gdp-view.js';
import {BEA_ITA_LICENSE} from './current-account-registry.js';
import {rangeControls} from './research-controls.js';
import {panel,table,button,emptyState,escapeHtml as esc} from './ui.js';

export const CURRENT_ACCOUNT_GDP_CHART='current-account-gdp-history';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const ratio=value=>finite(value)?`${value.toFixed(2)}%`:'Unavailable';
const dollars=value=>finite(value)?value.toLocaleString('en-US',{maximumFractionDigits:6}):'Unavailable';

/** One shared calculated series drives the Graphite chart, selected table and CSV. */
export function currentAccountGdpHistoryPanel(sources={},range={preset:'all'},{frozen=false,controls='',state=null}={}){
 const result=currentAccountGdpHistory(sources,range),shown=result.observations,all=result.series.observations;
 const available=shown.some(row=>finite(row.value)),missing=shown.filter(row=>!finite(row.value)).length;
 const chart=result.error?emptyState('Ratio history unavailable.',result.error):!shown.length?emptyState('No retained quarters in this window.','Choose another date window; missing history is not fabricated.')
  :!available?emptyState('Ratio history unavailable for this window.','All selected quarters have missing or invalid inputs. Inspect the data table and CSV for their reasons.')
  :`<div class="chart" data-chart data-chart-catalog="${CURRENT_ACCOUNT_GDP_CHART}" data-series="currentAccountToGdp" data-kind="line" data-transform="level" data-comparison="native" data-height="260" data-range="${esc(JSON.stringify(range))}"><p class="chart-fallback muted">Current account / nominal GDP · calculated history chart loading.</p></div>`;
 const bounds=rows=>rows.length?`${rows[0].date} to ${rows.at(-1).date}`:'none';
 const coverage=`<p class="panel-note">${frozen?'Frozen calculated metric':'Calculated metric'} · ${esc(result.window.label)}. Retained: ${all.length} quarters · ${esc(bounds(all))}. Displayed: ${shown.length} quarters · ${esc(bounds(shown))} · ${missing} missing. Ratio units: percent of nominal GDP; changes are percentage points.</p>`;
 const rows=shown.slice(0,50).map(row=>`<tr><th scope="row">${esc(row.date)}${row.reason?`<span class="table-code amber">${esc(row.reason)}</span>`:''}</th><td class="num">${esc(ratio(row.value))}</td><td class="num">${esc(dollars(row.currentAccountBalance))}</td><td class="num">${esc(dollars(row.nominalGdpSaar))}</td><td class="num">${esc(dollars(row.nominalGdpQuarter))}</td></tr>`).join('');
 const data=shown.length?`<details class="frozen-observations"><summary>Data table · First ${Math.min(50,shown.length)} of ${shown.length} selected quarters</summary>${table(['REFERENCE QUARTER',{label:'RATIO',numeric:true},{label:'CURRENT ACCOUNT · QUARTER / $B',numeric:true},{label:'NOMINAL GDP · SAAR / $B',numeric:true},{label:'GDP · SAAR ÷ 4 / $B',numeric:true}],rows,'Calculated historical current-account-to-GDP observations and exact-quarter inputs')}<p class="panel-note">The complete selected window and original input strings are retained in the history CSV.</p></details>`:'';
 const dateControls=state?rangeControls(state,[result.series.id],{catalog:{[result.series.id]:result.series}}):controls;
 const body=(frozen?'':dateControls)+coverage+chart+data
  +`<p class="panel-note">${esc(result.formula)}. Exact same-quarter inputs; GDP SAAR is divided by four once. Missing quarters remain gaps, with no interpolation. ${esc(result.notice)}</p>`
  +currentAccountGdpSourceStatus(sources,{frozen})
  +`<p class="panel-note">Source: U.S. Bureau of Economic Analysis. History calculated by Meridian from retained revised inputs; this is not historical first-release information. Reference dates mark quarter starts, not release or retrieval dates. <a href="${BEA_ITA_LICENSE}" target="_blank" rel="noopener noreferrer">BEA reuse terms ↗</a></p>`;
 return panel('H',`${frozen?'FROZEN ':''}HISTORICAL CURRENT ACCOUNT / GDP`,body,frozen?'':button('CSV HISTORY & INPUTS',`data-export-current-account-gdp-history${result.error||!shown.length?' disabled title="A valid window with retained quarters is required."':''}`));
}

/** Explicit live/frozen binding; no scoped chart can acquire global observations. */
export function currentAccountGdpHistoryChartCatalog(sources={}, {frozen=false}={}){
 const {series}=currentAccountGdpHistory(sources);
 return {[CURRENT_ACCOUNT_GDP_CHART]:{catalog:{[series.id]:series},evidenceLabel:frozen?'Frozen calculated ratio · recorded BEA inputs':'Calculated ratio · captured BEA inputs'}};
}
