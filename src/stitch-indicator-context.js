import {getSeries,latest,periodLabel,formatChange} from './model.js';
import {formatDisplayValue,formatDisplayChange,displayUnitLabel} from './display-format.js';
import {measurementChange,priorReadingLabel} from './measurement-change.js';
import {indicatorHref} from './workspace-context.js';
import {escapeHtml as esc} from './ui.js';

const numeric=value=>['number','string'].includes(typeof value)&&String(value).trim()!==''&&Number.isFinite(Number(value))?Number(value):null;
const previousDate=(date,months)=>{if(!/^\d{4}-\d{2}-01$/.test(date??''))return null;const d=new Date(`${date}T00:00:00Z`);d.setUTCMonth(d.getUTCMonth()-months);return d.toISOString().slice(0,10);};
const sourceValue=row=>numeric(row?.sourceValue);
function growth(s,months,{raw=false,annualize=false}={}){
 const row=latest(s),prior=s.observations.find(o=>o.date===previousDate(row?.date,months));
 const value=raw?sourceValue(row):row?.value,base=raw?sourceValue(prior):prior?.value;
 return Number.isFinite(value)&&Number.isFinite(base)&&value>0&&base>0?100*((value/base)**(annualize?12/months:1)-1):null;
}
const percent=value=>Number.isFinite(value)?`${value<0?'−':'+'}${Math.abs(value).toFixed(2)}%`:'—';
const unavailable=(title,note)=>({title,value:'—',unit:'Not in retained coverage',note,unavailable:true});
const reading=(id,title)=>({id,title,s:getSeries(id)});
const cpiIds=['cpi','cpiCore','cpiMonthly','cpiCoreMonthly','cpiIndex','cpiCoreIndex','cpiSaIndex','cpiCoreSaIndex','cpiAnnualized3m','cpiAnnualized6m','cpiCoreAnnualized3m','cpiCoreAnnualized6m'];
const pceIds=['pce','pceCore','pceMonthly','pceCoreMonthly','pceIndex','pceCoreIndex','pceAnnualized3m','pceAnnualized6m','pceCoreAnnualized3m','pceCoreAnnualized6m'];
export const indicatorFamily=current=>cpiIds.includes(current.id)?'cpi':pceIds.includes(current.id)?'pce':['payroll','payrollLevel','payrollAverage3m'].includes(current.id)?'payroll':['unrate','underemployment'].includes(current.id)?'unemployment':current.id==='wages'?'earnings':current.id.startsWith('eciCompensation')?'eci':current.id==='laborProductivity'?'productivity':current.id==='unitLaborCosts'?'costs':'other';

function statItems(current){
 const family=indicatorFamily(current),selected=reading(current.id,current.short);
 if(family==='payroll')return [reading('payrollLevel','Total level · SA'),reading('payroll','Net monthly change'),reading('payrollAverage3m','3-month moving average'),{title:'12-month payroll growth',value:percent(growth(getSeries('payrollLevel'),12)),unit:'Derived year over year',note:'Exact year-ago employment level; current revised history.'}];
 if(family==='unemployment')return [reading('unrate','Official headline · U-3'),reading('underemployment','Broad underutilization · U-6'),unavailable('Household employment levels','Unemployed, employed and labor-force counts are not supplied by the retained rate series.'),unavailable('Underutilization components','Separate part-time, marginally attached and discouraged-worker counts are not retained.')];
 if(family==='earnings'){
  const raw=sourceValue(latest(current));
  return [{title:'Latest hourly earnings',value:Number.isFinite(raw)?`$${raw.toFixed(2)}`:'—',unit:'USD per hour · source input',note:'Retained level used to calculate annual wage growth. Not an unrounded microdata estimate.'},selected,{title:'Monthly earnings growth',value:percent(growth(current,1,{raw:true})),unit:'Derived month over month · SA',note:'Calculated from exact adjacent source hourly-earnings inputs.'},{title:'3-month earnings momentum',value:percent(growth(current,3,{raw:true,annualize:true})),unit:'Derived annualized growth · SA',note:'100 × [(latest / exact 3-month-ago level)⁴ − 1].'}];
 }
 if(family==='eci')return [reading('eciCompensationQuarterly','Quarterly compensation growth'),{title:'12-month compensation growth',value:percent(growth(getSeries('eciCompensation'),12)),unit:'Derived year over year · SA',note:'Calculated from the exact year-ago seasonally adjusted index; not the published NSA annual rate.'},unavailable('Wages & benefit components','The retained civilian total-compensation index does not include a component split.'),reading('eciCompensation','Civilian compensation index')];
 if(family==='productivity'||family==='costs')return [selected,unavailable('4-quarter growth rate','The retained feed supplies quarterly annualized growth, not an index or published year-over-year rate.'),unavailable('Output / hours / compensation','The source components needed for an accounting decomposition are not retained.'),reading(family==='costs'?'laborProductivity':'unitLaborCosts',family==='costs'?'Productivity · quarterly annualized':'Unit labor costs · quarterly annualized')];
 if(family==='cpi'||family==='pce'){
  const prefix=family==='cpi'?'cpi':'pce',core=current.id.toLowerCase().includes('core'),peer=core?prefix:prefix+'Core';
  return [selected,reading(peer,core?'Headline annual inflation':'Core annual inflation'),reading(prefix+(core?'Core':''),core?'Core annual inflation':'Headline annual inflation'),reading(prefix+(core?'Core':'')+'Monthly',core?'Core monthly inflation':'Headline monthly inflation'),reading(prefix+(core?'Core':'')+'Annualized3m','3-month annualized inflation')].filter((item,index,items)=>items.findIndex(other=>other.id===item.id)===index).slice(0,4);
 }
 return [selected,{title:'Previous retained reading',s:current,observation:current.observations.at(-2),note:'Previous retained observation; dates can be nonadjacent.'},{title:measurementChange(current).label,value:formatDisplayChange(current),unit:'Native change units',note:measurementChange(current).text},unavailable('Component coverage','Detailed component observations are not included in this series.')];
}

function renderStats(items,current,state,options={}){
 return items.map(item=>{
  const row=item.observation??(Object.hasOwn(item,'observation')?undefined:latest(item.s)),isSelected=item.id===current.id;
  const change=item.s?measurementChange(item.s).text.replace(formatChange(item.s),formatDisplayChange(item.s,options)):'';
  return `<article class="indicator-stat${isSelected?' indicator-selected-stat':''}"${item.id?` data-stat-series="${esc(item.id)}"`:''}><div class="indicator-stat-heading"><h2>${esc(item.title)}</h2><span>${esc(item.s?.code??'Coverage')}</span></div><div class="indicator-native-reading"><strong class="big-value">${esc(item.value??formatDisplayValue(item.s,row?.value,options))}</strong><span>${options.currencyUnit?'Display unit':'Native unit'}<br><b>${esc(item.unit??displayUnitLabel(item.s,options))}</b></span></div><p class="indicator-reference">Observation <b>${esc(item.unavailable?'Not retained':item.s?periodLabel(item.s,row?.date):periodLabel(current,latest(current)?.date))}</b></p>${item.s&&!Object.hasOwn(item,'observation')?`<p class="indicator-change">${esc(item.s.id==='payroll'?`${priorReadingLabel(item.s)}: ${formatDisplayValue(item.s,item.s.observations.at(-2)?.value,options)} · ${periodLabel(item.s,item.s.observations.at(-2)?.date)}`:change)}</p>${item.s.id==='payroll'?'':`<p class="indicator-prior">Prior <b>${esc(formatDisplayValue(item.s,item.s.observations.at(-2)?.value,options))}</b> · ${esc(periodLabel(item.s,item.s.observations.at(-2)?.date))}</p>`}`:''}${item.note?`<p class="indicator-stat-note">${esc(item.note)}</p>`:''}${item.s?.dataStatus==='cached'||item.s?.dataStatus==='unavailable'?`<p class="indicator-reading-status amber" role="status">${item.s.dataStatus==='cached'?'Cached reading':'Unavailable reading'}</p>`:''}${item.s?.error?`<p class="amber" role="status">${esc(item.s.error)}</p>`:''}${(row?.footnotes??[]).map(note=>`<p class="indicator-stat-note amber" role="status">${esc(note)}</p>`).join('')}${item.id&&!isSelected?`<a class="indicator-stat-link" href="${esc(indicatorHref(item.id,state))}">Inspect series →</a>`:''}</article>`;
 }).join('');
}

export function indicatorStats(current,state,options={}){
 return `<section class="indicator-snapshot" aria-label="Latest retained reading"><p class="indicator-latest-label">Latest retained reading · independent of the selected history window and transformation</p><div class="indicator-selected-reading">${renderStats([reading(current.id,current.short)],current,state,options)}</div></section>`;
}

export function indicatorRelatedStats(current,state,options={}){
 return `<details class="indicator-reading-context" data-indicator-reading-context data-page-disclosure="indicator-context-${esc(current.id)}" open><summary>Related readings &amp; context</summary><div class="indicator-stat-grid">${renderStats(statItems(current),current,state,options)}</div></details>`;
}

export function indicatorContext(current,state){
 const family=indicatorFamily(current),coverage={
  payroll:['CES supersector decomposition','Sector payroll changes are not retained in this workspace. The total and three-month average cannot identify sector contributions.'],
  unemployment:['Labor underutilization spectrum','U-3 and U-6 are retained. U-1, U-2, U-4, U-5 and component person counts are outside current coverage. Different denominators prevent interpreting U-6 minus U-3 as a person count.'],
  earnings:['Composition effects & compensation context','Average hourly earnings reflect the employee and industry mix. The Employment Cost Index is a separate compensation measure; its quarterly horizon and coverage differ from monthly earnings.'],
  eci:['Compensation structure & component coverage','Civilian total compensation is retained. Wages, benefits, private-industry and state/local-government splits are not supplied in the current index feed.'],
  productivity:['Productivity mechanics & accounting coverage','The retained series measures nonfarm business real output per hour growth. Output, hours and capital-deepening components are not retained; their contributions cannot be reconstructed from this growth rate.'],
  costs:['Labor costs & productivity accounting','Unit labor costs relate hourly compensation to output per hour. Hourly-compensation and index-level inputs are not retained; no decomposition or inflation pass-through estimate is inferred.'],
  cpi:['Inflation mechanics & decomposition','Annual CPI uses exact year-ago NSA indexes; monthly and annualized momentum use SA indexes. This indicator history does not retain basket weights, shelter contributions or a supercore decomposition.'],
  pce:['PCE / CPI structural comparison','PCE and CPI differ in scope, weights and formulas. This history retains headline/core PCE indexes and rates; component weights and supercore estimates are not reconstructed from them.'],
  other:['Measurement context','Read this measure in its native units and original frequency. Changes compare retained observations; missing and suppressed values remain unavailable.'],
 }[family];
 const preliminary=latest(current)?.footnotes?.some(note=>/preliminary/i.test(note));
 return `<div class="indicator-context-grid"><section class="indicator-context-card"><header><h2>${esc(coverage[0])}</h2><span>Retained coverage</span></header><p>${esc(coverage[1])}</p><a class="link-button" href="${esc(indicatorHref(current.id,state))}">Inspect selected series</a></section><section class="indicator-context-card indicator-audit-card"><header><h2>Uncertainty & revision coverage</h2><span>Source limitations</span></header><p>${preliminary?'Preliminary estimate. ':''}Source footnotes and revision flags are retained in the observation table. Confidence intervals and survey response rates are not supplied in this series metadata.</p><p>Current revised history does not establish first-published estimates. Immutable retrieval captures document changes observed after collection began; they do not reconstruct a complete release-vintage sequence.</p><a class="link-button" href="#/vintages?series=${esc(current.id)}">Inspect retrieval history →</a></section></div>`;
}
