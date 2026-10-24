import {isDeepStrictEqual} from 'node:util';
import {cpiPublicationScope} from './cpi-publication-scope.mjs';
import {releaseMeasurements} from '../src/release-evidence.js';
export {cpiPublicationScope} from './cpi-publication-scope.mjs';
export const CPI_ATTRIBUTION='Source: U.S. Bureau of Labor Statistics. BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov. BLS published statistical material is public domain; attribution requested. This product is not endorsed by BLS. The BLS emblem and third-party copyrighted photographs and illustrations are not reused.';
export const CPI_LICENSE='https://www.bls.gov/bls/linksite.htm';
export const CPI_MISSING_MONTHS_NOTE='Table A source notice: The Oct and Nov 2025 data values are not available due to the 2025 lapse in appropriations.';
export const CPI_FEBRUARY_SEASONAL_NOTE='February 13, 2026 source notice: BLS recalculated seasonal adjustment factors under its annual practice, revising seasonally adjusted indexes for the previous 5 years. This notice does not establish the cause of every difference between editions.';
const byId=new Map(cpiPublicationScope.map(row=>[row.id,row]));
const fail=message=>{throw Error('Unreviewed CPI publication: '+message);};
export function requestedCpiPublicationIds(ids=cpiPublicationScope.map(row=>row.id)){
 if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!byId.has(id)))fail('unknown or duplicate requested scope');return [...ids];
}
export function cpiPublicationMetadataFor(scope){
 if(byId.get(scope.id)!==scope)fail('scope identity');
 const measurement=releaseMeasurements[scope.seriesId];
 return {id:scope.id,seriesId:scope.seriesId,period:scope.period,releaseStage:scope.releaseStage,estimate:scope.releaseStage==='published'?'Published':'Prior month in same release',publicationDate:scope.publicationDate,publicationDatePrecision:'day',publishedAt:null,value:Number(scope.sourceValue),sourceValue:scope.sourceValue,unit:measurement.unit,frequency:measurement.frequency,adjustment:measurement.adjustment,sourceUrl:scope.sourceUrl,releaseEvidenceUrl:scope.sourceUrl,sourceTitle:'Consumer Price Index News Release — Table A',sourceIds:[`BLS/CPI-U/Table-A/${scope.seriesId}`],sourceCells:{table:'cpi_pressa',row:scope.rowId,column:scope.columnId,headers:scope.headers},releaseNumber:scope.releaseNumber,licenseUrl:CPI_LICENSE,attribution:CPI_ATTRIBUTION,calculation:'Exact published CPI-U U.S. city average percentage cell in dated BLS Table A; no index-derived calculation, rounding or annualization applied. Publication measurement metadata is separate from current index-derived catalog history.',footnotes:['Monthly rates are seasonally adjusted; twelve-month rates are not seasonally adjusted.','Prior month is a separate reference month printed in this edition; a month-to-month movement is not a revision. Annual prior is not retained.','Same-month differences across retained editions do not establish the cause of a revision. Seasonal adjustment can revise historical monthly values.','Publication date has day precision. An embargo heading does not verify an actual publication instant.',...(scope.publicationDate<='2026-06-10'?[CPI_MISSING_MONTHS_NOTE]:[]),...(scope.publicationDate==='2026-02-13'?[CPI_FEBRUARY_SEASONAL_NOTE]:[])]};
}
export function assertCpiPublicationData(archive,{complete=false,ids}={}){
 if(!archive||archive.version!==1||Object.keys(archive).some(key=>!['version','releases'].includes(key))||!Array.isArray(archive.releases)||archive.releases.length>byId.size)fail('archive structure');
 const seen=new Set();
 for(const row of archive.releases){
  const scope=byId.get(row?.id);if(!scope||seen.has(row.id))fail('unknown or duplicate scope');seen.add(row.id);
  const {provenance,...metadata}=row;if(!isDeepStrictEqual(metadata,cpiPublicationMetadataFor(scope)))fail('record metadata or source cells');
  if(!Array.isArray(provenance)||provenance.length!==1)fail('one actual retrieval receipt required');
  const receipt=provenance[0],stamp=receipt?.retrievedAt;
  if(!receipt||Object.keys(receipt).some(key=>!['url','sha256','retrievedAt','lastModified'].includes(key))||receipt.url!==scope.sourceUrl||!/^[a-f0-9]{64}$/.test(receipt.sha256)||typeof stamp!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp)||!Number.isFinite(Date.parse(stamp))||new Date(stamp).toISOString()!==stamp||stamp.slice(0,10)<scope.publicationDate)fail('actual source retrieval receipt');
  if(receipt.lastModified!==null&&(typeof receipt.lastModified!=='string'||receipt.lastModified.length>200||!Number.isFinite(Date.parse(receipt.lastModified))))fail('last-modified metadata');
 }
 if(complete||ids!==undefined){const requested=requestedCpiPublicationIds(ids);if(requested.length!==seen.size||requested.some(id=>!seen.has(id)))fail('incomplete or unrequested batch');}
 return true;
}
