import test from 'node:test';
import assert from 'node:assert/strict';
import * as brief from '../src/research-brief.js';

const series=(id,values,extra={})=>({id,name:id,unit:'Percent',format:'percent',frequency:'Monthly',precision:1,dataStatus:'official',observations:values.map(([date,value])=>({date,value})),...extra});

test('reading changes describe direction and explicit dates without claiming publication or significance',()=>{
 const catalog={unrate:series('unrate',[['2026-08-01',4.1],['2026-09-01',4.2]])};
 const [row]=brief.readingChanges(catalog,['unrate']);
 assert.equal(row.direction,'higher');assert.equal(row.delta,0.1);
 assert.equal(row.period,'Sep 2026');assert.equal(row.priorPeriod,'Aug 2026');
 assert.equal(row.publicationDate,null);assert.equal(row.category,'reading');
 assert.doesNotMatch(row.title,/significant|released|surprise|recession|today/i);
});

test('missing or nonfinite final observations never become zero or fall back to earlier readings',()=>{
 for(const value of [null,undefined,NaN,Infinity]){
  const [row]=brief.readingChanges({unrate:series('unrate',[['2026-08-01',4.1],['2026-09-01',value]])},['unrate']);
  assert.equal(row.direction,'unavailable');assert.equal(row.delta,null);assert.equal(row.period,'Sep 2026');
 }
 const [single]=brief.readingChanges({unrate:series('unrate',[['2026-09-01',4.2]])},['unrate']);
 assert.equal(single.direction,'unavailable');
});

test('gapped observations retain both comparison periods and payroll losses are not called gains',()=>{
 const [row]=brief.readingChanges({payroll:series('payroll',[['2026-06-01',100],['2026-09-01',-20]],{unit:'Thousands of jobs',format:'thousands'})},['payroll']);
 assert.equal(row.title,'Monthly payroll change decreased');assert.equal(row.period,'Sep 2026');assert.equal(row.priorPeriod,'Jun 2026');
 assert.equal(row.delta,-120);assert.doesNotMatch(row.comparison,/prior month/i);
});

test('negative payroll comparisons consistently describe changes in monthly employment change',()=>{
 for(const [prior,current,title,delta] of [[100,-20,'Monthly payroll change decreased',-120],[-100,-20,'Monthly payroll change increased',80],[-20,-20,'Monthly payroll change was unchanged',0]]){
  const [row]=brief.readingChanges({payroll:series('payroll',[['2026-08-01',prior],['2026-09-01',current]],{format:'thousands',unit:'Thousands of jobs'})},['payroll']);
  assert.equal(row.title,title);assert.equal(row.delta,delta);
 }
});

test('brief direction handles zero and stale-source warnings without implying a new release',()=>{
 const [row]=brief.readingChanges({unrate:series('unrate',[['2026-08-01',4.2],['2026-09-01',4.2]],{dataStatus:'cached',error:'Failed <source>'})},['unrate']);
 assert.equal(row.direction,'unchanged');assert.equal(row.delta,0);assert.equal(row.cached,true);assert.equal(row.warning,'Failed <source>');
 assert.deepEqual(brief.readingChanges({},['unrate']),[]);
});

test('headline percentage-point changes round visibly while retaining the exact calculated delta',()=>{
 const [row]=brief.readingChanges({pceCore:series('pceCore',[['2026-08-01',3.03],['2026-09-01',3.1167]],{unit:'Percent year over year'})},['pceCore']);
 assert.equal(row.delta,0.0867);assert.equal(row.change,'+0.09 pp');
 const [tiny]=brief.readingChanges({unrate:series('unrate',[['2026-08-01',4],['2026-09-01',4.0001]])},['unrate']);
 assert.equal(tiny.change,'+<0.01 pp');assert.equal(tiny.direction,'higher');
});
