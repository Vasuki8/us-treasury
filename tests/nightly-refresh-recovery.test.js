import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {getFreshness} from '../src/freshness.js';
import {githubApi,repository,base} from '../scripts/github-maintenance.mjs';

const workflowApi=`${base}/actions/workflows/ci.yml`;
const now=new Date('2026-10-31T04:43:00.000Z');
const slot='2026-10-30T23:37:00.000Z';
function snapshot(capture='2026-10-30T20:26:00.000Z'){
 const result={sources:{},calendar:{sources:{}}};
 for(const entry of getFreshness({}, {now}).entries){
  const [kind,id]=entry.id.split(':');
  (kind==='data'?result.sources:result.calendar.sources)[id]={status:'ok',fetchedAt:capture,lastAttemptAt:capture};
 }
 return result;
}
const run=(id,extra={})=>({
 id,workflow_id:55,path:'.github/workflows/ci.yml',head_branch:'main',head_repository:{full_name:repository},
 event:'schedule',status:'completed',created_at:'2026-10-31T01:17:00Z',...extra,
});
function fixture(){
 const f={snapshot:snapshot(),now,runs:[],state:'active',writes:[],reads:[],total:null,hiddenActive:[]};
 f.api=async(method,url,body)=>{
  if(method==='GET'){
   f.reads.push(url);
   if(url===workflowApi)return {id:55,path:'.github/workflows/ci.yml',state:f.state};
   if(url===`${workflowApi}/runs?branch=main&per_page=100`)return {total_count:f.total??f.runs.length,workflow_runs:f.runs};
   const status=url.match(/&status=([a-z_]+)&per_page=100$/)?.[1];
   if(status){
    const runs=[...f.runs,...f.hiddenActive].filter(item=>item.status===status);
    return {total_count:runs.length,workflow_runs:runs};
   }
   throw new Error(`Unexpected read ${url}`);
  }
  f.writes.push({method,url,body});return null;
 };
 return f;
}
async function execute(f){
 const {recoverOverdueNightly}=await import('../scripts/recover-nightly-refresh.mjs');
 return recoverOverdueNightly(f);
}

test('missing nightly invocation dispatches only the existing guarded pipeline on main',async()=>{
 const f=fixture(),before=structuredClone(f.snapshot);
 const result=await execute(f);
 assert.equal(result.dispatched,true);assert.equal(result.expectedRefreshAt,slot);
 assert.equal(result.pendingSources,32);
 assert.deepEqual(f.writes,[{method:'POST',url:`${workflowApi}/dispatches`,body:{
  ref:'main',inputs:{recover_overdue:true,refresh_data:false},
 }}]);
 assert.deepEqual(f.snapshot,before,'recovery never edits source data or capture provenance');
});

test('completed captures and the original sixty-minute grace need no API calls or recovery',async()=>{
 for(const time of ['2026-10-30T23:36:59Z','2026-10-30T23:50:00Z','2026-10-31T00:17:00Z','2026-10-31T00:37:00Z']){
  const f=fixture();f.now=new Date(time);assert.equal((await execute(f)).dispatched,false,time);
  assert.deepEqual(f.reads,[]);assert.deepEqual(f.writes,[]);
 }
 const f=fixture();f.snapshot=snapshot('2026-10-31T00:38:00.000Z');
 assert.equal((await execute(f)).reason,'current');assert.deepEqual(f.reads,[]);
});

test('assembly, attempts and failed or future captures do not clear the overdue state',async()=>{
 for(const changes of [
  {lastAttemptAt:now.toISOString()},
  {fetchedAt:now.toISOString(),status:'error'},
  {fetchedAt:'2026-11-01T00:00:00.000Z'},
  {fetchedAt:'invalid'},
 ]){
  const f=fixture();f.snapshot=snapshot('2026-10-31T00:38:00.000Z');
  f.snapshot.assembledAt=now.toISOString();Object.assign(f.snapshot.sources.treasury,changes);
  if(!('fetchedAt' in changes))f.snapshot.sources.treasury.fetchedAt='2026-10-30T20:26:00.000Z';
  assert.equal((await execute(f)).dispatched,true,JSON.stringify(changes));
 }
});

test('only the existing approved cached BLS exception can satisfy recovery without a new capture',async()=>{
 const f=fixture();f.snapshot=snapshot('2026-10-31T00:38:00.000Z');
 const url='https://www.bls.gov/schedule/2026/home.htm';
 f.snapshot.calendar.sources.bls={
  id:'bls',status:'error',fetchedAt:'2026-10-30T20:26:00.000Z',lastAttemptAt:'2026-10-31T00:38:00.000Z',
  error:'Official source HTTP 403',failure:{kind:'http',status:403,redirected:false,requestedUrl:url,url},
  provenance:[{url,sha256:'a'.repeat(64)}],
  events:[{id:'cpi',sourceId:'bls',program:'consumer-price-index',name:'Consumer Price Index',seriesId:'cpi',seriesIds:['cpi'],
   date:'2026-10-29',time:'08:30',scheduledAt:'2026-10-29T12:30:00.000Z',sourceUrl:url}],
 };
 f.snapshot.publicationPolicy={mode:'allow-cached-bls-calendar',cachedCalendarSources:['bls']};
 assert.equal((await execute(f)).reason,'current');assert.deepEqual(f.writes,[]);
 f.snapshot.calendar.sources.bls.provenance[0].sha256='invalid';
 assert.equal((await execute(f)).dispatched,true,'invalid retained provenance cannot silence an overdue target');
});

test('active main pipelines block recovery even if they started before this slot',async()=>{
 for(const status of ['queued','requested','pending','waiting','in_progress']){
  const f=fixture();f.runs=[run(1,{status,created_at:'2026-10-29T12:00:00Z'})];
  assert.equal((await execute(f)).reason,'active');assert.deepEqual(f.writes,[]);
 }
 const f=fixture();f.hiddenActive=[run(1,{status:'waiting',created_at:'2026-10-01T12:00:00Z'})];
 assert.equal((await execute(f)).reason,'active','old active runs must be queried independently of recent history');
 assert.deepEqual(f.writes,[]);
});

test('documented main-qualified run paths retain active detection and the daily attempt budget',async()=>{
 const f=fixture();f.runs=[run(1,{path:'.github/workflows/ci.yml@main',status:'in_progress'})];
 assert.equal((await execute(f)).reason,'active');assert.deepEqual(f.writes,[]);
 f.runs=[1,2,3].map(id=>run(id,{path:'.github/workflows/ci.yml@main'}));
 assert.equal((await execute(f)).reason,'budget');assert.deepEqual(f.writes,[]);
});

test('cooldown and a three-run daily budget bound retries regardless of previous conclusions',async()=>{
 const recent=fixture();recent.runs=[run(1,{created_at:'2026-10-31T03:13:01Z',conclusion:'failure'})];
 assert.equal((await execute(recent)).reason,'cooldown');assert.deepEqual(recent.writes,[]);
 const boundary=fixture();boundary.runs=[run(1,{created_at:'2026-10-31T03:13:00Z'})];
 assert.equal((await execute(boundary)).dispatched,true);
 const exhausted=fixture();exhausted.runs=['push','schedule','workflow_dispatch'].map((event,i)=>run(i+1,{event}));
 assert.equal((await execute(exhausted)).reason,'budget');assert.deepEqual(exhausted.writes,[]);
 const previous=fixture();previous.runs=[1,2,3].map(id=>run(id,{created_at:'2026-10-30T20:00:00Z'}));
 assert.equal((await execute(previous)).dispatched,true,'a new slot has a new budget');
});

test('PR, foreign repository, other workflow and feature runs cannot suppress main recovery',async()=>{
 const f=fixture();f.runs=[
  run(1,{event:'pull_request'}),run(2,{head_repository:{full_name:'other/repo'}}),
  run(3,{workflow_id:99}),run(4,{head_branch:'feature'}),run(5,{path:'.github/workflows/other.yml'}),
 ].map(item=>({...item,status:'in_progress'}));
 assert.equal((await execute(f)).dispatched,true);
});

test('disabled workflows and truncated slot evidence fail closed without enabling anything',async()=>{
 const disabled=fixture();disabled.state='disabled_manually';
 assert.equal((await execute(disabled)).reason,'disabled');assert.deepEqual(disabled.writes,[]);
 const truncated=fixture();truncated.runs=Array.from({length:100},(_,i)=>run(i+1));truncated.total=101;
 assert.equal((await execute(truncated)).reason,'history-limit');assert.deepEqual(truncated.writes,[]);
 const mature=fixture();mature.runs=Array.from({length:100},(_,i)=>run(i+1,{created_at:'2026-10-30T20:00:00Z'}));
 mature.total=5000;assert.equal((await execute(mature)).dispatched,true,'all-time run count does not exhaust this slot');
});

test('malformed or future GitHub evidence and API failures never dispatch',async()=>{
 const invalidTimes=['invalid',null,0,'2026-10-30','2026-02-30T00:00:00Z','2026-10-30T23:37:00-04:00','2026-11-01T00:00:00Z'];
 for(const row of [...invalidTimes.map(created_at=>run(1,{created_at})),run(1,{status:'unknown'})]){
  const f=fixture();f.runs=[row];await assert.rejects(execute(f));assert.deepEqual(f.writes,[]);
 }
 for(const response of [{workflow_runs:null},{workflow_runs:[],total_count:'unknown'}]){
  const f=fixture(),api=f.api;f.api=(method,url)=>url.includes('/runs?')?response:api(method,url);
  await assert.rejects(execute(f));assert.deepEqual(f.writes,[]);
 }
 const f=fixture();f.api=async()=>{throw new Error('API unavailable');};await assert.rejects(execute(f));
 const active=fixture(),api=active.api;
 active.api=(method,url)=>url.includes('&status=')?{workflow_runs:[],total_count:'invalid'}:api(method,url);
 await assert.rejects(execute(active));assert.deepEqual(active.writes,[]);
});

test('ambiguous dispatch is attempted once and never retried in the same check',async()=>{
 const f=fixture(),api=f.api;
 f.api=async(method,...args)=>{if(method==='POST'){await api(method,...args);throw new Error('Connection lost');}return api(method,...args);};
 await assert.rejects(execute(f));assert.equal(f.writes.length,1);
});

test('GitHub client accepts a successful empty dispatch response',async()=>{
 let calls=0;
 const api=githubApi('test-token',async()=>{calls++;return new Response(null,{status:204});});
 assert.equal(await api('POST',`${workflowApi}/dispatches`,{ref:'main'}),null);assert.equal(calls,1);
});

test('command rejects arguments, forks, PR events and non-main refs before requesting anything',()=>{
 for(const change of [
  {GITHUB_REPOSITORY:'other/repo'},{GITHUB_REF:'refs/heads/feature'},
  {GITHUB_EVENT_NAME:'pull_request'},{GITHUB_EVENT_NAME:'workflow_run'},
 ]){
  assert.throws(()=>execFileSync(process.execPath,['scripts/recover-nightly-refresh.mjs'],{
   env:{...process.env,GITHUB_REPOSITORY:repository,GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'schedule',...change},
   stdio:'pipe',
  }),error=>error.status===1&&!error.stderr.toString().includes('Bearer'));
 }
 assert.throws(()=>execFileSync(process.execPath,['scripts/recover-nightly-refresh.mjs','--force'],{stdio:'pipe'}));
});

test('independent watchdog uses trusted main with no source or deployment write permissions',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/nightly-refresh-recovery.yml',import.meta.url),'utf8').catch(()=> '');
 assert.match(workflow,/cron: '43 2,4,6 \* \* \*'/);
 assert.match(workflow,/github\.repository == 'Vasuki8\/us-treasury'/);
 assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/actions: write/);assert.match(workflow,/contents: read/);
 assert.match(workflow,/persist-credentials: false/);assert.match(workflow,/ref: \$\{\{ github\.sha \}\}/);
 assert.match(workflow,/cancel-in-progress: false/);assert.match(workflow,/timeout-minutes: 5/);
 assert.match(workflow,/node scripts\/recover-nightly-refresh\.mjs/);
 assert.doesNotMatch(workflow,/contents: write|pages: write|id-token: write|secrets\.|pull_request|workflow_run|npm run data:refresh/);
});
