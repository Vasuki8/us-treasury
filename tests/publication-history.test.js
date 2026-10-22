import test from 'node:test';import assert from 'node:assert/strict';
import {selectPublicationHistory,publicationCsv,publicationContext} from '../src/publication-history.js';
const releases=[{id:'a',period:'2026-01-01',publicationDate:'2026-04-30',estimate:'Advance',value:2,unit:'Percent annualized',sourceIds:['A191RL'],provenance:[]},{id:'b',period:'2026-01-01',publicationDate:'2026-05-28',estimate:'Second',value:1.6,unit:'Percent annualized',sourceIds:['A191RL'],provenance:[]}];
test('publication-date replay selects only genuinely published estimates and never substitutes current data',()=>{
 assert.deepEqual(selectPublicationHistory({releases},'2026-04-29').releases,[]);
 const selected=selectPublicationHistory({releases},'2026-05-01');assert.equal(selected.latest.estimate,'Advance');assert.equal(selected.latest.value,2);
 assert.equal(selectPublicationHistory({releases},'2026-05-28').latest.value,1.6);assert.throws(()=>selectPublicationHistory({releases},'2026-02-30'),/date/);
 assert.match(publicationCsv({releases},'2026-05-01'),/Advance/);assert.doesNotMatch(publicationCsv({releases},'2026-05-01'),/Second/);
});

test('quarter filtering precedes cutoff selection, revision deltas and CSV even on a shared publication date',()=>{
 const archive={releases:[...releases,{...releases[1],id:'q2',period:'2026-04-01',publicationDate:'2026-07-30',estimate:'Advance',value:1.5},{...releases[0],id:'annual',publicationDate:'2026-09-30',estimate:'Revised',value:2.5},{...releases[1],id:'q2-third',period:'2026-04-01',publicationDate:'2026-09-30',estimate:'Third',value:2.2}]};
 const first=selectPublicationHistory(archive,'2026-09-30','2026-01-01');assert.equal(first.latest.value,2.5);assert.equal(first.first.value,2);assert.ok(first.releases.every(row=>row.period==='2026-01-01'));assert.equal(first.periods.length,2);
 assert.equal(selectPublicationHistory(archive,'2026-09-30','2026-04-01').latest.value,2.2);
 assert.equal(selectPublicationHistory(archive,'2026-07-29','2026-04-01').latest,null);
 assert.equal(selectPublicationHistory(archive,'2026-05-01').period,'2026-01-01');
 assert.equal(selectPublicationHistory(archive).period,'2026-04-01');
 assert.throws(()=>selectPublicationHistory(archive,'','2026-07-01'),/quarter/);
 assert.throws(()=>selectPublicationHistory(archive,'','2026-02-01'),/quarter/);
 assert.doesNotMatch(publicationCsv(archive,'2026-09-30','2026-01-01'),/2026-04-01/);
});

test('GDP closed/not-revised annotations remain confirmations and raw source evidence stays intact',()=>{
 for(const sourcePublicationDate of ['May 28, 2026 GDP not open for revision','May 28, 2026 GDP not revised']){
  const row={...releases[0],sourcePublicationDate};const status=publicationContext(row);assert.equal(status.confirmation,true);assert.match(status.label,/not.*revis/i);assert.equal(row.sourcePublicationDate,sourcePublicationDate);
 }
 assert.equal(publicationContext({...releases[0],sourcePublicationDate:'Apr 30, 2026 GDI not published'}).confirmation,false);
});

test('only the documented 2026 annual-update batch receives an annual label; other revision causes stay unknown',()=>{
 const row={...releases[0],estimate:'Revised',publicationDate:'2026-09-30',period:'2021-01-01',sourceUrl:'https://www.bea.gov/sites/default/files/2026-09/gdp-gdi-vintage-history.xlsx'};
 assert.match(publicationContext(row).label,/2026 annual update/);assert.match(publicationContext(row).evidenceUrl,/information-updates-national-regional-economic-accounts/);
 for(const change of [{period:'2020-10-01'},{period:'2026-04-01'},{publicationDate:'2025-09-25'},{sourceUrl:'https://example.com/unverified'}])assert.match(publicationContext({...row,...change}).label,/not inferred/);
});
