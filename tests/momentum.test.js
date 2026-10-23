import test from 'node:test';
import assert from 'node:assert/strict';
import { annualizedMomentum, consecutiveAverage, addMomentumSeries } from '../src/momentum.js';
import { toCsv } from '../src/model.js';
import { series } from '../src/data.js';
import { parseCsv } from '../scripts/sources/http.mjs';
const row=(month,value)=>({date:`2026-${String(month).padStart(2,'0')}-01`,value,publishedAt:null});
test('short-horizon inflation uses exact SA index endpoints and annualization, not annual inflation averages',()=>{
 const rows=[row(1,100),row(2,100.5),row(3,101),row(4,102),row(7,104)];
 assert.ok(Math.abs(annualizedMomentum(rows,3).find(r=>r.date==='2026-04-01').value-100*(1.02**4-1))<1e-10);
 assert.ok(Math.abs(annualizedMomentum(rows,6).at(-1).value-100*(1.04**2-1))<1e-10);
 assert.equal(annualizedMomentum(rows,3)[0].value,null);
 assert.equal(annualizedMomentum([row(1,0),row(4,102)],3).at(-1).value,null);
 assert.equal(annualizedMomentum([row(1,null),row(4,102)],3).at(-1).value,null);
 assert.throws(()=>annualizedMomentum(rows,4),/3 or 6/);
});
test('payroll average requires all three exact consecutive monthly job-change observations',()=>{
 assert.equal(consecutiveAverage([row(1,100),row(2,200),row(3,300)],3).at(-1).value,200);
 assert.equal(consecutiveAverage([row(1,100),row(3,300),row(4,400)],3).at(-1).value,null);
 assert.equal(consecutiveAverage([row(1,100),row(2,null),row(3,300)],3).at(-1).value,null);
});
test('derived capture preserves immutable inputs, provenance context and exact input dates',()=>{
 const source={id:'bea',fetchedAt:'2026-10-22T20:00:00Z',series:{pceIndex:{sourceIds:['DPCERG'],sourceUrl:'https://apps.bea.gov/national/Release/TXT/NipaDataM.txt',observations:[row(1,100),row(4,102)]}},provenance:[{sha256:'source-hash'}]};
 const saved=JSON.stringify(source),result=addMomentumSeries(source);
 assert.equal(JSON.stringify(source),saved);assert.equal(result.series.pceAnnualized3m.observationType,'calculated');
 assert.deepEqual(result.series.pceAnnualized3m.observations.at(-1).inputDates,['2026-01-01','2026-04-01']);
 assert.deepEqual(result.provenance,source.provenance);assert.equal(result.series.pceAnnualized3m.observations.at(-1).publishedAt,null);
});
test('momentum CSV retains exact formula inputs, not only the derived rate',()=>{
 const [header,...rows]=parseCsv(toCsv(['pceAnnualized3m'],{range:1}));
 assert.ok(header.includes('input_dates_json'));assert.ok(header.includes('input_values_json'));
 assert.deepEqual(JSON.parse(rows[0][header.indexOf('input_dates_json')]),series.pceAnnualized3m.observations.at(-1).inputDates);
 assert.deepEqual(JSON.parse(rows[0][header.indexOf('input_values_json')]),series.pceAnnualized3m.observations.at(-1).inputValues);
});
