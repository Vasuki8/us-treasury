import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const execute=promisify(execFile);
const root=fileURLToPath(new URL('../',import.meta.url));
const scratchRoot=path.join(root,'test-results');

async function withCliFixture(run) {
  await mkdir(scratchRoot,{recursive:true});
  const directory=await mkdtemp(path.join(scratchRoot,'refresh-cli-'));
  try {
    await cp(path.join(root,'scripts'),path.join(directory,'scripts'),{recursive:true});
    await cp(path.join(root,'src'),path.join(directory,'src'),{recursive:true});
    const destination=path.join(directory,'src','official-snapshot.js');
    const original=await readFile(path.join(root,'src','official-snapshot.js'));
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

test('default manual CLI failure records retained source status and exits unsuccessfully',async()=>{
  await withCliFixture(async({directory,destination,original})=>{
    await assert.rejects(execute(process.execPath,['--import','./unavailable.mjs','scripts/refresh-data.mjs','--sources=bls'],{cwd:directory,timeout:20000}),error=>error.code===1);
    const retained=await readFile(destination);
    assert.notDeepEqual(retained,original,'manual mode still writes the attempted-source failure for display');
    const {snapshot}=await import(`${pathToFileURL(destination).href}?manual`);
    assert.equal(snapshot.sources.bls.status,'error');
    assert.match(snapshot.sources.bls.error,/503/);
  });
});

test('strict calendar CLI publishes successful current coverage when BLS has never supplied the next year',async()=>{
  await withCliFixture(async({directory,destination})=>{
    const {snapshot}=await import(`${pathToFileURL(destination).href}?initial`);
    const bls=snapshot.calendar.sources.bls;
    bls.coveredYears=[2026];
    bls.failedYears=[];
    bls.events=bls.events.filter(event=>event.date.startsWith('2026-'));
    bls.provenance=bls.provenance.filter(item=>item.url.includes('/2026/'));
    snapshot.releases=snapshot.releases.filter(event=>event.sourceId!=='bls'||event.date.startsWith('2026-'));
    await writeFile(destination,`export const snapshot = ${JSON.stringify(snapshot)};\n`);
    // Hold the five independent, already-verified agency responses constant while
    // exercising the real BLS collector, strict refresh assembly and CLI writer.
    for(const [filename,exportName,id] of [
      ['calendar-bea.mjs','collectBeaCalendar','bea'],
      ['calendar-census.mjs','collectCensusCalendar','census'],
      ['calendar-dol.mjs','collectDolCalendar','dol'],
      ['calendar-treasury.mjs','collectTreasuryCalendar','treasury'],
      ['timing-treasury-yields.mjs','collectTreasuryYieldTiming','treasury-yield-timing'],
    ])await writeFile(path.join(directory,'scripts','sources',filename),`import {snapshot} from '../../src/official-snapshot.js';\nexport async function ${exportName}(){return snapshot.calendar.sources[${JSON.stringify(id)}];}\n`);
    const html='<title>Schedule of Selected Releases 2026</title><table class="release-list"><thead><tr><th>Date</th><th>Time</th><th>Release</th></tr></thead><tbody><tr><td class="date-cell">Friday, November 6, 2026</td><td class="time-cell">08:30 AM</td><td class="desc-cell"><strong>Employment Situation</strong> for October 2026</td></tr></tbody></table><p>All times on calendar are Eastern Time.</p>';
    await writeFile(path.join(directory,'first-year-only.mjs'),`
      const NativeDate=Date;
      globalThis.Date=class extends NativeDate {
        constructor(...args){super(...(args.length?args:['2026-10-21T12:00:00.000Z']));}
        static now(){return NativeDate.parse('2026-10-21T12:00:00.000Z');}
      };
      globalThis.fetch=async url=>url==='https://www.bls.gov/schedule/2026/home.htm'
        ?new Response(${JSON.stringify(html)},{status:200})
        :new Response('Annual calendar not yet published',{status:404});
    `);
    await execute(process.execPath,['--import','./first-year-only.mjs','scripts/refresh-data.mjs','--sources=calendar','--require-all'],{cwd:directory,timeout:20000});
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
  // Keep every other verified source deterministic while exercising the real
  // BLS HTTP collector, publication gate and atomic CLI writer together.
  for(const [filename,exportName,id,calendar] of [
    ['treasury.mjs','collectTreasury','treasury',false],
    ['bls.mjs','collectBls','bls',false],
    ['bea.mjs','collectBea','bea',false],
    ['dol.mjs','collectDol','dol',false],
    ['census.mjs','collectCensus','census',false],
    ['fiscal.mjs','collectFiscal','fiscal',false],
    ['refinancing.mjs','collectRefinancing','refinancing',false],
    ['calendar-bea.mjs','collectBeaCalendar','bea',true],
    ['calendar-census.mjs','collectCensusCalendar','census',true],
    ['calendar-dol.mjs','collectDolCalendar','dol',true],
    ['calendar-treasury.mjs','collectTreasuryCalendar','treasury',true],
    ['timing-treasury-yields.mjs','collectTreasuryYieldTiming','treasury-yield-timing',true],
  ])await writeFile(path.join(directory,'scripts','sources',filename),`import {snapshot} from '../../src/official-snapshot.js';\nexport async function ${exportName}(){${failOther&&id==='bea'&&!calendar?"throw new Error('BEA unavailable');":`return {...snapshot.${calendar?'calendar.':''}sources[${JSON.stringify(id)}],fetchedAt:new Date().toISOString()};`}}\n`);
  await writeFile(path.join(directory,'blocked-bls.mjs'),`
    const NativeDate=Date;
    globalThis.Date=class extends NativeDate {
      constructor(...args){super(...(args.length?args:['2026-10-22T14:00:00.000Z']));}
      static now(){return NativeDate.parse('2026-10-22T14:00:00.000Z');}
    };
    globalThis.fetch=async()=>new Response('BLS access denied',{status:403});
  `);
}

test('approved cached-BLS CLI mode publishes other sources and reports the original retained capture',async()=>{
  await withCliFixture(async({directory,destination,original})=>{
    const {snapshot:prior}=await import(`${pathToFileURL(destination).href}?prior-cached`);
    await blockedBlsFixture(directory);
    const summary=path.join(directory,'summary.md');
    const result=await execute(process.execPath,['--import','./blocked-bls.mjs','scripts/refresh-data.mjs','--allow-cached-bls-calendar'],{cwd:directory,timeout:20000,env:{...process.env,GITHUB_STEP_SUMMARY:summary}});
    const {snapshot:published}=await import(`${pathToFileURL(destination).href}?cached-published`);
    assert.notDeepEqual(await readFile(destination),original);
    assert.deepEqual(published.publicationPolicy,{mode:'allow-cached-bls-calendar',cachedCalendarSources:['bls']});
    assert.equal(published.calendar.status,'partial');
    const cached=published.calendar.sources.bls;
    assert.equal(cached.status,'error');
    assert.equal(cached.fetchedAt,prior.calendar.sources.bls.fetchedAt);
    assert.deepEqual(cached.provenance,prior.calendar.sources.bls.provenance);
    assert.deepEqual(cached.events,prior.calendar.sources.bls.events);
    assert.equal(cached.lastAttemptAt,'2026-10-22T14:00:00.000Z');
    for(const source of Object.values(published.sources))assert.equal(source.status,'ok');
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
