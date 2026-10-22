import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationArchive} from '../src/publication-archive.js';
import {publicationExplanation,publicationExplanationRows,publicationExplanationsCsv} from '../src/publication-explanation-view.js';
import {createPublicationExplanationLoader} from '../src/publication-explanation-loader.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {publicationExplanations as capturedExplanations} from '../src/publication-explanations.js';

const facts={version:1,releases:publicationArchive.releases.slice(0,3)};
const row=facts.releases[2];
const evidence={publicationId:row.id,seriesId:'gdp',period:row.period,estimate:row.estimate,publicationDate:row.publicationDate,kind:'revision',summary:'Test-only reviewed revision summary.',details:['A test-only source detail.'],annualUpdate:null,sourceUrl:row.releaseEvidenceUrl,sourceTitle:'Test release',sourceSection:'Sources of revisions',publicationDatePrecision:'day',publishedAt:null,licenseUrl:row.licenseUrl,attribution:row.attribution,provenance:[{url:row.releaseEvidenceUrl,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T18:00:00.000Z',lastModified:null}]};
const explanations={version:1,explanations:[evidence]};

test('explanations require the exact publication identity, quarter, stage and date',()=>{
 assert.equal(publicationExplanation(row,explanations),evidence);
 for(const patch of [{id:'other'},{period:'2025-01-01'},{estimate:'Second'},{publicationDate:'2026-06-24'},{seriesId:'cpi'}])assert.equal(publicationExplanation({...row,...patch},explanations),null);
 assert.equal(publicationExplanation(facts.releases[0],explanations),null);
 assert.equal(publicationExplanation(row,null),null);
 assert.throws(()=>publicationExplanation(row,{version:1,explanations:[evidence,evidence]}),/duplicate|ambiguous/i);
});

test('quarter and publication cutoff apply before selecting explanations; missing evidence stays explicit',()=>{
 const early=publicationExplanationRows(facts,explanations,'2026-05-28','2026-01-01');
 assert.equal(early.length,2);assert.ok(early.every(item=>item.explanation===null));
 const complete=publicationExplanationRows(facts,explanations,'2026-06-25','2026-01-01');
 assert.equal(complete.length,3);assert.equal(complete.at(-1).explanation,evidence);
 assert.deepEqual(publicationExplanationRows(facts,explanations,'2026-04-29','2026-01-01'),[]);
});

test('explanation CSV retains source, release and retrieval evidence without changing the numerical publication CSV',()=>{
 const [headers,...values]=parseCsv(publicationExplanationsCsv(facts,explanations,'2026-06-25','2026-01-01')),rows=values.map(values=>Object.fromEntries(headers.map((header,i)=>[header,values[i]])));
 assert.equal(rows.length,3);assert.equal(rows[0].explanation_status,'not-reviewed');assert.equal(rows[0].summary,'');
 assert.equal(rows[2].summary,evidence.summary);assert.equal(rows[2].publication_id,row.id);assert.equal(rows[2].explanation_status,'revision');
 assert.equal(rows[2].publication_date,'2026-06-25');assert.equal(rows[2].publication_instant,'');assert.equal(rows[2].retrieved_at,evidence.provenance[0].retrievedAt);
 assert.deepEqual(JSON.parse(rows[2].details_json),evidence.details);assert.equal(rows[2].license_url,evidence.licenseUrl);assert.equal(rows[2].source_url,evidence.sourceUrl);
 assert.equal(rows[2].attribution,evidence.attribution);assert.match(rows[2].interpretation,/paraphrase|BEA/i);
 const early=publicationExplanationsCsv(facts,explanations,'2026-05-28','2026-01-01');assert.doesNotMatch(early,/Test-only reviewed/);
});

test('explanation archive is lazy, deduplicates loading and caches success',async()=>{
 let calls=0,finish;const loader=createPublicationExplanationLoader({importArchive:()=>{calls++;return new Promise(resolve=>{finish=resolve;});}});
 assert.equal(calls,0);const first=loader.load(),second=loader.load();assert.equal(first,second);assert.equal(calls,1);
 finish({publicationExplanations:explanations});assert.equal(await first,explanations);assert.equal(await loader.load(),explanations);assert.equal(calls,1);
});

test('explanation errors require an explicit retry and malformed archives remain unavailable',async()=>{
 let calls=0;const loader=createPublicationExplanationLoader({importArchive:async()=>{if(++calls===1)throw Error('HTTP503');return{publicationExplanations:explanations};}});
 await assert.rejects(loader.load(),/503/);await assert.rejects(loader.load(),/503/);assert.equal(calls,1);assert.equal(await loader.load({retry:true}),explanations);
 for(const archive of [{version:2,explanations:[]},{version:1,explanations:null},{version:1,explanations:Array(2001).fill(evidence)}]){
  await assert.rejects(createPublicationExplanationLoader({importArchive:()=>({publicationExplanations:archive})}).load(),/explanation archive/i);
 }
});

test('a retry uses a new module attempt because browsers cache failed native imports',async()=>{
 const attempts=[];
 const loader=createPublicationExplanationLoader({importArchive:attempt=>{attempts.push(attempt);return attempt===0?Promise.reject(Error('Cached fetch failure')):{publicationExplanations:explanations};}});
 await assert.rejects(loader.load(),/failure/);await assert.rejects(loader.load(),/failure/);assert.deepEqual(attempts,[0]);
 assert.equal(await loader.load({retry:true}),explanations);assert.deepEqual(attempts,[0,1]);await loader.load({retry:true});assert.deepEqual(attempts,[0,1]);
});

test('captured explanations preserve rounded revisions and annual boundaries in real scoped exports',()=>{
 assert.equal(capturedExplanations.explanations.length,33);
 for(const item of capturedExplanations.explanations){const row=publicationArchive.releases.find(row=>row.id===item.publicationId);assert.equal(publicationExplanation(row,capturedExplanations),item);}
 const q2=publicationExplanationRows(publicationArchive,capturedExplanations,'2026-08-26','2026-04-01');assert.equal(q2.length,2);assert.equal(q2[0].publication.value,q2[1].publication.value);assert.equal(q2[1].explanation.kind,'revision');assert.match(q2[1].explanation.summary,/less than 0\.1/);
 const csv=publicationExplanationsCsv(publicationArchive,capturedExplanations,'2026-08-26','2026-04-01');assert.doesNotMatch(csv,/2026-09-30|Annual update/);
 const q1=publicationExplanationRows(publicationArchive,capturedExplanations,'2026-09-30','2026-01-01');assert.equal(q1.at(-1).explanation.kind,'annual-update');assert.match(q1.at(-1).explanation.summary,/exports of services/);
 const older=publicationExplanationRows(publicationArchive,capturedExplanations,'2026-09-30','2021-01-01');assert.ok(older.length);assert.ok(older.every(item=>item.explanation===null));
});
