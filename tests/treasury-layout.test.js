import test from 'node:test';
import assert from 'node:assert/strict';
import {refinancingPage} from '../src/refinancing-page.js';
import {yieldsPage} from '../src/yields-page.js';
import {auctionsPage} from '../src/auctions-page.js';
import {ownershipPage} from '../src/ownership-page.js';
import {marketFunctioningPage} from '../src/market-functioning-page.js';
import {NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE} from '../src/market-functioning.js';

const visible=html=>html.replace(/<details\b(?![^>]*\bopen\b)[^>]*>[\s\S]*?<\/details>/g,'');
const before=(html,a,b)=>{assert.ok(html.includes(a),a);assert.ok(html.includes(b),b);assert.ok(html.indexOf(a)<html.indexOf(b),`${a} precedes ${b}`);};
function group(html,label){
  const start=html.indexOf(`<section class="reading-group" aria-label="${label}">`);
  assert.ok(start>=0,`Separate reading basis: ${label}`);
  let depth=0;
  for(const match of html.slice(start).matchAll(/<\/?section\b[^>]*>/g)){
    depth+=match[0].startsWith('</')?-1:1;
    if(depth===0)return html.slice(start,start+match.index+match[0].length);
  }
  assert.fail(`Unclosed reading group: ${label}`);
}
const refinancing={status:'error',error:'Retained maturity <error>',asOf:'2026-09-30',fetchedAt:'2026-10-22T02:00:00Z',unit:'USD billions',securities:[{securityId:'meridian-00000000000000000001',type:'Bill',principal:100,maturityDate:'2026-12-31'}],warnings:['Instrument coverage warning']};
const yields={status:'error',error:'Retained curve <error>',fetchedAt:'2026-10-22T02:00:00Z',curveHistory:[{date:'2026-01-02',nominal:{'2Y':3,'10Y':4},real:{'10Y':2}},{date:'2026-10-21',nominal:{'2Y':4,'10Y':5},real:{'10Y':2.5}}]};
const ownership={status:'error',error:'Retained ownership <error>',fetchedAt:'2026-10-22T02:00:00Z',z1:{asOf:'2026-06-30',releaseDate:'2026-09-11',assets:20,liabilities:20,valuationDiscrepancy:0,reconciled:false,sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'}],history:[{date:'2026-06-30',sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'}],assets:20,liabilities:20,valuationDiscrepancy:0}]},soma:{asOf:'2026-10-14',principal:24,inflationCompensation:1,adjustedPrincipal:25,attribution:'Required SOMA credit',redistributionNotice:'Required SOMA reuse notice',history:[{date:'2026-10-14',principal:24,inflationCompensation:1,adjustedPrincipal:25}]}};
const auction=(id,date,extra={})=>({id,auctionDate:date,securityType:'Note',securityTerm:'10-Year',originalTerm:'10-Year',reopening:false,cashManagement:false,status:'results',competitiveAccepted:100,totalAccepted:110,somaAccepted:10,primaryDealerAccepted:20,directAccepted:10,indirectAccepted:70,...extra});

test('refinancing groups observed instrument dates apart from modeled horizon and leads tables with the trend',()=>{
  const html=refinancingPage({refinancingHorizon:3,refinancingShock:50},refinancing),main=visible(html);
  const observed=group(main,'Observed refinancing exposure'),modeled=group(main,'Modeled rate sensitivity');
  assert.match(observed,/2026-09-30/);assert.match(observed,/own.*date/i);
  before(observed,'OUTSTANDING PRINCIPAL HISTORY','CONTRACTUAL MATURITIES');
  before(main,'Observed refinancing exposure','Modeled rate sensitivity');
  for(const phrase of ['2026-12-31','4% hypothetical baseline','id="refinancing-horizon"','id="refinancing-shock"','not observed rates or forecasts','USD billions'])assert.ok(modeled.includes(phrase),phrase);
  for(const phrase of ['CACHED','2026-10-22T02:00:00Z','Release date: unknown','Retained maturity &lt;error&gt;','Instrument coverage warning','future inflation is unknown'])assert.ok(main.includes(phrase),phrase);
});

test('selected yield controls and overlay lead detailed tenor evidence while retained dates remain separate',()=>{
  const html=yieldsPage({yieldDateA:'2026-01-02',yieldDateB:'2026-10-21'},yields),main=visible(html);
  const selected=group(main,'Selected curve comparison'),retained=group(main,'Current retained rate context');
  before(selected,'id="yield-curve-date-a"','data-kind="history-curve"');
  before(selected,'data-kind="history-curve"','SELECTED-DATE RATE CHANGES');
  before(selected,'data-kind="history-curve"','MATCHED NOMINAL / REAL YIELDS');
  assert.match(selected,/2026-01-02/);assert.match(selected,/2026-10-21/);assert.match(selected,/not pure expected inflation/);
  assert.match(retained,/own dates/);assert.match(retained,/data-series="spread2s10s,spread3m10y"/);
  const missing=visible(yieldsPage({yieldDateA:'1900-01-01',yieldDateB:'2026-10-21'},yields));
  assert.match(group(missing,'Selected curve comparison'),/A selected date is unavailable. No other date is substituted/);
  assert.match(main,/Retained curve &lt;error&gt;/);
});

test('auction selection preserves open history paging and visibly distinguishes pending results and source capture',()=>{
  const source={status:'error',error:'Retained auction <error>',fetchedAt:'2026-10-22T02:00:00Z',auctions:Array.from({length:75},(_,i)=>auction(`record-${i}`,new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10)))};
  source.auctions[0].status='announced';
  const main=visible(auctionsPage({auctionId:'record-0'},source)),selected=group(main,'Selected auction comparison');
  assert.match(selected,/id="auction-type"/);assert.match(selected,/AWAITING RESULTS/);assert.match(selected,/Result release timestamp<\/dt><dd>Unknown/);
  before(main,'PRIOR MATCHING RESULTS','AUCTION HISTORY');
  assert.match(main,/History page 2 of 2/);assert.match(main,/data-auction-history-page/);assert.match(main,/id="auction-history" tabindex="-1"/);
  assert.match(main,/data-auction-id="record-0" aria-pressed="true"/);assert.match(main,/CACHED/);assert.match(main,/Retained auction &lt;error&gt;/);
});

test('ownership preserves separate quarterly vintage and weekly par basis with SOMA chart before detail and notices open',()=>{
  const main=visible(ownershipPage(ownership)),z1=group(main,'Quarterly Z.1 positions'),soma=group(main,'Weekly SOMA holdings');
  for(const phrase of ['2026-06-30','2026-09-11','market values'])assert.ok(z1.includes(phrase),phrase);
  before(z1,'data-series="foreignTreasuryHoldings,fedTreasuryHoldings"','OFFICIAL Z.1 SECTOR POSITIONS');
  before(soma,'data-series="somaTreasuryHoldings"','TREASURY-ONLY SOMA MEASURE');
  for(const phrase of ['2026-10-14','Actual release date: unknown','not added to Z.1','Required SOMA credit','Required SOMA reuse notice','New York Fed Terms of Use'])assert.ok(soma.includes(phrase),phrase);
  assert.match(main,/Incomplete source positions/);assert.match(main,/Retained ownership &lt;error&gt;/);
});

test('market groups weekly stocks and cumulative fails apart from daily funding and leads funding detail with distributions',()=>{
  const source={status:'error',fetchedAt:'2026-10-21T01:00:00Z',lastAttemptAt:'2026-10-22T02:00:00Z',error:'Funding refresh <error>',series:{dealerNetTreasury:{observations:[{date:'2026-10-07',value:null,suppressed:true}]},dealerFailsDeliver:{observations:[{date:'2026-10-07',value:30}]},sofr:{observations:[{date:'2026-10-20',value:4}]}}};
  const main=visible(marketFunctioningPage(source)),stocks=group(main,'Weekly dealer stocks'),fails=group(main,'Weekly settlement fails'),daily=group(main,'Daily funding rates');
  assert.match(stocks,/Wednesday positions/);assert.match(stocks,/SUPPRESSED/);assert.match(stocks,/2026-10-07/);
  assert.match(fails,/Cumulative weekly/);assert.doesNotMatch(stocks,/SOFR/);assert.doesNotMatch(fails,/Published volume-weighted median rate/);
  before(daily,'SHARED FUNDING HISTORY WINDOW','DAILY FUNDING-RATE CONTEXT');
  before(daily,'SOFR − EFFR','DAILY FUNDING-RATE CONTEXT');
  assert.match(daily,/2026-10-20/);assert.match(daily,/same-effective-date difference/);
  for(const phrase of ['2026-10-21T01:00:00Z','2026-10-22T02:00:00Z','Funding refresh &lt;error&gt;',NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE])assert.ok(main.includes(phrase),phrase);
});

test('unavailable Treasury inputs retain visible recovery explanations and heading actions',()=>{
  for(const html of [refinancingPage({},null),yieldsPage({},null),auctionsPage({},null),ownershipPage(null),marketFunctioningPage(null)]){
    const main=visible(html);
    assert.match(main,/class="page-heading"[\s\S]*?class="actions"/);
    assert.match(main,/unavailable|No auctions match|No verified/i);
    assert.doesNotMatch(main,/NaN|undefined/);
  }
});

test('Treasury source warnings follow primary readings while critical capture errors stay above them',()=>{
  const refinancingMain=visible(refinancingPage({},refinancing));
  before(refinancingMain,'Retained maturity &lt;error&gt;','aria-label="Calculated refinancing exposure"');
  before(refinancingMain,'aria-label="Calculated refinancing exposure"','Instrument coverage warning');
  before(refinancingMain,'Bill share','Eligible unmatured marketable principal is not gross federal debt');
  before(refinancingMain,'Instrument coverage warning','OUTSTANDING PRINCIPAL HISTORY');
  const ownershipMain=visible(ownershipPage({...ownership,warnings:['Ownership source warning']}));
  before(ownershipMain,'Retained ownership &lt;error&gt;','href="#/series/foreignTreasuryHoldings"');
  before(ownershipMain,'href="#/series/foreignTreasuryHoldings"','Ownership source warning');
  before(ownershipMain,'Ownership source warning','QUARTER-END FOREIGN &amp; FEDERAL RESERVE POSITIONS');
});
