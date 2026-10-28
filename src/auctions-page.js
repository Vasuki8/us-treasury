import {readingGroup,supportingDetails} from './page-hierarchy.js';
import {dataStatus} from './data.js';
import {auctionAllocations,benchmarkAuction} from './auctions.js';
import {csvCell} from './model.js';
import {canonicalJson} from './research-workspaces.js';
import {heading,button,panel,table,chart,emptyState,escapeHtml as esc} from './ui.js';

const types=['All','Bill','Note','Bond','FRN','TIPS'];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const number=(value,precision=2)=>finite(value)?value.toLocaleString('en-US',{minimumFractionDigits:precision,maximumFractionDigits:precision}):'—';
const money=value=>finite(value)?`$${number(value/1e9)}B`:'—';
const percent=value=>finite(value)?`${number(value,1)}%`:'—';
const rate=value=>finite(value)?`${number(value,3)}%`:'—';
const status=source=>source?.fetchedAt?(source.status==='ok'?'CAPTURED':'CACHED'):'UNAVAILABLE';
const limitation='Indirect bidders are not a foreign-investor category; direct and indirect bidders can be domestic or foreign. No auction tail is calculated because a reliable, licensed, timestamp-matched when-issued quote has not been admitted.';

export function auctionSelection(source,securityType='All',auctionId=''){
  const type=types.includes(securityType)?securityType:'All';
  const rows=(source?.auctions??[]).filter(row=>type==='All'||row.securityType===type).sort((a,b)=>b.auctionDate.localeCompare(a.auctionDate)||a.id.localeCompare(b.id));
  const selected=rows.find(row=>row.id===auctionId)??rows.find(row=>row.status==='results')??rows[0]??null;
  return {type,rows,selected};
}

function externalLink(value,label){
  try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;}catch{/* Unavailable source links remain text. */}
  return esc(label);
}

function allocationTable(selected){
  const allocation=auctionAllocations(selected);
  const rows=[['Primary dealer',selected.primaryDealerAccepted,allocation.primaryDealerShare],['Direct bidder',selected.directAccepted,allocation.directShare],['Indirect bidder',selected.indirectAccepted,allocation.indirectShare]];
  return `<p class="panel-note">Shares use competitive accepted: <strong>${esc(money(selected.competitiveAccepted))}</strong>. SOMA and noncompetitive awards are separate. Allocation state: ${esc(allocation.status)}.</p>`
    +table(['BIDDER CATEGORY','ACCEPTED / USD','COMPETITIVE SHARE'],rows.map(([name,amount,share])=>`<tr><th scope="row">${esc(name)}</th><td class="num">${esc(money(amount))}</td><td class="num">${esc(percent(share))}</td></tr>`).join(''),'Competitive award allocation; percentages are Meridian calculations.')
    +`<p class="panel-note">Total accepted including add-ons: ${esc(money(selected.totalAccepted))}. SOMA accepted: ${esc(money(selected.somaAccepted))}. These amounts are not the competitive-share denominator. Indirect bidders are not a foreign-investor category; direct and indirect bidders can be domestic or foreign.</p>`;
}

function benchmarkTable(source,selected){
  const benchmark=benchmarkAuction(source,selected.id);
  const names={bidToCover:'Bid-to-cover',offeringAmount:'Face offering amount',primaryDealerShare:'Primary dealer share',directShare:'Direct bidder share',indirectShare:'Indirect bidder share'};
  const formatted=(name,value,change=false)=>name==='offeringAmount'?money(value):name==='bidToCover'?`${number(value)}${finite(value)?'×':''}`:change?`${number(value,1)}${finite(value)?' pp':''}`:percent(value);
  const rows=Object.entries(benchmark.metrics).map(([name,metric])=>`<tr><th scope="row">${esc(names[name])}</th><td class="num">${esc(formatted(name,metric.current))}</td><td class="num">${esc(formatted(name,metric.median))}</td><td class="num">${esc(formatted(name,metric.difference,true))}</td><td class="num">${metric.sampleSize}</td></tr>`).join('');
  return `<p class="panel-note">${benchmark.sampleSize} prior matching auctions, up to 12. Each median reports its own usable sample size.</p>`+table(['METRIC','SELECTED','PRIOR MEDIAN','DIFFERENCE','N'],rows)
    +`<p class="panel-note">${esc(benchmark.basis)} Medians across categories are not an additive decomposition. A low sample size limits the comparison.</p>`;
}

export function auctionsPage(state={},source=dataStatus.sources.auctions){
  const {type,rows,selected}=auctionSelection(source,state.auctionType,state.auctionId);
  const pageSize=60,page=selected?Math.floor(rows.findIndex(row=>row.id===selected.id)/pageSize):0,pageCount=Math.max(1,Math.ceil(rows.length/pageSize));
  const visibleRows=rows.slice(page*pageSize,(page+1)*pageSize);
  const pageButton=(label,index,disabled)=>button(label,`data-auction-id="${esc(rows[index*pageSize]?.id??'')}" data-auction-history-page${disabled?' disabled':''}`);
  const pager=pageCount>1?`<div class="toolbar" role="group" aria-label="Auction history pages"><span class="small muted">History page ${page+1} of ${pageCount} · ${esc(visibleRows.at(-1)?.auctionDate)} to ${esc(visibleRows[0]?.auctionDate)}</span><div class="actions">${pageButton('NEWEST',0,page===0)}${pageButton('NEWER',Math.max(0,page-1),page===0)}${pageButton('OLDER',Math.min(pageCount-1,page+1),page===pageCount-1)}${pageButton('OLDEST',pageCount-1,page===pageCount-1)}</div></div>`:'';
  const controls=`<div class="toolbar"><label for="auction-type">Security type <select id="auction-type">${types.map(value=>`<option value="${value}"${value===type?' selected':''}>${value}</option>`).join('')}</select></label><span class="small muted">${rows.length} matching records · ${visibleRows.length} shown; CSV includes all matching records.</span></div>`;
  const history=rows.length?table(['AUCTION / EASTERN DATE','SECURITY','FACE OFFERING','BID-TO-COVER','STATE'],visibleRows.map(row=>`<tr${row.id===selected?.id?' class="selected-row"':''}><th scope="row">${button(row.auctionDate,`data-auction-id="${esc(row.id)}" aria-pressed="${row.id===selected?.id}"`,'link-button')}</th><td>${esc(row.securityType)} · ${esc(row.securityTerm)}<span class="table-code muted">Original ${esc(row.originalTerm??'unknown')} · ${row.reopening===true?'reopening':row.reopening===false?'new issue':'reopening unknown'}${row.cashManagement?' · cash management':''}</span></td><td class="num">${esc(money(row.offeringAmount))}</td><td class="num">${esc(number(row.bidToCover))}</td><td><span class="pill">${row.status==='results'?'RESULTS':'AWAITING RESULTS'}</span></td></tr>`).join(''),'Select a Treasury auction; auction dates are separate from issue and maturity dates.')+pager:emptyState('No auctions match these filters.','Choose another security type. Missing observations are not replaced with another instrument.');
  const details=selected?`<h3 class="detail-title">${esc(selected.auctionDate)} · ${esc(selected.securityType)} · ${esc(selected.securityTerm)}</h3><p class="panel-note"><strong>${selected.status==='results'?'REPORTED RESULTS':'AWAITING RESULTS'}</strong> · original term ${esc(selected.originalTerm??'unknown')} · ${selected.reopening===true?'reopening':selected.reopening===false?'new issue':'reopening unknown'}${selected.cashManagement?' · cash-management bill':''}.</p><dl class="facts"><dt>Offering amount / face USD</dt><dd>${esc(money(selected.offeringAmount))}</dd><dt>Official bid-to-cover</dt><dd>${esc(number(selected.bidToCover))}${finite(selected.bidToCover)?'×':''}</dd><dt>Announcement date</dt><dd>${esc(selected.announcementDate??'Unknown')}</dd><dt>Issue date</dt><dd>${esc(selected.issueDate??'Unknown')}</dd><dt>Maturity date</dt><dd>${esc(selected.maturityDate??'Unknown')}</dd><dt>Result release timestamp</dt><dd>Unknown</dd><dt>Nominal / TIPS high yield</dt><dd>${esc(rate(selected.highYield))}</dd><dt>Bill high discount rate</dt><dd>${esc(rate(selected.highDiscountRate))}</dd><dt>FRN high discount margin</dt><dd>${esc(rate(selected.highDiscountMargin))}</dd></dl><p class="panel-note">${externalLink(selected.resultUrl??selected.sourceUrl,selected.resultUrl?'Official auction result':'Official auction data')}. TIPS yields are real yields; nominal yields, bill discount rates and FRN margins have different meanings. No auction tail is inferred without a reliable, licensed, timestamp-matched when-issued quote.</p>`:emptyState('No auction selected.','A verified record is required before presenting results.');
  return heading('AUCTION DEMAND','Official auction facts · calculated bidder shares · matched historical comparisons',button('CSV AUCTIONS','data-export-auctions')+button('CSV MATCHED BENCHMARK','data-export-auction-benchmark'))
    +`<div class="workspace-basis"><p class="panel-note"><strong>WHAT CHANGED.</strong> Select a result to compare its offering size, bid-to-cover and competitive award shares with prior matching auctions. ${esc(status(source))} · retrieved ${esc(source?.fetchedAt??'No successful capture')} · coverage ${esc(source?.coverageStart??'unknown')} through ${esc(source?.coverageEnd??'unknown')}. ${source?.error?`<span class="amber">${esc(source.error)}</span>`:''}</p></div>`
    +readingGroup('Selected auction comparison',controls
    +`<div class="grid g11 workspace-analysis">${panel('02','SELECTED AUCTION',details)}${panel('03','PRIOR MATCHING RESULTS',selected?benchmarkTable(source,selected):emptyState('Matching benchmark unavailable.'))}</div>`
    +panel('04','WHAT CONTRIBUTED — COMPETITIVE AWARD COMPOSITION',selected?allocationTable(selected):emptyState('Award composition unavailable.'),'','Bidder composition describes who submitted accepted competitive bids. It does not establish why auction demand changed.'),'Auction dates are Eastern dates, separate from announcement, issue and maturity dates. Result release timestamps are unknown; capture time is not publication time.')
    +panel('01','AUCTION HISTORY',`<div id="auction-history" tabindex="-1">${history}</div>`)
    +supportingDetails('auctions:monthly-activity','Gross monthly offering activity',panel('05','GROSS MONTHLY OFFERING ACTIVITY',source?.series?.auctionOfferingMonthly?chart(['auctionOfferingMonthly'],{height:190}):emptyState('Monthly offering totals unavailable.'),'','All security types, independent of the history filter. USD billions of face amounts for records with reported results, including rollovers. Current and awaiting-result months are partial; these are not net borrowing or cash proceeds.'))
    +supportingDetails('auctions:methods','Auction interpretation, coverage & methodology',panel('06','WHY IT MATTERS & LIMITATIONS',`<div class="explain"><p><strong>WHY IT MATTERS.</strong> Bid-to-cover describes bids relative to awards under the agency definition; allocation shares show competitive award composition. Comparable prior auctions provide context, without proving a cause or predicting future yields.</p><p><strong>LIMITATIONS.</strong> ${esc(limitation)} Missing allocation amounts remain missing. Unreconciled categories are withheld; incomplete category lists are labeled partial. New issues, reopenings, cash-management bills, FRNs and TIPS are compared only within their stated classes.</p><p>Source record dates can equal future issue dates and are not treated as result release timestamps. Retrieval dates do not establish when a result first became public.</p><p>${esc(source?.coverageNote??'No verified Treasury auction capture is available.')}</p><p>${externalLink('https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/','Treasury Fiscal Data, Bureau of the Fiscal Service')} · ${externalLink('https://www.treasurydirect.gov/help-center/faqs/auction-faqs/','TreasuryDirect bidder definitions')}</p></div>`));
}

export const MAX_GENERATED_AUCTIONS_CSV_BYTES=32*1024*1024;

/** Version-1 generated export: complete selected rows with canonical receipt JSON. */
export function generatedAuctionsCsv(source,options={}){
  return auctionsCsv(source,{...options,canonicalProvenance:true,maxBytes:MAX_GENERATED_AUCTIONS_CSV_BYTES});
}

export function auctionsCsv(source,{securityType='All',auctionId='',benchmark=false,canonicalProvenance=false,maxBytes=Infinity,validateOnly=false}={}){
  if(maxBytes!==Infinity&&(!Number.isSafeInteger(maxBytes)||maxBytes<0))throw new RangeError('CSV byte limit must be a nonnegative integer.');
  if(source?.inputProvenanceScope!=='auction-response-page-v1'&&source?.auctions?.some(row=>Object.hasOwn(row,'sourceReceiptIndex')))throw new Error('Auction response receipt indices require the explicit capture scope.');
  const {rows,selected}=auctionSelection(source,securityType,auctionId),comparison=selected?benchmarkAuction(source,selected.id):null;
  const exported=benchmark?(selected?[selected,...comparison.peers]:[]):rows;
  const receipts=(source?.provenance??[]).map(({url,sha256,retrievedAt,lastModified})=>({url,sha256,retrievedAt,lastModified}));
  const provenance=row=>{
    let retained=receipts;
    if(source?.inputProvenanceScope==='auction-response-page-v1'){
      if(!Number.isInteger(row.sourceReceiptIndex)||row.sourceReceiptIndex<0||row.sourceReceiptIndex>=receipts.length)throw new Error('Auction response receipt index is unavailable.');
      retained=[receipts[row.sourceReceiptIndex]];
    }
    return canonicalProvenance?canonicalJson(retained):JSON.stringify(retained);
  };
  const headers=['auction_id','record_role','auction_date','announcement_date','issue_date','maturity_date','source_record_date','release_date','security_type','security_term','original_term','reopening','cash_management','result_status','offering_amount_usd','competitive_accepted_usd','total_accepted_usd','soma_accepted_usd','primary_dealer_accepted_usd','direct_bidder_accepted_usd','indirect_bidder_accepted_usd','bid_to_cover_ratio','primary_dealer_share_percent','direct_share_percent','indirect_share_percent','allocation_status','high_yield_percent','high_discount_rate_percent','high_discount_margin_percent','observation_types','allocation_calculation','benchmark_bid_to_cover_median','benchmark_bid_to_cover_n','retrieved_at','capture_status','source_url','result_url','coverage_note','limitations','capture_provenance_json'];
  const lines=[],encoder=maxBytes===Infinity?null:new TextEncoder();let bytes=0;
  const append=row=>{
    const line=row.map(cell=>csvCell(canonicalProvenance&&typeof cell==='string'&&/^[\s\u0000-\u001f\u007f]*[=+\-@]/u.test(cell)?`'${cell}`:cell)).join(',')+'\r\n';
    if(encoder&&(bytes+=encoder.encode(line).byteLength)>maxBytes)throw new RangeError('CSV byte limit exceeded for generated auction export.');
    if(!validateOnly)lines.push(line);
  };
  append(headers);
  for(const row of exported){
    const allocation=auctionAllocations(row);
    append([row.id,benchmark?(row.id===selected.id?'selected':'prior-matched'):'filtered-record',row.auctionDate,row.announcementDate,row.issueDate,row.maturityDate,row.sourceRecordDate,null,row.securityType,row.securityTerm,row.originalTerm,row.reopening,row.cashManagement,row.status,row.offeringAmount,row.competitiveAccepted,row.totalAccepted,row.somaAccepted,row.primaryDealerAccepted,row.directAccepted,row.indirectAccepted,row.bidToCover,allocation.primaryDealerShare,allocation.directShare,allocation.indirectShare,allocation.status,row.highYield,row.highDiscountRate,row.highDiscountMargin,'official facts; calculated allocation shares','100 × category accepted / competitive accepted; missing categories remain missing; unreconciled shares withheld',benchmark?comparison.metrics.bidToCover.median:null,benchmark?comparison.metrics.bidToCover.sampleSize:null,source?.fetchedAt??null,status(source),row.sourceUrl,row.resultUrl,source?.coverageNote??'',limitation,provenance(row)]);
  }
  return validateOnly?undefined:lines.join('');
}
