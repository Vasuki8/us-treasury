import {normalizePreferences}from'./storage.js';
import {series}from'./data.js';
import {parseWorkspace,researchJsonCopy,researchByteLength,canonicalJson,deepFreeze}from'./research-workspaces.js';
export const MAX_RESEARCH_SETTINGS_BYTES=1024*1024;
function checked(value){
 if(!value||typeof value!=='object'||value.schema!=='meridian.research-settings'||value.version!==1||Object.keys(value).some(key=>!['schema','version','preferences','workspaces'].includes(key))||!value.preferences||!Array.isArray(value.workspaces)||value.workspaces.length>50)throw Error('Invalid research settings schema.');
 const allowed=['saved','watchlists','activeWatchlistId','density','theme','watchlistSort','watchlistGroup'];
 const p=value.preferences;
 if(typeof p!=='object'||Array.isArray(p)||Object.keys(p).length!==allowed.length||Object.keys(p).some(key=>!allowed.includes(key))||!['Light','Graphite'].includes(p.theme)||!['compact','comfortable'].includes(p.density)||!['manual','updated','next'].includes(p.watchlistSort)||typeof p.watchlistGroup!=='boolean')throw Error('Invalid research settings preferences.');
 if(!Array.isArray(p.watchlists)||!p.watchlists.length||p.watchlists.length>20)throw Error('Invalid research settings watchlists.');
 for(const row of p.watchlists)if(!row||typeof row!=='object'||Object.keys(row).length!==3||Object.keys(row).some(key=>!['id','name','saved'].includes(key)))throw Error('Invalid research settings watchlist.');
 for(const ids of [p.saved,...p.watchlists.map(row=>row.saved)])if(!Array.isArray(ids)||ids.some(id=>typeof id!=='string'||!Object.hasOwn(series,id)))throw Error('Unknown watchlist series in research settings.');
 const preferences=normalizePreferences(value.preferences);
 if(preferences.watchlists.length!==value.preferences.watchlists.length||!preferences.watchlists.some(row=>row.id===value.preferences.activeWatchlistId))throw Error('Invalid research settings watchlist identity.');
 if(canonicalJson(p.saved)!==canonicalJson(p.watchlists.find(row=>row.id===p.activeWatchlistId).saved))throw Error('Research settings active watchlist series mismatch.');
 const workspaces=value.workspaces.map(parseWorkspace);if(new Set(workspaces.map(row=>row.id)).size!==workspaces.length)throw Error('Duplicate saved view in research settings.');
 return deepFreeze({version:1,preferences,workspaces});
}
export function exportResearchSettings({preferences,workspaces=[]}){
 const{storageAvailable,...portable}=normalizePreferences(preferences),value={schema:'meridian.research-settings',version:1,preferences:portable,workspaces};checked(value);
 const text=canonicalJson(value);if(researchByteLength(text)>MAX_RESEARCH_SETTINGS_BYTES)throw Error('Research settings exceed the byte limit.');return text;
}
export function importResearchSettings(text){
 if(typeof text!=='string'||researchByteLength(text)>MAX_RESEARCH_SETTINGS_BYTES)throw Error('Research settings exceed the byte limit.');
 let value;try{value=JSON.parse(text.replace(/^\ufeff/,''));}catch{throw Error('Invalid research settings JSON.');}
 return checked(researchJsonCopy(value,{maxBytes:MAX_RESEARCH_SETTINGS_BYTES}));
}

/** Import copies conflicting IDs; it never replaces an existing list or view. */
export function mergeResearchSettings(currentPreferences,imported,currentWorkspaces=[]){
 if(!imported?.preferences)throw Error('Invalid research settings import.');
 const{storageAvailable,...portable}=imported.preferences;
 const incoming=checked({schema:'meridian.research-settings',...imported,preferences:portable}),current=normalizePreferences(currentPreferences),watchlists=[...current.watchlists],existing=currentWorkspaces.map(parseWorkspace),workspaces=[];
 const listIds=new Set([...watchlists,...incoming.preferences.watchlists].map(row=>row.id)),workspaceIds=new Set([...existing,...incoming.workspaces].map(row=>row.id));
 const fresh=ids=>{let id;do{id=globalThis.crypto.randomUUID();}while(ids.has(id));ids.add(id);return id;};
 let activeWatchlistId=current.activeWatchlistId;
 for(const row of incoming.preferences.watchlists){
  const prior=watchlists.find(item=>item.id===row.id);let next=row;
  if(prior&&canonicalJson(prior)!==canonicalJson(row))next={...row,id:fresh(listIds)};
  else if(!prior)listIds.add(row.id);
  if(!prior||next!==row)watchlists.push(next);
  if(row.id===incoming.preferences.activeWatchlistId)activeWatchlistId=next.id;
 }
 for(const row of incoming.workspaces){
  const prior=existing.find(item=>item.id===row.id);
  if(prior&&canonicalJson(prior)===canonicalJson(row))continue;
  const next=prior?parseWorkspace({...row,id:fresh(workspaceIds)}):row;workspaceIds.add(next.id);workspaces.push(next);
 }
 if(watchlists.length>20||existing.length+workspaces.length>50)throw Error('Research settings import exceeds the named watchlist or saved-view limit.');
 const active=watchlists.find(row=>row.id===activeWatchlistId),preferences=normalizePreferences({...incoming.preferences,watchlists,activeWatchlistId,saved:active.saved});
 return deepFreeze({preferences,workspaces});
}
