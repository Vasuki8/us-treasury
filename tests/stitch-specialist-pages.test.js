import test from 'node:test';
import assert from 'node:assert/strict';
import {auctionsPage,auctionsCsv} from '../src/auctions-page.js';
import {ownershipPage,ownershipCsv} from '../src/ownership-page.js';
import {marketFunctioningPage,marketFunctioningCsv} from '../src/market-functioning-page.js';
import {yieldsPage,yieldCurvesCsv} from '../src/yields-page.js';

const strip=(html,count=4)=>{const found=html.match(/<section class="stitch-kpi-strip"[^>]*>[\s\S]*?<\/section>/);assert.ok(found,'A desk starts with retained readings');assert.equal((found[0].match(/class="stitch-kpi /g)??[]).length,count);return found[0];};
const auction={id:'selected',auctionDate:'2026-10-07',securityType:'Note',securityTerm:'10-Year',originalTerm:'10-Year',reopening:false,cashManagement:false,status:'results',highYield:4.25,offeringAmount:1e9,bidToCover:2.5,competitiveAccepted:100,primaryDealerAccepted:20,directAccepted:10,indirectAccepted:70};
const auctions={auctions:[auction],series:{auctionOfferingMonthly:{observations:[{date:'2026-10-01',value:1,partial:true}]}}};
const sectors=[['LM263061105.Q','Rest of the world',800],['LM713061103.Q','Federal Reserve / central bank',400],['LM153061105.Q','Households and nonprofit organizations',200],['LM653061105.Q','Mutual funds',100]].map(([code,label,value])=>({code,label,value,valuation:'market value'}));
const ownership={z1:{asOf:'2026-06-30',sectors,history:[{date:'2026-06-30',sectors}],assets:1500,liabilities:1500,valuationDiscrepancy:0,reconciled:true}};
const funding={series:{sofr:{observations:[{date:'2026-10-19',value:4,percentile25:3.99,percentile75:4.01},{date:'2026-10-20',value:4.2,percentile25:4.19,percentile75:4.23,volumeInBillions:2925}]},effr:{observations:[{date:'2026-10-20',value:4.1}]},sofrEffrSpread:{observations:[{date:'2026-10-20',value:10}]}}};
const yields={curveHistory:[{date:'2026-10-20',nominal:{'2Y':4,'10Y':4.5},real:{'10Y':2}}]};

test('auction desk readings use the selected official result and keep WI coverage explicit',()=>{
 const original=JSON.stringify(auctions),csv=auctionsCsv(auctions),html=auctionsPage({},auctions),readings=strip(html,7);
 for(const value of ['4.250%','2.50×','70.0%','20.0%'])assert.ok(readings.includes(value),value);
 assert.match(html,/stitch-auction-desk/);assert.match(html,/When-issued pricing[\s\S]*Not covered/);
 assert.match(html,/data-series="auctionOfferingMonthly"/);assert.match(html,/data-auction-id="selected"/);
 assert.equal(auctionsCsv(auctions),csv);assert.equal(JSON.stringify(auctions),original);
});

test('ownership desk cards retain quarterly sector basis without inventing TIC countries or shares',()=>{
 const original=JSON.stringify(ownership),csv=ownershipCsv(ownership),html=ownershipPage(ownership),readings=strip(html);
 for(const value of ['$0.800T','$0.400T','$0.200T','$0.100T'])assert.ok(readings.includes(value),value);
 assert.match(html,/stitch-ownership-desk/);assert.match(readings,/30 Jun 2026/);
 assert.match(html,/Country holdings[\s\S]*Not covered/);assert.doesNotMatch(readings,/SOMA|Japan|China/);
 assert.equal(ownershipCsv(ownership),csv);assert.equal(JSON.stringify(ownership),original);
});

test('funding desk uses current retained distribution endpoints and separates unavailable microstructure',()=>{
 const original=JSON.stringify(funding),csv=marketFunctioningCsv(funding),html=marketFunctioningPage(funding),readings=strip(html);
 for(const value of ['4.2%','4.1%','10 bp','4.0 bp'])assert.ok(readings.includes(value),value);
 assert.doesNotMatch(html,/aria-label="Daily funding readings"/,'the four reference cards replace the repeated daily headline strip');
 assert.match(html,/stitch-funding-desk/);assert.match(html,/25TH PERCENTILE/i);assert.match(html,/4.19%/);assert.match(html,/4.23%/);
 assert.match(html,/Market depth[\s\S]*Not covered/);assert.match(html,/FICC cleared volumes[\s\S]*Not covered/);
 const missing=structuredClone(funding);missing.series.sofr.observations.at(-1).percentile75=null;
 assert.match(strip(marketFunctioningPage(missing)),/SOFR interquartile range[\s\S]*Unavailable/);
 assert.equal(marketFunctioningCsv(funding),csv);assert.equal(JSON.stringify(funding),original);
});

test('yield desk cards follow selected curves with exact same-tenor compensation and explicit model gaps',()=>{
 const original=JSON.stringify(yields),csv=yieldCurvesCsv(yields),html=yieldsPage({},yields),readings=strip(html);
 for(const value of ['4.50%','2.00%','250.00 bp','50.00 bp'])assert.ok(readings.includes(value),value);
 assert.match(html,/stitch-yields-desk/);assert.match(readings,/20 Oct 2026/);
 assert.match(html,/Inflation risk premium[\s\S]*Not covered/);assert.match(html,/TIPS liquidity premium[\s\S]*Not covered/);
 assert.equal(yieldCurvesCsv(yields),csv);assert.equal(JSON.stringify(yields),original);
});
