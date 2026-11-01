import { series, releases, dataStatus } from './data.js';
import { getSeries, latest, formatValue, formatChange, periodLabel } from './model.js';
import {panel,chart,table,button,sentenceCase,escapeHtml as esc} from './ui.js';
import {measurementChange,priorReadingLabel} from './measurement-change.js';
import { dailyBrief, nextCatalysts, readingChanges } from './research-brief.js';
import { releaseCoverage, releaseCoveragePanel } from './release-coverage.js';
import { calendarRelatedIds } from './macro-calendar.js';
import { releaseDate, scheduledTime, scheduleBasisNote, calendarSourceNotice } from './calendar-presentation.js';
import { watchlistMonitor, monitorUpdateLabel } from './watchlist-monitor.js';
import { indicatorHref } from './workspace-context.js';
import {inflationHorizonTable} from './inflation-comparison.js';
import {displayCurrencyUnit,displayUnitLabel,formatDisplayValue,formatDisplayChange} from './display-format.js';
import {humanDate,humanTimestamp} from './ui-time.js';
import {overviewComparisonCharts} from './dashboard-charts.js';
import {pceHorizonChartCatalog} from './dashboard-chart-data.js';

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

const reference=current=>latest(current)?.date?periodLabel(current,latest(current).date):'Reference unavailable';
const value=current=>formatDisplayValue(current,latest(current)?.value,{currencyUnit:displayCurrencyUnit([current])});
const sourceLink=(current,label)=>/^https:\/\//i.test(current?.sourceUrl??'')
 ?`<a href="${esc(current.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:'';
const retainedStatus=current=>current?.dataStatus==='unavailable'?'Unavailable':current?.dataStatus==='cached'?'Cached observation':'Retained observation';
const icon=path=>`<svg class="stitch-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="${path}"/></svg>`;
const outward=icon('M7 17 17 7M7 7h10v10');

function fact(current,{prior=false}={}){
 const row=current?.observations?.at(prior?-2:-1);
 return `<strong>${esc(formatDisplayValue(current,row?.value,{currencyUnit:displayCurrencyUnit([current])}))}</strong> ${esc(row?periodLabel(current,row.date):'(reference unavailable)')}`;
}

function readingNotes(measures){
 return [...new Set(measures.filter(Boolean).flatMap(current=>[
  current.error,current.dataStatus==='cached'?`${current.short}: cached reading.`:'',
  current.coverageNote&&/partial|suppressed|not (?:directly )?comparable/i.test(current.coverageNote)?current.coverageNote:'',
  ...(latest(current)?.footnotes??[]),
 ]).filter(Boolean))].map(note=>`<p class="stitch-source-note amber" role="status">${esc(note)}</p>`).join('');
}

function briefing(state,context){
 const gdp=getSeries('gdp'),demand=getSeries('privateDomesticDemandGrowth'),pce=getSeries('pceCore'),payroll=getSeries('payroll');
 const coreOneMonth=pceHorizonChartCatalog()['pce-horizons'].catalog.corePce1m;
 const cards=[
  {id:'gdp',agency:'BEA NIPA observations',title:'Real GDP Growth',current:gdp,
   body:`${fact(gdp)} (q/q SAAR), versus ${fact(gdp,{prior:true})}. Private domestic final demand: ${fact(demand)} (q/q SAAR). These are current retained readings; original-release estimates require reviewed publication evidence.`,
   measures:[gdp,demand],link:'Table & history'},
  {id:'pceCore',agency:'PCE deflator gain',title:'Core PCE Inflation',current:pce,
   body:`${fact(pce)} (year over year), versus ${fact(pce,{prior:true})}. The calculated 1-month annualized core rate is ${fact(coreOneMonth)}, versus ${fact(coreOneMonth,{prior:true})}. Annual and annualized monthly rates describe different horizons.`,
   measures:[pce,coreOneMonth],link:'Breakdown'},
  {id:'payroll',agency:'CES employment report',title:'Nonfarm Payrolls',current:payroll,
   body:`${fact(payroll)} (monthly job change), versus ${fact(payroll,{prior:true})}. The 3-month average is ${fact(getSeries('payrollAverage3m'))} per month. Household survey unemployment is ${fact(getSeries('unrate'))}. Retained payroll readings may be revised; original payroll vintages are not covered.`,
   measures:[payroll,getSeries('payrollAverage3m'),getSeries('unrate')],link:'Labor details'},
 ];
 const captureLabel=context.changes?.status==='ready'?`${context.changes.rows?.length??0} captured changes`:context.changes?.status==='loading'?'Captured changes loading':context.changes?.status==='error'?'Captured changes unavailable':'Capture comparison not loaded';
 return '<section class="reading-brief stitch-card stitch-brief" aria-label="What changed in the data">'
  +`<div class="brief-heading stitch-section-heading"><div><h2>What changed this period</h2><span class="stitch-window-label">Retained observations · dates vary</span></div><span class="stitch-status-label">${esc(captureLabel)}</span></div>`
  +`<div class="brief-takeaways stitch-brief-grid">${cards.map(card=>`<article class="stitch-brief-card" data-overview-brief="${card.id}">`
   +`<div><div class="stitch-brief-meta"><span>${esc(card.agency)}</span><span class="stitch-status-label" data-status="${esc(card.current.dataStatus)}">${esc(retainedStatus(card.current))}</span></div>`
   +`<h3>${detail(card.id,state,card.title,'')}</h3><p>${card.body}</p>${readingNotes(card.measures)}</div>`
   +`<footer class="stitch-brief-footer"><span>REF: ${esc(card.current.code)} · ${esc(reference(card.current))}</span><span>${detail(card.id,state,card.link,'')}${outward}</span></footer></article>`).join('')}</div></section>`;
}

function headline(id,state,label,footer){
 const current=getSeries(id),prior=current.observations.at(-2);
 const priorText=`Prior: ${formatDisplayValue(current,prior?.value,{currencyUnit:displayCurrencyUnit([current])})} (${prior?periodLabel(current,prior.date):'reference unavailable'})`;
 return `<article class="oh-topic stitch-card">${reading(id,state,{label})}<footer class="stitch-headline-footer"><span>${esc(footer??priorText)}</span>${outward}</footer></article>`;
}

function statistic(label,current,{href='',suffix=''}={}){
 return `<div class="stitch-stat-row"><span>${esc(label)}<small>${esc(reference(current))}</small></span><strong>${href?`<a href="${esc(href)}">`:''}${esc(value(current))}${esc(suffix)}${href?'</a>':''}</strong></div>`;
}

function crossChecks(state){
 const gdp=getSeries('gdp'),demand=getSeries('privateDomesticDemandGrowth'),inventories=getSeries('gdpInventoriesContribution');
 const payroll=getSeries('payroll'),average=getSeries('payrollAverage3m'),hours=getSeries('weeklyHours');
 const oneMonth=pceHorizonChartCatalog()['pce-horizons'].catalog.corePce1m,pce=getSeries('pceCore');
 const rows=(items)=>`<div class="stitch-stat-rows">${items.map(([label,current,options])=>statistic(label,current,{href:indicatorHref(current.id,state),...options})).join('')}</div>`;
 const card=(category,path,title,narrative,stats,action,measures)=>`<article class="stitch-card stitch-cross-card"><div><div class="stitch-card-category">${icon(path)}<span>${category}</span></div><h3>${title}</h3><p>${narrative}</p>${stats}${readingNotes(measures)}</div>${action}</article>`;
 return '<section class="overview-cross-checks stitch-cross-checks" aria-labelledby="overview-cross-checks-title">'
  +'<div class="stitch-section-heading"><div><h2 id="overview-cross-checks-title">Cross-check the headlines</h2><p>Compare headline aggregates with their underlying measurements in native units.</p></div><span class="stitch-status-label">3 diagnostic views</span></div>'
  +'<div class="brief-questions stitch-cross-grid">'
  +card('Growth Breadth','M12 3v9h9M9 3.5a9 9 0 1 0 11.5 11.5','Is growth broad-based?',
   `Private domestic final demand is ${fact(demand)}; headline real GDP is ${fact(gdp)}. The published private-inventory contribution is ${fact(inventories)} (q/q annualized contribution). Contributions describe an accounting breakdown, not a causal explanation.`,
   rows([['Real PDFD (Underlying)',demand],['Headline Real GDP',gdp],['Inventory Contribution',inventories]]),
   a('Open Growth Decomposition →','#/macro','stitch-card-cta'),[gdp,demand,inventories])
  +card('Labor Quality','M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0','Is labor demand changing?',
   `Monthly payroll change is ${fact(payroll)}, compared with the 3-month average of ${fact(average)} per month. Average weekly hours are ${fact(hours)}. Establishment payroll jobs and hours describe different aspects of labor demand.`,
   rows([['Headline NFP Change',payroll],['3-Month Moving Average',average,{suffix:'/mo'}],['Avg Weekly Hours',hours,{suffix:' hrs'}]]),
   a('Explore Labor Desk →','#/economy/labor','stitch-card-cta'),[payroll,average,hours])
  +card('Inflation Persistence','m3 17 5-6 4 3 9-10M15 4h6v6','Does recent inflation match annual trend?',
   `The calculated 1-month annualized core PCE rate is ${fact(oneMonth)}; the 12-month core rate is ${fact(pce)}. The FOMC’s 2% longer-run objective applies to annual headline PCE inflation. Core PCE is a separate diagnostic.`,
   '<div class="stitch-stat-rows">'+statistic('1-Mo Ann. Core PCE',oneMonth,{href:indicatorHref('pceCoreIndex',state)})+statistic('12-Mo Core PCE (YoY)',pce,{href:indicatorHref('pceCore',state)})
    +'<div class="stitch-stat-row"><span>FOMC Long-Run Anchor<small>Annual headline PCE objective</small></span><strong><a href="https://www.federalreserve.gov/monetarypolicy/files/FOMC_LongerRunGoals.pdf" target="_blank" rel="noopener noreferrer">2.0% Target ↗</a></strong></div></div>',
   button('Compare Inflation Series →','data-compare="pceCoreMonthly,pceCore"','stitch-card-cta'),[oneMonth,pce])
  +'</div></section>';
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

function catalystPanel(state,context){
 const events=nextCatalysts(releases,{now:context.now??new Date(),limit:5});let priorDate='';
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
 const timing=[scheduledTime(event),event.periodLabel,event.agency??event.sourceId,following?'Following':''].filter(Boolean).map(esc).join(' · ');
 return day+`<article class="oh-event" data-calendar-source="${esc(event.sourceId)}">`
  +'<div class="stitch-agenda-time"><span>'+esc(scheduledTime(event)||'Scheduled date')+'</span><span class="stitch-status-label">Scheduled</span></div>'
  +a(event.name,`#/calendar?event=${encodeURIComponent(event.id)}&month=${event.date.slice(0,7)}`,'')
  +`<small>${timing}</small>`
  +disclosure(`schedule-${event.id}`,`${event.agency??event.sourceId} · ${basis}${scheduleWarning}`,evidence,'','')+'</article>';
 }).join('');
 const gaps=Array.from({length:Math.max(0,5-events.length)},()=>'<div class="stitch-agenda-unavailable"><span class="stitch-status-label">Unavailable</span><strong>Additional schedule not retained</strong><small>Check the full calendar and official schedules.</small></div>').join('');
 const body=`<div class="stitch-agenda-list">${rows}${gaps}</div>`
  +`<div class="oh-chart-footer">${a('View Full Economic Calendar →','#/calendar','stitch-card-cta')}</div>`;
 const feeds=[['BEA NIPA','bea'],['BLS LABSTAT','bls'],['FED POLICY','policyRates'],['US TREASURY','treasury']].map(([label,id])=>{
  const source=dataStatus.sources?.[id],status=source?.status==='ok'?'Captured':source?.fetchedAt?'Cached':'Unavailable';
  return `<div class="stitch-feed" data-feed-source="${id}" data-status="${status.toLowerCase()}" title="${esc(`${source?.fetchedAt?'Captured '+humanTimestamp(source.fetchedAt):'No retained retrieval'}${source?.error?' · '+source.error:''}`)}"><span>${label}</span><strong>${status}</strong></div>`;
 }).join('');
 return '<aside class="oh-catalysts">'+panel('','Upcoming Releases',body,'<span class="stitch-status-label">All times ET</span>',
  'Selected distinct programs. Routine debt dates remain in the full calendar; schedules do not confirm results.','oh-catalyst-panel stitch-card stitch-agenda')
  +`<section class="stitch-card stitch-feed-card"><h3>Active Ingestion Feeds</h3><div class="stitch-feed-grid">${feeds}</div></section></aside>`;
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
 const cards=headline('gdp',state,'Real GDP Growth')
  +headline('pceCore',state,'Annual Core PCE','Core price index · BEA')
  +headline('unrate',state,'Unemployment Rate','Household survey · BLS CPS')
  +headline('yield',state,'10-Year Treasury','Daily par yield · Treasury');
 const trendIds=['gdp','pceCore','unrate','yield','payroll','policyTargetUpper','spread2s10s','interestRevenueRatio'];
 const preview=trendIds.includes(context.workspacePreview)?context.workspacePreview:'gdp';
 const trendPicker='<label class="workspace-trend-picker" for="overview-trend">Measurement '
  +`<select id="overview-trend" data-workspace-series>${trendIds.map(id=>`
   <option value="${id}"${id===preview?' selected':''}>${esc(getSeries(id).short)}</option>`).join('')}</select></label>`;
 const mainCharts=overviewComparisonCharts({...state,page:'overview'},{settings:context.overviewChartSettings,preview});
 const monitorRows=[
  ['payroll','Monthly Payroll Gain','BLS CES',`Monthly establishment job change. ${priorReadingLabel(getSeries('payroll'))} comparisons use the same retained history.`,'Open Labor Details →','#/economy/labor'],
  ['policyTargetUpper','Fed Funds Target','FOMC bounds','The official lower and upper target bounds are paired only when their reference dates align.','View Policy Rate Path →','#/economy?family=policy'],
  ['spread2s10s','2s10s Treasury Spread','Treasury slope',`The 10-year minus 2-year nominal Treasury par-yield spread; each curve observation retains its reference date.`,'Explore Term Structure →','#/yields'],
  ['interestRevenueRatio','TTM Net Interest Outlays','US Treasury',`TTM net interest outlays: ${value(getSeries('netInterestTtm'))} (${reference(getSeries('netInterestTtm'))}). The ratio uses trailing twelve-month receipts.`,'Inspect Fiscal Pressure →','#/fiscal'],
 ].map(([id,label,agency,narrative,link,href])=>
  `<div class="workspace-monitor-row"${preview===id?' data-active="true"':''}>`
  +`<div class="stitch-monitor-meta"><span>${esc(label)}</span><span>${esc(agency)}</span></div>`
  +(id==='policyTargetUpper'?policyReading(state):reading(id,state,{label:id==='interestRevenueRatio'?'Net interest / revenue · TTM':label}))
  +`<p class="stitch-monitor-note">${esc(narrative)}</p><div class="stitch-monitor-actions">${a(link,href,'link-button')}`
  +button('Chart',`data-workspace-preview="${id}" aria-label="Chart ${esc(label)}" aria-pressed="${preview===id}"`)
  +'</div></div>').join('');
 const snapshotContext=disclosure('growth-demand','Domestic demand',reading('privateDomesticDemandGrowth',state,{label:'Private domestic final demand',primary:false,compact:true})+'<p class="panel-note oh-growth-note">Private consumption and fixed investment; excludes inventories, government and net exports.</p>'+button('Compare growth','data-compare="gdp,privateDomesticDemandGrowth"','link-button'),'','oh-context-details')
  +disclosure('policy-effective','Effective rate',reading('effr',state,{label:'Effective federal funds rate',primary:false})+`<p class="panel-note">Effective rates and target bounds can refer to different days. Inspect ${detail('policyTargetLower',state,'lower bound')} or ${detail('policyTargetUpper',state,'upper bound')}.</p>`,'','oh-context-details')
  +disclosure('fiscal-debt','Debt stock',reading('publicDebt',state,{label:'Debt held by public',primary:false}),'','oh-context-details');
 const summaryWindow={preset:'1y'};
 const inflationMomentum=panel('','Monthly inflation',chart(['pceMonthly','pceCoreMonthly'],{height:235,range:summaryWindow}),
  button('Compare','data-compare="pceMonthly,pceCoreMonthly"','link-button'),
  'Percent month over month · headline and core PCE. Year-over-year inflation is a different horizon.','oh-chart-panel');
 const payrollMomentum=panel('','Payroll momentum',chart(['payrollAverage3m'],{kind:'bar',height:235,range:summaryWindow}),
  button('Labor breadth','data-compare="unrate,underemployment,participation"','link-button')
   +button('Compare labor demand','data-compare="payroll,payrollAverage3m,weeklyHours"','link-button')
   +detail('payrollAverage3m',state,'Data ↗︎','link-button'),
  'Thousands of jobs · three-month average of monthly payroll gains; establishment jobs differ from household people measures.','oh-chart-panel');
 const horizons=disclosure('inflation-horizons','Inflation horizons',
  `<div class="oh-inflation-comparison">${inflationHorizonTable({...state,page:'overview'})}</div>`,'Monthly · annual · annualized');
 const momentum=`<section class="oh-momentum" aria-label="Economic trends"><div class="oh-plots">${mainCharts}</div></section>`;
 const monitorLinks=a('Policy & rates','#/economy?family=policy','link-button')+a('Fiscal & funding','#/fiscal','link-button');
 const monitor=`<section class="oh-monitor">${panel('','Systemic Macro Monitor',`<p class="stitch-section-description">Key systemic metrics across employment, policy stance, sovereign yield curves, and fiscal pressure.</p><div class="stitch-monitor-grid">${monitorRows}</div>`,monitorLinks,'Each reading keeps its own reference period.','overview-system-monitor stitch-card')}</section>`;
 const support=publicationEvidence(brief,context)
  +disclosure('chart-measurement','Chart another measurement',trendPicker,'Eight headline & monitor readings')
  +`<div class="oh-context">${snapshotContext}</div>`
  +disclosure('activity-income','Activity & income',supportingRows(['realSpendingMonthly','realDisposableIncomeMonthly','industrialProduction'],state)+`<p class="panel-note">Different scope and reporting lags provide context; correlated changes do not prove causation.</p><div class="oh-research-links">${button('COMPARE INCOME & SPENDING','data-compare="realDisposableIncomeMonthly,realSpendingMonthly"')}</div>`,'3 measurements')
  +disclosure('weekly-claims','Weekly claims',supportingRows(['claimsAdvance','continuedClaimsAdvance'],state,{claims:true})+'<p class="panel-note">Initial and continued claims refer to different weeks. Reported publication days come from the current source feed; reviewed archived evidence is separate in Published results above. Revised history and full release provenance remain on each detail page.</p>','Distinct reference weeks')
  +disclosure('monthly-inflation','Monthly inflation',inflationMomentum,'Headline & core · month over month')
  +disclosure('payroll-momentum','Payroll momentum',payrollMomentum,'3-month average')+horizons
  +research(brief,state,context)
  +disclosure('data-methods','About this data',`<p class="panel-note">Snapshot assembled ${esc(humanTimestamp(dataStatus.generatedAt)||'unknown')}. `
   +'Latest reference periods are shown with each measurement. Successful collection does not establish publication. '
   +'Collection failures and retained-source status are in Refresh details above.</p>'
   +releaseCoveragePanel(releaseCoverage(series,dataStatus,{events:releases,publicationContexts:context.publicationContexts,
    now:context.now??new Date()}),{disclosure:false,hrefFor:id=>indicatorHref(id,{...state,page:'overview'})})
   +`<div class="oh-research-links">${a('Growth & income','#/economy?family=activity')}${a('Inflation','#/economy?family=prices')}${a('Published estimates','#/research?view=publications')}</div>`,'Reference periods & provenance');
 const next=nextCatalysts(releases,{now:context.now??new Date(),limit:1})[0];
 const primaryIds=['gdp','pceCore','unrate','yield','payroll','policyTargetUpper','spread2s10s','interestRevenueRatio'];
 const affected=primaryIds.filter(id=>getSeries(id)?.dataStatus!=='official');
 const operationStatus=affected.length?`${affected.length} cached or unavailable readings`:'8 retained readings';
 const actions=`<div class="stitch-overview-actions"><div class="stitch-operation-status"><span class="stitch-status-dot" aria-hidden="true"></span>${button(operationStatus,'data-source-health','stitch-source-health')}<span class="stitch-operation-next">${esc(next?`Next: ${next.name} · ${releaseDate(next.date)}`:'Next schedule unavailable')}</span></div>`
  +'<div class="stitch-page-buttons">'+button('Compare View','data-compare="gdp,privateDomesticDemandGrowth"')
  +button('Follow Page',`data-overview-follow aria-pressed="${primaryIds.every(id=>(state.saved??[]).includes(id))}"`)
  +button('Export Snapshot (CSV)','data-overview-export','action primary')+'</div></div>';
 const authorities=[['BEA NIPA',getSeries('gdp')],['BLS CES / CPS',getSeries('payroll')],['US Treasury daily rates',getSeries('yield')]];
 const provenance='<footer class="stitch-card stitch-provenance">'
  +'<div class="stitch-section-heading"><h2>Data Provenance, Methodology &amp; Release Integrity</h2><span class="stitch-status-label">Retained source evidence</span></div>'
  +'<div class="stitch-provenance-grid"><section><h3>Primary Feed Authorities</h3><p>Official observations and source identifiers are retained with their retrieval receipts. Reference periods and retrieval times are separate.</p><ul>'
  +authorities.map(([label,current])=>`<li>${sourceLink(current,label)} <span>${esc(reference(current))}</span></li>`).join('')
  +'</ul></section><section><h3>Revision Tracking Architecture</h3><p>Retrieval captures record changes between collections. Reviewed GDP, claims and CPI publication archives are separate evidence. Original payroll and PCE publication vintages are not covered.</p>'
  +a('View vintage audit history →','#/vintages','link-button')+'</section>'
  +'<section><h3>Institutional Connectivity</h3><p>Export retained observations as CSV or save a snapshot with its source evidence. An authenticated REST API and Python SDK are not available in this workspace.</p><div class="stitch-provenance-actions" data-research-actions>'
  +button('Export Overview CSV','data-overview-export')+'</div></section></div></footer>';
 return '<div class="radar-page radar-overview overview-hierarchy stitch-overview">'
  +'<header class="stitch-overview-header"><div class="stitch-overview-title"><div class="page-heading"><div><div class="stitch-title-line"><h1>U.S. economy</h1><span class="stitch-terminal-badge">Terminal feed</span></div><p class="subtitle">Growth, inflation, employment and rates. One research workspace.</p></div></div></div>'+actions+'</header>'
  +briefing({...state,page:'overview'},context)
  +'<section class="oh-snapshot" aria-label="Economic conditions">'
  +`<div class="oh-topic-grid stitch-headline-grid" role="region" aria-label="Economy at a glance">${cards}</div></section>`
  +`<div class="stitch-workstation">${momentum}${catalystPanel(state,context)}</div>`
  +crossChecks({...state,page:'overview'})+monitor+provenance
  +`<section class="oh-support" aria-label="Supporting research">${support}</section></div>`;
}
