import test from 'node:test';
import assert from 'node:assert/strict';
import * as auctions from '../src/auctions-page.js';
import * as ownership from '../src/ownership-page.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {parseRoute,routeFor} from '../src/router.js';

const auction=(id,date,extra={})=>({id,auctionDate:date,issueDate:'2026-10-15',securityType:'Note',securityTerm:'10-Year',originalTerm:'10-Year',reopening:false,cashManagement:false,status:'results',offeringAmount:40e9,bidToCover:2.5,highYield:4.2,competitiveAccepted:100,primaryDealerAccepted:20,directAccepted:10,indirectAccepted:70,...extra});
const auctionSource=()=>({status:'ok',fetchedAt:'2026-11-01T12:00:00Z',auctions:[
 ...Array.from({length:20},(_,i)=>auction(`prior-${i}`,new Date(Date.UTC(2025,i,1)).toISOString().slice(0,10),{bidToCover:2+i/100,offeringAmount:(20+i)*1e9})),
 auction('selected','2026-10-01'),auction('same-day','2026-10-01',{bidToCover:999}),
 auction('future','2026-10-02',{bidToCover:999}),auction('tips','2026-09-02',{securityType:'TIPS',bidToCover:999}),
 auction('reopen','2026-09-03',{reopening:true}),auction('different-term','2026-09-04',{originalTerm:'5-Year'}),
 auction('announced','2026-09-05',{status:'announced'}),
]});
const csvRows=value=>{const [head,...rows]=parseCsv(value);return rows.map(row=>Object.fromEntries(head.map((key,index)=>[key,row[index]])));};
const model=(module,name,...args)=>{assert.equal(typeof module[name],'function',`${name} must model retained chart data`);return module[name](...args);};
const months=Array.from({length:13},(_,i)=>new Date(Date.UTC(2025,7+i,0)).toISOString().slice(0,10));
const ticSource=()=>({status:'ok',fetchedAt:'2026-11-01T12:00:00Z',provenance:[],series:Object.fromEntries([
 ['ticTotal',1000,10],['ticOfficial',400,2],['ticJapan',100,1],['ticChina',90,-1],['ticUk',80,2],['ticBelgium',60,0.5],['ticCanada',50,0],['ticCayman',40,0.2],
].map(([id,base,step])=>[id,{observations:months.map((date,index)=>({date,value:base+step*index,publishedAt:null}))}]))});

test('auction view windows use only prior matching results and produce numeric shares and USD billions',()=>{
 const source=auctionSource(),original=JSON.stringify(source);
 const short=model(auctions,'auctionViewModel',source,{auctionId:'selected',auctionRange:'6',auctionView:'allocations'});
 assert.deepEqual(short.rows.map(row=>row.id),['prior-14','prior-15','prior-16','prior-17','prior-18','prior-19','selected']);
 assert.deepEqual(short.seriesIds,['auctionDealerShare','auctionDirectShare','auctionIndirectShare']);
 assert.equal(short.catalog.auctionDealerShare.observations.at(-1).value,20);
 assert.equal(short.catalog.auctionDirectShare.observations.at(-1).value,10);
 assert.equal(short.catalog.auctionIndirectShare.observations.at(-1).value,70);
 const wide=model(auctions,'auctionViewModel',source,{auctionId:'selected',auctionRange:'36',auctionView:'offering'});
 assert.equal(wide.rows.length,21);assert.equal(wide.catalog.auctionOfferingSize.observations[0].value,20);
 assert.equal(wide.catalog.auctionOfferingSize.observations.at(-1).value,40);
 assert.equal(wide.catalog.auctionOfferingSize.unit,'USD billions');
 assert.equal(JSON.stringify(source),original);
});

test('auction URL round trips apply numeric ranges to actual peers, chart controls and CSV rows',()=>{
 const source=auctionSource();
 for(const [range,count]of [[6,7],[12,13],[36,21]]){
  const route=routeFor({page:'auctions',auctionId:'selected',auctionView:'offering',auctionRange:range});
  const state=parseRoute(route),view=auctions.auctionViewModel(source,state);
  assert.equal(state.auctionRange,range);
  assert.equal(view.rows.length,count);
  assert.equal(csvRows(auctions.auctionViewCsv(source,state)).length,count);
  assert.match(auctions.auctionsPage(state,source),new RegExp(`data-auction-range="${range}" aria-pressed="true"`));
 }
 for(const input of [0,8,18,36.1,Infinity,null,undefined,'06','36 ','','6.0',[6],true]){
  const view=auctions.auctionViewModel(source,{auctionId:'selected',auctionRange:input});
  assert.equal(view.range,'12');assert.equal(view.rows.length,13);
 }
});

test('auction graph leaves incomplete allocations missing and keeps historical bidder-rule regimes separate',()=>{
 const source=auctionSource();source.auctions.find(row=>row.id==='selected').directAccepted=null;
 const missing=model(auctions,'auctionViewModel',source,{auctionId:'selected',auctionView:'allocations'});
 assert.equal(missing.catalog.auctionDirectShare.observations.at(-1).value,null);
 assert.equal(missing.catalog.auctionDealerShare.observations.at(-1).value,20);
 source.auctions=[auction('pre','2009-05-29'),auction('selected','2009-06-02')];
 const regime=model(auctions,'auctionViewModel',source,{auctionId:'selected',auctionRange:'36'});
 assert.deepEqual(regime.rows.map(row=>row.id),['selected']);
});

test('unknown auction comparison classes have no peers and remain labelled unknown',()=>{
 const source=auctionSource();Object.assign(source.auctions.find(row=>row.id==='selected'),{reopening:null,cashManagement:null});
 const view=auctions.auctionViewModel(source,{auctionId:'selected'});
 assert.deepEqual(view.rows.map(row=>row.id),['selected']);
 assert.match(auctions.auctionsPage({auctionId:'selected'},source),/Matching class: Note, original 10-Year, reopening unknown, cash-management status unknown/);
});

test('auction view export matches graph metric values, range and issue dates without altering raw export scope',()=>{
 const source=auctionSource(),raw=auctions.auctionsCsv(source),state={auctionId:'selected',auctionRange:'6',auctionView:'offering'};
 const view=model(auctions,'auctionViewModel',source,state);
 assert.equal(typeof auctions.auctionViewCsv,'function');
 const records=csvRows(auctions.auctionViewCsv(source,state));
 assert.deepEqual(records.map(row=>row.auction_id),view.rows.map(row=>row.id));
 assert.deepEqual(records.map(row=>Number(row.value)),[34,35,36,37,38,39,40]);
 assert.ok(records.every(row=>row.unit==='USD billions'&&row.issue_date==='2026-10-15'));
 assert.equal(auctions.auctionsCsv(source),raw);
 const html=auctions.auctionsPage(state,source);
 assert.match(html,/data-auction-view="offering" aria-pressed="true"/);
 assert.match(html,/data-auction-range="6" aria-pressed="true"/);
 assert.match(html,/data-series="auctionOfferingSize"/);assert.match(html,/ISSUE \/ SETTLEMENT DATE/i);
 assert.match(html,/Tendered amounts.*not retained/i);assert.match(html,/data-export-auction-view/);
});

test('auction calculated shares keep their actual accepted inputs and indexed response-page receipt',()=>{
 const source={status:'ok',inputProvenanceScope:'auction-response-page-v1',provenance:[{url:'https://example.gov/first',sha256:'a'.repeat(64)},{url:'https://example.gov/second',sha256:'b'.repeat(64)}],auctions:[auction('selected','2026-10-01',{sourceReceiptIndex:1})]};
 const state={auctionId:'selected',auctionView:'allocations'},view=auctions.auctionViewModel(source,state);
 assert.deepEqual(view.catalog.auctionIndirectShare.observations[0].inputValues,[70,100]);
 const records=csvRows(auctions.auctionViewCsv(source,state));
 assert.deepEqual(JSON.parse(records.find(row=>row.series_id==='auctionIndirectShare').input_values),[70,100]);
 assert.ok(records.every(row=>JSON.parse(row.provenance)[0].url==='https://example.gov/second'));
 delete source.inputProvenanceScope;
 assert.throws(()=>auctions.auctionViewCsv(source,state),/scope/i);
});

test('TIC exact month-end comparisons include prior levels and signed annual stock changes',()=>{
 const source=ticSource(),view=model(ownership,'ownershipTicModel',source,{ownershipView:'official-private'});
 assert.equal(view.date,'2026-07-31');assert.equal(view.priorMonth,'2026-06-30');assert.equal(view.priorYear,'2025-07-31');
 const japan=view.countries.find(row=>row.id==='ticJapan'),china=view.countries.find(row=>row.id==='ticChina');
 assert.deepEqual([japan.value,japan.priorValue,japan.monthChange,japan.yearChange],[112,111,1,12]);
 assert.deepEqual([china.value,china.priorValue,china.monthChange,china.yearChange],[78,79,-1,-12]);
 assert.equal(view.catalog.ticPrivateHoldings.observations.at(-1).value,0.696);
 assert.deepEqual(view.catalog.ticPrivateHoldings.observations.at(-1).inputValues,[1120,424]);
 assert.deepEqual(view.seriesIds,['ticOfficialHoldings','ticPrivateHoldings']);
 assert.equal(view.dates.length,13);
});

test('TIC charts use real retained range dates and fixed latest-month top holders, preserving signed positions',()=>{
 const source=ticSource();source.series.ticCayman.observations.at(-1).value=-4;
 const short=model(ownership,'ownershipTicModel',source,{ownershipView:'top-holders',ownershipRange:'3m'});
 assert.deepEqual(short.dates,['2026-05-31','2026-06-30','2026-07-31']);
 assert.deepEqual(short.seriesIds,['ticJapan','ticUk','ticChina','ticBelgium','ticCanada']);
 assert.deepEqual(short.catalog.ticUk.observations.map(row=>row.value),[0.1,0.102,0.104]);
 assert.equal(short.countries.find(row=>row.id==='ticCayman').value,-4);
 assert.equal(model(ownership,'ownershipTicModel',source,{ownershipRange:'6m'}).dates.length,6);
 const all=model(ownership,'ownershipTicModel',source,{ownershipRange:'all'});
 assert.equal(all.dates.length,13);assert.deepEqual(all.seriesIds,['ticForeignHoldings']);
});

test('TIC missing exact months stay missing; same-month components never use nearby months or other populations',()=>{
 const source=ticSource();
 source.series.ticJapan.observations.find(row=>row.date==='2026-06-30').date='2026-06-29';
 source.series.ticJapan.observations.shift();
 source.series.ticOfficial.observations.find(row=>row.date==='2026-06-30').date='2026-06-29';
 const view=model(ownership,'ownershipTicModel',source,{ownershipView:'official-private',ownershipRange:'3m'});
 const japan=view.countries.find(row=>row.id==='ticJapan');
 assert.equal(japan.priorValue,null);assert.equal(japan.monthChange,null);assert.equal(japan.yearChange,null);
 assert.equal(view.catalog.ticPrivateHoldings.observations[1].value,null);
 assert.equal(view.catalog.ticOfficialHoldings.observations[1].value,null);
 assert.equal(view.catalog.ticPrivateHoldings.observations[2].value,0.696);
 const html=ownership.ownershipReferencePage({soma:{adjustedPrincipal:999999}},source,{state:{ownershipView:'official-private'}});
 assert.match(html,/Foreign share of marketable debt[^]*?Unavailable/);assert.match(html,/foreign official custody[^]*?Unavailable/);
 assert.doesNotMatch(html,/999999/);
});

test('TIC inconsistent official and total components withhold the private residual and official share',()=>{
 const source=ticSource();source.series.ticOfficial.observations.at(-1).value=1200;
 const view=ownership.ownershipTicModel(source,{ownershipView:'official-private'});
 assert.equal(view.privatePosition.value,null);
 assert.equal(view.catalog.ticPrivateHoldings.observations.at(-1).value,null);
 const html=ownership.ownershipReferencePage(null,source);
 assert.doesNotMatch(html,/Official share of TIC foreign total 107/);
});

test('TIC leap-year comparisons require prior calendar month ends rather than clamped day offsets',()=>{
 const source={series:{ticTotal:{observations:[{date:'2023-02-28',value:100},{date:'2024-01-31',value:105},{date:'2024-02-29',value:110}]},ticJapan:{observations:[{date:'2023-02-28',value:10},{date:'2024-01-31',value:11},{date:'2024-02-29',value:12}]}}};
 const view=model(ownership,'ownershipTicModel',source,{}),japan=view.countries.find(row=>row.id==='ticJapan');
 assert.equal(view.priorMonth,'2024-01-31');assert.equal(view.priorYear,'2023-02-28');
 assert.equal(japan.monthChange,1);assert.equal(japan.yearChange,2);
});

test('TIC chart export and holder ledger share exact dates and calculations while legacy raw CSV remains stable',()=>{
 const source=ticSource(),raw=ownership.ticHoldingsCsv(source),original=JSON.stringify(source),state={ownershipView:'official-private',ownershipRange:'3m'};
 const view=model(ownership,'ownershipTicModel',source,state);
 assert.equal(typeof ownership.ticViewCsv,'function');
 const records=csvRows(ownership.ticViewCsv(source,state));
 const privateRows=records.filter(row=>row.series_id==='ticPrivateHoldings');
 assert.deepEqual(privateRows.map(row=>row.reference_month),['2026-05-31','2026-06-30','2026-07-31']);
 assert.deepEqual(privateRows.map(row=>Number(row.value)),[680,688,696]);
 assert.ok(privateRows.every(row=>row.unit==='USD billions'));
 const last=privateRows.at(-1);assert.equal(last.prior_month_position,'688');assert.equal(last.month_position_change,'8');assert.equal(last.year_position_change,'96');
 const html=ownership.ownershipReferencePage(null,source,{state});
 assert.match(html,/data-series="ticOfficialHoldings,ticPrivateHoldings"/);
 assert.match(html,/data-ownership-view="official-private" aria-pressed="true"/);
 assert.match(html,/data-ownership-range="3m" aria-pressed="true"/);
 assert.match(html,/Prior month.*USD B/i);assert.match(html,/1-year stock change.*USD B/i);
 assert.match(html,/\$111\.0B/);assert.match(html,/−\$12\.0B/);assert.match(html,/data-export-tic-view/);
 assert.equal(view.catalog.ticPrivateHoldings.observations.at(-1).value,Number(last.value)/1000);
 assert.equal(ownership.ticHoldingsCsv(source),raw);assert.equal(JSON.stringify(source),original);
});
