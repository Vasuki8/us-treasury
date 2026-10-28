import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {buildSourceAttemptReport,validateSourceAttemptReport,SOURCE_ATTEMPT_IDS} from '../scripts/source-attempt-report.mjs';
import {refreshSnapshot} from '../scripts/sources/refresh.mjs';
import {OfficialSourceHttpError} from '../scripts/sources/http.mjs';

const checkedAt='2026-10-25T12:00:00.000Z',now=new Date('2026-10-25T12:01:00.000Z');
const source=(extra={})=>({status:'ok',fetchedAt:'2026-10-25T12:00:01.000Z',lastAttemptAt:checkedAt,error:null,failure:null,...extra});
const capture=(fetchedAt='2026-10-25T12:00:01.000Z')=>({id:'bea',fetchedAt,series:{gdp:{observations:[{date:'2026-01-01',value:1}]}}});
const build=(extra={})=>buildSourceAttemptReport({checkedAt,sources:{bea:source()},calendarSources:{},attemptedDataIds:['bea'],attemptedCalendarIds:[],now,...extra});

test('attempt report includes only attempted known inputs and fixed collection metadata',()=>{
 const secret='private-key-canary';
 const report=build({sources:{bea:source({error:secret,provenance:[{url:`https://example.com/?key=${secret}`}]}),census:source()},calendarSources:{bls:source({status:'error',fetchedAt:'2026-10-24T12:00:00Z',error:secret,failure:{kind:'http',status:503,requestedUrl:secret}})},attemptedCalendarIds:['bls']});
 assert.equal(SOURCE_ATTEMPT_IDS.length,32);
 assert.deepEqual(report,{schemaVersion:1,checkedAt,sources:[
  {id:'data:bea',status:'ok',fetchedAt:'2026-10-25T12:00:01.000Z',lastAttemptAt:checkedAt,httpStatus:null,cached:false},
  {id:'calendar:bls',status:'error',fetchedAt:'2026-10-24T12:00:00.000Z',lastAttemptAt:checkedAt,httpStatus:503,cached:true},
 ]});
 assert.doesNotMatch(JSON.stringify(report),new RegExp(secret));
 assert.deepEqual(validateSourceAttemptReport({...report,admission:'untrusted arbitrary claim'},{now}),report,'validator returns only whitelisted collection fields');
});

test('bounded timestamps and HTTP statuses never admit invented success or arbitrary labels',()=>{
 const report=build({sources:{bea:source({status:'unavailable',fetchedAt:null,failure:{kind:'http',status:999}})}});
 assert.deepEqual(report.sources[0],{id:'data:bea',status:'unavailable',fetchedAt:null,lastAttemptAt:checkedAt,httpStatus:null,cached:false});
 for(const mutate of [
  r=>{r.schemaVersion=2;},r=>{r.checkedAt='2026-02-30T00:00:00Z';},r=>{r.checkedAt='2027-01-01T00:00:00Z';},
  r=>{r.sources[0].id='data:unknown';},r=>{r.sources.push({...r.sources[0]});},r=>{r.sources[0].status='custom private text';},
  r=>{r.sources[0].lastAttemptAt='2026-10-24T12:00:00Z';},r=>{r.sources[0].fetchedAt=null;},
  r=>{r.sources[0].fetchedAt='2026-10-24T12:00:00Z';},r=>{r.sources[0].fetchedAt='2026-10-25T12:02:00Z';},
  r=>{r.sources[0].cached=true;},r=>{r.sources[0].httpStatus='503';},
 ]){
  const invalid=build();mutate(invalid);assert.throws(()=>validateSourceAttemptReport(invalid,{now}),/Invalid source attempt report/);
 }
 assert.throws(()=>build({attemptedDataIds:['unknown']}),/Invalid source attempt report/);
});

test('an attempted collector retaining an older valid capture reports uncertainty without blocking publication',()=>{
 const report=build({sources:{bea:source({fetchedAt:'2026-10-24T12:00:00.000Z'})}});
 assert.equal(report.sources[0].status,'unverified');assert.equal(report.sources[0].cached,true);
 assert.equal(report.sources[0].fetchedAt,'2026-10-24T12:00:00.000Z');
 const missing=build({sources:{bea:source({fetchedAt:null})}});assert.equal(missing.sources[0].status,'unverified');assert.equal(missing.sources[0].cached,false);
});

test('the asynchronous collection hook writes safe failure evidence before strict policy rejection',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'source-attempt-status-')),destination=path.join(directory,'report.json');
 const previous={sources:{census:{...capture('2026-10-24T12:00:00.000Z'),id:'census',status:'ok'}},calendar:{sources:{}}},before=structuredClone(previous);
 let called=false;
 try{
  await assert.rejects(refreshSnapshot({previous,now:new Date(checkedAt),requireAll:true,collectors:{bea:async()=>capture(),census:async()=>{throw new OfficialSourceHttpError(503,'https://example.com/');}},onCollected:async candidate=>{
   called=true;await Promise.resolve();
   const report=buildSourceAttemptReport({...candidate,calendarSources:candidate.calendar.sources,now});
   await writeFile(destination,JSON.stringify(report));
  }}),/Required official refresh failed/);
  assert.equal(called,true);const report=JSON.parse(await readFile(destination,'utf8'));
  assert.deepEqual(report.sources.map(row=>[row.id,row.status,row.cached]),[['data:bea','ok',false],['data:census','error',true]]);
  assert.equal(report.sources[1].httpStatus,503);assert.deepEqual(previous,before);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('partial and failed calendar collections do not attribute attempts to unchanged sources',async()=>{
 let report;
 const previous={sources:{census:{...capture('2026-10-24T12:00:00.000Z'),id:'census',status:'ok'}},calendar:{sources:{}}};
 await assert.rejects(refreshSnapshot({previous,now:new Date(checkedAt),allowCachedBlsCalendar:true,collectors:{bea:async()=>capture()},calendarCollectors:{bls:async()=>{throw new Error('private remote data');}},onCollected:async candidate=>{report=buildSourceAttemptReport({...candidate,calendarSources:candidate.calendar.sources,now});}}),/Required official refresh failed/);
 assert.deepEqual(report.sources.map(row=>row.id),['data:bea','calendar:bls']);
 assert.equal(report.sources[1].status,'unavailable');assert.equal(report.sources[1].fetchedAt,null);
 assert.doesNotMatch(JSON.stringify(report),/private remote data/);
});

test('CLI wires safe report collection before admission for both diagnostic and publishing modes',async()=>{
 const cli=await readFile(new URL('../scripts/refresh-data.mjs',import.meta.url),'utf8');
 assert.match(cli,/onCollected:[\s\S]*source-attempt-status\.json/);
 assert.ok(cli.indexOf('source-attempt-status.json')<cli.indexOf('assertCommercialData(snapshot)'));
});
