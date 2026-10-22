import test from 'node:test';import assert from 'node:assert/strict';
import {selectPublicationHistory,publicationCsv} from '../src/publication-history.js';
const releases=[{id:'a',period:'2026-01-01',publicationDate:'2026-04-30',estimate:'Advance',value:2,unit:'Percent annualized',sourceIds:['A191RL'],provenance:[]},{id:'b',period:'2026-01-01',publicationDate:'2026-05-28',estimate:'Second',value:1.6,unit:'Percent annualized',sourceIds:['A191RL'],provenance:[]}];
test('publication-date replay selects only genuinely published estimates and never substitutes current data',()=>{
 assert.deepEqual(selectPublicationHistory({releases},'2026-04-29').releases,[]);
 const selected=selectPublicationHistory({releases},'2026-05-01');assert.equal(selected.latest.estimate,'Advance');assert.equal(selected.latest.value,2);
 assert.equal(selectPublicationHistory({releases},'2026-05-28').latest.value,1.6);assert.throws(()=>selectPublicationHistory({releases},'2026-02-30'),/date/);
 assert.match(publicationCsv({releases},'2026-05-01'),/Advance/);assert.doesNotMatch(publicationCsv({releases},'2026-05-01'),/Second/);
});
