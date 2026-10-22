import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationArchive} from '../src/publication-archive.js';
import {publicationExplanationScope2024} from '../scripts/publication-explanation-scope-2024.mjs';

const expected=[
 ['bea-gdp-2024q1-second-2024-05-30','1.6','1.3','2024/gross-domestic-product-first-quarter-2024-second-estimate-and-corporate-profits'],
 ['bea-gdp-2024q1-third-2024-06-27','1.3','1.4','2024/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-and-gdp-industry'],
 ['bea-gdp-2024q2-second-2024-08-29','2.8','3.0','2024/gross-domestic-product-second-estimate-corporate-profits-preliminary-estimate-second'],
 ['bea-gdp-2024q2-third-2024-09-26','3.0','3.0','2024/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-and-gdp-0'],
 ['bea-gdp-2024q3-second-2024-11-27','2.8','2.8','2024/gross-domestic-product-third-quarter-2024-second-estimate-and-corporate-profits'],
 ['bea-gdp-2024q3-third-2024-12-19','2.8','3.1','2024/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-and-gdp-1'],
 ['bea-gdp-2024q4-second-2025-02-27','2.3','2.3','2025/gross-domestic-product-4th-quarter-and-year-2024-second-estimate'],
 ['bea-gdp-2024q4-third-2025-03-27','2.3','2.4','2025/gross-domestic-product-4th-quarter-and-year-2024-third-estimate-gdp-industry-and'],
];
test('eight 2024 definitions identify exact retained releases and prior estimates for the same quarter',()=>{
 assert.equal(publicationExplanationScope2024.length,8);assert.deepEqual(publicationExplanationScope2024.map(row=>row.publicationId),expected.map(row=>row[0]));
 for(const [index,definition]of publicationExplanationScope2024.entries()){
  const [id,previous,current,route]=expected[index],release=publicationArchive.releases.find(row=>row.id===id);assert.ok(release);
  const prior=publicationArchive.releases.filter(row=>row.period===release.period&&row.publicationDate<release.publicationDate).sort((a,b)=>b.publicationDate.localeCompare(a.publicationDate))[0];
  assert.equal(definition.previousValue,previous);assert.equal(definition.previousValue,prior.sourceValue);assert.equal(release.sourceValue,current);
  assert.equal(definition.sourceUrl,'https://www.bea.gov/news/'+route);assert.equal(definition.kind,'revision');assert.equal(definition.annualUpdate,null);assert.equal(definition.slug,undefined);
  assert.match(definition.summary,new RegExp(current.replace('.','\\.')+'%'));
  const date=definition.releaseDateText.match(/(?:Monday|Tuesday|Wednesday|Thursday|Friday), (.+)$/)?.[1];
  assert.equal(new Date(date+' 00:00:00 GMT').toISOString().slice(0,10),release.publicationDate);
 }
});

test('unchanged rounded rates retain documented component revisions without invented precision or annual causes',()=>{
 const unchanged=publicationExplanationScope2024.filter((row,index)=>expected[index][1]===expected[index][2]);assert.equal(unchanged.length,3);
 assert.ok(unchanged.every(row=>row.kind==='revision'&&/round|remain/.test(row.summary)));
 const fourth=unchanged.find(row=>row.publicationId.includes('2024q4'));assert.match(fourth.summary,/upward revision of less than 0\.1 percentage point/);
 const annualDay=publicationExplanationScope2024.find(row=>row.publicationId==='bea-gdp-2024q2-third-2024-09-26');
 assert.equal(annualDay.annualUpdate,null);assert.doesNotMatch(annualDay.summary,/annual update|benchmark/i);
 assert.match(annualDay.summary,/inventory investment/);assert.match(annualDay.summary,/federal government/);
});

test('historical paragraphs and inline technical notes use bounded evidence contracts and plain paraphrases',()=>{
 for(const [index,row]of publicationExplanationScope2024.entries()){
  assert.equal(row.sectionHeading,index<6?null:'Technical Notes');
  assert.match(row.sourceSection,index<6?/^News release \/ Updates to GDP$/:/^Technical Notes \/ Sources of revisions/);
  assert.ok(row.sourceTitle.length>20&&row.sourceTitle.length<180);assert.ok(row.summary.length>40&&row.summary.length<650);
  assert.ok(Array.isArray(row.details)&&row.details.length>0&&row.details.length<=3);
  assert.ok(row.sourcePassages.length>=2&&row.sourcePassages.every(text=>typeof text==='string'&&text.length>20));
  assert.ok(row.sectionPassages.length>0&&row.sectionPassages.every(text=>typeof text==='string'&&text.length>30));
  if(index<6){assert.equal(row.sectionPassages.length,1);assert.match(row.sectionPassages[0],/For information on updates to GDP/);}
  assert.ok([row.summary,...row.details].every(text=>typeof text==='string'&&!/[<>]/.test(text)));
  assert.ok(row.details.every(text=>!row.sectionPassages.includes(text)),'Visible details are paraphrases, not copied source paragraphs');
 }
});
