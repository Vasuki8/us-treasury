import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {collectTreasuryAuctionCalendar,parseAnnouncedTreasuryAuctions,TREASURY_ANNOUNCED_URL} from '../scripts/sources/calendar-treasury-auctions.mjs';
import {assertTreasuryAuctionCalendar} from '../scripts/treasury-calendar-policy.mjs';
import {treasuryAuctionCalendarSnapshot} from '../src/treasury-auction-calendar-snapshot.js';

const raw=(overrides={})=>({competitiveAuctionCloseDate:'2026-10-29T00:00:00',announcementDate:'2026-10-27T00:00:00',issueDate:'2026-11-03T00:00:00',maturityDate:'2026-12-01T00:00:00',securityType:'Bill',securityTerm:'4-Week',originalSecurityTerm:'17-Week',offeringAmount:'115000000000',reopening:'Yes',cashManagementBill:'No',floatingRate:'',inflationProtected:'',cusip:'EXCLUDED',competitiveAuctionCloseTime:'11:30 AM',narrative:'EXCLUDED',...overrides});
const scope={coverageStart:'2026-09-27',coverageEnd:'2027-01-25',asOf:'2026-10-27'};

test('Treasury announcement collector keeps exact dated facts, gross amounts and response receipt while excluding identifiers and clocks',async()=>{
  const text=JSON.stringify([raw(),raw({securityType:'Note',securityTerm:'2-Year',originalSecurityTerm:'2-Year',floatingRate:'Yes',inflationProtected:'No',maturityDate:'2028-10-31T00:00:00',offeringAmount:'30000000000'})]);
  const calls=[];
  const source=await collectTreasuryAuctionCalendar({now:new Date('2026-10-27T23:30:00Z'),fetchImpl:async url=>{calls.push(url);return new Response(text);}});
  assert.deepEqual(calls,[TREASURY_ANNOUNCED_URL]);assert.equal(source.events.length,4);
  assert.equal(source.auctions[0].offeringAmount,115e9);assert.ok(source.auctions.some(row=>row.securityType==='FRN'));
  assert.ok(source.events.every(event=>event.time===null&&event.scheduledAt===null&&event.scheduleBasis==='announced-date'));
  assert.ok(source.events.some(event=>event.program==='settlement'&&event.date==='2026-11-03'));
  assert.equal(source.provenance[0].sha256,createHash('sha256').update(text).digest('hex'));
  assert.doesNotMatch(JSON.stringify(source),/EXCLUDED|11:30|cusip/);
  assert.equal(assertTreasuryAuctionCalendar(source),true);
});

test('announcement parser rejects malformed dates, duplicate identities, impossible instruments and unknown schemas',()=>{
  for(const rows of [[],{},[raw(),raw()],[raw({offeringAmount:'1e10'})],[raw({competitiveAuctionCloseDate:'2026-02-30T00:00:00'})],[raw({announcementDate:'2026-10-30T00:00:00'})],[raw({floatingRate:'Yes'})],[raw({cashManagementBill:'maybe'})],[raw({securityType:'Other'})]])assert.throws(()=>parseAnnouncedTreasuryAuctions(rows,scope),/Treasury|announc|Duplicate|instrument/);
  assert.equal(parseAnnouncedTreasuryAuctions([raw({offeringAmount:''})],scope)[0].offeringAmount,null);
  assert.deepEqual(parseAnnouncedTreasuryAuctions([raw({competitiveAuctionCloseDate:'2026-09-01T00:00:00',announcementDate:'2026-08-31T00:00:00'})],scope),[]);
});

test('separate supplement admission rejects altered times, amounts, feeds and extra retained content',()=>{
  assert.equal(assertTreasuryAuctionCalendar(treasuryAuctionCalendarSnapshot),true);
  for(const change of [s=>s.events[0].time='13:00',s=>s.events[0].offeringAmount=0,s=>s.auctions[0].cusip='EXCLUDED',s=>s.provenance[0].url='https://vendor.example/announced',s=>s.coverageEnd='2027-12-31']){
    const changed=structuredClone(treasuryAuctionCalendarSnapshot);change(changed);assert.throws(()=>assertTreasuryAuctionCalendar(changed),/Unreviewed/);
  }
  assert.ok(treasuryAuctionCalendarSnapshot.events.some(event=>event.program==='auction'&&event.date>treasuryAuctionCalendarSnapshot.asOf),'real capture must supply actual future announced auctions');
});

test('failed or redirected announcement capture fails before any local snapshot replacement',async()=>{
  for(const fetchImpl of [async()=>new Response('Unavailable',{status:503}),async()=>new Response('{}'),async()=>{const response=new Response(JSON.stringify([raw()]));Object.defineProperty(response,'url',{value:'https://vendor.example/announced'});return response;}])await assert.rejects(collectTreasuryAuctionCalendar({now:new Date('2026-10-27T23:30:00Z'),fetchImpl}));
});
