import {dolPublicationReleases} from './dol-publication-scope.mjs';
import {dolPublicationReleases2025} from './dol-publication-scope-2025.mjs';
import {dolPublicationReleases2024} from './dol-publication-scope-2024.mjs';
import {dolPublicationReleases2023} from './dol-publication-scope-2023.mjs';
import {DOL_ADVANCE_IDS,DOL_ADVANCE_LICENSE,DOL_ADVANCE_ATTRIBUTION,DOL_SEASONAL_UPDATE_NOTICES,DOL_RELEASE_NOTICES} from './sources/dol-advance.mjs';
import {easternInstant} from './sources/calendar-utils.mjs';
import {isDeepStrictEqual} from 'node:util';

const fail=message=>{throw new Error('Unreviewed DOL claims publication: '+message);};
const plain=value=>value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const keys=(value,allowed,label)=>{if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail(label+' fields');};
const count=value=>Number(value.replaceAll(',',''));
const estimates={advance:'Advance','prior-week-revised':'Revised prior','prior-week-unrevised':'Unrevised prior','prior-week-status-unknown':'Prior comparison (status unknown)'};
export const DOL_TABLE_EXTRACTION_NOTE='The printed March 5 initial-SA table change cell is 0, verified on PDF page 4. Text extraction omits that glyph; restoration is restricted to the exact reviewed PDF hash and row. The narrative explicitly says unchanged and both printed count cells are 213,000.';
export const DOL_ORIGINAL_EDITION_NOTE="The original official April 13 PDF is retained. DOL later corrected its highest-since prose; the original and corrected PDFs report identical selected national SA numerical facts. Incorrect historical-high statements are not used here. The correction date is not established and the corrected copy is not another numerical vintage. Correction reference: https://www.dol.gov/sites/dolgov/files/OPA/newsreleases/ui-claims/20230700b.pdf";
const tableExtractionNotes=Object.freeze({
 'https://oui.doleta.gov/press/2026/030526.pdf':DOL_TABLE_EXTRACTION_NOTE,
 'https://oui.doleta.gov/press/2025/091125.pdf':'The printed September 11 continued-SA table change cell is 0, verified on PDF page 4. Text extraction omits that glyph; restoration is restricted to the exact reviewed PDF hash and row. The narrative explicitly says unchanged and both printed count cells are 1,939,000.',
});
export const claimsPublicationScope=Object.freeze([...dolPublicationReleases,...dolPublicationReleases2025,...dolPublicationReleases2024,...dolPublicationReleases2023].flatMap(release=>release.facts.map(fact=>Object.freeze({...fact,publicationDate:release.publicationDate,sourceUrl:release.sourceUrl,reviewedPdfSha256:release.sha256,id:`dol-${fact.seriesId}-${fact.period}-${fact.releaseStage}-${release.publicationDate}`}))));
const byId=new Map(claimsPublicationScope.map(fact=>[fact.id,fact]));
if(byId.size!==768||dolPublicationReleases.length!==42||dolPublicationReleases2025.length!==46||dolPublicationReleases2024.length!==52||dolPublicationReleases2023.length!==52)fail('reviewed scope manifest');

export function requestedClaimsPublicationIds(ids=claimsPublicationScope.map(row=>row.id)){
 if(!Array.isArray(ids)||ids.length>claimsPublicationScope.length||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id)))fail('unknown or duplicate requested scope');
 return [...ids];
}
export function claimsPublicationMetadataFor(scope){
 if(byId.get(scope.id)!==scope)fail('scope identity');
 const group=claimsPublicationScope.filter(row=>row.sourceUrl===scope.sourceUrl&&row.seriesId===scope.seriesId),prior=group.find(row=>row.releaseStage!=='advance'),advance=group.find(row=>row.releaseStage==='advance');
 const notice=DOL_SEASONAL_UPDATE_NOTICES[scope.publicationDate],releaseNotice=DOL_RELEASE_NOTICES[scope.publicationDate],status=prior.releaseStage==='prior-week-revised'?'revised':prior.releaseStage==='prior-week-unrevised'?'unrevised':null;
 const priorFootnote=status?`Prior-week ${status} comparison in the ${scope.publicationDate} release, not an advance observation for this week. Previously published count: ${scope.previouslyPublishedSourceValue}. Release date has day precision.`:`Prior-week comparison in the ${scope.publicationDate} release, not an advance observation for this week. Revision status is not stated and no previously published count is supplied. Release date has day precision.`;
 const footnotes=[scope.releaseStage==='advance'?`Advance estimate; subject to revision. Released ${scope.publicationDate} (day precision). Change versus the same release's ${status?status+' prior week':'prior-week comparison (revision status unspecified)'}: ${count(advance.sourceValue)-count(prior.sourceValue)} claims.`:priorFootnote];
 if(notice)footnotes.push(notice.note);
 if(releaseNotice)footnotes.push(releaseNotice.note);
 if(scope.editionNote)footnotes.push(DOL_ORIGINAL_EDITION_NOTE);
 const tableExtractionNote=scope.tableExtractionNote?tableExtractionNotes[scope.sourceUrl]:null;
 if(scope.tableExtractionNote&&!tableExtractionNote)fail('unreviewed table extraction note');
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
  if((scope.narrativeLayoutNote||scope.editionNote)&&source.sha256!==scope.reviewedPdfSha256)fail('reviewed narrative layout or original-edition PDF hash');
 }
 if(complete||ids!==undefined){const requested=requestedClaimsPublicationIds(ids);if(seen.size!==requested.length||requested.some(id=>!seen.has(id)))fail('incomplete or unrequested batch');}
 return true;
}
