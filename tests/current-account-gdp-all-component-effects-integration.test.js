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

test('external decomposition adds eight all-component charts while preserving one shared date control and existing effects',()=>{
 const html=macroCoveragePage(parseRoute('#/economy?family=external&section=decomposition&window=1y'));
 assert.match(html,/ALL-COMPONENT BALANCE &amp; GDP EFFECT COMPARISON/);assert.equal((html.match(/data-cursor-group="current-account-all-component-effects"/g)??[]).length,8);assert.equal((html.match(/id="window-start"/g)??[]).length,1);
 assert.match(html,/id="current-account-effect-component"/);assert.match(html,/data-chart-catalog="current-account-gdp-balance-effects"/);
 assert.doesNotMatch(macroCoveragePage(parseRoute('#/economy?family=prices')),/ALL-COMPONENT|current-account-all-component-effects/);
});

test('new frozen comparison alone binds the existing component catalog and never borrows current data',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf('function renderCurrentCharts()'),end=source.indexOf('function researchActions()',start);
 let pkg=null;const calls=[],state=parseRoute('#/economy?family=external');
 const run=new Function('currentPackage','renderCharts','main','dataStatus','state','currentAccountGdpHistoryChartCatalog','currentAccountGdpBreakdownChartCatalog','currentAccountGdpTrailingChartCatalog','currentAccountGdpComparisonChartCatalog','currentAccountGdpContributionsChartCatalog',source.slice(start,end)+';return renderCurrentCharts;')(()=>pkg,(...args)=>calls.push(args),{},snapshot,state,currentAccountGdpHistoryChartCatalog,currentAccountGdpBreakdownChartCatalog,currentAccountGdpTrailingChartCatalog,currentAccountGdpComparisonChartCatalog,currentAccountGdpContributionsChartCatalog);
 const args=buildPinContext(state);assert.ok(args.context.currentAccountGdpAllComponentEffects);
 pkg={catalog:{},context:{currentAccountGdpBreakdown:args.context.currentAccountGdpBreakdown,currentAccountGdpAllComponentEffects:args.context.currentAccountGdpAllComponentEffects}};run();
 assert.equal(Object.keys(calls.at(-1)[1].chartCatalogs['current-account-gdp-component-effects'].catalog).length,24);assert.match(calls.at(-1)[1].chartCatalogs['current-account-gdp-component-effects'].evidenceLabel,/Frozen/);assert.equal(calls.at(-1)[1].chartCatalogs['current-account-gdp-balance-effects'],undefined);
 delete pkg.context.currentAccountGdpAllComponentEffects;run();assert.equal(calls.at(-1)[1].chartCatalogs['current-account-gdp-component-effects'],undefined);
 pkg={catalog:{},context:{}};run();assert.deepEqual(calls.at(-1)[1].chartCatalogs,{});
});

test('new CSV actions reuse the complete all-component export, and frozen actions require recorded inputs',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf("else if('exportFrozenCurrentAccountGdpAllComponentEffects' in d)"),end=source.indexOf("else if('packageAttachment' in d)",start);assert.ok(start>=0&&end>start);
 const args=buildPinContext(parseRoute('#/economy?family=external&window=custom&start=2026-04-01&end=2026-04-01')),pkg={id:'all-four',context:args.context},downloads=[],library={getPackage:id=>id===pkg.id?pkg:null};
 const run=new Function('d','researchLibrary','downloadCsv','currentAccountGdpBalanceEffectsCsv',source.slice(start,end).replace(/^else if/,'if'));
 run({exportFrozenCurrentAccountGdpAllComponentEffects:pkg.id},library,(...values)=>downloads.push(values),currentAccountGdpBalanceEffectsCsv);
 const context=pkg.context.currentAccountGdpAllComponentEffects;assert.equal(downloads[0][0],currentAccountGdpBalanceEffectsCsv(pkg.context[context.inputContext].sources,context.range));assert.match(downloads[0][2],/reconstructed/i);
 delete pkg.context.currentAccountGdpAllComponentEffects;assert.throws(()=>run({exportFrozenCurrentAccountGdpAllComponentEffects:pkg.id},library,()=>{},currentAccountGdpBalanceEffectsCsv),/unavailable/i);
 assert.match(source,/researchKeys=.*'exportFrozenCurrentAccountGdpAllComponentEffects'/);assert.match(source,/exportCurrentAccountGdpAllComponentEffects.*currentAccountGdpBalanceEffectsCsv\(dataStatus.sources,viewRange\(state\)\)/);
});
