import { asKnownOn, recordVintages, normalizeVintageTimestamp } from '../src/vintages.js';
import {hasBlsHistory} from './bls-history-policy.mjs';
import {BLS_API_V1,BLS_API_V2} from './bls-api-policy.mjs';
import {BLS_IDS,BLS_DEPTH_IDS} from './sources/bls.mjs';
import {BLS_DESK_API,blsDeskNativeCodes} from '../src/bls-desk-definitions.js';
import {CPI_DETAIL_CODES} from '../src/cpi-detail.js';

const fail=message=>{throw new Error(`Invalid vintage archive: ${message}`);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const provenanceFields=new Set(['url','sha256','retrievedAt','lastModified']);
const blsHistoryProvenanceFields=new Set(['startYear','endYear','seriesIds']);
const blsNativeIds=new Set([...Object.values(BLS_IDS),...Object.values(BLS_DEPTH_IDS)]);
const censusProvenanceFields=new Set(['filename','fileUpdatedAt','usageNote']);
const censusZipMembers={census:'MARTS-mf.csv',housing:'RESCONST-mf.csv'};
const boardZipMembers={bankCredit:'H8_data.xml',lendingSurvey:'SLOOS_data.xml',fedBalance:'H41_data.xml',householdDebt:'DSR_data.xml',loanDelinquency:'CHGDEL_data.xml',fedQt:'H41_data.xml',fedFx:'H10_data.xml'};
const blsDeskProvenanceFields=new Set(['startYear','endYear','requestedSeries']);

function canonical(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
  if(object(value))return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  fail('unsupported capture content');
}

function retrievalProvenance(capture,capturedAt){
  if(!Array.isArray(capture.provenance)||!capture.provenance.length)fail('capture has no original retrieval provenance');
  const zipMember=Object.hasOwn(censusZipMembers,capture.sourceId)?censusZipMembers[capture.sourceId]:null;
  const boardMember=Object.hasOwn(boardZipMembers,capture.sourceId)?boardZipMembers[capture.sourceId]:null;
  const blsHistory=capture.sourceId==='bls'&&hasBlsHistory(capture.metadata);
  const blsDesk=['blsDesk','cpiDetail'].includes(capture.sourceId),deskCodes=capture.sourceId==='cpiDetail'?CPI_DETAIL_CODES:blsDeskNativeCodes;
  const retrievals=capture.provenance.map(item=>{
    if(!object(item)||Object.keys(item).some(key=>!provenanceFields.has(key)&&!(blsHistory&&blsHistoryProvenanceFields.has(key))&&!(blsDesk&&blsDeskProvenanceFields.has(key))&&!(zipMember&&censusProvenanceFields.has(key))&&!(boardMember&&key==='filename'))||typeof item.url!=='string'||!/^[a-f0-9]{64}$/.test(item.sha256))fail('invalid provenance fields, content or SHA256');
    if(blsDesk&&item.url===BLS_DESK_API&&(!Number.isInteger(item.startYear)||!Number.isInteger(item.endYear)||item.startYear<1900||item.endYear-item.startYear!==9||!Array.isArray(item.requestedSeries)||!item.requestedSeries.length||item.requestedSeries.length>25||new Set(item.requestedSeries).size!==item.requestedSeries.length||item.requestedSeries.some(code=>!deskCodes.includes(code))))fail('invalid BLS specialist public query provenance scope');
    if(blsHistory){
      const years=item.url===BLS_API_V1?10:item.url===BLS_API_V2?20:0;
      if(!years||!Number.isInteger(item.startYear)||!Number.isInteger(item.endYear)||item.startYear<1900||item.endYear>9999||item.startYear>item.endYear||item.endYear-item.startYear>=years||!Array.isArray(item.seriesIds)||!item.seriesIds.length||item.seriesIds.length>20||new Set(item.seriesIds).size!==item.seriesIds.length||item.seriesIds.some(code=>!blsNativeIds.has(code)))fail('invalid BLS history query provenance scope');
    }
    if(boardMember&&item.filename!==boardMember)fail('unreviewed Board provenance ZIP member');
    if(item.lastModified!==undefined&&item.lastModified!==null&&typeof item.lastModified!=='string')fail('invalid provenance last-modified metadata');
    if(zipMember){
      if([...censusProvenanceFields].some(key=>item[key]!==undefined&&typeof item[key]!=='string'))fail('invalid Census provenance metadata');
      if(item.filename!==undefined&&item.filename!==zipMember)fail('unreviewed Census provenance ZIP member');
      if(item.usageNote!==undefined&&(!item.usageNote.includes('U.S. Census Bureau')||!item.usageNote.includes('originating')))fail('missing Census provenance attribution conditions');
    }
    return normalizeVintageTimestamp(item.retrievedAt);
  });
  if(retrievals.sort().at(-1)!==capturedAt)fail('capture time does not match the latest actual response retrieval');
}

function inputProvenance(source){
  const captured=new Set(source.provenance.map(item=>item.url));
  const check=value=>{
    if(value.sourceUrls!==undefined&&!Array.isArray(value.sourceUrls))fail('invalid captured input URL list');
    for(const url of [value.sourceUrl,...(value.sourceUrls??[])])if(url!==undefined&&!captured.has(url))fail('captured input URL has no original response provenance');
  };
  check(source);
  for(const series of Object.values(source.series)){
    check(series);
    for(const observation of series.observations)check(observation);
  }
}

/** Admission applies to every capture, including history absent from the current snapshot. */
export function assertVintageData(vintages,validateSnapshot){
  if(vintages===undefined||vintages===null)return;
  if(!object(vintages)||vintages.version!==1||!Array.isArray(vintages.captures)||Object.keys(vintages).some(key=>!['version','captures'].includes(key)))fail('unsupported history format or content');
  if(typeof validateSnapshot!=='function')fail('an admission policy callback is required');
  const states=new Map();
  for(const capture of vintages.captures){
    if(!object(capture)||typeof capture.sourceId!=='string'||!/^[A-Za-z][A-Za-z0-9_-]*$/.test(capture.sourceId)||Object.hasOwn(Object.prototype,capture.sourceId))fail('invalid capture source identity');
    const capturedAt=normalizeVintageTimestamp(capture.capturedAt),recordedAt=normalizeVintageTimestamp(capture.recordedAt),previous=states.get(capture.sourceId);
    if(recordedAt<capturedAt)fail('recording predates the actual retrieval');
    if(capture.baseline!==!previous)fail('source must have exactly one initial baseline');
    if(previous&&capturedAt<=previous.fetchedAt)fail('duplicate capture identity or source retrieval order');
    retrievalProvenance(capture,capturedAt);

    // A temporary checkpoint keeps validation proportional to captured states;
    // retained capture records are never changed or replaced by this checkpoint.
    const checkpoint=previous?recordVintages(null,{}, {[capture.sourceId]:previous},{checkedAt:recordedAt}):{version:1,captures:[]};
    const state=asKnownOn({version:1,captures:[...checkpoint.captures,capture]},capturedAt).sources[capture.sourceId];
    inputProvenance(state);
    for(const series of Object.values(state.series))for(const observation of series.observations)if(observation.date>capturedAt.slice(0,10))fail('observation date follows its actual capture');

    // Round-tripping through the writer rejects unsupported raw fields, malformed
    // deltas and tombstones which replay alone could silently ignore.
    const expected=recordVintages(checkpoint,{}, {[capture.sourceId]:state},{checkedAt:recordedAt}).captures.at(-1);
    if(canonical({...capture,capturedAt,recordedAt})!==canonical(expected))fail('capture content or coverage tombstones do not match an exact immutable delta');
    validateSnapshot({sources:{[capture.sourceId]:state}});
    states.set(capture.sourceId,state);
  }
}
