import test from'node:test';import assert from'node:assert/strict';
import {createWorkspace,parseWorkspace}from'../src/research-workspaces.js';
let questions;try{questions=await import('../src/research-questions.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const now='2026-10-22T15:00:00.000Z';
const question={version:1,hypothesis:'Labor conditions are cooling',supportingSeriesIds:['unrate'],contradictingSeriesIds:['payroll'],baselinePackageId:'baseline-one',reviewDate:'2026-11-01',reviewEvent:'jobs-release',conditions:[{seriesId:'unrate',operator:'>=',value:5}]};
test('optional research questions survive workspace storage while old workspace records remain valid',()=>{
 const original=createWorkspace({id:'question-view',name:'Jobs question',now,state:{page:'labor'},researchQuestion:question}),restored=parseWorkspace(JSON.parse(JSON.stringify(original)));
 assert.deepEqual(restored.researchQuestion,question);assert.equal(Object.isFrozen(restored.researchQuestion.conditions),true);
 assert.equal(Object.hasOwn(parseWorkspace(createWorkspace({name:'Legacy view',now})),'researchQuestion'),false);
 assert.throws(()=>createWorkspace({name:'Bad question',now,researchQuestion:{...question,conditions:[{seriesId:'unrate',operator:'execute',value:1}]}}),/condition|operator/i);
 assert.throws(()=>createWorkspace({name:'Bad date',now,researchQuestion:{...question,reviewDate:'2026-02-31'}}),/date/i);
});
test('question return evaluation separates new periods, same-period value changes and historical backfill',()=>{
 assert.ok(questions);const item=observations=>({name:'Unemployment',unit:'Percent',observations}),baselinePackage={id:'baseline-one',catalog:{unrate:item([{date:'2026-01-01',value:4},{date:'2026-03-01',value:4.1}])}},catalog={unrate:item([{date:'2025-12-01',value:3.9},{date:'2026-01-01',value:4},{date:'2026-02-01',value:4.2},{date:'2026-03-01',value:4.3},{date:'2026-04-01',value:5.2}])};
 const result=questions.evaluateResearchQuestion(question,{catalog,baselinePackage,now:new Date('2026-11-02T12:00:00Z')});
 assert.equal(result.baselineAvailable,true);assert.equal(result.review.due,true);assert.equal(result.conditions[0].status,'met');assert.equal(result.conditions[0].value,5.2);
 assert.equal(result.conditions[0].previousValue,4.1);assert.equal(result.conditions[0].previousStatus,'not-met');assert.equal(result.conditions[0].crossed,true);assert.equal(result.conditions[0].crossing,'entered');
 assert.deepEqual(result.evidence.filter(row=>row.seriesId==='unrate').map(row=>[row.period,row.kind]),[['2025-12-01','historical-backfill'],['2026-02-01','historical-backfill'],['2026-03-01','same-period-change'],['2026-04-01','new-reference-period']]);
 const changed=result.evidence.find(row=>row.kind==='same-period-change');assert.equal(changed.previousValue,4.1);assert.equal(changed.value,4.3);assert.equal(changed.verifiedRevision,false);
 assert.match(changed.label,/observed|unverified/i);assert.equal(result.conditions[0].unit,'Percent');
});
test('missing frozen baseline and null latest readings remain unavailable, with explicit event-review timing',()=>{
 assert.ok(questions);const result=questions.evaluateResearchQuestion(question,{catalog:{unrate:{unit:'Percent',observations:[{date:'2026-10-01',value:null}]}},baselinePackage:{id:'wrong',catalog:{}},events:[{id:'jobs-release',date:'2026-10-20'}],now:new Date(now)});
 assert.equal(result.baselineAvailable,false);assert.deepEqual(result.evidence,[]);assert.equal(result.conditions[0].status,'unavailable');assert.equal(result.review.due,true);assert.equal(result.review.eventDate,'2026-10-20');
 assert.equal(result.conditions[0].previousStatus,'unavailable');assert.equal(result.conditions[0].crossed,null);
});

test('changes in measurement units are not numeric revisions or threshold crossings',()=>{
 const result=questions.evaluateResearchQuestion(question,{baselinePackage:{id:'baseline-one',catalog:{unrate:{unit:'Percent',observations:[{date:'2026-01-01',value:4}]}}},catalog:{unrate:{unit:'Index',observations:[{date:'2026-01-01',value:100}]}}});
 assert.equal(result.evidence[0].kind,'measurement-change');assert.equal(result.conditions[0].previousStatus,'unavailable');assert.equal(result.conditions[0].crossed,null);
});

test('a changed date convention or source identity makes baseline comparisons unavailable',()=>{
 for(const changed of [{dateConvention:'period-end'},{source:{name:'Different source',seriesIds:['different-id']}}]){
  const item={unit:'Percent',dateConvention:'period-start',source:{name:'Official source',seriesIds:['unrate']},observations:[{date:'2026-01-01',value:4}]};
  const result=questions.evaluateResearchQuestion(question,{baselinePackage:{id:'baseline-one',catalog:{unrate:item}},catalog:{unrate:{...item,...changed,observations:[{date:'2026-01-01',value:6}]}}});
  assert.equal(result.conditions[0].crossed,null);assert.equal(result.evidence[0].kind,'measurement-change');assert.match(result.evidence[0].label,/not directly comparable/i);
 }
});
