import {currentAccountGdpContributions} from './current-account-gdp-contributions.js';
import {currentAccountGdpBalanceEffects,CURRENT_ACCOUNT_GDP_BALANCE_EFFECTS_CHART} from './current-account-gdp-balance-effects.js';
import {CURRENT_ACCOUNT_GDP_COMPONENTS} from './current-account-gdp-breakdown.js';
import {currentAccountGdpRatioInputs} from './current-account-gdp.js';
import {currentAccountGdpInput,currentAccountGdpSourceStatus} from './current-account-gdp-view.js';
import {BEA_ITA_LICENSE} from './current-account-registry.js';
import {csvCell,tabularCsv,periodLabel} from './model.js';
import {panel,table,button,emptyState,escapeHtml as esc} from './ui.js';

export const CURRENT_ACCOUNT_GDP_CONTRIBUTIONS_CHART='current-account-gdp-contributions';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const number=(value,digits=3)=>finite(value)?value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'Unavailable';
const quarter=date=>date?periodLabel({frequency:'Quarterly'},date):'Unavailable';
const horizons=[['quarterly','Quarterly'],['trailing','Trailing four quarters']];
const attribution='Source: U.S. Bureau of Economic Analysis. Accounting contributions calculated by Meridian.';
const limitations='Meridian calculated accounting contributions, not official BEA growth contributions or causal explanations. GDP denominator changes are already included in component ratio changes. Adjacent trailing windows overlap by three quarters. Retained revised inputs may have different retrieval vintages; these are not historical first-release vintages. Reference quarters differ from publication and retrieval dates. Missing inputs are not filled or interpolated.';
const definitions=[...CURRENT_ACCOUNT_GDP_COMPONENTS,{id:'componentSum',label:'Sum of component contributions'},{id:'residual',label:'Reconciliation residual change'},{id:'currentAccountBalance',label:'Published total change'}];
const contribution=(h,id)=>id==='currentAccountBalance'?h.totalChange:id==='componentSum'?h.componentSumChange:id==='residual'?h.residualChange:h.components[id].value;
const reason=(h,id)=>finite(contribution(h,id))?null:h.components[id]?.reason||h.reason||'Complete current and prior published totals and all four components are required for reconciliation.';
const ratio=(row,id)=>!row?null:id==='currentAccountBalance'?row.total.value:id==='componentSum'?row.componentSum:id==='residual'?row.residual:row.components[id].value;
const inputDates=(row,horizon)=>!row?[]:horizon==='trailing'?row.inputDates:[row.date];

export function currentAccountGdpContributionsPanel(sources={},range={preset:'all'},{frozen=false,packageId=null}={}){
 const result=currentAccountGdpContributions(sources,range),rows=result.error?[]:result.observations,latest=rows.at(-1);
 const charts=result.error?emptyState('Component contributions unavailable.',result.error):!rows.length?emptyState('No retained ending quarters in this window.','Choose another shared date window above.'):horizons.map(([key,label])=>{
  const available=rows.some(row=>CURRENT_ACCOUNT_GDP_COMPONENTS.some(({id})=>finite(row[key].components[id].value)));
  return `<p class="panel-note"><strong>${esc(label)} · component contributions to change · percentage points</strong></p>`+(available?`<div class="chart" data-chart data-chart-catalog="${CURRENT_ACCOUNT_GDP_CONTRIBUTIONS_CHART}" data-series="${esc(result.series[key].map(item=>item.id).join(','))}" data-kind="line" data-transform="level" data-comparison="native" data-cursor-group="current-account-contributions" data-height="240" data-range="${esc(JSON.stringify(range))}"><p class="chart-fallback muted">${esc(label)} calculated contributions loading.</p></div>`:emptyState(`${label} contributions unavailable.`,'Each component requires valid ratios at both exact adjacent endpoints. Available totals and missing reasons remain in the table and export.'));
 }).join('');
 const latestTable=latest?`<p class="panel-note"><strong>What changed · ${esc(quarter(latest.date))} versus ${esc(quarter(latest.priorDate))}:</strong> quarterly published-total change ${esc(number(latest.quarterly.totalChange))} pp; trailing-four-quarter published-total change ${esc(number(latest.trailing.totalChange))} pp. Both columns compare adjacent ending quarters. Positive contributions move toward surplus; negative contributions move toward deficit.</p>`
  +table(['ACCOUNTING CONTRIBUTION','QUARTERLY CHANGE · PP','TRAILING FOUR-QUARTER CHANGE · PP'],definitions.map(item=>`<tr><th scope="row">${esc(item.label)}</th>${horizons.map(([key])=>`<td class="num">${esc(number(contribution(latest[key],item.id),item.id==='residual'?8:3))}${reason(latest[key],item.id)?`<span class="table-code amber">${esc(reason(latest[key],item.id))}</span>`:''}</td>`).join('')}</tr>`).join(''),'Component contributions and residual reconciliation to current-account ratio changes')
  +horizons.map(([key,label])=>{const h=latest[key];return `<p class="panel-note">${esc(label)} periods: ${esc(inputDates(h.current,key).map(quarter).join(', '))}; prior: ${esc(inputDates(h.prior,key).map(quarter).join(', ')||'unavailable')}. GDP denominator: ${esc(number(h.current?.total.nominalGdpQuarter))} versus ${esc(number(h.prior?.total.nominalGdpQuarter))} USD billions over the respective periods.</p>`;}).join(''):'';
 const histories=rows.length?horizons.map(([key,label])=>`<details class="frozen-observations"><summary>${esc(label)} contributions data · First ${Math.min(50,rows.length)} of ${rows.length} selected endpoints</summary>${table(['ENDING QUARTER / PRIOR',...definitions.map(item=>`${item.label.toUpperCase()} · PP`)],rows.slice(0,50).map(row=>`<tr><th scope="row">${esc(quarter(row.date))}<span class="table-code muted">versus ${esc(quarter(row.priorDate))}</span></th>${definitions.map(item=>`<td class="num">${esc(number(contribution(row[key],item.id),item.id==='residual'?8:3))}${reason(row[key],item.id)?`<span class="table-code amber">${esc(reason(row[key],item.id))}</span>`:''}</td>`).join('')}</tr>`).join(''),`${label} historical component contributions to current-account ratio changes`)}</details>`).join(''):'';
 const body=`<p class="panel-note"><strong>${frozen?'Frozen calculated accounting contributions':'Calculated accounting contributions'}</strong> · ${esc(result.window.label)} · ${rows.length} selected ending quarters. Units: percentage points of nominal GDP. These changes differ from the quarterly-minus-trailing horizon gap above.</p>`
  +charts+latestTable+histories
  +`<p class="panel-note"><strong>Calculation:</strong> ${esc(result.formula)} Sum of the four component contributions + change in the published-total-minus-component residual = published total ratio change, before display rounding. GDP denominator changes are already included; adding a separate GDP contribution would double-count them. The exact predecessor can precede the selected window; supporting inputs are retained in the CSV.</p>`
  +`<p class="panel-note"><strong>Why it matters:</strong> identifies which trade, income and transfer ratio changes added to or offset the total movement. The residual preserves source rounding and other reconciliation differences. No percentage shares of the net change are reported because contributions can offset and the net change can approach zero.</p>`
  +`<p class="panel-note"><strong>Limitations:</strong> ${esc(limitations)} Quarterly changes need two consecutive quarters; trailing changes need two complete four-quarter windows, covering five consecutive raw quarters. Components can remain available independently, while complete reconciliation requires every component and published total at both endpoints.</p>`
  +currentAccountGdpSourceStatus(sources,{frozen})
  +`<p class="panel-note">BEA ITA Table 1.1 lines 30 and 32–35; nominal GDP A191RC, NIPA Table 1.1.5. ITA table release: ${esc(sources.beaIta?.tableReleaseDate??'unknown')}; historical first-publication dates remain unknown. ${attribution} <a href="${BEA_ITA_LICENSE}" target="_blank" rel="noopener noreferrer">BEA reuse terms ↗</a>${frozen?' CSV is reconstructed from recorded inputs and the recorded method/window; the original frozen attachments retain their original scope.':''}</p>`;
 const disabled=result.error||!rows.length?' disabled title="A valid window with retained endpoints is required."':'';
 const action=frozen?(packageId?button('CSV RECONSTRUCTED CONTRIBUTIONS',`data-export-frozen-current-account-gdp-contributions="${esc(packageId)}"${disabled}`):''):button('CSV CONTRIBUTIONS & INPUTS',`data-export-current-account-gdp-contributions${disabled}`);
 return panel('Δ Q/T4Q',`${frozen?'FROZEN ':''}COMPONENT CONTRIBUTIONS TO RATIO CHANGES`,body,action);
}

export function currentAccountGdpContributionsChartCatalog(sources={}, {frozen=false,effects=false,includeContributions=true}={}){
 const result=currentAccountGdpContributions(sources);
 const split=effects?currentAccountGdpBalanceEffects(sources):null;
 return {...(includeContributions?{[CURRENT_ACCOUNT_GDP_CONTRIBUTIONS_CHART]:{catalog:Object.fromEntries(Object.values(result.series).flat().map(item=>[item.id,item])),evidenceLabel:frozen?'Frozen calculated accounting contributions · recorded BEA inputs':'Calculated accounting contributions · captured BEA inputs'}}:{}),
  ...(split?{[CURRENT_ACCOUNT_GDP_BALANCE_EFFECTS_CHART]:{catalog:Object.fromEntries(Object.values(split.series).flat().map(item=>[item.id,item])),evidenceLabel:frozen?'Frozen calculated symmetric balance/GDP effects · recorded BEA inputs':'Calculated symmetric balance/GDP effects · captured BEA inputs'}}:{})};
}

/** Complete selected changes plus unique current/prior supporting quarters and provenance. */
export function currentAccountGdpContributionsCsv(sources={},range={preset:'all'},{effects=false}={}){
 const result=effects?currentAccountGdpBalanceEffects(sources,range):currentAccountGdpContributions(sources,range),rows=result.error?[]:result.observations;
 const headers=['record_type','horizon','reference_quarter','prior_reference_quarter','measure_id','label','current_ratio_percent','prior_ratio_percent','contribution_percentage_points','unavailable_reason','current_window_quarters_json','prior_window_quarters_json','input_reference_quarter','input_series_id','value_billions','source_value','source_period_label','publication_date','footnotes_json','observation_type','input_metadata_json','calculation','limitations','attribution'];
 if(effects)headers.push('balance_effect_percentage_points','gdp_effect_percentage_points','current_balance_billions','prior_balance_billions','balance_change_billions','current_gdp_billions','prior_gdp_billions','effect_method','effect_unavailable_reason');
 const ids=['currentAccountBalance',...CURRENT_ACCOUNT_GDP_COMPONENTS.map(item=>item.id)];
 const details=Object.fromEntries(['beaIta','bea'].map(agency=>[agency,Object.fromEntries((agency==='bea'?['nominalGdp']:ids).map(id=>{const input=currentAccountGdpInput(sources[agency],id);return [id,{sourceIds:input.item.sourceIds??[],frequency:'Quarterly',adjustment:'Seasonally adjusted',dateConvention:'quarter-start',unit:id==='nominalGdp'?'USD billions (SAAR)':'USD billions per quarter (not annualized)',sourceUnit:id==='nominalGdp'?'USD millions (SAAR)':'USD millions per quarter (not annualized)',url:input.url,title:input.title,retrievedAt:input.retrievedAt,capturedAt:input.capturedAt,captureStatus:input.status,tableReleaseDate:agency==='beaIta'?sources.beaIta?.tableReleaseDate??null:null,provenance:input.provenance,licenseUrl:input.license,attribution:input.attribution}];}))]));
 const records=[{record_type:'metadata',observation_type:'calculated',input_metadata_json:JSON.stringify(details),calculation:result.formula+'; all contribution/change values are percentage points, current/prior ratios are percent of nominal GDP. Supporting inputs include the exact predecessor outside the selected window. GDP input value_billions is SAAR; divide each quarterly GDP by four once before summing. Residual change reconciles the authoritative published total, not a forced sum.',limitations,attribution}];
 if(effects){records[0].effect_method=result.method;records[0].calculation+=' Symmetric two-order allocation: '+result.effectFormula;records[0].limitations+=' '+result.effectNotice;}
 const dates=new Set();
 for(const row of rows)for(const [key]of horizons){
  const h=row[key],current=inputDates(h.current,key),prior=inputDates(h.prior,key);
  for(const date of [...current,...prior])dates.add(date);
  for(const item of definitions){
   const record={record_type:'change',horizon:key,reference_quarter:row.date,prior_reference_quarter:row.priorDate,measure_id:item.id,label:item.label,current_ratio_percent:ratio(h.current,item.id),prior_ratio_percent:ratio(h.prior,item.id),contribution_percentage_points:contribution(h,item.id),unavailable_reason:reason(h,item.id),current_window_quarters_json:JSON.stringify(current),prior_window_quarters_json:JSON.stringify(prior),observation_type:'calculated'};
   if(effects){const e=h.effects[item.id];Object.assign(record,{balance_effect_percentage_points:e.balanceEffect,gdp_effect_percentage_points:e.gdpEffect,current_balance_billions:e.currentBalance,prior_balance_billions:e.priorBalance,balance_change_billions:e.balanceChange,current_gdp_billions:e.currentGdp,prior_gdp_billions:e.priorGdp,effect_method:result.method,effect_unavailable_reason:e.reason});}
   records.push(record);
  }
 }
 const inputs=Object.fromEntries(ids.map(id=>[id,currentAccountGdpRatioInputs(sources,id)]));
 for(const date of [...dates].sort()){
  for(const id of [...ids,'nominalGdp']){
   const gdp=id==='nominalGdp',point=inputs[gdp?'currentAccountBalance':id].point(date),observation=gdp?point.denominatorObservation:point.numeratorObservation;
   const value=gdp?point.nominalGdpSaar:point.currentAccountBalance;
   records.push({record_type:'input',input_reference_quarter:date,input_series_id:id,value_billions:value,source_value:observation?.sourceValue??null,source_period_label:observation?.sourcePeriodLabel??null,publication_date:observation?.publishedAt??null,footnotes_json:JSON.stringify(observation?.footnotes??[]),observation_type:observation?'official':'unavailable',unavailable_reason:finite(value)?null:point.reason});
  }
 }
 return tabularCsv(headers,[])+records.map(record=>headers.map(key=>csvCell(record[key],key==='source_value')).join(',')+'\r\n').join('');
}
