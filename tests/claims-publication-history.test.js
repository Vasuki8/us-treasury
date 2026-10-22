import test from 'node:test';import assert from 'node:assert/strict';
import {selectPublicationHistory,publicationCsv} from '../src/publication-history.js';
import {claimsFixture} from './helpers/claims-publications-fixture.js';
import {parseCsv} from '../scripts/sources/http.mjs';
let api;try{api=await import('../src/claims-publication-history.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const use=()=>{assert.ok(api,'Claims publication adapter must exist');return api;};
test('optional publication selection filters the measurement before periods, cutoffs and latest values',()=>{
 const result=selectPublicationHistory(claimsFixture(),'2026-03-26','2026-03-07',{seriesId:'claimsAdvance',periodLabel:'week'});
 assert.equal(result.releases.length,2);assert.ok(result.releases.every(row=>row.seriesId==='claimsAdvance'));assert.equal(result.latest.value,201);
});
test('claims replay distinguishes original advance from an earliest retained prior and excludes future facts/notices',()=>{
 const archive=claimsFixture(),{selectClaimsPublicationHistory:select}=use();
 const before=select(archive,'claimsAdvance','2026-03-11','2026-03-07');assert.equal(before.latest,null);assert.equal(before.firstAdvance,null);assert.deepEqual(before.rows,[]);
 const first=select(archive,'claimsAdvance','2026-03-12','2026-03-07');assert.equal(first.firstAdvance.value,200);assert.equal(first.rows.length,1);assert.equal(first.rows[0].publication.seasonalAdjustmentNote,null);
 const prior=select(archive,'claimsAdvance','2026-01-08','2025-12-27');assert.equal(prior.firstAdvance,null);assert.equal(prior.latest.estimate,'Unrevised prior');
 const latest=select(archive,'continuedClaimsAdvance','2026-03-26','2026-03-07');assert.equal(latest.latest.value,1700);assert.equal(latest.rows[1].change,0);assert.equal(latest.rows[1].comparable,true);
 assert.equal(select(archive,'claimsAdvance','2026-03-26').period,'2026-03-14');assert.equal(select(archive,'continuedClaimsAdvance','2026-03-26').period,'2026-03-07');
 assert.throws(()=>select(archive,'gdp'),/measurement|series/i);assert.throws(()=>select(archive,'claimsAdvance','2026-02-30'),/date/i);
});
test('source-noted seasonal changes remain explicit without attributing later routine revisions to an annual update',()=>{
 const {selectClaimsPublicationHistory:select}=use(),archive=claimsFixture();
 const crossing=select(archive,'claimsAdvance','2026-03-19','2026-03-07');assert.equal(crossing.rows[1].change,null);assert.equal(crossing.rows[1].comparable,false);assert.match(crossing.rows[1].comparisonNote,/seasonal/i);
 const later=select(archive,'claimsAdvance','2026-03-26','2026-03-14');assert.equal(later.rows[1].change,1);assert.equal(later.rows[1].publication.seasonalAdjustmentNote,null);assert.doesNotMatch(later.rows[1].comparisonNote,/caused by|explained by/i);
});
test('claims CSV is scoped to one series/week/cutoff with raw roles, receipts, unknown instants and source notices',()=>{
 const csv=use().claimsPublicationCsv(claimsFixture(),'claimsAdvance','2026-03-19','2026-03-07'),[headers,...rows]=parseCsv(csv);
 assert.equal(rows.length,2);const get=(row,key)=>row[headers.indexOf(key)];
 assert.ok(rows.every(row=>get(row,'series_id')==='claimsAdvance'&&get(row,'reference_week')==='2026-03-07'));
 assert.deepEqual(rows.map(row=>get(row,'release_stage')),['advance','prior-week-revised']);assert.deepEqual(rows.map(row=>get(row,'source_value')),['200000','201000']);
 assert.ok(rows.every(row=>get(row,'publication_date_precision')==='day'&&get(row,'publication_instant')===''));
 assert.match(get(rows[1],'seasonal_adjustment_note'),/annual/);assert.match(get(rows[1],'provenance_json'),/2026-10-22T22:00:00/);assert.match(get(rows[0],'license_url'),/dol.gov/);
 assert.doesNotMatch(csv,/continuedClaimsAdvance|2026-03-26/);
 const gdp={releases:[{seriesId:'gdp',period:'2026-01-01',publicationDate:'2026-04-30',estimate:'Advance',value:2,unit:'Percent',sourceIds:['A191RL'],provenance:[]}]};assert.equal(publicationCsv(gdp),publicationCsv(gdp,'2026-04-30','2026-01-01'));
});
