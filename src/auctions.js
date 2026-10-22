const finite = value => typeof value === 'number' && Number.isFinite(value);
const nonnegative = value => finite(value) && value >= 0;
const clean = value => Number(value.toFixed(10));

function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid auction date');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw new Error('Invalid auction date');
  return value;
}

/** Bidder classes are shares of competitive awards. They do not identify investor domicile. */
export function auctionAllocations(auction = {}) {
  const denominator = nonnegative(auction.competitiveAccepted) && auction.competitiveAccepted > 0 ? auction.competitiveAccepted : null;
  const values = [auction.primaryDealerAccepted,auction.directAccepted,auction.indirectAccepted].map(value => nonnegative(value) ? value : null);
  const complete = values.every(value => value !== null);
  const knownTotal = values.reduce((sum,value) => sum+(value??0),0);
  const difference = denominator !== null && complete ? clean(knownTotal-denominator) : null;
  const invalid = denominator !== null && (knownTotal > denominator+1 || (complete && Math.abs(difference) > 1));
  const status = denominator === null ? 'unavailable' : invalid ? 'unreconciled' : complete ? 'complete' : 'partial';
  const share = value => denominator !== null && !invalid && value !== null ? clean(value/denominator*100) : null;
  return {status,denominator,primaryDealerShare:share(values[0]),directShare:share(values[1]),indirectShare:share(values[2]),reconciliationDifference:difference};
}

function comparisonKey(auction) {
  if (!auction?.originalTerm || typeof auction.reopening !== 'boolean' || typeof auction.cashManagement !== 'boolean') return null;
  return [auction.securityType,auction.originalTerm,auction.reopening,auction.cashManagement,auction.securityType === 'Bill' ? auction.securityTerm : ''].join('|');
}

function median(values) {
  const sorted = values.filter(finite).sort((a,b) => a-b);
  if (!sorted.length) return null;
  const index = Math.floor(sorted.length/2);
  return sorted.length%2 ? sorted[index] : clean((sorted[index-1]+sorted[index])/2);
}

/** Prior observation dates only: no same-day result with an unknown release clock enters the benchmark. */
export function benchmarkAuction(source, id, {limit = 12} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 36) throw new RangeError('Auction benchmark limit must be 1–36');
  const records = source?.auctions ?? [], auction = records.find(row => row.id === id) ?? null;
  const key = comparisonKey(auction);
  const peers = auction && key !== null ? records.filter(row => row.id !== id && row.auctionDate < auction.auctionDate && row.status === 'results' && comparisonKey(row) === key)
    .sort((a,b) => b.auctionDate.localeCompare(a.auctionDate) || a.id.localeCompare(b.id)).slice(0,limit) : [];
  const allocation = row => auctionAllocations(row);
  const accessors = {
    bidToCover:{read:row => row?.bidToCover,unit:'ratio'},
    offeringAmount:{read:row => row?.offeringAmount,unit:'USD'},
    primaryDealerShare:{read:row => allocation(row).primaryDealerShare,unit:'percentage points'},
    directShare:{read:row => allocation(row).directShare,unit:'percentage points'},
    indirectShare:{read:row => allocation(row).indirectShare,unit:'percentage points'},
  };
  const metrics = Object.fromEntries(Object.entries(accessors).map(([name,{read,unit}]) => {
    const raw = auction ? read(auction) : null, current = finite(raw) ? raw : null;
    const usable = peers.map(read).filter(finite), historical = median(usable);
    return [name,{current,median:historical,difference:current !== null && historical !== null ? clean(current-historical) : null,unit,sampleSize:usable.length}];
  }));
  return {
    auction, peers, sampleSize:peers.length, metrics,
    basis:'Prior results with the same instrument, original term, reopening and cash-management class; bills also match the auctioned remaining term. No same-day auction enters the benchmark.',
  };
}

/** Sum announced face offering amounts of auctions with reported results, by auction month, USD billions. */
export function aggregateAuctionOfferings(records, {startDate,endDate} = {}) {
  dateKey(startDate);dateKey(endDate);
  if (startDate > endDate) throw new Error('Invalid auction aggregation date range');
  const groups = new Map();
  for (const row of records) {
    dateKey(row.auctionDate);
    if (row.auctionDate < startDate || row.auctionDate > endDate) continue;
    const key = row.auctionDate.slice(0,7), rows = groups.get(key) ?? [];
    rows.push(row);groups.set(key,rows);
  }
  const rows = [];
  const cursor = new Date(`${startDate.slice(0,7)}-01T00:00:00Z`), endMonth = endDate.slice(0,7);
  while (cursor.toISOString().slice(0,7) <= endMonth) {
    const month = cursor.toISOString().slice(0,7), group = groups.get(month) ?? [];
    const results = group.filter(row => row.status === 'results' && finite(row.bidToCover));
    const pendingCount = group.length-results.length;
    const completeAmounts = results.length > 0 && results.every(row => nonnegative(row.offeringAmount));
    rows.push({
      date:`${month}-01`, value:completeAmounts ? clean(results.reduce((sum,row) => sum+row.offeringAmount,0)/1e9) : null,
      auctionCount:results.length, pendingCount,
      partial:month === endMonth || !completeAmounts || pendingCount > 0 || (month === startDate.slice(0,7) && !startDate.endsWith('-01')),
      publishedAt:null,
    });
    cursor.setUTCMonth(cursor.getUTCMonth()+1);
  }
  return rows;
}
