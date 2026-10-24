import {searchSeries} from './search.js';
import {isIsoDate} from './date-window.js';
import {tabularCsv,BLS_DATA_NOTICE} from './model.js';

const publicationSeries={gdp:['gdp','gdp'],claims:['claims','claimsAdvance'],continuedClaims:['claims','continuedClaimsAdvance'],claimsAdvance:['claims','claimsAdvance'],continuedClaimsAdvance:['claims','continuedClaimsAdvance'],cpi:['cpi','cpi'],cpiCore:['cpi','cpiCore'],cpiMonthly:['cpi','cpiMonthly'],cpiCoreMonthly:['cpi','cpiCoreMonthly']};
function publicationCoverage(id,contexts){
 const mapping=publicationSeries[id];
 if(!mapping)return {status:'unsupported',seriesId:null,firstDate:null,lastDate:null,factCount:0};
 const [family,seriesId]=mapping,context=contexts[family];
 const facts=context?.status==='ready'?(context.archive?.releases??[]).filter(x=>x.seriesId===seriesId&&isIsoDate(x.publicationDate)):[];
 const dates=facts.map(x=>x.publicationDate).sort();
 return {status:context?.status==='ready'?'ready':['loading','error'].includes(context?.status)?context.status:'unloaded',seriesId,firstDate:dates[0]??null,lastDate:dates.at(-1)??null,factCount:facts.length,error:context?.error??null};
}
const historyType=current=>current.agency==='dolAdvance'?'latest-release-context':current.agency==='fiscal'&&current.id!=='publicDebt'?'statement-history':'current-history';
const retainedFields=['id','name','short','code','topic','agency','frequency','unit','adjustment','observationType','dataStatus','fetchedAt','error','source','sourceTitle','measure','sourceNotice','licenseUrl','provenance','definition','calculation','coverageNote'];

/** Reference coverage is metadata about retained observations, never publication-vintage coverage. */
export function buildCoverageInventory(catalog,{query='',topic='All topics',frequency='All frequencies',publicationContexts={},registeredCount}={}){
 const all=Object.values(catalog??{}),matching=searchSeries(all,{query,topic,frequency});
 const rows=matching.map(current=>{
  const observations=current.observations??[],dates=observations.map(x=>x?.date).filter(isIsoDate).sort();
  const sourceNotice=[current.sourceNotice,current.agency==='bls'?BLS_DATA_NOTICE:''].filter(Boolean).filter((x,i,a)=>a.indexOf(x)===i).join(' ');
  return {id:current.id,name:current.name,code:current.code,topic:current.topic,agency:current.agency,frequency:current.frequency,unit:current.unit,adjustment:current.adjustment,observationType:['official','calculated'].includes(current.observationType)?current.observationType:'unspecified',historyType:historyType(current),firstReference:dates[0]??null,lastReference:dates.at(-1)??null,totalCount:observations.length,usableCount:observations.filter(x=>isIsoDate(x?.date)&&Number.isFinite(x?.value)&&!x.suppressed).length,captureStatus:current.dataStatus==='unavailable'||!current.fetchedAt?'unavailable':current.dataStatus==='cached'?'cached':'captured',retrievedAt:current.fetchedAt??null,error:current.error??null,source:current.source??{},sourceNotice,licenseUrl:current.licenseUrl??'',provenance:current.provenance??[],definition:current.definition??'',calculation:current.calculation??'',coverageNote:current.coverageNote??'',publications:publicationCoverage(current.id,publicationContexts)};
 }).sort((a,b)=>String(a.topic).localeCompare(String(b.topic))||String(a.name).localeCompare(String(b.name)));
 const inputs=Object.fromEntries(matching.map(current=>[current.id,{...Object.fromEntries(retainedFields.filter(key=>current[key]!==undefined).map(key=>[key,current[key]])),observations:(current.observations??[]).map(x=>({date:x.date,value:x.value,suppressed:Boolean(x.suppressed)}))}]));
 return {version:1,totalRegistered:registeredCount??all.length,filters:{query,topic,frequency},rows,inputs};
}

export function coverageInventoryCsv(inventory){
 return tabularCsv(['series_id','name','topic','observation_type','reference_history_type','first_reference_date','last_reference_date','usable_observations','total_observations','frequency','unit','adjustment','capture_status','retrieved_at','source_name','source_ids','source_url','publication_archive_status','publication_fact_count','first_retained_publication_day','last_retained_publication_day','coverage_note','definition','calculation','source_notice','license_url','capture_provenance_json'],inventory.rows.map(row=>[row.id,row.name,row.topic,row.observationType,row.historyType,row.firstReference,row.lastReference,row.usableCount,row.totalCount,row.frequency,row.unit,row.adjustment,row.captureStatus,row.retrievedAt,row.source.name,(row.source.seriesIds??[]).join('; '),row.source.url,row.publications.status,row.publications.factCount,row.publications.firstDate,row.publications.lastDate,row.coverageNote,row.definition,row.calculation,row.sourceNotice,row.licenseUrl,JSON.stringify(row.provenance)]));
}
