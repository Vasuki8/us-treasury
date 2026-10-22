import test from 'node:test';import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
import {researchPage} from '../src/research-page.js';
import {createWorkspace} from '../src/research-workspaces.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {series} from '../src/data.js';

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
