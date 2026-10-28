import {series} from './data.js';
const key='meridian.preferences.v1';
const validSaved=values=>[...new Set(Array.isArray(values)?values:[])].filter(id=>typeof id==='string'&&Object.hasOwn(series,id));
function watchlist(value,{strict=false}={}){
 if(!value||typeof value!=='object'||typeof value.id!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(value.id)||typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>80||/[\u0000-\u001f\u007f]/.test(value.name)||!Array.isArray(value.saved))throw Error('Invalid named watchlist.');
 if(strict&&value.saved.some(id=>typeof id!=='string'||!Object.hasOwn(series,id)))throw Error('Unknown watchlist series.');
 return{id:value.id,name:value.name.trim(),saved:validSaved(value.saved)};
}
export function normalizePreferences(input={}){
 const data=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
 const seen=new Set(),watchlists=[];
 for(const row of (Array.isArray(data.watchlists)?data.watchlists:[]).slice(0,20))try{const value=watchlist(row);if(!seen.has(value.id)){seen.add(value.id);watchlists.push(value);}}catch{}
 if(!watchlists.length)watchlists.push({id:'default',name:'My watchlist',saved:validSaved(data.saved)});
 const activeWatchlistId=watchlists.some(row=>row.id===data.activeWatchlistId)?data.activeWatchlistId:watchlists[0].id;
 // `saved` remains the compatibility alias used by save/remove/reorder controls.
 if(Array.isArray(data.saved))watchlists.find(row=>row.id===activeWatchlistId).saved=validSaved(data.saved);
 return{saved:[...watchlists.find(row=>row.id===activeWatchlistId).saved],watchlists,activeWatchlistId,density:data.density==='comfortable'?'comfortable':'compact',theme:['Graphite','Midnight'].includes(data.theme)?'Graphite':'Light',storageAvailable:data.storageAvailable!==false,watchlistSort:['updated','next'].includes(data.watchlistSort)?data.watchlistSort:'manual',watchlistGroup:data.watchlistGroup===true};
}
export function readPreferences(storage){
 try{if(!storage)return{...normalizePreferences(),storageAvailable:false};return normalizePreferences(JSON.parse(storage.getItem(key)||'{}'));}
 catch(error){return{...normalizePreferences(),storageAvailable:error instanceof SyntaxError};}
}
export function writePreferences(storage,preferences){
 try{if(!storage)return false;const{storageAvailable,...value}=normalizePreferences(preferences);storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
}
export function saveNamedWatchlist(preferences,input){
 const current=normalizePreferences(preferences),record=watchlist(input,{strict:true}),index=current.watchlists.findIndex(row=>row.id===record.id);
 if(index<0&&current.watchlists.length>=20)throw Error('Named watchlist limit reached.');
 return normalizePreferences({...current,watchlists:index<0?[...current.watchlists,record]:current.watchlists.map((row,at)=>at===index?record:row),activeWatchlistId:record.id,saved:record.saved});
}
export function selectNamedWatchlist(preferences,id){
 const current=normalizePreferences(preferences),record=current.watchlists.find(row=>row.id===id);if(!record)throw Error('Named watchlist unavailable.');
 return normalizePreferences({...current,activeWatchlistId:id,saved:record.saved});
}
export function removeNamedWatchlist(preferences,id){
 const current=normalizePreferences(preferences);if(!current.watchlists.some(row=>row.id===id))throw Error('Named watchlist unavailable.');
 const remaining=current.watchlists.filter(row=>row.id!==id);if(!remaining.length)throw Error('Keep at least one named watchlist.');
 const active=remaining.find(row=>row.id===current.activeWatchlistId)??remaining[0];return normalizePreferences({...current,watchlists:remaining,activeWatchlistId:active.id,saved:active.saved});
}
