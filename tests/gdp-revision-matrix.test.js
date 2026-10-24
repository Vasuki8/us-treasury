import test from 'node:test';
import assert from 'node:assert/strict';
import {buildGdpRevisionMatrix,gdpRevisionMatrixCsv} from '../src/gdp-revision-matrix.js';
import {gdpRevisionMatrixPanel} from '../src/gdp-revision-matrix-view.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {publicationArchive} from '../src/publication-archive.js';
const fact=(id,period,estimate,publicationDate,value,extra={})=>({id,seriesId:'gdp',period,estimate,publicationDate,value,unit:'Percent change from preceding quarter, annualized',frequency:'Quarterly',adjustment:'Seasonally adjusted annual rate',sourceValue:String(value),sourcePublicationDate:publicationDate,sourceIds:['A191RL'],sourceUrl:'https://www.bea.gov/vintage.xlsx',releaseEvidenceUrl:'https://www.bea.gov/vintage.xlsx',sourceCells:{value:'E12'},provenance:[{retrievedAt:'2026-10-22T12:00:00Z',sha256:'abc'}],...extra});
const releases=[
 fact('a1','2024-01-01','Advance','2024-04-25',1),fact('s1','2024-01-01','Second','2024-05-30',0),fact('t1','2024-01-01','Third','2024-06-27',0),
 fact('a2','2024-04-01','Advance','2024-07-25',0),fact('p2','2024-04-01','Preliminary','2024-08-29',2),fact('f2','2024-04-01','Final','2024-09-26',1),
 fact('a3','2024-07-01','Advance','2024-10-30',0),fact('s3','2024-07-01','Second','2024-11-27',0),
 fact('a4','2024-10-01','Advance','2025-01-30',1),fact('s4','2024-10-01','Second','2025-02-27',9,{sourcePublicationDate:'Feb 27, 2025 GDP not open for revision'}),fact('t4','2024-10-01','Third','2025-03-27',3),
 fact('initial','2018-10-01','Initial','2019-02-28',2.6),fact('third','2018-10-01','Third','2019-03-28',2.2),
 fact('initial25','2025-07-01','Initial','2025-12-23',4.3),fact('updated25','2025-07-01','Updated','2026-01-22',4.4),fact('revised25','2025-07-01','Revised','2026-09-30',4.1),
 fact('r1','2024-01-01','Revised','2026-09-30',2.7),
];
test('matrix maps only explicit routine labels, retains raw evidence and exceptional missing stages',()=>{
 const view=buildGdpRevisionMatrix({releases});
 const historical=view.rows.find(r=>r.period==='2024-04-01');assert.equal(historical.second.estimate,'Preliminary');assert.equal(historical.third.estimate,'Final');
 const exceptional=view.rows.find(r=>r.period==='2018-10-01');assert.equal(exceptional.advance,null);assert.equal(exceptional.second,null);assert.equal(exceptional.third.id,'third');assert.deepEqual(exceptional.exceptions.map(r=>r.id),['initial']);
 const q25=view.rows.find(r=>r.period==='2025-07-01');assert.equal(q25.advance,null);assert.equal(q25.second,null);assert.equal(q25.third,null);assert.deepEqual(q25.exceptions.map(r=>r.estimate),['Initial','Updated','Revised']);
 const q1=view.rows.find(r=>r.period==='2024-01-01');assert.equal(q1.latest.id,'r1');assert.equal(q1.third.id,'t1');assert.equal(q1.latestMinusFirstPp,1.7);assert.deepEqual(q1.advance.sourceCells,{value:'E12'});
 assert.deepEqual(releases[0].sourceCells,{value:'E12'});
});
test('pair summaries use independent denominators, retain zero and exclude explicit confirmations',()=>{
 const {summaries,rows}=buildGdpRevisionMatrix({releases});
 assert.deepEqual(summaries.secondMinusAdvance,{sampleN:3,meanSignedPp:1/3,meanAbsolutePp:1,medianAbsolutePp:1});
 assert.deepEqual(summaries.thirdMinusSecond,{sampleN:2,meanSignedPp:-.5,meanAbsolutePp:.5,medianAbsolutePp:.5});
 assert.deepEqual(summaries.thirdMinusAdvance,{sampleN:3,meanSignedPp:2/3,meanAbsolutePp:4/3,medianAbsolutePp:1});
 const q4=rows.find(r=>r.period==='2024-10-01');assert.equal(q4.second.id,'s4');assert.equal(q4.revisions.secondMinusAdvance,null);assert.equal(q4.revisions.thirdMinusSecond,null);assert.equal(q4.revisions.thirdMinusAdvance,2);assert.equal(q4.confirmations.length,1);
});
test('publication-day cutoff changes cells and eligible samples without looking ahead or borrowing current NIPA',()=>{
 const view=buildGdpRevisionMatrix({releases,currentGdp:[{date:'2024-01-01',value:99}]},{cutoff:'2024-05-29'});
 assert.equal(view.cutoff,'2024-05-29');assert.equal(view.rows.find(r=>r.period==='2024-01-01').latest.id,'a1');assert.equal(view.rows.find(r=>r.period==='2024-01-01').second,null);assert.equal(view.summaries.secondMinusAdvance.sampleN,0);assert.equal(view.summaries.secondMinusAdvance.meanSignedPp,null);
 assert.deepEqual(buildGdpRevisionMatrix({releases},{cutoff:'2000-01-01'}).rows,[]);
 assert.throws(()=>buildGdpRevisionMatrix({releases},{cutoff:'2026-02-30'}),/date/i);
});
test('missing numbers and incompatible measurement metadata are ineligible; stage collisions are visible',()=>{
 const archive={releases:[fact('a','2026-01-01','Advance','2026-04-30',0),fact('s','2026-01-01','Second','2026-05-28',null),fact('t','2026-01-01','Third','2026-06-25',2,{adjustment:'Unadjusted'})]};
 const view=buildGdpRevisionMatrix(archive);assert.equal(view.rows[0].revisions.secondMinusAdvance,null);assert.equal(view.rows[0].revisions.thirdMinusAdvance,null);
 archive.releases.push(fact('p','2026-01-01','Preliminary','2026-05-29',1));const ambiguous=buildGdpRevisionMatrix(archive).rows[0];assert.equal(ambiguous.second,null);assert.match(ambiguous.notes.join(' '),/multiple|ambiguous/i);assert.equal(ambiguous.publications.length,4);
});
test('matrix CSV is cutoff-scoped with raw identities, source evidence and independent sample summaries',()=>{
 const csv=gdpRevisionMatrixCsv({releases},{cutoff:'2024-09-26'});const [header,...data]=parseCsv(csv);const rows=data.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]])));
 const q2=rows.find(r=>r.reference_quarter==='2024-04-01');assert.equal(q2.second_id,'p2');assert.equal(q2.second_raw_stage,'Preliminary');assert.equal(q2.third_raw_stage,'Final');assert.equal(q2.publication_cutoff,'2024-09-26');assert.equal(q2.second_minus_advance_pp,'2');assert.equal(JSON.parse(q2.second_evidence_json).provenance[0].sha256,'abc');
 assert.doesNotMatch(csv,/revised25|r1|currentGdp/);assert.equal(JSON.parse(q2.pair_summaries_json).thirdMinusSecond.sampleN,2);
});
test('native panel provides matrix-only controls, methods, raw stages and truthful empty/error states',()=>{
 const html=gdpRevisionMatrixPanel({releases},{cutoff:'2024-09-26'});assert.equal((html.match(/id="publication-cutoff"/g)||[]).length,1);assert.match(html,/data-export-gdp-matrix/);assert.match(html,/data-pin-gdp-matrix/);assert.match(html,/Preliminary/);assert.match(html,/mean signed/i);assert.match(html,/median absolute/i);assert.match(html,/day precision/i);assert.match(html,/confirmations/i);assert.doesNotMatch(html,/id="publication-period"/);
 const empty=gdpRevisionMatrixPanel({releases},{cutoff:'2000-01-01'});assert.match(empty,/No .*publication/i);assert.match(empty,/data-export-gdp-matrix disabled/);
 assert.match(gdpRevisionMatrixPanel({releases},{cutoff:'2026-02-30'}),/Invalid publication cutoff/i);
});
test('retained official archive keeps exceptional quarters and annual-update evidence out of routine grouping',()=>{
 const view=buildGdpRevisionMatrix(publicationArchive);assert.equal(view.rows.length,98);
 const q18=view.rows.find(r=>r.period==='2018-10-01');assert.equal(q18.advance,null);assert.equal(q18.second,null);assert.equal(q18.third.estimate,'Third');
 const q25=view.rows.find(r=>r.period==='2025-07-01');assert.equal(q25.third,null);assert.equal(q25.latest.estimate,'Revised');
 assert.equal(view.confirmationCount,141);assert.deepEqual(Object.values(view.summaries).map(summary=>summary.sampleN),[96,96,96]);assert.ok(view.rows.every(r=>!r.third||['Third','Final'].includes(r.third.estimate)));
});

test('unknown stage labels stay exceptional and never inherit an accidental routine group',()=>{
 const view=buildGdpRevisionMatrix({releases:[fact('unknown','2026-01-01','constructor','2026-04-30',0)]});
 assert.equal(view.rows[0].advance,null);assert.equal(view.rows[0].exceptions[0].estimate,'constructor');assert.equal(view.summaries.secondMinusAdvance.sampleN,0);
});

test('reversed or same-day stage dates are not routine revision opportunities',()=>{
 const view=buildGdpRevisionMatrix({releases:[fact('a','2026-01-01','Advance','2026-05-01',1),fact('s','2026-01-01','Second','2026-04-30',2),fact('t','2026-01-01','Third','2026-05-01',3)]});
 assert.equal(view.rows[0].revisions.secondMinusAdvance,null);assert.equal(view.rows[0].revisions.thirdMinusAdvance,null);assert.equal(view.rows[0].revisions.thirdMinusSecond,1);
});

test('matching unsupported YoY or unadjusted endpoint metadata cannot create GDP SAAR revision statistics',()=>{
 for(const metadata of [{unit:'Percent change from corresponding quarter one year ago'},{frequency:'Annual'},{adjustment:'Unadjusted'}]){
  const archive={releases:[fact('bad-a','2026-01-01','Advance','2026-04-30',1,metadata),fact('bad-s','2026-01-01','Second','2026-05-28',2,metadata)]};
  const view=buildGdpRevisionMatrix(archive);assert.equal(view.summaries.secondMinusAdvance.sampleN,0);assert.equal(view.rows[0].revisions.secondMinusAdvance,null);assert.equal(view.rows[0].latestMinusFirstPp,null);assert.equal(view.rows[0].advance.id,'bad-a');
  assert.match(gdpRevisionMatrixPanel(archive),/Unsupported GDP measurement metadata/i);
  const [header,values]=parseCsv(gdpRevisionMatrixCsv(archive));const csvRow=Object.fromEntries(header.map((key,index)=>[key,values[index]]));assert.equal(csvRow.advance_measurement_eligible,'false');assert.equal(csvRow.advance_published_value,'1');assert.equal(csvRow.second_minus_advance_pp,'');assert.equal(csvRow.advance_unit,archive.releases[0].unit);
 }
});

test('CSV evidence bytes survive frozen JSON key canonicalization without changing any input facts',async()=>{
 const {researchJsonCopy}=await import('../src/research-workspaces.js');
 assert.equal(gdpRevisionMatrixCsv({releases},{cutoff:'2024-09-26'}),gdpRevisionMatrixCsv(researchJsonCopy({releases}),{cutoff:'2024-09-26'}));
});

test('frozen matrix panel shows a fixed cutoff with no live publication inputs or action hooks',()=>{
 const html=gdpRevisionMatrixPanel({releases},{cutoff:'2024-09-26',frozen:true});
 assert.match(html,/Frozen publication cutoff: 2024-09-26/);assert.doesNotMatch(html,/id="publication-cutoff"|data-export-gdp-matrix|data-pin-gdp-matrix/);assert.match(html,/Preliminary/);
});
