import {base,repository,listGithub} from './github-maintenance.mjs';
import {validateSourceAttemptReport} from './source-attempt-report.mjs';
import {extractZipEntry} from './sources/zip.mjs';

const artifactJobs=new Map([['official-refresh-status','Refresh official data and calendars'],['official-source-check-status','Check all official sources without publishing']]);
const maxArchiveBytes=256*1024,maxReportBytes=64*1024;
const reportKeys=['schemaVersion','checkedAt','sources'];
const sourceKeys=['id','status','fetchedAt','lastAttemptAt','httpStatus','cached'];
const fail=()=>{throw new Error('Source attempt artifact could not be verified.');};

function exactKeys(value,keys){
 return value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
}
function artifactRedirect(location){
 const url=new URL(location);
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash)fail();
 const host=url.hostname;
 if(!/^productionresultssa\d+\.blob\.core\.windows\.net$/.test(host)&&host!=='actions.githubusercontent.com'&&!host.endsWith('.actions.githubusercontent.com')&&host!=='objects.githubusercontent.com')fail();
 return url.href;
}
async function boundedBytes(response){
 const length=response.headers.get('content-length');
 if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxArchiveBytes))fail();
 if(!response.body?.getReader)fail();
 const reader=response.body.getReader(),chunks=[];let total=0;
 try{
  for(;;){
   const {done,value}=await reader.read();if(done)break;
   total+=value.byteLength;if(total>maxArchiveBytes){await reader.cancel();fail();}
   chunks.push(Buffer.from(value));
  }
 }finally{reader.releaseLock();}
 return Buffer.concat(chunks,total);
}

/** Download one bounded data-only artifact; credentials never follow its signed redirect. */
export async function readSourceAttemptArtifact({api,token,run,job,artifactName,now=new Date(),fetchImpl=fetch}){
 try{
  if(!token||!artifactJobs.has(artifactName)||!(now instanceof Date)||!Number.isFinite(+now)||!Number.isSafeInteger(run?.id)||run.id<=0||run.path!=='.github/workflows/ci.yml'||run.head_branch!=='main'||run.head_repository?.full_name!==repository||!['schedule','push','workflow_dispatch'].includes(run.event)||run.status!=='completed')fail();
  const createdAt=Date.parse(run.created_at),updatedAt=Date.parse(run.updated_at);
  if(!Number.isFinite(createdAt)||!Number.isFinite(updatedAt)||updatedAt<createdAt||createdAt>+now)fail();
  const startedAt=Date.parse(job?.started_at),completedAt=Date.parse(job?.completed_at);
  if(!Number.isSafeInteger(job?.id)||job.id<=0||job.run_id!==run.id||job.name!==artifactJobs.get(artifactName)||job.status!=='completed'||job.conclusion==='skipped'||!Number.isFinite(startedAt)||!Number.isFinite(completedAt)||startedAt<createdAt||completedAt<startedAt||completedAt>updatedAt+60000||completedAt>+now)fail();
  const artifacts=await listGithub(api,`${base}/actions/runs/${run.id}/artifacts`,'artifacts');
  // Partial reruns retain earlier same-name uploads; IDs and list order are not clocks.
  const matches=artifacts.filter(item=>item?.name===artifactName&&item.expired!==true).filter(item=>{
   const uploadedAt=Date.parse(item.created_at);if(!Number.isFinite(uploadedAt))fail();
   return uploadedAt>=startedAt&&uploadedAt<=completedAt;
  });
  if(!matches.length)return null;
  if(matches.length!==1)fail();
  const artifact=matches[0];
  if(artifact.expired!==false||!Number.isSafeInteger(artifact.id)||artifact.id<=0||!Number.isSafeInteger(artifact.size_in_bytes)||artifact.size_in_bytes<=0||artifact.size_in_bytes>maxArchiveBytes||artifact.workflow_run&&artifact.workflow_run.id!==run.id)fail();
  let url=`https://api.github.com${base}/actions/artifacts/${artifact.id}/zip`,response;
  const signal=AbortSignal.timeout(20000);
  for(let redirects=0;redirects<=3;redirects++){
   response=await fetchImpl(url,{method:'GET',redirect:'manual',signal,...(redirects===0?{headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}}:{})});
   if(![301,302,303,307,308].includes(response.status))break;
   const location=response.headers.get('location');
   if(!location||redirects===3)fail();
   url=artifactRedirect(location);
  }
  if(response.status===410)return null;
  if(!response.ok)fail();
  const raw=JSON.parse(extractZipEntry(await boundedBytes(response),'source-attempt-status.json',{maxOutputBytes:maxReportBytes,maxEntries:10}).toString('utf8'));
  if(!exactKeys(raw,reportKeys)||!Array.isArray(raw.sources)||!raw.sources.every(row=>exactKeys(row,sourceKeys)))fail();
  const report=validateSourceAttemptReport(raw,{now}),checkedAt=Date.parse(report.checkedAt);
  if(checkedAt<startedAt||checkedAt>completedAt+60000||checkedAt>+now)fail();
  return report;
 }catch{fail();}
}
