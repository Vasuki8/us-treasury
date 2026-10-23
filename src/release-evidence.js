import {isIsoDate} from './date-window.js';

/** Reviewed release identities. Current revised feeds cannot satisfy this contract. */
export const releaseMeasurements=Object.freeze({
 gdp:Object.freeze({name:'Real GDP growth',sourceId:'bea',program:'gdp',unit:'Percent change from preceding quarter, annualized',frequency:'Quarterly',adjustment:'Seasonally adjusted annual rate'}),
 claimsAdvance:Object.freeze({name:'Initial claims',sourceId:'dol',program:'weekly-claims',unit:'Thousands of claims',frequency:'Weekly',adjustment:'Seasonally adjusted'}),
 continuedClaimsAdvance:Object.freeze({name:'Continued claims',sourceId:'dol',program:'weekly-claims',unit:'Thousands of continued claims',frequency:'Weekly',adjustment:'Seasonally adjusted'}),
});
const priorStages=new Set(['prior-week-revised','prior-week-unrevised','prior-week-status-unknown']);
const claimsEstimates={advance:'Advance','prior-week-revised':'Revised prior','prior-week-unrevised':'Unrevised prior','prior-week-status-unknown':'Prior comparison (status unknown)'};
const gdpEstimates=new Set(['Advance','Second','Third','Preliminary','Final','Initial','Updated','Revised']);
const gdpWorkbooks=new Set(['https://www.bea.gov/sites/default/files/2026-06/gdp-gdi-vintage-history.xlsx','https://www.bea.gov/sites/default/files/2026-09/gdp-gdi-vintage-history.xlsx']);
const unavailable=(status,reason,seriesId,event=null)=>({status,reason,seriesId,event,actual:null,period:null,sameReleasePrior:null,earlierPublication:null,earlierPrior:null,revision:null,priorRevision:null});
function officialEvidence(row,seriesId){
 try{
  const url=new URL(row.releaseEvidenceUrl);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port)return false;
  if(seriesId==='gdp')return gdpWorkbooks.has(row.sourceUrl)&&url.hostname==='www.bea.gov'&&(gdpWorkbooks.has(url.href)||url.pathname.startsWith('/news/'));
  const date=row.publicationDate,datedPdf=`/press/${date.slice(0,4)}/${date.slice(5,7)}${date.slice(8,10)}${date.slice(2,4)}.pdf`;
  const admittedEdition='https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20230700.pdf';
  return row.sourceUrl===row.releaseEvidenceUrl&&(url.hostname==='oui.doleta.gov'&&url.pathname===datedPdf||date==='2023-04-13'&&url.href===admittedEdition);
 }catch{return false;}
}
function validReceipt(row){
 if(!Array.isArray(row.provenance)||row.provenance.length!==1)return false;
 const receipt=row.provenance[0],stamp=receipt?.retrievedAt;
 return Boolean(receipt&&receipt.url===row.sourceUrl&&typeof receipt.sha256==='string'&&/^[a-f0-9]{64}$/.test(receipt.sha256)&&typeof stamp==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp)&&Number.isFinite(Date.parse(stamp))&&new Date(stamp).toISOString()===stamp&&stamp.slice(0,10)>=row.publicationDate);
}
const sameMeasurement=(row,seriesId)=>{
 const measurement=releaseMeasurements[seriesId];
 if(!measurement||!row||typeof row!=='object'||Array.isArray(row)||row.seriesId!==seriesId||!['unit','frequency','adjustment'].every(key=>row[key]===measurement[key])||!isIsoDate(row.period)||!isIsoDate(row.publicationDate)||row.period>row.publicationDate||row.publicationDatePrecision!=='day'||row.publishedAt!==null||!Number.isFinite(row.value)||!validReceipt(row)||!officialEvidence(row,seriesId))return false;
 const gdp=seriesId==='gdp',sourceId=gdp?'A191RL':seriesId==='claimsAdvance'?'InitialClaims/SA/Release':'ContinuedClaims/SA/Release';
 if(!Array.isArray(row.sourceIds)||row.sourceIds.length!==1||row.sourceIds[0]!==sourceId)return false;
 if(gdp)return /^\d{4}-(?:01|04|07|10)-01$/.test(row.period)&&gdpEstimates.has(row.estimate)&&row.id===`bea-gdp-${row.period.slice(0,4)}q${(Number(row.period.slice(5,7))+2)/3}-${row.estimate.toLowerCase()}-${row.publicationDate}`;
 return new Date(row.period+'T12:00:00Z').getUTCDay()===6&&Object.hasOwn(claimsEstimates,row.releaseStage)&&row.estimate===claimsEstimates[row.releaseStage]&&row.id===`dol-${seriesId}-${row.period}-${row.releaseStage}-${row.publicationDate}`;
};
const archiveRows=archive=>Array.isArray(archive?.releases)?archive.releases:[];
const delta=(row,previous)=>row&&previous&&row.seasonalAdjustmentKind!=='applied-update'?Number((row.value-previous.value).toFixed(12)):null;
const previousWeek=date=>new Date(Date.parse(date+'T12:00:00Z')-7*86400000).toISOString().slice(0,10);
function uniqueEarlier(rows,period,date){
 const candidates=rows.filter(row=>row.period===period&&row.publicationDate<date).sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate));
 const last=candidates.at(-1);return last&&candidates.filter(row=>row.publicationDate===last.publicationDate).length===1?last:null;
}

/** Parse only the explicit quarterly period and estimate named by the schedule. */
export function releaseEventIdentity(event,seriesId='gdp'){
 const measurement=releaseMeasurements[seriesId];
 if(!measurement||event?.sourceId!==measurement.sourceId||event?.program!==measurement.program||!isIsoDate(event.date))return null;
 if(event.period!==null&&event.period!==undefined&&event.period!==''&&!isIsoDate(event.period))return null;
 if(seriesId!=='gdp')return {seriesId,period:isIsoDate(event.period)?event.period:null,stage:'advance'};
 const text=[event.periodLabel,event.name].filter(Boolean).join(' '),quarter=/\b([1-4])(?:st|nd|rd|th) Quarter(?: and Year)? (\d{4})\b/.exec(text);
 const namedPeriod=quarter?`${quarter[2]}-${String((Number(quarter[1])-1)*3+1).padStart(2,'0')}-01`:null;
 const period=isIsoDate(event.period)?event.period:namedPeriod;
 const stage=/\b(Advance|Second|Third) Estimate\b/i.exec(event.name??'')?.[1];
 if(!period||!stage||namedPeriod&&namedPeriod!==period||!/^(?:\d{4})-(?:01|04|07|10)-01$/.test(period))return null;
 return {seriesId,period,stage:stage[0].toUpperCase()+stage.slice(1).toLowerCase()};
}

function joinedEvidence(actual,rows,event){
 const seriesId=actual.seriesId,earlierPublication=uniqueEarlier(rows,actual.period,actual.publicationDate);
 let sameReleasePrior=null,earlierPrior=null;
 if(seriesId!=='gdp'){
  const priors=rows.filter(row=>row.period===previousWeek(actual.period)&&row.publicationDate===actual.publicationDate&&row.releaseEvidenceUrl===actual.releaseEvidenceUrl&&priorStages.has(row.releaseStage));
  if(priors.length===1){sameReleasePrior=priors[0];earlierPrior=uniqueEarlier(rows,sameReleasePrior.period,actual.publicationDate);}
 }
 return {status:'verified',reason:'Matched retained official publication evidence.',seriesId,event,period:actual.period,actual,earlierPublication,sameReleasePrior,earlierPrior,revision:delta(actual,earlierPublication),priorRevision:delta(sameReleasePrior,earlierPrior)};
}

/** Publication day is a join key, never a claim about a publication instant. */
export function matchReleaseEvidence(event,archive,{seriesId='gdp',period='',publicationCutoff=''}={}){
 const identity=releaseEventIdentity(event,seriesId);
 if(!identity)return unavailable(releaseMeasurements[seriesId]&&event?.sourceId===releaseMeasurements[seriesId].sourceId&&event?.program===releaseMeasurements[seriesId].program?'unavailable':'unsupported','No reviewed measurement, reference period and estimate-stage mapping for this schedule.',seriesId,event);
 if(publicationCutoff&&(!isIsoDate(publicationCutoff)||event.date>publicationCutoff))return unavailable('unavailable','The scheduled publication is outside the selected publication-day cutoff.',seriesId,event);
 const rows=archiveRows(archive).filter(row=>sameMeasurement(row,seriesId));
 const matches=rows.filter(row=>row.publicationDate===event.date&&(!identity.period||row.period===identity.period)&&(!period||row.period===period)&&(seriesId==='gdp'?row.estimate===identity.stage:row.releaseStage==='advance'));
 if(matches.length!==1)return unavailable(matches.length>1?'ambiguous':'unavailable',matches.length>1?'Multiple matching publication facts; no result selected.':'No matching retained official result. A scheduled time does not verify publication.',seriesId,event);
 return joinedEvidence(matches[0],rows,event);
}

/** Open a retained publication even when its dated schedule is outside calendar coverage. */
export function selectReleaseEvidence(archive,{seriesId='gdp',period='',publicationCutoff=''}={}){
 if(!releaseMeasurements[seriesId]||period&&!isIsoDate(period)||publicationCutoff&&!isIsoDate(publicationCutoff))return unavailable('unavailable','Invalid reviewed publication selection.',seriesId);
 const rows=archiveRows(archive).filter(row=>sameMeasurement(row,seriesId));
 const eligible=rows.filter(row=>(!period||row.period===period)&&(!publicationCutoff||row.publicationDate<=publicationCutoff)&&(seriesId==='gdp'||row.releaseStage==='advance'));
 const selectedPeriod=period||eligible.map(row=>row.period).sort().at(-1),ordered=eligible.filter(row=>row.period===selectedPeriod).sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate));
 const actual=ordered.at(-1);
 if(!actual)return unavailable('unavailable','No retained publication for this measurement, period and cutoff. Current observations are not substituted.',seriesId);
 if(ordered.filter(row=>row.publicationDate===actual.publicationDate).length!==1)return unavailable('ambiguous','Multiple matching publication facts; no result selected.',seriesId);
 return joinedEvidence(actual,rows,null);
}

export function releaseDelivery(event,row){
 const retrievedAt=row?.provenance?.at(-1)?.retrievedAt??null,retrieved=Date.parse(retrievedAt),scheduled=Date.parse(event?.scheduledAt);
 const minutes=Number.isFinite(retrieved)&&Number.isFinite(scheduled)&&retrieved>=scheduled?Math.round((retrieved-scheduled)/60000):null;
 return {scheduledAt:event?.scheduledAt??null,publicationDate:row?.publicationDate??null,publicationPrecision:row?.publicationDatePrecision??null,publicationInstant:null,retrievedAt,scheduleToRetrievalMinutes:minutes,publicationToRetrievalMinutes:null};
}
