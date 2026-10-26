import test from 'node:test';
import assert from 'node:assert/strict';
import {recordVintages,asKnownOn} from '../src/vintages.js';
import {buildPinContext} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {vintagesCsv} from '../src/vintages-page.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {parseRoute} from '../src/router.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {assertVintageData} from '../scripts/vintage-policy.mjs';

function debtSource(agency){
 const debtReceipt={url:'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?fields=record_date,tot_pub_debt_out_amt',sha256:'a'.repeat(64),retrievedAt:'2026-10-25T21:00:00.000Z',lastModified:null};
 const otherReceipt={url:agency==='treasury'?'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve':'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_9',sha256:'b'.repeat(64),retrievedAt:'2026-10-25T21:01:00.000Z',lastModified:null};
 const id=agency==='treasury'?'debt':'publicDebt';
 return {id:agency,fetchedAt:otherReceipt.retrievedAt,provenance:[debtReceipt,otherReceipt],series:{[id]:{sourceIds:[agency==='treasury'?'tot_pub_debt_out_amt':'debt_held_public_amt'],sourceUrl:debtReceipt.url,fetchedAt:debtReceipt.retrievedAt,provenance:[{...debtReceipt}],observations:[{date:'1997-09-30',value:3.7896675468496,publishedAt:null}]}}};
}

test('debt measurement receipt admission rejects uncaptured, altered or unrelated response evidence',()=>{
 for(const agency of ['treasury','fiscal']){
  const id=agency==='treasury'?'debt':'publicDebt';
  for(const mutate of [
   (item)=>{item.provenance=[];},
   (item)=>{item.provenance={};},
   (item)=>{item.provenance[0].url='https://example.com/forged';},
   (item)=>{item.provenance[0].sha256='c'.repeat(64);},
   (item)=>{item.provenance[0].retrievedAt='2026-10-25T20:59:00.000Z';},
   (item)=>{item.provenance[0].text='unreviewed response body';},
   (item,source)=>{item.provenance.push(source.provenance[1]);item.fetchedAt=source.fetchedAt;},
   (item,source)=>{item.provenance=[source.provenance[1]];item.sourceUrls=[source.provenance[1].url];item.fetchedAt=source.fetchedAt;},
   (item,source)=>{item.sourceUrls=[source.provenance[1].url];},
   (item,source)=>{item.fetchedAt=source.fetchedAt;},
   (item)=>{delete item.fetchedAt;},
  ]){
   const source=debtSource(agency);mutate(source.series[id],source);
   assert.throws(()=>assertCommercialData({sources:{[agency]:source}}),/measurement.*provenance/i,`${agency}: ${mutate}`);
  }
 }
});

test('debt measurement receipt admission accepts exact root receipts regardless of property order and preserves legacy captures',()=>{
 for(const agency of ['treasury','fiscal']){
  const source=debtSource(agency),id=agency==='treasury'?'debt':'publicDebt',item=source.series[id];
  const receipt=item.provenance[0];
  item.provenance=[{retrievedAt:receipt.retrievedAt,lastModified:receipt.lastModified,sha256:receipt.sha256,url:receipt.url}];
  assert.doesNotThrow(()=>assertCommercialData({sources:{[agency]:source}}));
  assert.doesNotThrow(()=>assertVintageData(recordVintages(null,{}, {[agency]:source},{checkedAt:source.fetchedAt}),assertCommercialData));
  delete item.provenance;
  delete item.fetchedAt;
  assert.doesNotThrow(()=>assertCommercialData({sources:{[agency]:source}}));
 }
});

test('debt receipt admission checks immutable historical measurement metadata even when the latest capture is valid',()=>{
 for(const agency of ['treasury','fiscal']){
  const source=debtSource(agency),id=agency==='treasury'?'debt':'publicDebt';
  const history=recordVintages(null,{}, {[agency]:source},{checkedAt:source.fetchedAt});
  history.captures[0].series[id].metadata.provenance[0].sha256='c'.repeat(64);
  assert.doesNotThrow(()=>assertCommercialData({sources:{[agency]:source}}));
  assert.throws(()=>assertVintageData(history,assertCommercialData),/measurement.*provenance/i);
 }
});

test('debt-only receipts and actual measurement clocks survive capture replay, CSV and frozen packages',async()=>{
 const debtReceipt={url:'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?fields=record_date,tot_pub_debt_out_amt',sha256:'a'.repeat(64),retrievedAt:'2026-10-25T21:00:00.000Z'};
 const otherReceipt={url:'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve',sha256:'b'.repeat(64),retrievedAt:'2026-10-25T21:01:00.000Z'};
 const source={id:'treasury',fetchedAt:otherReceipt.retrievedAt,provenance:[debtReceipt,otherReceipt],series:{debt:{sourceIds:['tot_pub_debt_out_amt'],sourceUrl:debtReceipt.url,fetchedAt:debtReceipt.retrievedAt,provenance:[debtReceipt],observations:[{date:'1993-04-01',value:4.22587398784344,sourceValue:'4225873987843.44',publishedAt:null}]}}};
 const history=recordVintages(null,{}, {treasury:source},{checkedAt:otherReceipt.retrievedAt});
 const restored=asKnownOn(history,otherReceipt.retrievedAt).sources.treasury.series.debt;
 assert.deepEqual(restored.provenance,[debtReceipt]);
 assert.equal(restored.fetchedAt,debtReceipt.retrievedAt);
 const [headers,row]=parseCsv(vintagesCsv(history,{seriesId:'debt',cutoff:otherReceipt.retrievedAt}));
 const exported=Object.fromEntries(headers.map((key,index)=>[key,row[index]]));
 assert.equal(exported.provenance_sha256,debtReceipt.sha256);
 assert.equal(exported.provenance_urls,debtReceipt.url);
 assert.equal(exported.retrieved_at,debtReceipt.retrievedAt);
 const args=buildPinContext(parseRoute('#/vintages?series=debt'),{historyState:{status:'ready',history,latestCaptureAt:otherReceipt.retrievedAt}});
 assert.deepEqual(args.catalog.debt.provenance,[debtReceipt]);
 const pkg=await createResearchPackage({name:'Debt receipt',...args});
 const text=exportResearchPackage(pkg);
 assert.equal(exportResearchPackage(await importResearchPackage(text)),text);
 const [csvHeaders,csvRow]=parseCsv(pkg.csv),data=Object.fromEntries(csvHeaders.map((key,index)=>[key,csvRow[index]]));
 assert.deepEqual(JSON.parse(data.capture_provenance_json),[debtReceipt]);
 assert.equal(data.retrieved_at,debtReceipt.retrievedAt);
});
