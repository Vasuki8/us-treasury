import {appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {repository,base,githubApi} from './github-maintenance.mjs';
import {getDailyRefreshPlan} from './check-refresh-due.mjs';
import {DAILY_REFRESH_SCHEDULE,getScheduledRefreshAt} from '../src/freshness.js';

const workflowApi=`${base}/actions/workflows/ci.yml`;
const activeStates=['queued','requested','pending','waiting','in_progress'];
const maxRuns=3,cooldownMs=90*60000;
const validTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&
 Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===(value.includes('.')?value:value.replace('Z','.000Z'));

/** Recover missing invocations only; collection and publication stay in the existing CI pipeline. */
export async function recoverOverdueNightly({api,snapshot,now=new Date()}){
 const expectedRefreshAt=getScheduledRefreshAt(now),slot=Date.parse(expectedRefreshAt);
 const result={dispatched:false,expectedRefreshAt,pendingSources:0,attempts:0};
 const skip=reason=>({...result,reason});
 if(+now<=slot+DAILY_REFRESH_SCHEDULE.graceMinutes*60000)return skip('within-grace');
 const daily=getDailyRefreshPlan(snapshot,{now,expectedRefreshAt});
 result.pendingSources=daily.pendingSources.length;
 if(!daily.required)return skip('current');

 const workflow=await api('GET',workflowApi);
 if(!Number.isSafeInteger(workflow?.id)||workflow.id<=0||workflow.path!=='.github/workflows/ci.yml'){
  throw new Error('Invalid refresh workflow evidence.');
 }
 if(workflow.state!=='active')return skip('disabled');
 const trusted=run=>run.workflow_id===workflow.id&&[workflow.path,`${workflow.path}@main`].includes(run.path)&&run.head_branch==='main'&&
  run.head_repository?.full_name===repository&&['push','schedule','workflow_dispatch'].includes(run.event);
 const validate=response=>{
  if(!Array.isArray(response?.workflow_runs)||response.workflow_runs.length>100||
   !Number.isSafeInteger(response.total_count)||response.total_count<response.workflow_runs.length){
   throw new Error('Invalid refresh run collection.');
  }
  for(const run of response.workflow_runs){
   if(!Number.isSafeInteger(run?.id)||run.id<=0||!validTime(run.created_at)||Date.parse(run.created_at)>+now||
    !['completed',...activeStates].includes(run.status))throw new Error('Invalid refresh run evidence.');
  }
  return response.workflow_runs;
 };
 const response=await api('GET',`${workflowApi}/runs?branch=main&per_page=100`),runs=validate(response);
 if(response.total_count>runs.length&&(!runs.length||Math.min(...runs.map(run=>Date.parse(run.created_at)))>=slot)){
  return skip('history-limit');
 }
 // Query active states separately so old waiting runs cannot be hidden by recent completed runs.
 const active=await Promise.all(activeStates.map(status=>api('GET',`${workflowApi}/runs?branch=main&status=${status}&per_page=100`)));
 for(const page of active){
  const candidates=validate(page);
  if(candidates.some(trusted))return skip('active');
  if(page.total_count>candidates.length)return skip('history-limit');
 }
 const mainRuns=runs.filter(trusted);
 if(mainRuns.some(run=>activeStates.includes(run.status)))return skip('active');
 result.attempts=mainRuns.filter(run=>Date.parse(run.created_at)>=slot).length;
 if(result.attempts>=maxRuns)return skip('budget');
 if(mainRuns.some(run=>+now-Date.parse(run.created_at)<cooldownMs))return skip('cooldown');

 // Do not retry an ambiguous POST: an accepted request may already have created the run.
 await api('POST',`${workflowApi}/dispatches`,{ref:'main',inputs:{recover_overdue:true,refresh_data:false}});
 return {...result,dispatched:true,reason:'dispatched'};
}

async function main(){
 if(process.argv.length>2||process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/main'||
  !['schedule','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME))throw new Error('Recovery is restricted to trusted main.');
 const {snapshot}=await import('../src/official-snapshot.js');
 const result=await recoverOverdueNightly({api:githubApi(process.env.GH_TOKEN),snapshot});
 console.log(JSON.stringify(result));
 if(process.env.GITHUB_STEP_SUMMARY){
  const messages={
   dispatched:'Requested the existing CI pipeline. Capture, publication and deployment are not yet verified.',
   current:'The committed snapshot satisfies the daily capture policy. No recovery was requested.',
   'within-grace':'The existing nightly grace has not elapsed. No recovery was requested.',
   active:'A trusted main pipeline is active. No competing recovery was requested.',
   cooldown:'A trusted main run started less than 90 minutes ago. No recovery was requested.',
   budget:'The three-run daily allowance is exhausted. Captures remain overdue; inspect CI and the data-update alerts.',
   disabled:'The refresh workflow is disabled. Captures remain overdue; an operator must inspect workflow activation.',
   'history-limit':'Run evidence is incomplete. Captures remain overdue; no recovery was requested.',
  };
  await appendFile(process.env.GITHUB_STEP_SUMMARY,
   `### Nightly invocation recovery\n\n${messages[result.reason]}\n\nSlot: ${result.expectedRefreshAt}. Pending inputs: ${result.pendingSources}.\n`);
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{
 console.error('Nightly recovery could not complete. Inspect workflow access and data-update alerts; no refresh result is inferred.');
 process.exitCode=1;
});
