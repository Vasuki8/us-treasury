import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicationArchive} from '../src/publication-archive.js';
import {publicationExplanations} from '../src/publication-explanations.js';
import {publicationExplanationScope} from '../scripts/publication-explanation-policy.mjs';
import {capturePublicationExplanationArchive} from '../scripts/capture-publication-explanations.mjs';
import {publicationExplanationRows,publicationExplanationsCsv} from '../src/publication-explanation-view.js';
import {publicationCsv} from '../src/publication-history.js';
import {buildPublicationPin} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const targets=[
 {period:'2023-01-01',day:'2023-09-28',before:'2023-09-27',prior:'2.0',value:'2.2',kind:'comprehensive-update'},
 {period:'2024-01-01',day:'2024-09-26',before:'2024-09-25',prior:'1.4',value:'1.6',kind:'annual-update'},
 {period:'2025-01-01',day:'2025-09-25',before:'2025-09-24',prior:'-0.5',value:'-0.6',kind:'annual-update'},
].map(row=>({...row,id:`bea-gdp-${row.period.slice(0,4)}q1-revised-${row.day}`}));
const previous={version:1,explanations:publicationExplanations.explanations.slice(0,30)};

test('targeted updates preserve the entire thirty-record immutable prefix and append exactly three identities',async()=>{
 assert.equal(createHash('sha256').update(JSON.stringify(previous.explanations)).digest('hex'),'ff57a37e3cdbfaa2683cd710f622a67bdd6381020e1ab13e2ca87bb1aeccdfd1');
 assert.deepEqual(publicationExplanations.explanations.slice(30).map(row=>row.publicationId),targets.map(row=>row.id));
 const before=JSON.stringify(previous);let calls=0;
 const result=await capturePublicationExplanationArchive({previous,collect:async({ids})=>{
  calls++;assert.deepEqual(ids,targets.map(row=>row.id));
  return {version:1,explanations:publicationExplanations.explanations.filter(row=>ids.includes(row.publicationId)).toReversed()};
 }});
 assert.equal(calls,1);assert.equal(JSON.stringify(previous),before);
 assert.deepEqual(result,publicationExplanations);previous.explanations.forEach((row,index)=>assert.equal(result.explanations[index],row));
 assert.equal(await capturePublicationExplanationArchive({previous:result,collect:()=>{throw Error('Must not refetch retained evidence');}}),result);
});

test('annual and comprehensive causes attach only to the exact quarter on or after its publication day',()=>{
 for(const target of targets){
  const admitted=publicationExplanationScope.find(row=>row.publicationId===target.id);assert.ok(admitted);assert.equal(admitted.kind,target.kind);assert.equal(admitted.previousValue,target.prior);assert.equal(admitted.sourceValue,target.value);assert.equal(admitted.annualUpdate,null);
  const early=publicationExplanationRows(publicationArchive,publicationExplanations,target.before,target.period);
  assert.ok(early.every(row=>row.publication.id!==target.id));
  const rows=publicationExplanationRows(publicationArchive,publicationExplanations,target.day,target.period),last=rows.at(-1);
  assert.equal(last.publication.id,target.id);assert.equal(last.explanation.kind,target.kind);assert.equal(last.explanation.previousValue,target.prior);assert.equal(last.explanation.sourceValue,target.value);
  assert.equal(rows.at(-2).publication.sourceValue,target.prior);
  const q2=publicationExplanationRows(publicationArchive,publicationExplanations,target.day,`${target.period.slice(0,4)}-04-01`).at(-1);
  assert.equal(q2.publication.publicationDate,target.day);assert.equal(q2.explanation.kind,'revision');assert.notEqual(q2.explanation.publicationId,target.id);assert.equal(q2.explanation.sourceUrl,last.explanation.sourceUrl);
  const latest=publicationExplanationRows(publicationArchive,publicationExplanations,'2026-09-30',target.period).at(-1);assert.equal(latest.explanation,null);
 }
 const confirmation=publicationExplanationRows(publicationArchive,publicationExplanations,'2023-08-30','2023-01-01').at(-1);
 assert.equal(confirmation.publication.sourceValue,'2.0');assert.equal(confirmation.explanation,null);
});

test('targeted CSV and new pins retain kind, exact source tokens and independent date/provenance fields',async()=>{
 for(const target of targets){
  const csv=publicationExplanationsCsv(publicationArchive,publicationExplanations,target.day,target.period),table=parseCsv(csv),headers=table[0],record=table.slice(1).find(row=>row[headers.indexOf('publication_id')]===target.id);
  assert.ok(record);assert.equal(record[headers.indexOf('explanation_status')],target.kind);assert.equal(record[headers.indexOf('publication_date')],target.day);assert.equal(record[headers.indexOf('value')],target.value);
  assert.match(record[headers.indexOf('retrieved_at')],/^2026-10-22T/);assert.equal(record[headers.indexOf('license_url')],'https://www.bea.gov/help/faq/147');
  const pin=buildPublicationPin(publicationArchive,target.day,target.period,{explanationArchive:publicationExplanations,explanationStatus:'ready'});
  const explanation=pin.context.publicationExplanations.find(row=>row.publicationId===target.id);assert.equal(explanation.kind,target.kind);assert.equal(explanation.sourceValue,target.value);assert.equal(explanation.previousValue,target.prior);
  assert.equal(pin.context.attachments[0].content,publicationCsv(publicationArchive,target.day,target.period));assert.equal(pin.context.attachments[1].content,csv);
  const pkg=await createResearchPackage({name:`${target.period.slice(0,4)} Q1 update`,...pin}),text=exportResearchPackage(pkg);assert.equal(exportResearchPackage(await importResearchPackage(text)),text);
  assert.equal(pkg.catalog.gdp.observations[0].value,Number(target.value));
 }
});

test('older pinned packages stay frozen and earlier-cutoff contexts are byte-identical after expansion',async()=>{
 for(const target of targets){
  const oldOptions={explanationArchive:previous,explanationStatus:'ready'},newOptions={explanationArchive:publicationExplanations,explanationStatus:'ready'};
  assert.deepEqual(buildPublicationPin(publicationArchive,target.before,target.period,newOptions),buildPublicationPin(publicationArchive,target.before,target.period,oldOptions));
  const oldPin=buildPublicationPin(publicationArchive,target.day,target.period,oldOptions),pkg=await createResearchPackage({name:'Retained pre-expansion package',...oldPin}),text=exportResearchPackage(pkg);
  buildPublicationPin(publicationArchive,target.day,target.period,newOptions);
  assert.equal(exportResearchPackage(pkg),text);assert.equal(exportResearchPackage(await importResearchPackage(text)),text);assert.ok(pkg.context.publicationExplanations.every(row=>row.publicationId!==target.id));
 }
});
