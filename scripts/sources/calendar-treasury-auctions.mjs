import {requestText} from './http.mjs';
import {easternFields} from './calendar-utils.mjs';
import {treasuryAuctionEvents} from '../../src/treasury-auction-calendar.js';

export const TREASURY_ANNOUNCED_URL='https://www.treasurydirect.gov/TA_WS/securities/announced?format=json';
const date=value=>{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T00:00:00$/.test(value))throw new Error('Invalid TreasuryDirect announced date');
  const key=value.slice(0,10),parsed=new Date(`${key}T00:00:00Z`);
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==key)throw new Error('Invalid TreasuryDirect announced date');
  return key;
};
const flag=value=>{
  if(value==='Yes')return true;if(value==='No')return false;if(value==='')return null;
  throw new Error('Invalid TreasuryDirect announced instrument flag');
};
const term=value=>{if(typeof value!=='string'||!value.trim()||value.length>80||/[<>\x00-\x1f\x7f]/.test(value))throw new Error('Invalid TreasuryDirect announced term');return value;};

export function parseAnnouncedTreasuryAuctions(payload,{coverageStart,coverageEnd,asOf}={}){
  if(!Array.isArray(payload)||!payload.length||payload.length>1000)throw new Error('Invalid or unbounded TreasuryDirect announcement array');
  const seen=new Set();
  return payload.flatMap(raw=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid TreasuryDirect announcement record');
    const auctionDate=date(raw.competitiveAuctionCloseDate),announcementDate=date(raw.announcementDate);
    if(auctionDate<coverageStart||auctionDate>coverageEnd)return [];
    if(announcementDate>asOf||announcementDate>auctionDate)throw new Error('Unannounced TreasuryDirect auction');
    const floating=flag(raw.floatingRate),indexed=flag(raw.inflationProtected),base=raw.securityType;
    if(!['Bill','Note','Bond'].includes(base)||(floating&&indexed)||(base==='Bill'&&(floating||indexed))||(floating&&base!=='Note')||(base!=='Bill'&&(floating===null||indexed===null)))throw new Error('Unrecognized TreasuryDirect auction instrument');
    const securityType=floating?'FRN':indexed?'TIPS':base,securityTerm=term(raw.securityTerm),maturityDate=date(raw.maturityDate),issueDate=date(raw.issueDate);
    if(issueDate<auctionDate||maturityDate<=issueDate)throw new Error('Invalid TreasuryDirect announcement date order');
    const id=`auction-${auctionDate}-${securityType.toLowerCase()}-${securityTerm.toLowerCase().replaceAll(' ','-')}-${maturityDate}`;
    if(seen.has(id))throw new Error('Duplicate TreasuryDirect announced identity');seen.add(id);
    let offeringAmount=null;
    if(raw.offeringAmount!==''){
      if(typeof raw.offeringAmount!=='string'||!/^\d+(?:\.\d+)?$/.test(raw.offeringAmount))throw new Error('Invalid TreasuryDirect offering amount');
      offeringAmount=Number(raw.offeringAmount);if(!Number.isSafeInteger(offeringAmount))throw new Error('Invalid TreasuryDirect offering amount');
    }
    return [{id,auctionDate,announcementDate,issueDate,maturityDate,securityType,securityTerm,originalTerm:term(raw.originalSecurityTerm),
      offeringAmount,reopening:flag(raw.reopening),cashManagement:flag(raw.cashManagementBill),sourceReceiptIndex:0,sourceUrl:TREASURY_ANNOUNCED_URL}];
  }).sort((a,b)=>a.auctionDate.localeCompare(b.auctionDate)||a.id.localeCompare(b.id));
}

/** Independent bounded supplement; the complete historical auction source remains untouched. */
export async function collectTreasuryAuctionCalendar({fetchImpl=globalThis.fetch,now=new Date()}={}) {
  if (!(now instanceof Date)||!Number.isFinite(now.getTime())) throw new Error('Invalid Treasury funding calendar capture date');
  const today=easternFields(now.toISOString()).date,midnight=Date.parse(`${today}T00:00:00Z`);
  const coverageStart=new Date(midnight-30*86400000).toISOString().slice(0,10),coverageEnd=new Date(midnight+90*86400000).toISOString().slice(0,10);
  const url=TREASURY_ANNOUNCED_URL,response=await requestText(url,{fetchImpl,maxBytes:4*1024*1024});
  if(response.url!==url)throw new Error('Unreviewed Treasury funding calendar redirect');
  const auctions=parseAnnouncedTreasuryAuctions(JSON.parse(response.text),{coverageStart,coverageEnd,asOf:today});
  if(!auctions.length)throw new Error('No in-scope Treasury funding announcements returned');
  const {text:_text,...receipt}=response;
  const source={id:'treasury-auctions',status:'ok',fetchedAt:receipt.retrievedAt,lastAttemptAt:receipt.retrievedAt,asOf:today,coverageStart,coverageEnd,
    auctions,provenance:[receipt],warnings:[],
    coverageNote:'Individually announced Treasury auction and issue / settlement dates from the TreasuryDirect announced-securities feed, filtered to auction dates 30 days before through 90 days after capture. Only returned announcements are included; the date bounds do not establish complete future coverage and no regular auction pattern is generated. Offering amounts are gross announced face amounts, not net borrowing, accepted awards or settlement cash proceeds. Auction and settlement clocks are not imported; dates alone do not establish results. Source credit: U.S. Treasury, Bureau of the Fiscal Service. This supplement is independent of the complete historical auction capture.',
  };
  source.events=treasuryAuctionEvents(source);
  if(!source.events.some(event=>event.date>=today))source.warnings.push('No upcoming auction or settlement dates are retained in this capture. Consult official announcements for new dates.');
  return source;
}
