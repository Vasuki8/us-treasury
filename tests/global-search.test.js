import test from 'node:test';
import assert from 'node:assert/strict';
import {series} from '../src/data.js';
import {defaults} from '../src/router.js';
import {explorePage} from '../src/explore-page.js';

let search;
try {search=await import('../src/global-search.js');} catch(error) {if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const run=(...args)=>{assert.ok(search,'Grouped search module must exist');return search.globalSearch(...args);};
const catalog=Object.values(series);
const events=[{id:'cpi-nov',name:'Consumer Price Index',sourceId:'bls',program:'consumer-price-index',agency:'BLS',topic:'Prices',date:'2026-11-10',time:'08:30',seriesIds:['cpi'],periodLabel:'October 2026'},{id:'debt-nov',name:'Debt to the Penny',sourceId:'treasury',agency:'Treasury',topic:'Fiscal',date:'2026-11-02',seriesIds:['debt']}];
const library={workspaces:[{id:'view-1',name:'Inflation watch <saved>',state:{page:'macroCoverage',macroFamily:'prices',selected:['cpi']},createdAt:'2026-10-23T00:00:00.000Z'}],packages:[{id:'pin-1',name:'Inflation frozen',request:{ids:['cpi']},resolvedWindow:{label:'2026'},createdAt:'2026-10-23T00:00:00.000Z'}]};

test('global search distinguishes pages, ranked indicators, schedules and saved research',()=>{
 const result=run('inflation',{catalog,events,library});
 assert.ok(result.pages.some(row=>row.href==='#/economy?family=prices'));
 assert.ok(result.indicators.some(row=>row.id==='cpi'));
 assert.ok(result.research.some(row=>row.kind==='workspace'&&row.id==='view-1'));
 assert.ok(result.research.some(row=>row.kind==='package'&&row.href==='#/research?view=packages&package=pin-1'));
 const cpi=run('CPI',{catalog,events,library});
 assert.equal(cpi.indicators[0].id,'cpi');
 assert.match(cpi.events[0].href,/month=2026-11/);
 assert.match(cpi.events[0].href,/event=cpi-nov/);
 assert.match(run('debt to the penny',{catalog,events}).events[0].href,/scope=treasury/);
});

test('exact indicator resolution is case insensitive and does not resolve loose or ambiguous matches',()=>{
 assert.ok(search,'Grouped search module must exist');
 assert.equal(search.exactIndicatorMatch(' UNRATE ',catalog)?.id,'unrate');
 assert.equal(search.exactIndicatorMatch('LNS14000000',catalog)?.id,'unrate');
 assert.equal(search.exactIndicatorMatch('LNS14000000',[...catalog].reverse())?.id,'unrate','the declared U3 canonical identity does not depend on catalog insertion order');
 assert.equal(search.exactIndicatorMatch('u3RateDesk',catalog)?.id,'u3RateDesk','the separate source identity remains directly addressable');
 assert.equal(search.exactIndicatorMatch('jobs',catalog),null);
 assert.equal(search.exactIndicatorMatch('shared',[{id:'one',code:'shared'},{id:'two',code:'shared'}]),null);
 assert.equal(search.exactIndicatorMatch('one',[{id:'one',code:'shared'},{id:'two',code:'one'}])?.id,'one');
});

test('search results retain meaning without implying publication and escape local labels',()=>{
 const result=run('inflation',{catalog,events,library});
 const html=search.globalSearchPanel(result);
 for(const label of ['Pages','Indicators','Scheduled events','Saved research'])assert.ok(html.includes(label),label);
 assert.match(html,/Inflation watch &lt;saved&gt;/);
 assert.match(html,/data-open-workspace="view-1"/);
 assert.match(html,/Frozen values/);
 assert.doesNotMatch(html,/Inflation watch <saved>|RELEASED/);
 assert.equal(search.globalSearchPanel(run('  ',{catalog,events,library})), '');
});

test('Explore renders supplementary global results and one full indicator catalog',()=>{
 const html=explorePage({...defaults,page:'explore',query:'inflation',saved:[]},{library,events});
 assert.match(html,/aria-label="Search across the workspace"/);
 assert.match(html,/data-open-workspace="view-1"/);
 assert.match(html,/Search everything/);
 assert.equal((html.match(/class="catalog-table"/g)||[]).length,1);
 assert.doesNotMatch(html,/aria-label="Indicator search results"/,'the full catalog already contains the indicator matches');
});

test('scheduled matches put upcoming dates first and recent past dates second, preserving basis',()=>{
 const events=[
  {id:'old',name:'Claims',date:'2025-01-30',sourceId:'dol',scheduleBasis:'listed-date'},
  {id:'recent',name:'Claims',date:'2026-10-22',sourceId:'dol',scheduleBasis:'published-exception'},
  {id:'next',name:'Claims',date:'2026-10-29',sourceId:'dol',scheduleBasis:'recurring-rule'},
  {id:'later',name:'Claims',date:'2026-11-05',sourceId:'dol',scheduleBasis:'calendar-estimate'},
 ];
 const result=run('claims',{events,now:new Date('2026-10-23T01:00:00Z')});
 // It is still Oct 22 in New York: that day's schedule remains in the current-day group.
 assert.deepEqual(result.events.map(row=>row.id),['recent','next','later','old']);
 const nextDay=run('claims',{events,now:new Date('2026-10-23T12:00:00Z')});
 assert.deepEqual(nextDay.events.map(row=>row.id),['next','later','recent','old']);
 const html=search.globalSearchPanel(nextDay);
 for(const basis of ['Agency rule','Agency exception','Listed date','Estimated'])assert.ok(html.includes(basis),basis);
 assert.match(html,/Earlier schedule/);
 assert.match(html,/Schedule only/);
});
