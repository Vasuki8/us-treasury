import test from 'node:test';
import assert from 'node:assert/strict';
import {claimsFact} from './helpers/claims-publications-fixture.js';
import {selectClaimsPublicationHistory,claimsPublicationCsv} from '../src/claims-publication-history.js';
import {buildClaimsPublicationPin} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv} from '../src/research-packages.js';
import {parseCsv} from '../scripts/sources/http.mjs';

// Source-shaped synthetic observations exercise year boundaries, not reviewed
// official values. Production observations come only from captured PDF evidence.
function crossYearArchive(){
 const legacy={version:1,releases:[
  claimsFact({period:'2024-12-21',publicationDate:'2025-01-02',releaseStage:'prior-week-revised',value:322}),
  claimsFact({seriesId:'continuedClaimsAdvance',period:'2024-12-14',publicationDate:'2025-01-02',releaseStage:'prior-week-revised',value:2221}),
 ]};
 return {legacy,expanded:{version:1,releases:[...legacy.releases,
  claimsFact({period:'2024-12-21',publicationDate:'2024-12-26',value:321}),
  claimsFact({seriesId:'continuedClaimsAdvance',period:'2024-12-14',publicationDate:'2024-12-26',value:2222}),
 ]}};
}

test('2024 publication selection admits late-December 2023 reference weeks without confusing the two claims measurements',()=>{
 const archive={version:1,releases:[
  claimsFact({period:'2023-12-30',publicationDate:'2024-01-04',value:321}),
  claimsFact({seriesId:'continuedClaimsAdvance',period:'2023-12-23',publicationDate:'2024-01-04',value:2222}),
 ]};
 for(const [seriesId,period,value] of [['claimsAdvance','2023-12-30',321],['continuedClaimsAdvance','2023-12-23',2222]]){
  assert.equal(selectClaimsPublicationHistory(archive,seriesId,'2024-01-03',period).latest,null);
  const view=selectClaimsPublicationHistory(archive,seriesId,'2024-01-04');
  assert.equal(view.period,period);assert.equal(view.latest.value,value);assert.equal(view.firstAdvance,view.latest);
  assert.equal(view.latest.sourceUrl,'https://oui.doleta.gov/press/2024/010424.pdf');
  assert.ok(view.releases.every(row=>row.seriesId===seriesId));
 }
 assert.throws(()=>selectClaimsPublicationHistory(archive,'claimsAdvance','2024-01-04','2023-12-23'),/week/i);
});

test('a 2024 advance and 2025 prior replay by their exact publication days despite immutable append order',()=>{
 const {legacy,expanded}=crossYearArchive(),prefix=JSON.stringify(legacy.releases);
 for(const [seriesId,period,advance,prior] of [['claimsAdvance','2024-12-21',321,322],['continuedClaimsAdvance','2024-12-14',2222,2221]]){
  assert.equal(selectClaimsPublicationHistory(expanded,seriesId,'2024-12-25',period).latest,null);
  assert.equal(selectClaimsPublicationHistory(expanded,seriesId,'2024-12-26',period).latest.value,advance);
  assert.equal(selectClaimsPublicationHistory(expanded,seriesId,'2025-01-01',period).latest.value,advance);
  const view=selectClaimsPublicationHistory(expanded,seriesId,'2025-01-02',period);
  assert.equal(view.firstAdvance.value,advance);assert.equal(view.latest.value,prior);
  assert.deepEqual(view.releases.map(row=>row.publicationDate),['2024-12-26','2025-01-02']);
  assert.equal(view.rows[1].change,prior-advance);
  const [headers,...rows]=parseCsv(claimsPublicationCsv(expanded,seriesId,'2025-01-01',period));
  assert.equal(rows.length,1);assert.equal(rows[0][headers.indexOf('series_id')],seriesId);assert.equal(rows[0][headers.indexOf('reference_week')],period);
  assert.equal(rows[0][headers.indexOf('publication_date')],'2024-12-26');assert.equal(rows[0][headers.indexOf('publication_instant')],'');
  assert.equal(rows[0][headers.indexOf('source_url')],'https://oui.doleta.gov/press/2024/122624.pdf');
 }
 assert.equal(JSON.stringify(expanded.releases.slice(0,2)),prefix);
});

test('a portable pin made before a 2024 backfill preserves its missing-original evidence and exact exported files',async()=>{
 const {legacy,expanded}=crossYearArchive(),seriesId='claimsAdvance',period='2024-12-21',cutoff='2025-01-02';
 const pkg=await createResearchPackage({id:'synthetic-before-2024-backfill',name:'Before synthetic older publication',now:'2026-10-22T23:00:00.000Z',...buildClaimsPublicationPin(legacy,seriesId,cutoff,period)});
 const json=exportResearchPackage(pkg),csv=researchPackageCsv(pkg),attachment=pkg.context.attachments[0].content;
 assert.equal(selectClaimsPublicationHistory(legacy,seriesId,cutoff,period).firstAdvance,null);
 assert.notEqual(claimsPublicationCsv(expanded,seriesId,cutoff,period),attachment);
 const restored=await importResearchPackage(json);
 assert.equal(exportResearchPackage(restored),json);assert.equal(researchPackageCsv(restored),csv);assert.equal(restored.context.attachments[0].content,attachment);
 assert.equal(restored.context.publicationReleases.length,1);assert.equal(restored.context.publicationReleases[0].releaseStage,'prior-week-revised');
 assert.equal(restored.catalog[seriesId].sourceUrl,'https://oui.doleta.gov/press/2025/010225.pdf');
 const older=buildClaimsPublicationPin(expanded,seriesId,'2024-12-26',period),captured=older.catalog[seriesId];
 assert.equal(captured.sourceUrl,'https://oui.doleta.gov/press/2024/122624.pdf');assert.equal(captured.source.url,captured.sourceUrl);
 assert.deepEqual(captured.source.seriesIds,['InitialClaims/SA/Release']);assert.equal(captured.provenance[0].url,captured.sourceUrl);
 assert.equal(captured.observations[0].publishedAt,'2024-12-26');assert.equal(captured.observations[0].publicationDatePrecision,'day');assert.match(captured.measure,/Archived official claims publication/);
});
