import test from 'node:test';import assert from 'node:assert/strict';
import {parseDolAdvanceText} from '../scripts/sources/dol-advance.mjs';
import {releaseFixture} from './helpers/dol-advance-fixture.js';
import {scheduledNotice,appliedNotice,shutdownNotice} from './helpers/dol-2025-notices.js';
const now=new Date('2026-10-22T22:00:00Z');
const insert=(input,note)=>({...input,firstPage:input.firstPage.replace('UNEMPLOYMENT INSURANCE WEEKLY CLAIMS',note+' UNEMPLOYMENT INSURANCE WEEKLY CLAIMS')});

test('verified initial and continued historical-level asides do not alter the source counts or revision arithmetic',()=>{
 for(const [subject,level]of [['initial claims','highest'],['initial claims','lowest'],['insured unemployment','highest']]){
  const input=releaseFixture();const anchor=subject==='initial claims'?"The previous week's level was revised up":"The previous week's level was revised down";
  input.firstPage=input.firstPage.replace(anchor,`This is the ${level} level for ${subject} since October 23, 2021 when it was 268,000. ${anchor}`);
  const result=parseDolAdvanceText(input,{now});assert.equal(result.series.claimsAdvance.observations[1].value,194);assert.equal(result.series.continuedClaimsAdvance.observations[0].value,1703);
  assert.throws(()=>parseDolAdvanceText({...input,firstPage:input.firstPage.replace('when it was','which caused a change of')},{now}),/revision|prior/i);
 }
});
test('2025 seasonal-factor announcement and application remain distinct without modifying 2026 notices',()=>{
 for(const [date,note,kind,current,prior,older]of [['20',scheduledNotice,'scheduled-update','March 15','March 8','March 1'],['27',appliedNotice,'applied-update','March 22','March 15','March 8']]){
  const input=insert(releaseFixture({header:`Thursday, March ${date}, 2025`,initialDate:current,priorInitialDate:prior,continuedDate:prior,priorContinuedDate:older}),note);
  const result=parseDolAdvanceText(input,{now});assert.equal(result.seasonalAdjustmentKind,kind);assert.match(result.seasonalAdjustmentNote,/2020/);assert.doesNotMatch(result.seasonalAdjustmentNote,/2021–2025/);
  assert.throws(()=>parseDolAdvanceText({...input,firstPage:input.firstPage.replaceAll('2020','1990')},{now}),/notice/i);
 }
});
test('the source-noted shutdown release takes unspecified prior counts from its SA table without inventing revision status or prior publication',()=>{
 const input=insert(releaseFixture({header:'Thursday, November 20, 2025',initialDate:'November 15',priorInitialDate:'November 8',continuedDate:'November 8',priorContinuedDate:'November 1',initial:'220,000',initialChange:'a decrease of 8,000',initialPrior:'level',initialTable:'220,000 228,000 -8,000',continued:'1,974,000',continuedChange:'an increase of 28,000',continuedPrior:'level',continuedTable:'1,974,000 1,946,000 +28,000'}),shutdownNotice);
 const result=parseDolAdvanceText(input,{now});assert.match(result.publicationNotice,/October 2.*November 13/);
 const standaloneAside={...input,firstPage:input.firstPage.replace("1,974,000, an increase of 28,000 from the previous week's level.","1,974,000, an increase of 28,000 from the previous week's level. This is the highest level for insured unemployment since November 6, 2021 when it was 2,041,000.")};
 assert.deepEqual(parseDolAdvanceText(standaloneAside,{now}),result,'a standalone historical-level aside changes no counts or roles');
 for(const [id,count]of [['claimsAdvance','228,000'],['continuedClaimsAdvance','1,946,000']]){
  const prior=result.series[id].observations[0];assert.equal(prior.releaseStage,'prior-week-status-unknown');assert.equal(prior.previouslyPublishedSourceValue,null);assert.equal(prior.sourceValue,count);assert.match(prior.footnotes.join(' '),/not specified|not stated/i);assert.ok(prior.footnotes.includes(result.publicationNotice));
 }
 assert.throws(()=>parseDolAdvanceText({...input,tableText:input.tableText.replace('228,000','229,000')},{now}),/change|disagree/i);
 assert.throws(()=>parseDolAdvanceText({...input,firstPage:input.firstPage.replace(shutdownNotice,'')},{now}),/prior|statement/i);
 assert.throws(()=>parseDolAdvanceText({...input,firstPage:input.firstPage.replace('October 2, 2025','October 3, 2025')},{now}),/notice/i);
});
