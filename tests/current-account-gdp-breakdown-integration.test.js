import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {snapshot} from '../src/official-snapshot.js';
import {parseRoute} from '../src/router.js';
import {macroCoveragePage} from '../src/macro-coverage-page.js';
import {buildPinContext} from '../src/research-context.js';
import {currentAccountGdpHistoryChartCatalog} from '../src/current-account-gdp-history-view.js';
import {currentAccountGdpTrailingChartCatalog} from '../src/current-account-gdp-trailing-view.js';
import {currentAccountGdpComparisonChartCatalog} from '../src/current-account-gdp-comparison-view.js';
import {currentAccountGdpBreakdownChartCatalog,currentAccountGdpBreakdownCsv} from '../src/current-account-gdp-breakdown-view.js';
import {currentAccountGdpBreakdown} from '../src/current-account-gdp-breakdown.js';
import {parseCsv} from '../scripts/sources/http.mjs';

test('external economy retains one shared date control and adds four-line historical breakdown',()=>{
 const html=macroCoveragePage(parseRoute('#/economy?family=external&window=all'));
 assert.match(html,/HISTORICAL CURRENT ACCOUNT \/ GDP · BREAKDOWN/);
 assert.match(html,/data-export-current-account-gdp-breakdown/);
 assert.equal((html.match(/id="window-start"/g)??[]).length,1);
 assert.match(html,/CURRENT ACCOUNT · CONTRIBUTING BALANCES|CURRENT-ACCOUNT|CURRENT ACCOUNT/);
});

test('production chart and CSV select the same exact retained quarters without hard-coded refresh dates',()=>{
 for(const range of [{preset:'all'},{preset:'1y'},4,{preset:'custom',startDate:'2024-04-01',endDate:'2024-10-01'}]){
  const expected=currentAccountGdpBreakdown(snapshot.sources,range),[header,...rows]=parseCsv(currentAccountGdpBreakdownCsv(snapshot.sources,range));
  const dateIndex=header.indexOf('reference_quarter');
  assert.equal(rows.length,expected.observations.length);
  for(const [idIndexInResult,series] of expected.series.entries()){
   const selected=rows,valueIndex=header.indexOf(`${series.id}_value_percent`);
   assert.deepEqual(selected.map(row=>row[dateIndex]),expected.observations.map(row=>row.date));
   assert.deepEqual(selected.map(row=>row[valueIndex]===''?null:Number(row[valueIndex])),expected.observations.map(row=>Object.values(row.components)[idIndexInResult].value));
  }
 }
});

test('app binds live and frozen component histories independently and never adds one to a legacy pin',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf('function renderCurrentCharts()'),end=source.indexOf('function researchActions()',start);
 let pkg=null;const calls=[],state=parseRoute('#/economy?family=external'),main={};
 const run=new Function('currentPackage','renderCharts','main','dataStatus','state','currentAccountGdpHistoryChartCatalog','currentAccountGdpBreakdownChartCatalog','currentAccountGdpTrailingChartCatalog','currentAccountGdpComparisonChartCatalog',source.slice(start,end)+';return renderCurrentCharts;')(()=>pkg,(...args)=>calls.push(args),main,snapshot,state,currentAccountGdpHistoryChartCatalog,currentAccountGdpBreakdownChartCatalog,currentAccountGdpTrailingChartCatalog,currentAccountGdpComparisonChartCatalog);
 run();assert.equal(Object.keys(calls.at(-1)[1].chartCatalogs['current-account-gdp-breakdown'].catalog).length,4);
 pkg={catalog:{},context:{}};run();assert.deepEqual(calls.at(-1)[1].chartCatalogs,{});
 const args=buildPinContext(state);pkg={catalog:{},context:args.context};run();
 assert.match(calls.at(-1)[1].chartCatalogs['current-account-gdp-breakdown'].evidenceLabel,/Frozen/);
 assert.match(source,/exportCurrentAccountGdpBreakdown.*currentAccountGdpBreakdownCsv/);
});
