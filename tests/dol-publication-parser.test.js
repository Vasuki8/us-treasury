import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDolAdvanceText} from '../scripts/sources/dol-advance.mjs';
import {releaseFixture} from './helpers/dol-advance-fixture.js';
const now=new Date('2026-10-22T22:00:00Z');
// Source-shaped synthetic fixtures; never canonical observations.
const scheduled="REVISION TO SEASONAL ADJUSTMENT FACTORS Note: Calendar Year (CY) 2026 seasonal factors and revised seasonal factors for CY 2021-2025 for both initial claims and continued claims will be available at https://www.bls.gov/lau/seasonal-adjustment-for-weekly-unemployment- insurance-claims.htm by 12:00 P.M. (Eastern) on Thursday, March 1 9 , 2026. Revisions to the historical series for CY 2021-2025 for both initial claims and continued claims will be published on March 19, 2026, with the release of the Unemployment Insurance Weekly Claims News Release.";
const applied="REVISION TO SEASONAL ADJUSTMENT FACTORS Note: This week's release reflects the annual revision to the weekly unemployment claims seasonal adjustment factors. The seasonal adjustment factors used for the UI Weekly Claims data from 2021 forward, along with the resulting seasonally adjusted values for initial claims and continuing claims, have been revised. For more information regarding the seasonal adjustment methodology, please see the additional information at the end of this news release.";

test('archived wording permits the verified insured-unemployment aside and revision without by, with unchanged arithmetic checks',()=>{
 const fixture=releaseFixture();fixture.firstPage=fixture.firstPage.replace("The previous week's level was revised down by 7,000", "This is the lowest level for insured unemployment since September 21, 2024 when it was 1,825,000. The previous week's level was revised down 7,000");
 assert.equal(parseDolAdvanceText(fixture,{now}).series.continuedClaimsAdvance.observations[0].value,1703);
 assert.throws(()=>parseDolAdvanceText({...fixture,firstPage:fixture.firstPage.replace('down 7,000','down 8,000')},{now}),/arithmetic/i);
 assert.throws(()=>parseDolAdvanceText({...fixture,firstPage:fixture.firstPage.replace('lowest level for insured unemployment','unverified explanation')},{now}),/revision/i);
});
test('the known spaced February release day is parsed as one valid calendar day',()=>{
 const fixture=releaseFixture({header:'Thursday, February 1 9 , 2026',initialDate:'February 14',priorInitialDate:'February 7',continuedDate:'February 7',priorContinuedDate:'January 31'});
 assert.equal(parseDolAdvanceText(fixture,{now}).releaseDate,'2026-02-19');
 assert.throws(()=>parseDolAdvanceText({...fixture,firstPage:fixture.firstPage.replace('February 1 9 ,','February 3 9 ,')},{now}),/calendar/i);
});
test('annual seasonal-factor announcement and applied update retain separate evidence and never become an inferred revision cause',()=>{
 for(const [day,note,kind]of [['12',scheduled,'scheduled-update'],['19',applied,'applied-update']]){
  const date=day==='12'?'March 7':'March 14',prior=day==='12'?'February 28':'March 7',older=day==='12'?'February 21':'February 28';
  const fixture=releaseFixture({header:`Thursday, March ${day}, 2026`,initialDate:date,priorInitialDate:prior,continuedDate:prior,priorContinuedDate:older});
  fixture.firstPage=fixture.firstPage.replace('UNEMPLOYMENT INSURANCE WEEKLY CLAIMS',note+' UNEMPLOYMENT INSURANCE WEEKLY CLAIMS');
  const parsed=parseDolAdvanceText(fixture,{now});assert.equal(parsed.seasonalAdjustmentKind,kind);assert.match(parsed.seasonalAdjustmentNote,/DOL/);
  for(const s of Object.values(parsed.series))for(const row of s.observations)assert.ok(row.footnotes.includes(parsed.seasonalAdjustmentNote));
  assert.throws(()=>parseDolAdvanceText({...fixture,firstPage:fixture.firstPage.replace('from 2021 forward','from 1990 forward').replace('CY 2021-2025','CY 1990-2025')},{now}),/notice/i);
 }
 const ordinary=releaseFixture();ordinary.firstPage=ordinary.firstPage.replace('UNEMPLOYMENT INSURANCE WEEKLY CLAIMS','Unexpected annual claims revision. UNEMPLOYMENT INSURANCE WEEKLY CLAIMS');
 assert.throws(()=>parseDolAdvanceText(ordinary,{now}),/notice|header/i);
});
