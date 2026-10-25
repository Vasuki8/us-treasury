import {readFile,appendFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const repository='Vasuki8/us-treasury',base=`/repos/${repository}`;
const workflowPath='.github/workflows/bls-registered-access.yml';
const workflowApi=`${base}/actions/workflows/bls-registered-access.yml`;
const healthMarker='<!-- bls-backup-maintenance:health -->';
const renewalPrefix='<!-- bls-backup-maintenance:renewal:';
const testMarker='<!-- bls-backup-maintenance:notification-test -->';
const dayMs=86400000;

function validDay(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('Maintenance date must be an ISO calendar date.');
 const date=new Date(`${value}T00:00:00Z`);
 if(!Number.isFinite(+date)||date.toISOString().slice(0,10)!==value)throw new Error('Invalid maintenance calendar date.');
 return date;
}
function torontoTime(date){
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]));
 return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
function expectedMonday(now,startsOn){
 const local=torontoTime(now),today=validDay(local.slice(0,10));
 const daysSinceMonday=(today.getUTCDay()+6)%7;
 // A full local calendar day of grace allows delayed GitHub schedules.
 const previousWeek=daysSinceMonday===0||daysSinceMonday===1&&local.slice(11)<'09:17';
 const monday=new Date(+today-(daysSinceMonday+(previousWeek?7:0))*dayMs).toISOString().slice(0,10);
 return monday>=startsOn?`${monday}T09:17`:null;
}

export function githubApi(token,fetchImpl=fetch){
 if(!token)throw new Error('Repository notification token is unavailable.');
 return async(method,apiPath,body)=>{
  if(!apiPath.startsWith(`${base}/`))throw new Error('Unsupported repository notification path.');
  let response;
  try{response=await fetchImpl(`https://api.github.com${apiPath}`,{method,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});}
  catch{throw new Error('GitHub maintenance request could not complete.');}
  if(!response.ok)throw new Error(`GitHub maintenance request failed (HTTP ${response.status}).`);
  return response.json();
 };
}

export async function maintainBlsBackup({api,config,now=new Date(),notificationTest=false}){
 const today=torontoTime(now).slice(0,10);
 const registered=validDay(config.confirmedRegistrationOn);validDay(config.weeklyChecksStartOn);
 if(config.confirmedRegistrationOn>today||config.recipient!=='Vasuki8')throw new Error('Maintenance confirmation or recipient is invalid.');
 // Never advance the anniversary from API success or an acknowledged issue.
 const anniversary=new Date(registered);anniversary.setUTCFullYear(anniversary.getUTCFullYear()+1);
 if(anniversary.getUTCMonth()!==registered.getUTCMonth())anniversary.setUTCDate(0);
 const renewalDueOn=anniversary.toISOString().slice(0,10);
 const reminderOn=new Date(+anniversary-30*dayMs).toISOString().slice(0,10);
 const workflow=await api('GET',workflowApi);
 async function list(apiPath,key){
  const items=[];
  for(let page=1;;page++){
   const response=await api('GET',`${apiPath}${apiPath.includes('?')?'&':'?'}per_page=100&page=${page}`);
   const batch=key?response[key]:response;
   if(!Array.isArray(batch))throw new Error('GitHub maintenance returned an invalid collection.');
   items.push(...batch);if(batch.length<100)return items;
  }
 }
 const [allRuns,allIssues]=await Promise.all([
  list(`${workflowApi}/runs?branch=main`, 'workflow_runs'),
  list(`${base}/issues?state=all&creator=github-actions%5Bbot%5D`)
 ]);
 const runs=allRuns.filter(run=>Number.isSafeInteger(run.id)&&run.id>0&&run.workflow_id===workflow.id&&run.path===workflowPath&&run.head_branch==='main'&&run.head_repository?.full_name===repository&&['schedule','workflow_dispatch'].includes(run.event)&&Number.isFinite(Date.parse(run.created_at))&&Date.parse(run.created_at)<=+now).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)||b.id-a.id);
 const latest=runs.find(run=>run.status==='completed');
 const expected=expectedMonday(now,config.weeklyChecksStartOn);
 const scheduled=expected&&runs.some(run=>run.event==='schedule'&&run.status==='completed'&&torontoTime(new Date(run.created_at))>=expected);
 let health='ok',detail='The registered backup check passed.';
 if(workflow.state!=='active'){health='unverified';detail='The registered-check workflow is disabled or unavailable. Re-enable it and run a check.';}
 else if(!latest){health='unverified';detail='No completed trusted registered check is available. Run the registered-check workflow.';}
 else if(latest.conclusion!=='success'){health='failed';detail='The latest completed registered backup check did not pass. Review its safe report and job status; this alone does not identify a key or upstream failure.';}
 else if(expected&&!scheduled){health='unverified';detail=`The expected weekly scheduled check for ${expected.slice(0,10)} has not completed after a 24-hour grace period. A manual check does not prove the schedule ran. This is not evidence of a BLS data failure.`;}
 const issues=allIssues.filter(issue=>!issue.pull_request&&issue.user?.login==='github-actions[bot]'&&Number.isSafeInteger(issue.number));
 const recipient=`@${config.recipient}`;
 let created=0,updated=0;
 async function create(title,body){
  const issue=await api('POST',`${base}/issues`,{title,body,assignees:[config.recipient]});
  if(!issue.assignees?.some(assignee=>(typeof assignee==='string'?assignee:assignee.login)===config.recipient))throw new Error('GitHub did not assign the maintenance notification recipient.');
  created++;return issue;
 }
 async function update(issue,body){await api('PATCH',`${base}/issues/${issue.number}`,body);updated++;}
 const healthIssue=issues.find(issue=>issue.body?.startsWith(healthMarker));
 const bodyHealth=healthIssue?.body?.match(/<!-- health:(ok|failed|unverified) -->/)?.[1];
 const comments=healthIssue?await list(`${base}/issues/${healthIssue.number}/comments`):[];
 const lastTransition=comments.filter(comment=>comment.user?.login==='github-actions[bot]'&&/^<!-- bls-backup-maintenance:health:(ok|failed|unverified) -->/.test(comment.body)).at(-1);
 const previousHealth=lastTransition?.body.match(/^<!-- bls-backup-maintenance:health:(ok|failed|unverified) -->/)[1]??bodyHealth;
 if((health!=='ok'&&!healthIssue)||(healthIssue&&(previousHealth!==health||bodyHealth!==health))){
  const runLink=latest?`[Latest completed check](https://github.com/${repository}/actions/runs/${latest.id})`:`[Registered checks](https://github.com/${repository}/actions/workflows/bls-registered-access.yml)`;
  const title=`[BLS backup] ${health==='ok'?'Recovered':health==='failed'?'Check needs attention':'Monitoring unverified'}`;
  const body=`${healthMarker}\n<!-- health:${health} -->\n\n${recipient} ${detail}\n\n${runLink}. The registered check validates all 31 outputs; its report contains safe diagnostics. Published data are not changed by this monitor.\n\nWeekly validation: Monday 09:17 America/Toronto. Cloud monitoring checks daily and after each validation. An unchanged incident stays quiet; a later recovery and recurrence update this issue. Closing an unresolved issue acknowledges it and does not renew the key.\n`;
  if(!healthIssue)await create(title,body);
  else{
   // Notify before updating; an interrupted update can retry using the comment's status without repeating the notification.
   if(previousHealth!==health)await api('POST',`${base}/issues/${healthIssue.number}/comments`,{body:`<!-- bls-backup-maintenance:health:${health} -->\n\n${recipient} ${detail}\n\n${runLink}.`});
   await update(healthIssue,{title,body,state:health==='ok'?'closed':'open',...(health==='ok'?{state_reason:'completed'}:{})});
  }
 }
 const renewalMarker=`${renewalPrefix}${config.confirmedRegistrationOn} -->`;
 for(const issue of issues){
  const oldDate=issue.body?.match(/^<!-- bls-backup-maintenance:renewal:(\d{4}-\d{2}-\d{2}) -->/)?.[1];
  if(oldDate&&oldDate<config.confirmedRegistrationOn&&issue.state==='open')await update(issue,{state:'closed',state_reason:'completed',body:`${issue.body}\n\nSuperseded by an explicitly confirmed registration/renewal on ${config.confirmedRegistrationOn}. Next reminder: ${reminderOn}; anniversary: ${renewalDueOn}.\n`});
 }
 if(today>=reminderOn&&!issues.some(issue=>issue.body?.startsWith(renewalMarker))){
  await create('[BLS backup] Renew free BLS API registration',`${renewalMarker}\n\n${recipient} Please renew the free BLS API registration. Your confirmed registration/renewal date is **${config.confirmedRegistrationOn}**; the annual renewal anniversary is **${renewalDueOn}**. The 30-day reminder window starts **${reminderOn}**. If this reminder is late, renew now.\n\n1. Open the [BLS registration page](https://data.bls.gov/registrationEngine/).\n2. If BLS changes the key, update only the private [repository Actions secret BLS_API_KEY](https://github.com/${repository}/settings/secrets/actions). Never paste a key in this issue or chat.\n3. Confirm the actual renewal date and update confirmedRegistrationOn in scripts/bls-backup-maintenance.json (or ask the maintainer to do it).\n\nThis reminder is sent once for this confirmed registration cycle, even if acknowledged or overdue. Closing it or passing API checks does not establish renewal or move the deadline. Codex does not need to be running.\n`);
 }
 if(notificationTest&&!issues.some(issue=>issue.body?.startsWith(testMarker))){
  const issue=await create('[BLS backup] Cloud notification delivery test',`${testMarker}\n\n${recipient} This is a cloud notification delivery test, not a backup failure or renewal warning. The GitHub workflow can assign you maintenance issues while Codex and your computer are off. It will close this test automatically.\n\nEnable participating/mention notifications [on GitHub and by email](https://github.com/settings/notifications), or configure GitHub Mobile push delivery. This test confirms issue creation and assignment; delivery to your email/device depends on those settings.\n`);
  await update(issue,{state:'closed',state_reason:'completed'});
 }
 return {health,renewalDueOn,reminderOn,created,updated};
}

async function main(){
 if(process.argv.length>2||process.env.GITHUB_REPOSITORY!==repository||process.env.GITHUB_REF!=='refs/heads/main')throw new Error('Cloud maintenance is restricted to this repository main branch.');
 const config=JSON.parse(await readFile(new URL('./bls-backup-maintenance.json',import.meta.url),'utf8'));
 const result=await maintainBlsBackup({api:githubApi(process.env.GH_TOKEN),config,notificationTest:process.env.BLS_NOTIFICATION_TEST==='true'});
 console.log(JSON.stringify(result));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`### BLS cloud maintenance\n\nBackup monitoring: **${result.health}**. Issues created: ${result.created}; updated: ${result.updated}. Renewal reminder starts ${result.reminderOn}, before the ${result.renewalDueOn} anniversary.\n\n[Maintenance issues](https://github.com/${repository}/issues?q=author%3Aapp%2Fgithub-actions). No BLS key, published data or website changes.\n`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(()=>{console.error('BLS cloud maintenance could not complete. Review workflow permissions and GitHub availability; no credential or upstream response is logged.');process.exitCode=1;});
