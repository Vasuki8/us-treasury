import {humanDate} from './ui-time.js';
import {readingGroup,supportingDetails} from './page-hierarchy.js';
import {dataStatus} from './data.js';
import {auctionAllocations,benchmarkAuction,auctionResultState,auctionResultCoverage} from './auctions.js';
import {csvCell,tabularCsv} from './model.js';
import {formatDisplayValue} from './display-format.js';
import {canonicalJson} from './research-workspaces.js';
import {deskReadings,deskContext} from './stitch-desk.js';
import {heading,button,panel,table,chart,emptyState,escapeHtml as esc} from './ui.js';

const types=['All','Bill','Note','Bond','FRN','TIPS'];
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const number=(value,precision=2)=>finite(value)?value.toLocaleString('en-US',{minimumFractionDigits:precision,maximumFractionDigits:precision}):'—';
const money=value=>finite(value)?`${value<0?'−':''}$${number(Math.abs(value)/1e9)}B`:'—';
const percent=value=>finite(value)?`${number(value,1)}%`:'—';
const rate=value=>finite(value)?`${number(value,3)}%`:'—';
const resultRateFor=row=>row?.securityType==='Bill'?row.highDiscountRate:row?.securityType==='FRN'?row.highDiscountMargin:row?.highYield;
const status=source=>source?.fetchedAt?(source.status==='ok'?'CAPTURED':'CACHED'):'UNAVAILABLE';
const limitation='Indirect bidders are not a foreign-investor category; direct and indirect bidders can be domestic or foreign. No auction tail is calculated because a reliable, licensed, timestamp-matched when-issued quote has not been admitted.';

export function auctionSelection(source,securityType='All',auctionId=''){
  const type=types.includes(securityType)?securityType:'All';
  const rows=(source?.auctions??[]).filter(row=>type==='All'||row.securityType===type).sort((a,b)=>b.auctionDate.localeCompare(a.auctionDate)||a.id.localeCompare(b.id));
  const selected=rows.find(row=>row.id===auctionId)??rows.find(row=>row.status==='results')??rows[0]??null;
  return {type,rows,selected};
}

const AUCTION_VIEWS={
 'bid-to-cover':{label:'Bid-to-cover (×)',title:'Matched bid-to-cover history',ids:['auctionBidToCover']},
 allocations:{label:'Allotment shares (%)',title:'Matched competitive award-share history',ids:['auctionDealerShare','auctionDirectShare','auctionIndirectShare']},
 offering:{label:'Offering size ($B)',title:'Matched face-offering history',ids:['auctionOfferingSize']},
};

/** One matched-result model supplies both the chart and its explicit view export. */
export function auctionViewModel(source,state={}){
 const {type,selected}=auctionSelection(source,state.auctionType,state.auctionId);
 const view=Object.hasOwn(AUCTION_VIEWS,state.auctionView)?state.auctionView:'bid-to-cover';
 const range=[6,12,36,'6','12','36'].includes(state.auctionRange)?String(state.auctionRange):'12';
 const benchmark=selected?benchmarkAuction(source,selected.id,{limit:Number(range)}):null;
 const rows=[...(benchmark?.peers??[]),...(selected?[selected]:[])].sort((a,b)=>a.auctionDate.localeCompare(b.auctionDate)||a.id.localeCompare(b.id));
 const definitions=[
  ['auctionBidToCover','bid_to_cover_ratio','Bid-to-cover','Ratio',2,'official',row=>row.bidToCover,'Official Treasury bid-to-cover; not recomputed from total accepted.',['bidToCover']],
  ['auctionDealerShare','primary_dealer_share','Primary dealer share','Percent',1,'calculated',row=>auctionAllocations(row).primaryDealerShare,'100 × primary dealer accepted / competitive accepted; unreconciled shares withheld.',['primaryDealerAccepted','competitiveAccepted']],
  ['auctionDirectShare','direct_share','Direct bidder share','Percent',1,'calculated',row=>auctionAllocations(row).directShare,'100 × direct accepted / competitive accepted; unreconciled shares withheld.',['directAccepted','competitiveAccepted']],
  ['auctionIndirectShare','indirect_share','Indirect bidder share','Percent',1,'calculated',row=>auctionAllocations(row).indirectShare,'100 × indirect accepted / competitive accepted; unreconciled shares withheld.',['indirectAccepted','competitiveAccepted']],
  ['auctionOfferingSize','offering_amount','Face offering','USD billions',2,'calculated',row=>finite(row.offeringAmount)?row.offeringAmount/1e9:null,'Official face offering in USD / 1,000,000,000; gross offering, not net borrowing.',['offeringAmount']],
 ];
 const catalog=Object.fromEntries(definitions.map(([id,code,short,unit,precision,observationType,read,calculation,inputFields])=>[id,{
  id,code,name:`${short} · selected auction and prior matching results`,short,unit,format:unit==='USD billions'?'billions':unit==='Percent'?'percent':'number',precision,frequency:'Daily',dateConvention:'auction-date',adjustment:'Not seasonally adjusted',comparisonClass:unit==='Ratio'?'ratio':unit==='Percent'?'share':'amount',observationType,calculation,
  source:{name:'U.S. Treasury Fiscal Data',url:'https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/',seriesIds:[code]},fetchedAt:source?.fetchedAt??null,provenance:source?.provenance??[],dataStatus:source?.status==='ok'?'official':'cached',
  observations:rows.map(row=>({date:row.auctionDate,value:finite(read(row))?read(row):null,publishedAt:null,sourceValue:row[inputFields[0]],inputFields,inputValues:inputFields.map(field=>finite(row[field])?row[field]:null),inputDates:inputFields.map(()=>row.auctionDate),auctionId:row.id,footnotes:[`${row.securityType} · ${row.securityTerm} · ${auctionResultState(row).label}`]})),
 }]));
 return {type,selected,rows,view,range,catalog,seriesIds:AUCTION_VIEWS[view].ids,title:AUCTION_VIEWS[view].title,benchmark};
}

export function auctionDeskChartCatalog(source,state={}, {frozen=false}={}){
 return {'auction-demand':{catalog:auctionViewModel(source,state).catalog,evidenceLabel:`${frozen?'Frozen':'Captured'} official Treasury auction results; exact prior matching class`}};
}

function auctionViewControls(model){
 return `<div class="specialist-chart-controls"><div class="segmented" role="group" aria-label="Auction chart view">${Object.entries(AUCTION_VIEWS).map(([value,{label}])=>button(label,`data-auction-view="${value}" aria-pressed="${value===model.view}"`)).join('')}${button('WI tail · unavailable','disabled title="Timestamp-matched when-issued quotes are not retained."')}</div><div class="segmented specialist-ranges" role="group" aria-label="Prior matching auction count">${['6','12','36'].map(value=>button(`${value} prior`,`data-auction-range="${value}" aria-pressed="${value===model.range}"`)).join('')}</div></div>`;
}

/** Export only the selected chart's matched rows and displayed metrics; raw exports stay unchanged. */
export function auctionViewCsv(source,state={}){
 if(source?.inputProvenanceScope!=='auction-response-page-v1'&&source?.auctions?.some(row=>Object.hasOwn(row,'sourceReceiptIndex')))throw new Error('Auction response receipt indices require the explicit capture scope.');
 const model=auctionViewModel(source,state),rows=[];
 for(const id of model.seriesIds)for(const observation of model.catalog[id].observations){
  const row=model.rows.find(item=>item.id===observation.auctionId),series=model.catalog[id];
  let provenance=source?.provenance??[];
  if(source?.inputProvenanceScope==='auction-response-page-v1'){
   if(!Number.isInteger(row.sourceReceiptIndex)||row.sourceReceiptIndex<0||row.sourceReceiptIndex>=provenance.length)throw new Error('Auction response receipt index is unavailable.');
   provenance=[provenance[row.sourceReceiptIndex]];
  }
  rows.push([row.id,row.auctionDate,row.issueDate,row.securityType,row.originalTerm,row.reopening,row.cashManagement,model.view,model.range,id,observation.value,series.unit,observation.sourceValue,row.competitiveAccepted,JSON.stringify(observation.inputFields),JSON.stringify(observation.inputValues),JSON.stringify(observation.inputDates),series.calculation,source?.fetchedAt,source?.status==='ok'?'captured':'cached',row.sourceUrl,row.resultUrl,JSON.stringify(provenance),limitation]);
 }
 return tabularCsv(['auction_id','auction_date','issue_date','security_type','original_term','reopening','cash_management','view','prior_matching_limit','series_id','value','unit','source_value','competitive_accepted_usd','input_fields','input_values','input_dates','calculation','retrieved_at','capture_status','source_url','result_url','provenance','limitations'],rows);
}

function externalLink(value,label){
  try{const url=new URL(value);if(url.protocol==='https:'&&!url.username&&!url.password)return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;}catch{/* Unavailable source links remain text. */}
  return esc(label);
}

function allocationTable(selected){
  const allocation=auctionAllocations(selected);
  const rows=[['Primary dealer',selected.primaryDealerAccepted,allocation.primaryDealerShare],['Direct bidder',selected.directAccepted,allocation.directShare],['Indirect bidder',selected.indirectAccepted,allocation.indirectShare]];
  return `<p class="panel-note">Shares use competitive accepted: <strong>${esc(money(selected.competitiveAccepted))}</strong>. SOMA and noncompetitive awards are separate. Allocation state: ${esc(allocation.status)}.</p>`
    +table(['BIDDER CATEGORY',{label:'ACCEPTED / USD',numeric:true},{label:'COMPETITIVE SHARE',numeric:true}],rows.map(([name,amount,share])=>`<tr><th scope="row">${esc(name)}</th><td class="num">${esc(money(amount))}</td><td class="num">${esc(percent(share))}</td></tr>`).join(''),'Competitive award allocation; percentages are Meridian calculations.')
    +`<p class="panel-note">Total accepted including add-ons: ${esc(money(selected.totalAccepted))}. SOMA accepted: ${esc(money(selected.somaAccepted))}. These amounts are not the competitive-share denominator. Indirect bidders are not a foreign-investor category; direct and indirect bidders can be domestic or foreign.</p>`;
}

function benchmarkTable(source,selected){
  const benchmark=benchmarkAuction(source,selected.id);
  const names={bidToCover:'Bid-to-cover',offeringAmount:'Face offering amount',primaryDealerShare:'Primary dealer share',directShare:'Direct bidder share',indirectShare:'Indirect bidder share'};
  const formatted=(name,value,change=false)=>name==='offeringAmount'?money(value):name==='bidToCover'?`${number(value)}${finite(value)?'×':''}`:change?`${number(value,1)}${finite(value)?' pp':''}`:percent(value);
  const rows=Object.entries(benchmark.metrics).map(([name,metric])=>`<tr><th scope="row">${esc(names[name])}</th><td class="num">${esc(formatted(name,metric.current))}</td><td class="num">${esc(formatted(name,metric.median))}</td><td class="num">${esc(formatted(name,metric.difference,true))}</td><td class="num">${metric.sampleSize}</td></tr>`).join('');
  return `<p class="panel-note">${benchmark.sampleSize} prior matching auctions, up to 12. Each median reports its own usable sample size.</p>`+table(['METRIC',...['SELECTED','PRIOR MEDIAN','DIFFERENCE','N'].map(label=>({label,numeric:true}))],rows)
    +`<p class="panel-note">${esc(benchmark.basis)} Medians across categories are not an additive decomposition. A low sample size limits the comparison.</p>`;
}

export function auctionsPage(state={},source=dataStatus.sources.auctions){
  const {type,rows,selected}=auctionSelection(source,state.auctionType,state.auctionId);
  const viewModel=auctionViewModel(source,state);
  const coverage=auctionResultCoverage(source),selectedState=selected?auctionResultState(selected):null;
  const pageSize=60,pageCount=Math.max(1,Math.ceil(rows.length/pageSize)),selectedPage=selected?Math.floor(rows.findIndex(row=>row.id===selected.id)/pageSize):0;
  const page=Number.isInteger(state.auctionHistoryPage)?Math.max(0,Math.min(pageCount-1,state.auctionHistoryPage)):selectedPage;
  const visibleRows=rows.slice(page*pageSize,(page+1)*pageSize);
  const pageButton=(label,index,disabled)=>button(label,`data-auction-history-page="${index}"${disabled?' disabled':''}`);
  const pager=pageCount>1?(`<div class="toolbar" role="group" aria-label="Auction history pages"><span class="small `+
  `muted">History page ${page
  +1} of ${pageCount} · ${esc(humanDate(visibleRows.at(-1)?.auctionDate))} to ${esc(humanDate(visibleRows[0]?.auctionDate))
  }</span><div class="actions">${pageButton('NEWEST',0,page===0)}${pageButton('NEWER',Math.max(0,page-1),page===0)}${pageButton('OLDER',Math.min
  (pageCount-1,page+1),page===pageCount-1)}${pageButton('OLDEST',pageCount-1,page===pageCount-1)}</div></div>`):'';
  const controls=`<div class="toolbar"><label for="auction-type">Security type <select id="auction-type">${types.map(value=>`<option value="${value}"${value===type?' selected':''}>${value}</option>`).join('')}</select></label><span class="small muted">${rows.length} matching records · ${visibleRows.length} shown; CSV includes all matching records.</span></div>`;
  const history=rows.length?table(['AUCTION / EASTERN DATE','ISSUE / SETTLEMENT DATE','SECURITY',{label:'FACE OFFERING',numeric:true},{label:'OFFICIAL RATE',numeric:true},{label:'BID-TO-COVER',numeric:true},{label:'INDIRECT AWARD',numeric:true},{label:'DIRECT AWARD',numeric:true},{label:'DEALER AWARD',numeric:true},'WI TAIL / CONCESSION',
  'STATE'],visibleRows.map(row=>`<tr${row.id===selected?.id?' class="selected-row"':''}><th scope="row">${button(humanDate(row.auctionDate),
  `data-auction-id="${esc(row.id)}" aria-pressed="${row.id===selected?.id}"`,
  'link-button')}</th><td>${esc(humanDate(row.issueDate)||'Not retained')}</td><td>${esc(row.securityType)} · ${esc(row.securityTerm)}<span class="table-code muted">Original ${esc(row.originalTerm
  ??'unknown')} · ${row.reopening===true?'reopening':row.reopening===false?'new issue':'reopening unknown'}${row.cashManagement?
  ' · cash management':''}</span></td><td class="num">${esc(money(row.offeringAmount))}</td><td class="num">${esc(rate(resultRateFor(row)))}</td><td class="num">${esc(number(row.bidToCover))
  }</td><td class="num">${esc(percent(auctionAllocations(row).indirectShare))}</td><td class="num">${esc(percent(auctionAllocations(row).directShare))}</td><td class="num">${esc(percent(auctionAllocations(row).primaryDealerShare))}</td><td class="muted">Unavailable</td><td><span class="pill">${esc(auctionResultState(row).label)}</span></td></tr>`).join(''),
  'Select a Treasury auction; auction dates are separate from issue and maturity dates.')+pager:emptyState('No auctions match these filters.',
  'Choose another security type. Missing observations are not replaced with another instrument.');
  const details=selected?(`<h3 class="detail-title">${esc(humanDate(selected.auctionDate))} · ${esc(selected.securityType)} · ${esc
  (selected.securityTerm)}</h3><p class="panel-note"><strong>${esc(selectedState.label)}</strong> · ${esc(selectedState.note)
  }</p><p class="panel-note">Original term ${esc(selected.originalTerm??'unknown')} · ${selected.reopening===true?'reopening':
  selected.reopening===false?'new issue':'reopening unknown'}${selected.cashManagement?' · cash-management bill':''
  }.</p><dl class="facts"><dt>Offering amount / face USD</dt><dd>${esc(money(selected.offeringAmount))}</dd><dt>Official bid-to-cover</dt><dd>${
  esc(number(selected.bidToCover))}${finite(selected.bidToCover)?'×':''}</dd>${selected.announcementDate?`<dt>Announcement date</dt><dd>${esc
  (humanDate(selected.announcementDate))}</dd>`:''}${selected.issueDate?`<dt>Issue date</dt><dd>${esc(humanDate(selected.issueDate))}</dd>`:''}${
  selected.maturityDate?`<dt>Maturity date</dt><dd>${esc(humanDate(selected.maturityDate))}</dd>`:''}<dt>Nominal / TIPS high yield</dt><dd>${esc
  (rate(selected.highYield))}</dd><dt>Bill high discount rate</dt><dd>${esc(rate(selected.highDiscountRate))
  }</dd><dt>FRN high discount margin</dt><dd>${esc(rate(selected.highDiscountMargin))}</dd></dl><p class="panel-note">${externalLink
  (selected.resultUrl??selected.sourceUrl,selected.resultUrl?'Official auction result':'Official auction data')
  }. TIPS yields are real yields; nominal yields, bill discount rates and FRN margins have `+
  `different meanings. No auction tail is inferred without a reliable, licensed, `+
  `timestamp-matched when-issued quote.</p>`):emptyState('No auction selected.','A verified record is required before presenting results.');
  const selectionSummary=selected?'<div class="auction-selection-summary">'
    +'<p id="auction-selection-status" role="status" aria-live="polite" aria-atomic="true">'
    +`<strong>Selected: ${esc(humanDate(selected.auctionDate))} · ${esc(selected.securityType)} · ${esc(selected.securityTerm)}</strong>`
    +`<span>${esc(formatDisplayValue({format:'number',unit:'USD'},selected.offeringAmount,{currencyUnit:'B'}))} face offering · `
    +`${esc(formatDisplayValue({format:'number'},selected.bidToCover))}${finite(selected.bidToCover)?'× bid-to-cover':''}`
    +` · ${esc(selectedState.label)}</span></p>`
    +button('View selected auction','data-auction-selected aria-controls="auction-selected-result"')
    +(selectedPage!==page?`<span class="small muted">Selected row is on history page ${selectedPage+1}; `
      +'browsing this page keeps that result selected.</span>':'')+'</div>':'';
  const collection=(`<div class="workspace-basis"><p class="panel-note"><strong>WHAT CHANGED.</strong> Select a `+
  `result to compare its offering size, bid-to-cover and competitive award shares with prior `+
  `matching auctions. Latest verified complete results: <strong>${esc(coverage.latestVerifiedDate
  ??'unavailable')}</strong> · latest reported result date ${esc(coverage.latestReportedDate
  ??'unavailable')}. ${coverage.counts.missing} elapsed auctions with results not retained · ${coverage.counts.incomplete
  } incomplete results · ${coverage.counts.announced} announced. ${esc(status(source))} · retrieved ${esc(source?.fetchedAt
  ??'No successful capture')} · coverage ${esc(source?.coverageStart??'unknown')} through ${esc(source?.coverageEnd??'unknown')}. ${source
  ?.error?`<span class="amber">${esc(source.error)}</span>`:''}</p></div>`);
  const allocation=selected?auctionAllocations(selected):{};
  const benchmark=selected?benchmarkAuction(source,selected.id):null;
  const rateLabel=selected?.securityType==='Bill'?'Bill high discount rate':selected?.securityType==='FRN'?'FRN high discount margin':selected?.securityType==='TIPS'?'TIPS real high yield':'Nominal high yield';
  const resultRate=selected?.securityType==='Bill'?selected?.highDiscountRate:selected?.securityType==='FRN'?selected?.highDiscountMargin:selected?.highYield;
  const selectedBasis=selected?`${humanDate(selected.auctionDate)} · ${selected.securityTerm} · ${selectedState.label}`:'No selected result';
  const readings=deskReadings('Selected auction readings',[
    {label:'Headline issue · face offering',value:money(selected?.offeringAmount),change:`${selected?.securityType??'No instrument'} · ${selected?.securityTerm??'No selected result'}`,basis:selectedBasis},
    {label:rateLabel,value:rate(resultRate),change:'Official reported result',basis:selectedBasis},
    {label:'Bid-to-cover',value:finite(selected?.bidToCover)?`${number(selected.bidToCover)}×`:'Unavailable',change:`Prior matching median ${finite(benchmark?.metrics.bidToCover.median)?`${number(benchmark.metrics.bidToCover.median)}×`:'unavailable'}`,basis:selectedBasis},
    {label:'Indirect award',value:percent(allocation.indirectShare),change:'Share of competitive accepted',basis:selectedBasis},
    {label:'Direct award',value:percent(allocation.directShare),change:'Share of competitive accepted',basis:selectedBasis},
    {label:'Dealer absorption',value:percent(allocation.primaryDealerShare),change:'Share of competitive accepted',basis:selectedBasis},
    {label:'When-issued concession / tail',value:'Unavailable',change:'Timestamp-matched WI quote not retained',basis:'No stop-through, concession percentile or stress score is inferred'},
  ]);
  const pillars=deskContext('Auction evidence & coverage',[
    {kicker:'Pillar I · allotment dynamics',title:'Competitive bidder composition',value:percent(allocation.indirectShare),note:'Indirect bidders are not a foreign-investor category. Direct and indirect bidders can be domestic or foreign; SOMA and noncompetitive awards are separate.'},
    {kicker:'Pillar II · dealer take-up',title:'Primary dealer capacity & concessions',value:percent(allocation.primaryDealerShare),note:'Dealer award share measures competitive take-up, not balance-sheet capacity. When-issued pricing: Not covered. Auction tails and pre-auction concessions require a reliable timestamp-matched WI quote.'},
    {kicker:'Pillar III · supply profile',title:'Issuance profile & matched supply',value:`${benchmark?.sampleSize??0} retained peers`,note:'Comparisons match the instrument, original term, reopening and cash-management status. Gross face offerings include rollovers and do not measure net borrowing or projected TBAC funding needs.'},
  ]);
  const demandChart=auctionViewControls(viewModel)+chart(viewModel.seriesIds,{height:300,range:{preset:'all'},legend:true,endLabels:true}).replace('data-chart ','data-chart data-chart-catalog="auction-demand" ');
  const chartNote=`${viewModel.view==='bid-to-cover'?'Ratio':viewModel.view==='allocations'?'Percent of competitive accepted':'USD billions of gross face offerings'} · selected record and ${viewModel.rows.length-(selected?1:0)} prior matching results, up to ${viewModel.range}. Matching class: ${selected?`${selected.securityType}, original ${selected.originalTerm??'unknown'}, ${selected.reopening===true?'reopening':selected.reopening===false?'new issue':'reopening unknown'}${selected.cashManagement===true?', cash management':selected.cashManagement===false?'':', cash-management status unknown'}`:'no selection'}. Different instrument classes and bidder-rule regimes are not combined.`;
  return '<div class="stitch-desk stitch-auction-desk">'+(source?.error?`<p class="panel-note amber">${esc(source.error)}</p>`:'')+heading('AUCTION DEMAND',
  'Official auction facts · calculated bidder shares · matched historical comparisons',button('CSV AUCTIONS','data-export-auctions')
  +button('CSV MATCHED BENCHMARK','data-export-auction-benchmark'))
    +readingGroup('Selected auction comparison',controls+readings
    +`<div class="auction-primary-visualizer workspace-analysis" id="auction-selected-result" tabindex="-1">${panel('00',viewModel.title,demandChart+'<div class="auction-wi-coverage"><strong>When-issued pricing · Not covered</strong><span>Auction tail / stop-through bars are unavailable without timestamp-matched WI quotes. Bid-to-cover, competitive award shares and face offering sizes use retained matching-class results.</span></div>',button('CSV chart view',`data-export-auction-view${selected?'':' disabled'}`),chartNote)}${supportingDetails('auctions:selected-result','Selected auction · exact dates, official rates & result evidence',details,{open:Boolean(selected&&selectedState?.status!=='verified')})}</div>`
    +pillars+panel('02','PRIOR MATCHING RESULTS',selected?benchmarkTable(source,selected):emptyState('Matching benchmark unavailable.'))
    +panel('03','WHAT CONTRIBUTED — COMPETITIVE AWARD COMPOSITION',selected?allocationTable(selected):emptyState('Award composition unavailable.'),'','Bidder composition describes who submitted accepted competitive bids. It does not establish why auction demand changed.'),'Auction dates are Eastern dates, separate from announcement, issue and maturity dates. Result release timestamps are unknown; capture time is not publication time.')
    +panel('04','AUCTION HISTORY',`<div id="auction-history" tabindex="-1">${selectionSummary}<p class="panel-note">Tendered amounts are not retained in this capture. Official bid-to-cover is not inferred from accepted amounts. Issue / settlement dates remain distinct from auction dates.</p>${pager}${history}</div>`)
    +'<div class="auction-bottom-grid">'+panel('05','Treasury supply profile & financing monitor',source?.series?.auctionOfferingMonthly?chart(['auctionOfferingMonthly'],{height:190}):emptyState('Monthly offering totals unavailable.'),'<a class="link-button" href="#/treasury/refunding">Quarterly refunding & TBAC →</a>','All security types, independent of the history filter. USD billions of gross face offerings, including rollovers. Current and awaiting-result months are partial; not net borrowing or cash proceeds.')
    +panel('','Local auction exports & source lineage','<div class="explain"><p>Export the exact filtered auction history or the selected result and its actual prior matching peers. Official rates, competitive-share denominators, incomplete results and capture receipts remain attached.</p><pre><code>auction_id,auction_date,security_type,security_term,\nface_offering_usd,bid_to_cover_ratio,…</code></pre><p>Source dates remain separate from result publication timestamps, which are unknown without independent evidence.</p></div>',button('CSV auctions','data-export-auctions')+button('CSV matched benchmark','data-export-auction-benchmark'))+'</div>'
    +'<div class="stitch-methods">'+supportingDetails('auctions:methods','About this data',collection+panel('06','WHY IT MATTERS & LIMITATIONS',
  (`<div class="explain"><p><strong>WHY IT MATTERS.</strong> Bid-to-cover describes bids `+
  `relative to awards under the agency definition; allocation shares show competitive award `+
  `composition. Comparable prior auctions provide context, without proving a cause or `+
  `predicting future yields.</p><p><strong>LIMITATIONS.</strong> ${esc(limitation)
  } Missing allocation amounts remain missing. Unreconciled categories are withheld; `+
  `incomplete category lists are labeled partial. New issues, reopenings, cash-management `+
  `bills, FRNs and TIPS are compared only within their stated classes.</p><p>Source record `+
  `dates can equal future issue dates and are not treated as result release timestamps. `+
  `Retrieval dates do not establish when a result first became public.</p><p>${esc(source?.coverageNote
  ??'No verified Treasury auction capture is available.')}</p><p>${externalLink
  ('https://fiscaldata.treasury.gov/datasets/treasury-securities-auctions-data/','Treasury Fiscal Data, Bureau of the Fiscal Service')} · ${
  externalLink('https://www.treasurydirect.gov/help-center/faqs/auction-faqs/','TreasuryDirect bidder definitions')}</p></div>`)))+'</div></div>';
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
