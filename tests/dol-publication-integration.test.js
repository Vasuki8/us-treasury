import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {cp,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {claimsPublicationArchive as archive} from '../src/claims-publication-archive.js';
import {assertClaimsPublicationData} from '../scripts/dol-publication-policy.mjs';
import {selectClaimsPublicationHistory,claimsPublicationCsv} from '../src/claims-publication-history.js';
import {buildClaimsPublicationPin} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv} from '../src/research-packages.js';
import {parseCsv} from '../scripts/sources/http.mjs';
const execute=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));

test('canonical archive admits all352 facts with the original 2026 weekly sequences and exact immutable prefix',()=>{
 assertClaimsPublicationData(archive,{complete:true});assert.equal(archive.releases.length,352);
 assert.equal(createHash('sha256').update(JSON.stringify(archive.releases.slice(0,168))).digest('hex'),'52b8e550fdea7e36f4051fc609ba86ef8eb4587fecffcce6f9794bb12ab98061');
 for(const [id,start,end]of [['claimsAdvance','2026-01-03','2026-10-17'],['continuedClaimsAdvance','2025-12-27','2026-10-10']]){
  const rows=archive.releases.filter(row=>row.publicationDate.startsWith('2026')&&row.seriesId===id&&row.releaseStage==='advance');assert.equal(rows.length,42);assert.equal(rows[0].period,start);assert.equal(rows.at(-1).period,end);
  for(let i=1;i<rows.length;i++)assert.equal(Date.parse(rows[i].period)-Date.parse(rows[i-1].period),7*86400000);
 }
 const initial=selectClaimsPublicationHistory(archive,'claimsAdvance','2026-01-08','2026-01-03');assert.equal(initial.latest.value,208);assert.equal(initial.firstAdvance.value,208);
 const later=selectClaimsPublicationHistory(archive,'claimsAdvance','2026-01-15','2026-01-03');assert.equal(later.latest.value,207);assert.equal(later.rows[1].change,-1);
 const edge=selectClaimsPublicationHistory(archive,'claimsAdvance','2026-01-08','2025-12-27');assert.equal(edge.latest.value,200);assert.equal(edge.firstAdvance.value,199);assert.equal(edge.firstAdvance.publicationDate,'2025-12-31','original advance now has its own verified2025 release');
 assert.equal(selectClaimsPublicationHistory(archive,'claimsAdvance','2026-01-07','2026-01-03').latest,null);
});

test('real2025 publications retain Wednesday dates, missing shutdown releases, unknown prior status and seasonal update boundaries',()=>{
 const added=archive.releases.slice(168);assert.equal(added.length,184);assert.equal(new Set(added.map(row=>row.sourceUrl)).size,46);
 assert.deepEqual([...new Set(added.map(row=>row.publicationDate))].filter(date=>new Date(date+'T00:00:00Z').getUTCDay()===3),['2025-01-08','2025-06-18','2025-11-26','2025-12-24','2025-12-31']);
 assert.ok(!added.some(row=>row.publicationDate>='2025-10-02'&&row.publicationDate<='2025-11-13'));
 for(const [id,first,last,missing]of [['claimsAdvance','2024-12-28','2025-12-27','2025-11-08'],['continuedClaimsAdvance','2024-12-21','2025-12-20','2025-11-01']]){
  const advances=added.filter(row=>row.seriesId===id&&row.releaseStage==='advance');assert.equal(advances.length,46);assert.equal(advances[0].period,first);assert.equal(advances.at(-1).period,last);
  const unknown=selectClaimsPublicationHistory(archive,id,'2025-11-20',missing);assert.equal(unknown.latest.releaseStage,'prior-week-status-unknown');assert.equal(unknown.latest.previouslyPublishedSourceValue,null);assert.equal(unknown.firstAdvance,null);assert.match(unknown.latest.footnotes.join(' '),/October 2.*November 13/);
  const scheduled=added.filter(row=>row.seriesId===id&&row.publicationDate==='2025-03-20');assert.ok(scheduled.every(row=>row.seasonalAdjustmentKind==='scheduled-update'));
  const applied=added.filter(row=>row.seriesId===id&&row.publicationDate==='2025-03-27');assert.ok(applied.every(row=>row.seasonalAdjustmentKind==='applied-update'));
  const view=selectClaimsPublicationHistory(archive,id,'2025-03-27',applied.find(row=>row.releaseStage!=='advance').period);assert.equal(view.rows.at(-1).change,null,'annual-factor crossing is not an ordinary revision');
 }
 const earliest=selectClaimsPublicationHistory(archive,'claimsAdvance','2025-01-02','2024-12-21');assert.equal(earliest.firstAdvance,null);assert.equal(earliest.latest.value,220);
 const before=selectClaimsPublicationHistory(archive,'claimsAdvance','2025-12-30','2025-12-27');assert.equal(before.latest,null);
 assert.equal(selectClaimsPublicationHistory(archive,'claimsAdvance','2025-12-31','2025-12-27').firstAdvance.value,199);
 const corrected=added.filter(row=>row.tableExtractionNote);assert.equal(corrected.length,2);assert.ok(corrected.every(row=>row.seriesId==='continuedClaimsAdvance'&&row.publicationDate==='2025-09-11'));
});
test('real weekly publication CSV and immutable pins retain source roles/dates/rights independently from current observations',async()=>{
 for(const id of ['claimsAdvance','continuedClaimsAdvance']){
  const view=selectClaimsPublicationHistory(archive,id,'2026-01-15'),csv=claimsPublicationCsv(archive,id,'2026-01-15',view.period),[headers,...rows]=parseCsv(csv);
  assert.ok(rows.length);assert.ok(rows.every(row=>row[headers.indexOf('series_id')]===id&&row[headers.indexOf('reference_week')]===view.period));
  const args=buildClaimsPublicationPin(archive,id,'2026-01-15',view.period),pkg=await createResearchPackage({name:'Archived DOL publication',...args});
  const restored=await importResearchPackage(exportResearchPackage(pkg));assert.equal(researchPackageCsv(restored),researchPackageCsv(pkg));assert.equal(restored.context.attachments[0].content,csv);
  assert.deepEqual(restored.context.publicationReleases,view.releases);assert.equal(restored.catalog[id].observations[0].publishedAt,view.latest.publicationDate);assert.ok(restored.catalog[id].licenseUrl.includes('dol.gov'));
 }
 const march=archive.releases.filter(row=>row.publicationDate==='2026-03-05'&&row.seriesId==='claimsAdvance');assert.ok(march.every(row=>row.tableExtractionNote&&row.footnotes.includes(row.tableExtractionNote)));
});
test('production build refuses an altered DOL publication fact before creating public assets',async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'meridian-dol-publication-build-'));
 t.after(async()=>{const absolute=path.resolve(directory);assert.equal(path.dirname(absolute),path.resolve(tmpdir()));assert.ok(path.basename(absolute).startsWith('meridian-dol-publication-build-'));await rm(absolute,{recursive:true,force:true});});
 for(const name of ['src','scripts','index.html','styles.css','favicon.svg','package.json'])await cp(path.join(root,name),path.join(directory,name),{recursive:true});
 const destination=path.join(directory,'src','claims-publication-archive.js'),text=await readFile(destination,'utf8');
 await writeFile(destination,text.replace('"value": 200,','"value": 999,'));
 await assert.rejects(execute(process.execPath,['scripts/build.mjs'],{cwd:directory}),error=>error.code===1&&/DOL claims publication.*value/i.test(error.stderr));
});
