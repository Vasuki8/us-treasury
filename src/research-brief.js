import {releaseMeasurements,selectReleaseEvidence} from './release-evidence.js';
import {publicationFamily as family} from './publication-controller.js';
import {isTreasuryBill} from './calendar-scope.js';
const labels={'first-capture':'First captured coverage','new-period':'New reference period','historical-backfill':'Historical backfill','value-change':'Observed change between retrievals','metadata-change':'Metadata update','observation-metadata-change':'Observation metadata update','coverage-removal':'Coverage removed'};
const newest=(field)=>(a,b)=>String(b[field]??'').localeCompare(String(a[field]??''));
/** Curated overview only; the chronological full calendar remains unfiltered. */
export function nextCatalysts(events,{now=new Date(),limit=4}={}) {
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const end=new Date(Date.parse(today+'T12:00:00Z')+29*86400000).toISOString().slice(0,10);
 const seen=new Set();
 const headline=new Set(['gdp','consumer-price-index','employment-situation','personal-income-outlays','weekly-claims','fomc-decision']);
 return [...events].filter(event=>event.date>=today&&event.date<=end&&event.sourceId!=='treasury'&&!isTreasuryBill(event)
  &&(!event.scheduledAt||Date.parse(event.scheduledAt)>=now.getTime()))
  .sort((a,b)=>Number(headline.has(b.program))-Number(headline.has(a.program))
   ||a.date.localeCompare(b.date)||String(a.time??'').localeCompare(String(b.time??'')))
  .filter(event=>{
   const key=`${event.sourceId}|${event.program??event.name}`;
   if(seen.has(key))return false;
   seen.add(key);return true;
  }).slice(0,limit);
}
/** Publication evidence, latest revised readings and collection history are separate clocks. */
export function dailyBrief({catalog={},changes=[],failures=[],publicationContexts={}}={}) {
 const publications=[];
 for(const [id,measurement] of Object.entries(releaseMeasurements)){
  const context=publicationContexts[family(id)];if(context?.status!=='ready')continue;
  const view=selectReleaseEvidence(context.archive,{seriesId:id});if(view.status!=='verified')continue;
  const row=view.actual;
  publications.push({id,category:'publication',kind:'Verified published estimate',period:row.period,publicationDate:row.publicationDate,retrievedAt:row.provenance[0].retrievedAt,href:`#/release?publicationSeries=${id}&period=${row.period}&publishedBy=${row.publicationDate}`,name:measurement.name,value:row.value,estimate:row.estimate});
 }
 const captures=[...changes].sort(newest('capturedAt')).slice(0,4).map(change=>({id:change.seriesId,category:'capture',kind:labels[change.kind]??'Retrieval change',period:change.period,publicationDate:null,retrievedAt:change.capturedAt,name:catalog[change.seriesId]?.name??change.seriesId,href:`#/research?view=changes&since=${encodeURIComponent(change.previousRetrievedAt??'')}`}));
 const attention=[...failures].sort(newest('fetchedAt')).map(failure=>({id:failure.id,category:'collection',kind:'Collection problem',period:null,publicationDate:null,retrievedAt:failure.fetchedAt??null,name:failure.error,href:'#/research?view=changes'}));
 const readings=['gdp','pceCoreMonthly','payroll'].flatMap(id=>{const current=catalog[id],row=current?.observations?.at(-1);return row?[{id,category:'reading',kind:'Latest revised observation',period:row.date,publicationDate:null,retrievedAt:current.fetchedAt??null,name:current.name,value:row.value,href:`#/series/${id}`}]:[];});
 return {publications:publications.sort(newest('publicationDate')),captures,attention,readings,publicationStates:{gdp:publicationContexts.gdp?.status??'idle',claims:publicationContexts.claims?.status??'idle',cpi:publicationContexts.cpi?.status??'idle'}};
}
/** Flat form is retained for frozen research packages; every row carries its evidence category. */
export function evidenceBrief(options={}) {
 const brief=dailyBrief(options);
 return [...brief.publications,...brief.attention,...brief.captures,...brief.readings];
}
