import {appendFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {repository,base,githubApi,listGithub,syncHealthIssue,createNotice} from './github-maintenance.mjs';
import {validateSourceAttemptReport} from './source-attempt-report.mjs';
import {getFreshness} from '../src/freshness.js';
import {getDailyRefreshPlan} from './check-refresh-due.mjs';
import {readSourceAttemptArtifact} from './read-source-attempt-artifact.mjs';

const ciApi=`${base}/actions/workflows/ci.yml`;
const names={planning:'Check daily and supported release refresh objectives',refresh:'Refresh official data and calendars',deployment:'Deploy GitHub Pages',cloudflare:'Deploy Cloudflare',check:'Check all official sources without publishing',upkeep:'Report publication evidence upkeep'};
const labels={planning:'Refresh planning',refresh:'Data refresh, admission and publication',verification:'Tests and build',deployment:'Website deployment',check:'Read-only source validation',upkeep:'Publication evidence upkeep'};
const conclusions=new Set(['success','failure','cancelled','timed_out','action_required','neutral','stale','startup_failure']);
const canonical=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
const runLink=id=>`[Workflow run](https://github.com/${repository}/actions/runs/${id})`;

/** Inspect bounded recent CI evidence; a skipped job is never evidence of recovery. */
export async function maintainDataUpdates({api,readReport,snapshot,now=new Date(),notificationTest=false,triggerRunId=null}){
 const [workflow,response,allIssues]=await Promise.all([
  api('GET',ciApi),api('GET',`${ciApi}/runs?branch=main&per_page=30`),listGithub(api,`${base}/issues?state=all&creator=github-actions%5Bbot%5D`)
 ]);
 if(!Array.isArray(response.workflow_runs))throw new Error('Invalid automatic-update run collection.');
 const issues=allIssues.filter(issue=>!issue.pull_request&&issue.user?.login==='github-actions[bot]');
 const triggering=Number.isSafeInteger(triggerRunId)&&triggerRunId>0?await api('GET',`${base}/actions/runs/${triggerRunId}`):null;
 const candidates=[...new Map([...response.workflow_runs,...(triggering?[triggering]:[])].map(run=>[run.id,run])).values()];
 const runs=candidates.filter(run=>Number.isSafeInteger(run.id)&&run.id>0&&run.workflow_id===workflow.id&&run.path==='.github/workflows/ci.yml'&&run.head_branch==='main'&&run.head_repository?.full_name===repository&&['push','schedule','workflow_dispatch'].includes(run.event)&&run.status==='completed'&&canonical(run.created_at)&&Date.parse(run.created_at)<=+now).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id);
 const freshness=getFreshness(snapshot,{now}),sourceEvidence=new Map(),stages=new Map();let unexplainedWorkflowFailure=false;
 for(const entry of freshness.entries){
  const [kind,id]=entry.id.split(':'),source=kind==='data'?snapshot?.sources?.[id]:snapshot?.calendar?.sources?.[id];
  if(entry.lastAttemptAt&&entry.lastAttemptAt<=now.toISOString()&&(entry.fetchedAt===null||entry.fetchedAt<=now.toISOString())&&['ok','error','unavailable'].includes(source?.status)){
   const healthy=source.status==='ok'&&!source.error&&!source.failure&&entry.fetchedAt&&entry.fetchedAt>=entry.lastAttemptAt;
   sourceEvidence.set(entry.id,{health:healthy?'ok':source.status==='ok'?'unverified':'failed',observedAt:entry.lastAttemptAt,runId:null,cached:!!entry.fetchedAt});
  }
 }
 for(const run of runs){
  const jobs=await listGithub(api,`${base}/actions/runs/${run.id}/jobs?filter=latest`,'jobs');
  if(run===runs[0]&&run.conclusion!=='success'&&!jobs.some(job=>conclusions.has(job.conclusion)&&job.conclusion!=='success'&&(Object.values(names).includes(job.name)||/^Verify on Node (22|24)$/.test(job.name))))unexplainedWorkflowFailure=true;
  for(const stage of Object.keys(labels)){
   const selected=jobs.filter(job=>stage==='verification'?/^Verify on Node (22|24)$/.test(job.name):stage==='deployment'?[names.deployment,names.cloudflare].includes(job.name):job.name===names[stage]).filter(job=>job.status==='completed'&&conclusions.has(job.conclusion));
   const completed=selected.map(job=>canonical(job.completed_at)).filter(time=>time&&time>=canonical(run.created_at)&&time<=now.toISOString()).sort().at(-1);
   if(selected.length&&completed&&(!stages.has(stage)||completed>stages.get(stage).observedAt))stages.set(stage,{health:selected.every(job=>job.conclusion==='success')?'ok':'failed',runId:run.id,observedAt:completed});
  }
  for(const [role,name,artifactName]of [['refresh',names.refresh,'official-refresh-status'],['check',names.check,'official-source-check-status']]){
   const job=jobs.find(job=>job.name===name&&job.conclusion!=='skipped');if(!job)continue;
   let report=null;
   try{const raw=await readReport({run,artifactName});if(raw)report=validateSourceAttemptReport(raw,{now});}catch{/* Treat absent/unreadable evidence as unverified; never copy arbitrary diagnostic text. */}
   const completed=canonical(job.completed_at);
   if(completed&&completed<=now.toISOString()&&(!stages.has(`report:${role}`)||completed>stages.get(`report:${role}`).observedAt)&&job.steps?.some(step=>step.name==='Retain safe attempted-source status'))stages.set(`report:${role}`,{health:report?'ok':'unverified',runId:run.id,observedAt:completed});
   if(!report)continue;
   for(const row of report.sources){
    const previous=sourceEvidence.get(row.id);
    if(!previous||row.lastAttemptAt>previous.observedAt)sourceEvidence.set(row.id,{health:row.status==='ok'?'ok':row.status==='unverified'?'unverified':'failed',observedAt:row.lastAttemptAt,runId:run.id,cached:row.cached});
   }
  }
 }
 let created=0,updated=0;
 const footer='Runs in GitHub with no local app required. Repeated unchanged incidents stay quiet. Closing an unresolved issue acknowledges it; a later recovery/recurrence sends a mentioned update. No source key, published data or website is changed by this monitor.';
 async function notice(key,health,title,message,runId=null,observedAt=null){
  const result=await syncHealthIssue({api,issues,key:`data-update-maintenance:${key}`,health,title:`[Data updates] ${title}${health==='ok'?' — recovered':''}`,message,link:runId?runLink(runId):`[Automatic updates](https://github.com/${repository}/actions/workflows/ci.yml)`,footer,observedAt});
  created+=result.created;updated+=result.updated;
 }
 await notice('automation',workflow.state==='active'&&runs.length&&!unexplainedWorkflowFailure?'ok':'unverified','Automatic monitoring',workflow.state!=='active'?'The automatic-update workflow is disabled or unavailable. Restore it and verify a run.':unexplainedWorkflowFailure?'The latest automatic-update workflow did not complete successfully and no known failed stage explains the result. Check workflow initialization and execution; no agency failure is inferred.':runs.length?'Trusted completed automatic-update runs are available.':'No trusted completed automatic-update run is available; source or website failure has not been established.');
 for(const [id,evidence]of sourceEvidence){
  const label=freshness.entries.find(entry=>entry.id===id).label;
  await notice(`source:${id.toLowerCase()}`,evidence.health,label,evidence.health==='ok'?`${label} was attempted successfully at ${evidence.observedAt}. This verifies collection, not publication or deployment.`:`${label} ${evidence.health==='unverified'?'has incomplete collection evidence':'did not collect successfully'} at ${evidence.observedAt}.${evidence.cached?' Previously captured readings remain available with their original retrieval time.':' No verified retained capture is recorded.'} Check the linked run; no failure cause is inferred from arbitrary upstream text.`,evidence.runId,evidence.observedAt);
 }
 const deployment=stages.get('deployment');
 if(deployment?.health==='ok'&&+now>Date.parse(freshness.refreshDeadline)+60*60000&&deployment.observedAt<freshness.expectedRefreshAt)stages.set('deployment',{...deployment,health:'unverified',message:`No successful deployment is recorded for the daily slot ${freshness.expectedRefreshAt}, after two hours of grace. A source capture or skipped deployment cannot establish website publication.`});
 for(const [stage,evidence]of stages){
  const reporting=stage.startsWith('report:'),label=reporting?'Source attempt report':labels[stage];
  await notice(`${reporting?'report':'stage'}:${reporting?stage.slice(7):stage}`,evidence.health,label,evidence.message??(reporting?(evidence.health==='ok'?'The attempted-source report is readable and validated.':'The attempted-source report is missing, expired or invalid. Per-source results cannot be verified; do not infer source recovery.'):`${label} ${evidence.health==='ok'?'completed successfully':'did not complete successfully'}. Skipped or unrelated checks cannot establish recovery.${stage==='upkeep'?' This maintenance job is independent of statistical deployment.':''}`),evidence.runId,evidence.observedAt);
 }
 const daily=getDailyRefreshPlan(snapshot,{now,expectedRefreshAt:freshness.expectedRefreshAt});
 await notice('daily',daily.required?'unverified':'ok','Daily capture freshness',daily.required?`${daily.pendingSources.length} inputs still lack a valid capture or approved retained-data attempt for the daily slot ${daily.expectedRefreshAt}, after the existing 60-minute grace. Check automatic updates. This is monitoring uncertainty, not proof of an agency outage.`:`The committed snapshot satisfies the daily capture policy for ${daily.expectedRefreshAt}. Approved cached sources retain separate source incidents. This does not verify a new statistical release or public deployment.`);
 const testMarker='<!-- data-update-maintenance:notification-test -->';
 if(notificationTest&&!issues.some(issue=>issue.body?.startsWith(testMarker))){
  const issue=await createNotice(api,'[Data updates] Cloud notification delivery test',`${testMarker}\n\n@Vasuki8 This is a notification test for statistical sources, calendars and automatic updates, not an actual source, refresh or deployment failure. Alerts run in GitHub while Codex is closed. Email/mobile delivery follows your [GitHub settings](https://github.com/settings/notifications). This test closes automatically.\n`);
  created++;await api('PATCH',`${base}/issues/${issue.number}`,{state:'closed',state_reason:'completed'});updated++;
 }
 return {sourceCount:sourceEvidence.size,inspectedRuns:runs.length,created,updated,daily:daily.required?'unverified':'ok'};
}

async function main(){
 if(process.argv.length>2||process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/main')throw new Error('Cloud maintenance is restricted to trusted main.');
 const {snapshot}=await import('../src/official-snapshot.js');
 const token=process.env.GH_TOKEN,api=githubApi(token);
 const event=process.env.GITHUB_EVENT_NAME==='workflow_run'?JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8')):null;
 const triggerRunId=event?.workflow_run?.path==='.github/workflows/ci.yml'?event.workflow_run.id:null;
 const result=await maintainDataUpdates({api,snapshot,readReport:options=>readSourceAttemptArtifact({...options,api,token}),notificationTest:process.env.BLS_NOTIFICATION_TEST==='true',triggerRunId});
 console.log(JSON.stringify(result));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`### Data-source and update alerts\n\nInspected ${result.inspectedRuns} trusted runs and ${result.sourceCount} source outcomes. Daily capture status: ${result.daily}. Issues created: ${result.created}; updated: ${result.updated}. Collection, publication and deployment remain separate evidence.\n`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('Data-update monitoring could not complete. Check GitHub access and workflow status; no credential or arbitrary upstream error is logged.');process.exitCode=1;});
