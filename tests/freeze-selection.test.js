import test from 'node:test';
import assert from 'node:assert/strict';
import {freezeCandidates,buildPinContext} from '../src/research-context.js';
import {createResearchPackage,importResearchPackage,exportResearchPackage} from '../src/research-packages.js';
test('default freeze preview and package selection agree on every ordinary page',()=>{
 for(const page of ['overview','fiscal','refinancing','yields','auctions','ownership','macro','market','credit']){
  const state={page,window:'1y',selected:['unrate','cpi'],refinancingHorizon:12,refinancingShock:100,auctionType:'All'};
  assert.deepEqual(buildPinContext(state).state.selected,freezeCandidates(state).slice(0,4),page);
 }
});
test('watchlist freeze selects exact histories while preserving full ordered membership as context',async()=>{
 const saved=['unrate','cpi','payroll','yield','gdp','claims'];
 const state={page:'watchlist',saved,selected:['gdp'],window:'1y',freezeSelection:['yield','claims'],activeWatchlistId:'rates',watchlists:[{id:'rates',name:'Rates and jobs',saved}]};
 assert.deepEqual(freezeCandidates(state),saved);
 const args=buildPinContext(state);assert.deepEqual(args.state.selected,['yield','claims']);
 assert.deepEqual(args.context.watchlist.membership,saved);assert.deepEqual(args.context.watchlist.omittedIds,['unrate','cpi','payroll','gdp']);
 const pkg=await createResearchPackage({name:'Selected watchlist',...args}),roundtrip=await importResearchPackage(exportResearchPackage(pkg));
 assert.deepEqual(Object.keys(roundtrip.catalog).sort(),['claims','yield']);
 assert.deepEqual(roundtrip.context.watchlist.membership,saved);
 assert.throws(()=>buildPinContext({...state,freezeSelection:['debt']}),/preview/);
 assert.throws(()=>buildPinContext({...state,freezeSelection:[]}),/one to four/);
});
