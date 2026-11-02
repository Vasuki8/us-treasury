import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor,defaults} from '../src/router.js';
import {createWorkspace,openWorkspace} from '../src/research-workspaces.js';
import {laborPage} from '../src/labor-page.js';
import {requiredSourceIds} from '../src/source-controller.js';
import {getSeries,toCsv} from '../src/model.js';
import {readFile} from 'node:fs/promises';
import {destinationChanged,entryWindow,normalizedIndicatorView} from '../src/router.js';
import {renderPage} from '../src/pages.js';
import {dataStatus} from '../src/data.js';

test('retained chart modes and range controls survive routes and saved views',()=>{
 for(const input of [
  {page:'indicator',seriesId:'cpi',indicatorView:'cpi-monthly'},
  {page:'auctions',auctionView:'allocations',auctionRange:36},
  {page:'ownership',ownershipView:'top-holders',ownershipRange:'6m'},
 ]){
  const restored=parseRoute(routeFor(input)),workspace=openWorkspace(createWorkspace({id:'retained-view',name:'Retained view',state:input}));
  for(const key of Object.keys(input)){assert.equal(restored[key],input[key],key);assert.equal(workspace[key],input[key],key+' saved');}
 }
 assert.equal(parseRoute('#/series/cpi?chartView=eci-quarterly').indicatorView,'');
 assert.equal(parseRoute('#/series/cpi?chartView=%3Cscript%3E').indicatorView,'');
 assert.equal(parseRoute('#/auctions?auctionView=tail&auctionRange=99999').auctionView,'bid-to-cover');
 assert.equal(parseRoute('#/auctions?auctionRange=99999').auctionRange,12);
 assert.equal(parseRoute('#/ownership?ownershipView=bogus&ownershipRange=forever').ownershipRange,'all');
});

test('actual ownership page renders the routed TIC view and retained range',()=>{
 const before=dataStatus.sources.ticHolders;
 const months=Array.from({length:13},(_,i)=>new Date(Date.UTC(2025,8+i,0)).toISOString().slice(0,10));
 dataStatus.sources.ticHolders={status:'ok',series:Object.fromEntries([['ticTotal',1000],['ticOfficial',400],['ticJapan',100],['ticChina',90],['ticUk',80],['ticBelgium',70],['ticCanada',60]].map(([id,value])=>[id,{observations:months.map(date=>({date,value}))}]))};
 try{
 const html=renderPage(parseRoute('#/ownership?ownershipView=official-private&ownershipRange=6m'));
 assert.match(html,/data-series="ticOfficialHoldings,ticPrivateHoldings"/);
 assert.match(html,/data-ownership-view="official-private" aria-pressed="true"/);
 assert.match(html,/data-ownership-range="6m" aria-pressed="true"/);
 assert.match(html,/6 retained month ends/);
 const top=renderPage(parseRoute('#/ownership?ownershipView=top-holders&ownershipRange=3m'));
 assert.match(top,/data-ownership-view="top-holders" aria-pressed="true"/);
 assert.match(top,/3 retained month ends/);
 assert.doesNotMatch(top,/data-series="ticForeignHoldings"/);
 }finally{dataStatus.sources.ticHolders=before;}
});

test('Labor focused native program views and changes retain the actual selected measurement',()=>{
 const state=parseRoute('#/economy/labor?measure=earningsAnnualized3m&transform=change');
 assert.equal(state.macroMeasure,'earningsAnnualized3m');assert.equal(state.transform,'change');
 const current=getSeries(state.macroMeasure),before=current.observations;
 current.observations=[{date:'2026-07-01',value:2},{date:'2026-08-01',value:3.5}];
 let html;try{html=laborPage({...defaults,...state,saved:[],selected:[]});assert.match(toCsv([current.id],{transform:state.transform,range:{preset:'all'}}),/,1.5,Percentage points,/);}finally{current.observations=before;}
 assert.match(html,/id="labor-history-view"/);assert.match(html,/id="transform-select"/);
 assert.match(html,/data-series="earningsAnnualized3m"[^>]*data-transform="change"/);
 assert.match(html,/Percentage points/);
 assert.equal(parseRoute(routeFor(state)).transform,'change');
 const starts=laborPage({...defaults,page:'labor',saved:[],selected:[]});
 for(const ids of ['payroll,wages','primeAgeEmploymentPopulation,primeAgeParticipation','quitsRate,wages'])assert.ok(starts.includes(`data-compare="${ids}"`),ids);
});

test('new chart exports wait for their complete retained source families',()=>{
 const cpi=parseRoute('#/series/cpi?chartView=cpi-monthly');
 assert.ok(requiredSourceIds(cpi,{action:{exportIndicatorChart:''}}).includes('inflationBea'));
 assert.ok(requiredSourceIds(parseRoute('#/series/wages?chartView=earnings-real')).includes('laborEvidence'));
 assert.deepEqual(requiredSourceIds({page:'auctions'},{action:{exportAuctionView:''}}),['auctions']);
 assert.deepEqual(requiredSourceIds({page:'ownership'},{action:{exportTicView:''}}),['ticHolders']);
});

test('changing indicator through in-memory navigation clears an incompatible chart view before freezing',async()=>{
 const application=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
 const body=application.slice(application.indexOf('function navigate('),application.indexOf("window.addEventListener('hashchange'"));
 const env={state:{...parseRoute('#/series/cpi?chartView=cpi-monthly'),saved:[]},saveDrafts:{capture(){}},questionDrafts:{capture(){}},main:{},document:{},rememberWorkspace(){},destinationChanged,entryWindow,normalizedIndicatorView,parseRoute,routeFor,location:{hash:'#/series/cpi?chartView=cpi-monthly'},history:{pushState(){},replaceState(){}},render(){},updateWorkspaceSelection(){}};
 const controller=new Function('env',`let {${Object.keys(env).join(',')}}=env;${body};return {navigate,state:()=>state};`)(env);
 controller.navigate({page:'indicator',seriesId:'wages',transform:'level',tab:'data'});
 assert.equal(controller.state().indicatorView,'');
 assert.equal(parseRoute(routeFor(controller.state())).indicatorView,'');
});
