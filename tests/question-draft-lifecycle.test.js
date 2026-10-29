import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createQuestionDrafts} from '../src/question-drafts.js';

const app=await readFile(new URL('../src/app.js',import.meta.url),'utf8');
const from=app.indexOf('function render('),to=app.indexOf('  const inspection=',from);
assert.ok(from>=0&&to>from,'Actual render capture boundary exists');
const renderPrefix=app.slice(from,to);
const actionFrom=app.indexOf("if('questionAddCondition' in d||'questionRemoveCondition' in d)"),actionTo=app.indexOf("}else if('saveQuestion' in d)",actionFrom);
assert.ok(actionFrom>=0&&actionTo>actionFrom,'Actual condition action boundary exists');
const action=app.slice(actionFrom,actionTo)+'}';

function fixture(){
 const drafts=createQuestionDrafts();
 const question={hypothesis:'Working question',supportingSeriesIds:['unrate'],contradictingSeriesIds:['cpi'],reviewDate:'2026-11-01',reviewEvent:'',conditions:[{seriesId:'unrate',operator:'>=',value:4}]};
 drafts.edit('probe',question);
 let dom=structuredClone(drafts.get('probe').draft);
 const editor={dataset:{questionEditor:'probe'},querySelector(selector){
  const field=/data-question-field="([^"]+)"/.exec(selector)?.[1];
  const fields={hypothesis:dom.hypothesis,'support-search':dom.supportSearch,'contradict-search':dom.contradictSearch,'review-date':dom.reviewDate,'review-event':dom.reviewEvent};
  return field?{value:fields[field]??''}:null;
 },querySelectorAll(selector){
  if(selector==='[data-question-condition]')return dom.conditions.map(row=>({querySelector:selector=>({value:row[/data-question-condition-field="([^"]+)"/.exec(selector)[1]]})}));
  const role=/data-question-role="([^"]+)"/.exec(selector)?.[1];
  return (role==='support'?dom.supportingSeriesIds:role==='contradict'?dom.contradictingSeriesIds:[]).map(value=>({value}));
 }};
 const document={querySelectorAll:()=>[editor]};
 const repaint=()=>{dom=structuredClone(drafts.get('probe').draft);};
 // Execute the actual render entry (including its draft-capture option); only
 // the unrelated page output is replaced by a model of the newly rendered DOM.
 const render=new Function('questionDrafts','saveDrafts','main','document','repaint',renderPrefix+'repaint();}\nreturn render;')(drafts,{capture(){}},{},document,repaint);
 const act=new Function('d','questionDrafts','document','render',action);
 return{drafts,render,act:d=>{act(d,drafts,document,render);render({preserveFocus:true});},edit:patch=>Object.assign(dom,patch)};
}

test('actual Add and Remove Condition survive render capture and preserve other draft fields',()=>{
 const f=fixture(),before=structuredClone(f.drafts.get('probe').draft);
 f.act({questionAddCondition:'probe'});
 assert.equal(f.drafts.get('probe').draft.conditions.length,2);
 assert.deepEqual({...f.drafts.get('probe').draft,conditions:before.conditions},before);
 f.act({questionRemoveCondition:'probe',conditionIndex:'1'});
 assert.deepEqual(f.drafts.get('probe').draft,before);
});

test('ordinary incidental render still captures edits after the mutation guard',()=>{
 const f=fixture();
 f.edit({hypothesis:'Unsaved text entered just before an archive redraw',supportSearch:'Labor source'});
 f.render({preserveFocus:true});
 assert.equal(f.drafts.get('probe').draft.hypothesis,'Unsaved text entered just before an archive redraw');
 assert.equal(f.drafts.get('probe').draft.supportSearch,'Labor source');
});
