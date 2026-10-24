import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {releaseMeasurements,selectReleaseEvidence,matchReleaseEvidence} from '../src/release-evidence.js';
import {createPublicationController} from '../src/publication-controller.js';

test('CPI published monthly measurement has its own evidence contract',()=>{
 assert.equal(releaseMeasurements.cpiMonthly?.adjustment,'Seasonally adjusted');
 assert.equal(releaseMeasurements.cpi?.adjustment,'Not seasonally adjusted');
});
test('CPI routes load CPI evidence independently from GDP and claims',async()=>{
 const archive={version:1,releases:[]};let route={page:'indicator',seriesId:'cpiMonthly'};
 const controller=createPublicationController({getRoute:()=>route,onChange:()=>{},gdpLoader:{load:()=>{throw Error('GDP route leak');}},claimsLoader:{load:()=>{throw Error('claims route leak');}},cpiLoader:{load:async()=>archive}});
 controller.sync(route);await new Promise(resolve=>setImmediate(resolve));
 assert.equal(controller.context('cpiMonthly').status,'ready');
 assert.equal(controller.context('cpiMonthly').archive,archive);
});

test('reviewed CPI parser binds headers, roles, periods and published strings',async()=>{
 const {parseCpiPublication}=await import('../scripts/sources/cpi-publications.mjs');
 const text=await readFile(new URL('./fixtures/cpi-2026-10-table-a.html',import.meta.url),'utf8');
 const provenance={url:'https://www.bls.gov/news.release/archives/cpi_10142026.htm',sha256:'a'.repeat(64),retrievedAt:'2026-10-24T01:00:00.000Z',lastModified:null};
 const archive=parseCpiPublication(text,{provenance});
 assert.equal(archive.releases.length,6);
 assert.deepEqual(archive.releases.filter(row=>row.releaseStage==='published').map(row=>[row.seriesId,row.value]),[['cpiMonthly',0.6],['cpiCoreMonthly',0.3],['cpi',3.7],['cpiCore',2.6]]);
 const result=selectReleaseEvidence(archive,{seriesId:'cpiMonthly'});
 assert.equal(result.status,'verified');assert.equal(result.sameReleasePrior.value,0.4);assert.equal(result.sameReleasePrior.period,'2026-08-01');assert.equal(result.priorRevision,null);
 assert.equal(selectReleaseEvidence(archive,{seriesId:'cpi'}).sameReleasePrior,null);
 assert.equal(matchReleaseEvidence({sourceId:'bls',program:'consumer-price-index',date:'2026-10-14'},archive,{seriesId:'cpi'}).status,'verified');
 for(const changed of [text.replace('Seasonally adjusted changes from preceding month','Not seasonally adjusted changes from preceding month'),text.replace('Sep.<br />2026','Aug.<br />2026'),text.replace('cpi_pressa.r.1 cpi_pressa.h.1.2 cpi_pressa.h.2.8"><span class="datavalue">0.6','cpi_pressa.r.1 cpi_pressa.h.1.2 cpi_pressa.h.2.8"><span class="datavalue">0.7'),text.replace('All items</p>','All households</p>')])assert.throws(()=>parseCpiPublication(changed,{provenance}),/CPI/);
 const cell=/<td headers="cpi_pressa.r.1 cpi_pressa.h.1.2 cpi_pressa.h.2.8">[^]*?<\/td>/.exec(text)[0];
 assert.throws(()=>parseCpiPublication(text.replace(cell,cell+cell),{provenance}),/CPI/);
 assert.throws(()=>parseCpiPublication(text,{provenance:{...provenance,url:provenance.url+'?copy=1'}}),/CPI/);
});

test('CPI capture appends once, retains original receipts and fails closed',async()=>{
 const {captureCpiPublicationArchive,captureCpiPublicationFile}=await import('../scripts/capture-cpi-publications.mjs');
 const {cpiPublicationArchive}=await import('../src/cpi-publication-archive.js');
 assert.equal(await captureCpiPublicationArchive({previous:cpiPublicationArchive,collect:()=>{throw Error('must not refetch');}}),cpiPublicationArchive);
 const previous={version:1,releases:cpiPublicationArchive.releases.slice(0,6)};
 const result=await captureCpiPublicationArchive({previous,collect:async({ids})=>({version:1,releases:cpiPublicationArchive.releases.filter(row=>ids.includes(row.id))})});
 assert.deepEqual(result.releases.slice(0,6),previous.releases);assert.equal(result.releases.length,54);
 await assert.rejects(captureCpiPublicationArchive({previous,collect:async()=>({version:1,releases:[]})}),/incomplete/);
 const dir=await mkdtemp(path.join(os.tmpdir(),'cpi-capture-')),target=path.join(dir,'archive.js');
 try{const original='export const cpiPublicationArchive = '+JSON.stringify(previous)+';\n';await writeFile(target,original);await writeFile(target+'.lock','');await assert.rejects(captureCpiPublicationFile({target}),/lock/);assert.equal(await readFile(target,'utf8'),original);await rm(target+'.lock');await assert.rejects(captureCpiPublicationFile({target,collect:async()=>{throw Error('source unavailable');}}),/source unavailable/);assert.equal(await readFile(target,'utf8'),original);
  const appended=await captureCpiPublicationFile({target,collect:async({ids})=>({version:1,releases:cpiPublicationArchive.releases.filter(row=>ids.includes(row.id))})});assert.equal(appended.captured,true);assert.deepEqual(appended.archive.releases.slice(0,6),previous.releases);
  const completeText=await readFile(target,'utf8');assert.equal((await captureCpiPublicationFile({target,collect:()=>{throw Error('complete file must not refetch');}})).captured,false);assert.equal(await readFile(target,'utf8'),completeText);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('CPI history cutoff preserves same-month differences and CSV evidence',async()=>{
 const {selectCpiPublicationHistory,cpiPublicationCsv}=await import('../src/cpi-publication-history.js');
 const {cpiPublicationArchive}=await import('../src/cpi-publication-archive.js');
 const early=selectCpiPublicationHistory(cpiPublicationArchive,{seriesId:'cpiMonthly',period:'2026-08-01',cutoff:'2026-09-11'});
 assert.equal(early.latest.value,0.4);assert.equal(early.releases.length,1);
 const later=selectCpiPublicationHistory(cpiPublicationArchive,{seriesId:'cpiMonthly',period:'2026-08-01',cutoff:'2026-10-14'});
 assert.equal(later.rows[1].change,0);assert.equal(later.rows[1].publication.releaseStage,'prior-month');
 const csv=cpiPublicationCsv(cpiPublicationArchive,{seriesId:'cpi',period:'2026-09-01'});
 assert.match(csv,/3.7/);assert.match(csv,/Not seasonally adjusted/);assert.match(csv,/source_cells_json/);assert.match(csv,/Bureau of Labor Statistics/);
});

test('CPI loader failure, retry, and rendering retain honest publication status and units',async()=>{
 const {createCpiPublicationLoader}=await import('../src/cpi-publication-loader.js');
 const {cpiPublicationView}=await import('../src/cpi-publication-view.js');
 const {cpiPublicationArchive}=await import('../src/cpi-publication-archive.js');
 let calls=0;const loader=createCpiPublicationLoader({importModule:async()=>{if(++calls===1)throw Error('archive offline');return {cpiPublicationArchive};}});
 await assert.rejects(loader.load(),/offline/);await assert.rejects(loader.load(),/offline/);assert.equal(calls,1);
 assert.equal(await loader.load({retry:true}),cpiPublicationArchive);
 assert.match(cpiPublicationView({publicationSeries:'cpi'},{publicationState:{status:'error',error:'archive offline'}}),/archive offline/);
 const html=cpiPublicationView({publicationSeries:'cpi',publicationPeriod:'2026-09-01'},{archive:cpiPublicationArchive});
 assert.match(html,/3.7%/);assert.match(html,/Not seasonally adjusted/);assert.match(html,/data-export-publications/);assert.match(html,/source strings/);assert.doesNotMatch(html,/thousand/);
});

test('CPI upkeep does not treat a current index capture as a verified release',async()=>{
 const {getReleaseRefreshPlan}=await import('../src/release-operations.js');
 const event={sourceId:'bls',program:'consumer-price-index',date:'2026-10-14',scheduledAt:'2026-10-14T12:30:00.000Z'};
 const snapshot={releases:[event],sources:{bls:{status:'ok',fetchedAt:'2026-10-14T13:00:00.000Z',releaseDate:'2026-10-14',series:{cpiMonthly:{observations:[{date:'2026-09-01',value:0.61}]}}}}};
 const result=getReleaseRefreshPlan(snapshot,{now:new Date('2026-10-14T13:10:00Z')});assert.deepEqual(result.sources,['bls']);assert.equal(result.events[0].evidenceStatus,'unverified');
});

test('CPI retains the applicable Table A missing-data notice and February seasonal-factor notice',async()=>{
 const {cpiPublicationArchive}=await import('../src/cpi-publication-archive.js');
 const january=cpiPublicationArchive.releases.find(row=>row.seriesId==='cpiMonthly'&&row.period==='2026-01-01'&&row.releaseStage==='published');
 assert.ok(january.footnotes.some(note=>note.includes('Oct and Nov 2025')));
 assert.ok(january.footnotes.some(note=>note.includes('February 13, 2026')&&note.includes('previous 5 years')));
 const september=cpiPublicationArchive.releases.find(row=>row.seriesId==='cpiMonthly'&&row.period==='2026-09-01');
 assert.ok(!september.footnotes.some(note=>note.includes('Oct and Nov 2025')));
});

test('CPI evidence rejects altered cell mappings and joins coverage and briefs only to its own family',async()=>{
 const {cpiPublicationArchive}=await import('../src/cpi-publication-archive.js');
 const {dailyBrief}=await import('../src/research-brief.js');
 const {releaseCoverage}=await import('../src/release-coverage.js');
 const row=cpiPublicationArchive.releases.find(row=>row.seriesId==='cpiMonthly'&&row.period==='2026-09-01');
 assert.equal(selectReleaseEvidence({releases:[{...row,sourceCells:{...row.sourceCells,column:'cpi_pressa.h.1.9'}}]},{seriesId:'cpiMonthly'}).status,'unavailable');
 assert.equal(selectReleaseEvidence({releases:[{...row,adjustment:'Not seasonally adjusted'}]},{seriesId:'cpiMonthly'}).status,'unavailable');
 const context={cpi:{status:'ready',archive:cpiPublicationArchive}};
 const brief=dailyBrief({publicationContexts:context});assert.equal(brief.publications.length,4);assert.equal(brief.publicationStates.cpi,'ready');assert.ok(brief.publications.every(row=>row.publicationDate==='2026-10-14'));
 const catalog={cpiMonthly:{name:'Monthly CPI',agency:'bls',frequency:'Monthly',observations:[{date:'2026-09-01',value:0.61}]}};
 const coverage=releaseCoverage(catalog,{}, {seriesIds:['cpiMonthly'],events:[],publicationContexts:context,now:new Date('2026-10-24')});assert.equal(coverage[0].publication.status,'verified');
 const wrong=releaseCoverage(catalog,{}, {seriesIds:['cpiMonthly'],events:[],publicationContexts:{claims:context.cpi},now:new Date('2026-10-24')});assert.equal(wrong[0].publication.status,'unloaded');
});
