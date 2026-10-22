import test from 'node:test';
import assert from 'node:assert/strict';
import {publicationArchive} from '../src/publication-archive.js';

let manifest;
try{manifest=await import('../scripts/publication-explanation-scope-2023-2025.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const scope=()=>{assert.ok(manifest,'The separately reviewed earlier source manifest must exist');return manifest.publicationExplanationScope2023And2025;};
const expected=[
 ['bea-gdp-2023q1-second-2023-05-25','1.1','1.3'],['bea-gdp-2023q1-third-2023-06-29','1.3','2.0'],
 ['bea-gdp-2023q2-second-2023-08-30','2.4','2.1'],['bea-gdp-2023q2-third-2023-09-28','2.1','2.1'],
 ['bea-gdp-2023q3-second-2023-11-29','4.9','5.2'],['bea-gdp-2023q3-third-2023-12-21','5.2','4.9'],
 ['bea-gdp-2023q4-second-2024-02-28','3.3','3.2'],['bea-gdp-2023q4-third-2024-03-28','3.2','3.4'],
 ['bea-gdp-2025q1-second-2025-05-29','-0.3','-0.2'],['bea-gdp-2025q1-third-2025-06-26','-0.2','-0.5'],
 ['bea-gdp-2025q2-second-2025-08-28','3.0','3.3'],['bea-gdp-2025q2-third-2025-09-25','3.3','3.8'],
];
const releasePaths=[
 '2023/gross-domestic-product-second-estimate-corporate-profits-preliminary-estimate-first',
 '2023/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-and-gdp-industry',
 '2023/gross-domestic-product-second-quarter-2023-second-estimate-and-corporate-profits',
 '2023/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-second-quarter',
 '2023/gross-domestic-product-second-estimate-corporate-profits-preliminary-estimate-third',
 '2023/gross-domestic-product-third-estimate-corporate-profits-revised-estimate-and-gdp',
 '2024/gross-domestic-product-fourth-quarter-and-year-2023-second-estimate',
 '2024/gross-domestic-product-fourth-quarter-and-year-2023-third-estimate-gdp-industry-and',
 '2025/gross-domestic-product-second-estimate-corporate-profits-preliminary-estimate-1st-quarter',
 '2025/gross-domestic-product-1st-quarter-2025-third-estimate-gdp-industry-and-corporate-profits',
 '2025/gross-domestic-product-2nd-quarter-2025-second-estimate-and-corporate-profits-preliminary',
 '2025/gross-domestic-product-2nd-quarter-2025-third-estimate-gdp-industry-corporate-profits',
];

test('twelve earlier revision definitions match exact retained quarter/stage/date/value and prior same-quarter evidence',()=>{
 const rows=scope();assert.equal(rows.length,12);assert.equal(new Set(rows.map(row=>row.publicationId)).size,12);
 assert.deepEqual(rows.map(row=>[row.publicationId,row.previousValue,row.sourceValue]),expected);
 const retained=new Map(publicationArchive.releases.map(row=>[row.id,row]));
 for(const row of rows){
  const fact=retained.get(row.publicationId);assert.ok(fact,row.publicationId);
  for(const field of ['seriesId','period','estimate','publicationDate','sourceValue'])assert.equal(row[field],fact[field],`${row.publicationId} ${field}`);
  const previous=publicationArchive.releases.filter(item=>item.period===row.period&&item.publicationDate<row.publicationDate).sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate)).at(-1);
  assert.equal(row.previousValue,previous.sourceValue);assert.equal(row.kind,'revision');assert.equal(row.annualUpdate,null);
  assert.ok(Object.isFrozen(row));
 }
});

test('older bold Updates labels use one complete paragraph while identified headings and dated official source paths stay exact',()=>{
 const rows=scope(),paragraphIds=['bea-gdp-2023q1-second-2023-05-25','bea-gdp-2023q4-second-2024-02-28'];
 assert.deepEqual(rows.filter(row=>row.sectionHeading===null).map(row=>row.publicationId),paragraphIds);
 assert.deepEqual(rows.map(row=>row.sourceUrl),releasePaths.map(value=>'https://www.bea.gov/news/'+value));
 for(const row of rows){
  const url=new URL(row.sourceUrl);assert.equal(url.origin,'https://www.bea.gov');assert.match(url.pathname,new RegExp('^/news/'+row.publicationDate.slice(0,4)+'/[a-z0-9-]+$'));
  assert.ok(row.sourceTitle.includes('Gross Domestic Product'));
  assert.match(row.releaseDateText,/^EMBARGOED UNTIL RELEASE AT 8:30 a\.m\. E[DS]T,/);
  const date=/([A-Za-z]+) (\d{1,2}), (\d{4})$/.exec(row.releaseDateText),months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  assert.equal(`${date[3]}-${String(months.indexOf(date[1])+1).padStart(2,'0')}-${date[2].padStart(2,'0')}`,row.publicationDate);
  assert.ok(row.sourceSection);assert.ok(row.summary);assert.ok(Array.isArray(row.details));
  assert.ok(row.sourcePassages.length>=2);assert.ok(row.sectionPassages.length>=1);
  for(const passage of [...row.sourcePassages,...row.sectionPassages])assert.equal(typeof passage,'string');
  if(row.sectionHeading===null){assert.equal(row.sectionPassages.length,1);assert.match(row.sectionPassages[0],/^With the second estimate,/);assert.match(row.sourceSection,/Updates to GDP/);}
  else assert.equal(row.sectionHeading,row.period.startsWith('2023')?'Updates to GDP':'Technical Notes');
 }
});

test('equal rounded 2023Q2 GDP is an explained component revision and annual-update causes are never assigned to unrelated quarters',()=>{
 const rows=scope(),equal=rows.find(row=>row.publicationId==='bea-gdp-2023q2-third-2023-09-28');
 assert.equal(equal.previousValue,equal.sourceValue);assert.equal(equal.kind,'revision');assert.match(equal.summary,/2\.1.*2\.1|both.*2\.1/i);assert.match(equal.summary,/rounded|round/);
 assert.match(equal.summary,/consumer spending/);assert.match(equal.summary,/revision/i);assert.equal(equal.annualUpdate,null);
 const third2025=rows.find(row=>row.publicationId==='bea-gdp-2025q2-third-2025-09-25');
 assert.match(third2025.summary,/consumer spending/);assert.equal(third2025.kind,'revision');assert.equal(third2025.annualUpdate,null);
 assert.ok(rows.every(row=>!row.summary.includes('benchmark')));
});
