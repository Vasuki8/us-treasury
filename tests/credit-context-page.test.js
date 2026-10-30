import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../scripts/sources/http.mjs';
import {readChartRange} from '../src/charts.js';
let page;
try{page=await import('../src/credit-context-page.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('credit-context-page.js'))throw error;}
const ui=()=>{assert.ok(page,'Banking and policy context page must exist');return page;};
const sources=()=>({bankCredit:{status:'error',error:'HTTP 503 <retry>',fetchedAt:'2026-10-22T23:00:00Z',series:{bankLoans:{sourceIds:['B1020NCBA'],sourceUrl:'https://www.federalreserve.gov/releases/h8/data/FRB_h8_xml.zip',sourceTitle:'H.8 Assets and Liabilities of Commercial Banks in the United States',licenseUrl:'https://www.federalreserve.gov/disclaimer.htm',observations:[{date:'2026-09-30',value:14138.532},{date:'2026-10-07',value:null,sourceValue:'null',publishedAt:null}]}},provenance:[]},onRrp:{status:'ok',fetchedAt:'2026-10-22T23:00:00Z',series:{onRrpAccepted:{observations:[{date:'2026-10-22',value:.351,sourceValue:'351000000',publishedAt:null,operationId:'RP 102226 26',settlementDate:'2026-10-22',maturityDate:'2026-10-23',termCalendarDays:1,sourceNote:'Accepted differs from settled <amount>'}],sourceIds:['RRP:regular-overnight:totalAmtAccepted'],sourceTitle:'Reverse Repo Operations',sourceUrl:'https://markets.newyorkfed.org/api/rp/results/search.json',calculation:'Source dollars divided by 1 billion.'}}}});

test('context page retains unavailable latest values, visible failures, source credit and different reporting bases',()=>{
  const html=ui().creditContextPage(sources(),{documents:[]});
  assert.match(html,/HTTP 503 &lt;retry&gt;/);assert.match(html,/CACHED/);assert.doesNotMatch(html,/14138\.532/);
  assert.match(html,/7 Oct 2026/);assert.match(html,/Wednesday stocks/);assert.match(html,/Net percent/);assert.match(html,/operation/);
  assert.match(html,/Federal Reserve Bank of New York/);assert.match(html,/Terms of Use/);assert.match(html,/Meridian is not affiliated/);
  assert.match(html,/data-export-credit/);assert.match(html,/Source: Board of Governors/);
  const range=html.match(/data-range="([^"]+)"/)?.[1];assert.deepEqual(readChartRange(range?.replaceAll('&quot;','"')),{preset:'3y'});
});

test('compact credit charts, CSV and frozen inputs share a three-year window without pruning source history',()=>{
 const input=sources();input.bankCredit.series.bankLoans.observations.unshift({date:'2000-01-05',value:100});
 const original=JSON.stringify(input),scoped=ui().creditWindowSources(input);
 assert.deepEqual(scoped.bankCredit.series.bankLoans.observations.map(row=>row.date),['2026-09-30','2026-10-07']);
 assert.equal(JSON.stringify(input),original);
 const csv=ui().creditContextCsv(input);assert.doesNotMatch(csv,/2000-01-05/);assert.match(csv,/3Y.*2023-10-07.*2026-10-07/);
});

test('credit CSV retains missing values, source rights, source labels and operation settlement metadata',()=>{
  const rows=parseCsv(ui().creditContextCsv(sources())),headers=rows.shift();
  const records=rows.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]]))),missing=records.find(row=>row.series_id==='bankLoans'&&row.date==='2026-10-07'),rrp=records.find(row=>row.series_id==='onRrpAccepted');
  assert.equal(missing.value,'');assert.equal(missing.missing,'true');assert.equal(missing.publication_date,'');
  assert.equal(rrp.value,'0.351');assert.equal(rrp.settlement_date,'2026-10-22');assert.equal(rrp.maturity_date,'2026-10-23');
  assert.match(rrp.source_notice,/same permissions/);assert.equal(rrp.source_title,'Reverse Repo Operations');
  assert.equal(rrp.operation_id,'RP 102226 26');assert.equal(rrp.source_note,'Accepted differs from settled <amount>');
  assert.match(rrp.definition,/Accepted trade amounts are not necessarily settled amounts/);
});

test('SLOOS CSV exports the canonical date and exact original source label with its captured convention',()=>{
  const source={status:'ok',fetchedAt:'2026-08-04T15:00:00Z',series:{ciStandardsLarge:{dateConvention:'source-quarter-start-label',observations:[{date:'2026-07-01',sourcePeriodLabel:'2026-09-30',value:0,sourceValue:'0.0',publishedAt:null}]}}};
  const rows=parseCsv(ui().creditContextCsv({lendingSurvey:source})),headers=rows.shift(),row=Object.fromEntries(headers.map((key,i)=>[key,rows[0][i]]));
  assert.equal(row.date,'2026-07-01');assert.equal(row.source_period_label,'2026-09-30');assert.equal(row.date_convention,'source-quarter-start-label');assert.equal(row.publication_date,'');
});
