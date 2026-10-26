import {appendFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getDailyRefreshPlan} from './check-refresh-due.mjs';
import {getReleaseRefreshPlan} from '../src/release-operations.js';
import {canPublishCachedBlsData} from './sources/refresh.mjs';

/** A missing daily capture takes priority; an empty source list means all sources. */
export function getWorkflowRefreshPlan(snapshot,{now=new Date(),force=false,forceSources,archives={}}={}){
 const daily=getDailyRefreshPlan(snapshot,{now,force}),release=getReleaseRefreshPlan(snapshot,{now,archives});
 if(forceSources!==undefined){
  if(!force)throw new Error('Selected sources require an explicit forced manual refresh.');
  const allowed=new Set([...Object.keys(snapshot.sources??{}),'calendar']);
  if(!Array.isArray(forceSources)||!forceSources.length||new Set(forceSources).size!==forceSources.length||forceSources.some(id=>!allowed.has(id)))throw new Error('Invalid manual source selection.');
  return {...daily,required:true,kind:'manual',sources:[...forceSources],release,reason:'Explicit selected-source refresh; other sources retain their original captures.'};
 }
 const policy=snapshot?.publicationPolicy,bls=snapshot?.sources?.bls,attempt=Date.parse(bls?.lastAttemptAt),slot=Date.parse(daily.expectedRefreshAt);
 const recovery=!daily.required&&policy?.mode==='allow-cached-bls-data'&&Array.isArray(policy.cachedDataSources)&&policy.cachedDataSources.includes('bls')&&canPublishCachedBlsData(bls,now)&&Number.isFinite(attempt)&&attempt>=slot&&now.getTime()>=attempt+30*60000&&now.getTime()<=slot+180*60000;
 const sources=daily.required?[]:[...new Set([...release.sources,...(recovery?['bls']:[])])].sort();
 return {...daily,required:daily.required||release.required||recovery,kind:daily.required?'daily':release.required?'release':recovery?'recovery':'none',sources,release,reason:daily.required?daily.reason:release.required?`Targeted supported release capture is due; publication evidence remains separate.${recovery?' BLS statistical recovery is also due; its retained data are still cached.':''}`:recovery?'Retry only BLS statistics after the approved HTTP 503 daily attempt; retained BLS data remain cached.':daily.reason};
}

async function main(){
 const args=process.argv.slice(2);
 if(args.some(arg=>arg!=='--force'&&!arg.startsWith('--sources='))||args.filter(arg=>arg.startsWith('--sources=')).length>1)throw new Error('Unknown option. Use --force and an optional --sources list.');
 const [{snapshot},{publicationArchive},{claimsPublicationArchive}]=await Promise.all([import('../src/official-snapshot.js'),import('../src/publication-archive.js'),import('../src/claims-publication-archive.js')]);
 const selected=args.find(arg=>arg.startsWith('--sources='));
 const plan=getWorkflowRefreshPlan(snapshot,{force:args.includes('--force'),...(selected?{forceSources:selected.slice('--sources='.length).split(',')}:{}),archives:{gdp:publicationArchive,claimsAdvance:claimsPublicationArchive}});
 const decision=plan.required?'Run refresh':'Skip refresh',sourceLabel=plan.sources.join(',')||'All official sources';
 const rows=plan.release.events.map(event=>`| ${event.eventId} | ${event.evidenceStatus} | ${event.minutesSinceSchedule} | ${event.sourceId} |`).join('\n');
 const summary=`### Daily and release-aware refresh\n\n**${decision}.** ${plan.reason}\n\nMode: ${plan.kind}. Sources: ${sourceLabel}. Latest daily slot: ${plan.expectedRefreshAt}.\n\n${plan.release.objective}\n\n${rows?'| Event | Publication evidence | Minutes since schedule | Collector |\n| --- | --- | ---: | --- |\n'+rows+'\n':''}\nSuccessful retrieval of older data does not verify a release. Unverified GDP results are retried within the bounded post-schedule window; immutable publication archives require their own reviewed admission.\n\n`;
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
 if(process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,`required=${plan.required}\nexpected_refresh_at=${plan.expectedRefreshAt}\nsources=${plan.sources.join(',')}\nrefresh_kind=${plan.kind}\n`);
 console.log(`${decision}: ${plan.reason}\nMode: ${plan.kind}; sources: ${sourceLabel}\n${plan.release.objective}`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(`Release-aware refresh check failed: ${error.message}`);process.exitCode=1;});
