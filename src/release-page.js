import {humanDate,humanTimestamp} from './ui-time.js';
import { readingGroup, supportingDetails } from './page-hierarchy.js';
import {releases,dataStatus} from './data.js';
import {heading,panel,table,button,emptyState,sentenceCase,escapeHtml as esc} from './ui.js';
import {periodLabel} from './model.js';
import {routeFor} from './router.js';
import {workspaceReturn,contextualHref,indicatorHref} from './workspace-context.js';
import {releaseMeasurements,matchReleaseEvidence,selectReleaseEvidence,releaseDelivery} from './release-evidence.js';
import {publicationExplanation} from './publication-explanation-view.js';
import {publicationContext} from './publication-history.js';
import {publicationFamily} from './publication-controller.js';

const source=(url,label)=>typeof url==='string'&&/^https:\/\//.test(url)?`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`:esc(label);
const link=(label,url)=>`<a class="action" href="${esc(url)}">${esc(sentenceCase(label))}</a>`;
const measurementValue=row=>row?`${new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(row.value)} ${row.seriesId==='gdp'?'% annualized':publicationFamily(row.seriesId)==='cpi'?'%':'thousand'}`:'Unavailable';
const reference=row=>row?periodLabel({frequency:row.frequency},row.period):'Unavailable';
const signed=(number,unit)=>number===null?'Unavailable':`${number>0?'+':''}${number} ${unit}`;
const scheduleKinds={'recurring-rule':'Recurring rule','published-exception':'Explicit schedule exception',exception:'Explicit schedule exception','holiday-exception':'Explicit schedule exception',estimated:'Estimated schedule'};

function collectionTiming(event,actual){
 const delivery=releaseDelivery(event,actual);
 const delay=delivery.scheduleToRetrievalMinutes===null?'Unavailable'
  :`${delivery.scheduleToRetrievalMinutes.toLocaleString('en-US')} minutes`;
 return supportingDetails('release:collection','About this data',
  '<dl class="facts release-facts"><dt>Schedule-to-retrieval delay</dt>'
  +`<dd>${esc(delay)}</dd><dt>Publication-to-retrieval latency</dt>`
  +'<dd>Unavailable · exact publication instant is not verified</dd><dt>Loaded snapshot</dt>'
  +`<dd>${esc(dataStatus.generatedAt??'Unavailable')}</dd>`
  +(event?.scheduledAt?`<dt>Scheduled instant / UTC</dt><dd>${esc(event.scheduledAt)}</dd>`:'')
  +`<dt>Evidence retrieved / UTC</dt><dd>${esc(delivery.retrievedAt??'Unavailable')}</dd></dl>`
  +'<p class="panel-note">Backfill captures can have a long schedule-to-retrieval delay; '
  +'this is the retained evidence receipt, not measured live delivery performance. '
  +'A fresh collection can still contain an older reference period.</p>');
}
function clocks(event,actual){
 const delivery=releaseDelivery(event,actual);
 const expected=event?`${humanDate(event.date)}${event.time?` ${event.time} Eastern`:''} · `
  +`${scheduleKinds[event.scheduleBasis]??(event.estimated?'Estimated schedule':'Individually listed schedule')}`
  :'No schedule selected for this publication; open its calendar event for retained timing';
 return panel('02','Schedule, publication and collection','<dl class="facts release-facts">'
  +`<dt>Expected schedule</dt><dd>${esc(expected)}</dd>`
  +(actual?`<dt>Verified publication</dt><dd>${esc(humanDate(actual.publicationDate))} (day precision)</dd>`:'')
  +`<dt>Reference period</dt><dd>${esc(reference(actual))}</dd>`
  +(delivery.retrievedAt?`<dt>Evidence retrieved</dt><dd>${esc(humanTimestamp(delivery.retrievedAt))}</dd>`:'')
  +'</dl><p class="panel-note">Publication-day evidence does not establish an exact publication instant.</p>'
  +(event?`<p class="panel-note">${source(event.sourceUrl,'Official schedule ↗')}. `
   +'Schedules may change; an elapsed scheduled time does not verify publication.</p>':''));
}

function explanation(view,archive,state){
 const actual=view.actual;
 if(actual.seriesId!=='gdp')return panel('03','AGENCY EXPLANATION',`<p>Agency explanation unavailable for a causal account of this movement. No cause is inferred from the figures.</p>${actual.seasonalAdjustmentNote?`<p class="amber">Source seasonal-factor notice: ${esc(actual.seasonalAdjustmentNote)}</p>`:''}${actual.footnotes?.length?supportingDetails('release:dated-notes', 'Dated release notes', `<ul>${actual.footnotes.map(note=>`<li>${esc(note)}</li>`).join('')}</ul>`):''}`);
 if(state?.status==='error')return panel('03','AGENCY EXPLANATION',emptyState('Agency explanation unavailable.',state.error??'Reviewed explanation could not be loaded.',button('RETRY EXPLANATIONS','data-retry-publication-explanations')));
 if(state&&state.status!=='ready')return panel('03','AGENCY EXPLANATION',emptyState('Loading reviewed BEA explanation.','Numerical publication evidence remains available.'));
 const item=publicationExplanation(actual,archive);
 return panel('03','AGENCY EXPLANATION',item?`<p>${esc(item.summary)}</p>${item.details?.length?supportingDetails('release:agency-details', 'BEA source details', `<ul>${item.details.map(detail=>`<li>${esc(detail)}</li>`).join('')}</ul>`):''}<p class="panel-note">${esc(item.attribution)} ${source(item.sourceUrl,item.sourceTitle+' ↗')}. Meridian paraphrase of dated agency evidence; revision explanations are separate from contributors to economic growth. ${source(item.licenseUrl,'Reuse terms ↗')}</p>`:'<p>Agency explanation unavailable for this exact publication. No revision cause is inferred from the numerical difference.</p>');
}

/** Shared lazy publication loaders supply archive and explanation state. */
export function releasePage(state={}, {archive=null,publicationState={status:archive?'ready':'idle'},explanations=null,explanationState=null,events=releases}={}){
 const seriesId=state.publicationSeries??'gdp',measurement=releaseMeasurements[seriesId],event=events.find(row=>row.id===state.eventId)??null;
 const following=(state.saved??[]).includes(seriesId);
 const back=workspaceReturn(state);
 const calendar=routeFor({...state,page:'calendar',eventId:event?.id??state.eventId??'',returnTo:null});
 const returnNavigation=`<nav class="return-context" aria-label="Return to originating view">${back?link(back.label,back.href)+link('OPEN CALENDAR',calendar):link('RETURN TO CALENDAR',calendar)}</nav>`;
 const intro=returnNavigation+heading('Release evidence',`${measurement?.name??'Reviewed release'} · expected schedule, verified result and earlier publications`,measurement?button(following?'★ FOLLOWING':'☆ FOLLOW',`data-save="${esc(seriesId)}" aria-pressed="${following}"`):'');
 if(publicationState.status==='error')return intro+emptyState('Official release evidence unavailable.',publicationState.error
  ??'The archive could not be loaded.',button('RETRY PUBLICATIONS','data-retry-publications'))+clocks(event,null)+collectionTiming(event,null);
 if(publicationState.status!=='ready')return intro+emptyState('Loading official release evidence.',
  'A scheduled release is not treated as a published result.')+clocks(event,null)+collectionTiming(event,null);
 const selection={seriesId,period:state.publicationPeriod??'',publicationCutoff:state.publicationCutoff??''};
 const view=state.eventId&&!event?{status:'unavailable',reason:'This schedule event is outside retained calendar coverage.'}:event?matchReleaseEvidence(event,archive,selection):selectReleaseEvidence(archive,selection);
 if(view.status!=='verified')return intro+panel('01','SCHEDULE ONLY',
  (`<p><strong>Schedule only · result unavailable</strong></p><p>${esc(view.reason)
  }</p><p class="panel-note">No current-data observation, estimated week or elapsed schedule `+
  `is substituted for matching official evidence.</p>`))+clocks(event,null)+collectionTiming(event,null);
 const row=view.actual,gdp=seriesId==='gdp',cpi=publicationFamily(seriesId)==='cpi',unit=gdp||cpi?'percentage points':'thousand';
 const facts=[['Actual · '+row.estimate,row],...(gdp?[['Earlier estimate of this quarter',view.earlierPublication]]:[['Same-release prior · '+(view.sameReleasePrior?.estimate??'role unavailable'),view.sameReleasePrior],['Earlier published prior · separate retained publication',view.earlierPrior]])];
 const rows=facts.map(([role,
  fact])=>`<tr><th scope="row">${esc(role)}</th><td class="num">${esc(measurementValue(fact))}</td><td>${esc(reference(fact))}</td><td>${esc
  (humanDate(fact?.publicationDate)||'—')}</td><td>${fact?source(fact.releaseEvidenceUrl,'Official evidence ↗'):'No matching retained evidence'
  }</td></tr>`).join('');
 const history=contextualHref({page:'research',researchView:'publications',publicationSeries:seriesId,publicationPeriod:row.period,publicationCutoff:row.publicationDate},state);
 const context=gdp?publicationContext(row):null;
 const comparisons=gdp?`${context.confirmation?context.label+'. ':''}Difference from earlier estimate: ${signed(view.revision,unit)}. Same-release prior-quarter comparison: unavailable in this selected archive. Differences between estimates of this quarter are not a consensus surprise.`:cpi?`Same-month prior publication difference: ${signed(view.priorRevision,unit)}. A prior-month cell is a different reference month in the same Table A. Differences between reference months are movements, not revisions or consensus surprises. Annual prior is unavailable. Exact published rates remain distinct from current index-derived readings.`:`Difference in the same-release prior versus its earlier retained publication: ${signed(view.priorRevision,unit)}. A quoted previously published count does not establish a separately retained original advance. Actual minus same-release prior is a week-to-week change, not a consensus surprise.`;
 const result=panel('01','VERIFIED OFFICIAL RESULT',readingGroup('Published result basis',
  `<p class="publication-result"><strong>Verified official result · ${esc(measurement.name)}: ${esc(measurementValue(row))}</strong> · ${esc
  (reference(row))} · ${esc(row.estimate)}</p><p class="panel-note">${esc(row.unit)} · ${esc(row.adjustment)} · ${esc(row.frequency)
  }. Publication date: ${esc(humanDate(row.publicationDate))} (day precision).</p>`)+`${table(['RELEASE ROLE',{label:'PUBLISHED VALUE',numeric:
  true},'REFERENCE PERIOD','PUBLICATION DAY','EVIDENCE'],rows,'Verified release result and separate prior evidence')}<p class="panel-note">${esc
  (comparisons)} Seasonal-factor update boundaries suppress inferred revision differences.</p><div class="actions">${link
  ('Publication history / CSV / Save snapshot',history)}${link('INDICATOR',indicatorHref(seriesId,state))}${link(gdp?
  'COMPARE WITH REAL SPENDING':'COMPARE WITH UNEMPLOYMENT',contextualHref({page:'explore',exploreMode:'compare',selected:[seriesId,gdp?
  'realSpending':'unrate']},state))}</div>`);
 const evidence=supportingDetails('release:source-reuse','Source evidence & reuse',panel('04','SOURCE EVIDENCE AND REUSE',`<p>${source(row.releaseEvidenceUrl,'Dated official release ↗')} · ${source(row.sourceUrl,row.sourceTitle??'Published source ↗')}</p><p>${esc(row.attribution??'')}</p><p class="panel-note">${esc(row.calculation??'')} ${source(row.licenseUrl,'Reuse terms ↗')}</p><p class="panel-note">Official publication history, latest revised history and Meridian retrieval history remain separate. The history link preserves this measurement, period and publication-day cutoff for CSV and frozen evidence.</p>`));
 return intro+`<div class="workspace-analysis">`+result+clocks(event,row)+explanation(view,explanations,explanationState)+`</div>`
  +collectionTiming(event,row)+evidence;
}
