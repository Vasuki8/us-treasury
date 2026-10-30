import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,parseRoute,routeFor,safeReturnTo} from '../src/router.js';
import {calendarScope,revealedCalendarState} from '../src/calendar-scope.js';
import {renderPage} from '../src/pages.js';
import {readFile} from 'node:fs/promises';
import {getSeries} from '../src/model.js';
import {indicatorHref,workspaceReturn} from '../src/workspace-context.js';
import {createWorkspace,openWorkspace} from '../src/research-workspaces.js';
import {calendarPage} from '../src/calendar-page.js';
import {releases} from '../src/data.js';

const now=new Date('2026-10-23T12:00:00Z');
const events=[
 {id:'debt',date:'2026-10-23',sourceId:'treasury',topic:'Fiscal',seriesId:'debt'},
 {id:'jobs',date:'2026-10-24',sourceId:'bls',topic:'Labor',seriesId:'payroll'},
 {id:'fed',date:'2026-10-25',sourceId:'fomc',topic:'Rates',seriesId:'effr'},
];
test('calendar defaults classify macro and Treasury without removing complete coverage',()=>{
 const macro=calendarScope(defaults,{events,now});
 assert.equal(macro.view,'macro');assert.deepEqual(macro.filtered.map(e=>e.id),['jobs','fed']);
 const treasury=calendarScope({...defaults,calendarView:'treasury'},{events,now});
 assert.deepEqual(treasury.filtered.map(e=>e.id),['debt']);
 const all=calendarScope({...defaults,calendarView:'all'},{events,now});
 assert.equal(all.filtered.length,macro.filtered.length+treasury.filtered.length);
 assert.equal(all.windowEvents.length,3);
});
test('calendar scope intersects filters but explicit event links reveal their correct view',()=>{
 const linked=calendarScope({...defaults,eventId:'debt'},{events,now});
 assert.equal(linked.view,'treasury');assert.equal(linked.selected.id,'debt');assert.equal(linked.revealed,true);
 const filtered=calendarScope({...defaults,calendarView:'macro',calendarTopic:'Labor'},{events,now});
 assert.deepEqual(filtered.filtered.map(e=>e.id),['jobs']);
 assert.equal(calendarScope({...defaults,calendarView:'macro',watchOnly:true,saved:[]},{events,now}).filtered.length,0);
 const stale=calendarScope({...defaults,eventId:'debt',calendarTopic:'Labor'},{events,now});
 assert.equal(stale.view,'macro');assert.equal(stale.selected.id,'jobs');assert.equal(stale.revealed,false);
});
test('auto-revealed legacy calendar scope persists into subsequent filters',()=>{
 const state=revealedCalendarState({...defaults,page:'calendar',eventId:'debt'},{events,now});
 assert.equal(state.calendarView,'treasury');
 assert.equal(calendarScope({...state,eventId:'',day:'all'},{events,now}).view,'treasury');
});
test('freshness measurement links preserve Labor and external section context',()=>{
 for(const route of ['#/economy/labor?measure=weeklyHours&group=pay&window=all','#/economy?family=external&measure=currentAccount&section=methods&window=all']){
  const state=parseRoute(route),html=renderPage(state),fresh=html.slice(html.lastIndexOf('<details class="supporting-details">'));
  const href=fresh.match(/href="(#\/series\/[^"]+)"/)?.[1];assert.ok(href);
  const detail=parseRoute(href.replaceAll('&amp;','&'));assert.equal(workspaceReturn(detail)?.href,routeFor(state));
 }
});
test('calendar and current-account sections round-trip through routes and saved workspaces',()=>{
 for(const calendarView of ['macro','treasury','all']){
  const state={...defaults,page:'calendar',calendarView};assert.equal(parseRoute(routeFor(state)).calendarView,calendarView);
  assert.equal(openWorkspace(createWorkspace({id:'view-one',name:'View',state})).calendarView,calendarView);
 }
 for(const externalView of ['summary','trends','decomposition','methods']){
  const state={...defaults,page:'macroCoverage',macroFamily:'external',macroMeasure:'currentAccount',externalView,window:'all'};
  const restored=parseRoute(routeFor(state));assert.equal(restored.externalView,externalView);assert.equal(restored.window,'all');
  assert.equal(openWorkspace(createWorkspace({id:'view-one',name:'View',state})).externalView,externalView);
 }
 assert.equal(parseRoute('#/calendar?scope=unknown').calendarView,'macro');
 assert.equal(parseRoute('#/economy?family=external&section=unknown').externalView,'summary');
});
test('calendar exposes compact scope controls and explains retained Treasury coverage',()=>{
 const html=calendarPage({...defaults,saved:[]});
 assert.match(html,/id="calendar-scope"/);assert.match(html,/Macro releases/);assert.match(html,/Treasury &amp; funding/);
 assert.match(html,/All events/);assert.match(html,/data-page-disclosure="calendar:context"/);
});
test('selected calendar indicator preserves Treasury filters and exact event on return',()=>{
 const event=releases.find(item=>item.sourceId==='treasury');assert.ok(event);
 const state={...defaults,page:'calendar',calendarView:'treasury',calendarMonth:event.date.slice(0,7),day:event.date,eventId:event.id,calendarTopic:'Fiscal',watchOnly:true,saved:['debt']};
 const html=calendarPage(state),href=html.match(/href="(#\/series\/debt[^"]*)"/)?.[1];assert.ok(href);
 const detail=parseRoute(href.replaceAll('&amp;','&')),back=workspaceReturn(detail);assert.ok(back);
 assert.equal(back.label,'Back to Calendar');
 const returned=parseRoute(back.href);for(const key of ['calendarView','calendarMonth','day','eventId','calendarTopic','watchOnly'])assert.equal(returned[key],state[key]);
});
test('specialist comparison and indicator returns retain scenarios, windows and at most one origin',()=>{
 for(const origin of ['#/fiscal?window=all','#/refinancing?horizon=24&shock=200&window=custom&start=2025-01-01&end=2026-01-01','#/yields?curveA=2026-01-02&curveB=2026-02-02','#/auctions?type=Bill&auction=test']){
  assert.equal(safeReturnTo(origin),origin);
  const state=parseRoute(origin),compare={...state,page:'explore',exploreMode:'compare',returnTo:routeFor(state)};
  const detail=parseRoute(indicatorHref('unrate',compare));
  const returned=parseRoute(workspaceReturn(detail).href);
  assert.equal(returned.returnTo,routeFor(state));
  assert.equal(workspaceReturn(returned).href,routeFor(state));
 }
 assert.equal(safeReturnTo('#/fiscalevil'),null);
 assert.equal(safeReturnTo('#/refinancing?return=%23%2Fexplore'),'#/refinancing');
 assert.match(workspaceReturn({returnTo:'#/fiscal'}).label,/Fiscal/);
});
test('actual selected-series button keeps the comparison and its specialist origin',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const handler=/root\.addEventListener\('click',async event=>\{([^]*?)\n\}\);/.exec(source);assert.ok(handler);
 const state={...parseRoute('#/explore?mode=compare&window=all&selected=receiptsTtm,outlaysTtm,netInterestTtm'),returnTo:'#/fiscal?window=all'};
 let patch;const button={dataset:{series:'receiptsTtm'},disabled:false};
 await new Function('state','getSeries','parseRoute','indicatorHref','navigate',`return async event=>{${handler[1]}}`)(state,getSeries,parseRoute,indicatorHref,value=>{patch=value;})({target:{closest:()=>button}});
 assert.equal(patch.returnTo,routeFor(state));
 const comparison=parseRoute(workspaceReturn({...state,...patch}).href);assert.equal(workspaceReturn(comparison).href,'#/fiscal?window=all');
});
