import test from 'node:test';
import assert from 'node:assert/strict';
import {renderFamilyAnalysis} from '../src/stitch-family-analysis.js';
const current={id:'selected',observations:[{date:'2026-09-01',value:1}]};
const input=(id,rows,extra={})=>({id,name:id,short:id,unit:'Percent',format:'percent',precision:2,frequency:'Monthly',observations:rows.map(([date,value,flags])=>({date,value,...flags})),...extra});
const readOf=items=>id=>items[id];
const render=(family,items)=>renderFamilyAnalysis(current,family,readOf(items));

test('each family keeps its own analytical anatomy and safely renders missing source inputs',()=>{
 const markers={payroll:'Detailed industries',unemployment:'Demographic unemployment ledger',earnings:'Earnings cohorts',eci:'Annual wage &amp; benefit anatomy',productivity:'Output / hours accounting identity',costs:'Compensation / productivity accounting identity',cpi:'Component monthly inflation heatmap',pce:'PCE spending composition'};
 for(const [family,marker]of Object.entries(markers)){
  const html=render(family,{});assert.ok(html.includes(marker),family);assert.doesNotMatch(html,/NaN|Infinity|undefined|style="/);
 }
});
test('payroll paired bars never substitute an average from a different reference month',()=>{
 const items={payrollDeskTotalChange:input('payrollDeskTotalChange',[['2026-09-01',20]]),payrollConstructionChange:input('payrollConstructionChange',[['2026-09-01',20]],{format:'thousands',unit:'Thousands of jobs'}),payrollConstructionAverage12m:input('payrollConstructionAverage12m',[['2026-08-01',999]],{format:'thousands',unit:'Thousands of jobs'}),payrollManufacturingChange:input('payrollManufacturingChange',[['2026-09-01',-10]],{format:'thousands',unit:'Thousands of jobs'})};
 const html=render('payroll',items);
 assert.match(html,/Construction[^]*?20k <small>\/ —<\/small>/);
 assert.doesNotMatch(html,/999/);assert.match(html,/family-bar-primary is-negative/);
 assert.match(html,/payrollHealthSocialAssistanceLevel/);assert.match(html,/payrollLocalGovernmentEducationChange/);
});
test('AHE anatomy compares exact annual nominal/real growth and keeps cohort level units separate',()=>{
 const items={wages:input('wages',[['2026-09-01',4]],{unit:'Percent year over year'}),productionHourlyEarnings:input('productionHourlyEarnings',[['2025-09-01',40],['2026-09-01',44]],{format:'number',unit:'USD per hour'}),realHourlyEarnings:input('realHourlyEarnings',[['2025-09-01',100],['2026-09-01',105]],{format:'number',unit:'1982–1984 dollars per hour'})};
 const html=render('earnings',items);
 assert.match(html,/Production \/ nonsupervisory · nominal[^]*?10%/);
 assert.match(html,/CPI-U deflated[^]*?5%/);
 assert.match(html,/Hourly earnings · USD/);assert.match(html,/Hours \/ week/);assert.match(html,/Weekly earnings · USD/);
 items.productionHourlyEarnings.observations.shift();assert.doesNotMatch(render('earnings',items),/>10%/);
});
test('PCE shares use the goods/services partition while nested categories stay nonadditive',()=>{
 const items={};for(const [key,value]of [['Goods',30],['Services',70],['Food',10],['Energy',5]])items[`pce${key}Weight`]=input(`pce${key}Weight`,[['2026-09-01',value]]);
 const html=render('pce',items);
 assert.match(html,/goods \+ services reported expenditure share 100%/);
 assert.match(html,/Food is nested within goods/);assert.doesNotMatch(html,/share 115%/);
});
test('Cleveland imputed-window warnings stay visible inside the CPI diagnostic cards',()=>{
 const html=render('cpi',{clevelandMedianCpiAnnual:input('clevelandMedianCpiAnnual',[['2026-09-01',3.5,{imputationAffected:true}]])});
 assert.match(html,/Window includes source-imputed months/);
 assert.match(html,/class="num family-heat-cell is-missing"/);
});

test('CPI weights and effects use actual table rows, exact importance dates and separate adjustment bases',()=>{
 const monthly={id:'cpipress6.r.1.1',label:'Food',date:'2026-09-01',importanceDate:'2026-08-01',importance:13.507,effect:0.006,monthlyAdjustment:'Not seasonally adjusted',footnotes:['Explicit category adjustment exception.']};
 const source={tables:{detail:{date:'2026-09-01',importanceDate:'2026-08-01',rows:[{...monthly,id:'cpipress2.r.1.1'}]},monthly:{date:'2026-09-01',rows:[{...monthly,id:'cpipress6.r.2.1',effect:999},{id:'cpipress6.r.1',label:'All items'},monthly]},annual:{date:'2026-09-01',rows:[{...monthly,id:'cpipress7.r.1.1',effect:null,annualAdjustment:'Not seasonally adjusted'}]}}};
 const html=renderFamilyAnalysis(current,'cpi',()=>undefined,{sources:{cpiDetail:source}});
 assert.match(html,/13\.507%/);assert.match(html,/2026-08-01/);
 assert.match(html,/data-cpi-table="monthly" data-cpi-row="cpipress6.r.1.1">0\.006 pp/);
 assert.match(html,/data-cpi-table="annual" data-cpi-row="cpipress7.r.1.1">—/);
 assert.match(html,/Not seasonally adjusted \/ Not seasonally adjusted/);
 assert.match(html,/Explicit category adjustment exception/);assert.match(html,/All items/);
 assert.doesNotMatch(html,/999\.000 pp|HTTP 403/);
});
