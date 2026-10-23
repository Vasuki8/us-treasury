import test from 'node:test';
import assert from 'node:assert/strict';
import { nextCatalysts, evidenceBrief } from '../src/research-brief.js';
test('Overview catalysts exclude routine debt dates while the full event input is preserved',()=>{
 const events=[{id:'debt',sourceId:'treasury',date:'2026-10-23',name:'Debt'},{id:'jobs',sourceId:'bls',date:'2026-11-06',name:'Employment Situation'}];
 assert.deepEqual(nextCatalysts(events,{now:new Date('2026-10-22T21:00:00Z')}).map(e=>e.id),['jobs']);assert.equal(events.length,2);
});
test('a successful retrieval is not labelled a verified publication',()=>{
 const catalog={gdp:{id:'gdp',name:'GDP',frequency:'Quarterly',observations:[{date:'2026-04-01',value:2.2}],fetchedAt:'2026-10-22T20:00:00Z'}};
 const rows=evidenceBrief({catalog,sources:{bea:{fetchedAt:'2026-10-22T20:00:00Z'}}});
 assert.equal(rows[0].kind,'Latest revised observation');assert.equal(rows[0].publicationDate,null);assert.equal(rows[0].period,'2026-04-01');
});
test('an archive backfill remains a backfill and publication verification requires explicit evidence',()=>{
 const changes=[{kind:'historical-backfill',seriesId:'gdp',period:'2020-01-01',capturedAt:'2026-10-22T20:00:00Z'}];
 const rows=evidenceBrief({catalog:{},sources:{},changes});assert.equal(rows[0].kind,'Historical backfill');
 const release=evidenceBrief({catalog:{claimsAdvance:{id:'claimsAdvance',name:'Claims',frequency:'Weekly',observations:[{date:'2026-10-17',value:194}]}},sources:{dolAdvance:{status:'ok',releaseDate:'2026-10-22',provenance:[{url:'https://www.dol.gov/ui/data.pdf'}]}}});
 assert.equal(release[0].kind,'Verified published estimate');assert.equal(release[0].publicationDate,'2026-10-22');
});
