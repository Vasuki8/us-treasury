import test from 'node:test';
import assert from 'node:assert/strict';
import * as family from '../src/stitch-family-view.js';
import {renderFamilyAnalysis} from '../src/stitch-family-analysis.js';
import {indicatorPage} from '../src/indicator-page.js';
import {series} from '../src/data.js';
import {defaults} from '../src/router.js';

const state=extra=>({...defaults,saved:[],selected:[],window:'all',...extra});
const withSeries=(items,run)=>{const before=Object.fromEntries(Object.keys(items).map(id=>[id,series[id]]));Object.assign(series,items);try{return run();}finally{for(const [id,item]of Object.entries(before))if(item)series[id]=item;else delete series[id];}};
const input=(id,values,extra={})=>({...series.wages,id,name:id,short:id,frequency:'Monthly',adjustment:'Seasonally adjusted',observations:values.map(([date,value])=>({date,value})),...extra});

test('family controls choose native measurements without changing the selected indicator CSV transform',()=>{
 assert.equal(typeof family.indicatorChartSelection,'function');
 const selected=family.indicatorChartSelection(series.payroll,state({indicatorView:'payroll-level',transform:'change'}));
 assert.deepEqual(selected.ids,['payrollLevel']);
 assert.equal(selected.transform,'level');
 assert.equal(selected.seriesCatalog.payrollLevel.unit,'Thousands of jobs');
 const html=indicatorPage(state({seriesId:'payroll',indicatorView:'payroll-level',transform:'change'}));
 assert.match(html,/id="indicator-view"/);
 assert.match(html,/value="payroll-level" selected/);
 assert.match(html,/data-series="payrollLevel"[^>]*data-transform="level"/);
 assert.match(html,/data-export-indicator-chart/);
 assert.match(html,/id="transform-select"[^]*?value="change" selected/);
});

test('canonical chart views cannot relabel an unrelated detailed earnings population',()=>{
 assert.equal(typeof family.indicatorChartSelection,'function');
 const item=input('productionHourlyEarnings',[['2026-09-01',30]],{unit:'USD per hour'});
 const selected=family.indicatorChartSelection(item,state({indicatorView:'earnings-annual'}));
 assert.deepEqual(selected.ids,['productionHourlyEarnings']);
 assert.deepEqual(selected.viewOptions,[]);
 const html=indicatorPage(state({seriesId:'u1Rate',indicatorView:'unemployment-rates'}));
 assert.match(html,new RegExp(`<h1>${series.u1Rate.name}</h1>`));
 assert.doesNotMatch(html,/id="indicator-view"|data-indicator-window-stats/);
});

test('an explicit frozen lookup never borrows a live chart input or mutates retained observations',()=>{
 const live=input('payrollLevel',[['2026-09-01',999]],{unit:'Thousands of jobs'}),frozenPayroll={...series.payroll,observations:[{date:'2026-09-01',value:7}]},frozenLevel={...live,observations:[]};
 const frozen={payroll:frozenPayroll,payrollLevel:frozenLevel},before=JSON.stringify(frozen);
 withSeries({payrollLevel:live},()=>{
  const selected=family.indicatorChartSelection(frozenPayroll,state({indicatorView:'payroll-level'}),{lookup:id=>frozen[id]});
  assert.equal(selected.available,false);
  assert.deepEqual(selected.seriesCatalog.payrollLevel.observations,[]);
  const csv=family.indicatorChartCsv(frozenPayroll,state({indicatorView:'payroll-level'}),{lookup:id=>frozen[id]});
  assert.doesNotMatch(csv,/999/);
  assert.equal(csv.split('\r\n').filter(Boolean).length,1);
  assert.equal(JSON.stringify(frozen),before);
 });
});

test('cost comparison and productivity index views retain compatible horizons and actual series',()=>{
 assert.equal(typeof family.indicatorChartSelection,'function');
 const costs=family.indicatorChartSelection(series.unitLaborCosts,state());
 assert.deepEqual(costs.ids,['unitLaborCosts','laborProductivity']);
 const indices=family.indicatorChartSelection(series.laborProductivity,state({indicatorView:'productivity-index'}));
 assert.deepEqual(indices.ids,['productivityIndex','nonfarmOutputIndex','hoursWorkedIndex']);
 const quarterly=family.indicatorChartSelection(series.eciCompensationQuarterly,state({indicatorView:'eci-quarterly'}));
 assert.deepEqual(quarterly.ids,['eciCompensationQuarterly','eciCivilianWagesQuarterly','eciCivilianBenefitsQuarterly']);
 assert.equal(quarterly.seriesCatalog.eciCivilianWagesQuarterly.unit,'Percent quarter over quarter');
});

test('inflation index modes compare the same retained adjustment and price-index base',()=>{
 for(const [id,view,ids]of [['cpi','cpi-index',['cpiIndex','cpiCoreIndex']],['pce','pce-index',['pceIndex','pceCoreIndex']]]){
  const selected=family.indicatorChartSelection(series[id],state({indicatorView:view}));
  assert.deepEqual(selected.ids,ids);
  const inputs=selected.ids.map(key=>selected.seriesCatalog[key]);
  assert.equal(new Set(inputs.map(item=>item.adjustment)).size,1);
  assert.equal(new Set(inputs.map(item=>item.unit)).size,1);
 }
});

test('an invalid chart window disables its plot export and never reports window statistics',()=>{
 const html=indicatorPage(state({seriesId:'payroll',indicatorView:'payroll-level',window:'custom',startDate:'2026-09-01',endDate:'2026-01-01'}));
 assert.match(html,/data-export-indicator-chart disabled/);
 assert.doesNotMatch(html,/data-indicator-window-stats/);
});

test('chart CSV and visible-window statistics use the chosen plot, exclude nulls and respect date windows',()=>{
 assert.equal(typeof family.indicatorChartCsv,'function');
 const level=input('payrollLevel',[['2025-01-01',50],['2026-01-01',100],['2026-02-01',null],['2026-03-01',120]],{unit:'Thousands of jobs',format:'thousands',precision:0});
 withSeries({payrollLevel:level},()=>{
  const view=state({seriesId:'payroll',indicatorView:'payroll-level',window:'custom',startDate:'2026-01-01',endDate:'2026-03-01'});
  const csv=family.indicatorChartCsv(series.payroll,view);
  assert.match(csv,/payrollLevel,payrollLevel,2026-01-01,100,Thousands of jobs/);
  assert.match(csv,/payrollLevel,payrollLevel,2026-02-01,,Thousands of jobs/);
  assert.doesNotMatch(csv,/2025-01-01/);
  const html=indicatorPage(view);
  const stats=html.match(/data-indicator-window-stats[^]*?<\/section>/)?.[0]??'';
  assert.match(stats,/Mean[^]*?110k/);
  assert.match(stats,/Minimum[^]*?100k/);
  assert.match(stats,/Maximum[^]*?120k/);
  assert.match(stats,/2 finite observations/);
 });
});

test('expanded exact-period ledgers retain hours, real pay, indexes and slack without adjacent fallback',()=>{
 const selected=input('wages',[['2026-08-01',4]]);
 withSeries({wages:selected,weeklyHours:input('weeklyHours',[['2026-09-01',999]],{unit:'Hours per week'})},()=>{
  const html=family.familyLedger(selected,'earnings');
  for(const id of ['weeklyHours','weeklyEarnings','realHourlyEarnings','realWeeklyEarnings'])assert.match(html,new RegExp(`data-family-input="${id}"`));
  assert.match(html,/data-family-input="weeklyHours">—<\/td>/);
  assert.doesNotMatch(html,/999/);
  assert.match(html,/Hours per week/);
 });
 for(const [id,kind,fields]of [['unrate','unemployment',['underutilizationSpread','primeAgeEmploymentPopulation']],['eciCompensationQuarterly','eci',['eciCivilianWagesQuarterly','eciPrivateCompensationAnnual','eciCompensation']],['laborProductivity','productivity',['productivityIndex','nominalHourlyCompensationQuarterly','unitLaborCosts']],['unitLaborCosts','costs',['realHourlyCompensationQuarterly','unitLaborCostIndex']],['cpi','cpi',['cpiShelterAnnual','cpiIndex']],['pce','pce',['pceServicesAnnual','pceServicesExEnergyHousingAnnual','pceIndex']]]){
  const html=family.familyLedger(series[id],kind);for(const field of fields)assert.match(html,new RegExp(`data-family-input="${field}"`));
 }
});

test('annual inflation comparisons join the PCE reference month and show missing CPI as a gap',()=>{
 const items={pce:input('pce',[['2026-08-01',2.5]]),pceCore:input('pceCore',[['2026-08-01',2.8]]),cpi:input('cpi',[['2026-08-01',3.2]]),cpiCore:input('cpiCore',[['2026-07-01',9],['2026-08-01',null]])};
 const html=renderFamilyAnalysis(items.pce,'pce',id=>items[id],{sources:{}});
 const comparison=html.match(/data-annual-inflation-comparison[^]*?<\/table>/)?.[0]??'';
 assert.match(comparison,/Aug 2026/);
 assert.match(comparison,/0\.70 pp/);
 assert.match(comparison,/Core[^]*?—/);
 assert.doesNotMatch(comparison,/9\.00/);
});

test('wage benchmark preserves independent CES ECI and ULC reference periods and scopes',()=>{
 const items={wages:input('wages',[['2026-09-01',4]]),eciCivilianWagesAnnual:input('eciCivilianWagesAnnual',[['2026-07-01',3.5]],{frequency:'Quarterly',adjustment:'Not seasonally adjusted'}),unitLaborCostsAnnual:input('unitLaborCostsAnnual',[['2026-04-01',2]],{frequency:'Quarterly'})};
 const html=renderFamilyAnalysis(items.wages,'earnings',id=>items[id],{sources:{}});
 const benchmark=html.match(/data-wage-benchmark[^]*?<\/table>/)?.[0]??'';
 assert.match(benchmark,/Sep 2026/);assert.match(benchmark,/Q3 2026/);assert.match(benchmark,/Q2 2026/);
 assert.match(benchmark,/Fixed employment weights/);assert.match(benchmark,/labor cost per unit of output/i);
 assert.doesNotMatch(benchmark,/Atlanta|Fed target/);
});
