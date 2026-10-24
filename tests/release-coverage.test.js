import test from 'node:test';
import assert from 'node:assert/strict';
import {claimsFact} from './helpers/claims-publications-fixture.js';
const api=await import('../src/release-coverage.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const current={claimsAdvance:{id:'claimsAdvance',name:'Initial claims',agency:'dolAdvance',frequency:'Weekly',observations:[{date:'2026-03-14',value:202}],fetchedAt:'2026-03-20T14:00:00.000Z',dataStatus:'official'},payroll:{id:'payroll',name:'Payrolls',agency:'bls',observations:[{date:'2026-02-01',value:20}],fetchedAt:'2026-03-20T14:00:00.000Z',dataStatus:'official'}};
const events=[{id:'claims-due',name:'Weekly claims',sourceId:'dol',program:'weekly-claims',date:'2026-03-19',scheduledAt:'2026-03-19T12:30:00.000Z',time:'08:30'},{id:'claims-next',name:'Weekly claims',sourceId:'dol',program:'weekly-claims',date:'2026-03-26',scheduledAt:'2026-03-26T12:30:00.000Z',time:'08:30'},{id:'jobs-due',name:'Employment situation',sourceId:'bls',program:'employment-situation',date:'2026-03-06',scheduledAt:'2026-03-06T13:30:00.000Z'}];
const now=new Date('2026-03-20T15:00:00Z');
const snapshot={sources:{dolAdvance:{status:'ok',fetchedAt:'2026-03-20T14:00:00.000Z'},bls:{status:'ok',fetchedAt:'2026-03-20T14:00:00.000Z'}},calendar:{sources:{dol:{status:'ok'},bls:{status:'cached',error:'403'}}}};
test('coverage keeps successful collection, latest reference and elapsed unverified schedule independent beyond retry window',()=>{
 assert.equal(typeof api.releaseCoverage,'function');
 const [row]=api.releaseCoverage(current,snapshot,{events,seriesIds:['claimsAdvance'],now,publicationContexts:{claims:{status:'ready',archive:{releases:[]}}}});
 assert.equal(row.referencePeriod,'2026-03-14');assert.equal(row.collection.status,'captured');assert.equal(row.publication.status,'unverified');
 assert.equal(row.latestDue.id,'claims-due');assert.equal(row.nextExpected.id,'claims-next');assert.match(row.publication.label,/publication unverified/i);
});
test('unsupported and unloaded coverage never becomes verified through successful current data or elapsed schedules',()=>{
 assert.equal(typeof api.releaseCoverage,'function');
 const rows=api.releaseCoverage(current,snapshot,{events,seriesIds:['claimsAdvance','payroll'],now});
 assert.equal(rows[0].publication.status,'unloaded');assert.equal(rows[1].publication.status,'unsupported');assert.equal(rows[1].scheduleStatus,'cached');
 assert.match(api.releaseCoveragePanel(rows),/Publication evidence not loaded/);assert.match(api.releaseCoveragePanel(rows),/Publication evidence not covered/);
});
test('reviewed exact release matching verifies the due schedule while newer captures retain their independent clock',()=>{
 assert.equal(typeof api.releaseCoverage,'function');
 const fact=claimsFact({period:'2026-03-14',publicationDate:'2026-03-19'});fact.id=`dol-${fact.seriesId}-${fact.period}-${fact.releaseStage}-${fact.publicationDate}`;
 const [row]=api.releaseCoverage(current,snapshot,{events,seriesIds:['claimsAdvance'],now,publicationContexts:{claims:{status:'ready',archive:{releases:[fact]}}}});
 assert.equal(row.publication.status,'verified');assert.equal(row.publication.date,'2026-03-19');assert.equal(row.publication.retrievedAt,'2026-10-22T22:00:00.000Z');assert.equal(row.collection.fetchedAt,'2026-03-20T14:00:00.000Z');
 const mismatch={...fact,period:'2026-03-07'};
 assert.notEqual(api.releaseCoverage(current,snapshot,{events,seriesIds:['claimsAdvance'],now,publicationContexts:{claims:{status:'ready',archive:{releases:[mismatch]}}}})[0].publication.status,'verified');
});
test('unknown schedule time stays unknown and archive failure remains explicit',()=>{
 assert.equal(typeof api.releaseCoverage,'function');
 const [row]=api.releaseCoverage(current,snapshot,{events:[{...events[0],date:'2026-03-20',time:null,scheduledAt:null}],seriesIds:['claimsAdvance'],now,publicationContexts:{claims:{status:'error',error:'Archive unavailable'}}});
 assert.equal(row.latestDue,null);assert.equal(row.nextExpected.scheduledAt,null);assert.equal(row.publication.status,'unavailable');
 assert.match(api.releaseCoveragePanel([row]),/time not supplied/);assert.match(api.releaseCoveragePanel([row]),/Archive unavailable/);
});
