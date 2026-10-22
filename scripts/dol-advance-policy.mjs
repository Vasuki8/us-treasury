import {DOL_ADVANCE_URL,DOL_ADVANCE_LICENSE,DOL_ADVANCE_ATTRIBUTION,DOL_ADVANCE_PUBLICATION_NOTE,DOL_ADVANCE_IDS} from './sources/dol-advance.mjs';
import {isIsoDate} from '../src/date-window.js';
import {easternInstant} from './sources/calendar-utils.mjs';

export const dolAdvancePolicy={id:'dol-weekly-advance-release',agency:'dolAdvance',reviewedOn:'2026-10-22',commercialUse:true,
 basis:'Scoped public-domain DOL ETA regular UI seasonally adjusted advance release statistics, with separate same-release prior comparisons and no splice into historical revised data',
 terms:[DOL_ADVANCE_LICENSE,'https://oui.doleta.gov/unemploy/claims_arch.asp'],feed:'dol-advance-release',
 series:Object.fromEntries(Object.entries(DOL_ADVANCE_IDS).map(([id,code])=>[id,[code]])),
};
export const matchesDolAdvanceFeed=(value,feed)=>feed==='dol-advance-release'&&value===DOL_ADVANCE_URL;
const fail=message=>{throw new Error('Unreviewed DOL advance release: '+message);};
const own=(value,key)=>Object.hasOwn(value,key);
function sourceCount(value){if(typeof value!=='string'||!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value))fail('source count');const count=Number(value.replaceAll(',',''));if(!Number.isSafeInteger(count)||count<0)fail('source count');return count;}

/** Existing captured providers retain their prior contracts and bytes. */
export function assertDolAdvanceData(snapshot){
 const source=snapshot.sources?.dolAdvance;if(!source)return true;
 const entries=Object.entries(source.series??{});
 if(!source.fetchedAt&&!entries.length)return true;
 if(entries.length!==2||entries.some(([id])=>!own(DOL_ADVANCE_IDS,id)))fail('separate two-measure scope');
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(source.fetchedAt)||!Number.isFinite(Date.parse(source.fetchedAt)))fail('actual UTC retrieval');
 if(source.provenance?.length!==1)fail('one exact source receipt');
 const provenance=source.provenance[0];
 if(provenance.url!==DOL_ADVANCE_URL||!/^[a-f0-9]{64}$/.test(provenance.sha256)||provenance.retrievedAt!==source.fetchedAt)fail('source provenance');
 let releaseDate=null;
 for(const [id,item]of entries){
  const expected={sourceUrl:DOL_ADVANCE_URL,licenseUrl:DOL_ADVANCE_LICENSE,attribution:DOL_ADVANCE_ATTRIBUTION,sourceTitle:'Unemployment Insurance Weekly Claims',publicationNote:DOL_ADVANCE_PUBLICATION_NOTE,observationType:'official',frequency:'Weekly',adjustment:'Seasonally adjusted',unit:id==='claimsAdvance'?'Thousands of claims':'Thousands of continued claims'};
  for(const [key,value]of Object.entries(expected))if(item[key]!==value)fail(id+' '+key);
  if(item.sourceIds?.length!==1||item.sourceIds[0]!==DOL_ADVANCE_IDS[id]||item.sourceUrls?.some(url=>url!==DOL_ADVANCE_URL))fail('release field mapping');
  const rows=item.observations;if(!Array.isArray(rows)||rows.length!==2)fail('only current advance and same-release prior');
  const [prior,current]=rows;
  if(!['prior-week-revised','prior-week-unrevised'].includes(prior.releaseStage)||current.releaseStage!=='advance')fail('explicit release stages');
  if(!isIsoDate(current.publishedAt)||prior.publishedAt!==current.publishedAt||releaseDate&&releaseDate!==current.publishedAt)fail('day-level release dates');
  releaseDate=current.publishedAt;
  if(Date.parse(easternInstant(releaseDate,'08:30'))>Date.parse(source.fetchedAt))fail('release embargo has not elapsed');
  if(source.releaseDate!==undefined&&source.releaseDate!==releaseDate)fail('release date mismatch');
  const age=(Date.parse(releaseDate)-Date.parse(current.date))/86400000;
  if(!isIsoDate(prior.date)||!isIsoDate(current.date)||new Date(prior.date+'T00:00:00Z').getUTCDay()!==6||new Date(current.date+'T00:00:00Z').getUTCDay()!==6||Date.parse(current.date)-Date.parse(prior.date)!==7*86400000||age<0||age>(id==='claimsAdvance'?14:21))fail('independent Saturday reference periods');
  for(const row of rows){
   if(row.publicationDatePrecision!=='day'||row.value!==sourceCount(row.sourceValue)/1000||own(row,'sourceUrl')||own(row,'sourceUrls'))fail('count scaling, date precision or source override');
   if(!Array.isArray(row.footnotes)||!row.footnotes.length||row.footnotes.some(text=>typeof text!=='string'||!text||text.length>2000||/[<>]/.test(text)))fail('release-role source notes');
  }
  const previous=sourceCount(prior.previouslyPublishedSourceValue);
  if((prior.releaseStage==='prior-week-unrevised')!==(previous===sourceCount(prior.sourceValue)))fail('prior revision status');
  if(!item.coverageNote?.includes(releaseDate)||!item.coverageNote.includes('separate from the revised historical series')||!item.calculation?.includes('no historical-feed splice'))fail('separate coverage and calculation');
 }
 return true;
}
