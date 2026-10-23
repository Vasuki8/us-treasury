import {releaseEventIdentity,matchReleaseEvidence} from './release-evidence.js';

export const RELEASE_REFRESH_POLICY=Object.freeze({initialDelayMinutes:15,windowMinutes:180,objectiveMinutes:120});

/** The latest DOL PDF has an explicit release day; GDP current feeds do not. */
function sourceReleaseVerified(event,source,seriesId,archive,now){
 if(source?.status!=='ok'||!Number.isFinite(Date.parse(source.fetchedAt))||Date.parse(source.fetchedAt)<Date.parse(event.scheduledAt)||Date.parse(source.fetchedAt)>now.getTime())return false;
 if(archive&&matchReleaseEvidence(event,archive,{seriesId}).status==='verified')return true;
 if(seriesId==='gdp'||source.releaseDate!==event.date)return false;
 const measurement=source.series?.[seriesId];
 return measurement?.unit==='Thousands of claims'&&measurement.frequency==='Weekly'&&measurement.adjustment==='Seasonally adjusted'&&measurement.observations?.filter(row=>row.releaseStage==='advance'&&row.publishedAt===event.date&&(!event.period||row.date===event.period)&&row.publicationDatePrecision==='day'&&Number.isFinite(row.value)).length===1;
}

/** A successful fetch of older data remains unverified and eligible for a retry. */
export function getReleaseRefreshPlan(snapshot={}, {now=new Date(),archives={}}={}){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new RangeError('Release refresh requires a valid Date.');
 const events=[];
 for(const event of snapshot.releases??[]){
  const seriesId=event.sourceId==='bea'&&event.program==='gdp'?'gdp':event.sourceId==='dol'&&event.program==='weekly-claims'?'claimsAdvance':null;
  if(!seriesId||!releaseEventIdentity(event,seriesId))continue;
  const since=(now.getTime()-Date.parse(event.scheduledAt))/60000;
  if(!Number.isFinite(since)||since<RELEASE_REFRESH_POLICY.initialDelayMinutes||since>RELEASE_REFRESH_POLICY.windowMinutes)continue;
  const sourceId=seriesId==='gdp'?'bea':'dolAdvance',source=snapshot.sources?.[sourceId],verified=sourceReleaseVerified(event,source,seriesId,archives[seriesId],now);
  events.push({eventId:event.id,sourceId,seriesId,scheduledAt:event.scheduledAt,expectedDate:event.date,evidenceStatus:verified?'verified':source?.status==='error'?'failed':'unverified',required:!verified,minutesSinceSchedule:Math.floor(since),objectiveMinutes:RELEASE_REFRESH_POLICY.objectiveMinutes});
 }
 const sources=[...new Set(events.filter(event=>event.required).map(event=>event.sourceId))].sort();
 return {required:sources.length>0,sources,events,objectiveMinutes:RELEASE_REFRESH_POLICY.objectiveMinutes,objective:'Best effort targeted current-data capture within 2 hours of supported schedules. Publication verification and immutable archive admission are separate; no immediate notification promise.'};
}
