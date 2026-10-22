import {releases,series} from './data.js';
import {calendarRelatedIds} from './macro-calendar.js';

/** Resolve the same current schedule window, filters and preview for UI and pinning. */
export function calendarScope(state,{events=releases,catalog=series,now=new Date()}={}){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new Error('Invalid calendar scope date.');
 const ordered=[...events].sort((a,b)=>a.date.localeCompare(b.date)||String(a.time??'').localeCompare(String(b.time??''))||a.id.localeCompare(b.id));
 const months=[...new Set(events.map(event=>event.date.slice(0,7)))].sort();
 const month=months.includes(state.calendarMonth)?state.calendarMonth:'upcoming';
 let startDate,endDate;
 if(month==='upcoming'){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(part=>[part.type,part.value]));
  startDate=`${parts.year}-${parts.month}-${parts.day}`;
  endDate=new Date(Date.parse(`${startDate}T12:00:00Z`)+29*86400000).toISOString().slice(0,10);
 }else{
  startDate=`${month}-01`;
  const [year,number]=month.split('-').map(Number);endDate=new Date(Date.UTC(year,number,0)).toISOString().slice(0,10);
 }
 const windowEvents=ordered.filter(event=>event.date>=startDate&&event.date<=endDate),days=[...new Set(windowEvents.map(event=>event.date))];
 const related=event=>calendarRelatedIds(event).filter(id=>Object.hasOwn(catalog,id)),saved=state.saved??[];
 const filtered=windowEvents.filter(event=>(state.day==='all'||!state.day||event.date===state.day)
  &&(!state.calendarTopic||state.calendarTopic==='All topics'||event.topic===state.calendarTopic||related(event).some(id=>catalog[id].topic===state.calendarTopic))
  &&(!state.watchOnly||related(event).some(id=>saved.includes(id))));
 const selected=filtered.find(event=>event.id===state.eventId)??filtered[0];
 return {months,month,days,windowEvents,filtered,selected,window:{startDate,endDate,timeZone:'America/New_York'}};
}
