import test from 'node:test';
import assert from 'node:assert/strict';
import {auctionsPage,auctionsCsv} from '../src/auctions-page.js';
import {explorePage} from '../src/explore-page.js';
import {table,metrics} from '../src/ui.js';
import {parseRoute} from '../src/router.js';

const source={auctions:Array.from({length:181},(_,i)=>({id:`record-${i}`,auctionDate:new Date(Date.UTC(2020,0,i+1)).toISOString().slice(0,10),securityType:'Bill',securityTerm:'13-Week',status:'results',offeringAmount:1e9,bidToCover:2,competitiveAccepted:1e9,primaryDealerAccepted:2e8,directAccepted:3e8,indirectAccepted:5e8,highDiscountRate:1}))};
test('auction browsing keeps the explicitly selected result, with a nearby accessible summary',()=>{
 const html=auctionsPage({auctionId:'record-180',auctionHistoryPage:2},source);
 assert.match(html,/History page 3 of 4/);
 assert.match(html,/data-auction-history-page="3"/);
 assert.doesNotMatch(html,/data-auction-id="[^"]*"[^>]*data-auction-history-page/);
 assert.match(html,/id="auction-selection-status"[^>]*role="status"/);
 assert.match(html,/data-auction-selected[^>]*>View selected auction/);
 assert.match(html,/id="auction-selected-result"[^>]*tabindex="-1"/);
 assert.match(html,/Selected: 2020-06-29/);
 assert.match(auctionsCsv(source,{auctionId:'record-180',benchmark:true}),/record-180,selected/);
});
test('comparison invalid dates offer date recovery while preserving mode and selected series',()=>{
 const html=explorePage({...parseRoute('#/explore?mode=compare&selected=cpi,unrate&comparison=indexed&window=custom&start=2026-02-01&end=2026-01-01'),saved:[]});
 assert.match(html,/data-comparison-reset-range/);
 assert.match(html,/data-focus-field="window-start"/);
 assert.doesNotMatch(html,/data-comparison-mode="native"[^>]*>USE NATIVE VALUES/);
 assert.match(html,/value="2026-02-01"/);
});
test('unsupported indexed comparisons offer supported modes without resetting the range',()=>{
 const html=explorePage({...parseRoute('#/explore?mode=compare&selected=cpi,unrate&comparison=indexed&window=all'),saved:[]});
 assert.match(html,/data-comparison-mode="native"/);
 assert.match(html,/data-comparison-mode="difference"/);
 assert.doesNotMatch(html,/data-comparison-reset-range/);
});
test('shared tables require explicit numeric column definitions and keep textual headings left aligned',()=>{
 const html=table(['DATE','SECURITY',{label:'BID-TO-COVER',numeric:true}],'<tr><td>2026-01-01</td><td>Bill</td><td class="num">2.40</td></tr>','Facts');
 assert.match(html,/<th scope="col">SECURITY<\/th>/);
 assert.match(html,/<th scope="col" class="num">BID-TO-COVER<\/th>/);
 assert.doesNotMatch(html,/\[object Object\]/);
});
test('navigable metric cards contain a visible detail cue',()=>{
 assert.match(metrics(['cpi']),/class="metric-detail"[^>]*>Details/);
});

test('comparison incompatibility recovery preserves valid dates and offers native panels',()=>{
 const html=explorePage({...parseRoute('#/explore?mode=compare&selected=gdp,unrate&comparison=difference&alignment=quarter&window=all'),saved:[]});
 assert.match(html,/These measurements cannot share this baseline/);
 assert.match(html,/data-comparison-mode="native"/);
 assert.doesNotMatch(html,/data-comparison-reset-range/);
});
