import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRoute,routeFor} from '../src/router.js';
const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const from=app.indexOf("else if('auctionHistoryPage' in d)"),to=app.indexOf("else if('exportAuctions' in d",from);
assert.ok(from>=0&&to>from,'auction action boundaries must exist');
const act=new Function('d','navigate','document','dataStatus','announce',app.slice(from,to).replace(/^else /,''));
const source={sources:{auctions:{auctions:[{id:'new-selection',auctionDate:'2026-10-01',securityType:'Bill',securityTerm:'13-Week'}]}}};
test('actual auction paging preserves explicit selection and does not force scrolling',()=>{
 let state=parseRoute('#/auctions?type=Bill&auction=explicit-selection'),hash='',calls=[];
 const target={focus:options=>calls.push(['focus',options]),scrollIntoView:options=>calls.push(['scroll',options])};
 act({auctionHistoryPage:'4'},patch=>{state={...state,...patch};hash=routeFor(state);},{getElementById:id=>id==='auction-history'?target:null},source,()=>{});
 assert.equal(state.auctionId,'explicit-selection');assert.equal(parseRoute(hash).auctionHistoryPage,4);assert.equal(parseRoute(hash).auctionType,'Bill');
 assert.deepEqual(calls,[['focus',{preventScroll:true}]]);
});
test('explicit auction selection preserves the browsing page; View selected is the only scroll action',()=>{
 let state={auctionId:'old',auctionHistoryPage:4},calls=[],messages=[];
 const target={focus:options=>calls.push(['focus',options]),scrollIntoView:options=>calls.push(['scroll',options])};
 act({auctionId:'new-selection'},patch=>{state={...state,...patch};},{getElementById:()=>target},source,message=>messages.push(message));
 assert.equal(state.auctionId,'new-selection');assert.equal(state.auctionHistoryPage,4);assert.deepEqual(calls,[]);assert.match(messages[0],/2026-10-01.*Bill/);
 act({auctionSelected:''},()=>{}, {getElementById:id=>id==='auction-selected-result'?target:null},source,()=>{});
 assert.deepEqual(calls,[['focus',{preventScroll:true}],['scroll',{block:'start'}]]);
});
