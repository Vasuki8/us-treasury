import test from 'node:test';import assert from 'node:assert/strict';
import {researchPage} from '../src/research-page.js';import {parseRoute,routeFor} from '../src/router.js';import {renderPage} from '../src/pages.js';
import {claimsFixture} from './helpers/claims-publications-fixture.js';
import * as pin from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv} from '../src/research-packages.js';
const state=(extra={})=>({...parseRoute('#/research?view=publications'),publicationSeries:'claimsAdvance',publicationPeriod:'2026-03-07',publicationCutoff:'2026-03-19',...extra});
test('publication routes preserve safe series/week/cutoff while original GDP links remain unchanged',()=>{
 const original='#/research?view=publications&period=2026-01-01&publishedBy=2026-06-25',gdp=parseRoute(original);assert.equal(gdp.publicationSeries,'gdp');assert.ok(!routeFor(gdp).includes('publicationSeries'));
 const restored=parseRoute(routeFor(state()));assert.equal(restored.publicationSeries,'claimsAdvance');assert.equal(restored.publicationPeriod,'2026-03-07');assert.equal(restored.publicationCutoff,'2026-03-19');assert.equal(parseRoute('#/research?view=publications&publicationSeries=vendor').publicationSeries,'gdp');
});
test('weekly publication view renders roles, measurement selection, scoped actions and source-noted seasonal limits',()=>{
 const html=researchPage(state(),{publicationArchive:claimsFixture(),publicationState:{status:'ready'}});
 for(const text of ['OFFICIAL CLAIMS PUBLICATION HISTORY','Reference week','publication-series','claimsAdvance','continuedClaimsAdvance','CSV THIS WEEK','Revised prior','Advance','day precision','seasonal-factor'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/REAL GDP GROWTH|BEA EXPLANATIONS|%<\/td>/);assert.match(html,/https:\/\/oui.doleta.gov\/press\/2026\/031926.pdf/);
 const before=researchPage(state({publicationCutoff:'2026-03-11'}),{publicationArchive:claimsFixture(),publicationState:{status:'ready'}});assert.match(before,/No selected publication/);assert.doesNotMatch(before,/Source reports annual/);
 const prior=researchPage(state({publicationPeriod:'2025-12-27',publicationCutoff:'2026-01-08'}),{publicationArchive:claimsFixture(),publicationState:{status:'ready'}});assert.match(prior,/Original advance.*not retained/i);
 const failed=researchPage(state(),{publicationState:{status:'error',error:'Synthetic archive unavailable'}});assert.match(failed,/id="publication-series"/);assert.match(failed,/data-retry-publications/);
});
test('claims detail links directly to its own publication archive selection',()=>{
 for(const id of ['claimsAdvance','continuedClaimsAdvance'])assert.ok(renderPage(parseRoute('#/series/'+id)).includes('publicationSeries='+id));
});
test('a source seasonal-factor notice retained in row footnotes is shown once in the compact table',()=>{
 const archive=claimsFixture(),row=archive.releases.find(item=>item.seasonalAdjustmentNote);
 row.footnotes.push(row.seasonalAdjustmentNote);
 const html=researchPage(state(),{publicationArchive:archive,publicationState:{status:'ready'}});
 assert.equal(html.split(row.seasonalAdjustmentNote).length-1,1);
});
test('claims publication pins freeze only selected facts, exact CSV, roles and day dates independent of live archives',async()=>{
 assert.equal(typeof pin.buildClaimsPublicationPin,'function');const archive=claimsFixture(),args=pin.buildClaimsPublicationPin(archive,'claimsAdvance','2026-03-19','2026-03-07');
 assert.deepEqual(args.state.selected,['claimsAdvance']);assert.equal(args.catalog.claimsAdvance.observations[0].value,201);assert.equal(args.catalog.claimsAdvance.observations[0].publishedAt,'2026-03-19');assert.equal(args.context.publicationReleases.length,2);assert.equal(args.context.publicationSeries,'claimsAdvance');
 assert.match(args.catalog.claimsAdvance.measure,/Archived official claims publication/);assert.doesNotMatch(args.catalog.claimsAdvance.measure,/Latest release context/);
 assert.match(args.catalog.claimsAdvance.short,/archived publication/i);assert.doesNotMatch(args.catalog.claimsAdvance.short,/latest release/i);
 const pkg=await createResearchPackage({id:'synthetic-claims-history',name:'Claims published by date',...args}),text=exportResearchPackage(pkg),csv=pkg.context.attachments[0].content;
 archive.releases.length=0;const imported=await importResearchPackage(text);assert.equal(exportResearchPackage(imported),text);assert.equal(imported.context.attachments[0].content,csv);assert.match(csv,/prior-week-revised/);assert.doesNotMatch(csv,/continuedClaimsAdvance/);assert.equal(researchPackageCsv(imported),pkg.csv);
 const html=researchPage({...state(),researchView:'packages',packageId:pkg.id},{library:{packages:[imported]}});assert.match(html,/READ-ONLY/);assert.match(html,/claims-publication-history.csv/);assert.doesNotMatch(html,/FROZEN BEA EXPLANATIONS/);
});
