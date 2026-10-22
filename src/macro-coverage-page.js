import {coverageFamilies} from './macro-registry.js';
import {getSeries,latest,formatValue,formatChange,periodLabel,transformSeries} from './model.js';
import {routeFor} from './router.js';import {viewRange,indicatorHref} from './workspace-context.js';
import {rangeControls,coverageSummary} from './research-controls.js';
import {heading,panel,button,chart,table,emptyState,sourceLink,seriesStatus,escapeHtml as esc} from './ui.js';

export function macroCoveragePage(state={}){
 const familyId=Object.hasOwn(coverageFamilies,state.macroFamily)?state.macroFamily:'prices',family=coverageFamilies[familyId];
 const id=family.ids.includes(state.macroMeasure)?state.macroMeasure:family.defaultMeasure,current=getSeries(id),range=viewRange(state);
 const focused={...state,page:'macroCoverage',macroFamily:familyId,macroMeasure:id},shown=transformSeries(current,'level',range),last=shown.observations.at(-1);
 const previous=getSeries(id).observations.filter(o=>!shown.window.endDate||o.date<=shown.window.endDate);
 const changed=last?`${formatValue(current,last.value)} at ${periodLabel(current,last.date)}. Change from the preceding source observation: ${formatChange({...current,observations:previous})}.`:'No source observation falls in this date window.';
 const controls=`<div class="toolbar macro-family-controls"><label for="macro-family">Measurement family<select id="macro-family" aria-label="Measurement family">${Object.entries(coverageFamilies).map(([key,value])=>`<option value="${key}"${key===familyId?' selected':''}>${esc(value.label)}</option>`).join('')}</select></label><label for="macro-measure">History measure<select id="macro-measure" aria-label="History measure">${family.ids.map(key=>`<option value="${key}"${key===id?' selected':''}>${esc(getSeries(key).name)}</option>`).join('')}</select></label>${rangeControls(focused,[id])}</div>`;
 const errors=current.error?`<p class="panel-note amber">${esc(current.error)}</p>`:'';
 const history=shown.observations.length?chart([id],{range,height:250}):emptyState('History unavailable.',shown.error??current.error??'No retained observations are available in the selected date window.');
 const detail=indicatorHref(id,focused);
 const rows=family.ids.map(key=>{
  const s=getSeries(key),observation=latest(s),observations=s.observations;
  const dates=observations.length?`${observations[0].date} to ${observations.at(-1).date}`:'Unavailable';
  return `<tr><th scope="row"><a href="${esc(indicatorHref(key,{...focused,macroMeasure:key}))}">${esc(s.name)}</a><span class="table-code mono muted">${esc(s.code)}</span><span class="table-code muted">${esc(s.unit)} · ${esc(s.adjustment)}</span></th><td class="num">${esc(formatValue(s,observation?.value))}</td><td>${esc(observation?periodLabel(s,observation.date):'Unavailable')}</td><td>${esc(seriesStatus(s))}<span class="table-code muted">${esc(dates)} · ${observations.length} observations</span>${s.error?`<span class="table-code amber">${esc(s.error)}</span>`:''}</td></tr>`;
 }).join('');
 const available=shown.observations.some(o=>Number.isFinite(o.value));
 return heading('MACRO COVERAGE',`${family.label} / ${family.question}`,button('COMPARE FAMILY',`data-compare="${esc(family.compare.join(','))}"`)+button('CSV MEASURE',`data-export-macro-measure${shown.error||!available?' disabled title="A valid window with retained observations is required."':''}`))
  + `<div class="grid g21">${panel('01','FOCUSED HISTORY',controls+errors+history+coverageSummary(shown),`<a class="action" href="${esc(detail)}">DETAILS & DATA TABLE ↗</a>`,`${current.frequency} · ${current.unit} · ${current.adjustment}`)}${panel('02','RESEARCH QUESTION',`<div class="explain"><p><strong>WHAT CHANGED.</strong> ${esc(changed)}</p><p><strong>CONTEXT.</strong> ${esc(family.context)}</p><p><strong>WHY IT MATTERS.</strong> ${esc(family.question)} Inspect native measures and compare their timing; accounting contributions remain in <a href="#/macro">Macro drivers</a>.</p><p><strong>LIMITATIONS.</strong> ${esc(family.limitations)}</p><p>${esc(current.definition)}</p><p>Source: ${sourceLink(current)}. Retrieval: <span class="mono">${esc(current.fetchedAt??'Unavailable')}</span>. Reference dates are not verified publication timestamps.</p><p><a href="${esc(family.schedule)}" target="_blank" rel="noopener noreferrer">External official schedule ↗</a>. BLS, BEA, DOL and Census program associations appear in the <a href="#/calendar">captured calendar</a> where available. Board policy/G.17 links are external; no dated events are inferred.</p></div>`)}</div>`
  + panel('03','LATEST RETAINED READINGS',table(['MEASUREMENT / DEFINITION','LATEST','REFERENCE PERIOD','SOURCE STATUS / FULL COVERAGE'],rows,'Measurement family latest observations and complete retained coverage'),'', 'Latest readings can fall outside the focused chart window and can have different reference periods. Open a measurement for its definition, source, selected-window data table and CSV. Compare family opens native panels with one shared calendar window.')
  + `<p class="panel-note">CSV MEASURE exports the focused history's exact window in native units, including source identifiers, calculation, rights notices and retrieval provenance. All history means retained observations; new captures do not establish historical publication vintages.</p>`;
}
