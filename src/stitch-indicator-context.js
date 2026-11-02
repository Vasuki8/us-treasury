import {getSeries,latest,periodLabel,formatChange} from './model.js';
import {formatDisplayValue,formatDisplayChange,displayUnitLabel} from './display-format.js';
import {measurementChange,priorReadingLabel} from './measurement-change.js';
import {indicatorHref} from './workspace-context.js';
import {escapeHtml as esc} from './ui.js';
import {familyStats,familyStatRows,familyAnalysis} from './stitch-family-view.js';
import {normalizeSourceNotes} from './source-notes.js';

const unavailable=(title,note)=>({title,value:'—',unit:'Not in retained coverage',note,unavailable:true});
const reading=(id,title)=>({id,title,s:getSeries(id)});
const cpiIds=['cpi','cpiCore','cpiMonthly','cpiCoreMonthly','cpiIndex','cpiCoreIndex','cpiSaIndex','cpiCoreSaIndex','cpiAnnualized3m','cpiAnnualized6m','cpiCoreAnnualized3m','cpiCoreAnnualized6m'];
const pceIds=['pce','pceCore','pceMonthly','pceCoreMonthly','pceIndex','pceCoreIndex','pceAnnualized3m','pceAnnualized6m','pceCoreAnnualized3m','pceCoreAnnualized6m'];
export const indicatorFamily=current=>cpiIds.includes(current.id)?'cpi':pceIds.includes(current.id)?'pce':/^payroll/.test(current.id)?'payroll':['unrate','underemployment','u1Rate','u2Rate','u3RateDesk','u4Rate','u5Rate','u6RateDesk'].includes(current.id)?'unemployment':['wages','hourlyEarnings','productionHourlyEarnings','earningsMonthly','earningsAnnualized3m','earningsAnnualized6m'].includes(current.id)?'earnings':current.id.startsWith('eci')?'eci':current.id==='laborProductivity'||current.id.startsWith('productivity')?'productivity':current.id==='unitLaborCosts'||current.id.startsWith('unitLaborCost')?'costs':'other';

function statItems(current){
 const reference=familyStats(current,indicatorFamily(current));
 if(reference){const visible=reference.some(item=>item.id===current.id||(item.rows??[]).some(([,id])=>id===current.id));return visible?reference:[reading(current.id,current.short),...reference.slice(1)];}
 return [reading(current.id,current.short),{title:'Previous retained reading',s:current,observation:current.observations.at(-2),note:'Previous retained observation; dates can be nonadjacent.'},{title:measurementChange(current).label,value:formatDisplayChange(current),unit:'Native change units',note:measurementChange(current).text},unavailable('Component coverage','Detailed component observations are not included in this series.')];
}

function renderStats(items,current,state,options={}){
 const compact=indicatorFamily(current)!=='other';
 return items.map(item=>{
  const row=item.observation??(Object.hasOwn(item,'observation')?undefined:latest(item.s)),isSelected=item.id===current.id;
  const change=item.s?measurementChange(item.s).text.replace(formatChange(item.s),formatDisplayChange(item.s,options)):'';
  const prior=item.s?.observations?.at(-2),converted=compact&&item.id==='payrollLevel'&&!isSelected&&item.s?.unit==='Thousands of jobs';
  const display=value=>converted&&Number.isFinite(value)?`${(value/1000).toFixed(2)}M`:formatDisplayValue(item.s,value,options);
  const unit=converted?'Millions of jobs':item.unit??displayUnitLabel(item.s,options),code=item.s?.code??item.code??'Coverage';
  const nativeTitle=converted?`${row?.value??'Unavailable'} ${item.s.unit} · ${code}; display = source thousands ÷ 1,000.`:code;
  const inspect=item.id&&!isSelected&&getSeries(item.id),heading=compact&&inspect?`<a class="indicator-stat-heading-link" href="${esc(indicatorHref(item.id,state))}">${esc(item.title)}</a>`:esc(item.title);
  const date=item.unavailable?'Not retained':item.s?periodLabel(item.s,row?.date):periodLabel(current,latest(current)?.date);
  const hasHistory=item.s&&!Object.hasOwn(item,'observation')&&!Object.hasOwn(item,'value');
  const delta=hasHistory&&item.s.id!=='payroll'?`<span class="indicator-change" title="${esc(change)}">Δ ${esc(formatDisplayChange(item.s,options))}${converted?' jobs':''}</span>`:'';
  const reference=compact?`<p class="indicator-reference"><b>${esc(date)}</b>${delta}</p>`:`<p class="indicator-reference">Observation <b>${esc(date)}</b></p>`;
  const history=!hasHistory?'':compact?`<p class="indicator-prior">${item.s.id==='payroll'?esc(priorReadingLabel(item.s))+':':'Prior'} <b>${esc(display(prior?.value))}</b> · ${esc(periodLabel(item.s,prior?.date))}</p>`:`<p class="indicator-change">${esc(item.s.id==='payroll'?`${priorReadingLabel(item.s)}: ${display(prior?.value)} · ${periodLabel(item.s,prior?.date)}`:change)}</p>${item.s.id==='payroll'?'':`<p class="indicator-prior">Prior <b>${esc(display(prior?.value))}</b> · ${esc(periodLabel(item.s,prior?.date))}</p>`}`;
  const notes=normalizeSourceNotes(row?.footnotes),note=item.note?(compact?`<details class="indicator-stat-method"><summary>Measurement note</summary><p>${esc(item.note)}</p></details>`:`<p class="indicator-stat-note">${esc(item.note)}</p>`):'';
  const status=[item.s?.dataStatus==='cached'?'Cached reading':'',item.s?.dataStatus==='unavailable'||item.id&&!Number.isFinite(row?.value)?'Unavailable reading':''].filter(Boolean).join(' · ');
  return `<article class="indicator-stat${isSelected?' indicator-selected-stat':''}"${item.id?` data-stat-series="${esc(item.id)}"`:''}><div class="indicator-stat-heading"><h2 title="${esc(nativeTitle)}">${heading}</h2>${compact?'':`<span>${esc(code)}</span>`}</div><div class="indicator-native-reading"><strong class="big-value"${converted?` title="${esc(nativeTitle)}"`:''}>${esc(item.value??display(row?.value))}</strong><span class="indicator-stat-unit">${compact?esc(unit):`${options.currencyUnit?'Display unit':'Native unit'}<br><b>${esc(unit)}</b>`}</span></div>${reference}${history}${familyStatRows(item.rows,state,compact?{referenceDate:row?.date??latest(current)?.date,referenceUnit:unit,selectedId:current.id,seenNotes:new Set(notes)}:{})}${note}${status?`<p class="indicator-reading-status amber" role="status">${status}</p>`:''}${item.s?.error?`<p class="amber" role="status">${esc(item.s.error)}</p>`:''}${notes.map(note=>`<p class="indicator-stat-note amber" role="status">${esc(note)}</p>`).join('')}${!compact&&inspect?`<a class="indicator-stat-link" href="${esc(indicatorHref(item.id,state))}">Inspect series →</a>`:''}</article>`;
 }).join('');
}

export function indicatorStats(current,state,options={}){
 return `<section class="indicator-snapshot" aria-label="Latest retained reading"><p class="indicator-latest-label">Latest retained reading · independent of the selected history window and transformation</p><div class="indicator-stat-grid">${renderStats(statItems(current),current,state,options)}</div></section>`;
}

/** The reference reading strip is rendered once, above the historical chart. */
export function indicatorRelatedStats(){return '';}

export function indicatorContext(current,state){return familyAnalysis(current,state,indicatorFamily(current));}
