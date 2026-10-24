import test from 'node:test';
import assert from 'node:assert/strict';
const api=await import('../src/release-operations.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const gdp={id:'gdp',sourceId:'bea',program:'gdp',name:'Gross Domestic Product, 3rd Quarter 2026 (Advance Estimate)',periodLabel:'3rd Quarter 2026',date:'2026-10-29',scheduledAt:'2026-10-29T12:30:00.000Z'};
const claims={id:'claims',sourceId:'dol',program:'weekly-claims',date:'2026-10-29',scheduledAt:'2026-10-29T12:30:00.000Z'};
test('only supported post-release windows request targeted sources',()=>{
 assert.equal(typeof api.getReleaseRefreshPlan,'function');
 const snapshot={releases:[gdp,claims,{...gdp,id:'cpi',sourceId:'bls',program:'consumer-price-index'}],sources:{}};
 assert.deepEqual(api.getReleaseRefreshPlan(snapshot,{now:new Date('2026-10-29T12:44:59Z')}).sources,[]);
 const plan=api.getReleaseRefreshPlan(snapshot,{now:new Date('2026-10-29T12:47:00Z')});
 assert.equal(plan.required,true);assert.deepEqual(plan.sources,['bea','bls','dolAdvance']);assert.equal(plan.events.length,3);
 assert.equal(api.getReleaseRefreshPlan(snapshot,{now:new Date('2026-10-29T16:00:00Z')}).required,false);
});
test('fresh retrieval of an old result cannot mark a scheduled release verified or suppress retries',()=>{
 assert.equal(typeof api.getReleaseRefreshPlan,'function');
 const snapshot={releases:[claims],sources:{dolAdvance:{status:'ok',fetchedAt:'2026-10-29T12:45:00Z',releaseDate:'2026-10-22',series:{}}}};
 assert.equal(api.getReleaseRefreshPlan(snapshot,{now:new Date('2026-10-29T13:47:00Z')}).required,true);
 snapshot.sources.dolAdvance.releaseDate='2026-10-29';
 snapshot.sources.dolAdvance.series={claimsAdvance:{unit:'Thousands of claims',frequency:'Weekly',adjustment:'Seasonally adjusted',observations:[{date:'2026-10-24',value:200,publishedAt:'2026-10-29',publicationDatePrecision:'day',releaseStage:'advance'}]}};
 assert.equal(api.getReleaseRefreshPlan(snapshot,{now:new Date('2026-10-29T13:47:00Z')}).required,false);
 snapshot.sources.dolAdvance.status='error';
 assert.equal(api.getReleaseRefreshPlan(snapshot,{now:new Date('2026-10-29T13:47:00Z')}).required,true);
});
test('GDP current history capture remains unverified until publication evidence exists',()=>{
 assert.equal(typeof api.getReleaseRefreshPlan,'function');
 const snapshot={releases:[gdp],sources:{bea:{status:'ok',fetchedAt:'2026-10-29T12:45:00Z',series:{gdp:{observations:[{date:'2026-07-01',value:3}]}}}}};
 const plan=api.getReleaseRefreshPlan(snapshot,{now:new Date('2026-10-29T13:47:00Z')});
 assert.equal(plan.required,true);assert.equal(plan.events[0].evidenceStatus,'unverified');
 assert.throws(()=>api.getReleaseRefreshPlan(snapshot,{now:new Date('invalid')}),/valid Date/);
});
test('a future capture receipt and an explicit reference-week conflict cannot complete an event',()=>{
 const source={status:'ok',releaseDate:'2026-10-29',fetchedAt:'2026-10-29T14:00:00Z',series:{claimsAdvance:{unit:'Thousands of claims',frequency:'Weekly',adjustment:'Seasonally adjusted',observations:[{date:'2026-10-24',value:200,publishedAt:'2026-10-29',publicationDatePrecision:'day',releaseStage:'advance'}]}}};
 const snapshot={releases:[claims],sources:{dolAdvance:source}},options={now:new Date('2026-10-29T13:47:00Z')};
 assert.equal(api.getReleaseRefreshPlan(snapshot,options).required,true);
 source.fetchedAt='2026-10-29T13:00:00Z';snapshot.releases=[{...claims,period:'2026-10-17'}];
 assert.equal(api.getReleaseRefreshPlan(snapshot,options).required,true);
});
