import { requestText } from './http.mjs';
import { easternFields } from './calendar-utils.mjs';
import { aggregateAuctionOfferings, auctionAllocations } from '../../src/auctions.js';

export const AUCTIONS_ENDPOINT = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query';
const fields = ['record_date','security_type','security_term','original_security_term','auction_date','issue_date','maturity_date','announcemt_date','bid_to_cover_ratio','cash_management_bill_cmb','reopening','floating_rate','inflation_index_security','offering_amt','comp_accepted','primary_dealer_accepted','direct_bidder_accepted','indirect_bidder_accepted','total_accepted','soma_accepted','high_yield','high_discnt_rate','high_discnt_margin','xml_filenm_comp_results'];
const missing = value => value === null || value === undefined || String(value).trim() === '' || String(value).trim().toLowerCase() === 'null';

function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid Treasury auction date');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw new Error('Invalid Treasury auction date');
  return value;
}

function number(value,{signed=false}={}) {
  if (missing(value)) return null;
  const text = String(value).trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) throw new Error('Invalid Treasury auction number');
  const parsed = Number(text);
  if (!Number.isFinite(parsed) || Math.abs(parsed) > Number.MAX_SAFE_INTEGER || (!signed && parsed < 0)) throw new Error('Invalid Treasury auction number');
  return parsed;
}

function flag(value) {
  if (missing(value)) return null;
  if (value === 'Yes') return true;
  if (value === 'No') return false;
  throw new Error('Invalid Treasury auction flag');
}

function term(value,required=false) {
  if (missing(value) && !required) return null;
  if (typeof value !== 'string' || !value.trim() || value.length > 80 || /[<>\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid Treasury auction term');
  return value.trim();
}

/** Only normalized federal auction facts are retained. No CUSIP identifiers or raw response bodies. */
export function parseAuctions(payload,{sourceUrl=AUCTIONS_ENDPOINT}={}) {
  if (!payload || !Array.isArray(payload.data)) throw new Error('Invalid Treasury auction response');
  const seen = new Set();
  return payload.data.map(row => {
    const floating = flag(row.floating_rate), indexed = flag(row.inflation_index_security), baseType = row.security_type;
    if (!['Bill','Note','Bond'].includes(baseType) || floating === null || indexed === null || (floating && indexed) || (baseType === 'Bill' && (floating || indexed)) || (floating && baseType !== 'Note')) throw new Error('Unrecognized Treasury auction instrument');
    const securityType = floating ? 'FRN' : indexed ? 'TIPS' : baseType;
    const auctionDate = dateKey(row.auction_date), securityTerm = term(row.security_term,true), maturityDate = dateKey(row.maturity_date);
    const id = `auction-${auctionDate}-${securityType.toLowerCase()}-${securityTerm.toLowerCase().replaceAll(' ','-')}-${maturityDate}`;
    if (seen.has(id)) throw new Error('Duplicate Treasury auction identity');
    seen.add(id);
    const filename = missing(row.xml_filenm_comp_results) ? null : String(row.xml_filenm_comp_results);
    if (filename && (!/^R_\d{8}_\d+\.xml$/.test(filename) || !filename.startsWith(`R_${auctionDate.replaceAll('-','')}_`))) throw new Error('Unrecognized Treasury auction result filename');
    const result = {
      id,auctionDate,issueDate:dateKey(row.issue_date),maturityDate,announcementDate:dateKey(row.announcemt_date),sourceRecordDate:dateKey(row.record_date),publishedAt:null,
      securityType,securityTerm,originalTerm:term(row.original_security_term),reopening:flag(row.reopening),cashManagement:flag(row.cash_management_bill_cmb),
      offeringAmount:number(row.offering_amt),competitiveAccepted:number(row.comp_accepted),primaryDealerAccepted:number(row.primary_dealer_accepted),directAccepted:number(row.direct_bidder_accepted),indirectAccepted:number(row.indirect_bidder_accepted),
      totalAccepted:number(row.total_accepted),somaAccepted:number(row.soma_accepted),bidToCover:number(row.bid_to_cover_ratio),
      highYield:number(row.high_yield,{signed:true}),highDiscountRate:number(row.high_discnt_rate,{signed:true}),highDiscountMargin:number(row.high_discnt_margin,{signed:true}),
      resultUrl:filename ? `https://www.treasurydirect.gov/xml/${filename}` : null,sourceUrl,
    };
    result.status = result.bidToCover === null ? 'announced' : 'results';
    result.allocations = auctionAllocations(result);
    return result;
  }).sort((a,b) => a.auctionDate.localeCompare(b.auctionDate) || a.id.localeCompare(b.id));
}

function pageUrl(startDate,endDate,page) {
  const url = new URL(AUCTIONS_ENDPOINT);
  url.searchParams.set('fields',fields.join(','));
  url.searchParams.set('filter',`auction_date:gte:${startDate},auction_date:lte:${endDate}`);
  url.searchParams.set('sort','auction_date,security_type,security_term,maturity_date');
  url.searchParams.set('page[size]','2000');url.searchParams.set('page[number]',String(page));
  return url.href;
}

export async function collectAuctions({fetchImpl=globalThis.fetch,now=new Date()}={}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid Treasury auction capture date');
  const endDate = easternFields(now.toISOString()).date;
  const start = new Date(`${endDate.slice(0,7)}-01T00:00:00Z`);start.setUTCFullYear(start.getUTCFullYear()-2);
  const startDate = start.toISOString().slice(0,10), sourceUrl = pageUrl(startDate,endDate,1);
  const responses = [], rawRows = [];
  let expectedPages = null, expectedCount = null;
  for (let page=1;page <= (expectedPages ?? 1);page++) {
    const response = await requestText(pageUrl(startDate,endDate,page),{fetchImpl,maxBytes:6*1024*1024});
    const payload = JSON.parse(response.text), meta = payload?.meta;
    if (!Array.isArray(payload?.data) || !Number.isInteger(meta?.count) || meta.count !== payload.data.length || !Number.isInteger(meta['total-pages']) || meta['total-pages'] < 1 || meta['total-pages'] > 10 || !Number.isInteger(meta['total-count']) || meta['total-count'] < 1 || meta['total-count'] > 10000) throw new Error('Invalid or unbounded Treasury auction page metadata');
    if (expectedPages !== null && (meta['total-pages'] !== expectedPages || meta['total-count'] !== expectedCount)) throw new Error('Treasury auction pagination count changed during capture');
    expectedPages = meta['total-pages'];expectedCount = meta['total-count'];
    responses.push(response);rawRows.push(...payload.data);
  }
  if (rawRows.length !== expectedCount) throw new Error('Incomplete Treasury auction response count');
  const auctions = parseAuctions({data:rawRows});
  if (auctions.some(row => row.auctionDate < startDate || row.auctionDate > endDate)) throw new Error('Treasury auction dates fall outside requested coverage');
  const results = auctions.filter(row => row.status === 'results');
  if (!results.length) throw new Error('No usable Treasury auction results');
  const pendingCount = auctions.length-results.length, incompleteAllocations = results.filter(row => row.allocations.status !== 'complete').length;
  return {
    id:'auctions',fetchedAt:responses.map(row => row.retrievedAt).sort().at(-1),coverageStart:startDate,coverageEnd:endDate,lastResultsDate:results.at(-1).auctionDate,pendingCount,
    coverageNote:'Two complete years plus the current month of Treasury auction records. Rows without reported bid-to-cover remain awaiting results even after the scheduled date. Source record dates may be issue dates; exact historical result release timestamps are not established. Offering totals are face amounts of auctions with reported results, include rollovers, and are not net borrowing or cash proceeds. Current and incomplete months are partial.',
    series:{auctionOfferingMonthly:{
      observations:aggregateAuctionOfferings(auctions,{startDate,endDate}),sourceUrl,sourceIds:['offering_amt','auction_date','bid_to_cover_ratio'],observationType:'calculated',dataStatus:'calculated',
      calculation:'Sum offering_amt / 1e9 by auction_date calendar month, restricted to rows with a published non-null bid_to_cover_ratio. USD billions of face offering amounts; not accepted awards, net borrowing, or proceeds. Missing amounts/months remain null; current or awaiting-result periods are marked partial.',
    }},
    auctions,
    provenance:responses.map(({text,...metadata}) => metadata),
    warnings:[...(pendingCount ? [`${pendingCount} auction record(s) await reported results.`] : []),...(incompleteAllocations ? [`${incompleteAllocations} result(s) have incomplete or unreconciled bidder allocations.`] : [])],
  };
}
