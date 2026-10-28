import test from 'node:test';
import assert from 'node:assert/strict';
import {auctionResultState,auctionResultCoverage} from '../src/auctions.js';
import {contractualMaturityLadder,summarizeRefinancing} from '../src/refinancing.js';
import {yieldComparisonShortcuts,selectedYieldChanges,yieldEventComparisons} from '../src/yields.js';
import {refinancingPage} from '../src/refinancing-page.js';
import {yieldsPage} from '../src/yields-page.js';

test('auction states separate Eastern elapsed dates from partial and complete retained results',()=>{
  const announced={auctionDate:'2026-10-27',status:'announced',securityType:'Bill'};
  const options={asOf:'2026-10-27'};
  assert.equal(auctionResultState(announced,options).status,'announced');
  assert.equal(auctionResultState({...announced,auctionDate:'2026-10-28'},options).status,'announced');
  assert.equal(auctionResultState({...announced,auctionDate:'2026-10-26'},options).status,'missing');
  const partial={...announced,status:'results',bidToCover:2,highDiscountRate:4,offeringAmount:100,competitiveAccepted:100,primaryDealerAccepted:20,directAccepted:null,indirectAccepted:70};
  assert.equal(auctionResultState(partial,options).status,'incomplete');
  const verified={...partial,directAccepted:10,auctionDate:'2026-10-23'};
  assert.equal(auctionResultState(verified,options).status,'verified');
  const coverage=auctionResultCoverage({auctions:[announced,partial,verified,{...announced,auctionDate:'2026-10-26'}]},options);
  assert.equal(coverage.latestVerifiedDate,'2026-10-23');
  assert.equal(coverage.latestReportedDate,'2026-10-27');
  assert.deepEqual(coverage.counts,{verified:1,incomplete:1,missing:1,announced:1});
  assert.throws(()=>auctionResultState(announced,{asOf:'2026-02-30'}),/date/);
});

test('monthly contractual ladder conserves cumulative exposure, includes boundary dates and leaves FRN resets outside it',()=>{
  const source={asOf:'2023-11-30',securities:[
    {securityId:'meridian-00000000000000000001',type:'Bill',principal:10,maturityDate:'2023-12-31'},
    {securityId:'meridian-00000000000000000002',type:'FRN',principal:20,maturityDate:'2024-02-29'},
    {securityId:'meridian-00000000000000000003',type:'Note',principal:30,maturityDate:'2024-11-30'},
    {securityId:'meridian-00000000000000000004',type:'Bond',principal:40,maturityDate:'2025-12-01'},
  ]};
  const ladder=contractualMaturityLadder(source);
  assert.equal(ladder.length,24);assert.equal(ladder[0].startDate,'2023-12-01');
  assert.equal(ladder[1].principal,0);assert.equal(ladder[2].endDate,'2024-02-29');assert.equal(ladder[2].principal,20);
  assert.equal(ladder[11].cumulativePrincipal,60);assert.equal(ladder[23].cumulativePrincipal,60);
  assert.deepEqual(ladder[2].byType.find(row=>row.type==='FRN'),{type:'FRN',principal:20});
  assert.equal(ladder[11].cumulativePrincipal,summarizeRefinancing(source).maturing.find(row=>row.months===12).principal);
  assert.deepEqual(contractualMaturityLadder({}),[]);
  const html=refinancingPage({},source);
  assert.match(html,/Principal maturing within 12 months/);assert.match(html,/Share maturing within 12 months/);
  assert.match(html,/MONTHLY CONTRACTUAL MATURITY LADDER/);assert.match(html,/INCREMENTAL INTEREST COST WITHIN HORIZON/);
});

test('rate shortcuts use calendar targets without choosing a later observation and keep missing YTD explicit',()=>{
  const source={curveHistory:['2025-12-31','2026-02-27','2026-03-20','2026-03-26','2026-03-27','2026-03-30','2026-03-31'].map(date=>({date}))};
  const shortcuts=yieldComparisonShortcuts(source,'2026-03-31');
  assert.deepEqual(shortcuts.map(({label,dateB})=>({label,dateB})),[{label:'1D',dateB:'2026-03-30'},{label:'1W',dateB:'2026-03-20'},{label:'1M',dateB:'2026-02-27'},{label:'YTD',dateB:'2025-12-31'}]);
  assert.equal(shortcuts.find(row=>row.label==='1M').targetDate,'2026-02-28');
  assert.equal(yieldComparisonShortcuts({curveHistory:source.curveHistory.slice(1)},'2026-03-31').find(row=>row.label==='YTD').dateB,null);
  assert.deepEqual(yieldComparisonShortcuts(source,'2026-03-29'),[]);
});

test('selected nominal, real and compensation changes share dates, preserve missing inputs and reconcile in basis points',()=>{
  const source={curveHistory:[{date:'2026-10-26',nominal:{'10Y':4},real:{'10Y':2}},{date:'2026-10-27',nominal:{'10Y':4.1},real:{'10Y':2.04}}]};
  const comparison=selectedYieldChanges(source,'2026-10-27','2026-10-26');
  assert.equal(comparison.nominal.changeBps,10);assert.equal(comparison.real.changeBps,4);assert.equal(comparison.inflationCompensation.changeBps,6);
  assert.equal(selectedYieldChanges(source,'2026-10-27','2026-10-25').nominal.changeBps,null);
  source.curveHistory[0].real['10Y']=null;
  assert.equal(selectedYieldChanges(source,'2026-10-27','2026-10-26').inflationCompensation.changeBps,null);
  const html=yieldsPage({yieldDateA:'2026-10-27',yieldDateB:'2026-10-26'},source);
  assert.match(html,/data-yield-shortcut/);assert.match(html,/SELECTED NOMINAL \/ REAL \/ COMPENSATION CHANGES/);
  assert.match(html,/Current retained rate context/);
  const events=yieldEventComparisons(source,[{sourceId:'fomc',program:'fomc-decision',date:'2026-10-27',sourceUrl:'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm'}]);
  assert.equal(events[0].dateB,'2026-10-26');assert.match(events[0].basis,/does not verify/);
});
