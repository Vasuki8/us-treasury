import {readingGroup,supportingDetails} from './page-hierarchy.js';
import {releases,dataStatus} from './data.js';
import {getSeries,formatValue,periodLabel} from './model.js';
import {routeFor} from './router.js';
import {calendarScope} from './calendar-scope.js';
import {isIsoDate} from './date-window.js';
import {treasuryFundingReferences} from './treasury-auction-calendar.js';
import {indicatorHref,contextualHref} from './workspace-context.js';
import {escapeHtml as esc,button,heading,panel,emptyState} from './ui.js';
import {humanDate,humanTimestamp} from './ui-time.js';
import {releaseDate,scheduleLinks,calendarPublisherName,calendarSourceNotice,relatedSeries,scheduledPeriod,
 scheduleSource,scheduleState,scheduleBasisPrefix,scheduledTime,scheduleBasisNote,yieldTimingPanel,calendarPrevious}
 from './calendar-presentation.js';

const options=(values,selected)=>values.map(value=>
 `<option value="${esc(value)}"${value===selected?' selected':''}>${esc(value)}</option>`).join('');
const link=(label,href)=>`<a class="action" href="${esc(href)}">${esc(label)}</a>`;
const saveButton=(id,state)=>button(state.saved.includes(id)?'★ Following':'☆ Follow',
 `data-save="${esc(id)}" aria-pressed="${state.saved.includes(id)}"`);
const joined=values=>values.filter(Boolean).map(esc).join(' · ');
const dateOffset=(date,days)=>new Date(Date.parse(`${date}T12:00:00Z`)+days*86400000).toISOString().slice(0,10);
const monthOffset=(month,offset)=>{const [year,number]=month.split('-').map(Number);return new Date(Date.UTC(year,number-1+offset,1)).toISOString().slice(0,7);};

function calendarNavigation(state,scope){
 const base=calendarScope({...state,calendarView:scope.view,calendarMonth:scope.month,day:'all',eventId:''});
 const anchor=isIsoDate(state.day)?state.day:scope.selected?.date??scope.window.startDate,date=new Date(`${anchor}T12:00:00Z`);
 const monday=dateOffset(anchor,-((date.getUTCDay()+6)%7)),month=anchor.slice(0,7);
 const adjacentEvents=new Map([-1,0,1].map(offset=>{const value=monthOffset(month,offset);return [value,calendarScope({...state,calendarView:scope.view,calendarMonth:value,day:'all',eventId:''}).filtered];}));
 const eventsOn=day=>(adjacentEvents.get(day.slice(0,7))??[]).filter(event=>event.date===day);
 const href=(day)=>routeFor({...state,calendarView:scope.view,calendarMonth:day.slice(0,7),day,eventId:''});
 const week=`<nav class="calendar-week-strip" aria-label="Retained release week">${Array.from({length:7},(_,index)=>{
  const day=dateOffset(monday,index),events=eventsOn(day);
  return `<a class="calendar-week-day${day===anchor?' is-selected':''}" href="${esc(href(day))}"${day===anchor?' aria-current="date"':''}><time datetime="${day}">${esc(new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',timeZone:'UTC'}))}</time><span>${events.length} retained ${events.length===1?'event':'events'}</span><strong>${esc(events[0]?.name??'No retained releases')}</strong>${events.length>1?`<small>+${events.length-1} more in retained schedule</small>`:''}</a>`;
 }).join('')}</nav>`;
 const first=new Date(`${month}-01T12:00:00Z`),gridStart=dateOffset(month+'-01',-first.getUTCDay());
 const monthName=first.toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'});
 const monthLink=(label,offset)=>`<a class="action" href="${esc(routeFor({...state,calendarView:scope.view,calendarMonth:monthOffset(month,offset),day:'all',eventId:''}))}" aria-label="${offset<0?'Previous':'Next'} calendar month">${label}</a>`;
 const calendar=`<section class="calendar-month-card"><header><h2>${esc(monthName)}</h2><div class="actions">${monthLink('‹',-1)}${monthLink('›',1)}</div></header><div class="calendar-weekday-labels" aria-hidden="true">${['S','M','T','W','T','F','S'].map(day=>`<span>${day}</span>`).join('')}</div><div class="calendar-month-grid">${Array.from({length:42},(_,index)=>{
  const day=dateOffset(gridStart,index),count=eventsOn(day).length;
  return `<a href="${esc(href(day))}" class="calendar-month-day${day.startsWith(month)?'':' outside-month'}${count?' has-events':''}${day===anchor?' is-selected':''}" aria-label="${esc(humanDate(day))} · ${count} retained events"${day===anchor?' aria-current="date"':''}>${Number(day.slice(-2))}${count?'<span class="calendar-date-dot" aria-hidden="true"></span>':''}</a>`;
 }).join('')}</div><p class="panel-note"><span class="calendar-date-dot" aria-hidden="true"></span> Retained release schedule · empty days do not prove no publication.</p></section>`;
 const upcoming=base.filtered.filter(event=>event.date>=anchor).slice(0,4);
 const next=`<section class="calendar-upcoming-card"><header><h2>Upcoming retained releases</h2><span>From selected date</span></header><div class="calendar-upcoming-list">${upcoming.map(event=>`<a href="${esc(routeFor({...state,calendarView:scope.view,calendarMonth:event.date.slice(0,7),day:'all',eventId:event.id}))}"><span>${esc(releaseDate(event.date))}${scheduledTime(event)?' · '+esc(scheduledTime(event)):''}</span><strong>${esc(event.name)}</strong><small>${esc(event.agency)} · ${esc(scheduleState(event))}</small></a>`).join('')||'<p class="panel-note">No later events in this retained window.</p>'}</div></section>`;
 return {week,sidebar:calendar+next};
}

function fundingDetails(event){
 if(event.sourceId!=='treasury-auctions')return '';
 const amount=Number.isFinite(event.offeringAmount)
  ?'$'+(event.offeringAmount/1e9).toLocaleString('en-US',{maximumFractionDigits:3})+'B':'Not supplied';
 const references=treasuryFundingReferences.map(row=>`<a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">`
  +`${esc(row.label)} ↗</a>`).join(' · ');
 return `<dl class="facts"><dt>Instrument</dt><dd>${joined([event.securityType,event.securityTerm,
  event.reopening?'reopening':'',event.cashManagement?'cash-management bill':''])}</dd>`
  +`<dt>Announced offering</dt><dd>${amount}</dd><dt>Auction date</dt><dd>${esc(humanDate(event.auctionDate))}</dd>`
  +`<dt>Issue / settlement</dt><dd>${esc(humanDate(event.issueDate))}</dd></dl>`
  +`<p class="panel-note">Offering amount is announced auction size, not a forecast of cash proceeds or financing requirements. `
  +`${references}</p>`;
}

function calendarPreview(event,state){
 if(!event)return panel('02','Selected release',emptyState('No release selected.',releases.length
  ?'Choose a release from the filtered schedule.':'No verified schedule has been ingested. Use the official agency schedules below.'),
  '','','calendar-detail');
 const source=scheduleSource(event),ids=relatedSeries(event);
 const primaryId=ids.includes(event.seriesId)?event.seriesId:ids[0];
 const indicatorAction=id=>`<div class="panel-body actions">${link(getSeries(id).short,indicatorHref(id,state))}`
  +`${saveButton(id,state)}</div>`;
 const indicators=ids.filter(id=>id!==primaryId).map(indicatorAction).join('');
 const basis=scheduleBasisNote(event),primaryState=scheduleState(event);
 const basisLabel=scheduleBasisPrefix(event).replace(/ · $/,'')||(event.scheduleBasis==='listed-date'?'Listed date':'');
 const timing=joined([releaseDate(event.date),scheduledTime(event)]);
 const context=joined([event.agency,scheduledPeriod(event)]);
 const warning=event.sourceId==='treasury-auctions'
  ?'This is an announced auction or issue/settlement date. The date does not verify an auction result or completed settlement.'
  :'Schedule information describes planned publication timing. A past scheduled time does not establish that a result was published.';
 const evidenceSeries=event.sourceId==='bea'&&event.program==='gdp'?'gdp'
  :event.sourceId==='dol'&&event.program==='weekly-claims'?'claimsAdvance'
   :event.sourceId==='bls'&&event.program==='consumer-price-index'?'cpiMonthly':null;
 const evidence=evidenceSeries?`<p class="panel-note">${link('Open release evidence',contextualHref({page:'release',
  eventId:event.id,publicationPeriod:'',publicationCutoff:'',publicationSeries:evidenceSeries},state))}</p>`:'';
 const metadata=`<p class="small muted calendar-source-capture">${esc(calendarPublisherName(event.sourceId,source))}`
  +`${source?.fetchedAt?`<br>Retrieved <span class="mono">${esc(humanTimestamp(source.fetchedAt))}</span>`:''}</p>`
  +(basis?`<p class="panel-note"><strong>Schedule basis.</strong> ${esc(basis)}</p>`:'')
  +calendarSourceNotice(source)
  +'<p class="panel-note">The source retrieval captures this schedule; it does not verify publication of a result.</p>'
  +`<p class="panel-note"><a href="${esc(event.sourceUrl)}" target="_blank" rel="noopener noreferrer">`
  +`${event.provider==='new-york-fed'?'NY Fed calendar':'Official schedule'} ↗</a></p>`;
 const body=`<h3 class="detail-title">${esc(event.name)}</h3><p class="detail-sub">${context}<br>${timing}</p>`
  +`<p class="panel-note"><span class="pill">${esc(primaryState)}</span>`
  +(basisLabel&&basisLabel!==primaryState?` <span class="calendar-basis">${esc(basisLabel)}</span>`:'')
  +` ${warning}</p>${fundingDetails(event)}${evidence}`
  +(source?.error?`<p class="panel-note amber">${esc(source.error)} · retained schedule may have changed.</p>`:'')
  +(primaryId?indicatorAction(primaryId):'')
  +(indicators?`<details class="calendar-related" data-page-disclosure="calendar:event:${esc(event.id)}:related">`
   +`<summary>More related indicators · Follow</summary>${indicators}</details>`:'')
  +supportingDetails(`calendar:event:${event.id}:basis`,'Schedule basis and retrieval',metadata,{className:'calendar-evidence'});
 return panel('02',event.sourceId==='treasury-auctions'?'Selected Treasury event':'Selected release',body,'',
  'Related indicators use their own observation snapshots. Follow saves each series to your browser watchlist.','calendar-detail');
}

function previousCell(event){
 const previous=calendarPrevious(event);
 if(!previous)return '<td class="num calendar-previous">—</td>';
 const {series,observation}=previous;
 return `<td class="num calendar-previous" data-series="${esc(series.id)}" data-previous-period="${esc(observation.date)}">`
  +`${esc(formatValue(series,observation.value))}<span class="table-code muted">`
  +`${esc(periodLabel(series,observation.date))}</span></td>`;
}

function sourceDetails(id,source){
 const status=id==='treasury-yield-timing'
  ?source.status==='ok'?'Captured publication timing':source.fetchedAt?'Cached publication timing · refresh failed':'Publication timing unavailable'
  :source.status==='ok'?source.provider==='new-york-fed'?'Captured secondary schedule':'Captured official schedule'
   :source.fetchedAt?'Cached schedule · refresh failed':'Schedule unavailable';
 return `<div class="definition"><h3>${esc(calendarPublisherName(id,source))}</h3><p>${status}</p><dl class="facts">`
  +(source.fetchedAt?`<dt>Retrieved</dt><dd class="mono">${esc(humanTimestamp(source.fetchedAt))}</dd>`:'')
  +(source.lastAttemptAt?`<dt>Last attempt</dt><dd class="mono">${esc(humanTimestamp(source.lastAttemptAt))}</dd>`:'')
  +`</dl>${source.error?`<p class="amber">${esc(source.error)}</p>`:''}`
  +(source.coverageNote?`<p>${esc(source.coverageNote)}</p>`:'')+calendarSourceNotice(source)
  +(source.warnings??[]).map(warning=>`<p class="muted">${esc(warning)}</p>`).join('')+'</div>';
}

export function calendarPage(state){
 const scope=calendarScope(state),{months,month,view,revealed,days,filtered,selected}=scope;
 const navigation=calendarNavigation(state,scope);
 const viewLabels={macro:'Macro releases',treasury:'Treasury & funding',all:'All events'};
 const today=new Intl.DateTimeFormat('en-CA',{
  timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const shortcuts=`<div class="actions calendar-window-shortcuts" role="group" aria-label="Schedule window shortcuts">`
  +link('Today',routeFor({...state,calendarView:view,calendarMonth:today.slice(0,7),day:today,eventId:''}))
  +link('Upcoming',routeFor({...state,calendarView:view,calendarMonth:'upcoming',day:'all',eventId:''}))+'</div>';
 const renderRows=events=>{
  let previousDay='';
  return events.map(event=>{
   const dayHeader=previousDay===event.date?'':`<tr class="calendar-day"><th scope="rowgroup" colspan="7">`
    +`${esc(releaseDate(event.date))}</th></tr>`;
   previousDay=event.date;
   const attributes=`data-event="${esc(event.id)}" aria-pressed="${selected?.id===event.id}" `
    +'aria-controls="calendar-selected-preview"';
   return dayHeader+`<tr class="calendar-event${selected?.id===event.id?' selected-row':''}">`
    +`<td class="mono">${esc(scheduledTime(event))}</td><th scope="row">${button(event.name,attributes,'link-button')}`
    +`<span class="table-code muted">${esc(scheduleBasisPrefix(event))}`
    +`${joined([scheduledPeriod(event),event.agency])}</span></th><td class="calendar-reference">${esc(scheduledPeriod(event)||'Not supplied')}</td><td class="calendar-agency">${esc(event.agency)}</td>${previousCell(event)}`
    +`<td><span class="pill">${esc(scheduleState(event))}</span>`
    +(selected?.id===event.id?button('View preview','data-calendar-preview aria-controls="calendar-selected-preview"',
     'link-button calendar-preview-jump'):'')+`</td><td class="calendar-series-action">${relatedSeries(event)[0]?link('Series →',indicatorHref(relatedSeries(event)[0],state)):'—'}</td></tr>`;
  }).join('');
 };
 const rows=renderRows(filtered.filter(event=>event.sourceId!=='treasury'));
 const routine=filtered.filter(event=>event.sourceId==='treasury');
 const columns='<tr><th scope="col">Time / ET</th><th scope="col">Event / release name</th><th scope="col">Ref</th><th scope="col">Agency</th>'
  +'<th scope="col" class="num">Previous</th><th scope="col">State</th><th scope="col">Action</th></tr>';
 const routineDates=routine.length?`<details class="calendar-routine-dates" data-page-disclosure="calendar:routine-dates"`
  +`${selected?.sourceId==='treasury'?' open':''}><summary>Routine Treasury debt publications · ${routine.length} dates</summary>`
  +`<div class="table-wrap"><table><caption class="sr-only">Routine debt-publication estimates with original timing and source basis`
  +`</caption><thead>${columns}</thead><tbody>${renderRows(routine)}</tbody></table></div></details>`:'';
 const schedule=filtered.length?'<div class="table-wrap"><table><caption class="sr-only">'
  +'Official agency release dates, labeled calendar estimates and recurring-rule dates; times are Eastern Time.</caption>'
  +`<thead>${columns}</thead><tbody>${rows}</tbody></table></div>${routineDates}`
  :emptyState(releases.length?'No releases match these filters.':'No verified releases have been ingested.',releases.length
   ?state.watchOnly&&!state.saved.length?'Your watchlist is empty. Follow a series from an indicator page or clear the filters.'
    :'Try another day or topic, or clear the filters.'
   :dataStatus.calendar?.message??'Consult the official release schedules for publication dates.',
  button('Clear filters','data-reset-calendar')+scheduleLinks());
 const viewSelect=`<label for="calendar-scope">View <select id="calendar-scope">`
  +Object.entries(viewLabels).map(([id,label])=>`<option value="${id}"${view===id?' selected':''}>${esc(label)}</option>`).join('')
  +'</select></label>';
 const monthSelect=`<label for="calendar-month">Window <select id="calendar-month">`
  +`<option value="upcoming"${month==='upcoming'?' selected':''}>Next 30 days</option>`
  +months.map(value=>`<option value="${value}"${month===value?' selected':''}>`
   +esc(new Intl.DateTimeFormat('en-US',{month:'short',year:'numeric',timeZone:'UTC'})
    .format(new Date(value+'-01T12:00:00Z')))+'</option>').join('')+'</select></label>';
 const daySelect=`<label for="calendar-day">Day <select id="calendar-day">`
  +`<option value="all"${state.day==='all'?' selected':''}>All days in window</option>`
  +days.map(date=>`<option value="${date}"${state.day===date?' selected':''}>${esc(releaseDate(date))}</option>`).join('')
  +'</select></label>';
 const filters=`<div class="calendar-filter-details" data-page-disclosure="calendar:filters">`
  +`<div class="toolbar calendar-toolbar">${daySelect}`
  +'<label for="calendar-topic">Topic <select id="calendar-topic">'
  +options(['All topics',...new Set([...releases.map(event=>event.topic),'Rates'])],state.calendarTopic)+'</select></label>'
  +`<label class="check-label" for="calendar-watch-only"><input type="checkbox" id="calendar-watch-only"`
  +`${state.watchOnly?' checked':''}>Watchlist only</label></div></div>`;
 const filterSummary=`<p class="calendar-filter-summary" role="status">${esc(viewLabels[view])} · `
  +`${month==='upcoming'?'Next 30 days':esc(month)} · ${state.day&&state.day!=='all'?esc(releaseDate(state.day)):'All days'} · `
  +`${esc(state.calendarTopic??'All topics')}${state.watchOnly?' · Watchlist only':''} · ${filtered.length} events</p>`;
 const selectedSummary='<div class="calendar-selected-summary" role="status" aria-live="polite">'
  +(selected?`<span>Selected: <strong>${esc(selected.name)}</strong> · `
   +`${joined([releaseDate(selected.date),scheduledTime(selected)])}</span>`
   +button('View selected event','data-calendar-preview aria-controls="calendar-selected-preview"')
   :'Choose an event to see its schedule evidence.')+'</div>';
 const sources=Object.entries(dataStatus.calendar?.sources??{}).map(([id,source])=>sourceDetails(id,source)).join('');
 const fundingThrough=dataStatus.calendar?.sources?.['treasury-auctions']?.events?.map(event=>event.date).sort().at(-1);
 const guide='<div class="explain"><p>Observation periods and retrieval timestamps do not establish publication dates. '
  +'This calendar uses captured agency schedules and labelled secondary calendars. Times follow America/New_York, '
  +'including daylight saving time.</p><p>Schedules may change. A past scheduled time does not confirm publication. '
  +'Verified GDP, claims and CPI results, when retained, are linked separately; a schedule alone contains no result or forecast. '
  +'Indicator observations remain available through each series page.</p><p>Previous shows a prior reference period '
  +'demonstrably retained before the event, using a reported publication date or an earlier retrieval. '
  +'It is blank when that timing or the event reference period is unavailable. Current revisions may differ from the historical release.</p>'
  +'<p>Bills appear only in Treasury &amp; funding. All events includes other retained programs. '
  +`${revealed?'View or window adjusted to reveal the linked event. ':''}`
  +`${fundingThrough?`Announced funding events retained through ${esc(humanDate(fundingThrough))}. `:''}`
  +'Announcement coverage ends with the retained feed; later announcements are not covered.</p>'
  +`<div class="actions">${scheduleLinks()}</div></div>`;
 const sourceContext=`<dl class="facts"><dt>Timezone</dt><dd>Eastern Time (EST / EDT)</dd><dt>Schedule status</dt>`
  +`<dd>${esc(dataStatus.calendar?.status??'Unavailable')}</dd><dt>Captured events</dt><dd>${releases.length}</dd></dl>`
  +`<p class="panel-note">${esc(dataStatus.calendar?.message??'A verified schedule feed is unavailable.')}</p>`
  +`<div class="definitions">${sources}</div>`;
 return '<div class="radar-page radar-calendar stitch-calendar">'
  +heading('Economic release calendar','Official and labeled secondary schedules for U.S. macroeconomic releases and Treasury funding events. America/New_York (ET).',button('Reset filters','data-reset-calendar'))
  +'<div class="workspace-basis">'+readingGroup('Schedule scope',shortcuts
   +`<div class="toolbar calendar-toolbar">${viewSelect}${monthSelect}</div>${filters}${filterSummary}`)+'</div>'
  +navigation.week+'<div class="workspace-analysis"><div class="calendar-layout radar-calendar-desk"><div class="calendar-schedule-column">'
  +panel('01',view==='treasury'?'Treasury auctions & settlements':'Release schedule',selectedSummary+schedule,
   `<span class="small muted">${filtered.length} events</span>`)
  +'<p class="calendar-schedule-note">Schedules do not confirm publication. Previous values are shown only when their reference period and availability before the event are established.</p></div><aside class="calendar-side-stack">'+navigation.sidebar
  +'<div id="calendar-selected-preview" role="region" aria-label="Selected scheduled event" tabindex="-1">'
  +calendarPreview(selected,{...state,calendarView:view})+'</div></aside></div></div>'
  +(view!=='macro'&&['All topics','Rates'].includes(state.calendarTopic)&&(!state.watchOnly||state.saved.includes('yield'))
   ?supportingDetails('calendar:yield-timing','Rates guidance · ongoing Treasury publication timing',yieldTimingPanel()):'')
  +supportingDetails('calendar:context','About this data',`<div class="grid g11">${panel('03','Reading this calendar',guide)}`
   +`${panel('04','Schedule context',sourceContext)}</div>`,{className:'calendar-context'})+'</div>';
}
