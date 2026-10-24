import {calendarRelatedIds} from './macro-calendar.js';
import {getFreshness} from './freshness.js';
import {releaseMeasurements,matchReleaseEvidence,selectReleaseEvidence} from './release-evidence.js';
import {escapeHtml as esc,panel,table} from './ui.js';

const easternDay=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const chronological=(a,b)=>a.date.localeCompare(b.date)||String(a.time??'').localeCompare(String(b.time??''));
const family=id=>id==='gdp'?'gdp':'claims';
function publicationCoverage(id,latestDue,context){
 if(!releaseMeasurements[id])return {status:'unsupported',label:'Publication evidence not covered',date:null,retrievedAt:null,reason:'This program has no reviewed publication archive here. Latest revised readings and related schedules remain available.'};
 if(context?.status==='error')return {status:'unavailable',label:'Publication evidence unavailable',date:null,retrievedAt:null,reason:context.error??'The reviewed archive could not be loaded.'};
 if(context?.status!=='ready')return {status:'unloaded',label:context?.status==='loading'?'Publication evidence loading':'Publication evidence not loaded',date:null,retrievedAt:null,reason:'The current-data capture does not establish a matching publication.'};
 const view=latestDue?matchReleaseEvidence(latestDue,context.archive,{seriesId:id}):selectReleaseEvidence(context.archive,{seriesId:id});
 if(view.status!=='verified')return {status:'unverified',label:latestDue?'Scheduled time elapsed · publication unverified':'No verified retained publication',date:null,retrievedAt:null,reason:view.reason};
 return {status:'verified',label:latestDue?'Latest due schedule matched':'Retained publication · no due schedule in coverage',date:view.actual.publicationDate,referencePeriod:view.actual.period,retrievedAt:view.actual.provenance[0].retrievedAt,href:`#/release?publicationSeries=${id}&period=${view.actual.period}&publishedBy=${view.actual.publicationDate}`,reason:'Verified publication day; exact publication instant is unknown.'};
}

/** Collection timeliness and release coverage are independent; no retry window establishes currentness. */
export function releaseCoverage(catalog={},snapshot={}, {seriesIds=['gdp','payroll','pceCoreMonthly','claimsAdvance'],events=snapshot.releases??[],publicationContexts={},now=new Date()}={}) {
 const freshness=getFreshness(snapshot,{now}),today=easternDay(now),instant=now.getTime();
 return [...new Set(seriesIds)].flatMap(id=>{
  const current=catalog[id];if(!current)return [];
  const related=events.filter(event=>calendarRelatedIds(event).includes(id)).sort(chronological);
  const isDue=event=>Number.isFinite(Date.parse(event.scheduledAt))?Date.parse(event.scheduledAt)<=instant:event.date<today;
  const latestDue=related.filter(isDue).at(-1)??null,nextExpected=related.find(event=>!isDue(event)&&event.date>=today)??null;
  const source=snapshot.sources?.[current.agency],capture=freshness.entries.find(entry=>entry.id===`data:${current.agency}`);
  const captured=current.fetchedAt??source?.fetchedAt??null,status=current.dataStatus==='unavailable'||!captured?'unavailable':current.dataStatus==='cached'||source?.status&&source.status!=='ok'?'cached':'captured';
 const scheduleSource=latestDue?.sourceId??nextExpected?.sourceId,schedule=snapshot.calendar?.sources?.[scheduleSource];
  return [{id,name:current.short??current.name,frequency:current.frequency,referencePeriod:current.observations?.at(-1)?.date??null,collection:{status,fetchedAt:captured,overdue:capture?.stale??false,error:current.error??source?.error??null},latestDue,nextExpected,scheduleStatus:!schedule?'unavailable':schedule.status==='ok'?'captured':'cached',publication:publicationCoverage(id,latestDue,publicationContexts[family(id)])}];
 });
}
const scheduleLabel=event=>event?`${event.date} · ${event.time?event.time+' ET':'time not supplied'}`:'Not in retained schedule coverage';

/** A compact optional disclosure keeps detailed clocks available without a second dashboard. */
export function releaseCoveragePanel(rows,{title='DATA FRESHNESS & RELEASE COVERAGE',number='•',disclosure=true,hrefFor=null}={}) {
 if(!rows.length)return '';
 const body=table(['MEASUREMENT / REFERENCE','COLLECTION','PUBLICATION EVIDENCE','RELATED SCHEDULE'],rows.map(row=>`<tr><th scope="row"><a href="#/series/${esc(row.id)}">${esc(row.name)}</a><span class="table-code muted">Reference ${esc(row.referencePeriod??'Unavailable')}</span></th><td>${esc(row.collection.status==='captured'?'Captured':row.collection.status==='cached'?'Cached after collection problem':'Collection unavailable')}${row.collection.overdue?' · daily collection overdue':''}<span class="table-code muted">${esc(row.collection.fetchedAt??'No successful retrieval')}</span>${row.collection.error?`<span class="table-code amber">${esc(row.collection.error)}</span>`:''}</td><td>${row.publication.href?`<a href="${esc(row.publication.href)}">${esc(row.publication.label)}</a>`:esc(row.publication.label)}${row.publication.date?`<span class="table-code muted">Published ${esc(row.publication.date)} · day precision · reference ${esc(row.publication.referencePeriod)}</span><span class="table-code muted">Evidence captured ${esc(row.publication.retrievedAt)}</span>`:''}<span class="table-code muted">${esc(row.publication.reason)}</span></td><td><span class="table-code">Latest due: ${esc(scheduleLabel(row.latestDue))}</span><span class="table-code">Next: ${esc(scheduleLabel(row.nextExpected))}</span><span class="table-code muted">${row.scheduleStatus==='captured'?'Retained agency schedule':row.scheduleStatus==='cached'?'Cached schedule · check official source':'Schedule source unavailable'}</span></td></tr>`).join(''),'Collection health and publication evidence')+'<p class="panel-note">Reference periods describe economic activity. Collection describes retrieval health. A schedule is an expectation; elapsed time and a successful collection do not prove publication. Historical archive captures are not new releases today.</p>';
 const linked=hrefFor?body.replace(/href="#\/series\/([A-Za-z0-9]+)"/g,(_all,id)=>`href="${esc(hrefFor(id))}"`):body;
 return disclosure?`<details class="supporting-details"><summary>${esc(title)}</summary>${linked}</details>`:panel(number,title,linked);
}
