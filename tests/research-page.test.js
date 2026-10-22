import test from 'node:test';import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
import {researchPage} from '../src/research-page.js';
import {createWorkspace} from '../src/research-workspaces.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {series} from '../src/data.js';
import {publicationArchive} from '../src/publication-archive.js';

test('research routes preserve library views and bounded package/cutoff context',()=>{
 const route=parseRoute('#/research?view=packages&package=sample-1');assert.equal(route.page,'research');assert.equal(route.researchView,'packages');assert.equal(route.packageId,'sample-1');
 assert.equal(parseRoute(routeFor(route)).packageId,'sample-1');
 assert.equal(parseRoute('#/research?view=bad&package=%3Cscript%3E').researchView,'workspaces');assert.equal(parseRoute('#/research?package=%3Cscript%3E').packageId,'');
});
test('library explains editable versus frozen research and escapes user labels',()=>{
 const state=parseRoute('#/research'),record=createWorkspace({name:'My <workspace>',state:{...state,page:'explore'}});
 const html=researchPage(state,{library:{workspaces:[record],packages:[],sessionOnly:true,warning:'Quota <warning>'}});
 assert.match(html,/My &lt;workspace&gt;/);assert.match(html,/latest snapshot/);assert.match(html,/frozen|immutable/i);assert.match(html,/session-only/);assert.match(html,/data-open-workspace/);assert.match(html,/type="file"/);
});
test('frozen viewer shows captured inputs, exact observations and original export actions',async()=>{
 const pkg=await createResearchPackage({name:'Pinned <GDP>',state:{...parseRoute('#/series/gdp?window=all'),selected:['gdp']},catalog:series,context:{attachments:[]}});
 const html=researchPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{workspaces:[],packages:[pkg]}});
 for(const text of ['Pinned &lt;GDP&gt;','READ-ONLY','Checksum','does not authenticate','source','CSV','JSON','Frozen'])assert.ok(html.includes(text),text);
 assert.match(html,/data-package-csv/);assert.match(html,/data-package-json/);assert.match(html,/data-chart/);assert.match(html,/Captured by|retrieval/i);
});

test('validated imported packages render null and non-object supplementary context as inert evidence',async()=>{
 for(const moduleSources of [{missing:null,note:'Unverified <claim>',legacy:[null,'Archived note']},null,'Unverified <claim>']){
  const created=await createResearchPackage({name:'Imported context',state:{selected:['gdp'],range:1},context:{moduleSources}});
  const pkg=await importResearchPackage(exportResearchPackage(created));
  const html=researchPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[pkg]}});
  assert.match(html,/READ-ONLY/);assert.match(html,/data-package-json/);assert.doesNotMatch(html,/<claim>/);
  if(moduleSources)assert.match(html,/Unverified &lt;claim&gt;/);
 }
});
test('change view exposes archive loading/errors and differentiates capture evidence from releases',()=>{
 const state={...parseRoute('#/research?view=changes')};
 const html=researchPage(state,{library:{},changes:{status:'error',error:'HTTP <503>',ids:['gdp']},checkpoint:{enabled:false,since:'2026-10-21T12:00:00.000Z'}});
 assert.match(html,/HTTP &lt;503&gt;/);assert.match(html,/data-retry-changes/);assert.match(html,/not.*release|does not.*release/i);assert.match(html,/data-enable-changes/);
});

test('publication view has a quarter selector, respects unavailable cutoffs and labels GDP confirmations',()=>{
 const row={id:'one',period:'2025-01-01',publicationDate:'2025-04-30',estimate:'Advance',value:1,unit:'Percent',sourceIds:['A191RL'],releaseEvidenceUrl:'https://www.bea.gov/workbook.xlsx',provenance:[{retrievedAt:'2026-10-22T12:00:00.000Z'}]};
 const publicationArchive={releases:[row,{...row,id:'two',publicationDate:'2025-05-30',estimate:'Revised',sourcePublicationDate:'May 30, 2025 GDP not open for revision'}]};
 const state={...parseRoute('#/research?view=publications'),publicationPeriod:'2025-01-01',publicationCutoff:'2025-05-30'};
 const html=researchPage(state,{publicationArchive});assert.match(html,/id="publication-period" aria-label="Reference quarter"/);assert.match(html,/Q1 2025/);assert.match(html,/GDP not open for revision/);assert.match(html,/confirmation/i);assert.doesNotMatch(html,/2026 Q1, Advance/);
 const unavailable=researchPage({...state,publicationCutoff:'2025-04-29'},{publicationArchive});assert.match(unavailable,/No selected publication/);assert.match(unavailable,/data-pin-publication disabled/);
 const loading=researchPage(state,{publicationState:{status:'loading'}});assert.match(loading,/Loading.*publication/i);
 const error=researchPage(state,{publicationState:{status:'error',error:'HTTP <503>'}});assert.match(error,/HTTP &lt;503&gt;/);assert.match(error,/data-retry-publications/);
 assert.equal(parseRoute(routeFor(state)).publicationPeriod,state.publicationPeriod);
});

test('publication explanations are dated, scoped, attributed and separate from calculated differences',()=>{
 const row=publicationArchive.releases[2],publicationExplanations={version:1,explanations:[{publicationId:row.id,seriesId:row.seriesId,period:row.period,estimate:row.estimate,publicationDate:row.publicationDate,kind:'revision',summary:'Reviewed <revision> summary.',details:['Official source detail.'],annualUpdate:null,sourceUrl:row.releaseEvidenceUrl,sourceTitle:'Dated release',sourceSection:'Sources of revisions',licenseUrl:row.licenseUrl,attribution:row.attribution,provenance:[{retrievedAt:'2026-10-22T18:00:00.000Z',sha256:'a'.repeat(64)}]}]};
 const state=parseRoute('#/research?view=publications&period=2026-01-01&publishedBy=2026-06-25');
 const html=researchPage(state,{publicationArchive,publicationExplanations,explanationState:{status:'ready'}});
 for(const text of ['BEA REVISION EXPLANATIONS','Reviewed &lt;revision&gt; summary.','Official source detail.','Source: U.S. Bureau of Economic Analysis.','2026-10-22T18:00:00.000Z','data-export-publication-explanations','2026-06-25','not reviewed'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/<revision>/);assert.match(html,/paraphrase/i);
 const early=researchPage({...state,publicationCutoff:'2026-05-28'},{publicationArchive,publicationExplanations,explanationState:{status:'ready'}});
 assert.doesNotMatch(early,/Reviewed &lt;revision&gt;/);assert.match(early,/No reviewed BEA explanation/);
});

test('explanation loading and errors do not suppress publication observations and offer independent retry',()=>{
 const state=parseRoute('#/research?view=publications&period=2026-01-01&publishedBy=2026-06-25');
 const loading=researchPage(state,{publicationArchive,explanationState:{status:'loading'}});
 assert.match(loading,/2\.1%/);assert.match(loading,/Loading.*explanations/i);
 const error=researchPage(state,{publicationArchive,explanationState:{status:'error',error:'HTTP <503>'}});
 assert.match(error,/2\.1%/);assert.match(error,/HTTP &lt;503&gt;/);assert.match(error,/data-retry-publication-explanations/);assert.doesNotMatch(error,/data-export-publication-explanations[^>]*>CSV/);
});

test('pinned explanations remain readable frozen evidence and malformed imported context stays inert',async()=>{
 const row=publicationArchive.releases[2],entry={publicationId:row.id,period:row.period,estimate:row.estimate,publicationDate:row.publicationDate,summary:'Captured BEA explanation.',sourceUrl:row.releaseEvidenceUrl};
 const make=async(publicationExplanations,publicationExplanationStatus='ready')=>{
  const pkg=await importResearchPackage(exportResearchPackage(await createResearchPackage({name:'Pinned evidence',state:{selected:['gdp'],range:1},context:{publicationExplanations,publicationExplanationStatus}})));
  return researchPage({...parseRoute('#/research?view=packages'),packageId:pkg.id},{library:{packages:[pkg]}});
 };
 const html=await make([entry]);assert.match(html,/FROZEN BEA EXPLANATIONS/);assert.match(html,/<p>Captured BEA explanation\.<\/p>/);assert.match(html,/retained|not authenticated/i);
 for(const malformed of [null,'<script>',[null,1,'x',{summary:'<img src=x>',period:null}]])assert.match(await make(malformed),/READ-ONLY/);
 for(const patch of [{attribution:{toString:null}},{sourceSection:{toString:null}},{provenance:[{retrievedAt:{toString:null}}]},{details:[{toString:null}]},{annualUpdate:{summary:{toString:null}}}])assert.match(await make([{...entry,...patch}]),/READ-ONLY/);
 assert.match(await make([entry],{toString:null}),/Capture status: Unavailable/);
});
