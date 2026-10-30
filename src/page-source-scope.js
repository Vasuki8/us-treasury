import {series,dataStatus} from './data.js';
import {requiredSourceIds} from './source-controller.js';
import {calendarScope} from './calendar-scope.js';

/** Credits follow the displayed catalog page, charts and explicit specialist datasets. */
export function pageSourceScope(state,html='',{catalog=series,sources=dataStatus.sources,calendar=dataStatus.calendar,events}={}){
 const ids=new Set(),sourceIds=new Set(requiredSourceIds(state,{catalog}));
 if(state.page==='indicator')ids.add(state.seriesId);
 if(state.page==='watchlist')for(const id of state.saved??[])ids.add(id);
 for(const match of html.matchAll(/data-(?:series|select|overview-reading|overview-support-reading)="([A-Za-z0-9_,]+)"/g)){
  for(const id of match[1].split(','))if(catalog[id])ids.add(id);
 }
 for(const match of html.matchAll(/class="metric" href="#\/series\/([A-Za-z0-9_]+)"/g))ids.add(match[1]);
 for(const id of ids)if(catalog[id]?.agency)sourceIds.add(catalog[id].agency);
 const selected=Object.fromEntries([...sourceIds].filter(id=>sources[id]).map(id=>{
  const source=sources[id],shown=[...ids].filter(key=>catalog[key]?.agency===id);
  const all=['fiscal','refinancing','yields','auctions','ownership','macro','market','credit','research','vintages','release']
   .includes(state.page);
  const entries=Object.entries(source.series??{}).filter(([key])=>all||shown.includes(key));
  return [id,{...source,series:Object.fromEntries(entries)}];
 }));
 const calendarIds=new Set();
 if(state.page==='calendar'){
  const scope=calendarScope(state,{catalog,...(events?{events}:{})});
  for(const event of scope.filtered)calendarIds.add(event.sourceId);
 }
 for(const match of html.matchAll(/data-calendar-source="([A-Za-z0-9_-]+)"/g))calendarIds.add(match[1]);
 return {sources:selected,calendarSources:Object.fromEntries([...calendarIds].filter(id=>calendar?.sources?.[id])
  .map(id=>[id,calendar.sources[id]]))};
}
