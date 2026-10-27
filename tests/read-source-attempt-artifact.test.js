import test from 'node:test';
import assert from 'node:assert/strict';
import {readSourceAttemptArtifact} from '../scripts/read-source-attempt-artifact.mjs';
import {zipFixture} from './helpers/zip.mjs';

const now=new Date('2026-10-25T22:05:00Z'), token='private-token-canary';
const run={id:101,path:'.github/workflows/ci.yml',head_branch:'main',head_repository:{full_name:'Vasuki8/us-treasury'},event:'schedule',status:'completed',created_at:'2026-10-25T22:00:00Z',updated_at:'2026-10-25T22:02:00Z'};
const job={id:201,run_id:101,name:'Refresh official data and calendars',status:'completed',conclusion:'success',started_at:'2026-10-25T22:00:30Z',completed_at:run.updated_at};
const report=()=>({schemaVersion:1,checkedAt:'2026-10-25T22:01:00.000Z',sources:[{id:'data:bea',status:'ok',fetchedAt:'2026-10-25T22:01:01.000Z',lastAttemptAt:'2026-10-25T22:01:00.000Z',httpStatus:null,cached:false}]});
const archive=value=>zipFixture([{name:'source-attempt-status.json',text:JSON.stringify(value)}]);
function fixture({value=report(),artifacts,bytes=archive(value),fetchImpl}={}){
 const calls=[];
 const items=artifacts??[{id:55,name:'official-refresh-status',size_in_bytes:bytes.length,expired:false,created_at:'2026-10-25T22:01:50Z',workflow_run:{id:101}}];
 const api=async(method,path)=>{calls.push({method,path});return {artifacts:items};};
 return {calls,options:{api,token,run,job,artifactName:'official-refresh-status',now,fetchImpl:fetchImpl??(async()=>new Response(bytes))}};
}
const safeError=error=>error.message==='Source attempt artifact could not be verified.'&&!error.message.includes(token);

test('missing and expired report artifacts are unavailable without a download',async()=>{
 for(const artifacts of [[],[{id:55,name:'official-refresh-status',size_in_bytes:100,expired:true}]]){
  const f=fixture({artifacts,fetchImpl:()=>{throw new Error('must not download');}});
  assert.equal(await readSourceAttemptArtifact(f.options),null);
  assert.equal(f.calls[0].path,'/repos/Vasuki8/us-treasury/actions/runs/101/artifacts?per_page=100&page=1');
 }
 assert.equal(await readSourceAttemptArtifact(fixture({fetchImpl:async()=>new Response('expired private body',{status:410})}).options),null,'expiration after metadata lookup remains unavailable');
});

test('downloads bounded ZIP data and sends the token only to fixed GitHub API host',async()=>{
 const expected=report(),bytes=archive(expected),calls=[];
 const f=fixture({bytes,fetchImpl:async(url,options)=>{
  calls.push({url,options});
  return calls.length===1?new Response(null,{status:302,headers:{location:'https://productionresultssa8.blob.core.windows.net/actions-results/report.zip?signature=private-signed-value'}}):new Response(bytes);
 }});
 assert.deepEqual(await readSourceAttemptArtifact(f.options),expected);
 assert.equal(calls[0].url,'https://api.github.com/repos/Vasuki8/us-treasury/actions/artifacts/55/zip');
 assert.equal(calls[0].options.headers.Authorization,`Bearer ${token}`);
 assert.equal(calls[0].options.redirect,'manual');assert.equal(calls[1].options.redirect,'manual');
 assert.equal(calls[1].options.headers?.Authorization,undefined);
 assert.doesNotMatch(JSON.stringify(calls[1].options),/private-token-canary/);
});

test('allows known GitHub artifact redirect chains without credentials on any redirected request',async()=>{
 const calls=[],locations=['https://pipelines.actions.githubusercontent.com/report','https://objects.githubusercontent.com/report'];
 const f=fixture({fetchImpl:async(url,options)=>{calls.push({url,options});return locations.length?new Response(null,{status:302,headers:{location:locations.shift()}}):new Response(archive(report()));}});
 assert.deepEqual(await readSourceAttemptArtifact(f.options),report());
 assert.equal(calls.length,3);for(const call of calls.slice(1))assert.equal(call.options.headers?.Authorization,undefined);
});

test('redirect allowlist rejects unknown hosts, HTTP, embedded credentials and unusual ports without leaking values',async()=>{
 for(const location of ['https://evil.example/report?private-token-canary','https://notgithub.blob.core.windows.net/report','http://productionresultssa8.blob.core.windows.net/report','https://user:private-token-canary@objects.githubusercontent.com/report','https://objects.githubusercontent.com:8443/report','https://objects.githubusercontent.com.evil.example/report']){
  let count=0;const f=fixture({fetchImpl:async()=>{count++;return new Response(null,{status:302,headers:{location}});}});
  await assert.rejects(readSourceAttemptArtifact(f.options),safeError);assert.equal(count,1);
 }
 const looping=fixture({fetchImpl:async()=>new Response(null,{status:302,headers:{location:'https://objects.githubusercontent.com/report'}})});
 await assert.rejects(readSourceAttemptArtifact(looping.options),safeError);
});

test('metadata, compressed streaming and inflated-entry limits prevent oversized reads',async()=>{
 let downloads=0;
 const large=fixture({artifacts:[{id:55,name:'official-refresh-status',size_in_bytes:262145,expired:false,created_at:'2026-10-25T22:01:50Z'}],fetchImpl:async()=>{downloads++;return new Response('');}});
 await assert.rejects(readSourceAttemptArtifact(large.options),safeError);assert.equal(downloads,0);
 const streaming=fixture({fetchImpl:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(140000));controller.enqueue(new Uint8Array(140000));controller.close();}}))});
 await assert.rejects(readSourceAttemptArtifact(streaming.options),safeError);
 const contentLength=fixture({fetchImpl:async()=>new Response('small',{headers:{'content-length':'262145'}})});
 await assert.rejects(readSourceAttemptArtifact(contentLength.options),safeError);
 const expanded=fixture({bytes:zipFixture([{name:'source-attempt-status.json',text:' '.repeat(65537)}])});
 await assert.rejects(readSourceAttemptArtifact(expanded.options),safeError);
 const tooMany=fixture({bytes:zipFixture(Array.from({length:11},(_,i)=>({name:i?'other'+i:'source-attempt-status.json',text:JSON.stringify(report())})))});
 await assert.rejects(readSourceAttemptArtifact(tooMany.options),safeError);
});

test('only the exact report member and strict normalized schema are admitted',async()=>{
 const values=[{...report(),error:`private upstream ${token}`},{...report(),sources:[{...report().sources[0],error:token}]},{...report(),sources:[{...report().sources[0],id:'data:unknown'}]}];
 for(const value of values)await assert.rejects(readSourceAttemptArtifact(fixture({value}).options),safeError);
 for(const bytes of [zipFixture([{name:'../source-attempt-status.json',text:JSON.stringify(report())}]),zipFixture([{name:'source-attempt-status.json',text:'private invalid JSON '+token}]),zipFixture([{name:'source-attempt-status.json',text:JSON.stringify(report())},{name:'source-attempt-status.json',text:JSON.stringify(report())}])])await assert.rejects(readSourceAttemptArtifact(fixture({bytes}).options),safeError);
});

test('reports are bound to trusted completed main runs and their actual time window',async()=>{
 for(const changedRun of [{...run,id:0},{...run,head_branch:'feature'},{...run,head_repository:{full_name:'attacker/fork'}},{...run,event:'pull_request'},{...run,path:'.github/workflows/other.yml'},{...run,status:'in_progress'}])await assert.rejects(readSourceAttemptArtifact({...fixture().options,run:changedRun}),safeError);
 for(const checkedAt of ['2026-10-25T21:59:59Z','2026-10-25T22:03:01Z','2026-10-25T22:06:00Z']){
  const value=report();value.checkedAt=checkedAt;value.sources[0].lastAttemptAt=checkedAt;value.sources[0].fetchedAt=checkedAt;
  await assert.rejects(readSourceAttemptArtifact(fixture({value}).options),safeError);
 }
 const value=report();value.checkedAt='2026-10-25T22:03:00.000Z';value.sources[0].lastAttemptAt=value.checkedAt;value.sources[0].fetchedAt=value.checkedAt;
 assert.deepEqual(await readSourceAttemptArtifact(fixture({value}).options),value,'one-minute upper clock tolerance is admitted');
});

test('a source-job rerun selects its upload even when the older artifact has a greater ID',async()=>{
 const retryRun={...run,id:40449744686,created_at:'2026-10-27T04:26:27Z',updated_at:'2026-10-27T04:46:36Z'},retryJob={...job,id:122014070795,run_id:retryRun.id,name:'Check all official sources without publishing',conclusion:'failure',started_at:'2026-10-27T04:42:22Z',completed_at:'2026-10-27T04:46:35Z'};
 const value={schemaVersion:1,checkedAt:'2026-10-27T04:42:30.000Z',sources:[{id:'data:census',status:'error',fetchedAt:null,lastAttemptAt:'2026-10-27T04:42:30.000Z',httpStatus:520,cached:false}]},bytes=archive(value);
 const older={id:12710440122,name:'official-source-check-status',size_in_bytes:bytes.length,expired:false,created_at:'2026-10-27T04:28:28Z',workflow_run:{id:retryRun.id}},current={...older,id:12710069547,created_at:'2026-10-27T04:46:33Z'};
 for(const artifacts of [[older,current],[current,older]]){
  const downloads=[],f=fixture({artifacts,fetchImpl:async url=>{downloads.push(url);return new Response(bytes);}});
  assert.deepEqual(await readSourceAttemptArtifact({...f.options,run:retryRun,job:retryJob,artifactName:'official-source-check-status',now:new Date('2026-10-27T04:47:00Z')}),value);
  assert.deepEqual(downloads,['https://api.github.com/repos/Vasuki8/us-treasury/actions/artifacts/12710069547/zip']);
 }
});

test('a missing current-job upload never falls back to an older report',async()=>{
 const bytes=archive(report()),older={id:99,name:'official-refresh-status',size_in_bytes:bytes.length,expired:false,created_at:'2026-10-25T22:00:10Z',workflow_run:{id:101}};
 for(const artifacts of [[older],[older,{...older,id:55,expired:true,created_at:'2026-10-25T22:01:50Z'}],[{...older,created_at:'2026-10-25T22:02:01Z'}]]){
  let downloads=0;const f=fixture({artifacts,fetchImpl:async()=>{downloads++;return new Response(bytes);}});
  assert.equal(await readSourceAttemptArtifact(f.options),null);assert.equal(downloads,0);
 }
});

test('multiple uploads in the same job window remain ambiguous',async()=>{
 const item={id:55,name:'official-refresh-status',size_in_bytes:archive(report()).length,expired:false,created_at:'2026-10-25T22:01:50Z',workflow_run:{id:101}};
 let downloads=0;const f=fixture({artifacts:[item,{...item,id:56,created_at:'2026-10-25T22:01:51Z'}],fetchImpl:async()=>{downloads++;return new Response(archive(report()));}});
 await assert.rejects(readSourceAttemptArtifact(f.options),safeError);assert.equal(downloads,0);
});

test('job identity, role and completed execution window must match the trusted run',async()=>{
 for(const changedJob of [undefined,{...job,id:0},{...job,run_id:102},{...job,name:'Check all official sources without publishing'},{...job,status:'in_progress'},{...job,conclusion:'skipped'},{...job,started_at:'invalid'},{...job,started_at:'2026-10-25T21:59:59Z'},{...job,started_at:'2026-10-25T22:02:01Z'},{...job,completed_at:null},{...job,completed_at:'2026-10-25T22:03:01Z'}]){
  let downloads=0;const f=fixture({fetchImpl:async()=>{downloads++;return new Response(archive(report()));}});
  await assert.rejects(readSourceAttemptArtifact({...f.options,job:changedJob}),safeError);assert.equal(downloads,0);
 }
});

test('a report timestamp must belong to the selected job even within the workflow window',async()=>{
 const selected={...job,started_at:'2026-10-25T22:01:00Z',completed_at:'2026-10-25T22:01:30Z'};
 for(const checkedAt of ['2026-10-25T22:00:59.000Z','2026-10-25T22:02:31.000Z']){
  const value=report();value.checkedAt=checkedAt;value.sources[0].lastAttemptAt=value.sources[0].fetchedAt=checkedAt;
  const item={id:55,name:'official-refresh-status',size_in_bytes:archive(value).length,expired:false,created_at:'2026-10-25T22:01:20Z',workflow_run:{id:101}};
  await assert.rejects(readSourceAttemptArtifact({...fixture({value,artifacts:[item]}).options,job:selected}),safeError);
 }
});

test('download, API and JSON failures use a fixed safe error, without response bodies or signed URLs',async()=>{
 const fail=async()=>{throw new Error(`private upstream ${token}`);};
 await assert.rejects(readSourceAttemptArtifact({...fixture().options,api:fail}),safeError);
 await assert.rejects(readSourceAttemptArtifact(fixture({fetchImpl:fail}).options),safeError);
 await assert.rejects(readSourceAttemptArtifact(fixture({fetchImpl:async()=>new Response(`secret ${token}`,{status:403})}).options),safeError);
 await assert.rejects(readSourceAttemptArtifact({...fixture().options,artifactName:'unknown-private-name'}),safeError);
 const crossRun=fixture({artifacts:[{id:55,name:'official-refresh-status',size_in_bytes:100,expired:false,created_at:'2026-10-25T22:01:50Z',workflow_run:{id:102}}]});
 await assert.rejects(readSourceAttemptArtifact(crossRun.options),safeError);
 const invalidMetadata=fixture({artifacts:[{id:55,name:'official-refresh-status',size_in_bytes:100,expired:'private-invalid',created_at:'2026-10-25T22:01:50Z'}]});
 await assert.rejects(readSourceAttemptArtifact(invalidMetadata.options),safeError);
});
