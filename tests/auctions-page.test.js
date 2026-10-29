import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../scripts/sources/http.mjs';
let page;
try{page=await import('../src/auctions-page.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('auctions-page.js'))throw error;}
const ui=()=>{assert.ok(page,'The Graphite auction page must exist');return page;};
const row=(id,date,changes={})=>({id,auctionDate:date,announcementDate:date,issueDate:'2026-10-30',maturityDate:'2036-08-15',sourceRecordDate:'2026-10-30',publishedAt:null,securityType:'Note',securityTerm:'9-Year 10-Month',originalTerm:'10-Year',reopening:true,cashManagement:false,status:'results',offeringAmount:39e9,competitiveAccepted:38e9,totalAccepted:40e9,somaAccepted:1e9,primaryDealerAccepted:7.6e9,directAccepted:3.8e9,indirectAccepted:26.6e9,bidToCover:2.5,highYield:5.1,highDiscountRate:null,highDiscountMargin:null,sourceUrl:'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query',resultUrl:'https://www.treasurydirect.gov/xml/R_20261007_1.xml',...changes});
const fixture=()=>({status:'ok',fetchedAt:'2026-10-21T23:00:00Z',coverageStart:'2024-10-01',coverageEnd:'2026-10-21',coverageNote:'Reported auction facts.',auctions:[row('prior','2026-09-09',{bidToCover:2.4}),row('note','2026-10-07',{bidToCover:2.8}),row('tips','2026-10-08',{securityType:'TIPS'}),row('pending','2000-10-21',{securityType:'Bill',status:'announced',bidToCover:null,competitiveAccepted:null,primaryDealerAccepted:null,directAccepted:null,indirectAccepted:null,highYield:null,totalAccepted:null,somaAccepted:null,resultUrl:null})]});

test('auction page filters and selection remain exact with accessible controls and competitive-award denominators',()=>{
  const html=ui().auctionsPage({auctionType:'Note',auctionId:'note'},fixture());
  assert.match(html,/<label[^>]*for="auction-type"/);assert.match(html,/<select[^>]*id="auction-type"/);
  assert.match(html,/data-auction-id="note"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-auction-id="note"/);
  assert.doesNotMatch(html,/data-auction-id="tips"|data-auction-id="pending"/);
  assert.match(html,/competitive accepted/i);assert.match(html,/20\.0%/);assert.match(html,/70\.0%/);
  assert.match(html,/prior matching/i);assert.match(html,/indirect bidders[^<]*not[^<]*foreign/i);assert.match(html,/when-issued/i);
  for(const label of ['WHAT CHANGED','WHAT CONTRIBUTED','WHY IT MATTERS','LIMITATIONS'])assert.ok(html.includes(label),label);
  assert.match(html,/data-export-auctions/);assert.match(html,/data-export-auction-benchmark/);
});

test('auction page exposes elapsed results not retained, retained errors, empty filters and escaped text without substituting another instrument',()=>{
  const source=fixture();source.status='error';source.error='HTTP 503 <retry>';
  const html=ui().auctionsPage({auctionType:'Bill',auctionId:'pending'},source);
  assert.match(html,/RESULTS NOT RETAINED/);assert.match(html,/Latest verified complete results/);assert.match(html,/CACHED/);assert.match(html,/HTTP 503 &lt;retry&gt;/);assert.doesNotMatch(html,/<retry>/);
  const empty=ui().auctionsPage({auctionType:'FRN'},source);assert.match(empty,/No auctions match/i);assert.doesNotMatch(empty,/data-auction-id="note"/);
});

test('official auction rates retain three decimals so small FRN margins remain visible',()=>{
  const cases=[
    {securityType:'Note',highYield:5.123,label:'Nominal / TIPS high yield',display:'5.123%'},
    {securityType:'Bill',highDiscountRate:4.135,label:'Bill high discount rate',display:'4.135%'},
    {securityType:'FRN',highDiscountMargin:0.04,label:'FRN high discount margin',display:'0.040%'},
  ];
  for(const {label,display,...changes} of cases){
    const html=ui().auctionsPage({}, {auctions:[row('selected','2026-10-07',changes)]});
    assert.ok(html.includes(`<dt>${label}</dt><dd>${display}</dd>`),`${label} must retain its published rate precision`);
  }
});

test('auction and benchmark CSV exports preserve selected facts, missing results, types and the exact prior-peer set',()=>{
  const source=fixture();
  const table=parseCsv(ui().auctionsCsv(source,{securityType:'Note'})),headers=table.shift(),records=table.map(values=>Object.fromEntries(headers.map((key,index)=>[key,values[index]])));
  assert.deepEqual(records.map(row=>row.auction_id),['note','prior']);
  assert.equal(records[0].competitive_accepted_usd,'38000000000');assert.equal(records[0].indirect_share_percent,'70');
  assert.equal(records[0].release_date,'');assert.match(records[0].observation_types,/calculated/);assert.match(records[0].allocation_calculation,/competitive/i);
  const peers=parseCsv(ui().auctionsCsv(source,{securityType:'Note',auctionId:'note',benchmark:true}));
  assert.equal(peers.length,3);assert.ok(peers.flat().includes('prior-matched'));assert.ok(!peers.flat().includes('tips'));
  const pending=parseCsv(ui().auctionsCsv(source,{securityType:'Bill'}));assert.equal(pending[1][pending[0].indexOf('bid_to_cover_ratio')],'');
});

test('auction CSV rows include the capture query URLs, response hashes and retrieval times as parseable provenance',()=>{
  const source=fixture();
  source.provenance=[
    {url:'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?fields=auction_date%2Ccomp_accepted&page%5Bnumber%5D=1',sha256:'a'.repeat(64),retrievedAt:'2026-10-21T22:59:58Z',lastModified:null},
    {url:'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query?fields=auction_date%2Ccomp_accepted&page%5Bnumber%5D=2',sha256:'b'.repeat(64),retrievedAt:'2026-10-21T23:00:00Z',lastModified:'Wed, 21 Oct 2026 22:00:00 GMT'},
  ];
  for(const benchmark of [false,true]){
    const [headers,...rows]=parseCsv(ui().auctionsCsv(source,{securityType:'Note',auctionId:'note',benchmark}));
    const column=headers.indexOf('capture_provenance_json');
    assert.ok(column>=0,'export must preserve capture provenance beyond the canonical record URL');
    assert.equal(rows.length,2);
    for(const values of rows)assert.deepEqual(JSON.parse(values[column]),source.provenance);
  }
});

test('historical auction selection opens its 60-row page and existing auction links navigate all history',()=>{
  const source=fixture();source.auctions=Array.from({length:181},(_,index)=>row(`history-${index}`,new Date(Date.UTC(2020,0,index+1)).toISOString().slice(0,10)));
  const latest=ui().auctionsPage({},source);
  assert.match(latest,/History page 1 of 4/);
  assert.ok(latest.includes('id="auction-history" tabindex="-1"'),'paging target must be focusable');
  assert.ok(latest.includes('data-auction-history-page'),'paging controls must identify table navigation');
  assert.match(latest,/data-auction-history-page="1"[^>]*>OLDER/);
  assert.match(latest,/data-auction-history-page="3"[^>]*>OLDEST/);
  assert.doesNotMatch(latest,/aria-pressed="true"[^>]*>2020-01-11/);
  const historical=ui().auctionsPage({auctionId:'history-10'},source);
  assert.match(historical,/History page 3 of 4/);
  assert.match(historical,/data-auction-id="history-10"[^>]*aria-pressed="true"/);
  assert.match(historical,/data-auction-history-page="1"[^>]*>NEWER/);
  assert.match(historical,/data-auction-history-page="0"[^>]*>NEWEST/);
  assert.match(ui().auctionsPage({auctionId:'history-0'},source),/History page 4 of 4/);
  assert.equal(parseCsv(ui().auctionsCsv(source,{auctionId:'history-10'})).length,182,'CSV keeps every matching record independently of the displayed page');
});
