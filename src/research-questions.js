import {parseResearchQuestion,deepFreeze,canonicalJson}from'./research-workspaces.js';
export {parseResearchQuestion};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const operators={'>':(a,b)=>a>b,'>=':(a,b)=>a>=b,'<':(a,b)=>a<b,'<=':(a,b)=>a<=b,'==':(a,b)=>a===b,'!=':(a,b)=>a!==b};
const comparable=(previous,current)=>['unit','frequency','adjustment','measure','observationType','dateConvention','periodType','definition'].every(key=>(previous?.[key]??null)===(current?.[key]??null))&&(previous?.source?.name??null)===(current?.source?.name??null)&&canonicalJson(previous?.source?.seriesIds??[])===canonicalJson(current?.source?.seriesIds??[]);

/** Explicit comparisons of retained inputs; no score, causality or forecast. */
export function evaluateResearchQuestion(input,{catalog={},baselinePackage,events=[],now=new Date()}={}){
 const question=parseResearchQuestion(input),baselineAvailable=Boolean(question.baselinePackageId&&baselinePackage?.id===question.baselinePackageId&&baselinePackage.catalog),evidence=[];
 const today=now.toISOString().slice(0,10),event=events.find(row=>row.id===question.reviewEvent),eventDate=event?.date??'';
 const ids=[...new Set([...question.supportingSeriesIds,...question.contradictingSeriesIds,...question.conditions.map(row=>row.seriesId)])];
 if(baselineAvailable)for(const seriesId of ids){
  const previous=baselinePackage.catalog[seriesId],current=catalog[seriesId];if(!previous||!current)continue;
  if(!comparable(previous,current)){evidence.push({seriesId,kind:'measurement-change',period:current.observations?.at(-1)?.date??'',label:'Measurement metadata changed; values are not directly comparable',previousValue:null,value:null,unit:current.unit??'',verifiedRevision:false,retrievedAt:current.fetchedAt??null});continue;}
  const rows=previous.observations??[],byDate=new Map(rows.map(row=>[row.date,row])),last=rows.at(-1)?.date;
  for(const row of current.observations??[]){
   const prior=byDate.get(row.date);if(prior&&prior.value===row.value)continue;
   const kind=prior?'same-period-change':last&&row.date>last?'new-reference-period':'historical-backfill';
   evidence.push({seriesId,role:question.supportingSeriesIds.includes(seriesId)?'supporting':question.contradictingSeriesIds.includes(seriesId)?'contradicting':'condition',period:row.date,kind,label:kind==='same-period-change'?'Observed same-period value change; official revision unverified':kind==='new-reference-period'?'New reference period':'Historical backfill',previousValue:prior?.value??null,value:row.value,unit:current.unit??'',verifiedRevision:false,retrievedAt:current.fetchedAt??null});
  }
 }
 const conditions=question.conditions.map(condition=>{
  const item=catalog[condition.seriesId],row=item?.observations?.at(-1),available=finite(row?.value),previous=baselineAvailable?baselinePackage.catalog[condition.seriesId]:null,prior=previous?.observations?.at(-1);
  const status=available?(operators[condition.operator](row.value,condition.value)?'met':'not-met'):'unavailable',previousStatus=finite(prior?.value)&&comparable(previous,item)?(operators[condition.operator](prior.value,condition.value)?'met':'not-met'):'unavailable',crossed=status==='unavailable'||previousStatus==='unavailable'?null:status!==previousStatus;
  return{...condition,threshold:condition.value,value:row?.value??null,unit:item?.unit??'',observationDate:row?.date??null,retrievedAt:item?.fetchedAt??null,status,previousValue:prior?.value??null,previousObservationDate:prior?.date??null,previousStatus,crossed,crossing:crossed?(status==='met'?'entered':'exited'):null};
 });
 return deepFreeze({baselineAvailable,review:{due:Boolean(question.reviewDate&&question.reviewDate<=today||eventDate&&eventDate<=today),date:question.reviewDate,event:question.reviewEvent,eventDate},conditions,evidence});
}
