import test from 'node:test';import assert from 'node:assert/strict';
import {parseDolAdvanceText} from '../scripts/sources/dol-advance.mjs';
import {reviewedClaimsText,parseClaimsPublication} from '../scripts/sources/dol-publications.mjs';
import {assertClaimsPublicationData} from '../scripts/dol-publication-policy.mjs';
import {releaseFixture} from './helpers/dol-advance-fixture.js';
import {notices2023} from './helpers/dol-2023-notices.js';
const now=new Date('2026-10-22T23:10:00Z');
const layoutReceipt={url:'https://oui.doleta.gov/press/2023/040623.pdf',sha256:'d13a29ec1173cb24f82a9fb9e561af8c7aab7d20695d825aaf838ddba5b02517'};
const title='UNEMPLOYMENT INSURANCE WEEKLY CLAIMS';

test('March 2023 announcement schedules the update without attributing already applied changes',()=>{
 const input=releaseFixture({header:'Thursday, March 30, 2023',initialDate:'March 25',priorInitialDate:'March 18',continuedDate:'March 18',priorContinuedDate:'March 11'});
 input.firstPage=input.firstPage.replace(title,notices2023[0].sourceText+' '+title);
 const parsed=parseDolAdvanceText(input,{now});assert.equal(parsed.seasonalAdjustmentKind,'scheduled-update');assert.match(parsed.seasonalAdjustmentNote,/2018–2022.*April 6/);assert.match(parsed.seasonalAdjustmentNote,/schedules/);
 assert.throws(()=>parseDolAdvanceText({...input,firstPage:input.firstPage.replace('CY 2018-2022','CY 2017-2022')},{now}),/notice/i);
});

test('2023 source admission pins the reviewed cover layout and original edition without treating the corrected copy as a numeric vintage',()=>{
 const source=releaseFixture({header:'Thursday, April 13, 2023',initialDate:'April 8',priorInitialDate:'April 1',continuedDate:'April 1',priorContinuedDate:'March 25',initial:'239,000',initialChange:'an increase of 11,000',initialPrior:'unrevised level of 228,000',initialTable:'239,000 228,000 +11,000',continued:'1,810,000',continuedChange:'a decrease of 13,000',continuedPrior:'unrevised level of 1,823,000',continuedTable:'1,810,000 1,823,000 -13,000'});
 const provenance={url:'https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20230700.pdf',sha256:'c998e1dfd88bac87df55fdfe5386399b81d68b4052a43a3b49482831737db0a6',retrievedAt:'2026-10-22T23:10:00.000Z',lastModified:null};
 const admitted=parseClaimsPublication(source,{provenance,now});assert.equal(admitted.releases.length,4);assert.ok(admitted.releases.every(row=>row.footnotes.some(note=>/original official.*corrected.*identical.*correction date is not established/i.test(note))));assert.ok(admitted.releases.every(row=>row.provenance.length===1&&row.sourceUrl===provenance.url&&row.seasonalAdjustmentNote===null));
 const wrong=structuredClone(admitted);wrong.releases[0].provenance[0].sha256='b'.repeat(64);assert.throws(()=>assertClaimsPublicationData(wrong),/edition|hash/i);
 assert.throws(()=>parseClaimsPublication(source,{provenance:{...provenance,url:provenance.url.replace('20230700.pdf','20230700b.pdf')},now}),/unreviewed source/i);
 assert.throws(()=>parseClaimsPublication(source,{provenance:{...provenance,url:'https://oui.doleta.gov/press/2023/041323.pdf'},now}),/unreviewed source/i);
 const numeric=releaseFixture({header:'Thursday, April 6, 2023',initialDate:'April 1',priorInitialDate:'March 25',continuedDate:'March 25',priorContinuedDate:'March 18',initial:'228,000',initialChange:'a decrease of 18,000',initialPrior:"revised level. The previous week's level was revised up by 48,000 from 198,000 to 246,000",initialTable:'228,000 246,000 -18,000',continued:'1,823,000',continuedChange:'an increase of 6,000',continuedPrior:"revised level. The previous week's level was revised up by 128,000 from 1,689,000 to 1,817,000",continuedTable:'1,823,000 1,817,000 +6,000'}),index=numeric.firstPage.indexOf(title),firstPage=numeric.firstPage.slice(0,index)+notices2023[1].sourceText;
 const input={firstPage,tableText:firstPage+'\n2 '+numeric.firstPage.slice(index)+'\n'+numeric.tableText};
 const layout=parseClaimsPublication(input,{provenance:{...provenance,...layoutReceipt},now});assert.equal(layout.releases[0].value,246);assert.equal(layout.releases[2].value,1817);
 const changed=structuredClone(layout);changed.releases[0].provenance[0].sha256='a'.repeat(64);assert.throws(()=>assertClaimsPublicationData(changed),/layout|hash/i);
});

test('April 2023 cover-page handling requires exact reviewed bytes and page-two layout, preserving the pandemic non-revision exception',()=>{
 const fixture=releaseFixture({header:'Thursday, April 6, 2023',initialDate:'April 1',priorInitialDate:'March 25',continuedDate:'March 25',priorContinuedDate:'March 18'}),index=fixture.firstPage.indexOf(title);
 const firstPage=fixture.firstPage.slice(0,index)+notices2023[1].sourceText;
 const input={firstPage,tableText:firstPage+'\n2  '+fixture.firstPage.slice(index)+'\n'+fixture.tableText};
 assert.throws(()=>parseDolAdvanceText(input,{now}),/header/i,'the ordinary parser does not search arbitrary later pages');
 const corrected=reviewedClaimsText(input,layoutReceipt);assert.notEqual(corrected,input);assert.equal(input.firstPage,firstPage);assert.equal(corrected.tableText,input.tableText);
 const parsed=parseDolAdvanceText(corrected,{now});assert.equal(parsed.seasonalAdjustmentKind,'applied-update');assert.equal(parsed.series.claimsAdvance.observations[1].value,194);
 assert.match(parsed.seasonalAdjustmentNote,/March 2020.*June 2021.*not revised.*additive/i);assert.match(parsed.seasonalAdjustmentNote,/before and after.*multiplicative/i);assert.match(parsed.seasonalAdjustmentNote,/outlier/i);
 for(const changed of [{sha256:'a'.repeat(64)},{url:'https://oui.doleta.gov/press/2023/041323.pdf'}])assert.equal(reviewedClaimsText(input,{...layoutReceipt,...changed}),input);
 for(const tableText of [input.tableText.replace('\n2  ','\n3  '),input.tableText.replace('News Release','Changed source heading')])assert.throws(()=>reviewedClaimsText({...input,tableText},layoutReceipt),/layout|page|prefix/i);
 assert.throws(()=>parseDolAdvanceText({...corrected,firstPage:corrected.firstPage.replace('was not revised','was revised')},{now}),/notice/i);
});
