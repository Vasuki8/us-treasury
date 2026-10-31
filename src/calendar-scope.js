import {releases,series} from './data.js';
import {calendarRelatedIds} from './macro-calendar.js';
import {isIsoDate} from './date-window.js';
export const isTreasuryEvent=event=>['treasury','treasury-auctions'].includes(event?.sourceId);
export const isTreasuryBill=event=>event?.sourceId==='treasury-auctions'&&/bill/i.test(event.securityType??'');

/** Keep a revealed legacy link's visible scope when the next filter removes its event. */
export function revealedCalendarState(state,options){
 const scope=calendarScope(state,options);
 return scope.revealed?{...state,calendarView:scope.view,calendarMonth:scope.month}:state;
}

/** Resolve the same current schedule window, filters and preview for UI and pinning. */
export function calendarScope(state,{events=releases,catalog=series,now=new Date()}={}){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new Error('Invalid calendar scope date.');
 const ordered=[...events].sort((a,b)=>a.date.localeCompare(b.date)||String(a.time??'').localeCompare(String(b.time??''))||a.id.localeCompare(b.id));
 const months=[...new Set(events.map(event=>event.date.slice(0,7)))].sort();
 if(isIsoDate(state.calendarMonth+'-01')&&!months.includes(state.calendarMonth)){
  months.push(state.calendarMonth);months.sort();
 }
 const related=event=>calendarRelatedIds(event).filter(id=>Object.hasOwn(catalog,id)),saved=state.saved??[];
 const matchesFilters=event=>(state.day==='all'||!state.day||event.date===state.day)
  &&(!state.calendarTopic||state.calendarTopic==='All topics'||event.topic===state.calendarTopic||related(event).some(id=>catalog[id].topic===state.calendarTopic))
  &&(!state.watchOnly||related(event).some(id=>saved.includes(id)));
 const explicit=ordered.find(event=>event.id===state.eventId&&matchesFilters(event)&&(!months.includes(state.calendarMonth)||event.date.startsWith(state.calendarMonth+'-')));
 let view=['treasury','all'].includes(state.calendarView)?state.calendarView:'macro',revealed=false;
 if(explicit&&isTreasuryBill(explicit)&&view!=='treasury'){view='treasury';revealed=true;}
 if(explicit&&view!=='all'&&isTreasuryEvent(explicit)!==(view==='treasury')){view=isTreasuryEvent(explicit)?'treasury':'macro';revealed=true;}
 let month=months.includes(state.calendarMonth)?state.calendarMonth:'upcoming';
 let startDate,endDate;
 if(month==='upcoming'){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(part=>[part.type,part.value]));
  startDate=`${parts.year}-${parts.month}-${parts.day}`;
  endDate=new Date(Date.parse(`${startDate}T12:00:00Z`)+29*86400000).toISOString().slice(0,10);
 }else{
  startDate=`${month}-01`;
  const [year,number]=month.split('-').map(Number);endDate=new Date(Date.UTC(year,number,0)).toISOString().slice(0,10);
 }
 if(explicit&&(explicit.date<startDate||explicit.date>endDate)){
  month=explicit.date.slice(0,7);startDate=month+'-01';
  const [year,number]=month.split('-').map(Number);endDate=new Date(Date.UTC(year,number,0)).toISOString().slice(0,10);revealed=true;
 }
 const windowEvents=ordered.filter(event=>event.date>=startDate&&event.date<=endDate);
 const viewEvents=windowEvents.filter(event=>(view==='treasury'||!isTreasuryBill(event))
  &&(view==='all'||isTreasuryEvent(event)===(view==='treasury')));
 const days=[...new Set(viewEvents.map(event=>event.date))];
 if(isIsoDate(state.day)&&state.day>=startDate&&state.day<=endDate&&!days.includes(state.day)){
  days.push(state.day);days.sort();
 }
 const filtered=viewEvents.filter(matchesFilters);
 const selected=filtered.find(event=>event.id===state.eventId)??(view==='treasury'?filtered.find(event=>event.sourceId!=='treasury'):null)??filtered[0];
 return {months,month,view,revealed,days,windowEvents,filtered,selected,window:{startDate,endDate,timeZone:'America/New_York'}};
}
