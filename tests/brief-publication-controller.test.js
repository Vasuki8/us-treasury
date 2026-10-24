import test from 'node:test';
import assert from 'node:assert/strict';
import {createPublicationController} from '../src/publication-controller.js';
test('daily overview loads both reviewed families once and late completion respects the active route',async()=>{
 let route={page:'overview'},renders=0,gdpCalls=0,claimsCalls=0,finishGdp,finishClaims;
 const controller=createPublicationController({gdpLoader:{load(){gdpCalls++;return new Promise(resolve=>{finishGdp=resolve;});}},claimsLoader:{load(){claimsCalls++;return new Promise(resolve=>{finishClaims=resolve;});}},getRoute:()=>route,onChange(){renders++;}});
 controller.sync(route);controller.sync(route);
 assert.equal(gdpCalls,1);assert.equal(claimsCalls,1);
 assert.equal(controller.context('gdp').status,'loading');
 finishGdp({releases:[]});await Promise.resolve();assert.equal(renders,1);
 route={page:'calendar'};finishClaims({releases:[]});await Promise.resolve();assert.equal(renders,1);
 route={page:'overview'};controller.sync(route);assert.equal(claimsCalls,1);
 assert.equal(controller.context('claimsAdvance').status,'ready');
});
test('direct supported detail loads evidence and completion updates relevant detail or labor views',async()=>{
 let route={page:'indicator',seriesId:'gdp'},renders=0,finish,calls=0,claimsCalls=0;
 const controller=createPublicationController({gdpLoader:{load(){calls++;return new Promise(resolve=>{finish=resolve;});}},claimsLoader:{load(){claimsCalls++;return Promise.resolve({releases:[]});}},getRoute:()=>route,onChange(){renders++;}});
 controller.sync(route);assert.equal(calls,1);assert.equal(claimsCalls,0);
 finish({releases:[]});await Promise.resolve();assert.equal(renders,1);
 route={page:'labor'};controller.sync(route);await Promise.resolve();assert.equal(claimsCalls,1);assert.equal(renders,2);
 route={page:'indicator',seriesId:'cpi'};controller.sync(route);assert.equal(calls,1);assert.equal(claimsCalls,1);
});
