import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify, isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execute=promisify(execFile);
const root=fileURLToPath(new URL('../',import.meta.url));
const scratchRoot=path.join(root,'test-results');
// The full 12 MB admitted snapshot and 72 retained captures take about 28 s to
// validate and rewrite in the measured manual fixture. Keep full coverage and a
// bounded allowance for successful publication; early rejection stays at 20 s.
const publicationTimeout=60000;
const independentCalendars=[
  ['calendar-bea.mjs','collectBeaCalendar','bea'],
  ['calendar-census.mjs','collectCensusCalendar','census'],
  ['calendar-dol.mjs','collectDolCalendar','dol'],
  ['calendar-treasury.mjs','collectTreasuryCalendar','treasury'],
  ['timing-treasury-yields.mjs','collectTreasuryYieldTiming','treasury-yield-timing'],
  ['calendar-fomc.mjs','collectFomcCalendar','fomc'],
];

function nextFixtureAttemptAt(snapshot){
  const priorTimes=[snapshot.generatedAt,snapshot.checkedAt,
    ...Object.values(snapshot.sources).map(source=>source.fetchedAt),
    ...Object.values(snapshot.calendar.sources).map(source=>source.fetchedAt),
    ...(snapshot.vintageArchive?.captures??[]).flatMap(capture=>[capture.capturedAt,capture.recordedAt]),
  ].filter(Boolean).map(value=>Date.parse(value));
  assert.ok(priorTimes.length&&priorTimes.every(Number.isFinite),'fixture derives time from valid stored capture timestamps');
  return new Date(Math.max(...priorTimes)+1000).toISOString();
}

async function withCliFixture(run) {
  await mkdir(scratchRoot,{recursive:true});
  const directory=await mkdtemp(path.join(scratchRoot,'refresh-cli-'));
  try {
    await cp(path.join(root,'scripts'),path.join(directory,'scripts'),{recursive:true});
    await cp(path.join(root,'src'),path.join(directory,'src'),{recursive:true});
    const destination=path.join(directory,'src','official-snapshot.js');
    const {snapshot:fixtureSnapshot}=await import(pathToFileURL(destination).href);
    const annual='https://www.bls.gov/schedule/2026/home.htm',captured='2026-10-20T12:00:00.000Z';
    fixtureSnapshot.calendar.sources.bls={id:'bls',agency:'U.S. Bureau of Labor Statistics',status:'ok',fetchedAt:captured,lastAttemptAt:captured,error:null,failure:null,coveredYears:[2026],failedYears:[],warnings:[],provenance:[{url:annual,sha256:'a'.repeat(64),retrievedAt:captured,lastModified:null}],events:[{id:'bls-consumer-price-index-september-2026',sourceId:'bls',program:'consumer-price-index',name:'Consumer Price Index',agency:'BLS',seriesId:'cpi',seriesIds:['cpi'],topic:'Inflation',date:'2026-10-14',time:'08:30',scheduledAt:'2026-10-14T12:30:00.000Z',period:null,periodLabel:'September 2026',sourceUrl:annual,sourceUid:null}]};
    fixtureSnapshot.releases=Object.values(fixtureSnapshot.calendar.sources).flatMap(source=>source.events??[]).sort((a,b)=>(a.scheduledAt??a.date).localeCompare(b.scheduledAt??b.date)||a.id.localeCompare(b.id));
    const original=Buffer.from(`export const snapshot = ${JSON.stringify(fixtureSnapshot)};\n`);
    await writeFile(destination,original);
    await writeFile(path.join(directory,'package.json'),'{"type":"module"}');
    await writeFile(path.join(directory,'unavailable.mjs'),"globalThis.fetch=async()=>new Response('Official service unavailable',{status:503});\n");
    await run({directory,destination,original});
  } finally {
    const resolvedDirectory=await realpath(directory);
    const resolvedRoot=await realpath(scratchRoot);
    assert.ok(resolvedDirectory.startsWith(`${resolvedRoot}${path.sep}`),'cleanup stays inside workspace test-results');
    await rm(resolvedDirectory,{recursive:true,force:true});
  }
}

async function legacyBlsCalendarFixture(directory){
  await writeFile(path.join(directory,'scripts','sources','calendar-nyfed-bls.mjs'),"export {collectBlsCalendar as collectNyFedBlsCalendar} from './calendar-bls.mjs';\n");
}

test('strict all-source CLI failure leaves the snapshot byte-for-byte unchanged',async()=>{
  await withCliFixture(async({directory,destination,original})=>{
    await assert.rejects(execute(process.execPath,['--import','./unavailable.mjs','scripts/refresh-data.mjs','--require-all'],{cwd:directory,timeout:20000}),error=>{
      assert.equal(error.code,1);
      assert.match(error.stderr,/bls.*503/i);
      assert.match(error.stderr,/calendar.*503/i);
      return true;
    });
    assert.ok((await readFile(destination)).equals(original),'strict failure must not replace any snapshot bytes');
    await assert.rejects(readFile(path.join(directory,'src','.official-snapshot.tmp')),error=>error.code==='ENOENT');
  });
});

test('source health check reports every failure without replacing the snapshot or its original capture times',async()=>{
  await withCliFixture(async({directory,destination,original})=>{
    const {snapshot:prior}=await import(`${pathToFileURL(destination).href}?health-prior`);
    await assert.rejects(execute(process.execPath,['--import','./unavailable.mjs','scripts/refresh-data.mjs','--check-only','--sources=bls'],{cwd:directory,timeout:publicationTimeout}),error=>error.code===1);
    assert.ok((await readFile(destination)).equals(original),'a check must not write a failed candidate snapshot');
    const report=JSON.parse(await readFile(path.join(directory,'source-health.json'),'utf8'));
    assert.equal(report.passed,false);
    assert.equal(report.sources.length,1);
    const source=report.sources[0];
    assert.equal(source.id,'data:bls');
    assert.equal(source.status,'error');
    assert.match(source.error,/503/);
    assert.equal(source.fetchedAt,prior.sources.bls.fetchedAt);
    assert.equal(source.series.cpiMonthly.latestReferencePeriod,'2026-09-01');
    assert.ok(!JSON.stringify(report).includes('"observations"'),'health artifacts contain metadata, not duplicate statistical history');
  });
});

test('source health check retains a failed admission report without publishing unreviewed captures',async()=>{
  await withCliFixture(async({directory,destination,original})=>{
    const adapter=path.join(directory,'scripts','sources','bls.mjs');
    const code=await readFile(adapter,'utf8');
    await writeFile(adapter,code.replace('export async function collectBls(', 'async function originalCollectBls(')+`\nimport {snapshot as prior} from '../../src/official-snapshot.js';\nexport async function collectBls(){return {...prior.sources.bls,fetchedAt:new Date().toISOString(),provenance:[]};}\n`);
    await assert.rejects(execute(process.execPath,['scripts/refresh-data.mjs','--check-only','--sources=bls'],{cwd:directory,timeout:publicationTimeout}),error=>error.code===1);
    assert.ok((await readFile(destination)).equals(original));
    const report=JSON.parse(await readFile(path.join(directory,'source-health.json'),'utf8'));
    assert.equal(report.passed,false);
    assert.equal(report.admission.status,'failed');
    assert.match(report.admission.error,/provenance|reviewed|rights|source/i);
  });
});

test('default manual CLI failure records retained source status and exits unsuccessfully',async()=>{
  await withCliFixture(async({directory,destination,original})=>{
    await assert.rejects(execute(process.execPath,['--import','./unavailable.mjs','scripts/refresh-data.mjs','--sources=bls'],{cwd:directory,timeout:publicationTimeout}),error=>error.code===1);
    const retained=await readFile(destination);
    assert.notDeepEqual(retained,original,'manual mode still writes the attempted-source failure for display');
    const {snapshot}=await import(`${pathToFileURL(destination).href}?manual`);
    assert.equal(snapshot.sources.bls.status,'error');
    assert.match(snapshot.sources.bls.error,/503/);
  });
});

test('legacy calendar CLI publishes successful current coverage when BLS has never supplied the next year',async()=>{
  await withCliFixture(async({directory,destination})=>{
    await legacyBlsCalendarFixture(directory);
    const {snapshot}=await import(`${pathToFileURL(destination).href}?initial`);
    const bls=snapshot.calendar.sources.bls;
    bls.coveredYears=[2026];
    bls.failedYears=[];
    bls.events=bls.events.filter(event=>event.date.startsWith('2026-'));
    bls.provenance=bls.provenance.filter(item=>item.url.includes('/2026/'));
    snapshot.releases=snapshot.releases.filter(event=>event.sourceId!=='bls'||event.date.startsWith('2026-'));
    await writeFile(destination,`export const snapshot = ${JSON.stringify(snapshot)};\n`);
    // Hold independent, already-verified agency responses constant while
    // exercising the real BLS collector, strict refresh assembly and CLI writer.
    for(const [filename,exportName,id] of independentCalendars)await writeFile(path.join(directory,'scripts','sources',filename),`import {snapshot} from '../../src/official-snapshot.js';\nexport async function ${exportName}(){return snapshot.calendar.sources[${JSON.stringify(id)}];}\n`);
    const attemptAt=nextFixtureAttemptAt(snapshot);
    const html='<title>Schedule of Selected Releases 2026</title><table class="release-list"><thead><tr><th>Date</th><th>Time</th><th>Release</th></tr></thead><tbody><tr><td class="date-cell">Friday, November 6, 2026</td><td class="time-cell">08:30 AM</td><td class="desc-cell"><strong>Employment Situation</strong> for October 2026</td></tr></tbody></table><p>All times on calendar are Eastern Time.</p>';
    await writeFile(path.join(directory,'first-year-only.mjs'),`
      const NativeDate=Date;
      globalThis.Date=class extends NativeDate {
        constructor(...args){super(...(args.length?args:[${JSON.stringify(attemptAt)}]));}
        static now(){return NativeDate.parse(${JSON.stringify(attemptAt)});}
      };
      globalThis.fetch=async url=>url==='https://www.bls.gov/schedule/2026/home.htm'
        ?new Response(${JSON.stringify(html)},{status:200})
        :new Response('Annual calendar not yet published',{status:404});
    `);
    await execute(process.execPath,['--import','./first-year-only.mjs','scripts/refresh-data.mjs','--sources=calendar','--require-all'],{cwd:directory,timeout:publicationTimeout});
    const {snapshot:published}=await import(`${pathToFileURL(destination).href}?published`);
    assert.equal(published.calendar.status,'partial');
    assert.equal(published.calendar.sources.bls.status,'ok');
    assert.deepEqual(published.calendar.sources.bls.failedYears,[2027]);
    assert.deepEqual(published.calendar.sources.bls.coveredYears,[2026]);
    assert.equal(published.calendar.sources.bls.events.length,1);
    assert.match(published.calendar.sources.bls.warnings.join(' '),/2027.*unavailable/);
  });
});

async function blockedBlsFixture(directory,{failOther=false}={}) {
  await legacyBlsCalendarFixture(directory);
  const {snapshot}=await import(pathToFileURL(path.join(directory,'src','official-snapshot.js')).href);
  // New committed captures must never make this simulated refresh travel back
  // in time. Retain their original timestamps and advance only the fixture clock.
  const attemptAt=nextFixtureAttemptAt(snapshot);
  // Keep every other verified source deterministic while exercising the real
  // BLS HTTP collector, publication gate and atomic CLI writer together.
  await writeFile(path.join(directory,'scripts','sources','fixture-retrieval.mjs'),`
    export function refreshedCapture(retained){
      const source=structuredClone(retained),retrievedAt=new Date().toISOString();
      const update=value=>{
        if(!value||typeof value!=='object')return;
        if(typeof value.url==='string'&&typeof value.sha256==='string'&&Object.hasOwn(value,'retrievedAt'))value.retrievedAt=retrievedAt;
        if(Object.hasOwn(value,'fetchedAt'))value.fetchedAt=retrievedAt;
        if(typeof value.sourceUrl==='string'&&Object.hasOwn(value,'retrievedAt')){
          const receipt=source.provenance.find(item=>item.url===value.sourceUrl&&(!value.sourceSha256||item.sha256===value.sourceSha256));
          if(!receipt)throw new Error('Fixture row has no matching original response receipt');
          value.retrievedAt=retrievedAt;
          if(Object.hasOwn(value,'sourceSha256'))value.sourceSha256=receipt.sha256;
        }
        for(const item of Object.values(value))update(item);
      };
      update(source);
      return {...source,fetchedAt:retrievedAt};
    }
  `);
  // Preserve the collector's admission constants while replacing only its fetch.
  await cp(path.join(directory,'scripts','sources','dol-advance.mjs'),path.join(directory,'scripts','sources','dol-advance-original.mjs'));
  await cp(path.join(directory,'scripts','sources','treasury.mjs'),path.join(directory,'scripts','sources','treasury-original.mjs'));
  const creditCollectors=[['collectBankCredit','bankCredit'],['collectLendingSurvey','lendingSurvey'],['collectFedBalance','fedBalance'],['collectOnRrp','onRrp'],['collectHouseholdDebt','householdDebt'],['collectLoanDelinquency','loanDelinquency']];
  await writeFile(path.join(directory,'scripts','sources','credit-context.mjs'),`import {snapshot} from '../../src/official-snapshot.js';\nimport {refreshedCapture} from './fixture-retrieval.mjs';\n${creditCollectors.map(([name,id])=>`export async function ${name}(){return refreshedCapture(snapshot.sources[${JSON.stringify(id)}]);}`).join('\n')}\n`);
  for(const [filename,exportName,id,calendar] of [
    ['treasury.mjs','collectTreasury','treasury',false],
    ['bls.mjs','collectBls','bls',false],
    ['bea.mjs','collectBea','bea',false],
    ['bea-ita.mjs','collectBeaIta','beaIta',false],
    ['dol.mjs','collectDol','dol',false],
    ['dol-advance.mjs','collectDolAdvance','dolAdvance',false],
    ['census.mjs','collectCensus','census',false],
    ['fiscal.mjs','collectFiscal','fiscal',false],
    ['refinancing.mjs','collectRefinancing','refinancing',false],
    ['yields.mjs','collectYields','yields',false],
    ['auctions.mjs','collectAuctions','auctions',false],
    ['ownership.mjs','collectOwnership','ownership',false],
    ['macro-contributions.mjs','collectMacroContributions','macroContributions',false],
    ['market-functioning.mjs','collectMarketFunctioning','marketFunctioning',false],
    ['policy-rates.mjs','collectPolicyRates','policyRates',false],
    ['activity.mjs','collectActivity','activity',false],
    ['housing.mjs','collectHousing','housing',false],
    ...independentCalendars.map(row=>[...row,true]),
  ])await writeFile(path.join(directory,'scripts','sources',filename),`${id==='dolAdvance'?"export * from './dol-advance-original.mjs';\n":id==='treasury'&&!calendar?"export * from './treasury-original.mjs';\n":''}import {snapshot} from '../../src/official-snapshot.js';\nimport {refreshedCapture} from './fixture-retrieval.mjs';\nexport async function ${exportName}(){${failOther&&id==='bea'&&!calendar?"throw new Error('BEA unavailable');":`return refreshedCapture(snapshot.${calendar?'calendar.':''}sources[${JSON.stringify(id)}]);`}}\n`);
  await writeFile(path.join(directory,'blocked-bls.mjs'),`
    const NativeDate=Date;
    globalThis.Date=class extends NativeDate {
      constructor(...args){super(...(args.length?args:[${JSON.stringify(attemptAt)}]));}
      static now(){return NativeDate.parse(${JSON.stringify(attemptAt)});}
    };
    globalThis.fetch=async()=>new Response('BLS access denied',{status:403});
  `);
  return attemptAt;
}

test('approved statistical service-failure mode publishes healthy captures while retaining exact BLS observations and provenance',async()=>{
  await withCliFixture(async({directory,destination})=>{
    const {snapshot:prior}=await import(`${pathToFileURL(destination).href}?statistics-cached-prior`);
    const attemptedAt=await blockedBlsFixture(directory);
    await writeFile(path.join(directory,'scripts','sources','bls.mjs'),"import {OfficialSourceHttpError} from './http.mjs';\nexport async function collectBls(){throw new OfficialSourceHttpError(503,'https://api.bls.gov/publicAPI/v1/timeseries/data/');}\n");
    const result=await execute(process.execPath,['--import','./blocked-bls.mjs','scripts/refresh-data.mjs','--allow-cached-bls'],{cwd:directory,timeout:publicationTimeout});
    const {snapshot:published}=await import(`${pathToFileURL(destination).href}?statistics-cached-published`);
    assert.equal(published.sources.bls.status,'error');
    assert.equal(published.sources.bls.fetchedAt,prior.sources.bls.fetchedAt);
    assert.equal(published.sources.bls.lastAttemptAt,attemptedAt);
    assert.deepEqual(published.sources.bls.series,prior.sources.bls.series);
    assert.deepEqual(published.sources.bls.provenance,prior.sources.bls.provenance);
    assert.deepEqual(published.publicationPolicy.cachedDataSources,['bls']);
    assert.equal(published.sources.bea.status,'ok');
    assert.equal(published.sources.bea.fetchedAt,attemptedAt);
    assert.match(result.stdout,/BLS statistics cached/);
  });
});

test('source health check preserves the approved BLS calendar exception and never publishes its successful candidate',async()=>{
  await withCliFixture(async({directory,destination,original})=>{
    const {snapshot:prior}=await import(`${pathToFileURL(destination).href}?health-cached-prior`);
    await blockedBlsFixture(directory);
    await execute(process.execPath,['--import','./blocked-bls.mjs','scripts/refresh-data.mjs','--check-only','--sources=calendar'],{cwd:directory,timeout:publicationTimeout});
    assert.ok((await readFile(destination)).equals(original));
    const report=JSON.parse(await readFile(path.join(directory,'source-health.json'),'utf8'));
    assert.equal(report.passed,true);
    assert.equal(report.sources.length,7);
    const cached=report.sources.find(source=>source.id==='calendar:bls');
    assert.equal(cached.allowedCachedCalendar,true);
    assert.equal(cached.status,'error');
    assert.equal(cached.fetchedAt,prior.calendar.sources.bls.fetchedAt);
    assert.ok(report.sources.filter(source=>source.id!=='calendar:bls').every(source=>source.status==='ok'&&!source.allowedCachedCalendar));
    await assert.rejects(execute(process.execPath,['scripts/refresh-data.mjs','--check-only','--require-all'],{cwd:directory,timeout:20000}),error=>error.code===1&&/check-only alone/.test(error.stderr));
    assert.ok((await readFile(destination)).equals(original));
  });
});

test('approved cached-BLS CLI mode publishes other sources and reports the original retained capture',async()=>{
  await withCliFixture(async({directory,destination,original})=>{
    const {snapshot:prior}=await import(`${pathToFileURL(destination).href}?prior-cached`);
    const attemptAt=await blockedBlsFixture(directory);
    const summary=path.join(directory,'summary.md');
    const result=await execute(process.execPath,['--import','./blocked-bls.mjs','scripts/refresh-data.mjs','--allow-cached-bls-calendar'],{cwd:directory,timeout:publicationTimeout,env:{...process.env,GITHUB_STEP_SUMMARY:summary}});
    const {snapshot:published}=await import(`${pathToFileURL(destination).href}?cached-published`);
    assert.notDeepEqual(await readFile(destination),original);
    assert.deepEqual(published.publicationPolicy,{mode:'allow-cached-bls-calendar',cachedCalendarSources:['bls']});
    assert.equal(published.calendar.status,'partial');
    const cached=published.calendar.sources.bls;
    assert.equal(cached.status,'error');
    assert.equal(cached.fetchedAt,prior.calendar.sources.bls.fetchedAt);
    assert.deepEqual(cached.provenance,prior.calendar.sources.bls.provenance);
    assert.deepEqual(cached.events,prior.calendar.sources.bls.events);
    assert.equal(cached.lastAttemptAt,attemptAt);
    assert.ok(prior.vintageArchive.captures.every(capture=>Date.parse(capture.capturedAt)<Date.parse(attemptAt)),'simulated refresh strictly follows every stored actual capture');
    for(const [id,source] of Object.entries(published.sources)){
      assert.equal(source.status,'ok');
      assert.equal(source.fetchedAt,attemptAt);
      if(id==='treasury'){
        const nominal=receipt=>new URL(receipt.url).searchParams.get('type')==='daily_treasury_yield_curve';
        const originalNominal=prior.sources.treasury.provenance.filter(nominal);
        const fresh=source.provenance.filter(item=>item.retrievedAt===attemptAt);
        const responseIdentity=item=>`${item.url}|${item.sha256}`;
        const expectedResponses=[...prior.sources.treasury.provenance,...prior.sources.yields.provenance.filter(nominal)];
        assert.deepEqual([...new Set(fresh.map(responseIdentity))].sort(),[...new Set(expectedResponses.map(responseIdentity))].sort(),'fresh Treasury and curve responses retain the exact fixture URLs and byte hashes');
        for(const item of source.provenance.filter(item=>item.retrievedAt!==attemptAt))assert.ok(originalNominal.some(original=>isDeepStrictEqual(item,original)),'historical Treasury receipts remain unchanged original captures');
        for(const original of originalNominal)assert.ok(source.provenance.some(item=>isDeepStrictEqual(item,original)),'harmonization retains every original historical yield receipt');
      }else{
        assert.ok(source.provenance.every(item=>item.retrievedAt===source.fetchedAt),`${id} simulated successful responses carry their new actual retrieval time`);
        assert.deepEqual(source.provenance.map(item=>item.sha256),prior.sources[id].provenance.map(item=>item.sha256),'identical simulated response bytes retain their hashes');
      }
      for(const measurement of Object.values(source.series)){
        if(measurement.fetchedAt)assert.ok(source.provenance.some(receipt=>receipt.retrievedAt===measurement.fetchedAt),'measurement retrieval retains an actual simulated response receipt');
        for(const row of measurement.observations)if(row.retrievedAt)assert.ok(source.provenance.some(receipt=>receipt.url===row.sourceUrl&&receipt.retrievedAt===row.retrievedAt&&receipt.sha256===row.sourceSha256),'row retrieval and hash match their exact source response');
      }
    }
    for(const [id,source] of Object.entries(published.calendar.sources))if(id!=='bls')assert.equal(source.status,'ok');
    assert.match(result.stdout,/warning.*BLS.*cached|BLS.*cached/i);
    assert.match(await readFile(summary,'utf8'),/BLS.*cached/i);
    assert.ok((await readFile(summary,'utf8')).includes(cached.fetchedAt));
  });
});

test('strict CLI still rejects the same BLS403 candidate without replacing any snapshot bytes',async()=>{
  await withCliFixture(async({directory,destination,original})=>{
    await blockedBlsFixture(directory);
    await assert.rejects(execute(process.execPath,['--import','./blocked-bls.mjs','scripts/refresh-data.mjs','--require-all'],{cwd:directory,timeout:20000}),error=>error.code===1&&/bls calendar.*403/i.test(error.stderr));
    assert.ok((await readFile(destination)).equals(original));
  });
});

test('cached-BLS CLI mode rejects another failed source and conflicting mode flags before writing',async()=>{
  await withCliFixture(async({directory,destination,original})=>{
    await blockedBlsFixture(directory,{failOther:true});
    await assert.rejects(execute(process.execPath,['--import','./blocked-bls.mjs','scripts/refresh-data.mjs','--allow-cached-bls-calendar'],{cwd:directory,timeout:20000}),error=>error.code===1&&/bea.*unavailable/i.test(error.stderr));
    assert.ok((await readFile(destination)).equals(original));
    await assert.rejects(execute(process.execPath,['--import','./blocked-bls.mjs','scripts/refresh-data.mjs','--require-all','--allow-cached-bls-calendar'],{cwd:directory,timeout:20000}),error=>error.code===1&&/cannot.*combine|mutually exclusive/i.test(error.stderr));
    assert.ok((await readFile(destination)).equals(original));
  });
});
