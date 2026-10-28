import test from'node:test';import assert from'node:assert/strict';
import * as storage from'../src/storage.js';
import * as workspaceApi from'../src/research-workspaces.js';
const {createWorkspace}=workspaceApi;
const workspaceSummary=record=>{assert.equal(typeof workspaceApi.workspaceSummary,'function','saved views need page-aware summaries');return workspaceApi.workspaceSummary(record);};
let settings;try{settings=await import('../src/research-settings.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const now='2026-10-22T15:00:00.000Z';
test('legacy saved IDs become an ordered named watchlist and independent lists preserve selection and order',()=>{
 const first=storage.readPreferences({getItem:()=>JSON.stringify({saved:['sofr','gdp','sofr','invalid'],theme:'Graphite'})});
 assert.deepEqual(first.watchlists,[{id:'default',name:'My watchlist',saved:['sofr','gdp']}]);
 const next=storage.saveNamedWatchlist(first,{id:'inflation',name:'Inflation',saved:['cpiCore','cpi']});
 assert.equal(next.activeWatchlistId,'inflation');assert.deepEqual(next.saved,['cpiCore','cpi']);
 const prior=storage.selectNamedWatchlist(next,'default');assert.deepEqual(prior.saved,['sofr','gdp']);assert.deepEqual(next.saved,['cpiCore','cpi']);
 let raw;storage.writePreferences({setItem:(key,text)=>{raw=text;}},{...prior,saved:['gdp','sofr']});
 const reopened=storage.readPreferences({getItem:()=>raw});assert.deepEqual(reopened.watchlists[0].saved,['gdp','sofr']);assert.equal(reopened.watchlists[1].name,'Inflation');
 assert.throws(()=>storage.saveNamedWatchlist(prior,{id:'bad',name:'Bad',saved:['unknown']}),/series|watchlist/i);
});
test('settings export roundtrips lightweight preferences and saved views without frozen data',()=>{
 assert.ok(settings);const preferences=storage.saveNamedWatchlist(storage.readPreferences(),{id:'rates',name:'Rates',saved:['effr','sofr']}),workspace=createWorkspace({id:'saved-view',name:'Curves',now,state:{page:'yields',yieldDateA:'2026-01-02',yieldDateB:'2026-10-01'}});
 const text=settings.exportResearchSettings({preferences,workspaces:[workspace]}),restored=settings.importResearchSettings(text);
 assert.deepEqual(restored.preferences.saved,['effr','sofr']);assert.deepEqual(restored.preferences.watchlists,preferences.watchlists);assert.equal(restored.workspaces[0].state.yieldDateB,'2026-10-01');
 assert.equal(text.includes('observations'),false);assert.equal(text.includes('checksum'),false);
 const value=JSON.parse(text);value.packages=[];assert.throws(()=>settings.importResearchSettings(JSON.stringify(value)),/settings|schema/i);
 value.preferences.saved=['javascript:bad'];delete value.packages;assert.throws(()=>settings.importResearchSettings(JSON.stringify(value)),/series|watchlist/i);
 assert.throws(()=>settings.importResearchSettings('x'.repeat(1024*1024+1)),/byte|limit/i);
});
test('saved-view summaries use page-specific controls instead of unrelated default selected series',()=>{
 assert.match(workspaceSummary(createWorkspace({name:'Curve study',now,state:{page:'yields',yieldDateA:'2026-01-02',yieldDateB:'2026-10-01'}})),/Rates.*2026-01-02.*2026-10-01/i);
 assert.match(workspaceSummary(createWorkspace({name:'Auction study',now,state:{page:'auctions',auctionType:'TIPS',auctionId:'auction-123'}})),/Auction.*TIPS.*auction-123/i);
 assert.match(workspaceSummary(createWorkspace({name:'Risk study',now,state:{page:'refinancing',refinancingHorizon:24,refinancingShock:200}})),/24 months.*200 bp/i);
 assert.doesNotMatch(workspaceSummary(createWorkspace({name:'Economy',now,state:{page:'macroCoverage',macroFamily:'external',externalView:'decomposition'}})),/unrate|cpi/i);
});

test('settings imports copy conflicting IDs and preserve original lists and views',()=>{
 assert.ok(settings);assert.equal(typeof settings.mergeResearchSettings,'function');
 const preferences=storage.saveNamedWatchlist(storage.readPreferences(),{id:'rates',name:'Rates',saved:['sofr','effr']}),view=createWorkspace({id:'shared-view',name:'Original view',now,state:{page:'yields'}});
 const incoming=settings.importResearchSettings(settings.exportResearchSettings({preferences:storage.saveNamedWatchlist(preferences,{id:'rates',name:'Imported rates',saved:['yield']}),workspaces:[{...view,name:'Imported view'}]}));
 const merged=settings.mergeResearchSettings(preferences,incoming,[view]);
 assert.deepEqual(merged.preferences.watchlists.find(row=>row.id==='rates').saved,['sofr','effr']);
 const copied=merged.preferences.watchlists.find(row=>row.name==='Imported rates');assert.ok(copied);assert.notEqual(copied.id,'rates');assert.deepEqual(copied.saved,['yield']);
 assert.equal(merged.preferences.activeWatchlistId,copied.id);assert.equal(merged.workspaces.length,1);assert.notEqual(merged.workspaces[0].id,'shared-view');assert.equal(merged.workspaces[0].name,'Imported view');
 assert.equal(view.name,'Original view');assert.deepEqual(preferences.saved,['sofr','effr']);
 const identical=settings.mergeResearchSettings(preferences,settings.importResearchSettings(settings.exportResearchSettings({preferences,workspaces:[view]})),[view]);
 assert.equal(identical.workspaces.length,0);assert.equal(identical.preferences.watchlists.length,preferences.watchlists.length);
});
