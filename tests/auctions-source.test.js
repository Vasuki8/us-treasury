import test from 'node:test';
import assert from 'node:assert/strict';
let adapter;
try {adapter=await import('../scripts/sources/auctions.mjs');}
catch(error) {if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('auctions.mjs'))throw error;}
const auctions=()=>{assert.ok(adapter,'The official Treasury auction adapter must exist');return adapter;};
const raw=(changes={})=>({record_date:'2026-10-30',security_type:'Note',security_term:'5-Year',original_security_term:'5-Year',auction_date:'2026-10-21',issue_date:'2026-10-30',maturity_date:'2031-10-15',announcemt_date:'2026-10-15',bid_to_cover_ratio:'2.5',cash_management_bill_cmb:'No',reopening:'No',floating_rate:'No',inflation_index_security:'No',offering_amt:'26000000000',comp_accepted:'25000000000',primary_dealer_accepted:'5000000000',direct_bidder_accepted:'2500000000',indirect_bidder_accepted:'17500000000',total_accepted:'27000000000',soma_accepted:'1000000000',high_yield:'2.5000',high_discnt_rate:'null',high_discnt_margin:'null',xml_filenm_comp_results:'R_20261021_1.xml',...changes});

test('auction parser preserves amounts, bidder categories and instrument identity without inventing release timestamps',()=>{
  const rows=auctions().parseAuctions({data:[raw(),raw({auction_date:'2026-10-20',security_type:'Bill',security_term:'8-Week',original_security_term:'17-Week',high_yield:'null',high_discnt_rate:'4.05',xml_filenm_comp_results:'R_20261020_1.xml'})]});
  assert.equal(rows[0].securityType,'Bill');assert.equal(rows[0].originalTerm,'17-Week');assert.equal(rows[0].highDiscountRate,4.05);
  assert.equal(rows[1].offeringAmount,26e9);assert.equal(rows[1].competitiveAccepted,25e9);assert.equal(rows[1].somaAccepted,1e9);
  assert.equal(rows[1].sourceRecordDate,'2026-10-30');assert.equal(rows[1].publishedAt,null);
  assert.equal(rows[1].allocations.indirectShare,70);
  assert.equal(rows[1].resultUrl,'https://www.treasurydirect.gov/xml/R_20261021_1.xml');
  assert.ok(rows.every(row=>!Object.hasOwn(row,'cusip')&&!Object.hasOwn(row,'tail')));
  assert.equal(auctions().parseAuctions({data:[raw({floating_rate:'Yes',high_yield:'null',high_discnt_margin:'0.2'})]})[0].securityType,'FRN');
  assert.equal(auctions().parseAuctions({data:[raw({inflation_index_security:'Yes'})]})[0].securityType,'TIPS');
});

test('missing auction results stay announced and missing bidder amounts stay partial',()=>{
  const pending=auctions().parseAuctions({data:[raw({bid_to_cover_ratio:'null',comp_accepted:'null',primary_dealer_accepted:'null',direct_bidder_accepted:'null',indirect_bidder_accepted:'null',total_accepted:'null',soma_accepted:'null',high_yield:'null',xml_filenm_comp_results:'null'})]})[0];
  assert.equal(pending.status,'announced');assert.equal(pending.bidToCover,null);assert.equal(pending.resultUrl,null);assert.equal(pending.allocations.status,'unavailable');
  const partial=auctions().parseAuctions({data:[raw({direct_bidder_accepted:'null'})]})[0];
  assert.equal(partial.status,'results');assert.equal(partial.directAccepted,null);assert.equal(partial.allocations.status,'partial');
});

test('parser fails closed on duplicate identities, malformed dates/numbers/flags, contradictory instruments and result filenames',()=>{
  assert.throws(()=>auctions().parseAuctions({data:[raw(),raw()]}),/duplicate/i);
  for(const change of [{auction_date:'2026-02-30'},{offering_amt:'oops'},{offering_amt:'-1'},{reopening:'Maybe'},{floating_rate:'Yes',inflation_index_security:'Yes'},{security_type:'Buyback'},{xml_filenm_comp_results:'https://vendor.example/file.xml'},{xml_filenm_comp_results:'R_20261020_1.xml'}])assert.throws(()=>auctions().parseAuctions({data:[raw(change)]}),/auction|date|number|flag|instrument|filename/i);
  assert.throws(()=>auctions().parseAuctions({rows:[]}),/response/i);
});

function response(data,page,totalPages=1,totalCount=data.length){return new Response(JSON.stringify({data,meta:{count:data.length,'total-pages':totalPages,'total-count':totalCount},links:{next:page<totalPages?'ignored-relative-link':null}}));}

test('collector follows bounded API pages with explicit source-owned URLs and separates pending capture coverage',async()=>{
  const calls=[];
  const fetchImpl=async url=>{calls.push(url);const page=Number(new URL(url).searchParams.get('page[number]'));return page===1?response([raw({auction_date:'2026-09-21',xml_filenm_comp_results:'R_20260921_1.xml'})],1,2,2):response([raw({bid_to_cover_ratio:'null',xml_filenm_comp_results:'null'})],2,2,2);};
  const result=await auctions().collectAuctions({fetchImpl,now:new Date('2026-10-22T01:00:00Z')});
  assert.equal(result.id,'auctions');assert.equal(calls.length,2);
  for(const url of calls){const target=new URL(url);assert.equal(target.origin,'https://api.fiscaldata.treasury.gov');assert.equal(target.searchParams.get('filter'),'auction_date:gte:2024-10-01,auction_date:lte:2026-10-21');assert.ok(!target.searchParams.get('fields').split(',').includes('cusip'));}
  assert.equal(result.auctions.length,2);assert.equal(result.lastResultsDate,'2026-09-21');assert.equal(result.pendingCount,1);
  assert.equal(result.series.auctionOfferingMonthly.observations.at(-2).value,26);
  assert.equal(result.series.auctionOfferingMonthly.observations.at(-1).value,null);
  assert.deepEqual(result.series.auctionOfferingMonthly.sourceIds,['offering_amt','auction_date','bid_to_cover_ratio']);
  assert.ok(result.provenance.every(row=>!Object.hasOwn(row,'text')&&/^[a-f\d]{64}$/.test(row.sha256)));
});

test('collector rejects pagination/count drift, upstream failures and all-pending results without replacing missing data',async()=>{
  const now=new Date('2026-10-21T23:00:00Z');
  await assert.rejects(auctions().collectAuctions({now,fetchImpl:async()=>response([raw()],1,11,11)}),/page|bounded/i);
  await assert.rejects(auctions().collectAuctions({now,fetchImpl:async()=>response([raw()],1,1,2)}),/count|complete/i);
  await assert.rejects(auctions().collectAuctions({now,fetchImpl:async()=>new Response('blocked',{status:403})}),/403/);
  await assert.rejects(auctions().collectAuctions({now,fetchImpl:async()=>response([raw({bid_to_cover_ratio:'null'})],1)}),/results|usable/i);
  await assert.rejects(auctions().collectAuctions({now:new Date('invalid')}),/date/i);
});
