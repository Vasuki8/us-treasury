import {requestBytes} from './http.mjs';
import {parseDolAdvanceText,extractDolAdvancePdf,DOL_RELEASE_NOTICES} from './dol-advance.mjs';
import {claimsPublicationScope,claimsPublicationMetadataFor,assertClaimsPublicationData,requestedClaimsPublicationIds} from '../dol-publication-policy.mjs';

const fail=message=>{throw new Error('Invalid DOL claims publication: '+message);};
const zeroCells=Object.freeze({
 'https://oui.doleta.gov/press/2026/030526.pdf':{sha256:'752a7c93abb20ee7d2dc980da27935a238761d08f119fdce4e1a42b64be40674',expression:/Initial Claims \(SA\)\s+213,000\s+213,000(\s+)208,000\s+224,000(?=\s+Initial Claims \(NSA\))/g,replacement:'Initial Claims (SA) 213,000 213,000 0 208,000 224,000'},
 'https://oui.doleta.gov/press/2025/091125.pdf':{sha256:'f4ba1484bf28e725205ef24c3ddb0c25e279c25349fe07d3db0e6e8571f53f1a',expression:/Insured Unemployment \(SA\)\s+1,939,000\s+1,939,000\s+1,944,000\s+1,845,000(?=\s+Insured Unemployment \(NSA\))/g,replacement:'Insured Unemployment (SA) 1,939,000 1,939,000 0 1,944,000 1,845,000'},
});
/** A manually verified printed glyph, never a general missing-value replacement. */
export function reviewedClaimsText(input,provenance){
 const correction=zeroCells[provenance.url];if(!correction||provenance.sha256!==correction.sha256)return input;
 const {expression,replacement}=correction;
 const matches=[...input.tableText.matchAll(expression)];
 if(matches.length!==1)fail('reviewed zero table cell shape changed');
 return {...input,tableText:input.tableText.replace(expression,replacement)};
}
export function parseClaimsPublication(input,{provenance,now=new Date(),ids}={}){
 const scopes=claimsPublicationScope.filter(row=>row.sourceUrl===provenance?.url);if(!scopes.length)fail('unreviewed source URL');
 const requested=requestedClaimsPublicationIds(ids??scopes.map(row=>row.id));if(requested.some(id=>!scopes.some(row=>row.id===id)))fail('requested scope from another source');
 const parsed=parseDolAdvanceText(reviewedClaimsText(input,provenance),{now});
 if(parsed.releaseDate!==scopes[0].publicationDate)fail('publication date and archived source scope disagree');
 const notice=claimsPublicationMetadataFor(scopes[0]);
 if((parsed.seasonalAdjustmentNote??null)!==notice.seasonalAdjustmentNote||(parsed.seasonalAdjustmentKind??null)!==notice.seasonalAdjustmentKind)fail('reviewed seasonal adjustment notice changed or missing');
 if((parsed.publicationNotice??null)!==(DOL_RELEASE_NOTICES[parsed.releaseDate]?.note??null))fail('reviewed release coverage notice changed or missing');
 // Verify every selected PDF fact before returning a requested subset.
 const releases=scopes.map(scope=>{
  const observed=parsed.series[scope.seriesId]?.observations.find(row=>row.date===scope.period&&row.releaseStage===scope.releaseStage);
  if(!observed||observed.sourceValue!==scope.sourceValue||observed.value!==Number(scope.sourceValue.replaceAll(',',''))/1000||(observed.previouslyPublishedSourceValue??null)!==(scope.previouslyPublishedSourceValue??null))fail('reviewed source value or role changed');
  return {...claimsPublicationMetadataFor(scope),value:observed.value,sourceValue:observed.sourceValue,previouslyPublishedSourceValue:observed.previouslyPublishedSourceValue??null,provenance:[provenance]};
 });
 assertClaimsPublicationData({version:1,releases},{ids:scopes.map(row=>row.id)});
 const archive={version:1,releases:releases.filter(row=>requested.includes(row.id))};assertClaimsPublicationData(archive,{ids:requested});return archive;
}
/** Bounded sequential retrieval: each reviewed PDF is requested once per missing batch. */
export async function collectClaimsPublications({fetchImpl=globalThis.fetch,now=new Date(),extractPdf=extractDolAdvancePdf,ids}={}){
 const requested=requestedClaimsPublicationIds(ids),wanted=new Set(requested),scopes=claimsPublicationScope.filter(row=>wanted.has(row.id));
 const rows=new Map();
 for(const url of new Set(scopes.map(row=>row.sourceUrl))){
  const {bytes,...provenance}=await requestBytes(url,{fetchImpl,maxBytes:4*1024*1024});
  if(provenance.url!==url)fail('unreviewed PDF redirect');
  if(!bytes.subarray(0,8).toString('ascii').match(/^%PDF-1\.[0-9]/))fail('response is not a PDF');
  const selected=scopes.filter(row=>row.sourceUrl===url).map(row=>row.id);
  const batch=parseClaimsPublication(await extractPdf(bytes),{provenance,now,ids:selected});for(const row of batch.releases)rows.set(row.id,row);
 }
 const result={version:1,releases:requested.map(id=>rows.get(id))};assertClaimsPublicationData(result,{ids:requested});return result;
}
