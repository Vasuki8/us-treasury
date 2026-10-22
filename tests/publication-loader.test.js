import test from 'node:test';import assert from 'node:assert/strict';
import {createPublicationLoader} from '../src/publication-loader.js';
test('publication archive imports only on demand, deduplicates pending loads and reuses success',async()=>{
 let calls=0,finish;const archive={version:1,releases:[]};const loader=createPublicationLoader({importArchive:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}});
 assert.equal(calls,0);const one=loader.load(),two=loader.load();assert.equal(one,two);assert.equal(calls,1);finish({publicationArchive:archive});assert.equal(await one,archive);assert.equal(await loader.load(),archive);assert.equal(calls,1);
});
test('failed publication loads remain explicit until retry and malformed modules never become observations',async()=>{
 let calls=0;const loader=createPublicationLoader({importArchive:async()=>{calls++;if(calls===1)throw Error('HTTP 503');return{publicationArchive:{version:1,releases:[]}};}});
 await assert.rejects(loader.load(),/503/);await assert.rejects(loader.load(),/503/);assert.equal(calls,1);assert.equal((await loader.load({retry:true})).version,1);assert.equal(calls,2);
 const invalid=createPublicationLoader({importArchive:async()=>({publicationArchive:{version:2,releases:[]}})});await assert.rejects(invalid.load(),/publication archive/i);
});
