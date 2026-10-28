import {isDeepStrictEqual} from 'node:util';
import {TREASURY_ANNOUNCED_URL} from './sources/calendar-treasury-auctions.mjs';
import {treasuryAuctionEvents} from '../src/treasury-auction-calendar.js';

export const treasuryAuctionCalendarPolicy={reviewedOn:'2026-10-27',commercialUse:true,
  basis:'Scoped TreasuryDirect numerical announcement facts and noncreative dates/classifications, supported by Copyright Office facts/title exclusions and federal official-duty works rule. Commercial factual reuse with Treasury attribution, without endorsement; no blanket TreasuryDirect/API license or CC0 claim. No narrative, CUSIPs, close times, publication instants or projected cash flows.',
  terms:['https://www.copyright.gov/what-is-copyright/','https://www.copyright.gov/title17/92chap1.html#105','https://www.treasurydirect.gov/legal-information/developers/web-api-security/'],
};

/** Standalone supplement admission; immutable official snapshots keep their existing policy and bytes. */
export function assertTreasuryAuctionCalendar(source) {
  const fail=()=>{throw new Error('Unreviewed Treasury auction calendar facts, dates or provenance');};
  const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
  if(source?.id!=='treasury-auctions'||source.status!=='ok'||!date(source.asOf)||!date(source.coverageStart)||!date(source.coverageEnd)||!Array.isArray(source.auctions)||source.auctions.length<1||source.auctions.length>2000||!Array.isArray(source.provenance)||source.provenance.length!==1)fail();
  const midnight=Date.parse(`${source.asOf}T00:00:00Z`);
  if(source.coverageStart!==new Date(midnight-30*86400000).toISOString().slice(0,10)||source.coverageEnd!==new Date(midnight+90*86400000).toISOString().slice(0,10))fail();
  const receipt=source.provenance[0];
  if(receipt.url!==TREASURY_ANNOUNCED_URL||!/^[a-f0-9]{64}$/.test(receipt.sha256)||!Number.isFinite(Date.parse(receipt.retrievedAt))||source.fetchedAt!==receipt.retrievedAt||Object.hasOwn(receipt,'text'))fail();
  const identities=new Set();
  const fields=['id','auctionDate','announcementDate','issueDate','maturityDate','securityType','securityTerm','originalTerm','offeringAmount','reopening','cashManagement','sourceReceiptIndex','sourceUrl'];
  for(const row of source.auctions){
    if(!row||Object.keys(row).length!==fields.length||Object.keys(row).some(key=>!fields.includes(key))||row.sourceReceiptIndex!==0||row.sourceUrl!==receipt.url||typeof row.id!=='string'||identities.has(row.id)||!['Bill','Note','Bond','FRN','TIPS'].includes(row.securityType))fail();
    if(![row.auctionDate,row.issueDate,row.announcementDate,row.maturityDate].every(date)||row.auctionDate<source.coverageStart||row.auctionDate>source.coverageEnd||row.announcementDate>source.asOf||row.announcementDate>row.auctionDate||row.issueDate<row.auctionDate||row.maturityDate<=row.issueDate)fail();
    if(row.offeringAmount!==null&&(typeof row.offeringAmount!=='number'||!Number.isFinite(row.offeringAmount)||row.offeringAmount<0))fail();
    if(![row.reopening,row.cashManagement].every(value=>value===true||value===false||value===null))fail();
    identities.add(row.id);
  }
  if(!isDeepStrictEqual(source.events,treasuryAuctionEvents(source)))fail();
  return true;
}
