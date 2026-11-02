import {getSeries,latest,periodLabel,formatValue,toCsv,compareSeries,transformSeries} from './model.js';
import {formatDisplayValue} from './display-format.js';
import {escapeHtml as esc,table,button} from './ui.js';
import {indicatorHref,viewRange} from './workspace-context.js';
import {blsDeskDefinitions} from './bls-desk-definitions.js';
import {renderFamilyAnalysis} from './stitch-family-analysis.js';
import {normalizeSourceNotes} from './source-notes.js';
import {indicatorViewDefinitions} from './indicator-view-definitions.js';
import {annualLevelGrowthSeries} from './indicator-calculations.js';

/** Definition-only fallbacks never manufacture a source observation. */
export function familySeries(id){
 return getSeries(id)??(blsDeskDefinitions[id]?{...blsDeskDefinitions[id],source:{...blsDeskDefinitions[id].source,seriesIds:blsDeskDefinitions[id].sourceIds},observations:[],dataStatus:'unavailable'}:undefined);
}
const reading=(id,title,rows=[],note='')=>({id,title,s:familySeries(id),rows,note});
const value=(s,row=latest(s))=>formatDisplayValue(s,row?.value);
const period=s=>latest(s)?periodLabel(s,latest(s).date):'Not retained';
const observationNotes=row=>normalizeSourceNotes([...(row?.footnotes??[]),row?.imputed?'Source-imputed monthly observation':'',row?.imputationAffected?'Annual window includes source-imputed months':'',row?.suppressed?'Suppressed by source':'']);
const exact=(id,date)=>familySeries(id)?.observations?.find(row=>row.date===date)??null;
const percent=n=>Number.isFinite(n)?`${n<0?'−':'+'}${Math.abs(n).toFixed(2)}%`:'—';
const sourceNumber=row=>typeof row?.sourceValue==='number'?row.sourceValue:typeof row?.sourceValue==='string'&&row.sourceValue.trim()!==''&&Number.isFinite(Number(row.sourceValue))?Number(row.sourceValue):null;
export function exactLevelGrowth(input,months,{sourceInput=false,annualized=false}={}){
 const row=latest(input);if(!row?.date)return null;
 const date=new Date(`${row.date}T00:00:00Z`);date.setUTCMonth(date.getUTCMonth()-months);
 const prior=input.observations.find(item=>item.date===date.toISOString().slice(0,10)),now=sourceInput?sourceNumber(row):row.value,before=sourceInput?sourceNumber(prior):prior?.value;
 return Number.isFinite(now)&&Number.isFinite(before)&&now>0&&before>0?100*((now/before)**(annualized?12/months:1)-1):null;
}
function payrollAnnual(){
 const s=getSeries('payrollLevel'),row=latest(s),date=row?.date,yearAgo=date?`${Number(date.slice(0,4))-1}${date.slice(4)}`:null,prior=s?.observations?.find(item=>item.date===yearAgo);
 return Number.isFinite(row?.value)&&Number.isFinite(prior?.value)&&row.value>0&&prior.value>0?100*(row.value/prior.value-1):null;
}

export function familyStats(current,family){
 if(family==='payroll')return [reading('payrollLevel','Total level · SA'),reading('payroll','Net monthly change'),reading('payrollAverage3m','3-month moving average',[['6-month average','payrollAverage6m']]),{title:'12-month payroll growth',value:percent(payrollAnnual()),unit:'Derived year over year',note:'Exact year-ago employment level; current revised history.',rows:[['Private monthly change','payrollPrivateChange'],['State/local monthly change','payrollStateLocalChange']]}];
 if(family==='unemployment')return [reading('unrate','Official headline · U-3'),reading('underemployment','Broad underutilization · U-6',[['U-6 minus U-3','underutilizationSpread']]),reading('unemployedLevel','Unemployed people',[['Civilian labor force','laborForceLevel'],['Employed people','employedLevel']]),reading('economicPartTimeLevel','Underutilization components',[['Marginally attached','marginallyAttachedLevel'],['Discouraged workers','discouragedLevel']],'Discouraged workers are included within the marginally attached; these counts are not added together.')];
 if(family==='earnings'){
  const level=familySeries('hourlyEarnings'),raw=latest(current)?.sourceValue,rawNumber=typeof raw==='number'?raw:typeof raw==='string'&&raw.trim()!==''?Number(raw):null;
  const momentum=latest(familySeries('earningsAnnualized3m'))?reading('earningsAnnualized3m','3-month earnings momentum',[['Monthly earnings growth','earningsMonthly'],['6-month annualized','earningsAnnualized6m']]):{title:'3-month earnings momentum',value:percent(exactLevelGrowth(current,3,{sourceInput:true,annualized:true})),unit:'Derived annualized growth · SA',note:`Monthly earnings growth: ${percent(exactLevelGrowth(current,1,{sourceInput:true}))}. Calculated from exact source hourly-earnings inputs; a missing endpoint remains unavailable.`};
  return [latest(level)?reading('hourlyEarnings','Latest hourly earnings'):{title:'Latest hourly earnings',value:Number.isFinite(rawNumber)?`$${rawNumber.toFixed(2)}`:'—',unit:'USD per hour · source input',note:'Retained hourly-earnings level used to calculate annual wage growth.'},reading('wages','Annual earnings growth · YoY'),momentum,reading('realHourlyEarnings','Real wages & purchasing power',[['Real weekly earnings','realWeeklyEarnings']],'CES real earnings are in constant 1982–1984 dollars. They remain job averages affected by industry and worker composition.')];
 }
 if(family==='eci'){
  const annual=familySeries('eciCivilianCompensationAnnual'),index=familySeries('eciCivilianCompensationNsa');
  const annualCard=latest(annual)?reading('eciCivilianCompensationAnnual','12-month compensation growth · NSA',[['SA index','eciCompensation']]):{...reading('eciCivilianCompensationNsa','12-month compensation growth · NSA'),value:percent(exactLevelGrowth(index,12)),unit:'Derived year over year · NSA',note:'Exact year-ago NSA ECI index endpoints. Quarterly compensation growth uses SA indexes and is not annualized.'};
  return [reading('eciCompensationQuarterly','Quarterly compensation growth'),annualCard,reading('eciCivilianWagesAnnual','Wages & salaries',[['Benefits · annual','eciCivilianBenefitsAnnual']]),reading('eciPrivateCompensationAnnual','Sectoral compensation',[['State/local · annual','eciStateLocalCompensationAnnual']])];
 }
 if(family==='productivity')return [reading('laborProductivity','Quarterly productivity momentum'),reading('productivityAnnual','4-quarter productivity growth'),reading('nonfarmOutputQuarterly','Real output & hours',[['Hours worked · SAAR','hoursWorkedQuarterly']]),reading('unitLaborCosts','Wage absorption context',[['Hourly compensation · SAAR','nominalHourlyCompensationQuarterly']],'Published output, hours and compensation rates retain their own accounting scopes.')];
 if(family==='costs')return [reading('unitLaborCosts','Quarterly unit labor costs'),reading('unitLaborCostsAnnual','4-quarter unit labor costs'),reading('nominalHourlyCompensationQuarterly','Compensation determinant',[['Labor productivity · SAAR','laborProductivity']]),reading('unitLaborCostIndex','Unit labor cost index',[['Core PCE · YoY','pceCore']],'Labor costs and consumer prices describe different scopes; this comparison does not estimate pass-through.')];
 if(family==='cpi')return [reading('cpi','Headline CPI · YoY',[['Monthly · SA','cpiMonthly']]),reading('cpiCore','Core CPI · YoY',[['Monthly · SA','cpiCoreMonthly']]),{title:'Component weighted breakdown',code:'BLS CPI · category inputs',value:'',unit:'Annual NSA category rates',rows:[['Shelter','cpiShelterAnnual'],['Food','cpiFoodAnnual'],['Energy','cpiEnergyAnnual'],['Core goods','cpiCoreGoodsAnnual']],note:'Source-dated relative importance and published monthly/annual effects are retained separately in the component panel.'},reading('cpiCoreAnnualized3m','Inflation policy lens',[['6-month core annualized','cpiCoreAnnualized6m'],['Core PCE · YoY','pceCore']],'The FOMC 2% objective applies to annual headline PCE, not a CPI target corridor.')];
 if(family==='pce')return [reading('pce','Headline PCE · YoY',[['Monthly · SA','pceMonthly']]),reading('pceCore','Core PCE · YoY',[['Monthly · SA','pceCoreMonthly']]),reading('pceServicesAnnual','PCE basket decomposition',[['Goods · YoY','pceGoodsAnnual'],['Food · YoY','pceFoodAnnual'],['Energy · YoY','pceEnergyAnnual']]),reading('pceCoreAnnualized3m','FOMC policy lens',[['6-month core annualized','pceCoreAnnualized6m']],'The 2% objective applies to annual headline PCE. Core inflation and annualized momentum are separate diagnostics.')];
 return null;
}

export function familyStatRows(rows,state,{referenceDate,referenceUnit,selectedId,seenNotes=new Set()}={}){
 const units={'Thousands of jobs':'jobs','Thousands of jobs per month':'jobs/month','Thousands of people':'people','Percent year over year':'YoY','Percent month over month':'MoM','Percent quarter over quarter':'q/q','Percent q/q annualized':'q/q SAAR','Percent annualized over 3 months':'3m annualized','Percent annualized over 6 months':'6m annualized','Percentage points':'pp','USD per hour':'USD/hour','USD per week':'USD/week'};
 return rows?.length?'<dl class="indicator-stat-rows">'+rows.map(([label,id])=>{
  const s=familySeries(id),row=latest(s),registered=Boolean(getSeries(id));
  const unit=id===selectedId?s?.unit:s?.unit===referenceUnit?'':units[s?.unit]??s?.unit;
  const context=[row?.date!==referenceDate?period(s):'',unit].filter(Boolean).join(' · ');
  const notes=observationNotes(row).filter(note=>{if(seenNotes.has(note))return false;seenNotes.add(note);return true;});
  if(s?.dataStatus==='cached')notes.push('Cached reading');
  if(s?.dataStatus==='unavailable'||!Number.isFinite(row?.value))notes.push('Unavailable reading');
  if(s?.error)notes.push(s.error);
  return `<div data-family-input="${esc(id)}"><dt>${esc(label)}</dt><dd>${registered?`<a href="${esc(indicatorHref(id,state))}" title="${esc([s.unit,period(s)].filter(Boolean).join(' · '))}">`:''}${esc(value(s,row))}${registered?'</a>':''}${context?`<small class="indicator-row-context">${esc(context)}</small>`:''}${[...new Set(notes)].map(note=>`<small class="amber" role="status">${esc(note)}</small>`).join('')}</dd></div>`;
 }).join('')+'</dl>':'';
}
export function familyAnalysis(current,state,family){return renderFamilyAnalysis(current,family,familySeries);}

const ledgerColumns={
 payroll:[['Total level','payrollLevel'],['Monthly change','payroll'],['3-month mean change','payrollAverage3m'],['6-month mean change','payrollAverage6m'],['Annual growth','payrollAnnual'],['Private change','payrollPrivateChange'],['State/local change','payrollStateLocalChange']],
 unemployment:[['U-3','unrate'],['U-6','underemployment'],['U-6 less U-3','underutilizationSpread'],['Labor force','laborForceLevel'],['Unemployed','unemployedLevel'],['Economic part-time','economicPartTimeLevel'],['Prime-age E/P','primeAgeEmploymentPopulation']],
 earnings:[['Hourly earnings','hourlyEarnings'],['Annual growth','wages'],['Monthly growth','earningsMonthly'],['3-month annualized','earningsAnnualized3m'],['6-month annualized','earningsAnnualized6m'],['Weekly hours','weeklyHours'],['Weekly earnings','weeklyEarnings'],['Real hourly earnings','realHourlyEarnings'],['Real weekly earnings','realWeeklyEarnings']],
 eci:[['Compensation q/q','eciCompensationQuarterly'],['Wages q/q','eciCivilianWagesQuarterly'],['Benefits q/q','eciCivilianBenefitsQuarterly'],['Compensation annual','eciCivilianCompensationAnnual'],['Wages annual','eciCivilianWagesAnnual'],['Benefits annual','eciCivilianBenefitsAnnual'],['Private compensation annual','eciPrivateCompensationAnnual'],['State/local compensation annual','eciStateLocalCompensationAnnual'],['Compensation index','eciCompensation'],['NSA compensation index','eciCivilianCompensationNsa']],
 productivity:[['Productivity q/q','laborProductivity'],['Productivity annual','productivityAnnual'],['Output q/q','nonfarmOutputQuarterly'],['Hours q/q','hoursWorkedQuarterly'],['Compensation q/q','nominalHourlyCompensationQuarterly'],['Unit labor costs q/q','unitLaborCosts'],['Productivity index','productivityIndex'],['Output index','nonfarmOutputIndex'],['Hours index','hoursWorkedIndex']],
 costs:[['Unit labor costs q/q','unitLaborCosts'],['Unit labor costs annual','unitLaborCostsAnnual'],['Compensation q/q','nominalHourlyCompensationQuarterly'],['Real compensation q/q','realHourlyCompensationQuarterly'],['Productivity q/q','laborProductivity'],['Unit labor cost index','unitLaborCostIndex'],['Compensation index','nominalHourlyCompensationIndex'],['Productivity index','productivityIndex']],
 cpi:[['Headline annual','cpi'],['Core annual','cpiCore'],['Headline monthly','cpiMonthly'],['Core monthly','cpiCoreMonthly'],['Shelter annual','cpiShelterAnnual'],['Headline index','cpiIndex'],['Core index','cpiCoreIndex'],['Core 3-month annualized','cpiCoreAnnualized3m']],
 pce:[['Headline annual','pce'],['Core annual','pceCore'],['Headline monthly','pceMonthly'],['Core monthly','pceCoreMonthly'],['Services annual','pceServicesAnnual'],['Services ex energy/housing annual','pceServicesExEnergyHousingAnnual'],['Headline index','pceIndex'],['Core index','pceCoreIndex'],['Core 3-month annualized','pceCoreAnnualized3m']],
};
export function familyLedger(current,family){
 const columns=ledgerColumns[family];if(!columns)return '';
 const dates=current.observations.slice(-10).reverse().map(row=>row.date),rows=dates.map(date=>{const original=current.observations.find(row=>row.date===date),notes=normalizeSourceNotes([observationNotes(original),...columns.map(([,id])=>observationNotes(exact(id,date))),original?.revisionIndicator==='Y'?'Source revision flag; reason unknown':''].flat()).join('; ');return `<tr${date===latest(current)?.date?' class="is-latest"':''}><th scope="row"><time datetime="${date}">${esc(periodLabel(current,date))}</time></th>${columns.map(([,id])=>`<td class="num" data-family-input="${id}">${esc(formatValue(familySeries(id),exact(id,date)?.value))}</td>`).join('')}<td>${esc(notes||'—')}</td></tr>`;}).join('');
 const headers=columns.map(([label,id])=>{const s=familySeries(id);return {label:[label,s?.unit,s?.adjustment].filter(Boolean).join(' · '),numeric:true};});
 return `<section class="panel indicator-family-ledger" data-family-ledger="${family}"><header class="panel-head"><h2>Historical ${['eci','productivity','costs'].includes(family)?'accounting':'observations'} ledger · trailing 10 ${current.frequency==='Quarterly'?'quarters':'months'}</h2><span class="stitch-status-label">Current revised history</span></header>${table(['Reference period',...headers,'Source notes'],rows||`<tr><td colspan="${columns.length+2}">No retained observations.</td></tr>`,'Family historical ledger; exact same reference periods only')}<p class="panel-note">Each column retains its native units and adjustment. Values join exact reference dates only; a missing input remains unavailable. SAAR means an annualized quarterly rate; quarterly ECI rates are not annualized. The full selected history, source footnotes and retrieval revisions remain below.</p></section>`;
}
const relatedByFamily={payroll:['unrate','wages','primeAgeParticipation','openings','claimsAdvance'],unemployment:['payroll','primeAgeParticipation','wages','claimsAdvance','quitsRate'],earnings:['payroll','unrate','cpiCore','eciCompensationQuarterly','realWeeklyEarnings'],eci:['payroll','unrate','wages','laborProductivity','unitLaborCosts'],productivity:['payroll','unrate','unitLaborCosts','eciCompensationQuarterly','gdp'],costs:['payroll','unrate','wages','eciCompensationQuarterly','pceCore'],cpi:['pceCore','wages','eciCompensationQuarterly','unitLaborCosts','inflationComp10'],pce:['cpi','wages','eciCompensationQuarterly','unitLaborCosts','effr']};
export function familyRelated(family,currentId,fallback=[]){return [...new Set([...(relatedByFamily[family]??[]),...fallback])].filter(id=>id!==currentId&&getSeries(id)).slice(0,5);}

/** Exact year-ago levels, including explicit missing endpoints, share the source capture. */
export function earningsAnnualSeries(input){
 return annualLevelGrowthSeries(input,{id:'productionEarningsAnnual',name:'Production and nonsupervisory hourly earnings · annual growth',short:'Production/nonsupervisory'});
}
const chartShortNames={payroll:'Monthly payroll change',payrollLevel:'Payroll level',payrollAnnual:'Payroll annual',payrollAverage3m:'3m mean change',unrate:'U-3',underemployment:'U-6',underutilizationSpread:'U-6 less U-3',wages:'All private annual',earningsMonthly:'All private monthly',earningsAnnualized3m:'All private 3m',earningsAnnualized6m:'All private 6m',eciCompensationQuarterly:'Compensation q/q',eciCivilianCompensationAnnual:'Compensation annual',eciCivilianWagesAnnual:'Wages annual',eciCivilianBenefitsAnnual:'Benefits annual',eciCivilianWagesQuarterly:'Wages q/q',eciCivilianBenefitsQuarterly:'Benefits q/q',laborProductivity:'Productivity',productivityAnnual:'Productivity annual',productivityIndex:'Productivity index',nonfarmOutputQuarterly:'Output',hoursWorkedQuarterly:'Hours',nonfarmOutputIndex:'Output index',hoursWorkedIndex:'Hours index',unitLaborCosts:'Unit labor costs',unitLaborCostsAnnual:'Unit labor costs annual',unitLaborCostIndex:'Unit labor cost index',nominalHourlyCompensationIndex:'Compensation index',cpi:'Headline CPI',cpiCore:'Core CPI',pce:'Headline PCE',pceCore:'Core PCE'};
const chartDefinition=id=>blsDeskDefinitions[id]?{...blsDeskDefinitions[id],source:{...blsDeskDefinitions[id].source,seriesIds:blsDeskDefinitions[id].sourceIds},observations:[],dataStatus:'unavailable'}:null;
export function indicatorFamilyChartCatalog({lookup=getSeries,frozen=false}={}){
 const ids=[...new Set(Object.values(indicatorViewDefinitions).flatMap(item=>item.views.flatMap(([, ,ids])=>ids)))],catalog={};
 for(const id of ids){const s=lookup(id)??chartDefinition(id);if(s)catalog[id]={...s,short:chartShortNames[id]??s.short};}
 for(const family of ['cpi','pce'])for(const core of ['', 'Core'])for(const horizon of ['Monthly','Annualized3m','Annualized6m']){
  const id=family+core+horizon;if(catalog[id])catalog[id]={...catalog[id],short:`${core?'Core':'Headline'} ${family.toUpperCase()} ${horizon==='Monthly'?'monthly':horizon==='Annualized3m'?'3m':'6m'}`};
 }
 catalog.productionEarningsAnnual=earningsAnnualSeries(lookup('productionHourlyEarnings'));
 catalog.realEarningsAnnual=annualLevelGrowthSeries(lookup('realHourlyEarnings'),{id:'realEarningsAnnual',name:'Real average hourly earnings · annual growth, all private employees, CPI-U deflated',short:'Real hourly annual'});
 return {'indicator-family':{catalog,evidenceLabel:`${frozen?'Frozen':'Captured'} official native measurements; exact year-ago earnings calculations`}};
}
/** Family views choose the plot's native horizon. Selected-source transforms remain separate. */
export function indicatorChartSelection(current,state={},{lookup=getSeries}={}){
 const definition=Object.values(indicatorViewDefinitions).find(item=>item.root===current.id),range=viewRange(state);
 const catalog=indicatorFamilyChartCatalog({lookup})['indicator-family'].catalog;
 const explicit=definition?.views.find(([key])=>key===state.indicatorView);
 const native=!definition||state.transform==='change'&&!explicit;
 let view=explicit??definition?.views.find(([key])=>key===definition.default);
 // Preserve the native quarterly reading if retained annual ECI endpoints are unavailable.
 if(!explicit&&current.id==='eciCompensationQuarterly'&&!view?.[2].some(id=>catalog[id]?.observations.some(row=>Number.isFinite(row.value))))view=null;
 const ids=native||!view?[current.id]:view[2],seriesCatalog={...catalog,[current.id]:catalog[current.id]??current};
 const transform=native||!view?state.transform??'level':'level';
 const notes={unemployment:'U-3 and U-6 have different denominators; their percentage-point spread is not a person count.',eci:'Annual growth uses exact year-ago NSA indexes. Quarterly growth uses SA indexes and is not annualized.',earnings:'CES employee cohorts differ. Real hourly earnings use CPI-U-deflated constant-dollar levels; none is a fixed-worker wage measure.',costs:'Quarterly rates are already annualized; four-quarter growth and 2017=100 indexes remain separate.',productivity:'Published output, hours and productivity retain their native quarterly horizon or common 2017=100 index base.',cpi:'Annual CPI uses NSA indexes; monthly and compounded 3/6-month momentum use SA indexes.',pce:'Annual, monthly and compounded 3/6-month rates describe different horizons.'};
 const family=Object.keys(indicatorViewDefinitions).find(key=>indicatorViewDefinitions[key]===definition);
 const result=compareSeries(ids,'native',range,seriesCatalog);
 return {ids,catalog:definition?'indicator-family':null,seriesCatalog,transform,kind:native||!view?(current.id==='payroll'?'bar':'line'):view[3]??'line',view:native||!view?'':view[0],viewOptions:definition?.views.map(([key,label])=>({key,label}))??[],range,error:result.error,available:result.panels.some(panel=>panel.observations.length),note:[view&&!native?view[1]:'Selected indicator native measurement',notes[family],definition?'Explicit chart measurements retain their native units and horizon. The transformation control applies to the selected-indicator table and selected CSV; with the default view, observation change also plots that selected indicator.':''].filter(Boolean).join(' · ')};
}
export function indicatorChartCsv(current,state={},options={}){
 const selection=indicatorChartSelection(current,state,options);
 return toCsv(selection.ids,{transform:selection.transform,range:selection.range,catalog:selection.seriesCatalog});
}
export function indicatorWindowStats(selection){
 if(!selection.viewOptions.length)return '';
 const result=compareSeries(selection.ids,'native',selection.range,selection.seriesCatalog);
 if(result.error)return '';
 const rows=result.panels.map(panel=>{
  const plotted=transformSeries(panel.series,selection.transform,selection.range,result.window),finite=plotted.observations.filter(row=>Number.isFinite(row.value));
  if(!finite.length)return `<article><b>${esc(panel.series.short)}</b><p>No finite observations in the displayed window.</p></article>`;
  const values=finite.map(row=>row.value),mean=values.reduce((sum,n)=>sum+n,0)/values.length,min=finite.reduce((a,b)=>a.value<=b.value?a:b),max=finite.reduce((a,b)=>a.value>=b.value?a:b);
  const s=selection.transform==='change'&&panel.series.format==='percent'?{...panel.series,format:'percentagePoints'}:panel.series;
  return `<article><b>${esc(panel.series.short)}</b><dl class="facts"><dt>Mean</dt><dd>${esc(formatValue(s,mean))}</dd><dt>Minimum</dt><dd>${esc(formatValue(s,min.value))} · ${esc(periodLabel(s,min.date))}</dd><dt>Maximum</dt><dd>${esc(formatValue(s,max.value))} · ${esc(periodLabel(s,max.date))}</dd></dl><p class="panel-note">${finite.length} finite observations · ${esc(plotted.unit)} · ${esc(panel.series.adjustment)} · ${esc(periodLabel(s,finite[0].date))} to ${esc(periodLabel(s,finite.at(-1).date))}</p></article>`;
 }).join('');
 return `<section class="indicator-window-stats" data-indicator-window-stats aria-label="Displayed window descriptive statistics"><h3>Displayed-window statistics</h3><p class="panel-note">Arithmetic mean and observed extrema of the displayed native observations; missing values are excluded. These are descriptive readings, not policy targets or confidence limits.</p><div class="family-metric-tiles">${rows}</div></section>`;
}
export function familyExportDock(current,{disabled=false}={}){
 return `<section class="indicator-export-dock"><header><h2>Local CSV export & source access</h2><span class="stitch-status-label">Retained observations</span></header><p>Download the selected indicator’s exact history window, native units, source notes and retrieval provenance. A local export is available without an account.</p><div class="indicator-export-tabs"><span>CSV schema excerpt</span><span>Official source</span></div><pre><code>${esc('series_id,name,date,value,unit,frequency,adjustment,source,publication_date,…\n# '+current.code+' · '+current.unit+'\n# Selected history window; missing values stay empty.')}</code></pre><div class="actions">${button('Download selected CSV',`data-export${disabled?' disabled title="Choose a valid window with retained observations."':''}`)}<a class="action" href="${esc(current.sourceUrl??current.source.url)}" target="_blank" rel="noopener noreferrer">Open official source ↗</a></div><p class="panel-note">Source receipts identify retained inputs; they do not certify an estimate or establish its first publication.</p></section>`;
}
