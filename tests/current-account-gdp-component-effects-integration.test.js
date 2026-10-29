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
import {currentAccountGdpComponentEffectsCsv} from '../src/current-account-gdp-component-effects-view.js';
import {CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS} from '../src/current-account-gdp-component-effects.js';

test('component history is external-only and shares dates and focused component with comparison and history',async()=>{
 for(const {id}of CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS){const state=parseRoute(`#/economy?family=external&section=decomposition&measure=${id}&window=1y`),html=macroCoveragePage(state);assert.match(html,/COMPONENT BALANCE &amp; GDP EFFECT HISTORY/);assert.match(html,new RegExp(`value="${id}" selected`));assert.match(html,new RegExp(`${id}QuarterlyBalanceEffect,${id}QuarterlyGdpEffect,${id}QuarterlyRatioChange`));assert.equal((html.match(/id="window-start"/g)??[]).length,1);assert.equal(parseRoute(`#/economy?family=external&measure=${id}&window=1y`).macroMeasure,id);}
 assert.doesNotMatch(macroCoveragePage(parseRoute('#/economy?family=prices')),/data-chart-catalog="current-account-gdp-component-effects"/);
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf("else if(target.id==='current-account-effect-component'"),end=source.indexOf('\n',start);assert.ok(start>=0&&end>start);
 const calls=[],run=new Function('target','state','CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS','navigate',source.slice(start,end).replace(/^else if/,'if'));
 for(const {id}of CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS)run({id:'current-account-effect-component',value:id},{macroFamily:'external'},CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS,value=>calls.push(value));
 assert.deepEqual(calls,CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS.map(({id})=>({macroMeasure:id})));
 run({id:'current-account-effect-component',value:'nominalGdp'},{macroFamily:'external'},CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS,value=>calls.push(value));assert.equal(calls.length,4);
});

test('component chart binding uses only its optional frozen inputs and stays independent of total-effect context',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf('function renderCurrentCharts('),end=source.indexOf('function researchActions()',start);
 assert.ok(start>=0&&end>start,'The integration probe extracts the current chart renderer, including its inspection argument.');
 let pkg=null;const calls=[],state=parseRoute('#/economy?family=external'),main={};
 const run=new Function('currentPackage','renderCharts','main','dataStatus','state','currentAccountGdpHistoryChartCatalog','currentAccountGdpBreakdownChartCatalog','currentAccountGdpTrailingChartCatalog','currentAccountGdpComparisonChartCatalog','currentAccountGdpContributionsChartCatalog',source.slice(start,end)+';return renderCurrentCharts;')(()=>pkg,(...args)=>calls.push(args),main,snapshot,state,currentAccountGdpHistoryChartCatalog,currentAccountGdpBreakdownChartCatalog,currentAccountGdpTrailingChartCatalog,currentAccountGdpComparisonChartCatalog,currentAccountGdpContributionsChartCatalog);
 run();assert.equal(Object.keys(calls.at(-1)[1].chartCatalogs['current-account-gdp-component-effects'].catalog).length,24);
 const args=buildPinContext(state);pkg={catalog:{},context:args.context};delete pkg.context.currentAccountGdpContributions;delete pkg.context.currentAccountGdpBalanceEffects;run();assert.match(calls.at(-1)[1].chartCatalogs['current-account-gdp-component-effects'].evidenceLabel,/Frozen/);assert.equal(calls.at(-1)[1].chartCatalogs['current-account-gdp-balance-effects'],undefined);
 delete pkg.context.currentAccountGdpComponentEffects;delete pkg.context.currentAccountGdpAllComponentEffects;run();assert.equal(calls.at(-1)[1].chartCatalogs['current-account-gdp-component-effects'],undefined);
 pkg={catalog:{},context:{}};run();assert.deepEqual(calls.at(-1)[1].chartCatalogs,{});
 assert.match(source,/exportCurrentAccountGdpComponentEffects.*currentAccountGdpComponentEffectsCsv\(dataStatus.sources,viewRange\(state\),state.macroMeasure\)/);
});

test('frozen component CSV action uses recorded component/window and sources only, rejecting legacy pins',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),start=source.indexOf("else if('exportFrozenCurrentAccountGdpComponentEffects' in d)"),end=source.indexOf("else if('packageAttachment' in d)",start);assert.ok(start>=0&&end>start);
 const args=buildPinContext(parseRoute('#/economy?family=external&measure=itaServicesBalance&window=custom&start=2026-04-01&end=2026-04-01')),pkg={id:'recorded-component',context:structuredClone(args.context)},downloads=[];
 const run=new Function('d','researchLibrary','downloadCsv','currentAccountGdpComponentEffectsCsv',source.slice(start,end).replace(/^else if/,'if')),library={getPackage:id=>id===pkg.id?pkg:null};
 run({exportFrozenCurrentAccountGdpComponentEffects:pkg.id},library,(...values)=>downloads.push(values),currentAccountGdpComponentEffectsCsv);
 const context=pkg.context.currentAccountGdpComponentEffects;assert.equal(downloads[0][0],currentAccountGdpComponentEffectsCsv(pkg.context[context.inputContext].sources,context.range,context.measure));assert.match(downloads[0][2],/reconstructed/i);
 delete pkg.context.currentAccountGdpComponentEffects;assert.throws(()=>run({exportFrozenCurrentAccountGdpComponentEffects:pkg.id},library,()=>{},currentAccountGdpComponentEffectsCsv),/unavailable/i);
 assert.match(source,/researchKeys=.*'exportFrozenCurrentAccountGdpComponentEffects'/);
});
