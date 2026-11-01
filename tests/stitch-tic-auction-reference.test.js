import test from 'node:test';
import assert from 'node:assert/strict';
import {ownershipReferencePage,ownershipDeskChartCatalog,ticHoldingsCsv} from '../src/ownership-page.js';
import {auctionsPage,auctionDeskChartCatalog,auctionsCsv} from '../src/auctions-page.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const tic=()=>({id:'ticHolders',status:'ok',fetchedAt:'2026-11-01T16:00:00Z',coverageNote:'Current revised month-end stocks.',provenance:[{url:'https://ticdata.treasury.gov/Publish/slt_table5.html',sha256:'a'.repeat(64),retrievedAt:'2026-11-01T16:00:00Z'}],series:Object.fromEntries([['ticTotal',1000,1100],['ticOfficial',400,420],['ticJapan',100,110],['ticChina',90,null],['ticUk',80,95]].map(([id,prior,current])=>[id,{observations:[{date:'2026-07-31',value:prior},{date:'2026-08-31',value:current}]}]))});
test('TIC reference has seven source-driven cards, ranked country ledger and separate Z.1/SOMA research',()=>{
 const source=tic(),original=JSON.stringify(source),html=ownershipReferencePage(null,source),strip=html.match(/<section class="stitch-kpi-strip"[^]*?<\/section>/)?.[0];
 assert.equal((strip.match(/class="stitch-kpi /g)??[]).length,7);
 assert.match(strip,/\$1\.10T/);assert.match(strip,/\$0\.420T \/ \$0\.680T/);
 assert.match(strip,/38\.2%/);assert.match(strip,/China[^]*?Unavailable/);
 assert.match(html,/data-chart-catalog="ownership-tic"/);
 assert.match(html,/Share of TIC foreign total/);
 assert.match(html,/8\.64%/); // 95 / 1100 × 100, rounded only for display.
 assert.match(html,/Quarterly Z.1 positions &amp; weekly SOMA holdings/);
 assert.doesNotMatch(html,/2011 – 2024/);
 const inflow=strip.match(/<article class="stitch-kpi metric"><span class="metric-name">12-month net foreign inflow[^]*?<\/article>/)?.[0];
 assert.match(inflow,/class="stitch-kpi-value">Unavailable/);assert.doesNotMatch(inflow,/\+\$/);
 assert.equal(JSON.stringify(source),original);
});
test('TIC plots and CSV preserve nulls, native billions and exact conversion receipts',()=>{
 const source=tic(),catalog=ownershipDeskChartCatalog(null,source,{frozen:true})['ownership-tic'];
 assert.match(catalog.evidenceLabel,/Frozen/);
 assert.deepEqual(catalog.catalog.ticForeignHoldings.observations.at(-1).inputValues,[1100]);
 assert.equal(catalog.catalog.ticForeignHoldings.observations.at(-1).value,1.1);
 source.series.ticTotal.observations.at(-1).value=null;
 assert.equal(ownershipDeskChartCatalog(null,source)['ownership-tic'].catalog.ticForeignHoldings.observations.at(-1).value,null);
 const [headers,...rows]=parseCsv(ticHoldingsCsv(source)),record=rows.find(row=>row[headers.indexOf('series_id')]==='ticChina'&&row[headers.indexOf('reference_month')]==='2026-08-31');
 assert.equal(record[headers.indexOf('value')],'');assert.equal(record[headers.indexOf('unit')],'USD billions');
 assert.deepEqual(JSON.parse(record[headers.indexOf('provenance')]),source.provenance);
});
const auction=(id,date,changes={})=>({id,auctionDate:date,securityType:'Note',securityTerm:'10-Year',originalTerm:'10-Year',reopening:false,cashManagement:false,status:'results',offeringAmount:1e9,highYield:4.25,bidToCover:2.5,competitiveAccepted:100,primaryDealerAccepted:20,directAccepted:10,indirectAccepted:70,...changes});
test('auction reference preserves seven KPI slots without manufacturing a WI tail or unmatched peer',()=>{
 const source={status:'ok',fetchedAt:'2026-11-01T16:00:00Z',auctions:[auction('prior','2026-09-01',{bidToCover:2.4}),auction('selected','2026-10-01'),auction('tips','2026-09-02',{securityType:'TIPS',bidToCover:999})]},original=JSON.stringify(source),csv=auctionsCsv(source);
 const html=auctionsPage({auctionId:'selected'},source),strip=html.match(/<section class="stitch-kpi-strip"[^]*?<\/section>/)?.[0];
 assert.equal((strip.match(/class="stitch-kpi /g)??[]).length,7);
 assert.match(strip,/Direct award[^]*?10\.0%/);assert.match(strip,/When-issued concession \/ tail[^]*?Unavailable/);
 const chart=auctionDeskChartCatalog(source,{auctionId:'selected'})['auction-demand'].catalog.auctionBidToCover;
 assert.deepEqual(chart.observations.map(row=>row.auctionId),['prior','selected']);
 assert.deepEqual(chart.observations.map(row=>row.value),[2.4,2.5]);
 assert.equal(auctionsCsv(source),csv);assert.equal(JSON.stringify(source),original);
});
