import test from 'node:test';
import assert from 'node:assert/strict';
import {series} from '../src/data.js';
import {momentumInputs} from '../src/momentum.js';
import {resolveDateWindow,windowObservations} from '../src/date-window.js';
import {dashboardChartRange,pceHorizonChartCatalog,dashboardChartDefaults,normalizeDashboardChartSettings} from '../src/dashboard-chart-data.js';

const row=(date,value,extra={})=>({date,value,publishedAt:null,...extra});
const fixture=()=>{
 const base={agency:'bea',source:{name:'BEA',url:'https://www.bea.gov/',seriesIds:['DPCCRG']},sourceUrl:'https://www.bea.gov/',sourceNotice:'Retained source notice',provenance:[{sha256:'receipt'}],dataStatus:'cached',error:'Retained source warning',frequency:'Monthly',format:'percent',precision:2,unit:'Original units',adjustment:'Seasonally adjusted',observationType:'calculated'};
 return {
  pceCore:{...base,id:'pceCore',calculation:'Exact annual endpoints',observations:[row('2026-08-01',null),row('2026-09-01',3.1211596029620203)]},
  pceCoreAnnualized3m:{...base,id:'pceCoreAnnualized3m',calculation:'Exact three-month endpoints',observations:[row('2026-09-01',2.9025218811834064)]},
  pceCoreIndex:{...base,id:'pceCoreIndex',observationType:'official',observations:[row('2026-08-01',130.489,{sourceValue:'130.489'}),row('2026-09-01',130.902,{publishedAt:'2026-10-30',sourceValue:'130.902',footnotes:['preliminary']})]},
  pce:{...base,id:'pce',calculation:'Exact headline annual endpoints',observations:[row('2026-09-01',3.648874225123633)]},
  pceAnnualized3m:{...base,id:'pceAnnualized3m',calculation:'Exact headline three-month endpoints',observations:[row('2026-09-01',3.558177715358757)]},
  pceIndex:{...base,id:'pceIndex',observationType:'official',observations:[row('2026-08-01',131.611),row('2026-09-01',132.257)]},
 };
};
const catalogFor=input=>pceHorizonChartCatalog({lookup:id=>input[id]})['pce-horizons'].catalog;

test('dashboard ranges share the latest retained reference date and inclusive UTC calendar bounds',()=>{
 const measurements=[{observations:[row('2025-07-01',1)]},{observations:[row('2026-09-01',2)]}];
 for(const [preset,startDate] of [['1y','2025-09-01'],['2y','2024-09-01'],['3y','2023-09-01'],['5y','2021-09-01'],['10y','2016-09-01']]){
  const range=dashboardChartRange(preset,measurements);
  assert.deepEqual(range,{preset:'custom',startDate,endDate:'2026-09-01'});
  const window=resolveDateWindow(range,measurements);
  assert.equal(window.error,null);
  assert.deepEqual(windowObservations([row(startDate,1),row('2026-09-01',2)],window).map(item=>item.value),[1,2]);
 }
 assert.deepEqual(dashboardChartRange('all',measurements),{preset:'all'});
 assert.deepEqual(dashboardChartRange('2y',[{observations:[],retainedCoverage:{startDate:'1980-01-01',endDate:'2026-09-01'}}]),{preset:'custom',startDate:'2024-09-01',endDate:'2026-09-01'});
});

test('dashboard ranges clamp leap anniversaries and fail closed for unavailable or invalid bounds',()=>{
 const measurements=[{observations:[row('2024-02-29',1),row('2026-02-30',2),row('2099-99-99',3)]}];
 assert.deepEqual(dashboardChartRange('1y',measurements),{preset:'custom',startDate:'2023-02-28',endDate:'2024-02-29'});
 for(const range of [dashboardChartRange('invalid',measurements),dashboardChartRange('2y',[])]){
  assert.equal(range.preset,'custom');
  assert.ok(resolveDateWindow(range,measurements).error);
 }
});

test('PCE chart aliases retain annual and three-month observations with distinct horizon labels',()=>{
 const input=fixture(),before=structuredClone(input),{catalog,evidenceLabel}=pceHorizonChartCatalog({lookup:id=>input[id]})['pce-horizons'];
 assert.equal(evidenceLabel,'Calculated from retained BEA indexes');
 assert.deepEqual(Object.keys(catalog),['corePceYoy','corePce3m','corePce1m','headlinePceYoy','headlinePce3m','headlinePce1m']);
 for(const [alias,id] of [['corePceYoy','pceCore'],['corePce3m','pceCoreAnnualized3m'],['headlinePceYoy','pce'],['headlinePce3m','pceAnnualized3m']]){
  assert.deepEqual(catalog[alias].observations,input[id].observations);
  assert.equal(catalog[alias].calculation,input[id].calculation);
 }
 for(const [id,item] of Object.entries(catalog)){
  assert.equal(item.id,id);assert.equal(item.unit,'Percent · annual rate');assert.equal(item.frequency,'Monthly');assert.equal(item.format,'percent');assert.equal(item.precision,2);
  assert.match(item.name,id.startsWith('core')?/Core PCE/:/Headline PCE/);
  assert.equal(item.short,id.endsWith('Yoy')?'YoY':id.endsWith('3m')?'3M annualized':'1M annualized');
  assert.equal(item.error,'Retained source warning');assert.equal(item.sourceNotice,'Retained source notice');assert.deepEqual(item.provenance,[{sha256:'receipt'}]);
 }
 assert.deepEqual(input,before);
});

test('one-month PCE annualization uses exact index endpoints and retains calculation evidence',()=>{
 const catalog=catalogFor(fixture()),core=catalog.corePce1m,headline=catalog.headlinePce1m;
 assert.equal(core.observations[0].value,null);
 assert.ok(Math.abs(core.observations.at(-1).value-3.8648382188662955)<1e-12);
 assert.ok(Math.abs(headline.observations.at(-1).value-6.0517258101921545)<1e-12);
 assert.deepEqual(core.observations.at(-1).inputDates,['2026-08-01','2026-09-01']);
 assert.deepEqual(core.observations.at(-1).inputValues,[130.489,130.902]);
 assert.equal(core.observations.at(-1).publishedAt,null);assert.equal(core.observationType,'calculated');
 assert.deepEqual(core.observations.at(-1).footnotes,['preliminary']);assert.equal(core.observations.at(-1).sourceValue,'130.902');
 assert.match(core.calculation,/\^12/);
});

test('one-month PCE annualization leaves exact-calendar gaps and nonpositive or missing endpoints unavailable',()=>{
 for(const observations of [
  [row('2026-07-01',100),row('2026-09-01',102)],
  [row('2026-08-01',0),row('2026-09-01',102)],
  [row('2026-08-01',100),row('2026-09-01',-1)],
  [row('2026-08-01',null),row('2026-09-01',102)],
 ]){
  const input=fixture();input.pceCoreIndex.observations=observations;
  assert.equal(catalogFor(input).corePce1m.observations.at(-1).value,null);
 }
});

test('missing injected PCE inputs never fall back to the current catalog',()=>{
 const catalog=catalogFor({});
 for(const item of Object.values(catalog)){
  assert.deepEqual(item.observations,[]);assert.equal(item.dataStatus,'unavailable');assert.ok(item.error);
 }
 const input=fixture();delete input.pceCoreIndex;
 assert.deepEqual(catalogFor(input).corePce1m.observations,[]);
 assert.deepEqual(catalogFor(input).corePceYoy.observations,input.pceCore.observations);
});

test('default PCE binding leaves global measurements and capture-derived registrations unchanged',()=>{
 const before=JSON.stringify(series),inputs=JSON.stringify(momentumInputs),binding=pceHorizonChartCatalog();
 assert.equal(Object.keys(binding['pce-horizons'].catalog).length,6);
 assert.equal(JSON.stringify(series),before);assert.equal(JSON.stringify(momentumInputs),inputs);
 assert.equal(Object.hasOwn(series,'corePce1m'),false);assert.equal(Object.hasOwn(momentumInputs,'pceCoreAnnualized1m'),false);
});

test('dashboard settings accept only the choices available for each independent chart',()=>{
 assert.deepEqual(normalizeDashboardChartSettings(),{growth:'2y',inflation:'1y',inflationFamily:'core'});
 assert.deepEqual(normalizeDashboardChartSettings({growth:'10y',inflation:'3y',inflationFamily:'headline',unrelated:'ignored'}),{growth:'10y',inflation:'3y',inflationFamily:'headline'});
 const input={growth:'1y',inflation:'2y',inflationFamily:'unknown'};
 assert.deepEqual(normalizeDashboardChartSettings(input),dashboardChartDefaults);
 assert.deepEqual(normalizeDashboardChartSettings(null),dashboardChartDefaults);
 assert.deepEqual(input,{growth:'1y',inflation:'2y',inflationFamily:'unknown'});
});
