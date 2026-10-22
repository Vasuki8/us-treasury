const finite=value=>typeof value==='number'&&Number.isFinite(value);

/** Exact reference dates only: a neighboring observation is never substituted. */
export function cursorReadings(panels,date){
 return panels.map(panel=>{
  const row=panel.observations.find(item=>item.date===date);
  return {seriesId:panel.series.id,date,value:finite(row?.value)?row.value:null,status:!row?'no observation on this date':finite(row.value)?'observed':'explicit missing value'};
 });
}

export function createLinkedCursor(panels){
 const dates=Object.freeze([...new Set(panels.flatMap(panel=>panel.observations.map(row=>row.date)))].sort()),listeners=new Set();
 let date=dates.at(-1)??null;
 function select(next,{announce=false,origin=null}={}){
  if(!dates.includes(next))throw new RangeError('Select an available reference date.');
  date=next;for(const listener of listeners)listener({date,announce,origin});
 }
 return {
  dates,get date(){return date;},select,
  move(direction,options){
   if(!dates.length)return;
   const index=direction==='home'?0:direction==='end'?dates.length-1:Math.max(0,Math.min(dates.length-1,dates.indexOf(date)+direction));
   select(dates[index],options);
  },
  subscribe(listener){listeners.add(listener);listener({date,announce:false,origin:null});return()=>listeners.delete(listener);},
 };
}
