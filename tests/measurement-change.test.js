import test from 'node:test';
import assert from 'node:assert/strict';
import { measurementChange } from '../src/measurement-change.js';

const series=(extra={})=>({id:'cpi',format:'percent',unit:'Percent year over year',frequency:'Monthly',precision:1,observations:[{date:'2026-07-01',value:3},{date:'2026-09-01',value:3.2}],...extra});
test('annual inflation change names both periods and does not call a missing month monthly inflation',()=>{
 const result=measurementChange(series());
 assert.equal(result.value,0.2);assert.equal(result.unit,'Percentage points');
 assert.match(result.label,/Change in annual inflation/);
 assert.match(result.text,/Sep 2026.*Jul 2026/);
 assert.match(result.text,/previous retained observation/);
});
test('yield change scales percent to basis points once and names dates',()=>{
 const result=measurementChange(series({id:'yield',changeInBasisPoints:true,frequency:'Daily',observations:[{date:'2026-10-19',value:4},{date:'2026-10-20',value:4.12}]}));
 assert.equal(result.value,12);assert.equal(result.unit,'Basis points');assert.match(result.text,/Yield change.*12 bp.*20 Oct 2026.*19 Oct 2026/);
});
test('payroll gains change is a change in monthly gains, not employment growth',()=>{
 assert.match(measurementChange(series({id:'payroll',format:'thousands',unit:'Thousands of jobs'})).label,/Change in monthly job gains/);
 assert.match(measurementChange(series({id:'gdp'})).label,/Change in reported growth rate/);
});
test('missing latest or prior value stays unavailable and is not bridged',()=>{
 for(const observations of [[{date:'2026-01-01',value:1}],[{date:'2026-01-01',value:1},{date:'2026-02-01',value:null},{date:'2026-03-01',value:2}]]){
  const result=measurementChange(series({observations}));assert.equal(result.value,null);assert.match(result.text,/unavailable/i);
 }
});
