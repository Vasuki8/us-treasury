import test from 'node:test';
import assert from 'node:assert/strict';
let model;
try { model=await import('../src/auctions.js'); }
catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('auctions.js')) throw error; }
const auctions=()=>{assert.ok(model,'The auction research model must exist');return model;};
const record=(id,date,changes={})=>({id,auctionDate:date,securityType:'Note',securityTerm:'9-Year 10-Month',originalTerm:'10-Year',reopening:true,cashManagement:false,status:'results',bidToCover:2.5,offeringAmount:39e9,competitiveAccepted:1000,primaryDealerAccepted:200,directAccepted:100,indirectAccepted:700,...changes});

test('bidder allocation shares use competitive accepted, with distinct missing and unreconciled states',()=>{
  assert.deepEqual(auctions().auctionAllocations(record('a','2026-10-07')),{status:'complete',denominator:1000,primaryDealerShare:20,directShare:10,indirectShare:70,reconciliationDifference:0});
  const partial=auctions().auctionAllocations(record('b','2026-10-07',{directAccepted:null}));
  assert.equal(partial.status,'partial');assert.equal(partial.directShare,null);assert.equal(partial.indirectShare,70);
  const invalid=auctions().auctionAllocations(record('c','2026-10-07',{indirectAccepted:800}));
  assert.equal(invalid.status,'unreconciled');assert.equal(invalid.indirectShare,null);
  assert.equal(auctions().auctionAllocations({competitiveAccepted:0}).status,'unavailable');
  assert.equal(auctions().auctionAllocations({competitiveAccepted:'1000'}).denominator,null);
});

test('known bidder awards exceeding competitive accepted are unreconciled even with a missing category',()=>{
  const result=auctions().auctionAllocations(record('partial-invalid','2026-10-07',{primaryDealerAccepted:800,directAccepted:null,indirectAccepted:800}));
  assert.equal(result.status,'unreconciled');
  assert.equal(result.primaryDealerShare,null);
  assert.equal(result.directShare,null);
  assert.equal(result.indirectShare,null);
});

test('auction benchmarks use only prior matching instrument, original term, reopening and cash-management class',()=>{
  const selected=record('selected','2026-10-07',{bidToCover:2.8});
  const source={auctions:[
    record('p1','2026-08-12',{bidToCover:2.4}),record('p2','2026-09-09',{bidToCover:2.6}),
    record('new','2026-09-10',{reopening:false,bidToCover:9}),record('tips','2026-09-10',{securityType:'TIPS',bidToCover:9}),
    record('term','2026-09-10',{originalTerm:'7-Year',bidToCover:9}),record('cash','2026-09-10',{cashManagement:true,bidToCover:9}),
    record('pending','2026-09-10',{status:'announced',bidToCover:null}),record('same-day','2026-10-07',{bidToCover:9}),
    record('future','2026-11-04',{bidToCover:9}),selected,
  ]};
  const result=auctions().benchmarkAuction(source,'selected');
  assert.deepEqual(result.peers.map(row=>row.id),['p2','p1']);
  assert.equal(result.sampleSize,2);
  assert.deepEqual(result.metrics.bidToCover,{current:2.8,median:2.5,difference:0.3,unit:'ratio',sampleSize:2});
  assert.equal(result.metrics.indirectShare.median,70);
  assert.equal(result.metrics.offeringAmount.median,39e9);
  assert.equal(auctions().benchmarkAuction(source,'selected',{limit:1}).metrics.bidToCover.median,2.6);
  assert.equal(auctions().benchmarkAuction(source,'missing').auction,null);
  assert.throws(()=>auctions().benchmarkAuction(source,'selected',{limit:0}),/limit/i);
  source.auctions[0].directAccepted=null;
  assert.equal(auctions().benchmarkAuction(source,'selected').metrics.directShare.sampleSize,1,'each median must disclose its own usable observation count');
});

test('bill benchmarks match the auctioned remaining term as well as the original term',()=>{
  const source={auctions:[record('bill','2026-10-15',{securityType:'Bill',securityTerm:'8-Week',originalTerm:'17-Week'}),
    record('match','2026-10-08',{securityType:'Bill',securityTerm:'8-Week',originalTerm:'17-Week'}),
    record('short','2026-10-01',{securityType:'Bill',securityTerm:'4-Week',originalTerm:'17-Week'})]};
  assert.deepEqual(auctions().benchmarkAuction(source,'bill').peers.map(row=>row.id),['match']);
  source.auctions[0].reopening=null;
  assert.equal(auctions().benchmarkAuction(source,'bill').sampleSize,0);
});

test('monthly offering totals are flows by auction date, mark pending/current months and preserve missing amounts/months',()=>{
  const source=[record('sep','2026-09-30',{offeringAmount:10e9,issueDate:'2026-10-02'}),record('oct1','2026-10-01',{offeringAmount:20e9}),
    record('oct2','2026-10-07',{offeringAmount:30e9}),record('pending','2026-10-21',{status:'announced',bidToCover:null,offeringAmount:99e9})];
  const result=auctions().aggregateAuctionOfferings(source,{startDate:'2026-08-01',endDate:'2026-10-21'});
  assert.deepEqual(result.map(row=>({date:row.date,value:row.value,auctionCount:row.auctionCount,pendingCount:row.pendingCount,partial:row.partial})),[
    {date:'2026-08-01',value:null,auctionCount:0,pendingCount:0,partial:true},
    {date:'2026-09-01',value:10,auctionCount:1,pendingCount:0,partial:false},
    {date:'2026-10-01',value:50,auctionCount:2,pendingCount:1,partial:true},
  ]);
  source[1].offeringAmount=null;
  assert.equal(auctions().aggregateAuctionOfferings(source,{startDate:'2026-10-01',endDate:'2026-10-21'})[0].value,null);
  assert.ok(result.every(row=>row.publishedAt===null));
});
