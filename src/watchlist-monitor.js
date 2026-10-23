import { calendarRelatedIds } from './macro-calendar.js';
export function monitorUpdateLabel(id,changes={},checkpoint={}){
 if(!checkpoint.enabled)return 'Update comparison off';
 if(changes.status==='error')return 'Update history unavailable';
 if(changes.status!=='ready')return 'Loading update history';
 const names={'new-period':'New reference period','historical-backfill':'Historical backfill','value-change':'Observed value change between retrievals','metadata-change':'Metadata update','observation-metadata-change':'Observation metadata update','first-capture':'First captured coverage','coverage-removal':'Coverage removed'};
 const row=(changes.rows??[]).find(item=>item.seriesId===id);
 return row?names[row.kind]??'Captured change':'No captured changes since checkpoint';
}
export function moveFollowed(saved,id,direction){
 const result=[...saved],index=result.indexOf(id),next=index+direction;
 if(![-1,1].includes(direction)||index<0||next<0||next>=result.length)return result;
 [result[index],result[next]]=[result[next],result[index]];return result;
}
export function watchlistMonitor(saved,{catalog={},events=[],sort='manual',group=false,now=new Date()}={}){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const ordered=[...events].filter(e=>e.date>=today&&(!e.scheduledAt||Date.parse(e.scheduledAt)>=now.getTime())).sort((a,b)=>a.date.localeCompare(b.date)||String(a.time??'').localeCompare(String(b.time??'')));
 return [...new Set(saved)].filter(id=>catalog[id]).map((id,index)=>({id,current:catalog[id],index,nextEvent:ordered.find(event=>calendarRelatedIds(event).includes(id))??null})).sort((a,b)=>{
  const topic=group?String(a.current.topic).localeCompare(String(b.current.topic)):0;
  return topic||(sort==='updated'?String(b.current.fetchedAt??'').localeCompare(String(a.current.fetchedAt??'')):sort==='next'?String(a.nextEvent?.date??'9999').localeCompare(String(b.nextEvent?.date??'9999')):0)||a.index-b.index;
 });
}
