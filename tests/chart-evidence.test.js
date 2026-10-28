import test from 'node:test';
import assert from 'node:assert/strict';
import {maturityYears,observationEvidence} from '../src/chart-evidence.js';
test('elapsed maturity reflects one year versus thirty years, not a tenor category index',()=>{
 assert.equal(maturityYears('1M'),1/12);assert.equal(maturityYears('1.5M'),0.125);assert.equal(maturityYears('18M'),1.5);assert.equal(maturityYears('30Y'),30);
 assert.equal((maturityYears('10Y')-maturityYears('5Y'))/(maturityYears('2Y')-maturityYears('1Y')),5);
 assert.throws(()=>maturityYears('unknown'));
});
test('ordinary source footnotes, preliminary flags and dated breaks remain inspectable',()=>{
 const s={methodologyBreaks:[{date:'2021-12-06',from:'old',to:'new'}]};
 assert.deepEqual(observationEvidence(s,{date:'2020-01-01',footnotes:['preliminary','source note']}),['preliminary','source note']);
 assert.match(observationEvidence(s,{date:'2022-01-01',preliminary:true}).join(';'),/Preliminary.*2021-12-06/);
 assert.match(observationEvidence({id:'fedTreasuryHoldings'},{date:'1951-12-31'}).join(';'),/Annual year-end.*H.4.1/);
});
test('real-curve input breaks never label nominal yields or nominal slope curves',()=>{
 const breaks=[{date:'2008-12-01',kind:'real',from:'all TIPS',to:'recent TIPS'},{date:'2021-12-06',from:'Hermite',to:'monotone convex'}];
 const nominal=observationEvidence({id:'yield',methodologyBreaks:breaks},{date:'2026-10-26'}).join(';');
 assert.doesNotMatch(nominal,/TIPS/);assert.match(nominal,/2021-12-06/);
 const real=observationEvidence({id:'realYield10',methodologyBreaks:breaks},{date:'2026-10-26'}).join(';');
 assert.match(real,/TIPS/);assert.match(real,/2021-12-06/);
});
