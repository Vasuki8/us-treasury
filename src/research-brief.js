const labels={'first-capture':'First captured coverage','new-period':'New reference period','historical-backfill':'Historical backfill','value-change':'Observed change between retrievals','metadata-change':'Metadata update','observation-metadata-change':'Observation metadata update','coverage-removal':'Coverage removed'};
/** Curated overview only; the chronological full calendar remains unfiltered. */
export function nextCatalysts(events,{now=new Date(),limit=4}={}) {
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const end=new Date(Date.parse(today+'T12:00:00Z')+29*86400000).toISOString().slice(0,10);
 const seen=new Set();
 return [...events].filter(event=>event.date>=today&&event.date<=end&&event.sourceId!=='treasury'&&(!event.scheduledAt||Date.parse(event.scheduledAt)>=now.getTime())).sort((a,b)=>a.date.localeCompare(b.date)||String(a.time??'').localeCompare(String(b.time??''))).filter(event=>{const key=`${event.sourceId}|${event.program??event.name}`;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,limit);
}
/** Describe only evidence already retained; no assembly timestamp is a release. */
export function evidenceBrief({catalog={},sources={},changes=[],failures=[]}={}) {
 const rows=[];
 for(const id of ['claimsAdvance','continuedClaimsAdvance']){
  const current=catalog[id],source=sources.dolAdvance,observation=current?.observations?.at(-1);
  if(observation&&source?.releaseDate&&source.provenance?.length)rows.push({id,kind:'Verified published estimate',period:observation.date,publicationDate:source.releaseDate,retrievedAt:source.fetchedAt??null,href:`#/release?publicationSeries=${id}&period=${observation.date}&publishedBy=${source.releaseDate}`,name:current.name,value:observation.value});
 }
 for(const failure of failures)rows.push({id:failure.id,kind:'Collection problem',period:null,publicationDate:null,retrievedAt:failure.fetchedAt,name:failure.error,href:'#/research?view=changes'});
 for(const change of changes.slice(0,4))rows.push({id:change.seriesId,kind:labels[change.kind]??'Retrieval change',period:change.period,publicationDate:change.publicationDate??null,retrievedAt:change.capturedAt,name:catalog[change.seriesId]?.name??change.seriesId,href:`#/research?view=changes&since=${encodeURIComponent(change.previousRetrievedAt??'')}`});
 if(!changes.length)for(const id of ['gdp','pceCoreMonthly','payroll']){
  const current=catalog[id],row=current?.observations?.at(-1);if(!row)continue;
  rows.push({id,kind:'Latest revised observation',period:row.date,publicationDate:row.publishedAt??null,retrievedAt:current.fetchedAt,name:current.name,value:row.value,href:`#/series/${id}`});
 }
 return rows.slice(0,5);
}
