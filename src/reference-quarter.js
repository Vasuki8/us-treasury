import {isIsoDate} from './date-window.js';

/** A reference-period key, never a substituted observation or survey round. */
export function referenceQuarter(series,observation){
 const date=observation?.date;
 if(series.frequency!=='Quarterly'||!['quarter-start','quarter-end'].includes(series.dateConvention)||!isIsoDate(date))throw new Error(`${series.name}: reference-quarter alignment requires Quarterly observations with a declared quarter-start or quarter-end convention. Survey rounds cannot be remapped.`);
 const year=Number(date.slice(0,4)),month=Number(date.slice(5,7)),quarter=Math.floor((month-1)/3)+1;
 const expected=series.dateConvention==='quarter-start'?`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`:new Date(Date.UTC(year,quarter*3,0)).toISOString().slice(0,10);
 if(date!==expected)throw new Error(`${series.name}: ${date} does not match its declared ${series.dateConvention} reference convention.`);
 return `${year}Q${quarter}`;
}
export function quarterObservationMap(panel){
 const map=new Map();
 for(const observation of panel.observations){const key=referenceQuarter(panel.series,observation);if(map.has(key))throw new Error(`${panel.series.name}: duplicate observations in reference quarter ${key}.`);map.set(key,observation);}
 return map;
}
