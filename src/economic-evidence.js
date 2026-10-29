import {economicEvidenceSources} from './economic-evidence-snapshot.js';
import {escapeHtml as esc,button,panel,table,chart} from './ui.js';
import {csvCell,tabularCsv} from './model.js';
import {resolveDateWindow,windowObservations} from './date-window.js';
import {supportingDetails} from './page-hierarchy.js';
import {economicEvidenceRegistry} from './economic-evidence-registry.js';
import {canonicalJson} from './research-workspaces.js';
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const sourceFailureNote=source=>source?.error?`<p class="panel-note amber" role="status">Collection failed: ${esc(source.error)}. Retained values retrieved ${esc(source.fetchedAt??'unavailable')}; reference periods remain as shown.</p>`:'';
const clean=value=>Number(value.toFixed(10));
const monthBefore=(date,months)=>new Date(Date.UTC(Number(date.slice(0,4)),Number(date.slice(5,7))-1-months,1)).toISOString().slice(0,10);
const number=(value,precision=2)=>finite(value)?value.toFixed(precision):'Unavailable';
const preliminary=row=>(row?.footnotes??[]).some(note=>typeof note==='string'?/preliminary/i.test(note):note.code==='P'||/preliminary/i.test(note.text));

/** Exact calendar-month comparisons; a gap never becomes a one-month change. */
export function exactMonthlyChanges(series){
 const row=series?.observations?.at(-1),map=new Map((series?.observations??[]).map(item=>[item.date,item.value]));
 const growth=months=>{if(!row||!finite(row.value))return null;const base=map.get(monthBefore(row.date,months));return finite(base)&&base!==0?clean(100*(row.value/base-1)):null;};
 return {monthly:growth(1),annual:growth(12)};
}

export function pceContributionSummary(source=economicEvidenceSources.pcePriceContributions){
 const date=[...new Set(Object.values(source?.series??{}).flatMap(s=>(s.observations??[]).map(row=>row.date)))].sort().at(-1);if(!date)return null;
 const value=id=>source.series[id]?.observations.find(row=>row.date===date)?.value??null;
 const components=[['pceGoodsPriceContribution','Goods'],['pceServicesPriceContribution','Services']].map(([id,label])=>({id,label,value:value(id)})),total=value('pcePriceGrowth'),complete=finite(total)&&components.every(row=>finite(row.value));
 const sum=complete?clean(components.reduce((sum,row)=>sum+row.value,0)):null,residual=complete?clean(total-sum):null;
 if(complete&&Math.abs(residual)>.060000001)throw new Error('PCE contribution reconciliation exceeds published rounding');
 return {date,total,components,housing:value('pceHousingPriceContribution'),complete,sum,residual};
}

function windowed(source,range){
 const window=resolveDateWindow(range,Object.values(source?.series??{}));
 return {window,series:Object.fromEntries(Object.entries(source?.series??{}).map(([id,s])=>[id,{...s,observations:windowObservations(s.observations,window)}]))};
}

/** The CSV and frozen attachment contain the same selected original observations. */
export function economicEvidenceCsv(source,{range={preset:'all'}}={}){
 const headers=['source_id','series_id','source_series_id','name','reference_date','value','source_value','unit','frequency','adjustment','population','horizon_months','contribution_scope','parent_contribution','observation_type','preliminary','footnotes_json','published_at','retrieved_at','capture_status','definition','calculation','source_url','attribution','source_notice','license_url','coverage_note','window_json','capture_provenance_json'];
 const view=windowed(source,range),rows=Object.keys(economicEvidenceRegistry).filter(id=>view.series[id]).map(id=>view.series[id]).flatMap(s=>s.observations.map(row=>[source.id,s.id,s.sourceIds.join('; '),s.name,row.date,row.value,row.sourceValue,s.unit,s.frequency,s.adjustment,s.population??null,s.horizonMonths??null,s.contributionScope??null,s.parentContribution??null,s.observationType,preliminary(row),canonicalJson(row.footnotes??[]),row.publishedAt,source.fetchedAt,source.status,s.definition,s.calculation,s.sourceUrl,s.attribution,s.sourceNotice??'',s.licenseUrl,source.coverageNote,canonicalJson(view.window),canonicalJson(source.provenance)]));
 return tabularCsv(headers,[])+rows.map(row=>row.map((value,i)=>csvCell(value,i===6)).join(',')+'\r\n').join('');
}

export function economicEvidenceContext(source,{range={preset:'all'}}={}){
 const view=windowed(source,range);
 return {version:1,source:structuredClone(source),window:structuredClone(view.window),attachments:[{name:`${source.id}.csv`,content:economicEvidenceCsv(source,{range}),type:'text/csv'}],scope:'Full bounded captured source preserves latest context independently of the selected chart window. The attached CSV retains the selected exact observations, definitions, footnotes and receipts. Current revised source history; publication timestamps are unknown.'};
}

export function economicEvidenceChartCatalog(source,{frozen=false}={}){
 return {[source.id]:{catalog:Object.fromEntries(Object.entries(source.series).map(([id,s])=>[id,{...economicEvidenceRegistry[id],...s,source:economicEvidenceRegistry[id].source,fetchedAt:source.fetchedAt,provenance:source.provenance}])),evidenceLabel:(frozen?'Frozen':'Captured')+' official '+(source.id==='laborEvidence'?'BLS labor evidence':'BEA monthly PCE contributions')}};
}
function nativeChart(series,{range={preset:'3y'},diffusion=false}={}){
 const sourceId=series[0].id.startsWith('pce')?'pcePriceContributions':'laborEvidence';
 return chart(series.map(s=>s.id),{range,height:190}).replace('data-chart ','data-chart data-chart-catalog="'+sourceId+'" '+(diffusion?'data-y-domain="[0,100]" data-y-domain-exact="true" data-y-reference="50" ':''))+'<p class="labor-note">'+(diffusion?'Shared 0–100 diffusion scale; balanced breadth reference 50.':esc(series[0].unit)+'; independent native scale.')+' Exact source months; source gaps remain gaps.</p>';
}

function historyTable(source,range){
 const view=windowed(source,range),series=Object.values(view.series),dates=[...new Set(series.flatMap(s=>s.observations.map(row=>row.date)))].sort().reverse();
 return `${view.window.error?`<p role="alert">${esc(view.window.error)}</p>`:''}${table(['Reference month',...(series.map(s=>`${s.name} (${s.unit})`)).map(label=>({label,numeric:true}))],dates.map(date=>`<tr><th scope="row">${esc(date.slice(0,7))}</th>${series.map(s=>{const row=s.observations.find(o=>o.date===date);return `<td class="num">${number(row?.value,s.precision)}${preliminary(row)?' <abbr title="Preliminary">P</abbr>':''}</td>`;}).join('')}</tr>`).join(''))}<p class="labor-note">${dates.length} exact retained reference months in this window. Missing values are unavailable. P = preliminary. Publication dates are unknown; retrieval is separate.</p>`;
}

function receiptDetails(source){return `<p>${esc(source.coverageNote)}</p><p>Source retrieved ${esc(source.fetchedAt)} · ${source.status==='ok'?'Captured':'Cached'}${source.error?' · '+esc(source.error):''}. Retrieval does not establish a new economic release.</p>${source.provenance.map(row=>`<p><a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">Exact official feed ↗</a> · SHA256 <code>${esc(row.sha256)}</code></p>`).join('')}${Object.values(source.series).map(s=>`<p><strong>${esc(s.name)} · ${esc(s.code)}.</strong> ${esc(s.definition)}</p>`).join('')}<p>${esc(Object.values(source.series)[0].attribution)} ${esc(Object.values(source.series)[0].sourceNotice??'')} <a href="${esc(Object.values(source.series)[0].licenseUrl)}" target="_blank" rel="noopener noreferrer">Source reuse terms ↗</a></p>`;}

export function laborUncertaintyNote(payrollSeries){
 const row=payrollSeries?.observations?.at(-1);
 return `<aside class="labor-note workspace-basis" aria-label="Labor estimate uncertainty"><strong>${preliminary(row)?'Preliminary payroll estimate. ':''}Survey uncertainty.</strong> BLS labor estimates have sampling and nonsampling error; initial CES estimates are revised as reports arrive and seasonal factors are updated. BLS gives an approximate 90% sampling interval of ±122,000 for a one-month total nonfarm payroll change. That interval is not an interval for the difference between two monthly job gains, and it does not cover all nonsampling error. No significance claim is made for the change in gains shown here. <a href="https://www.bls.gov/news.release/empsit.tn.htm" target="_blank" rel="noopener noreferrer">Official BLS technical note ↗</a></aside>`;
}

export function renderLaborEvidence(source=economicEvidenceSources.laborEvidence,{range={preset:'3y'},frozen=false}={}){
 const earnings=['realHourlyEarnings','realWeeklyEarnings'].map(id=>source.series[id]),diffusion=['privateDiffusion1m','privateDiffusion3m','privateDiffusion6m'].map(id=>source.series[id]);
 const earningsHtml=earnings.map(s=>{const row=s.observations.at(-1),changes=exactMonthlyChanges(s);return `<article><h3>${esc(s.name)}</h3><strong>${number(row?.value,2)}</strong> <span>${esc(s.unit)}</span><p>${esc(row?.date?.slice(0,7))} · Seasonally adjusted${preliminary(row)?' · Preliminary':''}</p><p>Calculated exact month change: ${number(changes.monthly)}% · Exact year change: ${number(changes.annual)}%</p>${nativeChart([s],{range})}</article>`;}).join('');
 const diffusionRows=diffusion.map(s=>{const row=s.observations.at(-1);return `<tr><th scope="row">${s.horizonMonths}-month span</th><td class="num">${number(row?.value,1)}</td><td>${esc(row?.date?.slice(0,7))}</td><td>${preliminary(row)?'Preliminary':'Stage not marked preliminary by source'}</td></tr>`;}).join('');
 return panel('','Real earnings & employment breadth',sourceFailureNote(source)+`<p class="labor-note">Latest readings are independent of the focused history window. Charts and full tables use the selected window. Source retrieved ${esc(source.fetchedAt)} · ${source.status==='ok'?'Captured':'Cached'}.</p><div class="labor-claims-grid">${earningsHtml}</div><p>Real earnings use CPI-U for all private nonfarm payroll employees, in constant 1982–1984 dollars. They are means across jobs; changes in industry and job composition affect them. Weekly earnings also reflect paid hours. These are not median earnings or fixed-worker wage growth.</p><h3>Private employment diffusion</h3>${table(['Published horizon',{label:'Index',numeric:true},'Reference month','Estimate stage'],diffusionRows)}${nativeChart(diffusion,{range,diffusion:true})}<p>Industry breadth = percent expanding + half the percent unchanged. Above 50 means more detailed private industries expanded than contracted. This is not employment-weighted growth; it does not measure the share of workers gaining jobs. All three horizons use seasonally adjusted employment.</p>${supportingDetails('labor:extra-history','Full evidence table & definitions',historyTable(source,range)+receiptDetails(source))}`,frozen?'':button('CSV · real earnings & breadth','data-export-economic-evidence="laborEvidence"'),'Latest revised official source history. API publication timestamps are unknown.');
}

export function renderPcePriceContributions(source=economicEvidenceSources.pcePriceContributions,{range={preset:'3y'},frozen=false}={}){
 const summary=pceContributionSummary(source);if(!summary)return '';
 const components=summary.components.map(row=>`<tr><th scope="row">${esc(row.label)}</th><td class="num">${number(row.value)} pp</td></tr>`).join('');
 return panel('','PCE inflation contributions',sourceFailureNote(source)+`<p>Official monthly BEA price contributions · ${esc(summary.date.slice(0,7))} · Seasonally adjusted, not annualized. Current revised history, separate from CPI.</p><p><strong>PCE price growth: ${number(summary.total,1)}%</strong></p>${table(['Top-level contribution',{label:'Percentage points',numeric:true}],components)}<p>Goods + services: ${number(summary.sum)} pp. Rounding residual (headline minus sum): ${number(summary.residual)} pp.${summary.complete?'':' Incomplete decomposition; missing components are not zeros.'}</p><p>Housing: ${number(summary.housing)} pp within services, not added again. These published accounting contributions describe measured inflation, not causal effects. The maximum independent rounding allowance is 0.06 pp (headline to one decimal and two components to two).</p>${nativeChart([source.series.pceGoodsPriceContribution],{range})}${nativeChart([source.series.pceServicesPriceContribution],{range})}${supportingDetails('inflation:pce-contributions','Full contribution table & evidence',historyTable(source,range)+receiptDetails(source))}`,frozen?'':button('CSV · PCE contributions','data-export-economic-evidence="pcePriceContributions"'));
}
