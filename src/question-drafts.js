import {parseResearchQuestion} from './research-questions.js';
import {isIsoDate} from './date-window.js';

export const measurementChoice=(id,item)=>`${item?.name??id} · ${item?.unit??'Unit unavailable'} · ${item?.source?.name??'Source unavailable'} · ${id}`;
export const reviewEventChoice=event=>`${event.name??event.title??event.id} · ${event.date??'Date unavailable'} · ${event.id}`;
export const resolveMeasurementChoice=(value,catalog)=>Object.hasOwn(catalog,value)?value:Object.entries(catalog).find(([id,item])=>measurementChoice(id,item)===value)?.[0];
export const questionFieldId=(id,field)=>`question-${field}-${id}`;
const blankCondition=()=>({seriesId:'',operator:'>=',value:''});
const toDraft=(question={})=>({hypothesis:question.hypothesis??'',supportingSeriesIds:[...(question.supportingSeriesIds??[])],contradictingSeriesIds:[...(question.contradictingSeriesIds??[])],supportSearch:'',contradictSearch:'',reviewDate:question.reviewDate??'',reviewEvent:question.reviewEvent??'',conditions:question.conditions?.length?question.conditions.map(row=>({...row,value:String(row.value)})):[blankCondition()]});

/** Session drafts are separate from validated, serialized research records. */
export function createQuestionDrafts(){
 const entries=new Map();
 const get=(id,question)=>{if(!entries.has(id))entries.set(id,{draft:toDraft(question),editing:false,status:'idle',errors:{},message:'',focusField:''});return entries.get(id);};
 return{
  get,
  edit(id,question){get(id,question).editing=true;},
  close(id){const entry=get(id);if(entry.status!=='pending')entry.editing=false;},
  capture(root){for(const editor of root.querySelectorAll?.('[data-question-editor]')??[]){const entry=get(editor.dataset.questionEditor);if(entry.status!=='pending')entry.draft=readQuestionDraft(editor);}},
  pending(id){Object.assign(get(id),{editing:true,status:'pending',errors:{},message:'Freezing evidence and saving your question…',focusField:''});},
  failed(id,result){Object.assign(get(id),{editing:true,status:'error',errors:result.errors??{},message:result.message??'Question could not be saved. Your draft is preserved.',focusField:result.focusField??''});},
  saved(id,question){const entry=get(id);Object.assign(entry,{editing:true,status:'saved',errors:{},message:'Question and frozen baseline saved.',focusField:''});if(question)entry.draft={...toDraft(question),supportSearch:entry.draft.supportSearch,contradictSearch:entry.draft.contradictSearch};},
  addCondition(id){const entry=get(id);if(entry.draft.conditions.length<20)entry.draft.conditions.push(blankCondition());},
  removeCondition(id,index){const entry=get(id);entry.draft.conditions.splice(index,1);if(!entry.draft.conditions.length)entry.draft.conditions.push(blankCondition());},
  snapshot:()=>Object.fromEntries(entries),
 };
}

export function readQuestionDraft(editor){
 const value=field=>editor.querySelector(`[data-question-field="${field}"]`)?.value??'';
 const ids=role=>[...editor.querySelectorAll(`[data-question-role="${role}"]:checked`)].map(input=>input.value);
 return{hypothesis:value('hypothesis'),supportingSeriesIds:ids('support'),contradictingSeriesIds:ids('contradict'),supportSearch:value('support-search'),contradictSearch:value('contradict-search'),reviewDate:value('review-date'),reviewEvent:value('review-event'),conditions:[...editor.querySelectorAll('[data-question-condition]')].map(row=>Object.fromEntries(['seriesId','operator','value'].map(field=>[field,row.querySelector(`[data-question-condition-field="${field}"]`)?.value??''])))};
}

/** Filtering only hides rows; checked controls remain in the draft and union. */
export function filterQuestionPicker(input){
 const picker=input.closest('[data-question-picker]');if(!picker)return;
 const query=input.value.trim().toLocaleLowerCase();let visible=0;
 for(const row of picker.querySelectorAll('[data-question-choice]')){row.hidden=!row.textContent.toLocaleLowerCase().includes(query);if(!row.hidden)visible++;}
 const status=picker.querySelector('[data-question-matches]');if(status)status.textContent=`${visible} measurements shown`;
}

export function validateQuestionDraft(draft,{catalog={},events=[]}={}){
 const errors={},conditions=[],conditionIds=[],support=[...(draft.supportingSeriesIds??[])],contradict=[...(draft.contradictingSeriesIds??[])];
 const hypothesis=draft.hypothesis?.trim()??'';
 if(!hypothesis||hypothesis.length>1000||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(hypothesis))errors.hypothesis='Enter a readable question or hypothesis, up to 1,000 characters.';
 for(const [role,ids]of [['support',support],['contradict',contradict]])if(ids.some(id=>!Object.hasOwn(catalog,id)))errors[role]='A selected measurement is unavailable. Remove it or choose a retained measurement.';
 if(draft.reviewDate&&!isIsoDate(draft.reviewDate))errors['review-date']='Choose a valid review date.';
 const eventValue=draft.reviewEvent?.trim()??'',event=events.find(row=>row.id===eventValue||reviewEventChoice(row)===eventValue);
 if(eventValue&&!event)errors['review-event']='Choose a retained review event from the suggestions, or clear this optional field.';
 for(const [index,row]of (draft.conditions??[]).entries()){
  const suffix=index?`-${index}`:'',seriesValue=row.seriesId?.trim()??'',threshold=String(row.value??'').trim(),validThreshold=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(threshold)&&Number.isFinite(Number(threshold));
  if(!seriesValue&&!threshold)continue;
  const seriesId=resolveMeasurementChoice(seriesValue,catalog);
  if(seriesId)conditionIds.push(seriesId);
  if(!seriesId)errors[`condition-series${suffix}`]='Choose a retained measurement for this condition.';
  if(!['>','>=','<','<=','==','!='].includes(row.operator))errors[`condition-op${suffix}`]='Choose a supported comparison operator.';
  if(!validThreshold)errors[`condition-value${suffix}`]='Enter a finite numeric threshold in the measurement’s native unit.';
  if(seriesId&&validThreshold)conditions.push({seriesId,operator:row.operator,value:Number(threshold)});
 }
 const selected=[...new Set([...support,...contradict,...conditionIds])];
 if(selected.length<1||selected.length>4)errors.support=`Choose one to four unique measurements across supporting, contradicting and condition roles. You selected ${selected.length}; remove selections to fit the limit.`;
 let question;
 if(!Object.keys(errors).length)try{question=parseResearchQuestion({version:1,hypothesis,supportingSeriesIds:support,contradictingSeriesIds:contradict,baselinePackageId:'',reviewDate:draft.reviewDate??'',reviewEvent:event?.id??'',conditions});}catch(error){errors.hypothesis=error.message;}
 const focusField=Object.keys(errors)[0]??'';
 return{ok:!focusField,question,selected,errors,focusField,message:focusField?'Correct the highlighted fields. All draft values are preserved.':''};
}

export async function saveResearchQuestion({library,workspace,draft,createPackage,catalog={},events=[]}){
 const result=validateQuestionDraft(draft,{catalog,events});if(!result.ok)return{...result,stage:'validation'};
 let stage='baseline';
 try{
  const pkg=await createPackage({name:`${workspace.name.slice(0,60)} · question baseline`,state:{...workspace.state,page:'explore',exploreMode:'compare',selected:result.selected,comparison:'native',transform:'level',alignment:'exact'},catalog,context:{researchQuestion:result.question,scope:'Complete retained histories for the explicitly selected question evidence. Roles and thresholds are the researcher’s hypotheses, not agency interpretations.'}});
  const baseline=await library.pinPackage(pkg);
  if(!baseline.ok||!baseline.persisted)return{ok:false,stage,errors:{},focusField:'',message:'The frozen baseline could not be stored. Your draft and previous saved question and baseline are preserved. Free browser research storage or retry when storage is available.'};
  stage='storage';
  const question={...result.question,baselinePackageId:pkg.id},saved=await library.saveWorkspace({...workspace,researchQuestion:question},{requireDurable:true});
  if(!saved.ok||!saved.persisted)return{ok:false,stage,errors:{},focusField:'',message:'The question could not be stored. Your draft and previous saved question and baseline are preserved. Retry after freeing browser research storage or resolving another-tab changes.'};
  return{ok:true,question:saved.record.researchQuestion,package:pkg,errors:{},focusField:'',message:'Question and frozen baseline saved.'};
 }catch(error){return{ok:false,stage,errors:{},focusField:'',message:`${stage==='baseline'?'Frozen baseline generation':'Question storage'} failed: ${error.message}. Your draft and previous saved question and baseline are preserved. Retry when the source or storage is available.`};}
}
