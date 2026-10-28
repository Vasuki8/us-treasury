import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPceBaseEffects,pceBaseEffectsView,pceBaseEffectsCsv,pceBaseEffectsContext} from '../src/pce-base-effects.js';
const source=(rows)=>({id:'pceIndex',code:'DPCERG',name:'Headline PCE price index',unit:'Index, 2017=100',frequency:'Monthly',adjustment:'Seasonally adjusted',sourceUrl:'https://apps.bea.gov/national/Release/TXT/NipaDataM.txt',source:{name:'U.S. Bureau of Economic Analysis',seriesIds:['DPCERG']},fetchedAt:'2026-10-28T02:57:57.218Z',provenance:[{url:'https://apps.bea.gov/national/Release/TXT/NipaDataM.txt',sha256:'a'.repeat(64),retrievedAt:'2026-10-28T02:57:57.218Z'}],observations:rows.map(([date,value])=>({date,value,sourceValue:String(value),publishedAt:null}))});
const base=()=>source([['2025-08-01',100],['2025-09-01',110],['2025-10-01',115],['2025-11-01',118],['2026-08-01',120]]);

test('zero future monthly inflation still changes annual inflation as the exact year-ago base rolls',()=>{
 const result=buildPceBaseEffects(base(),{monthlyRate:0,horizonMonths:3,targetAnnualRate:2});
 assert.ok(Math.abs(result.currentAnnualRate-20)<1e-10);assert.equal(result.rows[0].date,'2026-09-01');
 assert.equal(result.rows[0].assumedIndex,120);assert.equal(result.rows[0].baseDate,'2025-09-01');assert.equal(result.rows[0].baseIndex,110);
 assert.equal(result.rows[0].rollingOutBaseDate,'2025-08-01');assert.equal(result.rows[0].rollingOutBaseIndex,100);assert.ok(Math.abs(result.rows[0].rollingOutMonthlyRate-10)<1e-10);
 assert.ok(Math.abs(result.rows[0].annualRate-9.0909090909)<1e-9);
 assert.ok(result.rows[2].annualRate<result.rows[0].annualRate);assert.equal(result.rows[2].baseSourceValue,'118');
 assert.equal(result.rows[0].observationType,'modeled');assert.equal(result.rows[0].publishedAt,null);
});

test('target solver reverses compounded index arithmetic at the selected horizon rather than subtracting annual rates',()=>{
 const result=buildPceBaseEffects(base(),{monthlyRate:.2,horizonMonths:3,targetAnnualRate:2});
 const requiredIndex=118*1.02,requiredMonthly=100*((requiredIndex/120)**(1/3)-1);
 assert.ok(Math.abs(result.target.requiredIndex-requiredIndex)<1e-10);
 assert.ok(Math.abs(result.target.requiredMonthlyRate-requiredMonthly)<1e-10);
 assert.ok(Math.abs(100*((120*(1+result.target.requiredMonthlyRate/100)**3)/118-1)-2)<1e-10);
 const year=buildPceBaseEffects(base(),{monthlyRate:1,horizonMonths:12,targetAnnualRate:2});
 assert.equal(year.target.baseDate,'2026-08-01');assert.equal(year.target.baseIndex,120);
 assert.ok(Math.abs(year.target.requiredMonthlyRate-100*(1.02**(1/12)-1))<1e-10);
});

test('missing or nonpositive exact bases are unavailable; latest missing values and invalid assumptions never select an older month',()=>{
 const missing=buildPceBaseEffects(base(),{monthlyRate:.2,horizonMonths:4,targetAnnualRate:2});
 assert.equal(missing.rows[3].annualRate,null);assert.equal(missing.target.requiredMonthlyRate,null);
 const zero=base();zero.observations[1].value=0;assert.equal(buildPceBaseEffects(zero).rows[0].annualRate,null);
 const latest=base();latest.observations.push({date:'2026-09-01',value:null,sourceValue:'(NA)',publishedAt:null});assert.match(buildPceBaseEffects(latest).error,/latest/i);
 for(const assumptions of [{monthlyRate:-100},{monthlyRate:Infinity},{horizonMonths:0},{horizonMonths:13},{horizonMonths:1.5},{targetAnnualRate:-100}])assert.match(buildPceBaseEffects(base(),assumptions).error,/assumption|horizon/i);
 const bad=base();bad.id='realSpending';assert.match(buildPceBaseEffects(bad).error,/PCE price index/i);
});

test('CSV and frozen context preserve all exact baseline inputs, assumptions, source receipts and conditional labels',()=>{
 const s=base(),assumptions={monthlyRate:.1,horizonMonths:3,targetAnnualRate:2},csv=pceBaseEffectsCsv(s,assumptions),frozen=pceBaseEffectsContext(s,assumptions);
 assert.match(csv,/modeled/);assert.match(csv,/2025-09-01/);assert.match(csv,/2026-09-01/);assert.match(csv,/assumed_monthly_rate/);assert.match(csv,/target_required_monthly_rate/);assert.match(csv,/source_provenance_json/);assert.ok(csv.includes('a'.repeat(64)));
 assert.equal(frozen.model.assumptions.monthlyRate,.1);assert.equal(frozen.attachments[0].content,csv);assert.equal(frozen.attachments[0].type,'text/csv');assert.notEqual(frozen.indexSeries,s);
 s.observations[0].value=999;assert.equal(frozen.indexSeries.observations[0].value,100);
 const html=pceBaseEffectsView(base(),assumptions);assert.match(html,/Conditional/);assert.match(html,/not a forecast/i);assert.match(html,/pce-monthly-rate/);assert.match(html,/pce-target-annual/);assert.match(html,/data-chart-catalog="pceBaseEffects"/);assert.match(html,/<table/);assert.match(html,/data-export-pce-base-effects/);
 assert.match(pceBaseEffectsView(source([])),/unavailable/i);
 const frozenHtml=pceBaseEffectsView(base(),assumptions,{frozen:true});assert.doesNotMatch(frozenHtml,/<input|<select|data-export-pce-base-effects/);assert.match(frozenHtml,/Frozen assumptions/);
});
