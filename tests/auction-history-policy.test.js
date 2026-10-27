import test from 'node:test';
import assert from 'node:assert/strict';
import {assertResearchData} from '../scripts/research-policy.mjs';

const fields='record_date,security_type,security_term,original_security_term,auction_date,issue_date,maturity_date,announcemt_date,bid_to_cover_ratio,cash_management_bill_cmb,reopening,floating_rate,inflation_index_security,offering_amt,comp_accepted,primary_dealer_accepted,direct_bidder_accepted,indirect_bidder_accepted,total_accepted,soma_accepted,high_yield,high_discnt_rate,high_discnt_margin,xml_filenm_comp_results';
function fixture(){
 const source={inputProvenanceScope:'auction-response-page-v1',coverageStart:'2008-04-07',coverageEnd:'2009-07-01',provenance:[1,2].map(page=>{
  const url=new URL('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query');
  for(const [key,value] of Object.entries({fields,filter:'auction_date:gte:2008-04-07,auction_date:lte:2009-07-01',sort:'auction_date,security_type,security_term,maturity_date','page[size]':'2000','page[number]':String(page)}))url.searchParams.set(key,value);
  return {url:url.href,sha256:String(page).repeat(64),retrievedAt:'2026-10-27T06:00:00Z'};
 }),auctions:[{id:'first',auctionDate:'2008-04-07',securityType:'Bill',publishedAt:null,sourceReceiptIndex:0},{id:'second',auctionDate:'2009-07-01',securityType:'Note',publishedAt:null,sourceReceiptIndex:1}]};
 return {sources:{auctions:source}};
}

test('explicit auction page lineage admits exact pages and keeps legacy sources without inferred indices',()=>{
 const snapshot=fixture();assert.doesNotThrow(()=>assertResearchData(snapshot));
 delete snapshot.sources.auctions.inputProvenanceScope;
 for(const row of snapshot.sources.auctions.auctions)delete row.sourceReceiptIndex;
 assert.doesNotThrow(()=>assertResearchData(snapshot));
});

test('auction lineage rejects dangling, unknown, absent and out-of-range receipt references',()=>{
 for(const mutate of [s=>delete s.inputProvenanceScope,s=>s.inputProvenanceScope='unreviewed',s=>delete s.auctions[0].sourceReceiptIndex,s=>s.auctions[0].sourceReceiptIndex=-1,s=>s.auctions[0].sourceReceiptIndex=2,s=>s.auctions[0].sourceReceiptIndex='0',s=>s.provenance=[]]){
  const snapshot=fixture();mutate(snapshot.sources.auctions);assert.throws(()=>assertResearchData(snapshot),/auction.*provenance/i);
 }
});

test('auction page evidence rejects wrong pages, fields, coverage, sort, endpoints and extra query keys',()=>{
 for(const mutate of [u=>u.searchParams.set('page[number]','2'),u=>u.searchParams.set('page[size]','10000'),u=>u.searchParams.set('fields','auction_date,cusip'),u=>u.searchParams.set('filter','auction_date:gte:2024-01-01,auction_date:lte:2026-10-27'),u=>u.searchParams.set('sort','auction_date'),u=>u.hostname='other.example',u=>u.searchParams.set('extra','unknown')]){
  const snapshot=fixture(),source=snapshot.sources.auctions,url=new URL(source.provenance[0].url);mutate(url);source.provenance[0].url=url.href;
  assert.throws(()=>assertResearchData(snapshot),/auction.*provenance/i);
 }
 const snapshot=fixture();snapshot.sources.auctions.auctions[0].auctionDate='2008-04-01';assert.throws(()=>assertResearchData(snapshot),/auction.*provenance/i);
});
