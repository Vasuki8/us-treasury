import {CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES,currentAccountGdpComparison,resolveCurrentAccountComparisonMeasure} from './current-account-gdp-comparison.js';
import {currentAccountGdpTrailingCsv} from './current-account-gdp-trailing-view.js';
import {currentAccountGdpSourceStatus} from './current-account-gdp-view.js';
import {BEA_ITA_LICENSE} from './current-account-registry.js';
import {periodLabel} from './model.js';
import {panel,table,button,emptyState,escapeHtml as esc} from './ui.js';

export const CURRENT_ACCOUNT_GDP_COMPARISON_CHART='current-account-gdp-comparison';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const number=(value,digits=3)=>finite(value)?value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'Unavailable';
const percent=value=>finite(value)?`${number(value)}%`:'Unavailable';
const quarter=date=>date?periodLabel({frequency:'Quarterly'},date):'Unavailable';

export function currentAccountGdpComparisonPanel(sources={},range={preset:'all'},{measure='currentAccountBalance',frozen=false}={}){
 const selected=resolveCurrentAccountComparisonMeasure(measure),result=currentAccountGdpComparison(sources,range,selected),rows=result.observations,latest=rows.at(-1);
 const comparisons=CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES.map(item=>({measure:item,result:item.id===selected?result:currentAccountGdpComparison(sources,range,item.id)}));
 const hasValues=rows.some(row=>finite(row.quarterly.value)||finite(row.trailing.value));
 const chart=result.error?emptyState('Quarterly versus trailing comparison unavailable.',result.error):!rows.length?emptyState('No retained quarters in this window.','Choose another shared date window above.')
  :!hasValues?emptyState('Comparison observations unavailable.','Neither horizon has compatible nonmissing inputs in this window. The table and export retain the reasons.')
  :`<div class="chart" data-chart data-chart-catalog="${CURRENT_ACCOUNT_GDP_COMPARISON_CHART}" data-series="${esc(result.series.map(item=>item.id).join(','))}" data-kind="line" data-transform="level" data-comparison="native" data-height="280" data-range="${esc(JSON.stringify(range))}"><p class="chart-fallback muted">${esc(result.measure.label)} · quarterly and trailing-four-quarter calculated ratios loading.</p></div>`;
 const selector=frozen?`<p class="panel-note"><strong>Frozen comparison balance:</strong> ${esc(result.measure.label)}</p>`
  :`<div class="toolbar macro-family-controls"><label for="current-account-comparison-measure">Comparison balance<select id="current-account-comparison-measure" aria-label="Comparison balance">${CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES.map(item=>`<option value="${esc(item.id)}"${item.id===selected?' selected':''}>${esc(item.label)}</option>`).join('')}</select></label><p class="small muted">Select the total or a component. This also sets the focused history measure below.</p></div>`;
 const compareRows=comparisons.map(({measure:item,result:comparison})=>{
  const point=comparison.observations.at(-1),reason=point?.gapReason;
  return `<tr><th scope="row">${esc(item.label)}${reason?`<span class="table-code amber">${esc(reason)}</span>`:''}</th><td class="num">${esc(percent(point?.quarterly.value))}</td><td class="num">${esc(percent(point?.trailing.value))}</td><td class="num">${esc(number(point?.gap))}</td></tr>`;
 }).join('');
 const latestTable=latest?`<p class="panel-note"><strong>What changed · ending ${esc(quarter(latest.date))}:</strong> compare the single quarter with ${esc(quarter(latest.trailing.inputPoints?.[0]?.date))} through ${esc(quarter(latest.date))}. Quarterly minus trailing is a gap between different flow horizons, in percentage points. Missing values use this endpoint; the table never falls back to an older available quarter.</p>`
  +table(['BALANCE · SAME ENDING QUARTER',{label:'QUARTERLY / GDP · %',numeric:true},{label:'TRAILING FOUR QUARTERS / GDP · %',numeric:true},{label:'QUARTERLY MINUS TRAILING · PP',numeric:true}],compareRows,'Current-account total and four components compared at the latest selected ending reference quarter'):'';
 const historyRows=rows.slice(0,50).map(row=>`<tr><th scope="row">${esc(quarter(row.date))}${row.gapReason?`<span class="table-code amber">${esc(row.gapReason)}</span>`:''}</th><td class="num">${esc(percent(row.quarterly.value))}</td><td class="num">${esc(percent(row.trailing.value))}</td><td class="num">${esc(number(row.gap))}</td></tr>`).join('');
 const history=rows.length?`<details class="frozen-observations"><summary>Comparison data table · First ${Math.min(50,rows.length)} of ${rows.length} selected endpoints</summary>${table(['ENDING REFERENCE QUARTER',{label:'QUARTERLY · %',numeric:true},{label:'TRAILING FOUR QUARTERS · %',numeric:true},{label:'GAP · PP',numeric:true}],historyRows,`${result.measure.label} quarterly versus trailing-four-quarter ratio history`)}<p class="panel-note">CSV contains the complete selected comparison, original supporting quarterly inputs, source evidence and the four-quarter lookback.</p></details>`:'';
 const body=selector+`<p class="panel-note"><strong>${frozen?'Frozen calculated ratios':'Calculated ratios'}</strong> · ${esc(result.measure.label)} · ${esc(result.window.label)} · ${rows.length} selected ending quarters. Both lines use percent of nominal GDP. Chart readouts identify Quarterly and Trailing four quarters.</p>`
  +chart+latestTable+history
  +`<p class="panel-note"><strong>Calculation:</strong> Quarterly = 100 × quarter balance / (same-quarter GDP SAAR / 4). Trailing four quarters = 100 × sum of four consecutive quarterly balances / sum of those four GDP SAAR values divided by four. These ratios have different flow horizons and denominators. The trailing ratio is a ratio of sums, not an average of quarterly ratios.</p>`
  +`<p class="panel-note"><strong>Why it matters:</strong> shows how the latest quarter differs from a full four-quarter view of trade, income or current transfers relative to production. The displayed gap is not a revision, a quarter-to-quarter change, an annual growth rate or a causal explanation. Adjacent trailing windows overlap by three quarters. Published total and component rounding distinctions remain in the accounting panels.</p>`
  +`<p class="panel-note"><strong>Limitations:</strong> retained revised BEA inputs can have different retrieval vintages; these are Meridian calculations, not separately published BEA ratios or original release vintages. Exact ending dates are matched and missing observations remain gaps. A valid quarterly observation can remain visible when the four-quarter window is incomplete. Reference dates identify quarters, not publication timestamps. Primary income includes investment income and employee compensation; secondary income comprises current transfers. ITA balances differ from NIPA net exports.</p>`
  +currentAccountGdpSourceStatus(sources,{frozen})
  +`<p class="panel-note">BEA ITA Table 1.1 line 30 and lines 32–35; nominal GDP A191RC, NIPA Table 1.1.5. ITA table release: ${esc(sources.beaIta?.tableReleaseDate??'unknown')} (table vintage, not each quarter's original publication). Source: U.S. Bureau of Economic Analysis. Comparison calculated by Meridian. <a href="${BEA_ITA_LICENSE}" target="_blank" rel="noopener noreferrer">BEA reuse terms ↗</a>${frozen?' The retained current-account-gdp-trailing.csv includes this comparison and its original inputs.':''}</p>`;
 return panel('Q/T4Q',`${frozen?'FROZEN ':''}QUARTERLY VS TRAILING FOUR QUARTERS`,body,frozen?'':button('CSV COMPARISON & INPUTS',`data-export-current-account-gdp-comparison${result.error||!rows.length?' disabled title="A valid window with retained ending quarters is required."':''}`));
}

export function currentAccountGdpComparisonChartCatalog(sources={}, {frozen=false}={}){
 const series=CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES.flatMap(item=>currentAccountGdpComparison(sources,{preset:'all'},item.id).series);
 return {[CURRENT_ACCOUNT_GDP_COMPARISON_CHART]:{catalog:Object.fromEntries(series.map(item=>[item.id,item])),evidenceLabel:frozen?'Frozen calculated quarterly and trailing ratios · recorded BEA inputs':'Calculated quarterly and trailing ratios · captured BEA inputs'}};
}

/** Reuse the complete T4Q evidence export and append only the selected paired metrics. */
export function currentAccountGdpComparisonCsv(sources={},range={preset:'all'},measure='currentAccountBalance'){
 return currentAccountGdpTrailingCsv(sources,range,{comparisonMeasure:resolveCurrentAccountComparisonMeasure(measure)});
}
