import {LABOR_EVIDENCE_URL,PCE_PRICE_CONTRIBUTIONS_URL,laborEvidenceDefinitions,pceContributionDefinitions,BLS_EVIDENCE_NOTICE} from './economic-evidence-definitions.js';
import {isIsoDate,resolveDateWindow} from './date-window.js';
import {buildPceBaseEffects,pceBaseEffectsCsv,PCE_BASE_EFFECTS_SCOPE} from './pce-base-effects.js';
import {economicEvidenceCsv} from './economic-evidence.js';
import {canonicalJson} from './research-workspaces.js';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const text=(value,max=4000)=>typeof value==='string'&&value.length<=max;
const fail=message=>{throw new Error('Invalid frozen economic evidence: '+message);};
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;
function keys(value,allowed){if(!plain(value)||Object.keys(value).some(key=>!allowed.includes(key)))fail('unexpected object fields');}
function receipts(rows,feeds,capturedAt){
 if(!Array.isArray(rows)||!rows.length||rows.length>8)fail('receipt count');
 for(const row of rows){keys(row,['url','sha256','retrievedAt','lastModified']);if(!feeds.includes(row.url)||!/^[a-f0-9]{64}$/.test(row.sha256)||!timestamp(row.retrievedAt)||row.retrievedAt>capturedAt||row.lastModified!==null&&row.lastModified!==undefined&&!text(row.lastModified,100))fail('source receipt');}
}
function notes(value){if(!Array.isArray(value)||value.length>20||value.some(note=>!plain(note)||Object.keys(note).some(key=>!['code','text'].includes(key))||!text(note.code,10)||!text(note.text,500)))fail('footnotes');}
function attachmentRows(rows,name){if(!Array.isArray(rows)||rows.length!==1)fail('attachments');const row=rows[0];keys(row,['name','content','type']);if(row.name!==name||row.type!=='text/csv'||!text(row.content,2*1024*1024))fail('attachment format');}

/** Shape and URL validation is not authentication of an imported file's claims. */
export function validateEconomicEvidenceContext(input){
 keys(input,['version','source','window','attachments','scope']);if(input.version!==1||!text(input.scope))fail('context version or scope');
 const source=input.source;keys(source,['id','status','fetchedAt','series','coverageNote','provenance','lastAttemptAt','error','failure','warnings']);
 const labor=source.id==='laborEvidence',pce=source.id==='pcePriceContributions';if(!labor&&!pce)fail('source ID');
 const definitions=labor?laborEvidenceDefinitions:pceContributionDefinitions,url=labor?LABOR_EVIDENCE_URL:PCE_PRICE_CONTRIBUTIONS_URL;
 if(!timestamp(source.fetchedAt)||source.lastAttemptAt!==undefined&&!timestamp(source.lastAttemptAt)||source.status!==undefined&&!['ok','error'].includes(source.status)||!text(source.coverageNote))fail('capture metadata');
 if(source.error!==null&&source.error!==undefined&&!text(source.error))fail('capture error');
 if(source.warnings!==undefined&&(!Array.isArray(source.warnings)||source.warnings.length>20||source.warnings.some(row=>!text(row))))fail('warnings');
 if(source.failure!==null&&source.failure!==undefined){keys(source.failure,['kind','status','requestedUrl','url','redirected']);if(source.failure.kind!=='http'||!Number.isInteger(source.failure.status)||source.failure.status<100||source.failure.status>599||source.failure.requestedUrl!==url||source.failure.url!==url||typeof source.failure.redirected!=='boolean')fail('failure metadata');}
 receipts(source.provenance,[url],source.fetchedAt);if(!source.provenance.some(row=>row.retrievedAt===source.fetchedAt))fail('capture receipt time');
 if(!plain(source.series)||Object.keys(source.series).sort().join(',')!==Object.keys(definitions).sort().join(','))fail('series scope');
 for(const [id,d]of Object.entries(definitions)){
  const s=source.series[id];keys(s,[...Object.keys(d),'observations','sourceIds','sourceUrl','sourceNotice','attribution','licenseUrl','calculation','frequency','adjustment','observationType','dataStatus','format','comparisonClass','dateConvention']);
  for(const [key,value]of Object.entries(d))if(s[key]!==value)fail('definition, unit or horizon identity');
  if(s.sourceUrl!==url||!Array.isArray(s.sourceIds)||s.sourceIds.length!==1||s.sourceIds[0]!==d.code||s.frequency!=='Monthly'||s.adjustment!=='Seasonally adjusted'||s.observationType!=='official'||!text(s.attribution)||!s.attribution.startsWith('Source:')||!text(s.calculation)||s.licenseUrl!==(labor?'https://www.bls.gov/opub/copyright-information.htm':'https://www.bea.gov/help/faq/147'))fail('source identity or rights');
  if(labor&&s.sourceNotice!==BLS_EVIDENCE_NOTICE)fail('required BLS notice');
  if(!Array.isArray(s.observations)||s.observations.length>120)fail('observation count');let previous='';
  for(const row of s.observations){keys(row,['date','value','sourceValue','publishedAt','footnotes']);if(!isIsoDate(row.date)||!row.date.endsWith('-01')||row.date<=previous||row.date>source.fetchedAt.slice(0,10)||row.publishedAt!==null||!text(row.sourceValue,40)||row.value!==null&&!finite(row.value))fail('observation date, value or publication precision');previous=row.date;
   if(labor){if(row.date<'2017-01-01'||finite(row.value)&&(row.value<0||d.horizonMonths&&row.value>100))fail('labor bounds');notes(row.footnotes);}
   const missing=['','-','—','(NA)','(ND)','(D)','NA','N/A','...','---'].includes(row.sourceValue);if(missing?row.value!==null:!/^[-+]?\d+(?:\.\d+)?$/.test(row.sourceValue)||Number(row.sourceValue)!==row.value)fail('native source value');
  }
 }
 if(pce){
  const maps=Object.fromEntries(Object.entries(source.series).map(([id,s])=>[id,new Map(s.observations.map(row=>[row.date,row.value]))]));
  for(const row of source.series.pcePriceGrowth.observations){const goods=maps.pceGoodsPriceContribution.get(row.date),services=maps.pceServicesPriceContribution.get(row.date);if([row.value,goods,services].every(finite)&&Math.abs(row.value-goods-services)>.060000001)fail('PCE contribution reconciliation');}
 }
 const w=input.window;keys(w,['mode','preset','count','startDate','endDate','label','error','fullStartDate','fullEndDate']);if(!['calendar','observations'].includes(w.mode)||!text(w.label,200)||w.error!==null&&!text(w.error,500)||w.count!==null&&(!Number.isInteger(w.count)||w.count<0||w.count>100000)||![null,'1y','3y','5y','all','custom','observations'].includes(w.preset))fail('window');
 for(const key of ['startDate','endDate','fullStartDate','fullEndDate'])if(w[key]!==null&&!isIsoDate(w[key]))fail('window date');
 if(w.startDate&&w.endDate&&w.startDate>w.endDate)fail('window order');
 const descriptor=w.preset==='observations'?{preset:'observations',count:w.count}:w.preset==='custom'?{preset:'custom',startDate:w.startDate,endDate:w.endDate}:{preset:w.preset};
 if(canonicalJson(resolveDateWindow(descriptor,Object.values(source.series)))!==canonicalJson(w))fail('window differs from captured source and selected preset');
 attachmentRows(input.attachments,source.id+'.csv');
 if(input.attachments[0].content!==economicEvidenceCsv(source,{range:w}))fail('CSV differs from selected captured observations');
 return input;
}

/** Recompute the model from captured indexes and assumptions before an imported scenario can render. */
export function validatePceBaseEffectsContext(input){
 keys(input,['version','indexSeries','model','attachments','scope']);if(input.version!==1||input.scope!==PCE_BASE_EFFECTS_SCOPE||!plain(input.indexSeries)||!plain(input.model))fail('PCE scenario context');
 const s=input.indexSeries,code=s.id==='pceIndex'?'DPCERG':s.id==='pceCoreIndex'?'DPCCRG':null;
 if(!code||s.code!==code||s.sourceUrl!==PCE_PRICE_CONTRIBUTIONS_URL||s.frequency!=='Monthly'||s.adjustment!=='Seasonally adjusted'||s.unit!=='Index, 2017=100'||!timestamp(s.fetchedAt)||!text(s.name,200)||!Array.isArray(s.observations)||s.observations.length>13)fail('PCE index identity');
 receipts(s.provenance,[PCE_PRICE_CONTRIBUTIONS_URL,'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt'],s.fetchedAt);
 if(s.source&&(!plain(s.source)||!text(s.source.name,200)||!['https://www.bea.gov/data/personal-consumption-expenditures-price-index','https://www.bea.gov/'].includes(s.source.url)))fail('PCE source URL');
 for(const row of s.observations){if(!plain(row)||!isIsoDate(row.date)||!row.date.endsWith('-01')||row.date>s.fetchedAt.slice(0,10)||row.publishedAt!==null||row.value!==null&&!finite(row.value)||!text(row.sourceValue,40)||row.value!==null&&(!/^[-+]?\d+(?:\.\d+)?$/.test(row.sourceValue)||Number(row.sourceValue)!==row.value))fail('PCE index observation');}
 const recomputed=buildPceBaseEffects(s,input.model.assumptions);if(canonicalJson(recomputed)!==canonicalJson(input.model))fail('PCE model differs from captured inputs');
 attachmentRows(input.attachments,'pce-base-effects.csv');
 if(input.attachments[0].content!==pceBaseEffectsCsv(s,input.model.assumptions))fail('PCE CSV differs from captured scenario');
 return input;
}
