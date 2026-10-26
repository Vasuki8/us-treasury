import {isIsoDate} from '../src/date-window.js';
import {easternInstant} from './sources/calendar-utils.mjs';
import {DOL_ADVANCE_LICENSE,DOL_ADVANCE_ATTRIBUTION,DOL_SEASONAL_UPDATE_NOTICES} from './sources/dol-advance.mjs';

const xml='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const index='https://oui.doleta.gov/unemploy/archive.asp';
const ids={claims:'InitialClaims/SA',continuedClaims:'ContinuedClaims/SA'};
const dayMs=86400000;
const baseFields=['date','value','publishedAt','sourceValue','sourceUrl','sourceSha256','retrievedAt'];
const pdfFields=['publicationDate','publicationDatePrecision','releaseStage','previouslyPublishedSourceValue','footnotes'];
const fail=message=>{throw new Error('Unreviewed DOL revised history: '+message);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const keys=(value,expected)=>object(value)&&Object.keys(value).length===expected.length&&expected.every(key=>Object.hasOwn(value,key));
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
const saturday=value=>isIsoDate(value)&&value>='1967-01-01'&&new Date(value+'T00:00:00Z').getUTCDay()===6;
const receiptKey=receipt=>`${receipt.url}|${receipt.sha256}|${receipt.retrievedAt}`;
function pdfDate(value){
 if(typeof value!=='string')return null;
 const match=/^https:\/\/oui\.doleta\.gov\/press\/(\d{4})\/(\d{2})(\d{2})(\d{2})\.pdf$/.exec(value);
 if(!match||match[1].slice(-2)!==match[4])return null;
 const date=`${match[1]}-${match[2]}-${match[3]}`;
 return isIsoDate(date)?date:null;
}
export const matchesDolRevisedFeed=value=>value===xml||value===index||pdfDate(value)!==null;

export function hasDolRevisedHistory(source){
 const profile=source?.revisedHistoryProfile;
 return keys(profile,['version','xmlThrough','latestReleaseDate','overlaps'])&&profile.version===1
  &&keys(profile.xmlThrough,Object.keys(ids))&&Object.values(profile.xmlThrough).every(saturday)
  &&isIsoDate(profile.latestReleaseDate)&&keys(profile.overlaps,Object.keys(ids));
}
function count(value){
 if(typeof value!=='string'||!/^(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value))fail('raw count');
 const result=Number(value.replaceAll(',',''));
 if(!Number.isSafeInteger(result)||result<0)fail('raw count');
 return result;
}

/** Only marked captures gain dated-PDF permissions; legacy XML keeps its meaning. */
export function assertDolRevisedHistoryData(source){
 if(!source)return;
 if(source.revisedHistoryProfile===undefined){
  if((source.provenance??[]).some(receipt=>receipt?.url===index||pdfDate(receipt?.url)!==null))fail('dated PDF and archive-index receipts require the complete profile');
  for(const series of Object.values(source.series??{})){
   if(series.inputProvenanceScope==='observation-source-urls'||(series.observations??[]).some(row=>['sourceUrl','sourceUrls','sourceSha256','retrievedAt',...pdfFields].some(key=>Object.hasOwn(row,key))))fail('observation source overrides require the complete profile');
  }
  return;
 }
 if(!hasDolRevisedHistory(source)||!timestamp(source.fetchedAt)||!keys(source.series,Object.keys(ids)))fail('complete two-series profile');
 const profile=source.revisedHistoryProfile,receipts=new Map(),pdfUrls=new Set();
 let xmlCount=0,indexCount=0,xmlReceipt=null;
 if(!Array.isArray(source.provenance)||!source.provenance.length)fail('actual source receipts');
 for(const receipt of source.provenance){
  if(!keys(receipt,['url','sha256','retrievedAt','lastModified'])||!matchesDolRevisedFeed(receipt.url)||typeof receipt.sha256!=='string'||!/^[a-f0-9]{64}$/.test(receipt.sha256)||!timestamp(receipt.retrievedAt)||receipt.retrievedAt>source.fetchedAt||(receipt.lastModified!==null&&typeof receipt.lastModified!=='string')||receipts.has(receiptKey(receipt)))fail('exact source receipt, hash or clock');
  receipts.set(receiptKey(receipt),receipt);
  if(receipt.url===xml){xmlCount++;xmlReceipt=receipt;}
  else if(receipt.url===index)indexCount++;
  else{
   if(pdfUrls.has(receipt.url)||Date.parse(easternInstant(pdfDate(receipt.url),'08:30'))>Date.parse(receipt.retrievedAt))fail('dated PDF receipt or release embargo');
   pdfUrls.add(receipt.url);
  }
 }
 if(xmlCount!==1||indexCount<1||indexCount>2||pdfUrls.size<1||pdfUrls.size>10000||[...receipts.values()].map(receipt=>receipt.retrievedAt).sort().at(-1)!==source.fetchedAt)fail('bounded receipts and maximum actual retrieval');
 const currentReceipts=[...receipts.values()].filter(receipt=>receipt.retrievedAt>=xmlReceipt.retrievedAt);
 if(currentReceipts.filter(receipt=>pdfDate(receipt.url)!==null).length>8)fail('at most eight newly retrieved PDFs per XML refresh');
 if([...receipts.values()].some(receipt=>receipt.url===index&&receipt.retrievedAt<xmlReceipt.retrievedAt))fail('archive index must be retrieved with the fresh XML');
 const releaseDates=[...pdfUrls].map(pdfDate).sort(),xmlFloor=Object.values(profile.xmlThrough).sort()[0];
 if(releaseDates.at(-1)!==profile.latestReleaseDate)fail('latest confirmed release date');
 if(releaseDates[0]>xmlFloor||releaseDates.some(date=>Date.parse(xmlFloor)-Date.parse(date)>7*dayMs))fail('bounded PDF notice context across the XML endpoint');
 for(const [releaseDate,notice]of Object.entries(DOL_SEASONAL_UPDATE_NOTICES))if(notice.kind==='applied-update'&&releaseDate<=profile.latestReleaseDate&&Object.values(profile.xmlThrough).some(date=>date<releaseDate))fail('annual seasonal revision requires both XML endpoints on or after the release');
 function rowReceipt(row){
  const receipt=receipts.get(receiptKey({url:row.sourceUrl,sha256:row.sourceSha256,retrievedAt:row.retrievedAt}));
  if(!receipt||row.sourceUrl!==receipt.url||row.sourceSha256!==receipt.sha256||row.retrievedAt!==receipt.retrievedAt||Object.hasOwn(row,'sourceUrls')||!saturday(row.date)||row.publishedAt!==null)fail('observation receipt, Saturday or unknown publication instant');
  return receipt;
 }
 function prior(row,id){
  if(!keys(row,[...baseFields,...pdfFields]))fail('complete PDF prior observation');
  rowReceipt(row);
  const releaseDate=pdfDate(row.sourceUrl),age=(Date.parse(row.publicationDate)-Date.parse(row.date))/dayMs;
  if(!releaseDate||row.publicationDate!==releaseDate||row.publicationDatePrecision!=='day'||!['prior-week-revised','prior-week-unrevised'].includes(row.releaseStage)||age<7||age>(id==='claims'?21:28)||row.value!==count(row.sourceValue)/1000)fail('PDF prior role, count or release date');
  const previous=count(row.previouslyPublishedSourceValue);
  if((row.releaseStage==='prior-week-unrevised')!==(previous===count(row.sourceValue)))fail('explicit prior revision status');
  if(!Array.isArray(row.footnotes)||!row.footnotes.length||row.footnotes.some(note=>typeof note!=='string'||!note||note.length>2000||/[<>]/.test(note)))fail('PDF release-role footnotes');
 }
 let appended=0;
 for(const [id,code]of Object.entries(ids)){
  const series=source.series[id],expected={sourceUrl:xml,sourceTitle:'Unemployment Insurance Weekly Claims Data',licenseUrl:DOL_ADVANCE_LICENSE,attribution:DOL_ADVANCE_ATTRIBUTION,inputProvenanceScope:'observation-source-urls',observationType:'official',frequency:'Weekly',adjustment:'Seasonally adjusted',unit:id==='claims'?'Thousands of claims':'Thousands of continued claims'};
  if(!object(series))fail('native series');
  if(Object.entries(expected).some(([key,value])=>series[key]!==value)||!Array.isArray(series.sourceIds)||series.sourceIds.length!==1||series.sourceIds[0]!==code||series.sourceNotice||series.redistributionNotice||series.termsUrl&&series.termsUrl!==DOL_ADVANCE_LICENSE)fail('native series identity, measurement scope or rights');
  const rows=series.observations,through=profile.xmlThrough[id],overlap=profile.overlaps[id],urls=new Set([xml]);
  if(!Array.isArray(rows)||!rows.length||rows.length>10000)fail('retained native observations');
  let previous=null,xmlEnd=null,tailDate=through;
  for(const row of rows){
   if(!object(row))fail('observation');
   const receipt=rowReceipt(row);
   if(previous!==null&&row.date<=previous)fail('ascending unique observation dates');
   previous=row.date;
   if(row.date<=through){
    if(!keys(row,baseFields)||receipt.url!==xml||row.value!==(row.sourceValue===''?null:count(row.sourceValue)/1000))fail('unchanged XML observation');
    xmlEnd=row;
   }else{
    prior(row,id);
    if(Date.parse(row.date)-Date.parse(tailDate)!==7*dayMs)fail('continuous confirmed weekly tail');
    tailDate=row.date;appended++;
   }
   urls.add(row.sourceUrl);
  }
  if(xmlEnd?.date!==through||xmlEnd.value===null)fail('latest usable XML endpoint');
  prior(overlap,id);
  const overlapXml=rows.find(row=>row.date===overlap.date&&row.sourceUrl===xml);
  if(!overlapXml||overlap.value!==overlapXml.value||count(overlap.sourceValue)!==count(overlapXml.sourceValue))fail('PDF prior overlap must match a retained XML observation exactly');
  urls.add(overlap.sourceUrl);
  if(!Array.isArray(series.sourceUrls)||new Set(series.sourceUrls).size!==series.sourceUrls.length||series.sourceUrls.length!==urls.size||series.sourceUrls.some(url=>!urls.has(url)))fail('actual supporting observation source URLs');
  if(series.latestObservationDate!==undefined&&series.latestObservationDate!==rows.at(-1).date)fail('latest native observation date');
 }
 if(!appended)fail('confirmed supplement');
 if(source.latestObservationDate!==undefined&&source.latestObservationDate!==source.series.claims.observations.at(-1).date)fail('latest initial-claims observation date');
}
