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
import {currentAccountGdpContributionsChartCatalog} from '../src/current-account-gdp-contributions-view.js';
import {currentAccountGdpBalanceEffectsCsv} from '../src/current-account-gdp-balance-effects-view.js';

test('external balance/GDP split retains shared date controls and combined contribution functionality',()=>{
 const html=macroCoveragePage(parseRoute('#/economy?family=external&section=decomposition&window=1y'));
 assert.match(html,/BALANCE CHANGES VS GDP-DENOMINATOR EFFECTS/);assert.match(html,/COMPONENT CONTRIBUTIONS TO RATIO CHANGES/);assert.match(macroCoveragePage(parseRoute('#/economy?family=external&section=trends&window=1y')),/QUARTERLY VS TRAILING FOUR QUARTERS/);
 assert.equal((html.match(/id="window-start"/g)??[]).length,1);assert.doesNotMatch(macroCoveragePage(parseRoute('#/economy?family=prices')),/data-chart-catalog="current-account-gdp-balance-effects"/);
});

test('app scopes split charts independently to recorded method context without changing legacy bindings',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf('function renderCurrentCharts()'),end=source.indexOf('function researchActions()',start);
 let pkg=null;const calls=[],state=parseRoute('#/economy?family=external'),main={};
 const run=new Function('currentPackage','renderCharts','main','dataStatus','state','currentAccountGdpHistoryChartCatalog','currentAccountGdpBreakdownChartCatalog','currentAccountGdpTrailingChartCatalog','currentAccountGdpComparisonChartCatalog','currentAccountGdpContributionsChartCatalog',source.slice(start,end)+';return renderCurrentCharts;')(()=>pkg,(...args)=>calls.push(args),main,snapshot,state,currentAccountGdpHistoryChartCatalog,currentAccountGdpBreakdownChartCatalog,currentAccountGdpTrailingChartCatalog,currentAccountGdpComparisonChartCatalog,currentAccountGdpContributionsChartCatalog);
 run();assert.equal(Object.keys(calls.at(-1)[1].chartCatalogs['current-account-gdp-balance-effects'].catalog).length,6);
 const args=buildPinContext(state);pkg={catalog:{},context:args.context};run();assert.match(calls.at(-1)[1].chartCatalogs['current-account-gdp-balance-effects'].evidenceLabel,/Frozen/);
 delete pkg.context.currentAccountGdpContributions;run();assert.equal(calls.at(-1)[1].chartCatalogs['current-account-gdp-contributions'],undefined);assert.ok(calls.at(-1)[1].chartCatalogs['current-account-gdp-balance-effects']);
 delete pkg.context.currentAccountGdpBalanceEffects;run();assert.equal(calls.at(-1)[1].chartCatalogs['current-account-gdp-balance-effects'],undefined);
 pkg={catalog:{},context:{}};run();assert.deepEqual(calls.at(-1)[1].chartCatalogs,{});
 assert.match(source,/exportCurrentAccountGdpBalanceEffects.*currentAccountGdpBalanceEffectsCsv\(dataStatus.sources,viewRange\(state\)\)/);
});

test('frozen split export action reads the recorded input reference and method window, rejecting absent context',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf("else if('exportFrozenCurrentAccountGdpBalanceEffects' in d)"),end=source.indexOf("else if('packageAttachment' in d)",start);
 assert.ok(start>=0&&end>start);
 const args=buildPinContext(parseRoute('#/economy?family=external&window=custom&start=2026-04-01&end=2026-04-01')),pkg={id:'split-recorded',context:structuredClone(args.context)},downloads=[];
 const run=new Function('d','researchLibrary','downloadCsv','currentAccountGdpBalanceEffectsCsv',source.slice(start,end).replace(/^else if/,'if')),library={getPackage:id=>id===pkg.id?pkg:null};
 run({exportFrozenCurrentAccountGdpBalanceEffects:pkg.id},library,(...items)=>downloads.push(items),currentAccountGdpBalanceEffectsCsv);
 assert.equal(downloads[0][0],currentAccountGdpBalanceEffectsCsv(pkg.context.currentAccountGdpBreakdown.sources,pkg.context.currentAccountGdpBalanceEffects.range));assert.match(downloads[0][2],/reconstructed/i);
 delete pkg.context.currentAccountGdpBalanceEffects;assert.throws(()=>run({exportFrozenCurrentAccountGdpBalanceEffects:pkg.id},library,()=>{},currentAccountGdpBalanceEffectsCsv),/unavailable/i);
 assert.match(source,/researchKeys=.*'exportFrozenCurrentAccountGdpBalanceEffects'/);
});
