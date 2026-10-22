import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationArchive} from '../src/publication-archive.js';
import {publicationExplanations} from '../src/publication-explanations.js';
import {publicationExplanationScopeUpdates} from '../scripts/publication-explanation-scope-updates.mjs';

const expected=[
 ['bea-gdp-2023q1-revised-2023-09-28','2.0','2.2','comprehensive-update','bea-gdp-2023q2-third-2023-09-28'],
 ['bea-gdp-2024q1-revised-2024-09-26','1.4','1.6','annual-update','bea-gdp-2024q2-third-2024-09-26'],
 ['bea-gdp-2025q1-revised-2025-09-25','-0.5','-0.6','annual-update','bea-gdp-2025q2-third-2025-09-25'],
];
test('three first-quarter update definitions match exact retained facts, predecessors and already-reviewed release pages',()=>{
 assert.equal(publicationExplanationScopeUpdates.length,3);assert.deepEqual(publicationExplanationScopeUpdates.map(row=>row.publicationId),expected.map(row=>row[0]));
 for(const [index,row]of publicationExplanationScopeUpdates.entries()){
  const [id,previous,current,kind,existingSourceId]=expected[index],fact=publicationArchive.releases.find(row=>row.id===id);assert.ok(fact);
  for(const key of ['seriesId','period','estimate','publicationDate','sourceValue'])assert.equal(row[key],fact[key]);
  const prior=publicationArchive.releases.filter(item=>item.period===row.period&&item.publicationDate<row.publicationDate).sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate)).at(-1);
  assert.equal(row.estimate,'Revised');assert.equal(row.sourceValue,current);assert.equal(row.previousValue,previous);assert.equal(row.previousValue,prior.sourceValue);assert.equal(row.kind,kind);
  const retainedPage=publicationExplanations.explanations.find(item=>item.publicationId===existingSourceId);assert.ok(retainedPage);assert.equal(row.sourceUrl,retainedPage.sourceUrl);assert.equal(row.sourceTitle,retainedPage.sourceTitle);
  assert.ok(row.sourcePassages.includes('Real GDP '+previous+' '+current));
  assert.match(row.releaseDateText,new RegExp(row.publicationDate.slice(0,4)+'$'));
 }
});

test('quarter-specific evidence contracts distinguish comprehensive and annual updates without propagating general coverage',()=>{
 for(const row of publicationExplanationScopeUpdates){
  assert.equal(row.annualUpdate,null);assert.match(row.sourceSection,/Updates for the First Quarter of/);
  assert.ok(row.sourcePassages.some(passage=>passage.includes(row.kind==='comprehensive-update'?'comprehensive update':'annual update')));
  assert.equal(row.sectionPassages.length,1);assert.match(row.sectionPassages[0],new RegExp('^For the first quarter of '+row.period.slice(0,4)+','));
  assert.doesNotMatch(row.sectionPassages[0],/Gross Domestic Income|wages|QCEW|reference year|first quarter of 2013/i);
  assert.ok(row.details.length>0&&row.details.every(text=>typeof text==='string'&&!/[<>]/.test(text)));
  assert.match(row.summary,new RegExp(row.kind==='comprehensive-update'?'comprehensive update':'annual update'));
 }
 assert.deepEqual(publicationExplanationScopeUpdates.map(row=>row.sectionHeading),[null,'Updates for the First Quarter of 2024',null]);
});

test('summaries retain the specific source-named offsets and the negative-growth revision direction',()=>{
 const [comprehensive,annual,negative]=publicationExplanationScopeUpdates;
 assert.match(comprehensive.summary,/2\.0% to 2\.2%/);assert.match(comprehensive.summary,/nonresidential fixed investment/);assert.match(comprehensive.summary,/lower consumer spending/);
 assert.match(annual.summary,/1\.4% to 1\.6%/);assert.match(annual.summary,/consumer spending/);assert.match(annual.summary,/private inventory investment and residential fixed investment/);
 assert.match(negative.summary,/-0\.5% to -0\.6%/);assert.match(negative.summary,/lowered/);assert.match(negative.summary,/investment, government spending and exports/);assert.match(negative.summary,/higher consumer spending/);
 assert.match(negative.details.join(' '),/imports upward/);
});
