import {getSeries,latest,periodLabel,formatValue} from './model.js';
import {formatDisplayValue} from './display-format.js';
import {escapeHtml as esc,table,button} from './ui.js';
import {indicatorHref} from './workspace-context.js';
import {blsDeskDefinitions} from './bls-desk-definitions.js';
import {renderFamilyAnalysis} from './stitch-family-analysis.js';

/** Definition-only fallbacks never manufacture a source observation. */
export function familySeries(id){
 return getSeries(id)??(blsDeskDefinitions[id]?{...blsDeskDefinitions[id],source:{...blsDeskDefinitions[id].source,seriesIds:blsDeskDefinitions[id].sourceIds},observations:[],dataStatus:'unavailable'}:undefined);
}
const reading=(id,title,rows=[],note='')=>({id,title,s:familySeries(id),rows,note});
const value=(s,row=latest(s))=>formatDisplayValue(s,row?.value);
const period=s=>latest(s)?periodLabel(s,latest(s).date):'Not retained';
const observationNotes=row=>[...(row?.footnotes??[]),row?.imputed?'Source-imputed monthly observation':'',row?.imputationAffected?'Annual window includes source-imputed months':'',row?.suppressed?'Suppressed by source':''].filter(Boolean);
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
 if(family==='unemployment')return [reading('unrate','Official headline · U-3'),reading('underemployment','Broad underutilization · U-6',[['U-6 minus U-3','underutilizationSpread']]),reading('laborForceLevel','Civilian labor force',[['Unemployed people','unemployedLevel'],['Employed people','employedLevel']]),reading('economicPartTimeLevel','Underutilization components',[['Marginally attached','marginallyAttachedLevel'],['Discouraged workers','discouragedLevel']],'Discouraged workers are included within the marginally attached; these counts are not added together.')];
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
 payroll:[['Total level','payrollLevel'],['Monthly change','payroll'],['3-month average','payrollAverage3m'],['Annual growth','payrollAnnual']],
 unemployment:[['U-3','unrate'],['U-6','underemployment'],['Labor force','laborForceLevel'],['Unemployed','unemployedLevel']],
 earnings:[['Hourly earnings','hourlyEarnings'],['Annual growth','wages'],['Monthly growth','earningsMonthly'],['3-month annualized','earningsAnnualized3m']],
 eci:[['Quarterly SA','eciCompensationQuarterly'],['Annual NSA','eciCivilianCompensationAnnual'],['Wages annual','eciCivilianWagesAnnual'],['Benefits annual','eciCivilianBenefitsAnnual']],
 productivity:[['Quarterly SAAR','laborProductivity'],['Annual growth','productivityAnnual'],['Output SAAR','nonfarmOutputQuarterly'],['Hours SAAR','hoursWorkedQuarterly']],
 costs:[['Quarterly SAAR','unitLaborCosts'],['Annual growth','unitLaborCostsAnnual'],['Compensation SAAR','nominalHourlyCompensationQuarterly'],['Productivity SAAR','laborProductivity']],
 cpi:[['Headline YoY · NSA','cpi'],['Core YoY · NSA','cpiCore'],['Headline MoM · SA','cpiMonthly'],['Core MoM · SA','cpiCoreMonthly']],
 pce:[['Headline YoY','pce'],['Core YoY','pceCore'],['Headline MoM','pceMonthly'],['Core MoM','pceCoreMonthly']],
};
export function familyLedger(current,family){
 const columns=ledgerColumns[family];if(!columns)return '';
 const dates=current.observations.slice(-10).reverse().map(row=>row.date),rows=dates.map(date=>{const original=current.observations.find(row=>row.date===date),notes=[...(original?.footnotes??[]),original?.revisionIndicator==='Y'?'Source revision flag; reason unknown':'',original?.suppressed?'Suppressed by source':''].filter(Boolean).join('; ');return `<tr${date===latest(current)?.date?' class="is-latest"':''}><th scope="row"><time datetime="${date}">${esc(periodLabel(current,date))}</time></th>${columns.map(([,id])=>`<td class="num" data-family-input="${id}">${esc(formatValue(familySeries(id),exact(id,date)?.value))}</td>`).join('')}<td>${esc(notes||'—')}</td></tr>`;}).join('');
 return `<section class="panel indicator-family-ledger" data-family-ledger="${family}"><header class="panel-head"><h2>Historical ${['eci','productivity','costs'].includes(family)?'accounting':'observations'} ledger · trailing 10 ${current.frequency==='Quarterly'?'quarters':'months'}</h2><span class="stitch-status-label">Current revised history</span></header>${table(['Reference period',...columns.map(([label])=>({label,numeric:true})),'Source notes'],rows||'<tr><td colspan="6">No retained observations.</td></tr>','Family historical ledger; exact same reference periods only')}<p class="panel-note">Each column retains its native units and adjustment. Values join exact reference dates only; a missing input remains unavailable. The full selected history, source footnotes and retrieval revisions remain below.</p></section>`;
}
const relatedByFamily={payroll:['unrate','wages','primeAgeParticipation','openings','claimsAdvance'],unemployment:['payroll','primeAgeParticipation','wages','claimsAdvance','quitsRate'],earnings:['payroll','unrate','cpiCore','eciCompensationQuarterly','weeklyHours'],eci:['payroll','unrate','wages','laborProductivity','unitLaborCosts'],productivity:['payroll','unrate','unitLaborCosts','eciCompensationQuarterly','gdp'],costs:['payroll','unrate','wages','eciCompensationQuarterly','pceCore'],cpi:['pceCore','wages','eciCompensationQuarterly','unitLaborCosts','inflationComp10'],pce:['cpi','wages','eciCompensationQuarterly','unitLaborCosts','policyTargetUpper']};
export function familyRelated(family,currentId,fallback=[]){return [...new Set([...(relatedByFamily[family]??[]),...fallback])].filter(id=>id!==currentId&&getSeries(id)).slice(0,5);}

/** Exact year-ago levels, including explicit missing endpoints, share the source capture. */
export function earningsAnnualSeries(input){
 const id='productionEarningsAnnual',rows=input?.observations??[];
 return {...input,id,name:'Production and nonsupervisory hourly earnings · annual growth',short:'Production/nonsupervisory',unit:'Percent year over year',format:'percent',precision:2,frequency:'Monthly',comparisonClass:'growth',observationType:'calculated',source:input?.source??{name:'Bureau of Labor Statistics',url:'https://www.bls.gov/ces/',seriesIds:[]},dataStatus:input?.dataStatus??'unavailable',calculation:'100 × (hourly earnings / exact year-ago monthly hourly earnings − 1).',observations:rows.map(row=>{const date=`${Number(row.date.slice(0,4))-1}${row.date.slice(4)}`,prior=rows.find(item=>item.date===date),valid=Number.isFinite(row.value)&&Number.isFinite(prior?.value)&&row.value>0&&prior.value>0;return {...row,value:valid?100*(row.value/prior.value-1):null,sourceValue:row.value,baseDate:date,baseValue:prior?.value??null,inputDates:[row.date,date],inputValues:[row.value,prior?.value??null]};})};
}
export function indicatorFamilyChartCatalog({lookup=getSeries,frozen=false}={}){
 const production=earningsAnnualSeries(lookup('productionHourlyEarnings'));
 return {'indicator-family':{catalog:{...(lookup('wages')?{wages:lookup('wages')}:{}),productionEarningsAnnual:production},evidenceLabel:`${frozen?'Frozen':'Captured'} official BLS levels; exact year-ago earnings calculation`}};
}
export function familyChartSelection(current,family){
 if(family==='earnings'&&current.id==='wages')return {ids:['wages','productionEarningsAnnual'],catalog:'indicator-family',note:'Percent year over year · all private employees and production/nonsupervisory employees; exact year-ago levels. The table and CSV retain the selected indicator.'};
 if(family==='eci'&&['eciCompensation','eciCompensationQuarterly'].includes(current.id))return {ids:['eciCivilianCompensationAnnual','eciCivilianWagesAnnual','eciCivilianBenefitsAnnual'].filter(id=>getSeries(id)?.observations.some(row=>Number.isFinite(row.value))),note:'Annual compensation, wages and benefits · exact year-ago NSA ECI index endpoints. The selected-series table and CSV retain their own SA index or quarterly rate.'};
 if(['cpi','pce'].includes(family)){
  const core=current.id.includes('Core'),suffix=current.id.slice(family.length+(core?4:0)),peer=family+(core?'':'Core')+suffix;
  return {ids:[current.id,peer].filter(id=>getSeries(id)),note:'Headline and core retain the same displayed horizon and adjustment. Annual NSA CPI and monthly SA CPI remain distinct.'};
 }
 return null;
}

export function familyExportDock(current,{disabled=false}={}){
 return `<section class="indicator-export-dock"><header><h2>Local CSV export & source access</h2><span class="stitch-status-label">Retained observations</span></header><p>Download the selected indicator’s exact history window, native units, source notes and retrieval provenance. A local export is available without an account.</p><div class="indicator-export-tabs"><span>CSV schema excerpt</span><span>Official source</span></div><pre><code>${esc('series_id,name,date,value,unit,frequency,adjustment,source,publication_date,…\n# '+current.code+' · '+current.unit+'\n# Selected history window; missing values stay empty.')}</code></pre><div class="actions">${button('Download selected CSV',`data-export${disabled?' disabled title="Choose a valid window with retained observations."':''}`)}<a class="action" href="${esc(current.sourceUrl??current.source.url)}" target="_blank" rel="noopener noreferrer">Open official source ↗</a></div><p class="panel-note">Source receipts identify retained inputs; they do not certify an estimate or establish its first publication.</p></section>`;
}
