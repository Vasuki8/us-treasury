import {humanDate} from './ui-time.js';
import {supportingDetails} from './page-hierarchy.js';
import {renderLaborEvidence} from './economic-evidence.js';
import {series,releases,dataStatus} from './data.js';
import {coverageFamilies} from './macro-registry.js';
import {getSeries,latest,formatValue,formatChange,periodLabel,transformSeries} from './model.js';
import {formatDisplayValue,formatDisplayChange} from './display-format.js';
import {measurementChange,priorReadingLabel} from './measurement-change.js';
import {calendarRelatedIds} from './macro-calendar.js';
import {calendarSourceNotice} from './calendar-presentation.js';
import {viewRange,indicatorHref} from './workspace-context.js';
import {parseRoute,routeFor} from './router.js';
import {rangeControls,coverageSummary} from './research-controls.js';
import {heading,button,chart,emptyState,sourceLink,sentenceCase,escapeHtml as esc} from './ui.js';
import {normalizeSourceNotes} from './source-notes.js';

const groups={jobs:{label:'Jobs & demand',ids:['payroll','payrollAverage3m','payrollLevel','weeklyHours','openings','hiresRate','quitsRate','layoffsRate']},people:{label:'People',ids:['unrate','underemployment','participation','employmentPopulation','primeAgeParticipation','primeAgeEmploymentPopulation']},pay:{label:'Pay & costs',ids:['wages','eciCompensationQuarterly','eciCompensation','laborProductivity','unitLaborCosts']},claims:{label:'Claims',ids:['claimsAdvance','continuedClaimsAdvance','claims','continuedClaims']}};
const allIds=Object.values(groups).flatMap(group=>group.ids),advanceIds=['claimsAdvance','continuedClaimsAdvance'];
const link=(label,href,className='action')=>`<a class="${esc(className)}" href="${esc(href)}">${esc(sentenceCase(label))}</a>`;
const detail=(id,state,label,className='labor-row-name',tab='data')=>{
 const href=indicatorHref(id,state);
 return link(label??getSeries(id).name,tab==='data'?href:routeFor({...parseRoute(href),tab}),className);
};
const kind=s=>s.observationType==='calculated'?'':s.observationType==='modeled'?'Modeled':'Official';
const status=s=>[kind(s),s.dataStatus==='cached'?'Cached':s.dataStatus==='unavailable'?'Unavailable':'Captured'].filter(Boolean).join(' · ');
const unit=s=>s.id==='eciCompensationQuarterly'?`${s.unit} · not annualized`:['claims','continuedClaims'].includes(s.id)?`${s.unit} · revised history may lag latest advance release`:s.unit;
const follow=(id,state)=>button(state.saved.includes(id)?'★':'☆',`data-save="${id}" aria-label="${state.saved.includes(id)?'Unfollow':'Follow'} ${esc(getSeries(id).name)}" aria-pressed="${state.saved.includes(id)}"`,'labor-follow');
const sectionHead=(index,title,actions='')=>`<div class="labor-section-head"><h2><span>${index}</span>${esc(title)}</h2><div class="actions">${actions}</div></div>`;
const sourceError=s=>s.error?`<p class="labor-note labor-warning">${esc(s.error)}</p>`:'';
const program=id=>['unrate','underemployment','participation','employmentPopulation','primeAgeParticipation','primeAgeEmploymentPopulation'].includes(id)?'BLS CPS':
 ['openings','hiresRate','quitsRate','layoffsRate'].includes(id)?'BLS JOLTS':id.startsWith('eci')?'BLS ECI':
 ['laborProductivity','unitLaborCosts'].includes(id)?'BLS Productivity':['claims','continuedClaims',...advanceIds].includes(id)?'DOL ETA':'BLS CES';

function headlines(state){
 const cards=['payroll','unrate','participation','wages'].map(id=>{
  const s=getSeries(id),o=latest(s),change=measurementChange(s);
  const contextId={payroll:'payrollAverage3m',unrate:'underemployment',participation:'primeAgeParticipation'}[id],context=contextId?getSeries(contextId):null;
  const warnings=normalizeSourceNotes([...(o?.footnotes??[]),s.coverageNote&&/partial|suppressed|not (?:directly )?comparable/i.test(s.coverageNote)?s.coverageNote:'',...(context?.error?[`${context.short}: ${context.error}`]:[]),...(context?.dataStatus==='cached'?[`${context.short}: cached reading.`]:[]),...(latest(context)?.footnotes??[])]);
  return `<article class="labor-metric" data-labor-reading="${id}"><div class="labor-metric-code"><span>${esc(s.code)}</span><span>${esc(program(id))}</span></div>${detail(id,state,s.short,'labor-metric-name')}`
   +`<strong>${esc(formatDisplayValue(s,o?.value))}</strong>`
   +`<span class="labor-small">${esc(periodLabel(s,o?.date))} · ${esc(status(s))}</span>`
   +`<span class="labor-reading-basis">${esc(unit(s))} · ${esc(s.adjustment)}</span>`
   +`<p class="labor-metric-change" title="${esc(change.text)}">${id==='payroll'?`${esc(priorReadingLabel(s))}: ${esc(formatDisplayValue(s,
  s.observations.at(-2)?.value))} · ${esc(periodLabel(s,s.observations.at(-2)?.date))}`:change.value===null?'Prior comparison unavailable':`${esc(change.label)}: ${esc(formatDisplayChange(s))} vs ${esc(change.priorPeriod)}`}</p>${sourceError(s)}${warnings.map(note=>`<p class="labor-note labor-warning" role="status">${esc(note)}</p>`).join('')}${context?`<p class="labor-metric-context">${detail(context.id,state,context.short,'link-button')}: ${esc(formatDisplayValue(context,latest(context)?.value))} · ${esc(periodLabel(context,latest(context)?.date))}</p>`:''}</article>`;
 }).join('');
 return `<section class="labor-headlines" aria-label="Latest headline indicators">${cards}</section>`;
}

function readingGuide(state){
 const descriptions={payroll:'Establishment jobs and the three-month average describe the pace of payroll additions. Current revised history does not identify first-published estimates.',unrate:'The household U-3 rate and broader U-6 rate measure different definitions of labor underutilization and use different denominators.',wages:'Annual average hourly earnings growth compares exact year-ago monthly levels. Changes in industry and worker composition can affect this average.'};
 return '<section class="reading-brief labor-reading-guide" data-labor-guide aria-labelledby="labor-guide-title"><div class="brief-heading"><h2 id="labor-guide-title">What changed this period · Analytical reading guide</h2><span class="stitch-status-label">CES / CPS / earnings</span></div><div class="brief-takeaways">'+['payroll','unrate','wages'].map(id=>{const s=getSeries(id),o=latest(s),prior=s.observations.at(-2);return `<article data-labor-guide-card="${id}"><div class="labor-brief-code"><span>${esc(s.code)}</span><span>${esc(program(id))}</span></div>${detail(id,state,s.short,'labor-brief-title')}<strong>${esc(formatDisplayValue(s,o?.value))}</strong><p>${esc(periodLabel(s,o?.date))} · ${esc(s.unit)} · ${esc(s.adjustment)}</p><p>Prior: <b>${esc(formatDisplayValue(s,prior?.value))}</b> · ${esc(periodLabel(s,prior?.date))}</p><p>${esc(descriptions[id])}</p>${sourceError(s)}<footer><span>${esc(status(s))}</span>${detail(id,state,'Inspect history','link-button')}</footer></article>`;}).join('')+'</div></section>';
}

function releaseRadar(state,now){
 const upcoming=releases.filter(event=>calendarRelatedIds(event).some(id=>allIds.includes(id))&&(event.scheduledAt?Date.parse(event.scheduledAt)>=now.getTime():event.date>=now.toISOString().slice(0,10))).sort((a,b)=>(a.scheduledAt??a.date).localeCompare(b.scheduledAt??b.date));
 const chosen=[];for(const event of upcoming){if(!chosen.some(item=>item.sourceId===event.sourceId&&item.program===event.program))chosen.push(event);if(chosen.length===3)break;}
 const employment=upcoming.find(event=>event.sourceId==='bls'&&event.program==='employment-situation');
 return (`<aside class="labor-aside">${sectionHead('','Release radar',link('Calendar','#/calendar?calendarTopic=Labor',
  'link-button'))}<div class="labor-event-list">${chosen.map(event=>{const date=new Date(event.date+'T12:00:00Z'),
  cached=dataStatus.calendar?.sources?.[event.sourceId]?.status!=='ok';
  return `<article class="labor-event" data-calendar-source="${esc(event.sourceId)}"><div><strong>${date.getUTCDate()}</strong><span>${esc
  (date.toLocaleString('en-US',{month:'short',timeZone:'UTC'}))}</span></div><div>${link(event.name+'',`#/calendar?month=${event.date.slice(0,7)
  }&event=${encodeURIComponent(event.id)}`,'labor-event-name')}<p>${esc(humanDate(event.date))}${event.time?` · ${esc(event.time)} Eastern`:''}${
  event.periodLabel?`<br>${esc(event.periodLabel)}`:''}</p><span class="labor-schedule-state">Scheduled${cached?' · Cached schedule':''}${
  event.scheduleBasis==='secondary-calendar'?' · NY Fed calendar':event.scheduleBasis==='recurring-rule'?' · Agency rule':
  event.scheduleBasis==='published-exception'?' · Agency exception':''}</span></div></article>`;}).join('')
  ||'<p class="labor-note">No upcoming Labor schedule in retained coverage.</p>'
  }</div><p class="labor-note">Schedule only; publication is not confirmed. Timing and `+
  `reference periods may change.</p>${employment?link('NEXT EMPLOYMENT RELEASE',`#/calendar?month=${employment.date.slice(0,
  7)}&event=${encodeURIComponent(employment.id)}`,
  'labor-text-link'):('<p class="labor-note">Next Employment Situation schedule unavailable in retained coverage. '+
  'Check the official BLS calendar.</p>')}${supportingDetails('labor:research','Research lens & limitations',
  (`<p>${esc(coverageFamilies.labor.question)}</p><p>${esc(coverageFamilies.labor.context)}</p><p>${esc(coverageFamilies.labor.limitations)
  }</p>${calendarSourceNotice(dataStatus.calendar?.sources?.bls)}<a href="https://www.bls.gov/schedule/" target="_blank" rel="noopener noreferrer">Official `+
  `BLS schedule ↗</a>`),{className:'labor-details'})}</aside>`);
}

function comparisonStarters(){
 return `<aside class="labor-aside labor-comparison-starters" data-labor-comparison-starters>${sectionHead('','Comparison starters')}`
  +'<p class="labor-note">Read related measures in separate native panels, with their own units and scales.</p>'
  +`<div class="labor-presets actions" aria-label="Labor comparison starters">${button('Compare breadth',
   'data-compare="unrate,underemployment,participation"')}${button('Jobs momentum',
   'data-compare="payroll,payrollAverage3m,weeklyHours"')}${button('Labor turnover',
   'data-compare="hiresRate,quitsRate,layoffsRate"')}</div></aside>`;
}

function history(state,current,shown,range){
 const last=shown.observations.at(-1),history={...current,observations:current.observations.filter(o=>!shown.window.endDate||o.date<=shown.window.endDate)},available=shown.observations.some(o=>Number.isFinite(o.value));
 return `<section class="labor-history">${sectionHead('03',
  'Focused historical query & transformations')}<div class="labor-query-toolbar"><label class="labor-picker" for="macro-measure">History measure<select id="macro-measure">${allIds.map(id=>
  `<option value="${id}"${id===current.id?' selected':''}>${esc(getSeries(id).name)}</option>`).join('')}</select></label>${rangeControls(state,
  [current.id],{observationDescription:('Observation count applies to the focused measure; core trends share its displayed start '+
  'and end dates.')})}${button('Download selection CSV',`data-export-macro-measure${shown.error||!available?' disabled':''}`)}</div><p class="labor-axis-unit">${esc(current.frequency)} · ${esc(unit(current))} · ${esc(current.adjustment)} · ${esc(status
  (current))}</p>${sourceError(current)}${current.coverageNote
   &&(['dol','dolAdvance'].includes(current.agency)||/partial|suppressed|not (?:directly )?comparable/i.test(current.coverageNote))
   ?`<p class="labor-note labor-warning">${esc(current.coverageNote)}</p>`:''}${
  shown.error||!shown.observations.length?emptyState('History unavailable.',shown.error??current.error
  ??'No retained observations fall in this date window.'):chart([current.id],{range,height:240,kind:current.id==='payroll'?'bar':'line'})
  }<div class="labor-what-changed"><span class="labor-kicker">What changed</span><p>${last?`${esc(formatValue(current,last.value))} · ${esc
  (periodLabel(current,last.date))}`:'No observation in this window.'}</p><p class="labor-small">${last?esc(measurementChange(history).text):
  'No change is reported outside the selected window.'}</p></div>${coverageSummary(shown)}<div class="actions labor-history-actions">${detail(current.id,state,'Details & data table','action')
  }${follow(current.id,state)}</div>${supportingDetails(`labor:definition:${current.id}`,'Definition & source coverage',`<p>${esc
  (current.definition)}</p>${current.observationType==='calculated'?`<p><strong>Derived.</strong> ${esc(current.calculation
  ??'Calculated from official source observations.')}</p>`:''}<p>${sourceLink(current)} · Retrieved ${esc(current.fetchedAt??'Unavailable')
  }</p>${current.coverageNote?`<p>${esc(current.coverageNote)}</p>`:''}<div class="actions">${detail
  (current.id,state,'Methodology & source notes','link-button','methodology')}${link('Retrieval history',`#/vintages?series=${current.id}`,
  'link-button')}</div>`,{className:'labor-details'})}</section>`;
}

function weekly(state){return (`<section class="labor-weekly" id="labor-weekly"><div class="labor-desk-tags"><span>ETA weekly release</span><span>U.S. Department of Labor</span><span>Official source context</span></div>${sectionHead('02','Weekly unemployment claims intelligence desk',
  link('Publication history','#/research?view=publications&publicationSeries=claimsAdvance',
  'link-button'))}<p class="labor-note">Latest release context · separate from the selected history `+
  `window.</p><div class="labor-claims-grid">${advanceIds.map(id=>{
 const s=getSeries(id),current=latest(s),prior=s.observations.at(-2),historical=getSeries(id==='claimsAdvance'?'claims':'continuedClaims'),last=latest(historical),sameRelease=current?.publishedAt&&prior?.publishedAt===current.publishedAt;
 const priorLabel=prior?.releaseStage==='prior-week-revised'?'Revised prior':prior?.releaseStage==='prior-week-unrevised'?'Unrevised prior':'Prior status unknown';
 return `<article>${detail(id,state,
  id==='claimsAdvance'?'Initial claims':'Continued claims')}${current?.publishedAt?`<p class="labor-note">Published ${esc(humanDate
  (current.publishedAt))} · ${esc(status(s))}</p>`:''}<div class="labor-claim-reading"><strong>${esc(formatValue(s,current?.value))
  }</strong><span class="labor-small">${esc(periodLabel(s,current?.date))}<br>${current?.releaseStage==='advance'?'Advance estimate':
  'Estimate stage unavailable'}</span></div><p class="labor-small">${esc(s.unit)} · ${esc(s.adjustment)
  }</p><div class="labor-claim-priors"><div>Same-release prior<strong>${esc(formatValue(s,sameRelease?prior?.value:null))}</strong>${esc
  (sameRelease?periodLabel(s,prior?.date):'Not available')}<span>${esc(sameRelease?priorLabel:'Same-release prior not verified')
  }</span></div><div>Change from that prior<strong>${sameRelease?esc(formatChange(s)):'—'}</strong><span>${sameRelease&&prior
  ?.previouslyPublishedSourceValue?`Prior previously published: ${esc(prior.previouslyPublishedSourceValue)} claims`:
  'Previously published prior not supplied'}</span></div></div><p class="labor-note labor-warning">Revised history ends ${esc(humanDate(last
  ?.date))} at ${esc(formatValue(historical,last?.value))}; kept separate.</p>${sourceError(s)}<div class="actions">${detail(id,state,
  'Inspect release','action')}${link('Evidence',`#/release?publicationSeries=${id}`,'action')}${follow(id,state)}</div></article>`;
 }).join('')}</div><p class="labor-note">Initial and continued claims can refer to different weeks. `+
  `These two-observation release pairs are not spliced into revised historical feeds. `+
  `Publication dates and source retrieval times are distinct.</p></section>`);}

function readings(state){
 const group=Object.hasOwn(groups,state.laborGroup)?state.laborGroup:'all',query=(state.query??'').trim().toLowerCase(),ids=allIds.filter(id=>(group==='all'||groups[group].ids.includes(id))&&`${getSeries(id).name} ${getSeries(id).code}`.toLowerCase().includes(query));
 let previousGroup=null;
 return (`<section class="labor-readings" id="labor-readings"><div class="labor-desk-tags"><span>23-indicator matrix</span><span>Canonical research series</span></div>${sectionHead('04',
  'Comprehensive labor indicators catalog')}<p class="labor-note">${ids.length} of ${allIds.length
  } measures · Latest readings, independent of the selected history window.</p><div class="labor-table-controls"><div class="labor-filter-set" role="group" `+
  `aria-label="Labor reading groups">${[['all','All 23'],...Object.entries(groups).map(([id,value])=>[id,value.label])].map(([id,
  label])=>button(label,`data-labor-group="${id}" aria-pressed="${group===id}"`,
  'labor-filter')).join('')}</div><label for="labor-query">Find a labor measure<input id="labor-query" type="search" value="${esc(state.query
  ??'')}" placeholder="Name or source code"></label></div><div class="labor-table-wrap"><table `+
  `class="labor-table"><caption class="sr-only">All labor readings in native units, latest `+
  `reference periods, follow and comparison controls</caption><thead><tr><th `+
  `scope="col">Measure name</th><th scope="col">Survey / code</th><th scope="col" class="num">Latest / change</th><th scope="col">Native unit</th><th `+
  `scope="col" class="labor-period-col">Ref period</th><th scope="col">Freq</th><th scope="col">Agency</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>${ids.map(id=>{
 const s=getSeries(id),o=latest(s),selected=state.selected.includes(id),release=advanceIds.includes(id),groupId=Object.keys(groups).find(key=>groups[key].ids.includes(id));
 const estimateNotes=normalizeSourceNotes(o?.footnotes).join('; ');
 const groupHeader=groupId===previousGroup?'':`<tr class="labor-group-heading"><th colspan="9">${esc(groups[groupId].label)}</th></tr>`;previousGroup=groupId;
 return `${groupHeader}<tr data-series-row="${id}" data-selected="${selected}"><th scope="row">${detail(id,state,s.name
  +'')}<span class="labor-row-meta">${esc(unit(s))} · ${esc(s.frequency)} · ${esc(status(s))}</span><span class="labor-period-mobile">${esc
  (periodLabel(s,o?.date))}</span>${s.agency==='dol'?
  '<span class="labor-row-meta labor-warning">Revised historical feed · may lag release</span>':release?
  '<span class="labor-row-meta labor-warning">Latest release pair · own reference weeks</span>':''}${sourceError(s)
  }</th><td class="labor-row-code">${esc(s.code)}</td><td class="num"><strong class="labor-row-value">${esc(formatValue(s,o?.value))}</strong><span class="labor-row-change" title="${esc
  (measurementChange(s).text)}">${esc(formatChange(s))}</span></td><td>${esc(unit(s))}</td><td class="labor-period-col">${esc(periodLabel(s,o?.date))
  }</td><td>${esc(s.frequency)}<span class="labor-row-meta">${esc(s.adjustment)}</span></td><td>${esc(program(id))}</td><td><span class="labor-status">${esc(status(s))}</span>${estimateNotes?`<span class="labor-estimate-note labor-row-meta labor-warning">Source note: ${esc(estimateNotes)}</span>`:''}</td><td><div class="labor-row-actions">${detail(id,state,'Detail','labor-detail-link')}${follow(id,state)
  }<label class="labor-compare-control"><input type="checkbox" data-select="${id}" aria-label="Compare ${esc(s.name)}"${selected?' checked':''}${
  !selected&&state.selected.length>=4?' disabled':''}></label></div></td></tr>`;
 }).join('')
  ||'<tr><td colspan="9">No matching labor measures.</td></tr>'}</tbody></table></div><div class="labor-tray"><div><span>${state.selected.length
  }/4 selected</span>${state.selected.map(id=>`<span>${esc(getSeries(id)?.short??id)}</span>`).join('')}</div>${button('Open comparison',
  `data-compare="${esc(state.selected.join(','))}"${state.selected.length?'':' disabled'}`)
  }</div><p class="labor-note">Changes compare each measure’s previous retained observation `+
  `in native units. Payroll: change in monthly job gains; wages: percentage-point change in `+
  `annual wage growth. Comparisons use separate native panels, exact dates and independent `+
  `scales.</p></section>`);
}

function notes(state){return `<section class="labor-bottom" id="labor-notes"><div class="labor-methodology-column">${sectionHead('05','Methodology, coverage & survey architecture')}<div class="labor-methodology-grid"><article class="labor-survey-card"><h3>Establishment survey · CES</h3><span class="labor-method-tag">Jobs metric</span><p>Payroll employment counts jobs, not unique people. A person with more than one payroll job can be counted more than once.</p><p>${esc(getSeries('payroll').definition)}</p><p>${esc(getSeries('payroll').calculation)}</p>${detail('payroll',state,'Payroll methodology','link-button','methodology')}</article><article class="labor-survey-card"><h3>Household survey · CPS</h3><span class="labor-method-tag">People and labor force ratios</span><p>${esc(getSeries('unrate').definition)}</p><p>${esc(getSeries('underemployment').definition)}</p><p>U-3 and U-6 use different denominators. Household employment and establishment payroll jobs are different measurements.</p>${detail('unrate',state,'Household methodology','link-button','methodology')}</article></div><p class="labor-note">ECI quarterly compensation growth is not annualized. Productivity and unit labor cost growth are annualized. Openings measure a stock; hires, quits and layoffs measure monthly flows.</p></div><div class="labor-source-column"><h2>Data provenance &amp; coverage</h2><p class="labor-note">The observation period, publication date and source retrieval are separate clocks. Retrieval does not confirm a new publication.</p><p>Snapshot assembled ${esc(dataStatus.generatedAt??'Unavailable')}.</p>${['bls','dol','dolAdvance'].map(id=>{const source=dataStatus.sources?.[id];return `<article class="labor-source-row"><h3>${esc(id==='bls'?'Bureau of Labor Statistics':id==='dol'?'DOL revised claims history':'DOL latest release context')}</h3><span class="labor-status">${esc(source?.status==='ok'?'Captured':source?.fetchedAt?'Cached':'Unavailable')}</span><p>Retrieved ${esc(source?.fetchedAt??'Unknown')}<br>Last attempt ${esc(source?.lastAttemptAt??'Unknown')}</p>${source?.error?`<p class="labor-warning">${esc(source.error)}</p>`:''}</article>`;}).join('')}<p class="labor-note">Claims revised history may lag the advance release. Latest release pairs retain their own reference weeks and are not spliced into historical feeds.</p>${calendarSourceNotice(dataStatus.calendar?.sources?.bls)}<div class="actions">${link('Official BLS schedule','https://www.bls.gov/schedule/') }${link('Retrieval history',`#/vintages?series=${state.macroMeasure}`)}${link('Official publications','#/research?view=publications&publicationSeries=claimsAdvance')}${link('Saved research','#/research')}</div><p class="labor-note">Full indicator details retain methodology, calculations, source footnotes and rights notices. CSV measure exports the focused history’s exact window in native units with retrieval provenance.</p></div></section>`;}

export function laborPage(input={},options={}){
 const focus=allIds.includes(input.macroMeasure)?input.macroMeasure:coverageFamilies.labor.defaultMeasure,state={...input,macroFamily:'labor',macroMeasure:focus,saved:input.saved??[],selected:(input.selected??[]).filter(id=>series[id]).slice(0,4)},current=getSeries(focus),range=viewRange(state),shown=transformSeries(current,'level',range);
 // Resolve once against the focused series; each core source retains its own gaps.
 const coreRange={preset:'custom',startDate:shown.window.mode==='calendar'?shown.window.startDate??'':shown.observations[0]?.date??'',endDate:shown.window.mode==='calendar'?shown.window.endDate??'':shown.observations.at(-1)?.date??''};
 const trends=`<section id="labor-trends">${sectionHead('01','Payrolls & unemployment',
  '<div class="dashboard-range" role="group" aria-label="Labor chart time range">'+[['1y','1Y'],['3y','3Y'],['5y','5Y'],['all','MAX']].map(([value,label])=>button(label,`data-window="${value}" aria-pressed="${state.window===value}"`)).join('')+'</div>')}<p class="labor-note">Shared selected window · each panel has its own native scale.</p><div class="labor-dual">${[['payroll','Monthly payroll gains',
  'combo'],['unrate','Unemployment rate','line']].map(([id,title,chartKind])=>`<article><div class="labor-chart-title"><h3>${title}</h3>${detail
  (id,state,'Detail','link-button')}</div><p class="labor-axis-unit">${esc(getSeries(id).unit)} · ${esc(getSeries(id).adjustment)}</p>${id==='payroll'?detail('payrollAverage3m',state,
   `Latest 3-month average: ${formatDisplayValue(getSeries('payrollAverage3m'),latest(getSeries('payrollAverage3m'))?.value)} · ${periodLabel(getSeries('payrollAverage3m'),latest(getSeries('payrollAverage3m'))?.date)}`,'labor-average'):''}${chart
  (id==='payroll'?['payroll','payrollAverage3m']:['unrate','underemployment'],{range:coreRange,kind:chartKind,height:255,legend:true,endLabels:true})}${id==='unrate'?'<p class="labor-note">U-3 and U-6 use different denominators; the shared percent scale does not make them interchangeable.</p>':''}</article>`).join('')}</div><div class="actions labor-trend-links">${button('Compare payroll momentum',
  'data-compare="payroll,payrollAverage3m,weeklyHours"','link-button')}${button('Compare participation & employment',
  'data-compare="unrate,participation,primeAgeEmploymentPopulation"','link-button')}</div></section>`;
 const revisions='<div class="labor-revision-context"><strong>Payroll revisions</strong><span>First-published payroll estimates are not covered. Current revised history cannot establish release revisions.</span>'
  +link('Inspect retrieval history','#/vintages?series=payroll','link-button')+'</div>';
 const preliminary=normalizeSourceNotes(latest(getSeries('payroll'))?.footnotes).some(note=>/preliminary/i.test(note));
 const uncertainty=`<aside class="labor-note" aria-label="Labor estimate uncertainty"><strong>${preliminary?'Preliminary payroll estimate. ':''}Survey uncertainty.</strong> Payroll estimates have sampling and nonsampling error and may be revised as reports arrive and seasonal factors are updated. A difference between two monthly job gains is a change in gains, not a separate estimate of monthly employment change. Sample response rates and confidence intervals are not supplied in the retained series metadata. No significance claim is made. <a href="https://www.bls.gov/news.release/empsit.tn.htm" target="_blank" rel="noopener noreferrer">Official BLS technical note ↗</a></aside>`;
 return `<div class="labor-radar stitch-labor"><p class="labor-source-line">Bureau of Labor Statistics / DOL · CES / CPS / JOLTS / ETA</p>${heading('Labor market','Track employment demand, participation and pay.',
  button(state.saved.includes('payroll')?'Following payrolls':'Follow payrolls',`data-save="payroll" aria-pressed="${state.saved.includes('payroll')}"`)+`<details class="labor-action-menu" data-page-disclosure="labor-actions"><summary>More actions</summary><div class="labor-secondary-actions" data-research-actions>${button('Compare measures','data-compare="unrate,claims"')}${button('Export focused CSV',`data-export-macro-measure${shown.error||!shown.observations.some(o=>Number.isFinite(o.value))?' disabled':''}`)}${button('Data provenance','data-labor-section="labor-notes"')}</div></details>`)}<div class="labor-briefing">${readingGuide(state)}${headlines(state)}</div>${revisions}`
  +supportingDetails('labor:uncertainty','Sampling uncertainty & standard error disclosure',uncertainty,{className:'labor-uncertainty'})
  +`<nav class="labor-section-nav" aria-label="Labor sections">${[['trends','Payrolls & unemployment'],
  ['weekly','Weekly claims'],['analysis','Focused history'],['readings','All 23 measures'],['notes','Definitions & sources']].map(([id,
  label])=>button(label,`data-labor-section="labor-${id}"`,
  'labor-section-link')).join('')}</nav><div class="labor-desk">${trends}<div class="labor-side-stack">${releaseRadar(state,options.now??new Date())}${comparisonStarters()}</div></div>${weekly
  (state)}<div id="labor-analysis">${history(state,current,shown,range)}</div>${renderLaborEvidence
  (dataStatus.sources.laborEvidence,{range})}${readings(state)}${notes(state)}</div>`;
}
