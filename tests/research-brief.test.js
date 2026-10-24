import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCatalysts,evidenceBrief,dailyBrief} from '../src/research-brief.js';
import {claimsFact} from './helpers/claims-publications-fixture.js';
const fact=overrides=>{const row=claimsFact(overrides);return {...row,id:`dol-${row.seriesId}-${row.period}-${row.releaseStage}-${row.publicationDate}`};};
const catalog={gdp:{id:'gdp',name:'GDP',frequency:'Quarterly',observations:[{date:'2026-04-01',value:2.2}],fetchedAt:'2026-10-22T20:00:00Z'},claimsAdvance:{id:'claimsAdvance',name:'Initial claims',observations:[{date:'2026-03-14',value:202}]},continuedClaimsAdvance:{id:'continuedClaimsAdvance',name:'Continued claims',observations:[{date:'2026-03-07',value:1700}]}};
test('Overview catalysts exclude routine debt dates while the full event input is preserved',()=>{
 const events=[{id:'debt',sourceId:'treasury',date:'2026-10-23',name:'Debt'},{id:'jobs',sourceId:'bls',date:'2026-11-06',name:'Employment Situation'}];
 assert.deepEqual(nextCatalysts(events,{now:new Date('2026-10-22T21:00:00Z')}).map(e=>e.id),['jobs']);assert.equal(events.length,2);
});
test('successful current-data retrieval and source provenance alone never verify a publication',()=>{
 const rows=evidenceBrief({catalog,sources:{dolAdvance:{status:'ok',releaseDate:'2026-03-19',provenance:[{url:'https://www.dol.gov/ui/data.pdf'}]}}});
 assert.ok(rows.some(row=>row.id==='gdp'&&row.kind==='Latest revised observation'&&row.publicationDate===null));
 assert.ok(rows.every(row=>row.category!=='publication'));
});
test('daily brief separates reviewed publications, capture changes, collection attention and revised readings',()=>{
 const release=fact({period:'2026-03-14',publicationDate:'2026-03-19'}),continued=fact({seriesId:'continuedClaimsAdvance',period:'2026-03-07',publicationDate:'2026-03-19'});
 const brief=dailyBrief({catalog,publicationContexts:{claims:{status:'ready',archive:{releases:[release,continued]}}},changes:[{kind:'historical-backfill',seriesId:'gdp',period:'2020-01-01',capturedAt:'2026-10-22T20:00:00Z'},{kind:'value-change',seriesId:'gdp',period:'2026-04-01',capturedAt:'2026-10-23T20:00:00Z'}],failures:[{id:'bls',error:'Failed collection',fetchedAt:'2026-10-23T10:00:00Z'}]});
 assert.equal(brief.publications.length,2);assert.deepEqual(brief.publications.map(row=>row.period),['2026-03-14','2026-03-07']);
 assert.equal(brief.publications[0].publicationDate,'2026-03-19');assert.equal(brief.publications[0].retrievedAt,'2026-10-22T22:00:00.000Z');
 assert.equal(brief.captures[0].kind,'Observed change between retrievals');assert.equal(brief.captures[1].kind,'Historical backfill');
 assert.equal(brief.captures[1].publicationDate,null);assert.equal(brief.attention[0].kind,'Collection problem');
 assert.ok(brief.readings.every(row=>row.category==='reading'));assert.equal(brief.publicationStates.gdp,'idle');
});
test('publication ordering uses verified publication day, never recent archive collection time',()=>{
 const newer=fact({publicationDate:'2026-03-26',period:'2026-03-21'}),older=fact({publicationDate:'2026-03-19',period:'2026-03-07',seriesId:'continuedClaimsAdvance'});
 newer.provenance[0].retrievedAt='2026-03-26T16:00:00.000Z';
 const rows=dailyBrief({catalog,publicationContexts:{claims:{status:'ready',archive:{releases:[older,newer]}}}}).publications;
 assert.equal(rows[0].id,'claimsAdvance');assert.equal(rows[1].id,'continuedClaimsAdvance');
 const unreviewed={...newer,provenance:[{url:newer.sourceUrl}]};
 assert.equal(dailyBrief({catalog,publicationContexts:{claims:{status:'ready',archive:{releases:[unreviewed]}}}}).publications.length,0);
});
