import {readingGroup,supportingDetails} from './page-hierarchy.js';
import {renderPcePriceContributions} from './economic-evidence.js';
import {pceBaseEffectsView} from './pce-base-effects.js';
import {pceScenarioOptions} from './workspace-context.js';
import { measurementChange } from './measurement-change.js';
import {inflationHorizonTable} from './inflation-comparison.js';
import {cpiEffectsCoveragePanel} from './macro-page.js';
import {fomcContext} from './credit-context-page.js';
import {currentAccountPanel} from './current-account-view.js';
import {currentAccountGdpPanel} from './current-account-gdp-view.js';
import {currentAccountGdpHistoryPanel} from './current-account-gdp-history-view.js';
import {currentAccountGdpBreakdownPanel} from './current-account-gdp-breakdown-view.js';
import {currentAccountGdpTrailingPanel} from './current-account-gdp-trailing-view.js';
import {currentAccountGdpComparisonPanel} from './current-account-gdp-comparison-view.js';
import {currentAccountGdpContributionsPanel} from './current-account-gdp-contributions-view.js';
import {currentAccountGdpBalanceEffectsPanel} from './current-account-gdp-balance-effects-view.js';
import {currentAccountGdpComponentEffectsPanel} from './current-account-gdp-component-effects-view.js';
import {currentAccountGdpAllComponentEffectsPanel} from './current-account-gdp-all-component-effects-view.js';
import {dataStatus} from './data.js';
import {coverageFamilies} from './macro-registry.js';
import {getSeries,latest,formatValue,periodLabel,transformSeries} from './model.js';
import {routeFor} from './router.js';import {viewRange,indicatorHref} from './workspace-context.js';
import {rangeControls,coverageSummary} from './research-controls.js';
import {heading,panel,button,chart,table,emptyState,sourceLink,seriesStatus,escapeHtml as esc} from './ui.js';

const externalSections=[['summary','Summary'],['trends','Trends'],['decomposition','Decomposition'],['methods','Data & methods']];
function externalNavigation(state,active){
 return `<nav class="research-navigation" aria-label="Current-account sections">${externalSections.map(([id,label])=>`<a class="action" href="${esc(routeFor({...state,externalView:id}))}"${id===active?' aria-current="page"':''}>${esc(label)}</a>`).join('')}</nav>`;
}
function externalMethods(state,readings,research){
 const link=(section,label)=>`<a href="${esc(routeFor({...state,externalView:section}))}">${esc(label)}</a>`;
 return readings+panel('M','DATA & METHODS',`<div class="explain"><p><strong>Native accounting.</strong> Goods + services + primary income + secondary income reconcile to the current-account balance, subject to source rounding. ITA balances are seasonally adjusted quarterly USD billions, not annualized. NIPA exports, imports and trade use different definitions and annual-rate units.</p><p><strong>GDP ratios.</strong> Quarterly ratios match the exact reference quarter. Nominal GDP at SAAR is divided by four once; the current-account balance is not annualized. Trailing four-quarter ratios require four consecutive quarters. Missing inputs remain unavailable; no interpolation or older-quarter substitution is made.</p><p><strong>Change analysis.</strong> Contributions and balance-versus-denominator effects describe accounting arithmetic. They are not causal explanations, market surprises, investment signals or measures of foreign debt.</p><p><strong>Evidence.</strong> Current revised histories can change. Reference periods, table release dates and retrieval timestamps are separate. A dataset release date does not establish the first publication of each historical observation.</p></div>`)
  +research+panel('CSV','EXPORTS & SOURCE INPUTS',`<p class="panel-note">CSV MEASURE exports the selected native measure and exact window from the page header. Each analysis panel retains its own CSV with formulas, missing values, source inputs and retrieval provenance.</p><div class="explain"><p>${link('summary','Summary: native current/prior accounting and latest-quarter ratio inputs ↗')}</p><p>${link('trends','Trends: ratio history, comparison, component breakdown and trailing-quarter inputs ↗')}</p><p>${link('decomposition','Decomposition: contributions, balance/GDP effects, all-component and selected-component inputs ↗')}</p></div><p class="panel-note">Freezing this workspace preserves all existing current-account calculation inputs and exports, including analysis in the other sections.</p>`);
}

export function macroCoveragePage(state={}, {embedded=false}={}){
 const familyId=Object.hasOwn(coverageFamilies,state.macroFamily)?state.macroFamily:'prices',family=coverageFamilies[familyId];
 const id=family.ids.includes(state.macroMeasure)?state.macroMeasure:family.defaultMeasure,current=getSeries(id),range=viewRange(state);
 const focused={...state,page:'macroCoverage',macroFamily:familyId,macroMeasure:id},shown=transformSeries(current,'level',range),last=shown.observations.at(-1);
 const previous=getSeries(id).observations.filter(o=>!shown.window.endDate||o.date<=shown.window.endDate);
 const changed=last?`${formatValue(current,last.value)} at ${periodLabel(current,last.date)}. ${measurementChange({...current,observations:previous}).text}`:'No source observation falls in this date window.';
 const controls=`<div class="toolbar macro-family-controls"><label for="macro-family">Measurement family<select id="macro-family" aria-label="Measurement family">${Object.entries(coverageFamilies).map(([key,value])=>`<option value="${key}"${key===familyId?' selected':''}>${esc(value.label)}</option>`).join('')}</select></label><label for="macro-measure">History measure<select id="macro-measure" aria-label="History measure">${family.ids.map(key=>`<option value="${key}"${key===id?' selected':''}>${esc(getSeries(key).name)}</option>`).join('')}</select></label>${familyId==='external'?'':rangeControls(focused,[id])}${embedded?button('CSV MEASURE',`data-export-macro-measure${shown.error||!last?' disabled':''}`):''}</div>`;
 const errors=current.error?`<p class="panel-note amber">${esc(current.error)}</p>`:'';
 const history=shown.observations.length?chart([id],{range,height:250}):emptyState('History unavailable.',shown.error??current.error??'No retained observations are available in the selected date window.');
 const detail=indicatorHref(id,focused);
 const rows=family.ids.map(key=>{
  const s=getSeries(key),observation=latest(s),observations=s.observations;
  const dates=observations.length?`${observations[0].date} to ${observations.at(-1).date}`:'Unavailable';
  return `<tr><th scope="row"><a href="${esc(indicatorHref(key,{...focused,macroMeasure:key}))}">${esc(s.name)}</a><span class="table-code mono muted">${esc(s.code)}</span><span class="table-code muted">${esc(s.unit)} · ${esc(s.adjustment)}</span>${familyId==='external'?`<span class="table-code muted">${esc(s.definition)}</span>`:''}</th><td class="num">${esc(formatValue(s,observation?.value))}</td><td>${esc(observation?periodLabel(s,observation.date):'Unavailable')}</td><td>${esc(seriesStatus(s))}<span class="table-code muted">${esc(dates)} · ${observations.length} observations</span>${s.error?`<span class="table-code amber">${esc(s.error)}</span>`:''}</td></tr>`;
 }).join('');
 const available=shown.observations.some(o=>Number.isFinite(o.value));
 const contributionContext=familyId==='external'?'The Summary accounting table separates changes in trade, income and current transfers. Inspect the native histories to assess their persistence; a quarterly deficit is not a measure of foreign debt.':'Inspect native measures and compare their timing; accounting contributions remain in <a href="#/macro">GDP contributions</a>.';
 const title=embedded?'':heading('ECONOMY',`${family.label} / ${family.question}`,button('COMPARE FAMILY',`data-compare="${esc(family.compare.join(','))}"`)+button('CSV MEASURE',`data-export-macro-measure${shown.error||!available?' disabled title="A valid window with retained observations is required."':''}`));
 const fullReadings=panel('00',familyId==='external'?'LATEST TOPIC READINGS':'FULL TOPIC COVERAGE',table(['MEASUREMENT / DEFINITION','LATEST','REFERENCE PERIOD','SOURCE STATUS / FULL COVERAGE'],rows,'Current topic readings and explicit source periods'));
 const readingIds=family.ids.slice(0,6);
 const readings=embedded?'':familyId==='external'?fullReadings:familyId==='prices'?readingGroup('LATEST TOPIC READINGS',inflationHorizonTable(focused),'Headline and core CPI / PCE at monthly, annual and annualized 3M / 6M horizons. Latest readings keep their own reference months; history controls below apply only to the focused chart.'):readingGroup('LATEST TOPIC READINGS',`<div class="metrics compact-family-readings">${readingIds.map(key=>{
  const s=getSeries(key),observation=latest(s);
  return `<a class="metric" href="${esc(indicatorHref(key,{...focused,macroMeasure:key}))}"><span class="metric-name">${esc(s.name)}</span><strong class="metric-value">${esc(formatValue(s,observation?.value))}</strong><span class="metric-period">${esc(observation?periodLabel(s,observation.date):'Unavailable')} · ${esc(s.frequency)}</span><span class="metric-basis">${esc(s.unit)} · ${esc(s.adjustment)}</span><span class="metric-change">${esc(seriesStatus(s))}</span></a>`;
 }).join('')}</div>${family.ids.map(key=>{const s=getSeries(key);return s.error?`<p class="panel-note amber">${esc(s.name)}: ${esc(s.error)}</p>`:'';}).join('')}`,'Latest retained readings use independent reference periods and native units. The selected history window applies below; full topic coverage is in research context.');
 const research=panel('02','RESEARCH QUESTION',`<div class="explain"><p><strong>CONTEXT.</strong> ${esc(family.context)}</p><p><strong>WHY IT MATTERS.</strong> ${contributionContext}</p><p>${esc(current.definition)}</p><p>Source: ${sourceLink(current)}. Retrieval: <span class="mono">${esc(current.fetchedAt??'Unavailable')}</span>. Reference dates are not verified publication timestamps.</p><p><a href="${esc(family.schedule)}" target="_blank" rel="noopener noreferrer">External official schedule ↗</a>. BLS, BEA, DOL and Census program associations appear in the <a href="#/calendar">captured calendar</a> where available. Dated FOMC events and official material references are available in the calendar and <a href="#/economy?family=policy">Policy rates</a>; linked documents are separate from captured numeric projections.</p></div>`);
 const focusedHistory=panel('01','FOCUSED HISTORY',(familyId==='external'?'':controls)+errors+`<p class="panel-note"><strong>LIMITATIONS.</strong> ${esc(family.limitations)}</p>`+(current.coverageNote?`<p class="panel-note amber">${esc(current.coverageNote)}</p>`:'')+history+`<p class="panel-note"><strong>WHAT CHANGED.</strong> ${esc(changed)}</p>`+coverageSummary(shown),`<a class="action" href="${esc(detail)}">DETAILS & DATA TABLE ↗</a>`,`${current.frequency} · ${current.unit} · ${current.adjustment}`,'workspace-analysis');
 const exportNote=`<p class="panel-note">CSV MEASURE exports the focused history's exact window in native units, including source identifiers, calculation, rights notices and retrieval provenance. All history means retained observations; new captures do not establish historical publication vintages.</p>`;
 const familyContext=familyId==='prices'?supportingDetails('macro-coverage:prices:cpi-effects','CPI effects · source coverage',cpiEffectsCoveragePanel()):familyId==='policy'?supportingDetails('macro-coverage:policy:fomc','FOMC decisions, minutes & projections',fomcContext(dataStatus.calendar?.sources?.fomc)):'';
 const priceResearch=familyId==='prices'?renderPcePriceContributions(dataStatus.sources.pcePriceContributions,{range})+supportingDetails('inflation:conditional-base-effects','Conditional PCE base effects · assumptions & arithmetic',pceBaseEffectsView(getSeries(state.pceBaseIndex??'pceIndex'),pceScenarioOptions(state))):'';
 if(familyId!=='external')return title+readings+focusedHistory+priceResearch+familyContext+supportingDetails(`macro-coverage:${familyId}:research`,'Research context, methods & sources',fullReadings+research+exportNote);
 const active=externalSections.some(([id])=>id===state.externalView)?state.externalView:'summary';
 const controlPanel=panel('W','SHARED HISTORY CONTROLS',controls+rangeControls(focused,[id])+`<p class="panel-note">Measure and date window carry across sections. Latest-quarter accounting and ratio context in Summary remain independent of the history window.</p>`);
 const sharedControls=active==='summary'?`<details class="supporting-details" id="external-history-controls" data-page-disclosure="macro-coverage:external:history-controls"${shown.error?' open':''}><summary>History controls · ${esc(current.name)} · ${esc(shown.window.label)}</summary>${controlPanel}</details>`:controlPanel;
 const content=active==='trends'
  ?currentAccountGdpHistoryPanel(dataStatus.sources,range)+currentAccountGdpComparisonPanel(dataStatus.sources,range,{measure:id})+supportingDetails('macro-coverage:external:advanced-trends','Advanced · component and trailing-quarter ratio variants',currentAccountGdpBreakdownPanel(dataStatus.sources,range)+currentAccountGdpTrailingPanel(dataStatus.sources,range))
  :active==='decomposition'
  ?currentAccountGdpContributionsPanel(dataStatus.sources,range)+supportingDetails('macro-coverage:external:advanced-effects','Advanced · balance versus GDP-denominator variants',currentAccountGdpBalanceEffectsPanel(dataStatus.sources,range)+currentAccountGdpAllComponentEffectsPanel(dataStatus.sources,range)+currentAccountGdpComponentEffectsPanel(dataStatus.sources,range,{measure:id}))
  :active==='methods'?externalMethods(focused,readings,research)
  :currentAccountPanel(dataStatus.sources.beaIta,{compact:true})+focusedHistory+currentAccountGdpPanel(dataStatus.sources,{compact:true});
 return title+externalNavigation(focused,active)+sharedControls+content+exportNote;
}
