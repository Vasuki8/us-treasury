import test from 'node:test';import assert from 'node:assert/strict';
import {parseDolAdvanceText} from '../scripts/sources/dol-advance.mjs';
import {parseClaimsPublication} from '../scripts/sources/dol-publications.mjs';
import {releaseFixture} from './helpers/dol-advance-fixture.js';
import {notices2024} from './helpers/dol-2024-notices.js';
const now=new Date('2026-10-22T23:00:00Z');

test('reviewed2024 notices distinguish scheduled factors, applied models/history and a correction with no effect on published claims',()=>{
 const expected=[['scheduled-update','March 2','February 24','February 17'],['applied-update','March 9','March 2','February 24'],['factor-file-correction','March 16','March 9','March 2']];
 for(const [i,{date,sourceText}]of notices2024.entries()){
  const [kind,current,prior,older]=expected[i];const input=releaseFixture({header:`Thursday, March ${Number(date.slice(8))}, 2024`,initialDate:current,priorInitialDate:prior,continuedDate:prior,priorContinuedDate:older});
  input.firstPage=input.firstPage.replace('UNEMPLOYMENT INSURANCE WEEKLY CLAIMS',sourceText+' UNEMPLOYMENT INSURANCE WEEKLY CLAIMS');
  const result=parseDolAdvanceText(input,{now});assert.equal(result.seasonalAdjustmentKind,kind);assert.equal(result.series.claimsAdvance.observations[1].value,194);assert.equal(result.series.continuedClaimsAdvance.observations[0].value,1703);
  if(i===0)assert.match(result.seasonalAdjustmentNote,/2019–2023.*March 14/);
  if(i===1){assert.match(result.seasonalAdjustmentNote,/2019/);assert.match(result.seasonalAdjustmentNote,/new models/i);}
  if(i===2){assert.match(result.seasonalAdjustmentNote,/no impact.*published claims/i);assert.match(result.seasonalAdjustmentNote,/July 27.*2024/);assert.doesNotMatch(result.seasonalAdjustmentNote,/applies the annual/);}
  assert.ok(result.series.claimsAdvance.observations.every(row=>row.footnotes.includes(result.seasonalAdjustmentNote)));
  const changed=sourceText.replace(/2019|July 27/,'1900');assert.notEqual(changed,sourceText);assert.throws(()=>parseDolAdvanceText({...input,firstPage:input.firstPage.replace(sourceText,changed)},{now}),/notice/i);
 }
});

test('2024 archive notices must be present in source evidence before receiving their reviewed explanation',()=>{
 const cases=[
  {header:'Thursday, March 7, 2024',initialDate:'March 2',priorInitialDate:'February 24',continuedDate:'February 24',priorContinuedDate:'February 17',initial:'217,000',initialChange:'unchanged',initialPrior:"revised level. The previous week's level was revised up by 2,000 from 215,000 to 217,000",initialTable:'217,000 217,000 0',continued:'1,906,000',continuedChange:'an increase of 8,000',continuedPrior:"revised level. The previous week's level was revised down by 7,000 from 1,905,000 to 1,898,000",continuedTable:'1,906,000 1,898,000 +8,000'},
  {header:'Thursday, March 14, 2024',initialDate:'March 9',priorInitialDate:'March 2',continuedDate:'March 2',priorContinuedDate:'February 24',initial:'209,000',initialChange:'a decrease of 1,000',initialPrior:"revised level. The previous week's level was revised down by 7,000 from 217,000 to 210,000",initialTable:'209,000 210,000 -1,000',continued:'1,811,000',continuedChange:'an increase of 17,000',continuedPrior:"revised level. The previous week's level was revised down by 112,000 from 1,906,000 to 1,794,000",continuedTable:'1,811,000 1,794,000 +17,000'},
  {header:'Thursday, March 21, 2024',initialDate:'March 16',priorInitialDate:'March 9',continuedDate:'March 9',priorContinuedDate:'March 2',initial:'210,000',initialChange:'a decrease of 2,000',initialPrior:"revised level. The previous week's level was revised up by 3,000 from 209,000 to 212,000",initialTable:'210,000 212,000 -2,000',continued:'1,807,000',continuedChange:'an increase of 4,000',continuedPrior:"revised level. The previous week's level was revised down by 8,000 from 1,811,000 to 1,803,000",continuedTable:'1,807,000 1,803,000 +4,000'},
 ];
 for(const [i,{date,sourceText}]of notices2024.entries()){
  const input=releaseFixture(cases[i]),url=`https://oui.doleta.gov/press/2024/03${date.slice(8)}24.pdf`,provenance={url,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T23:00:00.000Z',lastModified:null};
  assert.throws(()=>parseClaimsPublication(input,{provenance,now}),/notice/i);
  const complete={...input,firstPage:input.firstPage.replace('UNEMPLOYMENT INSURANCE WEEKLY CLAIMS',sourceText+' UNEMPLOYMENT INSURANCE WEEKLY CLAIMS')};
  const admitted=parseClaimsPublication(complete,{provenance,now});assert.equal(admitted.releases.length,4);assert.ok(admitted.releases.every(row=>row.seasonalAdjustmentNote&&row.footnotes.includes(row.seasonalAdjustmentNote)));
 }
});

test('2024 header extraction whitespace retains the exact Wednesday date and title without accepting different words or weekdays',()=>{
 for(const [header,current,prior,older,change]of [
  ['Wednesday , July 3, 2024','June 29','June 22','June 15',false],
  ['Thursday, August 1, 2024','July 27','July 20','July 13',true],
 ]){
  const input=releaseFixture({header,initialDate:current,priorInitialDate:prior,continuedDate:prior,priorContinuedDate:older});if(change)input.firstPage=input.firstPage.replace('WEEKLY CLAIMS','WEEKLY CLAIM S');
  const result=parseDolAdvanceText(input,{now});assert.equal(result.releaseDate,change?'2024-08-01':'2024-07-03');assert.equal(result.series.claimsAdvance.observations[1].date,change?'2024-07-27':'2024-06-29');
  assert.throws(()=>parseDolAdvanceText({...input,firstPage:input.firstPage.replace(change?'WEEKLY CLAIM S':'WEEKLY CLAIMS','WEEKLY CLAIMED')},{now}),/header/i);
  assert.throws(()=>parseDolAdvanceText({...input,firstPage:input.firstPage.replace(change?'Thursday':'Wednesday','Tuesday')},{now}),/weekday/i);
 }
});
