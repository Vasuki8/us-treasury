import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicationArchive} from '../src/publication-archive.js';
import {publicationExplanations} from '../src/publication-explanations.js';
import {publicationExplanationScope,explanationMetadataFor} from '../scripts/publication-explanation-policy.mjs';
import {parsePublicationExplanationPage} from '../scripts/sources/publication-explanations.mjs';
import {capturePublicationExplanationArchive} from '../scripts/capture-publication-explanations.mjs';
import {publicationExplanationRows,publicationExplanationsCsv} from '../src/publication-explanation-view.js';
import {buildPublicationPin} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const retainedHashes=[
 '4afc3ef0f0400238643c47e3bcc0c03aa4ef4817517b5796988624e901995548',
 'e074377e252571c4cd3339f3c6b736348d633fc811ef8dfc09e26f3a8a90e47d',
 'a2a632d0437aee1e9bd7f94f7b031e2e05bd7e3d55fce45ab6f06e5fb6e456d9',
 '745f09cf583792498705fc655729491f84cc554c2f14f228d735b7de14d80713',
 '5da80f36d6e11a8a5a279da9675384ebebf5157814cacbc6b8b580b86f3f96f2',
 'cc53105febb2ca4a393439b21b4a788fcf3a15bb28110e86f7fe5803d41e20cf',
 'd7e3d5c5988ba98bed1f66da6b435529d640b3645cc5f7b44482fbc6830a65d3',
 'fb60cd42d4745d4254d0ff5b159c45e41c7398066b9d2e57676fe9761bbe27fd',
 '3583fec21e98a405d0a570102567c660e2468850278b431354a2cf0a27e798c6',
 'a1d81f5649a544fd9cd723cf8cc4fc318d464e195f32e5d846e9c59201d6856a',
];
const earlierFacts=publicationArchive.releases.filter(row=>row.period>='2023-01-01'&&row.period<='2025-04-01'&&['Second','Third'].includes(row.estimate));
const earlierIds=earlierFacts.map(row=>row.id).sort();

test('twenty earlier revisions append without changing any of the ten original explanation records',()=>{
 assert.equal(earlierFacts.length,20);assert.equal(publicationExplanations.explanations.length,33);
 assert.deepEqual(publicationExplanations.explanations.slice(0,10).map(row=>createHash('sha256').update(JSON.stringify(row)).digest('hex')),retainedHashes);
 assert.deepEqual(publicationExplanations.explanations.slice(10,30).map(row=>row.publicationId).sort(),earlierIds);
 for(const row of publicationExplanations.explanations.slice(10,30)){
  assert.equal(row.kind,'revision');assert.equal(row.textType,'paraphrase');assert.equal(row.annualUpdate,null);assert.equal(row.publishedAt,null);
  assert.ok(row.provenance[0].retrievedAt>'2026-10-22T19:00:11.781Z');assert.equal(row.provenance[0].url,row.sourceUrl);assert.equal(row.licenseUrl,'https://www.bea.gov/help/faq/147');
 }
});

test('expansion requests only new identities and retains the original evidence prefix by reference',async()=>{
 const previous={version:1,explanations:publicationExplanations.explanations.slice(0,10)},before=JSON.stringify(previous);let requested;
 const result=await capturePublicationExplanationArchive({previous,collect:async({ids})=>{
  requested=ids;return{version:1,explanations:ids.map(id=>{const scope=publicationExplanationScope.find(row=>row.publicationId===id);return{...explanationMetadataFor(scope),provenance:[{url:scope.sourceUrl,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T20:00:00.000Z',lastModified:null}]};})};
 }});
 assert.deepEqual(requested.sort(),publicationExplanationScope.slice(10).map(row=>row.publicationId).sort());assert.equal(JSON.stringify(previous),before);assert.equal(result.explanations.length,33);
 previous.explanations.forEach((row,index)=>assert.equal(result.explanations[index],row));
});

test('historical article mode requires one exact unique revision paragraph within the reviewed article',()=>{
 const scope=publicationExplanationScope.find(row=>row.sectionHeading===null);assert.ok(scope,'Earlier release paragraph scope must be admitted');
 const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const paragraph=scope.sectionPassages.join(' '),p='<p>'+escape(paragraph)+'</p>';
 const prefix='<article about="'+new URL(scope.sourceUrl).pathname+'"><h1>'+escape(scope.sourceTitle)+'</h1><div class="field--name-field-release-date">'+escape(scope.releaseDateText)+'</div>'+scope.sourcePassages.map(text=>'<div>'+escape(text)+'</div>').join('');
 const html=prefix+p+'</article>',provenance={url:scope.sourceUrl,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T20:00:00.000Z',lastModified:null};
 assert.equal(parsePublicationExplanationPage(html,{provenance,ids:[scope.publicationId]}).explanations[0].publicationId,scope.publicationId);
 const middle=Math.floor(paragraph.length/2),split='<p>'+escape(paragraph.slice(0,middle))+'</p><p>'+escape(paragraph.slice(middle))+'</p>';
 for(const invalid of [prefix+'</article>'+p,prefix+'<!--'+p+'--></article>',prefix+'<template>'+p+'</template></article>',prefix+p+p+'</article>',prefix+split+'</article>',prefix+'<p>Unreviewed prefix. '+escape(paragraph)+'</p></article>'])assert.throws(()=>parsePublicationExplanationPage(invalid,{provenance,ids:[scope.publicationId]}),/paragraph|section|passage/i);
});

test('earlier cutoffs, negative growth, unreviewed annual updates and frozen CSV retain their exact scope',async()=>{
 const rows=publicationExplanationRows(publicationArchive,publicationExplanations,'2023-06-29','2023-01-01');assert.equal(rows.length,3);assert.equal(rows.filter(row=>row.explanation).length,2);assert.equal(rows.at(-1).publication.value,2);
 const early=publicationExplanationRows(publicationArchive,publicationExplanations,'2023-05-24','2023-01-01');assert.equal(early.length,1);assert.equal(early[0].explanation,null);
 const latest=publicationExplanationRows(publicationArchive,publicationExplanations,'2026-09-30','2023-01-01');assert.equal(latest.at(-1).explanation,null);
 const negatives=publicationExplanationRows(publicationArchive,publicationExplanations,'2025-06-26','2025-01-01');assert.equal(negatives.at(-1).publication.value,-0.5);assert.equal(negatives.at(-1).explanation.kind,'revision');
 const args=buildPublicationPin(publicationArchive,'2023-06-29','2023-01-01',{explanationArchive:publicationExplanations,explanationStatus:'ready'}),csv=publicationExplanationsCsv(publicationArchive,publicationExplanations,'2023-06-29','2023-01-01');
 assert.equal(args.context.publicationExplanations.length,2);assert.equal(args.context.attachments[1].content,csv);assert.equal(parseCsv(csv).length,4);assert.doesNotMatch(csv,/2023-09-28|2026-09-30/);
 const pkg=await createResearchPackage({name:'Earlier GDP evidence',...args}),text=exportResearchPackage(pkg);assert.equal(exportResearchPackage(await importResearchPackage(text)),text);assert.equal(pkg.catalog.gdp.observations[0].value,2);
});
