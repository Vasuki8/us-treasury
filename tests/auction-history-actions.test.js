import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRoute,routeFor} from '../src/router.js';

const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const from=app.indexOf("else if('auctionId' in d)"),to=app.indexOf("else if('exportAuctions' in d",from);
assert.ok(from>=0&&to>from,'auction action boundaries must exist');
const act=new Function('d','navigate','document',app.slice(from,to).replace(/^else /,''));

test('actual auction paging action preserves the selected URL and exposes the new table page',()=>{
 let state=parseRoute('#/auctions?type=Bill'),hash='',calls=[];
 const history={focus:options=>calls.push(['focus',options]),scrollIntoView:options=>calls.push(['scroll',options])};
 act({auctionId:'auction-2008-04-07-bill-13-week-2008-07-10',auctionHistoryPage:''},patch=>{state={...state,...patch};hash=routeFor(state);},{getElementById:id=>id==='auction-history'?history:null});
 assert.equal(parseRoute(hash).auctionId,'auction-2008-04-07-bill-13-week-2008-07-10');assert.equal(parseRoute(hash).auctionType,'Bill');
 assert.deepEqual(calls,[['focus',{preventScroll:true}],['scroll',{block:'start'}]]);
 calls=[];
 act({auctionId:'ordinary-row'},()=>{},{getElementById:()=>history});assert.deepEqual(calls,[],'ordinary row selection keeps its existing behavior');
 assert.doesNotThrow(()=>act({auctionId:'removed-page',auctionHistoryPage:''},()=>{},{getElementById:()=>null}));
});
