import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewPage} from '../src/overview-page.js';
import {inflationHorizonTable} from '../src/inflation-comparison.js';
import {macroCoveragePage} from '../src/macro-coverage-page.js';
import {macroPage,cpiEffectsCoveragePanel,macroContributionsCsv} from '../src/macro-page.js';
import {creditContextPage} from '../src/credit-context-page.js';
import {coverageFamilies} from '../src/macro-registry.js';
import {dataStatus,series} from '../src/data.js';

test('Overview adds private domestic final demand as a secondary reading beside GDP and keeps routine source health in its shared home',()=>{
  const html=overviewPage({saved:[]},{now:new Date('2026-10-27T12:00:00Z')});
  assert.equal((html.match(/data-overview-reading=/g)??[]).length,8);
  const secondary=html.match(/data-overview-support-reading="privateDomesticDemandGrowth"[^]*?<\/a>/)?.[0];
  assert.ok(secondary);assert.match(secondary,/q\/q SAAR/);assert.match(secondary,/Private domestic final demand/);
  assert.match(html,/Private consumption and fixed investment; excludes inventories, government and net exports/);
  assert.doesNotMatch(html,/data-overview-disclosure="source-evidence"/);
  assert.match(html,/YEAR OVER YEAR/);assert.match(html,/3M ANNUALIZED/);assert.match(html,/6M ANNUALIZED/);
});

test('inflation horizons retain independent dates, final missing values and source precision while deduplicating escaped failures',()=>{
  const make=(id)=>({id,name:id,frequency:'Monthly',dateConvention:'month-start',unit:'Percent',adjustment:'Seasonally adjusted',precision:5,dataStatus:'cached',error:'Official source <failed>',observations:[{date:'2026-08-01',value:1},{date:id.endsWith('6m')?'2026-08-01':'2026-09-01',value:id==='pceCore'?null:3.25432}]});
  const records=Object.fromEntries(['pceMonthly','pce','pceAnnualized3m','pceAnnualized6m','pceCoreMonthly','pceCore','pceCoreAnnualized3m','pceCoreAnnualized6m'].map(id=>[id,make(id)]));
  const before=JSON.stringify(records),html=inflationHorizonTable({page:'macroCoverage',macroFamily:'prices'},{lookup:id=>records[id]});
  assert.equal(JSON.stringify(records),before);assert.match(html,/3\.3%/);assert.doesNotMatch(html,/>3\.25432%/);
  assert.match(html,/Different reference months/);assert.match(html,/Aug 2026/);assert.match(html,/Sep 2026/);
  assert.match(html,/data-inflation-reading="pceCore"[^]*?>Unavailable<\/a>/);
  assert.equal((html.match(/Official source &lt;failed&gt;/g)??[]).length,1);assert.doesNotMatch(html,/<failed>/);
  assert.match(html,/headline PCE price index/);assert.match(html,/Core PCE helps assess underlying inflation; it is not the stated target index/);
});

test('unavailable CPI category effects live with Prices source coverage while GDP exports retain their existing status row',()=>{
  const source={cpiCategoryEffects:{reason:'Scoped CPI capture <unavailable>'}},prior=dataStatus.sources.macroContributions;
  dataStatus.sources.macroContributions=source;
  try{
    assert.doesNotMatch(macroPage(source),/Scoped CPI capture|CPI CATEGORY EFFECTS/);
    const prices=macroCoveragePage({macroFamily:'prices'});
    assert.match(prices,/data-page-disclosure="macro-coverage:prices:cpi-effects"/);
    assert.match(prices,/Scoped CPI capture &lt;unavailable&gt;/);
    assert.match(cpiEffectsCoveragePanel(source),/do not approximate/);
    assert.match(macroContributionsCsv(source),/cpiCategoryEffects/);
  }finally{dataStatus.sources.macroContributions=prior;}
});

test('complete official FOMC references are grouped under Policy rates and credit retains a direct destination',()=>{
  const prior=dataStatus.calendar.sources.fomc;
  dataStatus.calendar.sources.fomc={status:'ok',fetchedAt:'2026-10-27T12:00:00Z',documents:[{kind:'minutes',documentDate:'2026-10-14',meetingDate:'2026-09-16',url:'https://www.federalreserve.gov/monetarypolicy/fomcminutes20260916.htm'}]};
  try{
    const policy=macroCoveragePage({macroFamily:'policy'});
    assert.match(policy,/data-page-disclosure="macro-coverage:policy:fomc"/);assert.match(policy,/2026-10-14/);assert.match(policy,/2026-09-16/);
    assert.match(policy,/data-export-fomc/);assert.match(policy,/linked contents have not been ingested/);
    const credit=creditContextPage({},dataStatus.calendar.sources.fomc);
    assert.match(credit,/href="#\/economy\?family=policy"/);assert.doesNotMatch(credit,/data-export-fomc|2026-10-14/);
  }finally{dataStatus.calendar.sources.fomc=prior;}
});

test('advanced external ratio variants stay grouped with their existing exports and Residential construction keeps the Housing topic',()=>{
  const decomposition=macroCoveragePage({macroFamily:'external',externalView:'decomposition'});
  const advanced=decomposition.indexOf('data-page-disclosure="macro-coverage:external:advanced-effects"');
  assert.ok(advanced>decomposition.indexOf('COMPONENT CONTRIBUTIONS TO RATIO CHANGES'));
  for(const action of ['data-export-current-account-gdp-balance-effects','data-export-current-account-gdp-all-component-effects','data-export-current-account-gdp-component-effects'])assert.ok(decomposition.indexOf(action)>advanced);
  const trends=macroCoveragePage({macroFamily:'external',externalView:'trends'});
  assert.match(trends,/data-page-disclosure="macro-coverage:external:advanced-trends"/);
  assert.equal(coverageFamilies.housing.label,'Residential construction');assert.equal(coverageFamilies.housing.topic,'Housing');
  for(const id of coverageFamilies.housing.ids)assert.equal(series[id].topic,'Housing');
});
