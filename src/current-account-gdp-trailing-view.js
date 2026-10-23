import {currentAccountGdpTrailing} from './current-account-gdp-trailing.js';
import {CURRENT_ACCOUNT_GDP_COMPONENTS} from './current-account-gdp-breakdown.js';
import {currentAccountGdpQuarterSpan} from './current-account-gdp.js';
import {currentAccountGdpInput,currentAccountGdpSourceStatus} from './current-account-gdp-view.js';
import {BEA_ITA_LICENSE} from './current-account-registry.js';
import {csvCell,tabularCsv,periodLabel} from './model.js';
import {panel,table,button,emptyState,escapeHtml as esc} from './ui.js';

export const CURRENT_ACCOUNT_GDP_TRAILING_CHART='current-account-gdp-trailing';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const number=(value,digits=2)=>finite(value)?value.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}):'Unavailable';
const quarter=date=>date?periodLabel({frequency:'Quarterly'},date):'Unavailable';
const percent=value=>finite(value)?`${number(value)}%`:'Unavailable';
const change=(current,prior)=>finite(current)&&finite(prior)&&finite(current-prior)?current-prior:null;
const exactPrior=(current,prior)=>current&&prior&&currentAccountGdpQuarterSpan(prior.date,current.date)===2;
const CREDIT='Source: U.S. Bureau of Economic Analysis. Trailing-four-quarter ratios and reconciliation calculated by Meridian.';
const LIMITATIONS='Retained revised BEA histories, not historical first-release vintages. Ratios are calculated comparisons, not GDP-growth contributions or causal explanations. Adjacent rolling windows overlap by three quarters. Balances and GDP can revise and have independent retrieval vintages. Missing quarters are not interpolated, zero-filled or extrapolated.';
const definitions=[...CURRENT_ACCOUNT_GDP_COMPONENTS.map(item=>({...item,ratioId:`${item.id}TrailingToGdp`,point:row=>row.components[item.id]})),
 {id:'currentAccountBalance',ratioId:'currentAccountTrailingToGdp',label:'Sum of published totals',point:row=>row.total},
 {id:null,ratioId:'currentAccountTrailingComponentSumToGdp',label:'Component sum',point:row=>aggregate(row,false)},
 {id:null,ratioId:'currentAccountTrailingRoundingResidualToGdp',label:'Rounding residual',point:row=>aggregate(row,true)}];
function aggregate(row,residual){
 return {...row.total,value:residual?row.residual:row.componentSum,currentAccountBalance:residual?row.residualBalance:row.componentSumBalance,
  reason:finite(residual?row.residual:row.componentSum)?null:'Reconciliation requires the published total and all four complete component windows.'};
}
function chartMarkup(ids,range,height,label){
 return `<p class="panel-note"><strong>${esc(label)}</strong></p><div class="chart" data-chart data-chart-catalog="${CURRENT_ACCOUNT_GDP_TRAILING_CHART}" data-series="${esc(ids.join(','))}" data-kind="line" data-transform="level" data-comparison="native" data-cursor-group="current-account-t4q" data-height="${height}" data-range="${esc(JSON.stringify(range))}"><p class="chart-fallback muted">${esc(label)} · calculated trailing history chart loading.</p></div>`;
}

export function currentAccountGdpTrailingPanel(sources={},range={preset:'all'},{frozen=false}={}){
 const result=currentAccountGdpTrailing(sources,range),rows=result.observations,full=result.totalSeries.observations;
 const complete=rows.filter(row=>finite(row.total.value)).length;
 const hasComponents=rows.some(row=>CURRENT_ACCOUNT_GDP_COMPONENTS.some(({id})=>finite(row.components[id].value)));
 const chart=result.error?emptyState('Trailing history unavailable.',result.error):!rows.length?emptyState('No retained quarters in this window.','Choose another shared date window above.')
  :(complete?chartMarkup([result.totalSeries.id],range,180,'Sum of published current-account balances · trailing four quarters'):emptyState('Trailing total unavailable.','Four complete exact-quarter balance and GDP inputs are required.'))
   +(hasComponents?chartMarkup(result.series.map(item=>item.id),range,260,'Component breakdown · trailing four quarters'):emptyState('Trailing component history unavailable.','Each component needs four consecutive quarters. Available inputs and missing reasons remain in the table and export.'));
 const latest=rows.at(-1),prior=exactPrior(latest,rows.at(-2))?rows.at(-2):null;
 const delta=change(latest?.total.value,prior?.total.value);
 const changeText=finite(delta)?`Change ${number(delta,3)} percentage points versus the window ending ${quarter(prior.date)}.`:'Change unavailable: a valid exact preceding endpoint is required inside the selected window.';
 const latestRows=latest?definitions.map(item=>{const point=item.point(latest),previous=prior?item.point(prior):null,residual=item.id===null&&item.ratioId.includes('Residual');
  return `<tr><th scope="row">${esc(item.label)}${point.reason?`<span class="table-code amber">${esc(point.reason)}</span>`:''}</th><td class="num">${esc(number(point.currentAccountBalance,residual?6:3))}</td><td class="num">${esc(number(point.value,residual?8:3))}</td><td class="num">${esc(number(change(point.value,previous?.value),residual?8:3))}</td></tr>`;
 }).join(''):'';
 const summary=latest?`<p class="panel-note"><strong>What changed · ${esc(quarter(latest.startDate))} through ${esc(quarter(latest.endDate))}:</strong> current-account balance / GDP ${esc(percent(latest.total.value))}. ${esc(changeText)} The rows show which balances offset or add to the rolling total.</p>`
  +table(['LATEST FOUR-QUARTER WINDOW','BALANCE · T4Q / $B','RATIO / GDP · %','CHANGE · PP'],latestRows,'Trailing-four-quarter current-account total and components with rounding reconciliation'):'';
 const historical=rows.slice(0,50).map(row=>`<tr><th scope="row">${esc(quarter(row.startDate))}–${esc(quarter(row.endDate))}</th><td class="num">${esc(percent(row.total.value))}</td>${CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id})=>`<td class="num"${row.components[id].reason?` title="${esc(row.components[id].reason)}"`:''}>${esc(percent(row.components[id].value))}</td>`).join('')}<td class="num">${esc(number(row.residual,8))}</td></tr>`).join('');
 const data=rows.length?`<details class="frozen-observations"><summary>Trailing data table · First ${Math.min(50,rows.length)} of ${rows.length} selected endpoints</summary>${table(['FOUR-QUARTER PERIOD','TOTAL · %','GOODS · %','SERVICES · %','PRIMARY INCOME · %','SECONDARY INCOME · %','RESIDUAL · PP'],historical,'Historical trailing-four-quarter ratio breakdown and coverage windows')}<p class="panel-note">The CSV contains every selected endpoint and each supporting source quarter, including lookback inputs outside the chart window.</p></details>`:'';
 const body=`<p class="panel-note"><strong>${frozen?'Frozen calculated metrics':'Calculated metrics'}</strong> · Shared window: ${esc(result.window.label)}. Retained: ${full.length} ending quarters. Displayed: ${rows.length} endpoint${rows.length===1?'':'s'} · ${complete} complete total window${complete===1?'':'s'} · ${rows.length-complete} unavailable. Chart dates identify the ending reference quarter, not release dates.</p>`
  +chart+summary+data
  +`<p class="panel-note"><strong>Calculation:</strong> ${esc(result.formula)}. This is a ratio of sums, not an unweighted average of quarterly percentages. Divide each nominal GDP SAAR value by four once, then sum the four quarterly flows. Require exactly four consecutive quarters. The first three retained endpoints lack a complete current-account window. Calculations precede date filtering, so supporting inputs can precede the displayed window. Changes require the exact preceding endpoint inside the selected window.</p>`
  +`<p class="panel-note"><strong>Why it matters:</strong> shows trade, income and current transfers over a full four-quarter period relative to production over that same period. Positive balances offset deficits. The published total is summed independently; component sum and rounding residual (published total − component sum) remain separate.</p>`
  +`<p class="panel-note"><strong>Limitations:</strong> ${esc(LIMITATIONS)} Primary income includes investment income and employee compensation; secondary income comprises current transfers. These international-transactions balances are distinct from NIPA net exports.</p>`
  +currentAccountGdpSourceStatus(sources,{frozen})
  +`<p class="panel-note">BEA ITA Table 1.1 line 30 and lines 32–35; nominal GDP A191RC, NIPA Table 1.1.5. ITA table release: ${esc(sources.beaIta?.tableReleaseDate??'unknown')} (table vintage, not historical first-publication dates). Unknown publication dates remain unknown. ${CREDIT} <a href="${BEA_ITA_LICENSE}" target="_blank" rel="noopener noreferrer">BEA reuse terms ↗</a></p>`;
 return panel('T4Q',`${frozen?'FROZEN ':''}TRAILING FOUR QUARTERS · CURRENT ACCOUNT / GDP`,body,frozen?'':button('CSV TRAILING & INPUTS',`data-export-current-account-gdp-trailing${result.error||!rows.length?' disabled title="A valid window with retained ending quarters is required."':''}`));
}

export function currentAccountGdpTrailingChartCatalog(sources={}, {frozen=false}={}){
 const result=currentAccountGdpTrailing(sources);
 return {[CURRENT_ACCOUNT_GDP_TRAILING_CHART]:{catalog:Object.fromEntries([result.totalSeries,...result.series].map(item=>[item.id,item])),evidenceLabel:frozen?'Frozen calculated trailing-four-quarter ratios · recorded BEA inputs':'Calculated trailing-four-quarter ratios · captured BEA inputs'}};
}

/** A single CSV schema uses metadata, unique input-quarter and rolling-ratio records. */
export function currentAccountGdpTrailingCsv(sources={},range={preset:'all'},{comparisonMeasure=null}={}){
 const comparison=comparisonMeasure!==null;
 if(comparison&&!definitions.some(item=>item.id&&item.id===comparisonMeasure))throw new RangeError('Comparison measure must be a current-account balance or one of its four admitted components.');
 const result=currentAccountGdpTrailing(sources,range),rows=result.error?[]:result.observations;
 const observed=definitions.filter(item=>item.id),inputIds=[...observed.map(item=>item.id),'nominalGdp'];
 const metrics=['value_percent','change_percentage_points','balance_t4q_billions','missing','unavailable_reason'];
 const fields=['value_billions','source_value','source_period_label','publication_date','footnotes_ref','observation_type'];
 const headers=['record_type','reference_quarter','window_start_quarter','window_end_quarter','input_quarters_json','nominal_gdp_t4q_billions',
  ...definitions.flatMap(item=>metrics.map(field=>`${item.ratioId}_${field}`)),...inputIds.flatMap(id=>fields.map(field=>`${id}_${field}`)),
  'observation_type','ratio_unit','balance_unit','input_metadata_json','footnote_dictionary_json','calculation','limitations','attribution','metadata_scope',
  ...(comparison?['comparison_measure_id','comparison_quarterly_value_percent','comparison_trailing_value_percent','comparison_gap_percentage_points','comparison_quarterly_unavailable_reason','comparison_trailing_unavailable_reason','comparison_gap_unavailable_reason']:[])];
 const details=Object.fromEntries(['beaIta','bea'].map(agency=>[agency,Object.fromEntries((agency==='bea'?['nominalGdp']:observed.map(item=>item.id)).map(id=>{
  const input=currentAccountGdpInput(sources[agency],id);
  return [id,{sourceIds:input.item.sourceIds??[],unit:id==='nominalGdp'?'USD billions (SAAR)':'USD billions per quarter (not annualized)',sourceUnit:id==='nominalGdp'?'USD millions (SAAR)':'USD millions per quarter (not annualized)',url:input.url,title:input.title,retrievedAt:input.retrievedAt,capturedAt:input.capturedAt,captureStatus:input.status,tableReleaseDate:agency==='beaIta'?sources.beaIta?.tableReleaseDate??null:null,provenance:input.provenance,licenseUrl:input.license,attribution:input.attribution}];
 }))]));
 const footnotes=new Map(),footnoteDictionary=Object.create(null);
 const footnoteRef=value=>{const key=JSON.stringify(value??[]);if(!footnotes.has(key)){const id=`f${footnotes.size}`;footnotes.set(key,id);footnoteDictionary[id]=value??[];}return footnotes.get(key);};
 const records=[{record_type:'metadata',ratio_unit:'Percent of nominal GDP',balance_unit:'USD billions over four quarters',input_metadata_json:JSON.stringify(details),calculation:result.formula+'; component sum = sum of four component ratios; residual = published total ratio minus component sum.',limitations:LIMITATIONS,attribution:CREDIT,metadata_scope:'This metadata record applies to all input and ratio records. Ratio/balance units describe calculated ratio records; input units are in input_metadata_json. Input records retain each supporting source quarter once, with per-series observation_type official or unavailable. Each *_footnotes_ref resolves to an exact array in footnote_dictionary_json. Ratio records identify the ending reference quarter and all four input quarters. nominalGdp_value_billions is SAAR; sum each value divided by 4 for nominal_gdp_t4q_billions. Original source values are USD millions. Changes require the exact preceding endpoint also in this export.'}];
 if(comparison){
  records[0].comparison_measure_id=comparisonMeasure;
  records[0].calculation+=' Quarterly = 100 × same-quarter balance / (GDP SAAR / 4); comparison gap = quarterly minus trailing four quarters, in percentage points.';
  records[0].metadata_scope+=' Comparison fields use the selected comparison_measure_id and the same ending reference quarter, with separate quarterly and four-quarter GDP denominators. The gap compares different horizons; it is not a revision or a change from the previous quarter. Quarterly inputs use the input record at reference_quarter. Trailing inputs use the four input_quarters_json dates.';
 }
 const inputs=new Map();
 for(const row of rows){
  for(const definition of observed){
   for(const point of definition.point(row).inputPoints??[]){
    if(!inputs.has(point.date))inputs.set(point.date,{record_type:'input',reference_quarter:point.date,observation_type:'unavailable'});
    const record=inputs.get(point.date),observation=point.numeratorObservation,gdp=point.denominatorObservation;
    for(const [id,value,original] of [[definition.id,point.currentAccountBalance,observation],['nominalGdp',point.nominalGdpSaar,gdp]]){
     record[`${id}_value_billions`]=value;record[`${id}_source_value`]=original?.sourceValue??null;record[`${id}_source_period_label`]=original?.sourcePeriodLabel??null;
     record[`${id}_publication_date`]=original?.publishedAt??null;record[`${id}_footnotes_ref`]=footnoteRef(original?.footnotes);
     record[`${id}_observation_type`]=original?'official':'unavailable';if(original)record.observation_type='official';
    }
   }
  }
 }
 records.push(...[...inputs.values()].sort((a,b)=>a.reference_quarter.localeCompare(b.reference_quarter)));
 records[0].footnote_dictionary_json=JSON.stringify(footnoteDictionary);
 for(const [index,row] of rows.entries()){
  const previous=exactPrior(row,rows[index-1])?rows[index-1]:null,record={record_type:'ratio',observation_type:'calculated',reference_quarter:row.date,window_start_quarter:row.startDate,window_end_quarter:row.endDate,input_quarters_json:JSON.stringify(row.inputDates),nominal_gdp_t4q_billions:row.total.nominalGdpQuarter};
  for(const item of definitions){const point=item.point(row),prior=previous?item.point(previous):null;for(const [field,value] of [['value_percent',point.value],['change_percentage_points',change(point.value,prior?.value)],['balance_t4q_billions',point.currentAccountBalance],['missing',!finite(point.value)],['unavailable_reason',point.reason]])record[`${item.ratioId}_${field}`]=value;}
  if(comparison){
   const trailing=comparisonMeasure==='currentAccountBalance'?row.total:row.components[comparisonMeasure],quarterly=trailing.inputPoints.at(-1),gap=change(quarterly?.value,trailing.value);
   Object.assign(record,{comparison_quarterly_value_percent:quarterly?.value??null,comparison_trailing_value_percent:trailing.value,comparison_gap_percentage_points:gap,
    comparison_quarterly_unavailable_reason:quarterly?.reason??null,comparison_trailing_unavailable_reason:trailing.reason,
    comparison_gap_unavailable_reason:finite(gap)?null:quarterly?.reason||trailing.reason||'The difference between the two horizons is nonfinite or unavailable.'});
  }
  records.push(record);
 }
 const raw=new Set(headers.filter(key=>key.endsWith('_source_value')));
 return tabularCsv(headers,[])+records.map(record=>headers.map(key=>csvCell(record[key],raw.has(key))).join(',')+'\r\n').join('');
}
