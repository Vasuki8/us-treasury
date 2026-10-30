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
import {currentAccountGdpComparisonChartCatalog} from '../src/current-account-gdp-comparison-view.js';
import {currentAccountGdpContributionsChartCatalog,currentAccountGdpContributionsCsv} from '../src/current-account-gdp-contributions-view.js';

test('external contributions reuse one date-control set and stay outside other macro families',()=>{
 const html=macroCoveragePage(parseRoute('#/economy?family=external&section=decomposition&window=1y'));
 assert.match(html,/COMPONENT CONTRIBUTIONS TO RATIO CHANGES/i);assert.equal((html.match(/id="window-start"/g)??[]).length,1);
 assert.doesNotMatch(macroCoveragePage(parseRoute('#/economy?family=prices')),/data-chart-catalog="current-account-gdp-contributions"/);
});

test('app binds live and frozen contribution charts to their own evidence, with no legacy fallback',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf('function renderCurrentCharts('),end=source.indexOf('function researchActions()',start);
 assert.ok(start>=0&&end>start,'The integration probe extracts the current chart renderer, including its inspection argument.');
 let pkg=null;const calls=[],state=parseRoute('#/economy?family=external'),main={};
 const run=new Function('currentPackage','renderCharts','main','dataStatus','state','currentAccountGdpHistoryChartCatalog','currentAccountGdpBreakdownChartCatalog','currentAccountGdpTrailingChartCatalog','currentAccountGdpComparisonChartCatalog','currentAccountGdpContributionsChartCatalog',source.slice(start,end)+';return renderCurrentCharts;')(()=>pkg,(...args)=>calls.push(args),main,snapshot,state,currentAccountGdpHistoryChartCatalog,currentAccountGdpBreakdownChartCatalog,currentAccountGdpTrailingChartCatalog,currentAccountGdpComparisonChartCatalog,currentAccountGdpContributionsChartCatalog);
 run();assert.equal(Object.keys(calls.at(-1)[1].chartCatalogs['current-account-gdp-contributions'].catalog).length,8);
 const args=buildPinContext(state);pkg={catalog:{},context:args.context};run();assert.match(calls.at(-1)[1].chartCatalogs['current-account-gdp-contributions'].evidenceLabel,/Frozen/);
 delete pkg.context.currentAccountGdpContributions;run();assert.equal(calls.at(-1)[1].chartCatalogs['current-account-gdp-contributions'],undefined);
 pkg={catalog:{},context:{}};run();assert.deepEqual(calls.at(-1)[1].chartCatalogs,{});
 assert.match(source,/exportCurrentAccountGdpContributions.*currentAccountGdpContributionsCsv\(dataStatus.sources,viewRange\(state\)\)/);
});

test('frozen reconstruction action uses recorded source inputs and range, and rejects legacy packages',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf("else if('exportFrozenCurrentAccountGdpContributions' in d)"),end=source.indexOf("else if('packageAttachment' in d)",start);
 assert.ok(start>=0&&end>start,'Frozen reconstruction needs a routed research action.');
 const args=buildPinContext(parseRoute('#/economy?family=external&window=custom&start=2026-04-01&end=2026-04-01')),pkg={id:'recorded',context:structuredClone(args.context)},downloads=[];
 const run=new Function('d','researchLibrary','downloadCsv','currentAccountGdpContributionsCsv',source.slice(start,end).replace(/^else if/,'if'));
 const library={getPackage:id=>id==='recorded'?pkg:null},download=(...values)=>downloads.push(values);
 run({exportFrozenCurrentAccountGdpContributions:'recorded'},library,download,currentAccountGdpContributionsCsv);
 assert.equal(downloads[0][0],currentAccountGdpContributionsCsv(pkg.context.currentAccountGdpBreakdown.sources,pkg.context.currentAccountGdpContributions.range));assert.match(downloads[0][2],/reconstructed/i);
 delete pkg.context.currentAccountGdpContributions;
 assert.throws(()=>run({exportFrozenCurrentAccountGdpContributions:'recorded'},library,download,currentAccountGdpContributionsCsv),/unavailable/i);
 assert.match(source,/researchKeys=.*'exportFrozenCurrentAccountGdpContributions'/);
});
