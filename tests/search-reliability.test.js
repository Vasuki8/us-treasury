import test from 'node:test';
import assert from 'node:assert/strict';
import {globalSearch,globalSearchPanel} from '../src/global-search.js';
import {searchSeries,groupSearchMeasurements} from '../src/search.js';
import {series} from '../src/data.js';
import {watchlistMonitor} from '../src/watchlist-monitor.js';
test('exact and canonical headline search outranks loose source evidence',()=>{
 for(const [query,id] of [['unrate','unrate'],['CPI','cpi'],['gdp','gdp'],['unemployment rate','unrate']])assert.equal(searchSeries(Object.values(series),{query})[0].id,id);
 const grouped=groupSearchMeasurements([series.gdp,series.gdpTotalContribution]);
 assert.equal(grouped.length,1);assert.equal(grouped[0].primary.id,'gdp');assert.equal(grouped[0].variants[0].id,'gdpTotalContribution');
});
test('secondary search groups omit empties, collapse, and expose every matching event',()=>{
 const events=Array.from({length:20},(_,i)=>({id:`event${i}`,name:'Payroll release',date:`2026-10-${String(i+1).padStart(2,'0')}`,sourceId:'bls',program:'employment-situation'}));
 const result=globalSearch('payroll',{events,now:new Date('2026-10-10T00:00:00Z')});
 const html=globalSearchPanel(result);
 assert.match(html,/details/);assert.match(html,/event19/);assert.doesNotMatch(html,/first 8|No matches/);assert.match(html,/Past|Earlier/);assert.match(html,/Upcoming/);
});
test('FOMC minutes are a catalyst, never a next measurement release',()=>{
 const events=[{id:'minutes',sourceId:'fomc',program:'fomc-minutes',seriesId:'policyTargetUpper',date:'2026-10-29',name:'Minutes'},{id:'decision',sourceId:'fomc',program:'fomc-decision',seriesId:'policyTargetUpper',date:'2026-11-05',name:'Decision'}];
 const rows=watchlistMonitor(['policyTargetUpper','effr'],{catalog:series,events,now:new Date('2026-10-27T12:00:00Z')});
 assert.equal(rows[0].nextEvent.id,'decision');assert.equal(rows[0].nextCatalyst.id,'minutes');assert.equal(rows[1].nextEvent,null);assert.equal(rows[1].nextCatalyst.id,'decision');
});
