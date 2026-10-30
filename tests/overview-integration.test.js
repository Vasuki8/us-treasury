import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseRoute,routeFor,safeReturnTo} from '../src/router.js';
import {indicatorHref,workspaceReturn,createWorkspaceMemory} from '../src/workspace-context.js';
import {getSeries} from '../src/model.js';
import {buildPinContext} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';

test('Overview detail and comparison returns remain bounded and retain workspace position',()=>{
 const state=parseRoute('#/overview'),href=indicatorHref('payroll',state),back=workspaceReturn(parseRoute(href));
 assert.equal(back?.label,'Back to Overview');assert.equal(back?.href,routeFor(state));
 assert.equal(safeReturnTo('#/overviewevil'),null);
 const compare={...state,page:'explore',exploreMode:'compare',returnTo:routeFor(state)},detail=parseRoute(indicatorHref('unrate',compare));
 assert.equal(workspaceReturn(parseRoute(workspaceReturn(detail).href)).href,routeFor(state));
 const memory=createWorkspaceMemory();memory.remember(state,{top:520,left:0,focusHref:href});
 assert.equal(memory.recall(parseRoute(back.href))?.top,520);
});

test('actual Overview comparison action retains its Overview origin',async()=>{
 const source=await readFile(new URL('../src/app.js',import.meta.url),'utf8'),handler=/root\.addEventListener\('click',async event=>\{([^]*?)\n\}\);/.exec(source);
 assert.ok(handler);let patch;
 const state=parseRoute('#/overview'),button={disabled:false,dataset:{compare:'pceMonthly,pceCoreMonthly'}};
 await new Function('state','getSeries','parseRoute','routeFor','indicatorHref','navigate',`return async event=>{${handler[1]}}`)(state,getSeries,parseRoute,routeFor,indicatorHref,value=>{patch=value;})({target:{closest:()=>button}});
 assert.equal(patch.returnTo,routeFor(state));
 assert.deepEqual(patch.selected,['pceMonthly','pceCoreMonthly']);
});

test('Overview freeze retains the new smoothed payroll chart alongside complete supporting context',async()=>{
 const args=buildPinContext(parseRoute('#/overview'));
 assert.deepEqual(args.state.selected,['gdp','pceCoreMonthly','payroll','policyTargetUpper']);
 const average=args.context.overviewChartInputs.find(row=>row.id==='payrollAverage3m');assert.ok(average);
 assert.deepEqual(average.observations,getSeries('payrollAverage3m').observations.slice(-12));
 assert.equal(average.unit,getSeries('payrollAverage3m').unit);assert.equal(average.calculation,getSeries('payrollAverage3m').calculation);
 assert.ok(Object.hasOwn(average,'dataStatus'));
 for(const id of ['realSpendingMonthly','realDisposableIncomeMonthly','industrialProduction'])assert.ok(args.context.overviewChartInputs.some(row=>row.id===id));
 assert.match(args.context.scope,/primary CSV|primary.*four/i);
 const pkg=await createResearchPackage({name:'Overview hierarchy',...args}),restored=await importResearchPackage(exportResearchPackage(pkg));
 assert.deepEqual(restored.context.overviewChartInputs,pkg.context.overviewChartInputs);
});
