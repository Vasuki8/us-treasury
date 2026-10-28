import test from 'node:test';
import assert from 'node:assert/strict';
import {fiscalPage} from '../src/fiscal-page.js';
import {refinancingPage} from '../src/refinancing-page.js';
import {yieldsPage} from '../src/yields-page.js';
import {auctionsPage} from '../src/auctions-page.js';
import {ownershipPage} from '../src/ownership-page.js';
import {marketFunctioningPage} from '../src/market-functioning-page.js';
import {NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE} from '../src/market-functioning.js';

const visible=html=>html.replace(/<details\b(?![^>]*\bopen\b)[^>]*>[\s\S]*?<\/details>/g,'');
const detail=(html,key)=>{
 const match=html.match(new RegExp(`<details[^>]*data-page-disclosure="${key}"[^>]*>[\\s\\S]*?<\\/details>`));
 assert.ok(match,`Reachable supporting research: ${key}`);
 assert.doesNotMatch(match[0].slice(0,match[0].indexOf('>')),/\bopen\b/,'Supporting research starts collapsed');
 return match[0];
};
const before=(html,a,b)=>{assert.ok(html.includes(a),a);assert.ok(html.includes(b),b);assert.ok(html.indexOf(a)<html.indexOf(b),`${a} precedes ${b}`);};
const refinancing={status:'error',error:'Retained refinancing <error>',asOf:'2026-09-30',fetchedAt:'2026-10-22T02:00:00Z',unit:'USD billions',securities:[{securityId:'meridian-00000000000000000001',type:'Bill',principal:100,maturityDate:'2026-12-31'}],warnings:['Retained instrument warning']};
const yields={status:'error',error:'Retained yield <error>',fetchedAt:'2026-10-22T02:00:00Z',curveHistory:[{date:'2026-01-02',nominal:{'2Y':3,'10Y':4},real:{'10Y':2}},{date:'2026-10-21',nominal:{'2Y':4,'10Y':5},real:{'10Y':2.5}}]};
const ownership={status:'error',error:'Retained ownership <error>',fetchedAt:'2026-10-22T02:00:00Z',z1:{asOf:'2026-06-30',releaseDate:'2026-09-11',assets:20,liabilities:20,valuationDiscrepancy:0,reconciled:true,sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'}],history:[{date:'2026-06-30',sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'}],assets:20,liabilities:20,valuationDiscrepancy:0}]},soma:{asOf:'2026-10-14',principal:24,inflationCompensation:1,adjustedPrincipal:25,attribution:'Required SOMA source credit',redistributionNotice:'Required SOMA redistribution notice',history:[{date:'2026-10-14',principal:24,inflationCompensation:1,adjustedPrincipal:25}]}};

test('fiscal TTM analysis leads monthly research, with flow and source limits visible',()=>{
 const html=fiscalPage({status:'error',error:'Retained fiscal <error>',coverageNote:'Retained fiscal scope',series:{}}),main=visible(html);
 before(html,'TRAILING 12-MONTH FISCAL TRENDS','data-page-disclosure="fiscal:monthly-research"');
 assert.match(detail(html,'fiscal:monthly-research'),/MONTHLY OBSERVATIONS[\s\S]*LARGEST NAMED CATEGORY CHANGES[\s\S]*CASH BALANCE/);
 assert.match(detail(html,'fiscal:definitions-methods'),/DEBT DEFINITIONS[\s\S]*Methodology/);
 for(const phrase of ['fiscal-year-to-date','trailing 12-month','deficit is a flow','Retained fiscal &lt;error&gt;','Retained fiscal scope','not seasonally adjusted','not gross Treasury interest expense','data-export-fiscal-financing'])assert.ok(main.includes(phrase),phrase);
 assert.match(html,/data-export-fiscal-financing/);
});

test('observed refinancing precedes scenarios while essential assumptions and controls remain open',()=>{
 const html=refinancingPage({refinancingHorizon:3,refinancingShock:50},refinancing),main=visible(html);
 before(html,'CONTRACTUAL MATURITIES','HIGHER / LOWER RATE SCENARIOS');
 before(html,'CURRENT INSTRUMENT MIX','HIGHER / LOWER RATE SCENARIOS');
 assert.match(detail(html,'refinancing:assumptions-methods'),/MODEL ASSUMPTIONS[\s\S]*SCOPE &amp; RECONCILIATION/);
 for(const phrase of ['id="refinancing-horizon"','id="refinancing-shock"','4% hypothetical baseline','not observed rates or forecasts','FRNs can reset','TIPS','Retained refinancing &lt;error&gt;','Retained instrument warning','data-export-refinancing-scenario','not gross federal debt or debt held by the public alone','future inflation is unknown','currently outstanding principal','fully refinanced','7-day reset lag','zero-rate floor'])assert.ok(main.includes(phrase),phrase);
});

test('selected yield curves and matched yields precede retained current context with caveats beside selected results',()=>{
 const html=yieldsPage({yieldDateA:'2026-01-02',yieldDateB:'2026-10-21'},yields),main=visible(html);
 before(html,'SELECTED-DATE RATE CHANGES','CURRENT RETAINED RATE CONTEXT');
 before(html,'HISTORICAL CURVE OVERLAYS','CURRENT RETAINED RATE CONTEXT');
 before(html,'SELECTED NOMINAL / REAL / COMPENSATION CHANGES','CURRENT RETAINED RATE CONTEXT');
 assert.match(detail(html,'yields:methods'),/Treasury curve methodology/);
 for(const phrase of ['id="yield-curve-date-a"','id="yield-curve-date-b"','not zero-coupon yields','not pure expected inflation','own dates','Retained yield &lt;error&gt;','data-export-yield-curves'])assert.ok(main.includes(phrase),phrase);
});

test('auction selected results and peers lead history while competitive-share limitations remain visible',()=>{
 const html=auctionsPage({}, {auctions:[{id:'a',auctionDate:'2026-10-07',securityType:'Note',securityTerm:'10-Year',originalTerm:'10-Year',reopening:false,cashManagement:false,status:'results',competitiveAccepted:100,totalAccepted:110,somaAccepted:10,primaryDealerAccepted:20,directAccepted:10,indirectAccepted:70}]}),main=visible(html);
 before(html,'SELECTED AUCTION','AUCTION HISTORY');before(html,'PRIOR MATCHING RESULTS','AUCTION HISTORY');
 assert.match(detail(html,'auctions:monthly-activity'),/Current and awaiting-result months are partial/);
 assert.match(detail(html,'auctions:methods'),/when-issued/);
 for(const phrase of ['id="auction-type"','data-auction-id="a"','Shares use competitive accepted','not the competitive-share denominator','Indirect bidders are not a foreign-investor category','No auction tail is inferred'])assert.ok(main.includes(phrase),phrase);
});

test('Z.1 sector analysis leads reconciliation and SOMA keeps its own basis, dates and required notices open',()=>{
 const html=ownershipPage(ownership),main=visible(html);
 before(html,'OFFICIAL Z.1 SECTOR POSITIONS','data-page-disclosure="ownership:reconciliation"');
 assert.match(detail(html,'ownership:reconciliation'),/ASSET \/ LIABILITY RECONCILIATION/);
 assert.match(detail(html,'ownership:methods'),/TIC country holdings/);
 for(const phrase of ['2026-06-30','2026-09-11','2026-10-14','market values','not added to Z.1','Required SOMA source credit','Required SOMA redistribution notice','New York Fed Terms of Use','Retained ownership &lt;error&gt;'])assert.ok(main.includes(phrase),phrase);
});

test('market stocks, fails and rates remain distinct and source rights remain visible above supporting methods',()=>{
 const html=marketFunctioningPage({status:'error',fetchedAt:'2026-10-22T02:00:00Z',error:'Retained market <error>',series:{dealerNetTreasury:{observations:[{date:'2026-10-07',value:null,suppressed:true}]}}}),main=visible(html);
 before(html,'DEALER POSITION &amp; FINANCING STOCKS','data-page-disclosure="market:methods"');
 assert.match(detail(html,'market:methods'),/schedules do not verify historical release timestamps/);
 for(const phrase of ['Wednesday positions','Cumulative weekly','same-effective-date difference','not a definitive liquidity or default-risk score','SUPPRESSED','Retained market &lt;error&gt;',NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE])assert.ok(main.includes(phrase),phrase);
});
