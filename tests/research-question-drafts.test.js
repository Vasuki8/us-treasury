import test from 'node:test';
import assert from 'node:assert/strict';
import {createResearchLibrary} from '../src/research-library.js';
import {createWorkspace} from '../src/research-workspaces.js';
import {createResearchPackage} from '../src/research-packages.js';
import {researchPage} from '../src/research-page.js';
import {series,releases} from '../src/data.js';
let api;try{api=await import('../src/question-drafts.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const use=()=>{assert.ok(api,'Question drafts must survive editor replacement');return api;};
const question={hypothesis:'Prior question',supportingSeriesIds:['unrate'],contradictingSeriesIds:['payroll'],reviewDate:'2026-11-01',reviewEvent:'',conditions:[{seriesId:'unrate',operator:'>=',value:5},{seriesId:'payroll',operator:'<',value:160000}]};
const workspace=()=>createWorkspace({id:'draft-study',name:'Draft study',state:{page:'labor'},researchQuestion:question});
const storage=()=>{const values=new Map();return{values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};};
const open=store=>createResearchLibrary(store,{locks:{request:async(_key,_options,callback)=>callback()},indexedDB:null});

test('all draft fields and extra condition rows remain rendered after a field validation failure',()=>{
 const drafts=use().createQuestionDrafts(),entry=drafts.get('draft-study',question);
 Object.assign(entry.draft,{hypothesis:'Unfinished <hypothesis>',supportSearch:'unemployment',contradictSearch:'jobs',reviewDate:'2026-12-02',reviewEvent:'Unretained event'});
 entry.draft.conditions[1].value='';
 const result=use().validateQuestionDraft(entry.draft,{catalog:series,events:releases});
 assert.equal(result.ok,false);assert.match(result.errors['condition-value-1'],/threshold/i);
 drafts.failed('draft-study',result);
 const html=researchPage({researchView:'workspaces'},{library:{workspaces:[workspace()]},questionDrafts:drafts.snapshot()});
 for(const text of ['Unfinished &lt;hypothesis&gt;','value="unemployment"','value="jobs"','value="2026-12-02"','value="Unretained event"','question-condition-value-1-draft-study','aria-invalid="true"'])assert.ok(html.includes(text),text);
 assert.match(html,/<details[^>]*data-page-disclosure="research:workspace:draft-study:question"[^>]* open/);
 assert.deepEqual(drafts.get('draft-study').draft,entry.draft);
});

test('saved question reviews remain available while measurement forms are created only for explicit editing',()=>{
 const row=workspace(),drafts=use().createQuestionDrafts(),context={library:{workspaces:[row]},questionDrafts:drafts.snapshot()};
 let html=researchPage({researchView:'workspaces'},context);
 assert.ok(html.includes('Prior question'));assert.ok(html.includes('Frozen baseline unavailable'));assert.match(html,/data-edit-question="draft-study"/);assert.doesNotMatch(html,/data-question-picker|data-question-editor/);
 drafts.edit(row.id,row.researchQuestion);drafts.get(row.id).draft.hypothesis='Unfinished draft';context.questionDrafts=drafts.snapshot();html=researchPage({researchView:'workspaces'},context);
 assert.match(html,/data-question-editor="draft-study"/);assert.match(html,/value="Unfinished draft"/);assert.match(html,/data-close-question="draft-study"/);
 drafts.close(row.id);html=researchPage({researchView:'workspaces'},{...context,questionDrafts:drafts.snapshot()});assert.doesNotMatch(html,/data-question-picker|data-question-editor/);
 drafts.edit(row.id,row.researchQuestion);assert.equal(drafts.get(row.id).draft.hypothesis,'Unfinished draft');
});

test('evidence limit validates the union of all roles without dropping selected measurements',()=>{
 const draft=use().createQuestionDrafts().get('draft-study',question).draft;
 draft.supportingSeriesIds=['unrate','payroll'];draft.contradictingSeriesIds=['claims','gdp'];draft.conditions=[{seriesId:'sofr',operator:'>=',value:'4'}];
 const before=structuredClone(draft),result=use().validateQuestionDraft(draft,{catalog:series});
 assert.equal(result.ok,false);assert.match(result.errors.support,/five|5/);assert.equal(result.focusField,'support');assert.deepEqual(draft,before);
 draft.conditions[0].seriesId='unrate';assert.equal(use().validateQuestionDraft(draft,{catalog:series}).ok,true,'A measurement repeated across roles counts once');
});

test('readable retained measurement and event choices resolve to unchanged native question data',()=>{
 const catalog={a:{name:'Native reading',unit:'Percent',source:{name:'Official agency'}}},events=[{id:'event-a',name:'Release review',date:'2026-11-02'}];
 const draft=use().createQuestionDrafts().get('draft-study',{hypothesis:'A question',conditions:[]}).draft;
 draft.conditions=[{seriesId:use().measurementChoice('a',catalog.a),operator:'>=',value:'4.25'}];draft.reviewEvent=use().reviewEventChoice(events[0]);
 const result=use().validateQuestionDraft(draft,{catalog,events});
 assert.equal(result.ok,true);assert.deepEqual(result.selected,['a']);assert.deepEqual(result.question.conditions,[{seriesId:'a',operator:'>=',value:4.25}]);assert.equal(result.question.reviewEvent,'event-a');
});

test('invalid threshold text stays editable and is never reinterpreted as another numeric notation',()=>{
 const drafts=use().createQuestionDrafts(),draft=drafts.get('draft-study',question).draft;draft.conditions[0].value='0x10';
 const result=use().validateQuestionDraft(draft,{catalog:series});assert.equal(result.ok,false);assert.match(result.errors['condition-value'],/threshold/);
 drafts.failed('draft-study',result);const html=researchPage({researchView:'workspaces'},{library:{workspaces:[workspace()]},questionDrafts:drafts.snapshot()});
 assert.match(html,/data-question-condition-field="value" type="text" inputmode="decimal" value="0x10"/);
 draft.conditions[0].value='1e-3';assert.equal(use().validateQuestionDraft(draft,{catalog:series}).question.conditions[0].value,.001);
});

test('a durable question write failure preserves the prior saved question, baseline and draft',async()=>{
 const store=storage(),library=await open(store),baseline=await createResearchPackage({name:'Old baseline',state:{selected:['unrate'],window:'all'}});
 await library.pinPackage(baseline);const original=createWorkspace({...workspace(),now:workspace().createdAt,researchQuestion:{...question,baselinePackageId:baseline.id}});await library.saveWorkspace(original);const savedBaseline=library.getPackage(baseline.id);
 const drafts=use().createQuestionDrafts(),draft=drafts.get(original.id,original.researchQuestion).draft;draft.hypothesis='Unsaved question';draft.conditions[1].value='155000';
 const before=structuredClone(draft),write=store.setItem;
 store.setItem=(key,value)=>{if(JSON.parse(value).workspaces.some(row=>row.researchQuestion?.hypothesis==='Unsaved question')){const error=Error('Full');error.name='QuotaExceededError';throw error;}write(key,value);};
 const result=await use().saveResearchQuestion({library,workspace:original,draft,createPackage:createResearchPackage,catalog:series,events:releases});
 assert.equal(result.ok,false);assert.equal(result.stage,'storage');assert.match(result.message,/previous|prior/i);assert.deepEqual(library.getWorkspace(original.id),original);assert.equal(library.getPackage(baseline.id),savedBaseline);assert.deepEqual(draft,before);
 assert.equal(library.getState().durability.workspaces[original.id].status,'durable');
});

test('baseline-generation errors keep the draft and saved record while successful saves freeze every selected role',async()=>{
 const library=await open(storage()),original=workspace();await library.saveWorkspace(original);
 const draft=use().createQuestionDrafts().get(original.id,original.researchQuestion).draft,before=structuredClone(draft);
 const failure=await use().saveResearchQuestion({library,workspace:original,draft,createPackage:async()=>{throw Error('Source unavailable');},catalog:series});
 assert.equal(failure.ok,false);assert.equal(failure.stage,'baseline');assert.match(failure.message,/Source unavailable/);assert.deepEqual(draft,before);assert.deepEqual(library.getWorkspace(original.id),original);
 const result=await use().saveResearchQuestion({library,workspace:original,draft,createPackage:createResearchPackage,catalog:series});
 assert.equal(result.ok,true);const saved=library.getWorkspace(original.id),pkg=library.getPackage(saved.researchQuestion.baselinePackageId);
 assert.deepEqual(pkg.request.ids,['unrate','payroll']);assert.deepEqual(saved.researchQuestion.conditions,question.conditions);
});

test('editor DOM capture retains searches, all conditions and an unchecked evidence role',()=>{
 const fields={hypothesis:'Working question',support:[],contradict:['gdp'],'support-search':'search a','contradict-search':'search b','review-date':'2026-12-01','review-event':'Event draft'};
 const condition=[{seriesId:'unrate',operator:'>=',value:'0'},{seriesId:'payroll',operator:'<',value:''}];
 const editor={dataset:{questionEditor:'draft-study'},querySelector:selector=>({value:fields[/data-question-field="([^"]+)"/.exec(selector)?.[1]]??''}),querySelectorAll:selector=>selector==='[data-question-condition]'?condition.map(row=>({querySelector:selector=>({value:row[/data-question-condition-field="([^"]+)"/.exec(selector)[1]]})})):fields[/data-question-role="([^"]+)"/.exec(selector)?.[1]]?.map(value=>({value}))??[]};
 const drafts=use().createQuestionDrafts();drafts.get('draft-study',question);drafts.capture({querySelectorAll:()=>[editor]});
 assert.deepEqual(drafts.get('draft-study').draft,{hypothesis:'Working question',supportingSeriesIds:[],contradictingSeriesIds:['gdp'],supportSearch:'search a',contradictSearch:'search b',reviewDate:'2026-12-01',reviewEvent:'Event draft',conditions:condition});
 drafts.addCondition('draft-study');assert.equal(drafts.get('draft-study').draft.conditions.length,3);drafts.removeCondition('draft-study',0);assert.equal(drafts.get('draft-study').draft.conditions[0].seriesId,'payroll');
});

test('filtering a measurement picker keeps hidden selections and announces the matching count',()=>{
 const rows=[{textContent:'Unemployment rate Percent BLS',hidden:false,checked:true},{textContent:'Real GDP growth Percent BEA',hidden:false,checked:false}],status={textContent:''};
 const picker={querySelectorAll:()=>rows,querySelector:()=>status};
 use().filterQuestionPicker({value:'BEA',closest:()=>picker});
 assert.equal(rows[0].hidden,true);assert.equal(rows[0].checked,true);assert.equal(rows[1].hidden,false);assert.equal(status.textContent,'1 measurements shown');
 use().filterQuestionPicker({value:'',closest:()=>picker});assert.equal(rows[0].hidden,false);assert.equal(rows[0].checked,true);
});

test('pending and saved question states remain local to their editor without discarding a failed draft',()=>{
 const drafts=use().createQuestionDrafts(),entry=drafts.get('draft-study',question),before=structuredClone(entry.draft);
 drafts.pending('draft-study');let html=researchPage({researchView:'workspaces'},{library:{workspaces:[workspace()]},questionDrafts:drafts.snapshot()});
 assert.match(html,/aria-busy="true"/);assert.match(html,/data-save-question="draft-study" disabled/);
 drafts.failed('draft-study',{message:'Storage unavailable',errors:{},focusField:''});assert.deepEqual(entry.draft,before);
 drafts.saved('draft-study',question);html=researchPage({researchView:'workspaces'},{library:{workspaces:[workspace()]},questionDrafts:drafts.snapshot()});
 assert.match(html,/Question and frozen baseline saved/);assert.doesNotMatch(html,/aria-busy="true"/);
});
