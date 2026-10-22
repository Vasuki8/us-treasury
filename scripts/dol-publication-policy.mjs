import {dolPublicationReleases} from './dol-publication-scope.mjs';
import {DOL_ADVANCE_IDS,DOL_ADVANCE_LICENSE,DOL_ADVANCE_ATTRIBUTION,DOL_SEASONAL_UPDATE_NOTICES} from './sources/dol-advance.mjs';
import {easternInstant} from './sources/calendar-utils.mjs';
import {isDeepStrictEqual} from 'node:util';

const fail=message=>{throw new Error('Unreviewed DOL claims publication: '+message);};
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const keys=(value,allowed,label)=>{if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail(label+' fields');};
const count=value=>Number(value.replaceAll(',',''));
const estimates={advance:'Advance','prior-week-revised':'Revised prior','prior-week-unrevised':'Unrevised prior'};
export const DOL_TABLE_EXTRACTION_NOTE='The printed March 5 initial-SA table change cell is 0, verified on PDF page 4. Text extraction omits that glyph; restoration is restricted to the exact reviewed PDF hash and row. The narrative explicitly says unchanged and both printed count cells are 213,000.';
export const claimsPublicationScope=Object.freeze(dolPublicationReleases.flatMap(release=>release.facts.map(fact=>Object.freeze({...fact,publicationDate:release.publicationDate,sourceUrl:release.sourceUrl,reviewedPdfSha256:release.sha256,id:`dol-${fact.seriesId}-${fact.period}-${fact.releaseStage}-${release.publicationDate}`}))));
const byId=new Map(claimsPublicationScope.map(fact=>[fact.id,fact]));
if(byId.size!==168||dolPublicationReleases.length!==42)fail('reviewed scope manifest');

export function requestedClaimsPublicationIds(ids=claimsPublicationScope.map(row=>row.id)){
 if(!Array.isArray(ids)||ids.length>claimsPublicationScope.length||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id)))fail('unknown or duplicate requested scope');
 return [...ids];
}
export function claimsPublicationMetadataFor(scope){
 if(byId.get(scope.id)!==scope)fail('scope identity');
 const group=claimsPublicationScope.filter(row=>row.sourceUrl===scope.sourceUrl&&row.seriesId===scope.seriesId),prior=group.find(row=>row.releaseStage!=='advance'),advance=group.find(row=>row.releaseStage==='advance');
 const notice=DOL_SEASONAL_UPDATE_NOTICES[scope.publicationDate],status=prior.releaseStage==='prior-week-revised'?'revised':'unrevised';
 const footnotes=[scope.releaseStage==='advance'?`Advance estimate; subject to revision. Released ${scope.publicationDate} (day precision). Change versus the same release's ${status} prior week: ${count(advance.sourceValue)-count(prior.sourceValue)} claims.`:`Prior-week ${status} comparison in the ${scope.publicationDate} release, not an advance observation for this week. Previously published count: ${scope.previouslyPublishedSourceValue}. Release date has day precision.`];
 if(notice)footnotes.push(notice.note);
 const tableExtractionNote=scope.tableExtractionNote?DOL_TABLE_EXTRACTION_NOTE:null;
 if(tableExtractionNote)footnotes.push(tableExtractionNote);
 return {id:scope.id,seriesId:scope.seriesId,period:scope.period,estimate:estimates[scope.releaseStage],releaseStage:scope.releaseStage,publicationDate:scope.publicationDate,publicationDatePrecision:'day',publishedAt:null,value:count(scope.sourceValue)/1000,sourceValue:scope.sourceValue,previouslyPublishedSourceValue:scope.previouslyPublishedSourceValue??null,
  unit:scope.seriesId==='claimsAdvance'?'Thousands of claims':'Thousands of continued claims',frequency:'Weekly',adjustment:'Seasonally adjusted',sourceUrl:scope.sourceUrl,releaseEvidenceUrl:scope.sourceUrl,sourceTitle:'Unemployment Insurance Weekly Claims',licenseUrl:DOL_ADVANCE_LICENSE,attribution:DOL_ADVANCE_ATTRIBUTION,
  calculation:'Published national regular UI seasonally adjusted count / 1000. Publication changes compare the same reference week and measurement. Release field identifiers are Meridian mappings. Kept separate from current revised XML history; no historical-feed splice.',
  sourceIds:[DOL_ADVANCE_IDS[scope.seriesId]],footnotes,seasonalAdjustmentNote:notice?.note??null,seasonalAdjustmentKind:notice?.kind??null,tableExtractionNote};
}
/** Independently enforce exact reviewed facts and rights; subset batches support append-only capture. */
export function assertClaimsPublicationData(archive,{complete=false,ids}={}){
 keys(archive,['version','releases'],'archive');if(archive.version!==1||!Array.isArray(archive.releases)||archive.releases.length>claimsPublicationScope.length)fail('archive version or scope');
 const seen=new Set();
 for(const row of archive.releases){
  const scope=byId.get(row?.id);if(!scope||seen.has(row.id))fail('unknown or duplicate scope');seen.add(row.id);
  const expected=claimsPublicationMetadataFor(scope);keys(row,[...Object.keys(expected),'provenance'],'record');
  for(const [key,value]of Object.entries(expected))if(!isDeepStrictEqual(row[key],value))fail('record '+key);
  if(!Array.isArray(row.provenance)||row.provenance.length!==1)fail('one PDF provenance receipt');
  const source=row.provenance[0];keys(source,['url','sha256','retrievedAt','lastModified'],'provenance');
  const stamp=source.retrievedAt;
  if(source.url!==scope.sourceUrl||typeof source.sha256!=='string'||!/^[a-f0-9]{64}$/.test(source.sha256)||typeof stamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp)||!Number.isFinite(Date.parse(stamp))||new Date(stamp).toISOString()!==stamp||Date.parse(stamp)<Date.parse(easternInstant(scope.publicationDate,'08:30')))fail('source hash or actual retrieval after publication embargo');
  if(source.lastModified!==null&&(typeof source.lastModified!=='string'||source.lastModified.length>200||!Number.isFinite(Date.parse(source.lastModified))))fail('last-modified metadata');
  if(scope.tableExtractionNote&&source.sha256!==scope.reviewedPdfSha256)fail('reviewed zero-cell PDF hash');
 }
 if(complete||ids!==undefined){const requested=requestedClaimsPublicationIds(ids);if(seen.size!==requested.length||requested.some(id=>!seen.has(id)))fail('incomplete or unrequested batch');}
 return true;
}
