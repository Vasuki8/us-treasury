import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor,safeReturnTo} from '../src/router.js';
import * as context from '../src/workspace-context.js';

test('indicator release publication journeys retain an immediate origin and bounded return chain',()=>{
 assert.equal(typeof context.contextualHref,'function');
 const origin=parseRoute('#/series/cpi?tab=methodology&window=custom&start=2025-01-01&end=2026-09-01');
 const release=parseRoute(context.contextualHref({page:'release',publicationSeries:'cpi',publicationPeriod:'2026-09-01'},origin));
 assert.equal(context.workspaceReturn(release).href,routeFor(origin));
 const publication=parseRoute(context.contextualHref({page:'research',researchView:'publications'},release));
 assert.equal(context.workspaceReturn(publication).href,routeFor(release));
 const backRelease=parseRoute(context.workspaceReturn(publication).href),backIndicator=parseRoute(context.workspaceReturn(backRelease).href);
 for(const key of ['seriesId','tab','window','startDate','endDate'])assert.equal(backIndicator[key],origin[key]);
 let state=origin;for(let i=0;i<20;i++)state=parseRoute(context.contextualHref({page:i%2?'release':'research',researchView:'publications'},state));
 assert.ok(routeFor(state).length<4000);
 for(const unsafe of ['#/series/missing','#/research/evil','#/release/evil','#/series/cpi?return=https%3A%2F%2Fevil.example']){
  if(unsafe.startsWith('#/series/cpi?'))assert.equal(parseRoute(safeReturnTo(unsafe)).returnTo,null);else assert.equal(safeReturnTo(unsafe),null);
 }
});

test('release and publication scroll positions are recalled independently from their source indicator',()=>{
 const memory=context.createWorkspaceMemory();
 for(const state of [parseRoute('#/series/cpi?tab=methodology'),parseRoute('#/release?publicationSeries=cpi&period=2026-09-01'),parseRoute('#/research?view=publications&publicationSeries=cpi&period=2026-09-01')]){
  memory.remember(state,{top:430,left:0,focusHref:'#/overview'});
  assert.equal(memory.recall(parseRoute(routeFor(state))).top,430);
 }
});

test('auction list browsing page round trips separately from explicit auction selection',()=>{
 const state=parseRoute('#/auctions?auction=selected-auction&historyPage=3');
 assert.equal(state.auctionHistoryPage,3);assert.equal(state.auctionId,'selected-auction');
 const again=parseRoute(routeFor(state));assert.equal(again.auctionHistoryPage,3);assert.equal(again.auctionId,'selected-auction');
 assert.equal(parseRoute('#/auctions?historyPage=-2').auctionHistoryPage,null);
});

test('changing a comparison selection retains evidence return origins and their configuration',()=>{
 const origin=parseRoute('#/series/cpi?tab=methodology&window=custom&start=2025-01-01&end=2026-09-01');
 const release=parseRoute(context.contextualHref({page:'release',publicationSeries:'cpi',publicationPeriod:'2026-09-01'},origin));
 const publication=parseRoute(context.contextualHref({page:'research',researchView:'publications'},release));
 const changed=parseRoute(context.updateWorkspaceSelection(routeFor(publication),['cpi','unrate']));
 const backRelease=parseRoute(context.workspaceReturn(changed).href),backIndicator=parseRoute(context.workspaceReturn(backRelease).href);
 assert.equal(backIndicator.tab,'methodology');assert.equal(backIndicator.startDate,'2025-01-01');assert.deepEqual(backIndicator.selected,['cpi','unrate']);
});
