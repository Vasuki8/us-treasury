import {CURRENT_ACCOUNT_GDP_COMPONENTS,currentAccountGdpBreakdown} from './current-account-gdp-breakdown.js';
import {currentAccountGdpQuarterSpan} from './current-account-gdp.js';
import {currentAccountGdpInput,currentAccountGdpSourceStatus} from './current-account-gdp-view.js';
import {BEA_ITA_LICENSE} from './current-account-registry.js';
import {csvCell,tabularCsv} from './model.js';
import {panel,table,button,emptyState,escapeHtml as esc} from './ui.js';

export const CURRENT_ACCOUNT_GDP_BREAKDOWN_CHART='current-account-gdp-breakdown';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const number=(value,digits=2)=>finite(value)?value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'Unavailable';
const percent=value=>finite(value)?`${number(value)}%`:'Unavailable';
const CREDIT='Source: U.S. Bureau of Economic Analysis. Component ratios and reconciliation calculated by Meridian.';
const LIMITATIONS='Retained revised BEA histories, not historical first-release vintages. Component ratio changes reflect both the balance and GDP denominator; these accounting comparisons are not causal explanations or GDP-growth contributions. Published total less component sum is a rounding residual, not an economic component. Unknown publication dates remain unknown.';
const exactPrior=(current,prior)=>current&&prior&&currentAccountGdpQuarterSpan(prior.date,current.date)===2;
const change=(current,prior)=>finite(current)&&finite(prior)?current-prior:null;
const definitions=[...CURRENT_ACCOUNT_GDP_COMPONENTS.map(item=>({...item,point:row=>row.components[item.id]})),
 {id:'currentAccountBalance',ratioId:'currentAccountToGdp',label:'Published total',point:row=>row.total},
 {id:null,ratioId:'currentAccountComponentSumToGdp',label:'Component sum',point:row=>aggregate(row,false)},
 {id:null,ratioId:'currentAccountRoundingResidualToGdp',label:'Rounding residual',point:row=>aggregate(row,true)}];
function aggregate(row,residual){
 return {...row.total,value:residual?row.residual:row.componentSum,currentAccountBalance:residual?row.residualBalance:row.componentSumBalance,numeratorObservation:null,
  reason:finite(residual?row.residual:row.componentSum)?null:'Reconciliation requires the published total and all four valid components for this exact quarter.'};
}

/** Four native percent lines share the total history's existing date-window controls. */
export function currentAccountGdpBreakdownPanel(sources={},range={preset:'all'},{frozen=false}={}){
 const result=currentAccountGdpBreakdown(sources,range),rows=result.observations,all=result.series[0]?.observations??[];
 const missing=rows.reduce((count,row)=>count+CURRENT_ACCOUNT_GDP_COMPONENTS.filter(({id})=>!finite(row.components[id]?.value)).length,0);
 const hasValues=rows.some(row=>CURRENT_ACCOUNT_GDP_COMPONENTS.some(({id})=>finite(row.components[id]?.value)));
 const chart=result.error?emptyState('Breakdown history unavailable.',result.error):!rows.length?emptyState('No retained quarters in this window.','Change the shared date window above; missing observations are not fabricated.')
  :!hasValues?emptyState('Breakdown history unavailable for this window.','All component ratios have missing or invalid inputs. The table and CSV retain their reasons.')
  :`<div class="chart" data-chart data-chart-catalog="${CURRENT_ACCOUNT_GDP_BREAKDOWN_CHART}" data-series="${CURRENT_ACCOUNT_GDP_COMPONENTS.map(item=>item.ratioId).join(',')}" data-kind="line" data-transform="level" data-comparison="native" data-height="280" data-range="${esc(JSON.stringify(range))}"><p class="chart-fallback muted">Goods, services, primary income and secondary income / GDP · calculated history chart loading.</p></div>`;
 const latest=rows.at(-1),prior=exactPrior(latest,rows.at(-2))?rows.at(-2):null;
 const detailRows=latest?definitions.map(item=>{
  const point=item.point(latest),previous=prior?item.point(prior):null,isResidual=item.ratioId==='currentAccountRoundingResidualToGdp';
  return `<tr><th scope="row">${esc(item.label)}${point.reason?`<span class="table-code amber">${esc(point.reason)}</span>`:''}</th><td class="num">${esc(number(point.currentAccountBalance,isResidual?6:3))}</td><td class="num">${esc(number(point.value,isResidual?8:3))}</td><td class="num">${esc(number(change(point.value,previous?.value),isResidual?8:3))}</td></tr>`;
 }).join(''):'';
 const current=latest?`<p class="panel-note"><strong>What changed · ${esc(latest.date)} reference quarter:</strong> published current-account balance / GDP ${esc(percent(latest.total.value))}; change ${esc(number(change(latest.total.value,prior?.total.value),3))} percentage points versus ${esc(prior?.date??'an unavailable exact preceding quarter in this window')}. The component rows show which balances offset or add to the total.</p>`
  +table(['LATEST SELECTED QUARTER','BALANCE · QUARTER / $B','RATIO / GDP · %','CHANGE · PP'],detailRows,'Latest selected current-account components, published total and rounding reconciliation'):'No selected observations.';
 const historyRows=rows.slice(0,50).map(row=>`<tr><th scope="row">${esc(row.date)}</th>${CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id})=>`<td class="num"${row.components[id]?.reason?` title="${esc(row.components[id].reason)}"`:''}>${esc(percent(row.components[id]?.value))}</td>`).join('')}<td class="num">${esc(percent(row.total.value))}</td><td class="num">${esc(percent(row.componentSum))}</td><td class="num">${esc(number(row.residual,8))}</td></tr>`).join('');
 const history=rows.length?`<details class="frozen-observations"><summary>Breakdown data table · First ${Math.min(50,rows.length)} of ${rows.length} selected quarters</summary>${table(['REFERENCE QUARTER','GOODS · %','SERVICES · %','PRIMARY INCOME · %','SECONDARY INCOME · %','PUBLISHED TOTAL · %','COMPONENT SUM · %','RESIDUAL · PP'],historyRows,'Historical current-account component ratios with published total and rounding residual')}<p class="panel-note">The CSV contains all selected quarters, original input strings, exact-quarter changes and missing-data reasons.</p></details>`:'';
 const bounds=all.length?`${all[0].date} to ${all.at(-1).date}`:'none';
 const body=`<p class="panel-note"><strong>${frozen?'Frozen calculated metrics':'Calculated metrics'}</strong> · Shared window: ${esc(result.window.label)}. Retained: ${all.length} quarters · ${esc(bounds)}. Displayed: ${rows.length} quarters · ${missing} missing component observations. Positive balances offset negative balances; changes are percentage points.</p>`
  +chart+current+history
  +`<p class="panel-note"><strong>Calculation:</strong> 100 × each quarterly balance / (nominal GDP SAAR / 4). GDP SAAR is divided by four once, using the same exact-quarter denominator for all four components and the published total. Rounding residual = published total − component sum; displayed precision does not change calculations. Missing components stay gaps, with no zero filling or interpolation. The table's changes require the exact preceding quarter inside this window.</p>`
  +`<p class="panel-note"><strong>Why it matters:</strong> separates trade, income and current-transfer balances relative to domestic production. Primary income includes investment income and employee compensation. Secondary income covers current transfers, including remittances and current government transfers. These are international-transactions balances, distinct from NIPA net exports.</p>`
  +`<p class="panel-note"><strong>Limitations:</strong> ${esc(LIMITATIONS)} ITA and GDP can have different retrieval vintages and either input can revise. These are Meridian calculations from official inputs, not separately published BEA ratios.</p>`
  +currentAccountGdpSourceStatus(sources,{frozen})
  +`<p class="panel-note">ITA Table 1.1 lines 32–35; published total line 30. ITA table release: ${esc(sources.beaIta?.tableReleaseDate??'unknown')} (table vintage, not each quarter's original publication). Reference dates mark quarter starts. Inputs are seasonally adjusted current-dollar flows; raw ITA values are quarterly, while raw GDP is annualized. ${CREDIT} <a href="${BEA_ITA_LICENSE}" target="_blank" rel="noopener noreferrer">BEA reuse terms ↗</a></p>`;
 return panel('B',`${frozen?'FROZEN ':''}HISTORICAL CURRENT ACCOUNT / GDP · BREAKDOWN`,body,frozen?'':button('CSV BREAKDOWN & INPUTS',`data-export-current-account-gdp-breakdown${result.error||!rows.length?' disabled title="A valid window with retained quarters is required."':''}`));
}

export function currentAccountGdpBreakdownChartCatalog(sources={}, {frozen=false}={}){
 const result=currentAccountGdpBreakdown(sources);
 return {[CURRENT_ACCOUNT_GDP_BREAKDOWN_CHART]:{catalog:Object.fromEntries(result.series.map(item=>[item.id,item])),evidenceLabel:frozen?'Frozen calculated component ratios · recorded BEA inputs':'Calculated component ratios · captured BEA inputs'}};
}

/** One row per quarter retains every input without repeating shared receipts seven times. */
export function currentAccountGdpBreakdownCsv(sources={},range={preset:'all'}){
 const result=currentAccountGdpBreakdown(sources,range),d=currentAccountGdpInput(sources.bea,'nominalGdp'),n=currentAccountGdpInput(sources.beaIta,'currentAccountBalance');
 const metrics=['value_percent','change_percentage_points','balance_quarter_billions','missing','unavailable_reason'];
 const observed=definitions.filter(item=>item.id),evidence=['source_value','source_period_label','source_ids','publication_date','footnotes_json'];
 const headers=['reference_quarter','date_convention','unit','observation_type','balance_unit',
  ...definitions.flatMap(item=>metrics.map(field=>`${item.ratioId}_${field}`)),
  ...observed.flatMap(item=>evidence.map(field=>`${item.id}_${field}`)),
  'numerator_source_unit','numerator_source_url','numerator_source_title','numerator_retrieved_at','numerator_source_captured_at','numerator_capture_status','ita_table_release_date','numerator_provenance_json',
  'denominator_saar_value','denominator_saar_unit','denominator_quarter_value','denominator_quarter_unit','denominator_saar_divisor','denominator_source_value','denominator_source_unit','denominator_source_period_label','denominator_source_ids','denominator_source_url','denominator_source_title','denominator_retrieved_at','denominator_source_captured_at','denominator_capture_status','denominator_publication_date','denominator_footnotes_json','denominator_provenance_json','calculation','limitations','attribution','numerator_license_url','denominator_license_url'];
 const csvRows=(result.error?[]:result.observations).map((row,index)=>{
  const prior=exactPrior(row,result.observations[index-1])?result.observations[index-1]:null;
  const gdp=row.total.denominatorObservation;
  return [row.date,'quarter-start','Percent of nominal GDP','calculated','USD billions per quarter (not annualized)',
   ...definitions.flatMap(item=>{const point=item.point(row),previous=prior?item.point(prior):null;return [point.value,change(point.value,previous?.value),point.currentAccountBalance,!finite(point.value),point.reason];}),
   ...observed.flatMap(item=>{const ca=item.point(row).numeratorObservation;return [ca?.sourceValue??null,ca?.sourcePeriodLabel??null,(sources.beaIta?.series?.[item.id]?.sourceIds??[]).join('; '),ca?.publishedAt??null,JSON.stringify(ca?.footnotes??[])];}),
   'USD millions per quarter (not annualized)',n.url,n.title,n.retrievedAt,n.capturedAt,n.status,sources.beaIta?.tableReleaseDate??null,JSON.stringify(n.provenance),
   row.total.nominalGdpSaar,'USD billions (SAAR)',row.total.nominalGdpQuarter,'USD billions per quarter',4,gdp?.sourceValue??null,'USD millions (SAAR)',gdp?.sourcePeriodLabel??null,(d.item.sourceIds??[]).join('; '),d.url,d.title,d.retrievedAt,d.capturedAt,d.status,gdp?.publishedAt??null,JSON.stringify(gdp?.footnotes??[]),JSON.stringify(d.provenance),
   '100 × each quarterly balance (USD billions) / (nominal GDP (USD billions, SAAR) / 4); component sum = sum of four ratios; rounding residual = published total ratio minus component sum.',LIMITATIONS+' CSV changes require the exact preceding quarter in this export; the first selected quarter has no exported change.',CREDIT,n.license,d.license];
 });
 const raw=new Set(headers.flatMap((key,index)=>key.endsWith('_source_value')?[index]:[]));
 return tabularCsv(headers,[])+csvRows.map(row=>row.map((value,i)=>csvCell(value,raw.has(i))).join(',')+'\r\n').join('');
}
