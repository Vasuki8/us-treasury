import test from 'node:test';import assert from 'node:assert/strict';
import {cp,mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {claimsPublicationArchive as archive} from '../src/claims-publication-archive.js';
import {assertClaimsPublicationData} from '../scripts/dol-publication-policy.mjs';
import {selectClaimsPublicationHistory,claimsPublicationCsv} from '../src/claims-publication-history.js';
import {buildClaimsPublicationPin} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv} from '../src/research-packages.js';
import {parseCsv} from '../scripts/sources/http.mjs';
const execute=promisify(execFile),root=fileURLToPath(new URL('../',import.meta.url));

test('canonical archive admits all168 facts with two independent weekly sequences and source-stage coverage limits',()=>{
 assertClaimsPublicationData(archive,{complete:true});assert.equal(archive.releases.length,168);
 for(const [id,start,end]of [['claimsAdvance','2026-01-03','2026-10-17'],['continuedClaimsAdvance','2025-12-27','2026-10-10']]){
  const rows=archive.releases.filter(row=>row.seriesId===id&&row.releaseStage==='advance');assert.equal(rows.length,42);assert.equal(rows[0].period,start);assert.equal(rows.at(-1).period,end);
  for(let i=1;i<rows.length;i++)assert.equal(Date.parse(rows[i].period)-Date.parse(rows[i-1].period),7*86400000);
 }
 const initial=selectClaimsPublicationHistory(archive,'claimsAdvance','2026-01-08','2026-01-03');assert.equal(initial.latest.value,208);assert.equal(initial.firstAdvance.value,208);
 const later=selectClaimsPublicationHistory(archive,'claimsAdvance','2026-01-15','2026-01-03');assert.equal(later.latest.value,207);assert.equal(later.rows[1].change,-1);
 const edge=selectClaimsPublicationHistory(archive,'claimsAdvance','2026-01-08','2025-12-27');assert.equal(edge.latest.value,200);assert.equal(edge.firstAdvance,null,'quoted old199000 is not an archived original advance');
 assert.equal(selectClaimsPublicationHistory(archive,'claimsAdvance','2026-01-07','2026-01-03').latest,null);
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
