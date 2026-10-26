import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../src/official-snapshot.js';
import {OfficialSourceHttpError} from '../scripts/sources/http.mjs';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {currentBlsSource} from './helpers/bls-current-source.js';

let checkRegisteredBlsAccess;
try {({checkRegisteredBlsAccess}=await import('../scripts/check-bls-registered-access.mjs'));} catch(error) {if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const key='registered-access-test-key-PRIVATE';
const now=new Date(Date.parse(snapshot.generatedAt)+60000);
const endpoint='https://api.bls.gov/publicAPI/v2/timeseries/data/';
function fixture(previous=snapshot.sources.bls){
 return currentBlsSource(previous,{now,endpoint});
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

test('registered fresh-window fixture discards retained historical profile and row receipts without mutating previous history',async()=>{
 const previous=structuredClone(snapshot.sources.bls);
 assert.ok(previous.historyProfile,'the real retained source contains the active historical profile');
 assert.doesNotThrow(()=>assertCommercialData({sources:{bls:previous}}),'the retained source must be a valid historical capture before conversion');
 const before=structuredClone(previous),fresh=fixture(previous),start=`${now.getUTCFullYear()-9}-01-01`;
 assert.equal(fresh.historyProfile,undefined);assert.equal(fresh.provenance.length,1);
 for(const series of Object.values(fresh.series))for(const row of series.observations){assert.ok(row.date>=start);assert.equal(Object.hasOwn(row,'sourceUrl'),false);assert.equal(Object.hasOwn(row,'sourceSha256'),false);assert.equal(Object.hasOwn(row,'retrievedAt'),false);}
 const report=await checkRegisteredBlsAccess({apiKey:key,now,previous,collect:async()=>fresh});
 assert.equal(report.passed,true);assert.equal(report.outputCount,31);assert.deepEqual(previous,before);
});

test('live completion clock accepts a genuine delayed retry receipt and still rejects future receipts',async()=>{
 const late=new Date(now.getTime()+150000),value=fixture();value.fetchedAt=late.toISOString();value.provenance[0].retrievedAt=value.fetchedAt;
 const report=await checkRegisteredBlsAccess({apiKey:key,now,clock:()=>late,collect:async()=>value});
 assert.equal(report.passed,true);assert.equal(report.checkedAt,now.toISOString());assert.equal(report.fetchedAt,late.toISOString());
 value.fetchedAt=new Date(late.getTime()+46000).toISOString();value.provenance[0].retrievedAt=value.fetchedAt;
 assert.equal((await checkRegisteredBlsAccess({apiKey:key,now,clock:()=>late,collect:async()=>value})).passed,false);
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
test('API failure summaries contain fixed labels and bounded counts without remote text',async()=>{
 const allowed={status:'REQUEST_SUCCEEDED',messageCount:2,categories:['catalog'],seriesCount:20};
 for(const [summary,expected]of [[allowed,allowed],[{...allowed,status:key},null],[{...allowed,messageCount:101},null],[{...allowed,categories:[key]},null],[{...allowed,seriesCount:key},null]]){
  const report=await checkRegisteredBlsAccess({apiKey:key,now,collect:async()=>{const error=new Error(key);error.apiSummary=summary;throw error;}});
  assert.equal(report.passed,false);assert.deepEqual(report.apiSummary,expected);assert.ok(!JSON.stringify(report).includes(key));
 }
});
