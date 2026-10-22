import test from 'node:test';
import assert from 'node:assert/strict';
import {claimsFact} from './helpers/claims-publications-fixture.js';
import {selectClaimsPublicationHistory,claimsPublicationCsv} from '../src/claims-publication-history.js';
import {buildClaimsPublicationPin} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv} from '../src/research-packages.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {researchPage} from '../src/research-page.js';
import {parseRoute} from '../src/router.js';

// These source-shaped synthetic values test cross-year selection and preservation;
// they do not claim that any particular archived official fact was reviewed.
function archives(){
 const legacy={version:1,releases:[
  claimsFact({period:'2025-12-27',publicationDate:'2026-01-08',releaseStage:'prior-week-revised',value:200}),
  claimsFact({seriesId:'continuedClaimsAdvance',period:'2025-12-20',publicationDate:'2026-01-08',releaseStage:'prior-week-revised',value:1858}),
 ]};
 const older=[
  claimsFact({period:'2025-12-27',publicationDate:'2025-12-31',value:199}),
  claimsFact({seriesId:'continuedClaimsAdvance',period:'2025-12-20',publicationDate:'2025-12-31',value:1866}),
  claimsFact({period:'2025-11-22',publicationDate:'2025-11-26',value:220}),
 ];
 return {legacy,expanded:{version:1,releases:[...legacy.releases,...older]}};
}

test('cross-year source-shaped fixtures derive each dated PDF URL from its actual publication year',()=>{
 const row=claimsFact({period:'2025-12-27',publicationDate:'2025-12-31'});
 assert.equal(row.sourceUrl,'https://oui.doleta.gov/press/2025/123125.pdf');
 assert.equal(row.provenance[0].url,row.sourceUrl);
});

test('appending older facts preserves the legacy prefix while publication replay finds the earlier original advance',()=>{
 const {legacy,expanded}=archives(),before=JSON.stringify(legacy.releases);
 const old=selectClaimsPublicationHistory(legacy,'claimsAdvance','2026-01-08','2025-12-27');
 assert.equal(old.firstAdvance,null);assert.equal(old.latest.value,200);
 const earlier=selectClaimsPublicationHistory(expanded,'claimsAdvance','2025-12-31','2025-12-27');
 assert.equal(earlier.firstAdvance.value,199);assert.equal(earlier.latest.value,199);
 const next=selectClaimsPublicationHistory(expanded,'claimsAdvance','2026-01-08','2025-12-27');
 assert.deepEqual(next.releases.map(row=>[row.publicationDate,row.releaseStage,row.value]),[['2025-12-31','advance',199],['2026-01-08','prior-week-revised',200]]);
 assert.equal(next.rows[1].change,1);assert.equal(JSON.stringify(expanded.releases.slice(0,2)),before);assert.equal(JSON.stringify(legacy.releases),before);
 const continued=selectClaimsPublicationHistory(expanded,'continuedClaimsAdvance','2026-01-08','2025-12-20');
 assert.deepEqual(continued.releases.map(row=>row.value),[1866,1858]);assert.ok(continued.releases.every(row=>row.seriesId==='continuedClaimsAdvance'));
});

test('Wednesday holiday publication cutoffs use exact source days rather than an assumed Thursday or invented instant',()=>{
 const {expanded}=archives();
 const before=selectClaimsPublicationHistory(expanded,'claimsAdvance','2025-11-25','2025-11-22');assert.equal(before.latest,null);
 const on=selectClaimsPublicationHistory(expanded,'claimsAdvance','2025-11-26','2025-11-22');assert.equal(on.latest.value,220);
 assert.equal(selectClaimsPublicationHistory(expanded,'claimsAdvance','2025-12-30','2025-12-27').latest,null);
 assert.equal(selectClaimsPublicationHistory(expanded,'claimsAdvance','2026-01-07','2025-12-27').latest.value,199);
 assert.throws(()=>selectClaimsPublicationHistory(expanded,'claimsAdvance','2025-12-31T08:30:00Z','2025-12-27'),/date/i);
 const [headers,...rows]=parseCsv(claimsPublicationCsv(expanded,'claimsAdvance','2025-12-31','2025-12-27'));
 assert.equal(rows.length,1);assert.equal(rows[0][headers.indexOf('publication_date')],'2025-12-31');assert.equal(rows[0][headers.indexOf('publication_instant')],'');
 assert.throws(()=>selectClaimsPublicationHistory(expanded,'claimsAdvance','2026-01-08','2025-12-06'),/week/i,'missing publication coverage is not fabricated');
});

test('a legacy pinned export remains exact after new older facts alter the live same-week publication history',async()=>{
 const {legacy,expanded}=archives();
 const pkg=await createResearchPackage({id:'synthetic-legacy-overlap',name:'Legacy overlap before expansion',now:'2026-10-22T23:00:00.000Z',...buildClaimsPublicationPin(legacy,'claimsAdvance','2026-01-08','2025-12-27')});
 const json=exportResearchPackage(pkg),csv=pkg.context.attachments[0].content,primary=researchPackageCsv(pkg);
 assert.notEqual(claimsPublicationCsv(expanded,'claimsAdvance','2026-01-08','2025-12-27'),csv,'new live evidence may add an earlier publication');
 const restored=await importResearchPackage(json);
 assert.equal(exportResearchPackage(restored),json);assert.equal(researchPackageCsv(restored),primary);assert.equal(restored.context.attachments[0].content,csv);assert.equal(restored.context.publicationReleases.length,1);assert.equal(restored.catalog.claimsAdvance.observations[0].value,200);
 const args=buildClaimsPublicationPin(expanded,'claimsAdvance','2025-12-31','2025-12-27');
 assert.equal(args.catalog.claimsAdvance.sourceUrl,'https://oui.doleta.gov/press/2025/123125.pdf');assert.equal(args.catalog.claimsAdvance.source.url,args.catalog.claimsAdvance.sourceUrl);
 assert.deepEqual(args.catalog.claimsAdvance.source.seriesIds,['InitialClaims/SA/Release']);assert.match(args.catalog.claimsAdvance.measure,/Archived official claims publication/);assert.doesNotMatch(args.catalog.claimsAdvance.definition,/latest captured DOL/);
 assert.equal(args.catalog.claimsAdvance.observations[0].publishedAt,'2025-12-31');assert.equal(args.catalog.claimsAdvance.fetchedAt,'2026-10-22T22:00:00.000Z');
});

test('an unspecified shutdown prior stays unknown in selection, visible labels, CSV and portable package evidence',async()=>{
 const prior=claimsFact({period:'2025-11-08',publicationDate:'2025-11-20',releaseStage:'prior-week-status-unknown',value:228});
 prior.footnotes.push('Source reports no weekly news releases from 2025-10-02 through 2025-11-13 during the lapse in appropriations.');
 assert.equal(prior.estimate,'Prior comparison (status unknown)');assert.equal(prior.previouslyPublishedSourceValue,null);
 const archive={version:1,releases:[prior,claimsFact({period:'2025-11-15',publicationDate:'2025-11-20',value:220})]},selected=selectClaimsPublicationHistory(archive,'claimsAdvance','2025-11-20','2025-11-08');
 assert.equal(selected.firstAdvance,null);assert.equal(selected.latest.releaseStage,'prior-week-status-unknown');assert.equal(selected.rows[0].change,null);
 assert.throws(()=>selectClaimsPublicationHistory(archive,'claimsAdvance','2025-11-20','2025-10-18'),/week/i);
 const state={...parseRoute('#/research?view=publications&publicationSeries=claimsAdvance'),publicationPeriod:'2025-11-08',publicationCutoff:'2025-11-20'};
 const html=researchPage(state,{publicationArchive:archive,publicationState:{status:'ready'}});
 assert.match(html,/Prior comparison \(status unknown\)/);assert.match(html,/status unknown[^<]*not[^<]*revised or unrevised/i);assert.match(html,/Original advance[^<]*not retained/);assert.match(html,/no weekly news releases/);
 const csv=claimsPublicationCsv(archive,'claimsAdvance','2025-11-20','2025-11-08'),[headers,row]=parseCsv(csv);
 assert.equal(row[headers.indexOf('release_stage')],'prior-week-status-unknown');assert.equal(row[headers.indexOf('previously_published_source_value')],'');assert.match(row[headers.indexOf('source_notes')],/no weekly news releases/);
 const pkg=await createResearchPackage({id:'synthetic-status-unknown',name:'Unspecified prior publication status',now:'2026-10-22T23:00:00.000Z',...buildClaimsPublicationPin(archive,'claimsAdvance','2025-11-20','2025-11-08')}),json=exportResearchPackage(pkg),restored=await importResearchPackage(json);
 assert.equal(exportResearchPackage(restored),json);assert.equal(restored.context.attachments[0].content,csv);assert.equal(restored.catalog.claimsAdvance.observations[0].releaseStage,'prior-week-status-unknown');assert.equal(restored.context.publicationReleases[0].previouslyPublishedSourceValue,null);
});
