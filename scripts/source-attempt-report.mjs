import {getFreshness} from '../src/freshness.js';

export const SOURCE_ATTEMPT_IDS=Object.freeze(getFreshness({}, {now:new Date(0)}).entries.map(entry=>entry.id));
const knownIds=new Set(SOURCE_ATTEMPT_IDS);
const invalid=()=>{throw new Error('Invalid source attempt report.');};
function timestamp(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))return null;
 const millis=Date.parse(value);
 if(!Number.isFinite(millis))return null;
 const normalized=new Date(millis).toISOString();
 return normalized===(value.includes('.')?value:value.replace('Z','.000Z'))?normalized:null;
}

/** Fixed collection evidence only; admission, publication and deployment are separate. */
export function validateSourceAttemptReport(report,{now=new Date()}={}){
 if(!(now instanceof Date)||!Number.isFinite(+now)||report?.schemaVersion!==1||!Array.isArray(report.sources)||report.sources.length>knownIds.size)invalid();
 const checkedAt=timestamp(report.checkedAt),cutoff=now.toISOString();
 if(!checkedAt||checkedAt>cutoff)invalid();
 const seen=new Set();
 const sources=report.sources.map(row=>{
  if(!row||!knownIds.has(row.id)||seen.has(row.id)||!['ok','error','unavailable','unverified'].includes(row.status))invalid();
  seen.add(row.id);
  const fetchedAt=row.fetchedAt===null?null:timestamp(row.fetchedAt),lastAttemptAt=timestamp(row.lastAttemptAt);
  if(lastAttemptAt!==checkedAt||row.fetchedAt!==null&&!fetchedAt||fetchedAt>cutoff)invalid();
  if(row.status==='ok'&&(!fetchedAt||fetchedAt<checkedAt||row.httpStatus!==null)||row.status==='unavailable'&&fetchedAt!==null)invalid();
  if(row.httpStatus!==null&&(!Number.isInteger(row.httpStatus)||row.httpStatus<100||row.httpStatus>599))invalid();
  if(typeof row.cached!=='boolean'||row.cached!==(row.status!=='ok'&&fetchedAt!==null))invalid();
  return {id:row.id,status:row.status,fetchedAt,lastAttemptAt,httpStatus:row.httpStatus,cached:row.cached};
 });
 return {schemaVersion:1,checkedAt,sources};
}

export function buildSourceAttemptReport({checkedAt,sources={},calendarSources={},attemptedDataIds=[],attemptedCalendarIds=[],now=new Date()}){
 if(!Array.isArray(attemptedDataIds)||!Array.isArray(attemptedCalendarIds))invalid();
 const attempted=[...attemptedDataIds.map(id=>({id:`data:${id}`,source:sources[id]})),...attemptedCalendarIds.map(id=>({id:`calendar:${id}`,source:calendarSources[id]}))];
 const rows=attempted.map(({id,source})=>{
  const captured=timestamp(source?.fetchedAt),fetchedAt=captured&&captured<=now.toISOString()?captured:null;
  // Collection reporting must not reject an otherwise valid retained response.
  // An old/missing capture cannot establish new successful retrieval either.
  const status=source?.status==='ok'&&(!fetchedAt||fetchedAt<timestamp(checkedAt))?'unverified':source?.status;
  const httpStatus=source?.failure?.kind==='http'&&Number.isInteger(source.failure.status)&&source.failure.status>=100&&source.failure.status<=599?source.failure.status:null;
  return {id,status,fetchedAt,lastAttemptAt:source?.lastAttemptAt,httpStatus,cached:status!=='ok'&&fetchedAt!==null};
 });
 return validateSourceAttemptReport({schemaVersion:1,checkedAt,sources:rows},{now});
}
