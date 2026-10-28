import { collectBankCredit,collectLendingSurvey,collectFedBalance,collectOnRrp,collectHouseholdDebt,collectLoanDelinquency } from './sources/credit-context.mjs';
import { collectFomcCalendar } from './sources/calendar-fomc.mjs';
import {collectLaborEvidence} from './sources/labor-evidence.mjs';
import {collectPcePriceContributions} from './sources/pce-price-contributions.mjs';
import {collectBeaIta} from './sources/bea-ita.mjs';
import { appendFile,writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { snapshot as previousRoot } from '../src/official-snapshot.js';
import {loadSnapshotHistory,writeStoredSnapshot} from './snapshot-storage.mjs';
import { collectTreasury } from './sources/treasury.mjs';
import { collectBlsWithHistory } from './sources/bls-history.mjs';
import { collectBea } from './sources/bea.mjs';
import { collectDolWithRevisions } from './sources/dol-revised.mjs';
import { collectDolAdvance } from './sources/dol-advance.mjs';
import { collectCensus } from './sources/census.mjs';
import { collectNyFedBlsCalendar } from './sources/calendar-nyfed-bls.mjs';
import { collectBeaCalendar } from './sources/calendar-bea.mjs';
import { collectCensusCalendar } from './sources/calendar-census.mjs';
import { collectDolCalendar } from './sources/calendar-dol.mjs';
import { collectTreasuryCalendar } from './sources/calendar-treasury.mjs';
import { collectTreasuryYieldTiming } from './sources/timing-treasury-yields.mjs';
import { refreshSnapshot,canPublishCachedBls } from './sources/refresh.mjs';
import { assertCommercialData } from './data-policy.mjs';
import { collectFiscal } from './sources/fiscal.mjs';
import { deriveFiscalSeries } from '../src/fiscal.js';
import { collectRefinancing } from './sources/refinancing.mjs';
import { collectYields } from './sources/yields.mjs';
import { collectAuctions } from './sources/auctions.mjs';
import { collectOwnership } from './sources/ownership.mjs';
import { collectMacroContributions } from './sources/macro-contributions.mjs';
import { collectMarketFunctioning } from './sources/market-functioning.mjs';
import { collectPolicyRates } from './sources/policy-rates.mjs';
import { collectActivity } from './sources/activity.mjs';
import { collectHousing } from './sources/housing.mjs';
import {addMomentumSeries} from '../src/momentum.js';
import {buildSourceAttemptReport} from './source-attempt-report.mjs';

const all={laborEvidence:collectLaborEvidence,pcePriceContributions:collectPcePriceContributions,beaIta:collectBeaIta,householdDebt:collectHouseholdDebt,loanDelinquency:collectLoanDelinquency,bankCredit:collectBankCredit,lendingSurvey:collectLendingSurvey,fedBalance:collectFedBalance,onRrp:collectOnRrp,treasury:collectTreasury,bls:async options=>collectBlsWithHistory({...options,previous:previousRoot.sources.bls}),bea:async options=>addMomentumSeries(await collectBea(options)),dol:async options=>collectDolWithRevisions({...options,previous:previousRoot.sources.dol}),dolAdvance:collectDolAdvance,census:collectCensus,fiscal:async options=>{const result=await collectFiscal(options);return {...result,series:{...result.series,...deriveFiscalSeries(result)}};},refinancing:collectRefinancing,yields:collectYields,auctions:collectAuctions,ownership:collectOwnership,macroContributions:collectMacroContributions,marketFunctioning:collectMarketFunctioning,policyRates:collectPolicyRates,activity:collectActivity,housing:collectHousing};
const requireAll=process.argv.includes('--require-all');
const allowCachedBlsData=process.argv.includes('--allow-cached-bls');
const allowCachedBlsCalendar=allowCachedBlsData||process.argv.includes('--allow-cached-bls-calendar');
const checkOnly=process.argv.includes('--check-only');
if(requireAll&&allowCachedBlsCalendar)throw new Error('Cannot combine --require-all and --allow-cached-bls-calendar; publication modes are mutually exclusive.');
if(checkOnly&&(requireAll||allowCachedBlsCalendar||allowCachedBlsData))throw new Error('Use --check-only alone; source checks never publish a snapshot.');
const selection=process.argv.find(arg=>arg.startsWith('--sources='))?.split('=')[1]?.split(',')||[...Object.keys(all),'calendar'];
if(selection.some(id=>!Object.hasOwn(all,id)&&id!=='calendar'))throw new Error(`Sources must be ${Object.keys(all).join(',')},calendar`);
const collectors=Object.fromEntries(selection.filter(id=>id!=='calendar').map(id=>[id,async options=>{
  console.log(`Retrieving ${id.toUpperCase()} official data…`);
  return all[id](options);
}]));
const calendarCollectors=selection.includes('calendar')?{fomc:collectFomcCalendar,bls:collectNyFedBlsCalendar,bea:collectBeaCalendar,census:collectCensusCalendar,dol:collectDolCalendar,treasury:collectTreasuryCalendar,'treasury-yield-timing':collectTreasuryYieldTiming}:{};
const previous={...previousRoot,vintages:await loadSnapshotHistory(previousRoot,{directory:fileURLToPath(new URL('../src/',import.meta.url))})};
if(selection.includes('calendar'))console.log('Retrieving New York Fed BLS dates, agency calendars and Treasury yield timing…');
const snapshot=await refreshSnapshot({previous,collectors,calendarCollectors,requireAll,allowCachedBlsCalendar,allowCachedBlsData,onCollected:async candidate=>{
  const report=buildSourceAttemptReport({...candidate,calendarSources:candidate.calendar.sources});
  await writeFile('source-attempt-status.json',JSON.stringify(report,null,2)+'\n');
}});
const admission={status:'passed',error:null};
try{assertCommercialData(snapshot);}
catch(error){if(!checkOnly)throw error;admission.status='failed';admission.error=String(error.message||error);}
const destination=fileURLToPath(new URL('../src/official-snapshot.js',import.meta.url));
if(checkOnly){
  const sources=selection.flatMap(id=>id==='calendar'?Object.entries(snapshot.calendar.sources).map(([agency,source])=>({id:`calendar:${agency}`,source})): [{id:`data:${id}`,source:snapshot.sources[id]}]).map(({id,source})=>({
    id,status:source.status,error:source.error??null,fetchedAt:source.fetchedAt,lastAttemptAt:source.lastAttemptAt,
    allowedCachedCalendar:id==='calendar:bls'&&canPublishCachedBls(source,new Date(snapshot.checkedAt)),
    warnings:source.warnings??[],provenance:source.provenance??[],
    ...(source.series?{series:Object.fromEntries(Object.entries(source.series).map(([key,series])=>[key,{observationCount:series.observations.length,latestReferencePeriod:series.observations.at(-1)?.date??null,latestUsableReferencePeriod:series.observations.findLast(row=>Number.isFinite(row.value))?.date??null}]))}:{eventCount:source.events?.length??0,coverageStart:source.coverageStart??null,coverageEnd:source.coverageEnd??null}),
  }));
  const passed=admission.status==='passed'&&sources.every(source=>source.status==='ok'||source.allowedCachedCalendar);
  await writeFile('source-health.json',JSON.stringify({checkedAt:snapshot.checkedAt,passed,admission,sources,interpretation:'Read-only collector and admission check. Source status describes collection; admission is validated separately. Successful retrieval does not verify a new release. Cached sources retain their original capture times; no snapshot or immutable history is written.'},null,2)+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`### Official source health check\n\n${passed?'Passed':'Failed'}: ${sources.filter(source=>source.status==='ok').length}/${sources.length} selected sources captured successfully. Admission: ${admission.status}. ${sources.filter(source=>source.allowedCachedCalendar).length} verified cached BLS calendar exception(s). See source-health.json for errors, warnings, reference-period coverage and original receipts. No snapshot was published.\n\n`);
  process.exitCode=passed?0:1;
}else await writeStoredSnapshot(snapshot,{destination,previous:previousRoot});
if(selection.includes('bls')&&snapshot.publicationPolicy?.cachedDataSources?.includes('bls')&&!checkOnly){
  const retainedAt=snapshot.sources.bls.fetchedAt;
  console.log(`::warning title=BLS statistics cached::BLS API returned HTTP 503; retained verified observations from ${retainedAt}. Healthy selected sources updated; BLS readings remain cached with their original retrieval time.`);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`### BLS statistics retained\n\nBLS API returned HTTP 503. Preserved verified BLS observations and original capture **${retainedAt}**. Other selected sources passed their required checks. BLS status remains cached/stale; no new BLS release is claimed.\n\n`);
}
if(selection.includes('calendar')&&snapshot.publicationPolicy?.cachedCalendarSources.includes('bls')) {
  const retainedAt=new Date(snapshot.calendar.sources.bls.fetchedAt).toISOString();
  console.log(`::warning title=BLS calendar cached::BLS calendar cached after HTTP 403; retained verified capture from ${retainedAt}. Other selected sources refreshed successfully.`);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,`### BLS calendar cached\n\nBLS calendar access returned HTTP 403. Retained the verified capture from **${retainedAt}**, including its original events and provenance. Other selected official sources refreshed successfully. The website continues to display the BLS cached/error state.\n\n`);
}
for(const id of selection) {
  if(id==='calendar') {
    for(const [agency,source] of Object.entries(snapshot.calendar.sources)) {
      if(source.status==='ok')console.log(`${agency.toUpperCase()} calendar: ${source.timing?'ongoing publication timing':`${source.events.length} events`} captured at ${source.fetchedAt}`);
      else console.error(`${agency.toUpperCase()} calendar: ${source.error}${source.fetchedAt?`; retained schedule from ${source.fetchedAt}`:'; no schedule available'}`);
    }
    continue;
  }
  const source=snapshot.sources[id];
  if(source.status==='ok')console.log(`${id.toUpperCase()}: refreshed ${Object.keys(source.series).length} series at ${source.fetchedAt}`);
  else console.error(`${id.toUpperCase()}: ${source.error}${source.fetchedAt?`; retained snapshot from ${source.fetchedAt}`:'; no observations available'}`);
}
if(!checkOnly&&!requireAll&&!allowCachedBlsCalendar&&selection.some(id=>id==='calendar'?snapshot.calendar.status!=='ok':snapshot.sources[id].status!=='ok'))process.exitCode=1;
