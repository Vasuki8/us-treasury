import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../src/official-snapshot.js';
import {OfficialSourceHttpError} from '../scripts/sources/http.mjs';

let checkRegisteredBlsAccess;
try {({checkRegisteredBlsAccess}=await import('../scripts/check-bls-registered-access.mjs'));} catch(error) {if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const key='registered-access-test-key-PRIVATE';
const now=new Date(Date.parse(snapshot.generatedAt)+60000);
const endpoint='https://api.bls.gov/publicAPI/v2/timeseries/data/';
function fixture(){
 const source=structuredClone(snapshot.sources.bls);
 source.fetchedAt=now.toISOString();
 source.provenance=[{url:endpoint,sha256:'a'.repeat(64),retrievedAt:source.fetchedAt,lastModified:null}];
 for(const series of Object.values(source.series))series.sourceUrl=endpoint;
 return source;
}
test('registered access check is exported for a credential-safe read-only workflow',()=>assert.equal(typeof checkRegisteredBlsAccess,'function'));
test('missing key fails clearly without making a request',async()=>{
 let requests=0;
 const report=await checkRegisteredBlsAccess({apiKey:' ',now,collect:async()=>{requests++;return fixture();}});
 assert.equal(report.passed,false);assert.equal(report.status,'not-configured');assert.equal(requests,0);
});
test('complete registered source passes admission and coverage without mutating the previous capture',async()=>{
 const previous=structuredClone(snapshot.sources.bls),before=structuredClone(previous);let requests=0;
 const report=await checkRegisteredBlsAccess({apiKey:key,now,previous,collect:async options=>{requests++;assert.equal(options.apiKey,key);return fixture();}});
 assert.equal(requests,1);assert.equal(report.passed,true);assert.equal(report.status,'ok');assert.equal(report.outputCount,31);
 assert.equal(report.fetchedAt,now.toISOString());assert.equal(report.endpoint,endpoint);
 assert.deepEqual(previous,before);assert.ok(!JSON.stringify(report).includes(key));
 assert.equal(report.series.length,31);assert.ok(report.series.every(row=>row.latestReferencePeriod));
});
test('partial, regressing, future and unreviewed captures fail the read-only check',async()=>{
 for(const mutate of [
  source=>{delete source.series.unrate;},
  source=>{source.series.unrate.observations.pop();},
  source=>{source.series.unrate.observations.shift();},
  source=>{source.series.unrate.observations.at(-1).date='2999-01-01';},
  source=>{source.series.unrate.sourceIds=['WRONG'];},
  source=>{source.provenance[0].url=endpoint+'?registrationkey='+key;},
  source=>{source.provenance[0].retrievedAt='invalid';},
  source=>{source.fetchedAt='2999-01-01T00:00:00.000Z';},
 ]){
  const value=fixture();mutate(value);
  const report=await checkRegisteredBlsAccess({apiKey:key,now,previous:snapshot.sources.bls,collect:async()=>value});
  assert.equal(report.passed,false,mutate.toString());assert.equal(report.status,'error');assert.ok(!JSON.stringify(report).includes(key));
  assert.ok(['capture-validation','series-validation','coverage-validation','commercial-admission'].includes(report.failureStage));
 }
});
test('remote errors and secret echoes never enter the public diagnostic report',async()=>{
 for(const collect of [async()=>{throw new Error('server echoed '+key);},async()=>{const value=fixture();value.provenance[0].lastModified=key;return value;}]){
  const report=await checkRegisteredBlsAccess({apiKey:key,now,collect});
  assert.equal(report.passed,false);assert.equal(report.status,'error');assert.ok(!JSON.stringify(report).includes(key));
  assert.equal(report.reason,null,'arbitrary exception details are not copied');
 }
});
test('diagnostic records only a bounded typed HTTP status for a failed registered request',async()=>{
 const report=await checkRegisteredBlsAccess({apiKey:key,now,collect:async()=>{throw new OfficialSourceHttpError(503,endpoint);}});
 assert.equal(report.passed,false);assert.equal(report.httpStatus,503);assert.ok(!JSON.stringify(report).includes(key));
 assert.equal(report.failureStage,'registered-request');
});
