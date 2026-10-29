import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {snapshot} from '../src/official-snapshot.js';
import {parseRoute} from '../src/router.js';
import {macroCoveragePage} from '../src/macro-coverage-page.js';
import {buildPinContext} from '../src/research-context.js';
import {currentAccountGdpHistoryChartCatalog} from '../src/current-account-gdp-history-view.js';
import {currentAccountGdpBreakdownChartCatalog} from '../src/current-account-gdp-breakdown-view.js';
import {currentAccountGdpTrailingChartCatalog} from '../src/current-account-gdp-trailing-view.js';
import {currentAccountGdpComparisonChartCatalog,currentAccountGdpComparisonCsv} from '../src/current-account-gdp-comparison-view.js';
import {currentAccountGdpContributionsChartCatalog} from '../src/current-account-gdp-contributions-view.js';
import {CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES,currentAccountGdpComparison} from '../src/current-account-gdp-comparison.js';
import {parseCsv} from '../scripts/sources/http.mjs';

test('external comparison shares existing date controls and persists its chosen balance through the measure route',async()=>{
 const html=macroCoveragePage(parseRoute('#/economy?family=external&section=trends&measure=itaServicesBalance&window=all'));
 assert.match(html,/QUARTERLY VS TRAILING FOUR QUARTERS/);assert.match(html,/value="itaServicesBalance" selected/);
 assert.match(html,/itaServicesBalanceQuarterlyComparison,itaServicesBalanceTrailingComparison/);
 assert.equal((html.match(/id="window-start"/g)??[]).length,1);assert.equal((html.match(/id="current-account-comparison-measure"/g)??[]).length,1);
 assert.doesNotMatch(macroCoveragePage(parseRoute('#/economy?family=prices')),/data-chart-catalog="current-account-gdp-comparison"/);
 const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');assert.match(app,/target.id==='current-account-comparison-measure'.*navigate\(\{macroMeasure:target.value\}\)/);
});

test('comparison export pairs match the selected chart for all five measures and range modes',()=>{
 for(const {id} of CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES)for(const range of [{preset:'all'},{preset:'1y'},4,{preset:'custom',startDate:'2024-04-01',endDate:'2024-10-01'}]){
  const expected=currentAccountGdpComparison(snapshot.sources,range,id),[headers,...body]=parseCsv(currentAccountGdpComparisonCsv(snapshot.sources,range,id)),rows=body.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]]))),pairs=rows.filter(row=>row.record_type==='ratio');
  assert.equal(pairs.length,expected.observations.length);assert.deepEqual(pairs.map(row=>row.reference_quarter),expected.observations.map(row=>row.date));
  for(const [key,field] of [['comparison_quarterly_value_percent','quarterly'],['comparison_trailing_value_percent','trailing']])assert.deepEqual(pairs.map(row=>row[key]===''?null:Number(row[key])),expected.observations.map(row=>row[field].value));
  assert.deepEqual(pairs.map(row=>row.comparison_gap_percentage_points===''?null:Number(row.comparison_gap_percentage_points)),expected.observations.map(row=>row.gap));
 }
});

test('comparison app catalogs use frozen sources only with the new context and export the selected balance',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf('function renderCurrentCharts('),end=source.indexOf('function researchActions()',start);
 assert.ok(start>=0&&end>start,'The integration probe extracts the current chart renderer, including its inspection argument.');
 let pkg=null;const calls=[],state=parseRoute('#/economy?family=external'),main={};
 const run=new Function('currentPackage','renderCharts','main','dataStatus','state','currentAccountGdpHistoryChartCatalog','currentAccountGdpBreakdownChartCatalog','currentAccountGdpTrailingChartCatalog','currentAccountGdpComparisonChartCatalog','currentAccountGdpContributionsChartCatalog',source.slice(start,end)+';return renderCurrentCharts;')(()=>pkg,(...args)=>calls.push(args),main,snapshot,state,currentAccountGdpHistoryChartCatalog,currentAccountGdpBreakdownChartCatalog,currentAccountGdpTrailingChartCatalog,currentAccountGdpComparisonChartCatalog,currentAccountGdpContributionsChartCatalog);
 run();assert.equal(Object.keys(calls.at(-1)[1].chartCatalogs['current-account-gdp-comparison'].catalog).length,10);
 const args=buildPinContext(state);pkg={catalog:{},context:args.context};run();assert.match(calls.at(-1)[1].chartCatalogs['current-account-gdp-comparison'].evidenceLabel,/Frozen/);
 delete pkg.context.currentAccountGdpComparison;run();assert.equal(calls.at(-1)[1].chartCatalogs['current-account-gdp-comparison'],undefined);
 pkg={catalog:{},context:{}};run();assert.deepEqual(calls.at(-1)[1].chartCatalogs,{});
 assert.match(source,/exportCurrentAccountGdpComparison.*currentAccountGdpComparisonCsv\(dataStatus.sources,viewRange\(state\),state.macroMeasure\)/);
});
