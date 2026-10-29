import test from 'node:test';
import assert from 'node:assert/strict';
import * as data from '../src/data.js';
import {parseRoute} from '../src/router.js';
import {renderPage} from '../src/pages.js';
import {calendarRelatedIds} from '../src/macro-calendar.js';

test('source hydration updates stable public maps and removes preview-only coverage',()=>{
 assert.equal(typeof data.hydrateSource,'function');
 const catalog=data.series,sources=data.dataStatus.sources,original=sources.bls;
 const source={...original,series:{...original.series,unrate:{...original.series.unrate,observations:[{date:'1900-01-01',value:7}]}}};
 try{
  data.hydrateSource('bls',source);
  assert.equal(data.series,catalog);assert.equal(data.dataStatus.sources,sources);
  assert.equal(sources.bls,source);assert.equal(data.series.unrate.observations,source.series.unrate.observations);
  assert.equal(data.series.unrate.retainedCoverage,undefined);
 }finally{data.hydrateSource('bls',original);}
});

test('source hydration keeps the current yield curve array stable',()=>{
 assert.equal(typeof data.hydrateSource,'function');
 const original=data.dataStatus.sources.treasury,curve=data.yieldCurve;
 try{
  data.hydrateSource('treasury',{...original,yieldCurve:[{tenor:'1Y',value:3}]});
  assert.equal(data.yieldCurve,curve);assert.deepEqual(curve,[{tenor:'1Y',value:3}]);
 }finally{data.hydrateSource('treasury',original);}
});

test('preview coverage stays readable without leaking through frozen catalog spreads',()=>{
 const original=data.dataStatus.sources.bls,coverage={startDate:'1948-01-01',endDate:'2026-09-01',count:945};
 const preview={...original,series:{...original.series,unrate:{...original.series.unrate,retainedCoverage:coverage}}};
 try{
  data.hydrateSource('bls',preview);assert.deepEqual(data.series.unrate.retainedCoverage,coverage);
  assert.equal(Object.hasOwn({...data.series.unrate},'retainedCoverage'),false);
 }finally{data.hydrateSource('bls',original);}
});

test('ordinary Overview, catalog, frozen packages and publication routes request no full source',async()=>{
 const {requiredSourceIds}=await import('../src/source-controller.js');
 for(const route of ['#/overview','#/explore','#/calendar','#/research?view=packages','#/research?view=publications']){
  assert.deepEqual(requiredSourceIds(parseRoute(route)),[],route);
 }
 assert.deepEqual(requiredSourceIds(parseRoute('#/series/unrate?window=all')),['bls']);
 assert.deepEqual(requiredSourceIds(parseRoute('#/series/unrate')),['bls'],'the default five years requires full monthly history');
 assert.deepEqual(requiredSourceIds(parseRoute('#/series/gdp')),['bea']);
 assert.deepEqual(requiredSourceIds(parseRoute('#/series/unrate?window=1y')),[],'explicit one-year routes use the eager preview');
 assert.deepEqual(requiredSourceIds(parseRoute('#/series/sofr')),[],'daily defaults retain the eager one-year view');
 assert.deepEqual(requiredSourceIds(parseRoute('#/explore?mode=compare&selected=unrate,gdp')),['bls','bea']);
 assert.deepEqual(requiredSourceIds(parseRoute('#/economy?family=external')),['beaIta','bea']);
});

test('freeze and question reviews include full supplementary histories',async()=>{
 const {requiredSourceIds}=await import('../src/source-controller.js');
 const sources=requiredSourceIds(parseRoute('#/overview'),{purpose:'freeze'});
 for(const id of ['bea','bls','policyRates','marketFunctioning','treasury','fiscal','activity','dolAdvance'])assert.ok(sources.includes(id),id);
 const library={workspaces:[{researchQuestion:{supportingSeriesIds:['unrate'],contradictingSeriesIds:['gdp'],conditions:[{seriesId:'sofr'}]}}]};
 assert.deepEqual(requiredSourceIds(parseRoute('#/research'),{library}),['bls','bea','marketFunctioning']);
 assert.ok(requiredSourceIds(parseRoute('#/economy?family=prices')).includes('pcePriceContributions'));
 assert.ok(requiredSourceIds(parseRoute('#/economy/labor')).includes('laborEvidence'));
 const event=data.releases.find(row=>calendarRelatedIds(row).some(id=>data.series[id]?.agency==='bea'));
 assert.ok(event,'a retained BEA event is required by this regression');
 const state=parseRoute('#/calendar?event='+event.id+'&month='+event.date.slice(0,7));
 state.selected=['unrate'];
 assert.ok(requiredSourceIds(state,{purpose:'freeze'}).includes('bea'),'calendar event evidence differs from default selected IDs');
});

test('source controller hydrates shared requests once and never repaints another route',async()=>{
 const {createSourceController}=await import('../src/source-controller.js');
 let route=parseRoute('#/series/unrate?window=all'),loads=0,finish;
 const states=new Map(),hydrations=[],changes=[];
 const loader={getState:id=>states.get(id)??{status:'idle'},load:id=>{
  loads++;states.set(id,{status:'loading'});
  return new Promise(resolve=>{finish=source=>{states.set(id,{status:'ready',source});resolve(source);};});
 }};
 const controller=createSourceController(loader,{getRoute:()=>route,hydrate:(...args)=>hydrations.push(args),onChange:()=>changes.push(route)});
 controller.sync(route);controller.sync(route);assert.equal(loads,1);assert.equal(controller.context(route).status,'loading');
 route=parseRoute('#/overview');finish({id:'bls',series:{}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(hydrations.length,1);assert.equal(changes.length,0);
 route=parseRoute('#/series/cpi?window=all');controller.sync(route);assert.equal(loads,1);
 assert.equal(controller.context(route).status,'ready');
});

test('failed full source has explicit retry and independent sources remain usable',async()=>{
 const {createSourceController}=await import('../src/source-controller.js');
 let route=parseRoute('#/series/unrate?window=all'),calls=0;
 const states=new Map(),error=new Error('offline');
 const loader={getState:id=>states.get(id)??{status:'idle'},load:async id=>{
  calls++;
  if(id==='bls'&&calls===1){states.set(id,{status:'error',error});throw error;}
  const source={id,series:{}};states.set(id,{status:'ready',source});return source;
 }};
 const controller=createSourceController(loader,{getRoute:()=>route,hydrate(){},onChange(){}});
 await assert.rejects(controller.ensure(['bls']),/offline/);controller.sync(route);
 await Promise.resolve();assert.equal(calls,1);assert.equal(controller.context(route).status,'error');
 route=parseRoute('#/series/gdp?window=all');await controller.ensure(['bea']);assert.equal(controller.context(route).status,'ready');
 route=parseRoute('#/series/unrate?window=all');await controller.ensure(['bls'],{retry:true});
 assert.equal(controller.context(route).status,'ready');assert.equal(calls,3);
});

test('pending full history keeps the chosen measurement and dates without rendering partial charts',()=>{
 const state=parseRoute('#/series/unrate?window=custom&start=1950-01-01&end=1960-01-01');
 const html=renderPage(state,{sourceState:{status:'loading',sourceIds:['bls']}});
 assert.match(html,/Unemployment rate/i);assert.match(html,/role="status"/);
 assert.match(html,/id="window-start"[^>]*value="1950-01-01"/);
 assert.doesNotMatch(html,/data-chart\b|data-export\b/);
 const failed=renderPage(state,{sourceState:{status:'error',sourceIds:['bls'],error:Error('<offline>')}});
 assert.match(failed,/role="alert"/);assert.match(failed,/&lt;offline&gt;/);assert.match(failed,/data-retry-sources="bls"/);
});
