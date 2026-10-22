import test from 'node:test';
import assert from 'node:assert/strict';
import {claimsFact} from './helpers/claims-publications-fixture.js';
import {selectClaimsPublicationHistory,claimsPublicationCsv} from '../src/claims-publication-history.js';
import {buildClaimsPublicationPin} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv} from '../src/research-packages.js';
import {parseCsv} from '../scripts/sources/http.mjs';

// These values are synthetic selection/preservation fixtures, not reviewed
// official publication facts. Production values require captured PDF evidence.
function crossYearArchive(){
 const legacy={version:1,releases:[
  claimsFact({period:'2023-12-23',publicationDate:'2024-01-04',releaseStage:'prior-week-revised',value:432}),
  claimsFact({seriesId:'continuedClaimsAdvance',period:'2023-12-16',publicationDate:'2024-01-04',releaseStage:'prior-week-revised',value:3331}),
 ]};
 return {legacy,expanded:{version:1,releases:[...legacy.releases,
  claimsFact({period:'2023-12-23',publicationDate:'2023-12-28',value:431}),
  claimsFact({seriesId:'continuedClaimsAdvance',period:'2023-12-16',publicationDate:'2023-12-28',value:3333}),
 ]}};
}

test('2023 publication selection retains independent late-December 2022 reference weeks and exact publication-day availability',()=>{
 const archive={version:1,releases:[
  claimsFact({period:'2022-12-31',publicationDate:'2023-01-05',value:431}),
  claimsFact({seriesId:'continuedClaimsAdvance',period:'2022-12-24',publicationDate:'2023-01-05',value:3333}),
 ]};
 for(const [seriesId,period,value]of [['claimsAdvance','2022-12-31',431],['continuedClaimsAdvance','2022-12-24',3333]]){
  assert.equal(selectClaimsPublicationHistory(archive,seriesId,'2023-01-04',period).latest,null);
  const view=selectClaimsPublicationHistory(archive,seriesId,'2023-01-05');
  assert.equal(view.period,period);assert.equal(view.firstAdvance.value,value);assert.equal(view.latest,view.firstAdvance);
  assert.equal(view.latest.sourceUrl,'https://oui.doleta.gov/press/2023/010523.pdf');assert.ok(view.releases.every(row=>row.seriesId===seriesId));
 }
 assert.throws(()=>selectClaimsPublicationHistory(archive,'claimsAdvance','2023-01-05','2022-12-24'),/week/i);
});

test('an appended 2023 advance precedes the 2024 prior in selected-week replay and stays outside earlier cutoffs',()=>{
 const {legacy,expanded}=crossYearArchive(),prefix=JSON.stringify(legacy.releases);
 for(const [seriesId,period,advance,prior]of [['claimsAdvance','2023-12-23',431,432],['continuedClaimsAdvance','2023-12-16',3333,3331]]){
  assert.equal(selectClaimsPublicationHistory(expanded,seriesId,'2023-12-27',period).latest,null);
  assert.equal(selectClaimsPublicationHistory(expanded,seriesId,'2023-12-28',period).latest.value,advance);
  assert.equal(selectClaimsPublicationHistory(expanded,seriesId,'2024-01-03',period).latest.value,advance);
  const view=selectClaimsPublicationHistory(expanded,seriesId,'2024-01-04',period);
  assert.equal(view.firstAdvance.value,advance);assert.equal(view.latest.value,prior);assert.equal(view.rows[1].change,prior-advance);
  assert.deepEqual(view.releases.map(row=>row.publicationDate),['2023-12-28','2024-01-04']);
  const [headers,...rows]=parseCsv(claimsPublicationCsv(expanded,seriesId,'2024-01-03',period));
  assert.equal(rows.length,1);assert.equal(rows[0][headers.indexOf('series_id')],seriesId);assert.equal(rows[0][headers.indexOf('reference_week')],period);
  assert.equal(rows[0][headers.indexOf('publication_date')],'2023-12-28');assert.equal(rows[0][headers.indexOf('publication_instant')],'');assert.equal(rows[0][headers.indexOf('source_url')],'https://oui.doleta.gov/press/2023/122823.pdf');
 }
 assert.equal(JSON.stringify(expanded.releases.slice(0,2)),prefix);
});

test('legacy portable files remain exact when new 2023 evidence fills an original advance absent from a 2024-only pin',async()=>{
 const {legacy,expanded}=crossYearArchive(),seriesId='continuedClaimsAdvance',period='2023-12-16',cutoff='2024-01-04';
 const pkg=await createResearchPackage({id:'synthetic-before-2023-backfill',name:'Before synthetic 2023 publication',now:'2026-10-22T23:00:00.000Z',...buildClaimsPublicationPin(legacy,seriesId,cutoff,period)});
 const json=exportResearchPackage(pkg),primary=researchPackageCsv(pkg),attachment=pkg.context.attachments[0].content;
 assert.equal(selectClaimsPublicationHistory(legacy,seriesId,cutoff,period).firstAdvance,null);assert.notEqual(claimsPublicationCsv(expanded,seriesId,cutoff,period),attachment);
 const restored=await importResearchPackage(json);
 assert.equal(exportResearchPackage(restored),json);assert.equal(researchPackageCsv(restored),primary);assert.equal(restored.context.attachments[0].content,attachment);
 assert.equal(restored.context.publicationReleases.length,1);assert.equal(restored.context.publicationReleases[0].releaseStage,'prior-week-revised');assert.equal(restored.catalog[seriesId].sourceUrl,'https://oui.doleta.gov/press/2024/010424.pdf');
 const args=buildClaimsPublicationPin(expanded,seriesId,'2023-12-28',period),captured=args.catalog[seriesId];
 assert.equal(captured.sourceUrl,'https://oui.doleta.gov/press/2023/122823.pdf');assert.equal(captured.source.url,captured.sourceUrl);assert.deepEqual(captured.source.seriesIds,['ContinuedClaims/SA/Release']);assert.equal(captured.provenance[0].url,captured.sourceUrl);
 assert.equal(captured.observations[0].publishedAt,'2023-12-28');assert.equal(captured.observations[0].publicationDatePrecision,'day');assert.match(captured.measure,/Archived official claims publication/);
});

test('a reviewed original-edition source stays primary in CSV and frozen pins while a later prose correction remains context',async()=>{
 const original='https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20230700.pdf',corrected='https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20230700b.pdf';
 const row={...claimsFact({period:'2023-04-08',publicationDate:'2023-04-13',value:431}),sourceUrl:original,releaseEvidenceUrl:original,editionNote:'reviewed-original-with-later-prose-correction',provenance:[{url:original,sha256:'b'.repeat(64),retrievedAt:'2026-10-22T22:00:00.000Z',lastModified:null}]};
 row.footnotes.push('Retained original edition. Later prose correction is undated context only: '+corrected);
 const archive={version:1,releases:[row]},csv=claimsPublicationCsv(archive,'claimsAdvance','2023-04-13','2023-04-08'),[headers,...rows]=parseCsv(csv);
 assert.equal(rows.length,1);assert.equal(rows[0][headers.indexOf('source_url')],original);assert.equal(rows[0][headers.indexOf('release_evidence_url')],original);assert.match(rows[0][headers.indexOf('source_notes')],/Later prose correction is undated context only/);assert.ok(rows[0][headers.indexOf('source_notes')].includes(corrected));
 const pkg=await createResearchPackage({id:'synthetic-original-edition-context',name:'Synthetic retained original edition',now:'2026-10-22T23:00:00.000Z',...buildClaimsPublicationPin(archive,'claimsAdvance','2023-04-13','2023-04-08')}),json=exportResearchPackage(pkg),restored=await importResearchPackage(json);
 assert.equal(exportResearchPackage(restored),json);assert.equal(restored.context.publicationReleases.length,1);assert.equal(restored.context.publicationReleases[0].editionNote,row.editionNote);assert.equal(restored.context.attachments[0].content,csv);
 assert.equal(restored.catalog.claimsAdvance.sourceUrl,original);assert.deepEqual(restored.catalog.claimsAdvance.provenance,row.provenance);assert.ok(restored.catalog.claimsAdvance.observations[0].footnotes.at(-1).includes(corrected));
});
