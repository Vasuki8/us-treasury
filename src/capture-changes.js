import {applyVintageCapture,normalizeVintageTimestamp,vintageMeasurementsComparable} from './vintages.js';
import {tabularCsv,BLS_DATA_NOTICE} from './model.js';
const checkpointKey='meridian.change-checkpoint.v1';
const clone=value=>JSON.parse(JSON.stringify(value));
const metadata=value=>Object.fromEntries(Object.entries(value??{}).filter(([key])=>key!=='observations'));
const sourceMetadata=value=>Object.fromEntries(Object.entries(value??{}).filter(([key])=>!['id','series','fetchedAt','provenance'].includes(key)));
const stable=value=>value&&typeof value==='object'?Array.isArray(value)?`[${value.map(stable).join(',')}]`:`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`:JSON.stringify(value);
const changedFields=(a={},b={})=>[...new Set([...Object.keys(a),...Object.keys(b)])].filter(key=>stable(a[key])!==stable(b[key]));

/** Facts about Meridian retrievals, not assertions that an economic release occurred. */
export function captureChanges(history,{ids=[],since}={}){
 const cutoff=normalizeVintageTimestamp(since),selected=new Set(ids),rows=[],replay={};
 const ordered=[...(history?.captures??[])].map(capture=>({...capture,capturedAt:normalizeVintageTimestamp(capture.capturedAt)})).sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)||a.sourceId.localeCompare(b.sourceId));
 for(const capture of ordered){
  const time=capture.capturedAt,prior=replay[capture.sourceId];
  const before=prior?{...prior,series:{...prior.series}}:undefined;
  applyVintageCapture(replay,capture);
  if(time<=cutoff)continue;
  const after=replay[capture.sourceId],sourceChanges=changedFields(sourceMetadata(before),sourceMetadata(after));
  const changedIds=[...new Set([...Object.keys(capture.series),...capture.removedSeries,...(sourceChanges.length?[...Object.keys(before?.series??{}),...Object.keys(after.series)]:[])])].filter(id=>selected.has(id));
  const provenance=Object.freeze(clone(capture.provenance??[]).map(Object.freeze)),previousProvenance=Object.freeze(clone(before?.provenance??[]).map(Object.freeze));
  for(const id of changedIds){
   const previous=before?.series?.[id],current=after?.series?.[id],oldRows=new Map((previous?.observations??[]).map(row=>[row.date,row]));
   const lastPrevious=previous?.observations.at(-1)?.date??null;
   const comparable=!previous||!current||vintageMeasurementsComparable({...before,...metadata(previous)},{...after,...metadata(current)});
   const inherited=[before,previous,after,current].filter(Boolean),joined=fields=>[...new Set(inherited.flatMap(item=>fields.map(field=>item[field])).filter(Boolean))].join('\n');
   const rights={sourceNotice:[joined(['sourceNotice','redistributionNotice']),capture.sourceId==='bls'?BLS_DATA_NOTICE:''].filter(Boolean).join('\n'),licenseUrls:joined(['licenseUrl','termsUrl']),attribution:joined(['attribution']),sourceTitle:joined(['sourceTitle'])};
   const add=(kind,period='',value=null,previousValue=null,publishedAt=null,fields=[])=>rows.push({id:`${capture.sourceId}|${time}|${id}|${kind}|${period}`,seriesId:id,sourceId:capture.sourceId,kind,period,value,previousValue,unit:(current?current.unit??after?.unit??previous?.unit??before?.unit:previous?.unit??before?.unit??after?.unit)??'Unknown captured unit',previousUnit:previous?.unit??before?.unit??null,comparable,capturedAt:time,recordedAt:capture.recordedAt,publicationDate:publishedAt,sourceUrl:current?.sourceUrl??after?.sourceUrl??previous?.sourceUrl??before?.sourceUrl??null,sourceIds:current?.sourceIds??after?.sourceIds??previous?.sourceIds??before?.sourceIds??[],provenance,previousProvenance,previousRetrievedAt:before?.fetchedAt??null,changedFields:fields,...rights});
   if(previous&&current){const fields=[...new Set([...sourceChanges,...changedFields(metadata(previous),metadata(current))])];if(fields.length)add('metadata-change','',null,null,null,fields);}
   for(const observation of current?.observations??[]){
    const prior=oldRows.get(observation.date);
    if(!prior)add(!previous?'first-capture':lastPrevious&&observation.date<lastPrevious?'historical-backfill':'new-period',observation.date,observation.value,null,observation.publishedAt??null);
    else if(prior.value!==observation.value)add('value-change',observation.date,observation.value,prior.value,observation.publishedAt??null);
    else{const fields=changedFields(prior,observation);if(fields.length)add('observation-metadata-change',observation.date,observation.value,prior.value,observation.publishedAt??null,fields);}
    oldRows.delete(observation.date);
   }
   for(const prior of oldRows.values())add('coverage-removal',prior.date,null,prior.value,prior.publishedAt??null);
  }
 }
 return rows.sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt)||b.period.localeCompare(a.period)||a.id.localeCompare(b.id));
}

export function changesCsv(rows){
 return tabularCsv(['capture_change_type','series_id','source_id','reference_period','previous_value','captured_value','captured_unit','previous_unit','measurement_comparable','captured_at_utc','history_recorded_at_utc','publication_date_if_known','source_url','source_ids','provenance_json','previous_retrieved_at','previous_provenance_json','source_notice','license_urls','attribution','source_title','changed_fields','interpretation'],rows.map(row=>[row.kind,row.seriesId,row.sourceId,row.period,row.previousValue,row.value,row.unit,row.previousUnit,row.comparable,row.capturedAt,row.recordedAt,row.publicationDate,row.sourceUrl,row.sourceIds.join('; '),JSON.stringify(row.provenance),row.previousRetrievedAt,JSON.stringify(row.previousProvenance),row.sourceNotice,row.licenseUrls,row.attribution,row.sourceTitle,(row.changedFields??[]).join('; '),'Capture evidence; a retrieval change does not verify a release, cause, purchase/sale or benchmark revision.']));
}

export function readChangeCheckpoint(storage,currentSnapshot){
 const fallback={enabled:false,since:normalizeVintageTimestamp(currentSnapshot),snapshotAt:normalizeVintageTimestamp(currentSnapshot),storageAvailable:Boolean(storage)};
 try{
  if(!storage)return fallback;
  const raw=JSON.parse(storage.getItem(checkpointKey)??'null');if(!raw)return fallback;
  return {enabled:raw.enabled===true,since:normalizeVintageTimestamp(raw.since),snapshotAt:normalizeVintageTimestamp(raw.snapshotAt),storageAvailable:true};
 }catch(error){return {...fallback,storageAvailable:error instanceof SyntaxError};}
}

export function writeChangeCheckpoint(storage,value){
 try{if(!storage)return false;storage.setItem(checkpointKey,JSON.stringify({enabled:value.enabled===true,since:normalizeVintageTimestamp(value.since),snapshotAt:normalizeVintageTimestamp(value.snapshotAt)}));return true;}
 catch{return false;}
}
