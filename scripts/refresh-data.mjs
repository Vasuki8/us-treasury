import { collectBankCredit,collectLendingSurvey,collectFedBalance,collectOnRrp,collectHouseholdDebt,collectLoanDelinquency } from './sources/credit-context.mjs';
import { collectFomcCalendar } from './sources/calendar-fomc.mjs';
import {collectBeaIta} from './sources/bea-ita.mjs';
import { appendFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { snapshot as previousRoot } from '../src/official-snapshot.js';
import {loadSnapshotHistory,writeStoredSnapshot} from './snapshot-storage.mjs';
import { collectTreasury } from './sources/treasury.mjs';
import { collectBls } from './sources/bls.mjs';
import { collectBea } from './sources/bea.mjs';
import { collectDol } from './sources/dol.mjs';
import { collectDolAdvance } from './sources/dol-advance.mjs';
import { collectCensus } from './sources/census.mjs';
import { collectBlsCalendar } from './sources/calendar-bls.mjs';
import { collectBeaCalendar } from './sources/calendar-bea.mjs';
import { collectCensusCalendar } from './sources/calendar-census.mjs';
import { collectDolCalendar } from './sources/calendar-dol.mjs';
import { collectTreasuryCalendar } from './sources/calendar-treasury.mjs';
import { collectTreasuryYieldTiming } from './sources/timing-treasury-yields.mjs';
import { refreshSnapshot } from './sources/refresh.mjs';
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

const all={beaIta:collectBeaIta,householdDebt:collectHouseholdDebt,loanDelinquency:collectLoanDelinquency,bankCredit:collectBankCredit,lendingSurvey:collectLendingSurvey,fedBalance:collectFedBalance,onRrp:collectOnRrp,treasury:collectTreasury,bls:async options=>addMomentumSeries(await collectBls(options)),bea:async options=>addMomentumSeries(await collectBea(options)),dol:collectDol,dolAdvance:collectDolAdvance,census:collectCensus,fiscal:async options=>{const result=await collectFiscal(options);return {...result,series:{...result.series,...deriveFiscalSeries(result)}};},refinancing:collectRefinancing,yields:collectYields,auctions:collectAuctions,ownership:collectOwnership,macroContributions:collectMacroContributions,marketFunctioning:collectMarketFunctioning,policyRates:collectPolicyRates,activity:collectActivity,housing:collectHousing};
const requireAll=process.argv.includes('--require-all');
const allowCachedBlsCalendar=process.argv.includes('--allow-cached-bls-calendar');
if(requireAll&&allowCachedBlsCalendar)throw new Error('Cannot combine --require-all and --allow-cached-bls-calendar; publication modes are mutually exclusive.');
const selection=process.argv.find(arg=>arg.startsWith('--sources='))?.split('=')[1]?.split(',')||[...Object.keys(all),'calendar'];
if(selection.some(id=>!Object.hasOwn(all,id)&&id!=='calendar'))throw new Error(`Sources must be ${Object.keys(all).join(',')},calendar`);
const collectors=Object.fromEntries(selection.filter(id=>id!=='calendar').map(id=>[id,async options=>{
  console.log(`Retrieving ${id.toUpperCase()} official data…`);
  return all[id](options);
}]));
const calendarCollectors=selection.includes('calendar')?{fomc:collectFomcCalendar,bls:collectBlsCalendar,bea:collectBeaCalendar,census:collectCensusCalendar,dol:collectDolCalendar,treasury:collectTreasuryCalendar,'treasury-yield-timing':collectTreasuryYieldTiming}:{};
const previous={...previousRoot,vintages:await loadSnapshotHistory(previousRoot,{directory:fileURLToPath(new URL('../src/',import.meta.url))})};
if(selection.includes('calendar'))console.log('Retrieving BLS, BEA, Census, DOL and Treasury official schedules and yield timing…');
const snapshot=await refreshSnapshot({previous,collectors,calendarCollectors,requireAll,allowCachedBlsCalendar});
assertCommercialData(snapshot);
const destination=fileURLToPath(new URL('../src/official-snapshot.js',import.meta.url));
await writeStoredSnapshot(snapshot,{destination,previous:previousRoot});
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
if(!requireAll&&!allowCachedBlsCalendar&&selection.some(id=>id==='calendar'?snapshot.calendar.status!=='ok':snapshot.sources[id].status!=='ok'))process.exitCode=1;
