import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {snapshot} from '../src/official-snapshot.js';
import {parseRoute} from '../src/router.js';
import {macroCoveragePage} from '../src/macro-coverage-page.js';
import {buildPinContext} from '../src/research-context.js';
import {currentAccountGdpHistoryChartCatalog} from '../src/current-account-gdp-history-view.js';
import {currentAccountGdpBreakdownChartCatalog} from '../src/current-account-gdp-breakdown-view.js';
import {currentAccountGdpTrailingChartCatalog,currentAccountGdpTrailingCsv} from '../src/current-account-gdp-trailing-view.js';
import {currentAccountGdpComparisonChartCatalog} from '../src/current-account-gdp-comparison-view.js';
import {currentAccountGdpContributionsChartCatalog} from '../src/current-account-gdp-contributions-view.js';
import {currentAccountGdpTrailing} from '../src/current-account-gdp-trailing.js';
import {parseCsv} from '../scripts/sources/http.mjs';

test('external economy adds total and component trailing charts with a single shared control set',()=>{
 const html=macroCoveragePage(parseRoute('#/economy?family=external&window=all'));
 assert.match(html,/TRAILING FOUR QUARTERS · CURRENT ACCOUNT \/ GDP/);
 assert.equal((html.match(/id="window-start"/g)??[]).length,1);
 assert.equal((html.match(/data-chart-catalog="current-account-gdp-trailing"/g)??[]).length,2);
 assert.match(html,/data-export-current-account-gdp-trailing/);
 assert.doesNotMatch(macroCoveragePage(parseRoute('#/economy?family=prices')),/data-chart-catalog="current-account-gdp-trailing"/);
});

test('trailing CSV endpoint values match chart selection and retain all supporting quarters once',()=>{
 for(const range of [{preset:'all'},{preset:'1y'},4,{preset:'custom',startDate:'2024-04-01',endDate:'2024-10-01'}]){
  const expected=currentAccountGdpTrailing(snapshot.sources,range),[headers,...body]=parseCsv(currentAccountGdpTrailingCsv(snapshot.sources,range)),rows=body.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]]))),ratios=rows.filter(row=>row.record_type==='ratio'),inputs=rows.filter(row=>row.record_type==='input');
  assert.equal(ratios.length,expected.observations.length);assert.deepEqual(ratios.map(row=>row.reference_quarter),expected.observations.map(row=>row.date));
  assert.deepEqual(ratios.map(row=>row.currentAccountTrailingToGdp_value_percent===''?null:Number(row.currentAccountTrailingToGdp_value_percent)),expected.observations.map(row=>row.total.value));
  assert.equal(new Set(inputs.map(row=>row.reference_quarter)).size,inputs.length);
  for(const row of ratios)for(const date of JSON.parse(row.input_quarters_json))assert.ok(inputs.some(input=>input.reference_quarter===date));
 }
});

test('app binds both trailing charts to retained package inputs only when the new optional field exists',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf('function renderCurrentCharts()'),end=source.indexOf('function researchActions()',start);
 let pkg=null;const calls=[],state=parseRoute('#/economy?family=external'),main={};
 const run=new Function('currentPackage','renderCharts','main','dataStatus','state','currentAccountGdpHistoryChartCatalog','currentAccountGdpBreakdownChartCatalog','currentAccountGdpTrailingChartCatalog','currentAccountGdpComparisonChartCatalog','currentAccountGdpContributionsChartCatalog',source.slice(start,end)+';return renderCurrentCharts;')(()=>pkg,(...args)=>calls.push(args),main,snapshot,state,currentAccountGdpHistoryChartCatalog,currentAccountGdpBreakdownChartCatalog,currentAccountGdpTrailingChartCatalog,currentAccountGdpComparisonChartCatalog,currentAccountGdpContributionsChartCatalog);
 run();assert.equal(Object.keys(calls.at(-1)[1].chartCatalogs['current-account-gdp-trailing'].catalog).length,5);
 const args=buildPinContext(state);pkg={catalog:{},context:args.context};run();assert.match(calls.at(-1)[1].chartCatalogs['current-account-gdp-trailing'].evidenceLabel,/Frozen/);
 delete pkg.context.currentAccountGdpTrailing;run();assert.equal(calls.at(-1)[1].chartCatalogs['current-account-gdp-trailing'],undefined);
 pkg={catalog:{},context:{}};run();assert.deepEqual(calls.at(-1)[1].chartCatalogs,{});
 assert.match(source,/exportCurrentAccountGdpTrailing.*currentAccountGdpTrailingCsv/);
});
