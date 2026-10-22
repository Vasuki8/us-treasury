import test from 'node:test';import assert from 'node:assert/strict';
import {createPublicationLoader} from '../src/publication-loader.js';
let api,control;try{api=await import('../src/claims-publication-loader.js');control=await import('../src/publication-controller.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
test('publication loaders pass explicit retry state, preserve failed state and select the configured archive export',async()=>{
 const calls=[],loader=createPublicationLoader({exportName:'claimsPublicationArchive',maxRecords:168,importArchive:async options=>{calls.push(options);if(calls.length===1)throw Error('HTTP503');return {claimsPublicationArchive:{version:1,releases:[]}};}});
 await assert.rejects(loader.load(),/503/);await assert.rejects(loader.load(),/503/);assert.equal(calls.length,1);assert.equal((await loader.load({retry:true})).version,1);assert.deepEqual(calls,[{retry:false},{retry:true}]);
});
test('claims loader is lazy and retries its native module URL with a fresh query after a failure',async()=>{
 assert.ok(api,'Claims publication loader must exist');const urls=[];
 const loader=api.createClaimsPublicationLoader({importModule:async url=>{urls.push(url);if(urls.length===1)throw Error('old failed module');return {claimsPublicationArchive:{version:1,releases:[]}};}});
 assert.equal(urls.length,0);await assert.rejects(loader.load(),/failed/);await loader.load({retry:true});assert.equal(urls.length,2);assert.match(urls[0],/claims-publication-archive\.js$/);assert.match(urls[1],/claims-publication-archive\.js\?retry=/);
 const complete=api.createClaimsPublicationLoader({importModule:async()=>({claimsPublicationArchive:{version:1,releases:Array(768).fill({})}})});assert.equal((await complete.load()).releases.length,768,'the approved 2023/2024/2025/2026 scope fits the loader');
 const tooMany=api.createClaimsPublicationLoader({importModule:async()=>({claimsPublicationArchive:{version:1,releases:Array(769).fill({})}})});await assert.rejects(tooMany.load(),/structure/i);
});
test('publication synchronization loads only the selected family and stale completion cannot replace another view',async()=>{
 assert.ok(control,'Publication controller must exist');let route={page:'overview'},renders=0,finishGdp,finishClaims;const calls={gdp:0,claims:0};
 const controller=control.createPublicationController({getRoute:()=>route,onChange:()=>renders++,gdpLoader:{load:()=>{calls.gdp++;return new Promise(resolve=>{finishGdp=resolve;});}},claimsLoader:{load:()=>{calls.claims++;return new Promise(resolve=>{finishClaims=resolve;});}}});
 controller.sync(route);assert.deepEqual(calls,{gdp:0,claims:0});route={page:'research',researchView:'publications',publicationSeries:'gdp'};controller.sync(route);controller.sync(route);assert.equal(calls.gdp,1);
 route={...route,publicationSeries:'claimsAdvance'};controller.sync(route);assert.equal(calls.claims,1);finishGdp({version:1,releases:[{id:'gdp'}]});await Promise.resolve();await Promise.resolve();assert.equal(controller.context('claimsAdvance').status,'loading');assert.equal(renders,0);
 finishClaims({version:1,releases:[{id:'claims'}]});await Promise.resolve();await Promise.resolve();assert.equal(controller.context('continuedClaimsAdvance').archive.releases[0].id,'claims');assert.equal(renders,1);
 route={...route,publicationSeries:'gdp'};controller.sync(route);assert.equal(controller.context('gdp').archive.releases[0].id,'gdp');assert.equal(calls.gdp,1);
});
test('a failed selected claims archive stays explicit until retry and does not discard the GDP cache',async()=>{
 assert.ok(control);let route={page:'research',researchView:'publications',publicationSeries:'gdp'},claimsCalls=0;
 const controller=control.createPublicationController({getRoute:()=>route,onChange(){},gdpLoader:{load:async()=>({version:1,releases:[{id:'GDP evidence'}]})},claimsLoader:{load:async()=>{if(++claimsCalls===1)throw Error('Claims archive HTTP503');return {version:1,releases:[]};}}});
 controller.sync(route);await new Promise(setImmediate);route={...route,publicationSeries:'claimsAdvance'};controller.sync(route);await new Promise(setImmediate);
 assert.equal(controller.context('claimsAdvance').status,'error');assert.match(controller.context('claimsAdvance').error,/503/);controller.sync(route);assert.equal(claimsCalls,1);
 controller.sync(route,{retry:true});await new Promise(setImmediate);assert.equal(claimsCalls,2);assert.equal(controller.context('continuedClaimsAdvance').status,'ready');assert.equal(controller.context('gdp').archive.releases[0].id,'GDP evidence');
});
