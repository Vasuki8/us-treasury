import { series, releases, dataStatus } from './data.js';
import { getSeries, latest, formatValue, formatChange, periodLabel } from './model.js';
import {heading,panel,chart,table,button,seriesStatus,sentenceCase,escapeHtml as esc} from './ui.js';
import {measurementChange,priorReadingLabel} from './measurement-change.js';
import { dailyBrief, nextCatalysts, readingChanges } from './research-brief.js';
import {readingBrief} from './reading-brief.js';
import { releaseCoverage, releaseCoveragePanel } from './release-coverage.js';
import { calendarRelatedIds } from './macro-calendar.js';
import { releaseDate, scheduledTime, scheduleBasisNote, calendarSourceNotice } from './calendar-presentation.js';
import { watchlistMonitor, monitorUpdateLabel } from './watchlist-monitor.js';
import { indicatorHref } from './workspace-context.js';
import {inflationHorizonTable} from './inflation-comparison.js';
import {displayCurrencyUnit,displayUnitLabel,formatDisplayValue,formatDisplayChange} from './display-format.js';
import {humanDate,humanTimestamp} from './ui-time.js';
import {overviewComparisonCharts} from './dashboard-charts.js';

const a=(text,href,className='action')=>`<a class="${esc(className)}" href="${esc(href)}">`
 +`${esc(sentenceCase(/^https?:/.test(href)?text:text.replace(/ ↗[︎]?/g,'')))}</a>`;
const detail=(id,state,label,className='')=>a(label??getSeries(id)?.short??id,indicatorHref(id,{...state,page:'overview'}),className);
const disclosure=(key,label,body,tail='',className='supporting-details')=>`<details class="${esc(className)}" data-overview-disclosure="${esc(key)}"><summary>${esc(label)}${tail?`<span>${esc(tail)}</span>`:''}</summary>${body}</details>`;
const compactUnits={gdp:'q/q SAAR',privateDomesticDemandGrowth:'q/q SAAR',pceCore:'y/y',payroll:'Thousands of jobs',unrate:'Percent',policyTargetLower:'Percent',policyTargetUpper:'Percent',effr:'Percent',yield:'Percent',spread2s10s:'Basis points',interestRevenueRatio:'% of receipts · TTM',publicDebt:'USD trillions'};

function reading(id,state,{label,primary=true,compact=false}={}){
 const current=getSeries(id);if(!current)return '';
 const row=latest(current),change=measurementChange(current);
 const currencyUnit=displayCurrencyUnit([current]),options={currencyUnit};
 const changeLabel=id==='gdp'?'Growth-rate change':'Change';
 const prior=current.observations.at(-2);
 const compactChange=readingChanges({[id]:current},[id])[0]?.change??formatDisplayChange(current,options);
 const delta=id==='payroll'?`${priorReadingLabel(current)}: ${formatDisplayValue(current,prior?.value,options)}`
  :change.value===null?'Prior comparison unavailable':`${changeLabel} ${compactChange} vs ${change.priorPeriod}`;
 const unit=currencyUnit?displayUnitLabel(current,options):compactUnits[id]??current.unit;
 const title=change.text.replace(formatChange(current),formatDisplayChange(current,options));
 return `<a class="oh-reading" data-overview-${primary?'reading':'support-reading'}="${esc(id)}"`
  +` href="${esc(indicatorHref(id,{...state,page:'overview'}))}" title="${esc(current.name)} · ${esc(current.unit)}">`
  +`<span class="reading-label">${esc(label??current.short)}</span>`
  +`<strong class="reading-value">${esc(formatDisplayValue(current,row?.value,options))}</strong>`
  +`<span class="reading-unit">${esc(unit)} · ${esc(row?periodLabel(current,row.date):'Unavailable')}`
  +`${current.dataStatus==='cached'?' · CACHED':''}${current.dataStatus==='unavailable'?' · UNAVAILABLE':''}</span>`
  +`${compact?'':`<span class="reading-change" title="${esc(title)}">${esc(delta)}</span>`}`
  +`${current.error?`<span class="reading-change amber">${esc(current.error)}</span>`:''}</a>`;
}

function policyReading(state){
 const lower=getSeries('policyTargetLower'),upper=getSeries('policyTargetUpper'),low=latest(lower),high=latest(upper);
 if(!low?.date||low.date!==high?.date||!Number.isFinite(low.value)||!Number.isFinite(high.value)){
  return `<div class="oh-pair" data-overview-reading="policyTargetRange">${reading('policyTargetLower',state,{label:'Target range · lower bound',primary:false})}${reading('policyTargetUpper',state,{label:'Target range · upper bound',primary:false})}</div>`;
 }
 const change=measurementChange(upper),formatted=formatDisplayChange(upper);
 const delta=change.value===null?'Upper-bound prior comparison unavailable':`Upper bound ${formatted} vs ${change.priorPeriod}`;
 return `<a class="oh-reading" data-overview-reading="policyTargetRange" data-series="policyTargetLower,policyTargetUpper"`
  +` href="${esc(indicatorHref('policyTargetUpper',{...state,page:'overview'}))}">`
  +`<span class="reading-label">Fed funds target range</span><strong class="reading-value">`
  +`${esc(formatDisplayValue(lower,low.value).replace(/%$/,''))}–${esc(formatDisplayValue(upper,high.value))}</strong>`
  +`<span class="reading-unit">Percent · ${esc(periodLabel(upper,high.date))}`
  +`${[lower,upper].some(s=>s.dataStatus==='cached')?' · CACHED':''}</span><span class="reading-basis">Official target bounds</span>`
  +`<span class="reading-change" title="${esc(change.text.replace(formatChange(upper),formatted))}">${esc(delta)}</span></a>`;
}

function topic(title,href,body,extra=''){
 return `<article class="oh-topic"><h3>${a(title,href,'')}</h3>${body}${extra}</article>`;
}

function supportingRows(ids,state,{claims=false}={}){
 const roles={advance:'Advance','prior-week-revised':'Prior week · revised in same release','prior-week-unrevised':'Prior week · unrevised in same release','prior-week-status-unknown':'Prior week · revision status unknown'};
 return table(['MEASUREMENT',{label:'LATEST',numeric:true},'REFERENCE','UNIT',claims?'ESTIMATE ROLE':'PERIOD CHANGE'],ids.map(id=>{
  const current=getSeries(id);if(!current)return '';
  const row=latest(current),reference=row?periodLabel(current,row.date):'Unavailable';
  const publication=claims&&row?.publishedAt?'<span class="table-code muted">'
   +`Reported publication ${esc(humanDate(row.publishedAt))}${row.publicationDatePrecision==='day'?' · day precision':''}</span>`:'';
  return `<tr data-series="${esc(id)}"><th scope="row">${detail(id,state)}<span class="table-code muted">${esc(current.code)}`
   +`${current.dataStatus==='cached'?' · Cached':''}${current.dataStatus==='unavailable'?' · Unavailable':''}</span>`
   +(current.error?`<span class="table-code amber">${esc(current.error)}</span>`:'')
   +`</th><td class="num mono">${esc(formatValue(current,row?.value))}</td>`
   +`<td><span${row?.date?` title="${esc(row.date)}"`:''}>${esc(reference)}</span>${publication}</td>`
   +`<td>${esc(current.unit)}</td><td>${esc(claims?(roles[row?.releaseStage]??'Role not supplied'):measurementChange(current).text)}</td></tr>`;
 }).join(''),claims?'Latest reported initial and continued weekly claims, with distinct reference weeks and source estimate roles':'Supporting activity and income measurements in native units');
}

function publicationEvidence(brief,context){
 const familyLabel=id=>({gdp:'GDP',claims:'Initial & continued claims',cpi:'CPI'})[id]??id;
 const states=Object.entries(brief.publicationStates).map(([id,status])=>`${familyLabel(id)}: ${status==='ready'?'reviewed archive loaded':status==='loading'?'Publication evidence loading':status==='error'?'Publication evidence unavailable':'Publication evidence not loaded'}`).join(' · ');
 const errors=Object.entries(context.publicationContexts??{}).filter(([,value])=>value?.status==='error'&&value.error).map(([id,value])=>`<p class="panel-note amber">${esc(familyLabel(id))}: ${esc(value.error)}</p>`).join('');
 const rows=brief.publications.map(row=>`<div class="oh-evidence-row">${a(row.name,row.href,'')}`
  +`<span>${esc(row.estimate??'Published estimate')}${row.period?` · reference ${esc(humanDate(row.period))}`:''}</span>`
  +`<span>Published ${esc(humanDate(row.publicationDate))} · day precision</span>`
  +disclosure(`publication-retrieval-${row.id}`,'Retrieval evidence',
   `<p class="panel-note">Captured ${esc(humanTimestamp(row.retrievedAt)||'not recorded')}. `
    +'The publication day and retrieval time are separate.</p>','','')+'</div>').join('');
 return disclosure('publications','Published results · GDP, claims & CPI',`<p class="panel-note">${esc(states)}. Latest retained reference for each reviewed measurement, ordered by publication day.</p>${errors}${rows||'<p class="panel-note">No verified publication is available in the loaded evidence. Current revised readings and collection receipts are not substituted.</p>'}<p class="panel-note">Historical publications captured recently are not new releases today. CPI facts are published Table A percentages, separate from index-derived history. Payrolls and PCE publication archives are not covered here.</p>`,'','oh-evidence');
}

function catalystPanel(state,context,brief){
 const events=nextCatalysts(releases,{now:context.now??new Date()});let priorDate='';
 const rows=events.map(event=>{
  const day=event.date===priorDate?'':`<div class="oh-event-day">${esc(releaseDate(event.date))}</div>`;priorDate=event.date;
  const source=dataStatus.calendar?.sources?.[event.sourceId];
  const scheduleWarning=source?.status==='ok'?'':source?.fetchedAt?' · Cached schedule':' · Schedule source unavailable';
  const basis={'recurring-rule':'Agency rule','published-exception':'Agency exception','calendar-estimate':'Estimated',
   'listed-date':'Listed schedule','secondary-calendar':'NY Fed calendar'}[event.scheduleBasis]??'Scheduled';
  const following=calendarRelatedIds(event).some(id=>(state.saved??[]).includes(id));
  const official=/^https:\/\//i.test(event.sourceUrl??'')?` <a href="${esc(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">${event.provider==='new-york-fed'?'NY Fed calendar':'Official schedule'} ↗︎</a>`:'';
 const evidence='<p class="panel-note">Scheduled publication timing; a schedule does not confirm a result. '
  +`${esc(scheduleBasisNote(event))}${official}</p>`
  +(source?.fetchedAt?`<p class="panel-note">Schedule captured ${esc(humanTimestamp(source.fetchedAt))}.</p>`:'')
  +calendarSourceNotice(source)+(source?.error?`<p class="panel-note amber">${esc(source.error)}</p>`:'');
 const timing=[scheduledTime(event),event.periodLabel,following?'Following':''].filter(Boolean).map(esc).join(' · ');
 return day+`<article class="oh-event" data-calendar-source="${esc(event.sourceId)}">`
  +a(event.name,`#/calendar?event=${encodeURIComponent(event.id)}&month=${event.date.slice(0,7)}`,'')
  +`<small>${timing}</small>`
  +disclosure(`schedule-${event.id}`,`${event.agency??event.sourceId} · ${basis}${scheduleWarning}`,evidence,'','')+'</article>';
 }).join('');
 const body=(rows||'<p class="panel-note">No supported upcoming events are retained. Check the full calendar and official schedules.</p>')
  +`<div class="oh-chart-footer">${a('Calendar','#/calendar','link-button')}<span class="muted">Eastern Time</span></div>`;
 return '<aside class="oh-catalysts">'+panel('','Upcoming releases',body,'',
  'Selected distinct programs. Routine debt dates remain in the full calendar; schedules do not confirm results.','oh-catalyst-panel')
  +publicationEvidence(brief,context)+'</aside>';
}

function research(brief,state,context){
 if(!(state.saved?.length||brief.captures.length||brief.attention.length||['loading','error'].includes(context.changes?.status)))return '';
 const changes=context.changes?.rows??[];
 const followed=watchlistMonitor(state.saved??[],{catalog:series,events:releases,now:context.now??new Date()}).sort((a,b)=>Number(b.current.dataStatus==='cached')-Number(a.current.dataStatus==='cached')||Number(changes.some(row=>row.seriesId===b.id))-Number(changes.some(row=>row.seriesId===a.id))||a.index-b.index);
 const monitor=followed.length?`<ul class="brief-list">${followed.slice(0,4).map(({id,current,nextEvent})=>`<li>${detail(id,state,current.name)}<p class="small muted">${current.dataStatus==='cached'?'CACHED DATA · ':''}${esc(monitorUpdateLabel(id,context.changes,context.checkpoint))}${nextEvent?` · Next related schedule ${esc(nextEvent.date)}: ${esc(nextEvent.name)}`:' · No related schedule in retained coverage'}</p></li>`).join('')}</ul>`:'<p class="panel-note">Follow measurements from their detail pages to monitor collection problems, captured changes and upcoming schedules here.</p>';
 const captures=brief.captures.length?`<ul class="brief-list">${brief.captures.map(row=>`<li>${a(row.name,row.href,'')}<p class="small muted">${esc(row.kind)} · Reference ${esc(row.period??'not applicable')} · Captured ${esc(row.retrievedAt??'unknown')}</p></li>`).join('')}</ul>`:`<p class="panel-note">${esc(context.changes?.status==='loading'?'Loading captured changes.':context.changes?.status==='error'?'Captured changes unavailable.':context.changes?.status==='ready'?'No changes found in the selected retained comparison.':'Captured comparison not loaded; no personal comparison checkpoint is available.')}${context.changes?.status==='error'&&context.changes.error?` ${esc(context.changes.error)}`:''}</p>`;
 const attention=brief.attention.length?`<ul class="brief-list">${brief.attention.map(row=>`<li>${a(row.id,row.href,'')}<p class="small amber">${esc(row.name)}</p><p class="small muted">Last retained collection ${esc(row.retrievedAt??'unknown')}</p></li>`).join('')}</ul>`:'<p class="panel-note">No failed collection is recorded in this comparison. Refresh details above report the retained snapshot separately.</p>';
 const captureCount=context.changes?.status==='error'?'Captured changes unavailable':context.changes?.status==='loading'?'Captured changes loading':`Captured changes ${changes.length}${context.changes?.status!=='ready'?' · not loaded':''}`;
 return disclosure('my-research','My research',`<h3>Following ${followed.length}</h3>${monitor}<h3>${esc(captureCount)}</h3><p class="panel-note">${changes.length?`Since retrieval checkpoint ${esc(context.checkpoint?.since??'selected date')}. `:''}A retrieval update is not itself an official publication or market surprise.</p>${captures}<h3>Collection attention ${brief.attention.length}</h3>${attention}<div class="oh-research-links">${a('WATCHLIST ↗︎','#/watchlist')}${a('SAVED VIEWS ↗︎','#/research')}${a('ALL CAPTURED CHANGES','#/research?view=changes')}${a('COLLECTION HISTORY','#/research?view=changes')}</div>`,`Following ${followed.length} · ${captureCount} · Collection attention ${brief.attention.length}`);
}

export function overviewPage(state={},context={}){
 const brief=dailyBrief({catalog:series,changes:context.changes?.rows??[],failures:context.failures,publicationContexts:context.publicationContexts});
 const cards=topic('Growth','#/economy?family=activity',reading('gdp',state,{label:'Real GDP growth'}))
  +topic('Inflation','#/economy?family=prices',reading('pceCore',state,{label:'Core PCE · year over year'}))
  +topic('Unemployment','#/economy/labor',reading('unrate',state,{label:'Unemployment rate'}))
  +topic('Treasury yield','#/yields',reading('yield',state,{label:'10Y Treasury par yield'}));
 const trendIds=['gdp','pceCore','unrate','yield','payroll','policyTargetUpper','spread2s10s','interestRevenueRatio'];
 const preview=trendIds.includes(context.workspacePreview)?context.workspacePreview:'gdp';
 const trendPicker='<label class="workspace-trend-picker" for="overview-trend">Measurement '
  +`<select id="overview-trend" data-workspace-series>${trendIds.map(id=>`
   <option value="${id}"${id===preview?' selected':''}>${esc(getSeries(id).short)}</option>`).join('')}</select></label>`;
 const mainCharts=overviewComparisonCharts({...state,page:'overview'},{settings:context.overviewChartSettings,preview,controls:trendPicker});
 const monitorRows=[['payroll','Monthly payroll gain'],['policyTargetUpper','Fed funds target range'],
  ['spread2s10s','2s10s curve spread'],['interestRevenueRatio','Net interest / revenue · TTM']].map(([id,label])=>
  `<div class="workspace-monitor-row"${preview===id?' data-active="true"':''}>`
  +(id==='policyTargetUpper'?policyReading(state):reading(id,state,{label}))
  +button('Chart',`data-workspace-preview="${id}" aria-label="Chart ${esc(label)}" aria-pressed="${preview===id}"`)
  +'</div>').join('');
 const snapshotContext=disclosure('growth-demand','Domestic demand',reading('privateDomesticDemandGrowth',state,{label:'Private domestic final demand',primary:false,compact:true})+'<p class="panel-note oh-growth-note">Private consumption and fixed investment; excludes inventories, government and net exports.</p>','','oh-context-details')
  +disclosure('policy-effective','Effective rate',reading('effr',state,{label:'Effective federal funds rate',primary:false})+`<p class="panel-note">Effective rates and target bounds can refer to different days. Inspect ${detail('policyTargetLower',state,'lower bound')} or ${detail('policyTargetUpper',state,'upper bound')}.</p>`,'','oh-context-details')
  +disclosure('fiscal-debt','Debt stock',reading('publicDebt',state,{label:'Debt held by public',primary:false}),'','oh-context-details');
 const summaryWindow={preset:'1y'};
 const inflationMomentum=panel('','Monthly inflation',chart(['pceMonthly','pceCoreMonthly'],{height:235,range:summaryWindow}),
  button('Compare','data-compare="pceMonthly,pceCoreMonthly"','link-button'),
  'Percent month over month · headline and core PCE. Year-over-year inflation is a different horizon.','oh-chart-panel');
 const payrollMomentum=panel('','Payroll momentum',chart(['payrollAverage3m'],{kind:'bar',height:235,range:summaryWindow}),
  button('Labor breadth','data-compare="unrate,underemployment,participation"','link-button')
   +detail('payrollAverage3m',state,'Data ↗︎','link-button'),
  'Thousands of jobs · three-month average of monthly payroll gains; establishment jobs differ from household people measures.','oh-chart-panel');
 const horizons=disclosure('inflation-horizons','Inflation horizons',
  `<div class="oh-inflation-comparison">${inflationHorizonTable({...state,page:'overview'})}</div>`,'Monthly · annual · annualized');
 const momentum=`<section class="oh-momentum" aria-label="Economic trends"><div class="oh-plots">${mainCharts}</div></section>`;
 const monitorLinks=a('Policy & rates','#/economy?family=policy','link-button')+a('Fiscal & funding','#/fiscal','link-button');
 const crossChecks=panel('','Cross-check the headlines','<div class="brief-questions">'
  +`<article><h3>Is growth broad-based?</h3><p>Compare GDP with private domestic demand to put the headline in context.</p>${button('Compare growth','data-compare="gdp,privateDomesticDemandGrowth"','link-button')}</article>`
  +`<article><h3>Is labor demand changing?</h3><p>Read monthly payrolls alongside the three-month average and weekly hours.</p>${button('Compare labor demand','data-compare="payroll,payrollAverage3m,weeklyHours"','link-button')}</article>`
  +`<article><h3>Does recent inflation match the annual trend?</h3><p>Monthly and annual core PCE measure different horizons; compare in separate native panels.</p>${button('Compare inflation horizons','data-compare="pceCoreMonthly,pceCore"','link-button')}</article></div>`,'','','overview-cross-checks');
 const monitor=`<section class="oh-monitor">${crossChecks}${panel('','Macro monitor',monitorRows,monitorLinks,'Each reading keeps its own reference period.','overview-system-monitor')}`
  +`<div class="oh-context">${snapshotContext}</div></section>`;
 const support=disclosure('activity-income','Activity & income',supportingRows(['realSpendingMonthly','realDisposableIncomeMonthly','industrialProduction'],state)+`<p class="panel-note">Different scope and reporting lags provide context; correlated changes do not prove causation.</p><div class="oh-research-links">${button('COMPARE INCOME & SPENDING','data-compare="realDisposableIncomeMonthly,realSpendingMonthly"')}</div>`,'3 measurements')
  +disclosure('weekly-claims','Weekly claims',supportingRows(['claimsAdvance','continuedClaimsAdvance'],state,{claims:true})+'<p class="panel-note">Initial and continued claims refer to different weeks. Reported publication days come from the current source feed; reviewed archived evidence is separate in Published results above. Revised history and full release provenance remain on each detail page.</p>','Distinct reference weeks')
  +disclosure('monthly-inflation','Monthly inflation',inflationMomentum,'Headline & core · month over month')
  +disclosure('payroll-momentum','Payroll momentum',payrollMomentum,'3-month average')+horizons
  +research(brief,state,context)
  +disclosure('data-methods','About this data',`<p class="panel-note">Snapshot assembled ${esc(humanTimestamp(dataStatus.generatedAt)||'unknown')}. `
   +'Latest reference periods are shown with each measurement. Successful collection does not establish publication. '
   +'Collection failures and retained-source status are in Refresh details above.</p>'
   +releaseCoveragePanel(releaseCoverage(series,dataStatus,{events:releases,publicationContexts:context.publicationContexts,
    now:context.now??new Date()}),{disclosure:false,hrefFor:id=>indicatorHref(id,{...state,page:'overview'})})
   +`<div class="oh-research-links">${a('Published estimates','#/research?view=publications')}</div>`,'Reference periods & provenance');
 return '<div class="radar-page radar-overview overview-hierarchy">'
  +heading('U.S. economy','Growth, inflation, employment and rates. One research workspace.')
  +readingBrief(['gdp','pceCore','payroll'],{...state,page:'overview'})
  +'<div class="oh-desk"><section class="oh-snapshot"><div class="oh-section-label"><h2>Economic conditions</h2></div>'
  +`<div class="oh-topic-grid" role="region" aria-label="Economy at a glance">${cards}</div>`
  +`</section>${momentum}${monitor}${catalystPanel(state,context,brief)}`
  +`<section class="oh-support" aria-label="Supporting research">${support}</section></div></div>`;
}
