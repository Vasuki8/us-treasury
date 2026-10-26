import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {maintainDataUpdates} from '../scripts/data-update-maintenance.mjs';
import {getFreshness} from '../src/freshness.js';
import {syncHealthIssue} from '../scripts/github-maintenance.mjs';

const repo='Vasuki8/us-treasury',base=`/repos/${repo}`,now=new Date('2026-10-27T14:00:00Z');
const stamp='2026-10-27T13:00:00.000Z';
function snapshot(){
 const result={sources:{},calendar:{sources:{}}};
 for(const entry of getFreshness({}, {now}).entries){const [kind,id]=entry.id.split(':');(kind==='data'?result.sources:result.calendar.sources)[id]={status:'ok',fetchedAt:stamp,lastAttemptAt:stamp,error:null,failure:null};}
 return result;
}
const run=(id,extra={})=>({id,workflow_id:55,path:'.github/workflows/ci.yml',head_branch:'main',head_repository:{full_name:repo},event:'schedule',status:'completed',conclusion:'success',created_at:'2026-10-27T13:00:00Z',updated_at:new Date(Date.parse(extra.created_at??'2026-10-27T13:00:00Z')+600000).toISOString(),...extra});
const job=(name,conclusion='success',steps=[])=>({name,status:'completed',conclusion,steps,completed_at:null});
const report=(rows,checkedAt=stamp)=>({schemaVersion:1,checkedAt,sources:rows.map(([id,status='ok'])=>({id,status,fetchedAt:status==='ok'?checkedAt:'2026-10-26T13:00:00.000Z',lastAttemptAt:checkedAt,httpStatus:status==='ok'?null:503,cached:status!=='ok'}))});
function fixture(){
 const f={runs:[run(101)],jobs:{101:[job('Check daily and supported release refresh objectives'),job('Refresh official data and calendars'),job('Verify on Node 22'),job('Verify on Node 24'),job('Deploy GitHub Pages')]},reports:{},issues:[],comments:{},writes:[],snapshot:snapshot(),state:'active'};
 f.api=async(method,path,body)=>{
  if(method==='GET'){
   if(path===`${base}/actions/workflows/ci.yml`)return {id:55,state:f.state};
   if(path.includes('/actions/workflows/ci.yml/runs?'))return {workflow_runs:f.runs};
   if(path.includes('/issues?'))return structuredClone(f.issues);
   const jobs=path.match(/\/actions\/runs\/(\d+)\/jobs\?/);if(jobs)return {jobs:(f.jobs[jobs[1]]??[]).map(job=>({...job,completed_at:job.completed_at??f.runs.find(run=>run.id===Number(jobs[1]))?.updated_at}))};
   const comments=path.match(/\/issues\/(\d+)\/comments\?/);if(comments)return structuredClone(f.comments[comments[1]]??[]);
   throw new Error(`Unexpected GET ${path}`);
  }
  f.writes.push({method,path,body});
  if(method==='POST'&&path===`${base}/issues`){const issue={...body,number:f.issues.length+1,user:{login:'github-actions[bot]'},state:'open'};f.issues.push(issue);return structuredClone(issue);}
  const comment=path.match(/\/issues\/(\d+)\/comments$/);if(comment){const row={...body,user:{login:'github-actions[bot]'}};(f.comments[comment[1]]??=[]).push(row);return row;}
  const issue=f.issues.find(i=>path===`${base}/issues/${i.number}`);assert.ok(issue);Object.assign(issue,body);return structuredClone(issue);
 };
 f.readReport=async({run,artifactName})=>{const value=f.reports[`${run.id}:${artifactName}`];if(value instanceof Error)throw value;return value??null;};
 return f;
}
const execute=(f,extra={})=>maintainDataUpdates({api:f.api,readReport:f.readReport,snapshot:f.snapshot,now,...extra});
const find=(f,key)=>f.issues.find(i=>i.body.startsWith(`<!-- data-update-maintenance:${key}:health -->`));

test('healthy sources and actual successful update/deployment stay quiet',async()=>{
 const f=fixture();const result=await execute(f);assert.equal(f.writes.length,0);assert.equal(result.sourceCount,30);
});

test('daily monitoring defers incidents while a trusted bounded retry job is active, then alerts on its final failure',async()=>{
 const f=fixture();f.reports['101:official-refresh-status']=report([['data:census','error']], '2026-10-27T13:01:00.000Z');
 f.runs.unshift(run(102,{status:'in_progress',conclusion:null,created_at:'2026-10-27T13:58:00Z'}));
 const pending=await execute(f);assert.equal(f.writes.length,0);assert.ok(pending.deferred>0);
 f.runs[0].status='completed';f.runs[0].conclusion='failure';f.jobs[102]=[job('Refresh official data and calendars','failure')];f.runs[0].updated_at='2026-10-27T13:59:00Z';
 const final=await execute(f);assert.ok(find(f,'source:data:census'));assert.ok(find(f,'stage:refresh'));assert.equal(final.deferred,0);
});

test('foreign or expired active runs cannot silence final failures; an unrelated queued run cannot hide a completed trigger',async()=>{
 for(const extra of [{head_repository:{full_name:'other/repo'}},{created_at:'2026-10-27T10:00:00Z'}]){
  const f=fixture();f.reports['101:official-refresh-status']=report([['data:census','error']], '2026-10-27T13:01:00.000Z');f.runs.unshift(run(102,{status:'in_progress',conclusion:null,created_at:'2026-10-27T13:58:00Z',...extra}));
  await execute(f);assert.ok(find(f,'source:data:census'));
 }
 const f=fixture();f.reports['101:official-refresh-status']=report([['data:census','error']], '2026-10-27T13:01:00.000Z');f.runs.unshift(run(102,{status:'queued',conclusion:null,created_at:'2026-10-27T13:58:00Z'}));
 const api=async(method,path,body)=>path===`${base}/actions/runs/101`?f.runs.find(run=>run.id===101):f.api(method,path,body);
 await execute(f,{api,triggerRunId:101});assert.ok(find(f,'source:data:census'));
});

test('failed source is named once, unselected or older attempts cannot recover it, later attempted success does',async()=>{
 const f=fixture();f.reports['101:official-refresh-status']=report([['data:census','error']], '2026-10-27T13:01:00.000Z');
 await execute(f);const issue=find(f,'source:data:census');assert.ok(issue);assert.match(issue.body,/Census/);assert.deepEqual(issue.assignees,['Vasuki8']);
 const count=f.writes.length;await execute(f);assert.equal(f.writes.length,count);
 f.runs.unshift(run(102,{created_at:'2026-10-27T13:20:00Z'}));f.jobs[102]=[job('Refresh official data and calendars')];f.reports['102:official-refresh-status']=report([['data:bea']], '2026-10-27T13:21:00.000Z');
 await execute(f);assert.equal(issue.state,'open');
 f.reports['102:official-refresh-status']=report([['data:census']], '2026-10-27T13:21:00.000Z');
 await execute(f);assert.equal(issue.state,'closed');assert.equal(f.comments[issue.number].length,1);
});

test('a no-op or check-only success cannot recover deployment and refresh failures',async()=>{
 const f=fixture();f.jobs[101]=[job('Refresh official data and calendars','failure'),job('Deploy GitHub Pages','failure')];await execute(f);
 const deployment=find(f,'stage:deployment'),refresh=find(f,'stage:refresh');assert.equal(deployment.state,'open');assert.equal(refresh.state,'open');
 f.runs.unshift(run(102,{created_at:'2026-10-27T13:20:00Z'}));f.jobs[102]=[job('Check daily and supported release refresh objectives'),job('Refresh official data and calendars','skipped'),job('Deploy GitHub Pages','skipped'),job('Check all official sources without publishing')];
 await execute(f);assert.equal(deployment.state,'open');assert.equal(refresh.state,'open');
 f.runs.unshift(run(103,{created_at:'2026-10-27T13:30:00Z'}));f.jobs[103]=[job('Refresh official data and calendars'),job('Deploy GitHub Pages')];await execute(f);
 assert.equal(deployment.state,'closed');assert.equal(refresh.state,'closed');
});

test('verification failure and independent publication upkeep are classified separately',async()=>{
 const f=fixture();f.jobs[101]=[job('Verify on Node 22'),job('Verify on Node 24','failure'),job('Report publication evidence upkeep','failure'),job('Deploy GitHub Pages','skipped')];
 await execute(f);assert.ok(find(f,'stage:verification'));assert.ok(find(f,'stage:upkeep'));assert.equal(find(f,'stage:deployment'),undefined);
});

test('a recorded first source failure alerts without a retained capture',async()=>{
 const f=fixture();f.snapshot.sources.census={status:'unavailable',fetchedAt:null,lastAttemptAt:stamp,error:'private upstream text'};
 await execute(f);const issue=find(f,'source:data:census');assert.ok(issue);assert.match(issue.body,/No verified retained capture/);assert.doesNotMatch(issue.body,/private upstream/);
});

test('an attempted old capture is uncertainty, never successful recovery or an invented agency failure',async()=>{
 const f=fixture();const uncertain=report([['data:bea','error']], '2026-10-27T13:01:00.000Z');uncertain.sources[0].status='unverified';uncertain.sources[0].httpStatus=null;
 f.reports['101:official-refresh-status']=uncertain;await execute(f);assert.match(find(f,'source:data:bea').body,/health:unverified/);assert.match(find(f,'source:data:bea').body,/incomplete collection evidence/);
});

test('stage recovery and deployment freshness use actual completion, including older-run retries',async()=>{
 const f=fixture();f.runs=[run(102,{created_at:'2026-10-27T13:20:00Z'}),run(101)];
 f.jobs[102]=[job('Deploy GitHub Pages','failure')];f.jobs[101]=[{...job('Deploy GitHub Pages'),completed_at:'2026-10-27T13:50:00Z'}];
 await execute(f);assert.equal(find(f,'stage:deployment'),undefined,'later actual successful retry wins');
 const crossing=fixture();crossing.runs=[run(101,{created_at:'2026-10-26T23:36:00Z',updated_at:'2026-10-26T23:55:00Z'})];crossing.jobs[101]=[{...job('Deploy GitHub Pages'),completed_at:'2026-10-26T23:50:00Z'}];
 await execute(crossing);assert.equal(find(crossing,'stage:deployment'),undefined,'deployment after daily slot is current despite earlier workflow start');
});

test('a triggering retry outside recent history is inspected using its actual trusted run',async()=>{
 const f=fixture();f.jobs[101]=[job('Deploy GitHub Pages','failure')];
 const older=run(1,{created_at:'2026-10-20T10:00:00Z',updated_at:'2026-10-27T13:50:00Z'});
 f.jobs[1]=[{...job('Deploy GitHub Pages'),completed_at:'2026-10-27T13:50:00Z'}];
 const api=async(method,path,body)=>path===`${base}/actions/runs/1`?older:f.api(method,path,body);
 await execute(f,{api,triggerRunId:1});assert.equal(find(f,'stage:deployment'),undefined);
});

test('direct triggering-run metadata wins over an older list copy',async()=>{
 const f=fixture(),fresh={...f.runs[0],updated_at:'2026-10-27T13:50:00Z'};
 const api=async(method,path,body)=>path===`${base}/actions/runs/101`?fresh:f.api(method,path,body);
 let inspected=0;await execute(f,{api,triggerRunId:101,readReport:async({run})=>{inspected++;assert.equal(run.updated_at,fresh.updated_at);return null;}});assert.ok(inspected);
});

test('a delayed current deployment proof recovers a stale incident without repeated stale notifications',async()=>{
 const f=fixture();f.runs=[run(101,{created_at:'2026-10-26T13:00:00Z',updated_at:'2026-10-26T13:10:00Z'})];f.jobs[101]=[job('Deploy GitHub Pages')];
 await execute(f);const issue=find(f,'stage:deployment');assert.ok(issue);const count=f.writes.length;await execute(f);assert.equal(f.writes.length,count);
 f.runs[0].updated_at='2026-10-27T00:31:00Z';f.jobs[101][0].completed_at='2026-10-27T00:30:00Z';
 await execute(f);assert.equal(issue.state,'closed');assert.equal(f.comments[issue.number].length,1);
});

test('workflow initialization failure with no job evidence is monitoring uncertainty',async()=>{
 const f=fixture();f.runs[0].conclusion='failure';f.jobs[101]=[];
 await execute(f);assert.ok(find(f,'automation'));assert.match(find(f,'automation').body,/initialization/);assert.equal(f.issues.filter(i=>i.body.includes(':source:')).length,0);
});

test('newer healthy evidence prevents an older failure from reopening an incident',async()=>{
 const f=fixture();
 const args={api:f.api,issues:f.issues,key:'data-update-maintenance:source:data:bea',title:'BEA',message:'Fixed safe detail',link:'Fixed safe link'};
 for(const [health,observedAt]of [['failed','2026-10-27T10:00:00.000Z'],['ok','2026-10-27T11:00:00.000Z'],['ok','2026-10-27T12:00:00.000Z'],['failed','2026-10-27T11:30:00.000Z']])await syncHealthIssue({...args,health,observedAt});
 assert.equal(f.issues[0].state,'closed');assert.equal(f.comments[1].length,1,'new success is a silent timestamp update; older failure is ignored');
});

test('cached BLS remains a source incident even with successful pipeline; daily freshness uses the existing grace',async()=>{
 const f=fixture();f.snapshot.sources.bls={...f.snapshot.sources.bls,status:'error',error:'safe prior outage'};await execute(f);assert.ok(find(f,'source:data:bls'));
 const clean=fixture();for(const entry of getFreshness(clean.snapshot,{now}).entries){const [kind,id]=entry.id.split(':');const source=(kind==='data'?clean.snapshot.sources:clean.snapshot.calendar.sources)[id];source.fetchedAt=source.lastAttemptAt='2026-10-26T13:00:00.000Z';}
 await execute(clean,{now:new Date('2026-10-26T23:50:00Z')});assert.equal(find(clean,'daily'),undefined,'current slot still in grace');
 await execute(clean,{now:new Date('2026-10-27T00:38:00Z')});assert.ok(find(clean,'daily'));
});

test('missing/malformed new reports are unverified and never fabricated as source failures; PR/foreign runs are ignored',async()=>{
 const f=fixture();f.jobs[101]=[job('Refresh official data and calendars','failure',[{name:'Retain safe attempted-source status'}])];
 f.reports['101:official-refresh-status']=new Error('private-canary raw response');
 f.runs.unshift(run(102,{head_repository:{full_name:'other/repo'}}),run(103,{event:'pull_request'}),run(104,{head_branch:'feature'}));
 await execute(f);assert.ok(find(f,'report:refresh'));assert.equal(f.issues.filter(i=>i.body.includes(':source:')).length,0);
 assert.doesNotMatch(JSON.stringify(f.writes),/private-canary/);
 f.reports['101:official-refresh-status']=report([['data:bea']]);await execute(f);assert.equal(find(f,'report:refresh').state,'closed');
});

test('cloud workflow observes CI completions and collector reports are always retained without broadening secrets',async()=>{
 const [workflow,ci]=await Promise.all(['../.github/workflows/bls-backup-maintenance.yml','../.github/workflows/ci.yml'].map(file=>readFile(new URL(file,import.meta.url),'utf8')));
 assert.match(workflow,/workflows: \['Check registered BLS backup', 'Test, build and deploy'\]/);
 assert.match(workflow,/node scripts\/data-update-maintenance.mjs/);assert.doesNotMatch(workflow,/BLS_API_KEY|contents: write|pages: write|head_sha|download-artifact/);
 for(const name of ['official-source-check-status','official-refresh-status'])assert.match(ci,new RegExp(`if: always\\(\\)[\\s\\S]*name: ${name}[\\s\\S]*source-attempt-status\\.json`));
 assert.equal((ci.match(/name: Retain safe attempted-source status\s*\n\s*if: always\(\)\s*\n\s*continue-on-error: true/g)??[]).length,2,'report upload cannot block an otherwise valid update');
});
