import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewPage} from '../src/overview-page.js';
import {laborPage} from '../src/labor-page.js';
import {indicatorPage} from '../src/indicator-page.js';
import {parseRoute} from '../src/router.js';
import {requiredSourceIds} from '../src/source-controller.js';
import {buildPinContext} from '../src/research-context.js';
import {series} from '../src/data.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
const state=hash=>({...parseRoute(hash),saved:[]});

test('Overview pairs real GDP with domestic demand and displays all three core PCE horizons',()=>{
 const html=overviewPage(state('#/overview'));
 const primary=html.slice(html.indexOf('aria-label="Economic trends"'),html.indexOf('class="oh-monitor"'));
 assert.match(primary,/data-series="gdp,privateDomesticDemandGrowth" data-kind="combo"/);
 assert.match(primary,/data-series="corePceYoy,corePce3m,corePce1m"/);
 assert.match(primary,/data-chart-catalog="pce-horizons"/);
 assert.equal((primary.match(/data-legend="true"/g)??[]).length,2);
 assert.equal((primary.match(/data-end-labels="true"/g)??[]).length,2);
 assert.match(primary,/data-dashboard-range="growth" data-preset="2y" aria-pressed="true"/);
 assert.match(primary,/data-dashboard-range="growth" data-preset="all"/);
 assert.match(primary,/data-dashboard-family="headline"/);
});

test('Overview chart choices change displayed ranges/family without changing its research configuration',()=>{
 const input=state('#/overview?window=custom&start=2020-01-01&end=2021-01-01&selected=unrate');
 const saved=structuredClone(input);
 const html=overviewPage(input,{overviewChartSettings:{growth:'5y',inflation:'3y',inflationFamily:'headline'}});
 assert.deepEqual(input,saved);
 assert.match(html,/data-series="headlinePceYoy,headlinePce3m,headlinePce1m"/);
 assert.match(html,/data-dashboard-range="growth" data-preset="5y" aria-pressed="true"/);
 assert.match(html,/data-dashboard-range="inflation" data-preset="3y" aria-pressed="true"/);
 assert.match(html,/data-dashboard-family="headline" aria-pressed="true"/);
});

test('Labor core charts show payroll with its three-month average and U-3 with U-6 in the shared window',()=>{
 const html=laborPage(state('#/economy/labor?window=custom&start=2025-01-01&end=2026-09-01'));
 const primary=html.slice(html.indexOf('id="labor-trends"'),html.indexOf('class="labor-side-stack"'));
 assert.match(primary,/data-series="payroll,payrollAverage3m" data-kind="combo"/);
 assert.match(primary,/data-series="unrate,underemployment" data-kind="line"/);
 assert.equal((primary.match(/data-legend="true"/g)??[]).length,2);
 assert.equal((primary.match(/data-end-labels="true"/g)??[]).length,2);
 assert.match(primary,/2025-01-01/);assert.match(primary,/2026-09-01/);
 assert.match(primary,/data-window="1y"/);assert.match(primary,/data-window="all"/);
});

test('payroll/rate native indicator overlays preserve single-measure transformations and data table',()=>{
 const native=indicatorPage(state('#/series/payroll?window=3y'));
 assert.match(native,/data-series="payroll,payrollAverage3m" data-kind="combo"/);
 assert.match(native,/data-end-labels="true"/);
 const changed=indicatorPage(state('#/series/payroll?transform=change&window=3y'));
 assert.doesNotMatch(changed,/data-series="payroll,payrollAverage3m"/);
 assert.match(changed,/data-transform="change"/);
 assert.match(changed,/Official indicator observations/);
 assert.match(indicatorPage(state('#/series/unrate')),/data-series="unrate,underemployment"/);
});

test('Overview requests full retained BEA history before drawing multi-year charts',()=>{
 assert.deepEqual(requiredSourceIds(state('#/overview')),['bea']);
});

test('frozen Overview chart context follows the selected alternate preview instead of substituting GDP',()=>{
 const args=buildPinContext(state('#/overview'),{overviewPreview:'payroll',overviewChartSettings:{growth:'5y'}});
 assert.deepEqual(args.context.overviewComparisonCharts[0].series.map(s=>s.id),['payroll']);
 assert.equal(args.context.overviewComparisonCharts[0].preset,'5y');
});

test('frozen Overview context retains selected chart windows, calculated rows and exact 1M inputs',async()=>{
 const catalog={...series,pceIndex:{...series.pceIndex,observations:[{date:'2026-07-01',value:131},{date:'2026-08-01',value:131.611},{date:'2026-09-01',value:132.257}]}};
 const args=buildPinContext(state('#/overview'),{catalog,overviewChartSettings:{growth:'5y',inflation:'3y',inflationFamily:'headline'}});
 const charts=args.context.overviewComparisonCharts;
 assert.ok(Array.isArray(charts),'Frozen displayed chart evidence is retained');
 assert.equal(charts.length,2);
 assert.deepEqual(charts[0].series.map(row=>row.id),['gdp','privateDomesticDemandGrowth']);
 assert.equal(charts[0].preset,'5y');assert.equal(charts[1].preset,'3y');
 const calculated=charts[1].series.find(row=>row.id==='headlinePce1m');
 assert.equal(calculated.observationType,'calculated');
 assert.deepEqual(calculated.observations.at(-1).inputDates,['2026-08-01','2026-09-01']);
 assert.deepEqual(calculated.observations.at(-1).inputValues,[131.611,132.257]);
 const pkg=await createResearchPackage({name:'Stitch chart evidence',...args});
 const restored=await importResearchPackage(exportResearchPackage(pkg));
 assert.deepEqual(restored.context.overviewComparisonCharts,JSON.parse(JSON.stringify(charts)));
});
