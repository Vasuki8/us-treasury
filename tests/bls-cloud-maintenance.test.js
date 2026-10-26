import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {maintainBlsBackup, githubApi} from '../scripts/bls-backup-maintenance.mjs';

const repo='Vasuki8/us-treasury', base=`/repos/${repo}`;
const config={confirmedRegistrationOn:'2026-10-25',weeklyChecksStartOn:'2026-10-26',recipient:'Vasuki8'};
const healthMarker='<!-- bls-backup-maintenance:health -->';
const run=(id,conclusion='success',created_at='2026-10-26T13:20:00Z',event='schedule')=>({id,workflow_id:396369014,path:'.github/workflows/bls-registered-access.yml',head_branch:'main',head_repository:{full_name:repo},event,status:'completed',conclusion,created_at});
function fixture(runs=[run(101)],issues=[],state='active'){
 const writes=[],comments=[];
 const api=async(method,path,body)=>{
  if(method==='GET'){
   if(path.endsWith('/actions/workflows/bls-registered-access.yml'))return {id:396369014,state};
   if(path.includes('/actions/workflows/')&&path.includes('/runs?'))return {workflow_runs:path.includes('page=2')?[]:runs};
   if(path.includes('/issues?'))return path.includes('page=2')?[]:structuredClone(issues);
   if(path.includes('/comments?'))return path.includes('page=2')?[]:structuredClone(comments);
   throw new Error(`Unexpected GET ${path}`);
  }
  writes.push({method,path,body});
  if(method==='POST'&&path.endsWith('/comments')){const comment={...body,user:{login:'github-actions[bot]'}};comments.push(comment);return comment;}
  if(method==='POST'&&path===`${base}/issues`){const issue={...body,number:issues.length+1,state:'open',user:{login:'github-actions[bot]'}};issues.push(issue);return structuredClone(issue);}
  const issue=issues.find(item=>path===`${base}/issues/${item.number}`);
  assert.ok(issue,'only expected issue is updated');Object.assign(issue,body);return structuredClone(issue);
 };
 return {api,writes,issues,comments};
}
const execute=(f,now='2026-10-27T14:00:00Z',extra={})=>maintainBlsBackup({api:f.api,config,now:new Date(now),...extra});

test('healthy checks stay silent and a failed check alerts once, recovers and alerts on recurrence',async()=>{
 const runs=[run(101)],f=fixture(runs);
 assert.equal((await execute(f)).health,'ok');assert.equal(f.writes.length,0);
 runs.unshift(run(102,'failure','2026-10-27T13:00:00Z','workflow_dispatch'));
 assert.equal((await execute(f)).health,'failed');assert.equal(f.writes.length,1);
 assert.deepEqual(f.writes[0].body.assignees,['Vasuki8']);assert.match(f.issues[0].body,/@Vasuki8/);
 assert.match(f.issues[0].body,/actions\/runs\/102/);
 runs.unshift(run(103,'failure','2026-10-27T13:10:00Z','workflow_dispatch'));
 await execute(f);assert.equal(f.writes.length,1,'another failure in the same incident stays quiet');
 f.issues[0].state='closed';await execute(f);assert.equal(f.writes.length,1,'manual acknowledgement is respected');
 runs.unshift(run(104,'success','2026-10-27T13:30:00Z','workflow_dispatch'));
 await execute(f);assert.equal(f.issues[0].state,'closed');assert.match(f.issues[0].body,/health:ok/);
 runs.unshift(run(105,'timed_out','2026-10-27T13:40:00Z','workflow_dispatch'));
 await execute(f);assert.equal(f.issues[0].state,'open');assert.equal(f.issues.length,1);
 const before=f.writes.length;await execute(f);assert.equal(f.writes.length,before);
});

test('registered check retries defer health alerts while active, with a bounded wait and independent renewal reminder',async()=>{
 const runs=[run(102,null,'2027-09-25T13:40:00Z','workflow_dispatch'),run(101,'failure','2027-09-25T13:30:00Z','workflow_dispatch')];runs[0].status='in_progress';
 const f=fixture(runs);const result=await execute(f,'2027-09-25T13:43:00Z');
 assert.equal(result.deferred,true);assert.equal(f.issues.filter(i=>i.body.startsWith(healthMarker)).length,0);assert.equal(f.issues.filter(i=>i.body.includes(':renewal:')).length,1);
 await execute(f,'2027-09-25T14:00:00Z');assert.ok(f.issues.some(i=>i.body.startsWith(healthMarker)),'stalled checks cannot suppress indefinitely');
});

test('missed schedules get a 24-hour Toronto grace, including DST; manual success does not prove the schedule ran',async()=>{
 const f=fixture([run(100,'success','2026-10-25T21:32:21Z','workflow_dispatch')]);
 assert.equal((await execute(f,'2026-10-26T13:18:00Z')).health,'ok');
 assert.equal((await execute(f,'2026-10-27T13:16:59Z')).health,'ok');
 assert.equal((await execute(f,'2026-10-27T13:17:00Z')).health,'unverified');
 assert.match(f.issues[0].body,/scheduled check/);assert.match(f.issues[0].body,/not evidence of a BLS data failure/);
 const dst=fixture([run(201,'success','2026-11-02T14:20:00Z')]);
 assert.equal((await execute(dst,'2026-11-03T14:17:00Z')).health,'ok');
});

test('a new failure after a missed schedule sends one mentioned comment; interrupted issue update does not duplicate it',async()=>{
 const runs=[run(100,'success','2026-10-25T21:32:21Z','workflow_dispatch')],f=fixture(runs);
 await execute(f);assert.equal(f.issues.length,1);
 runs.unshift(run(102,'failure','2026-10-27T13:30:00Z','workflow_dispatch'));
 const brokenApi=async(method,path,body)=>{if(method==='PATCH')throw new Error('Temporary GitHub update failure');return f.api(method,path,body);};
 await assert.rejects(execute(f,undefined,{api:brokenApi}));
 assert.equal(f.comments.length,1);assert.match(f.comments[0].body,/@Vasuki8/);assert.match(f.comments[0].body,/health:failed/);
 await execute(f);assert.equal(f.comments.length,1);assert.match(f.issues[0].body,/health:failed/);
 await execute(f);assert.equal(f.comments.length,1);
});

test('foreign, PR, wrong-workflow and feature runs cannot claim recovery; in-progress work cannot erase a failure',async()=>{
 const runs=[run(101,'failure')],f=fixture(runs);
 for(const override of [{head_branch:'feature'},{event:'pull_request'},{head_repository:{full_name:'other/repo'}},{workflow_id:77},{path:'.github/workflows/other.yml'},{status:'in_progress',conclusion:null}])runs.unshift({...run(202,'success','2026-10-27T13:00:00Z'),...override});
 assert.equal((await execute(f)).health,'failed');
 const disabled=fixture([run(101)],[],'disabled_manually');assert.equal((await execute(disabled)).health,'unverified');
 const missing=fixture([]);assert.equal((await execute(missing)).health,'unverified');
});

test('renewal starts Sep25 Toronto, catches overdue runs and stays one reminder until explicit renewal confirmation',async()=>{
 const f=fixture([run(101,'success','2027-09-20T13:20:00Z')]);
 await execute(f,'2027-09-25T03:59:59Z');assert.equal(f.issues.filter(i=>i.body.includes(':renewal:')).length,0);
 const result=await execute(f,'2027-09-25T13:43:00Z');assert.equal(result.renewalDueOn,'2027-10-25');
 const reminder=f.issues.find(i=>i.body.includes(':renewal:'));
 assert.ok(reminder);assert.match(reminder.body,/2027-09-25/);assert.match(reminder.body,/2027-10-25/);
 assert.match(reminder.body,/registrationEngine/);assert.match(reminder.body,/settings\/secrets\/actions/);
 assert.deepEqual(reminder.assignees,['Vasuki8']);
 reminder.state='closed';const count=f.writes.filter(write=>write.body.body?.includes(':renewal:')).length;
 await execute(f,'2028-02-01T15:00:00Z');assert.equal(f.writes.filter(write=>write.body.body?.includes(':renewal:')).length,count,'no reminder rollover or duplicate after acknowledgement');
 assert.equal((await execute(f,'2028-02-01T15:00:00Z')).renewalDueOn,'2027-10-25','API success never renews registration');
 const fresh=fixture();await execute(fresh,'2027-11-01T15:00:00Z');assert.ok(fresh.issues.some(i=>i.body.includes(':renewal:2026-10-25')),'late start catches overdue reminder');
 reminder.state='open';await execute(f,'2027-10-20T14:00:00Z',{config:{...config,confirmedRegistrationOn:'2027-10-20'}});
 assert.equal(reminder.state,'closed','explicit updated confirmation supersedes prior reminder');
 assert.equal(f.issues.filter(i=>i.body.includes(':renewal:')).length,1);
});

test('only bot-managed issues are changed and notification test is clearly labeled and assigned',async()=>{
 const userIssue={number:9,body:`${healthMarker}\n<!-- health:failed -->`,state:'open',user:{login:'Vasuki8'}};
 const f=fixture([run(101)], [userIssue]);await execute(f);assert.equal(f.writes.length,0);
 await execute(f,undefined,{notificationTest:true});
 const notice=f.issues.find(i=>i.number!==9);assert.match(notice.title,/test/i);assert.match(notice.body,/not a backup failure or renewal warning/);
 assert.deepEqual(notice.assignees,['Vasuki8']);assert.equal(notice.state,'closed');
 const count=f.writes.length;await execute(f,undefined,{notificationTest:true});assert.equal(f.writes.length,count);
});

test('GitHub request failures and redirects never expose token or response text',async()=>{
 for(const status of [302,403,500]){
  const token='private-canary-token';let request;
  const api=githubApi(token,async(url,options)=>{request={url,options};return {ok:false,status,text:async()=>`${token} private upstream body`};});
  await assert.rejects(api('GET',`${base}/issues?state=all`),error=>!error.message.includes(token)&&!error.message.includes('upstream')&&error.message.includes(String(status)));
  assert.equal(request.url,`https://api.github.com${base}/issues?state=all`);assert.equal(request.options.redirect,'error');
 }
 const f=fixture();await assert.rejects(execute(f,undefined,{config:{...config,confirmedRegistrationOn:'2026-02-30'}}));assert.equal(f.writes.length,0);
});

test('cloud notifier is main-only, does not receive the BLS key and cannot publish or deploy',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/bls-backup-maintenance.yml',import.meta.url),'utf8');
 assert.match(workflow,/workflow_run:[\s\S]*workflows: \['Check registered BLS backup', 'Test, build and deploy'\][\s\S]*types: \[completed\][\s\S]*branches: \[main\]/);
 assert.match(workflow,/cron: '43 9 \* \* \*'\s*\n\s*timezone: America\/Toronto/);
 assert.match(workflow,/github\.repository == 'Vasuki8\/us-treasury'/);assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
 assert.match(workflow,/head_repository\.full_name == github\.repository/);assert.match(workflow,/cancel-in-progress: false/);
 assert.match(workflow,/actions: read/);assert.match(workflow,/issues: write/);assert.match(workflow,/persist-credentials: false/);
 assert.match(workflow,/ref: \$\{\{ github.sha \}\}/);assert.match(workflow,/node scripts\/bls-backup-maintenance.mjs/);
 assert.doesNotMatch(workflow,/BLS_API_KEY|contents: write|pages: write|id-token: write|npm ci|head_sha|pull_request:|download-artifact|deploy-pages/);
});
