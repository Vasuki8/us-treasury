import {series as currentCatalog,dataStatus}from'./data.js';
import {compareSeries,transformSeries,toCsv,comparisonClassification,BLS_DATA_NOTICE}from'./model.js';
import {isIsoDate}from'./date-window.js';
import {defaults}from'./router.js';
import {viewRange}from'./workspace-context.js';
import {MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS,currentAccountGdpQuarterSpan}from'./current-account-gdp.js';
import {canonicalJson,deepFreeze,researchJsonCopy,researchByteLength,researchId,researchName,researchTimestamp,MAX_RESEARCH_JSON_BYTES}from'./research-workspaces.js';

const verified=new WeakSet(),classes=new Set(['level','count','amount','rate','growth','contribution','balance','change','unknown']);
const keys=['schema','version','calculationVersion','id','name','createdAt','workspace','request','catalog','sources','snapshot','context','assumptions','resolvedWindow','panels','csv'];
const fail=message=>{throw new Error(`Invalid research package: ${message}`);};
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const formats=new Set(['number','index','percent','trillions','billions','basisPoints','percentagePoints','thousands','millions']);

async function checksum(body){
 const bytes=new TextEncoder().encode(canonicalJson(body));
 return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');
}
function branded(value){if(!verified.has(value))fail('use a validated package before rendering or exporting.');return value;}
function checkedUrl(value){
 if(typeof value!=='string'||value.length>4096)fail('source URL');
 let url;try{url=new URL(value);}catch{fail('source URL');}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password)fail('unsafe source URL');
}
function validateSeries(id,item){
 researchId(id);
 if(!object(item)||item.id!==id||typeof item.name!=='string'||!item.name||typeof item.unit!=='string'||!formats.has(item.format)||!Number.isInteger(item.precision)||item.precision<0||item.precision>12||!classes.has(item.comparisonClass))fail('captured series metadata');
 if(!object(item.source)||typeof item.source.name!=='string'||!Array.isArray(item.source.seriesIds)||item.source.seriesIds.some(value=>typeof value!=='string'))fail('captured source identifiers');
 for(const url of [item.source.url,item.sourceUrl,item.licenseUrl,item.termsUrl,...(item.sourceUrls??[])].filter(Boolean))checkedUrl(url);
 for(const row of item.provenance??[])if(row.url)checkedUrl(row.url);
 if(!Array.isArray(item.observations)||item.observations.length>50000)fail('observation count limit');
 let previous='';
 for(const row of item.observations){
  if(!object(row)||!isIsoDate(row.date)||row.date<=previous||row.value!==null&&(typeof row.value!=='number'||!Number.isFinite(row.value)))fail('ordered unique dates and finite/null observations required');
  previous=row.date;
  for(const url of [row.sourceUrl,...(row.sourceUrls??[])].filter(Boolean))checkedUrl(url);
 }
}

/** Validate CSV as data, including tabs/control characters before active text. */
function safeCsv(text,maxBytes=8*1024*1024){
 if(typeof text!=='string'||researchByteLength(text)>maxBytes)fail('CSV byte limit');
 let cell='',quoted=false,closed=false,atStart=true,row=[];const rows=[];
 const check=()=>{
  const clean=cell.replace(/^[\s\u0000-\u001f\u007f]*/u,'');
  if(/^[=+@-]/.test(clean)&&!(/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(clean)))fail('formula-active CSV text');
  row.push(cell);cell='';closed=false;atStart=true;
 };
 for(let index=0;index<text.length;index++){
  const character=text[index];
  if(quoted){if(character==='"'&&text[index+1]==='"'){cell+='"';index++;}else if(character==='"'){quoted=false;closed=true;}else cell+=character;continue;}
  if(character==='"'){if(!atStart||closed)fail('malformed CSV quoting');quoted=true;atStart=false;}
  else if(character===',')check();
  else if(character==='\r'||character==='\n'){check();rows.push(row);row=[];if(character==='\r'&&text[index+1]==='\n')index++;}
  else{if(closed)fail('malformed CSV closing quote');cell+=character;atStart=false;}
 }
 if(quoted)fail('unterminated CSV quote');if(row.length||cell||!/[\r\n]$/.test(text)){check();rows.push(row);}return rows;
}
function matchingCsv(actual,expected){
 const rows=safeCsv(actual,MAX_RESEARCH_JSON_BYTES),computed=safeCsv(expected,MAX_RESEARCH_JSON_BYTES),provenance=computed[0].indexOf('capture_provenance_json');
 if(rows.length!==computed.length)return false;
 return rows.every((row,index)=>row.length===computed[index].length&&row.every((cell,column)=>{
  if(cell===computed[index][column])return true;
  if(!index||column!==provenance)return false;
  // Canonical package JSON sorts object keys. Preserve the original exported
  // bytes, while proving this one JSON-valued cell has identical source data.
  try{return canonicalJson(researchJsonCopy(JSON.parse(cell)))===canonicalJson(JSON.parse(computed[index][column]));}catch{return false;}
 }));
}

/** Supplementary inputs are recorded claims, but must be safe to render. */
function validateCurrentAccountInputs(source,{label='current-account inputs',seriesIds=['currentAccountBalance','itaGoodsServicesBalance','itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance'],maxObservations=50000,extraMetadata=[]}={}){
 const invalid=detail=>fail(`${label}: ${detail}`);
 const text=(item,fields)=>{
  for(const field of fields)if(item[field]!==undefined&&item[field]!==null&&typeof item[field]!=='string')invalid(`${field} must be text`);
 };
 const strings=(item,field)=>{
  if(item[field]!==undefined&&(!Array.isArray(item[field])||item[field].some(value=>typeof value!=='string')))invalid(`${field} must be an array of text`);
 };
 const dates=(item,fields)=>{
  for(const field of fields)if(item[field]!==undefined&&item[field]!==null&&!isIsoDate(item[field]))invalid(`${field} must be an ISO date`);
 };
 const metadata=['id','sourceTitle','sourceUrl','licenseUrl','termsUrl','attribution','sourceNotice','redistributionNotice','coverageNote','publicationNote','calculation','unit','sourceUnit','sourceUnits','frequency','adjustment','dateConvention','periodType','comparisonClass','observationType','definition',...extraMetadata];
 const evidence=item=>{
  if(item.provenance===undefined)return;
  if(!Array.isArray(item.provenance)||item.provenance.some(row=>!object(row)))invalid('provenance must be an array of records');
  for(const row of item.provenance)text(row,['url','sha256','retrievedAt','lastModified']);
 };
 if(!object(source))invalid('source must be a record');
 text(source,[...metadata,'error','fetchedAt','lastAttemptAt']);
 if(source.status!==undefined&&!['ok','error','unavailable'].includes(source.status))invalid('source status');
 dates(source,['tableReleaseDate','nextReleaseDate','coverageStart','coverageEnd']);
 strings(source,'warnings');strings(source,'sourceUrls');evidence(source);
 if(source.series!==undefined&&!object(source.series))invalid('series must be a record');
 const ids=new Set(seriesIds);
 for(const [id,item]of Object.entries(source.series??{})){
  if(!ids.has(id)||!object(item))invalid('unknown or malformed series');
  text(item,metadata);strings(item,'sourceIds');strings(item,'sourceUrls');evidence(item);
  if(!Array.isArray(item.observations)||item.observations.length>maxObservations)invalid('observations must be a bounded array');
  let previous='';
  for(const row of item.observations){
   if(!object(row)||!isIsoDate(row.date)||!/^\d{4}-(?:01|04|07|10)-01$/.test(row.date)||row.date<=previous)invalid('ordered unique quarter-start dates required');
   if(row.value!==null&&(typeof row.value!=='number'||!Number.isFinite(row.value)))invalid('finite or null observation values required');
   previous=row.date;
   text(row,['sourceValue','sourcePeriodLabel','publishedAt']);strings(row,'footnotes');
  }
 }
}
function validateContext(context){
 if(!object(context))fail('context must be data');
 if(context.currentAccountInputs!==undefined)validateCurrentAccountInputs(context.currentAccountInputs);
 if(context.currentAccountGdpDenominator!==undefined)validateCurrentAccountInputs(context.currentAccountGdpDenominator,{label:'current-account GDP denominator',seriesIds:['nominalGdp'],maxObservations:2,extraMetadata:['dataStatus']});
 if(context.currentAccountGdpHistory!==undefined){
  const history=context.currentAccountGdpHistory;
  if(!object(history)||Object.keys(history).length!==3||['version','range','sources'].some(key=>!Object.hasOwn(history,key))||history.version!==1)fail('current-account GDP history envelope');
  validateRange(history.range);
  if(!object(history.sources)||Object.keys(history.sources).length!==2||['beaIta','bea'].some(key=>!Object.hasOwn(history.sources,key)))fail('current-account GDP history sources');
  validateCurrentAccountInputs(history.sources.beaIta,{label:'current-account GDP history ITA inputs',seriesIds:['currentAccountBalance'],maxObservations:MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS});
  validateCurrentAccountInputs(history.sources.bea,{label:'current-account GDP history GDP inputs',seriesIds:['nominalGdp'],maxObservations:MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS,extraMetadata:['dataStatus']});
  const observations=history.sources.beaIta.series?.currentAccountBalance?.observations??[];
  if(currentAccountGdpQuarterSpan(observations[0]?.date,observations.at(-1)?.date)>MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS)fail('current-account GDP history calendar-quarter span limit');
 }
 if(context.currentAccountGdpBreakdown!==undefined){
  const breakdown=context.currentAccountGdpBreakdown;
  if(!object(breakdown)||Object.keys(breakdown).length!==3||['version','range','sources'].some(key=>!Object.hasOwn(breakdown,key))||breakdown.version!==1)fail('current-account GDP breakdown envelope');
  validateRange(breakdown.range);
  if(!object(breakdown.sources)||Object.keys(breakdown.sources).length!==2||['beaIta','bea'].some(key=>!Object.hasOwn(breakdown.sources,key)))fail('current-account GDP breakdown sources');
  const itaIds=['currentAccountBalance','itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance'];
  validateCurrentAccountInputs(breakdown.sources.beaIta,{label:'current-account GDP breakdown ITA inputs',seriesIds:itaIds,maxObservations:MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS});
  validateCurrentAccountInputs(breakdown.sources.bea,{label:'current-account GDP breakdown GDP inputs',seriesIds:['nominalGdp'],maxObservations:MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS,extraMetadata:['dataStatus']});
  let firstIta='',lastIta='';
  for(const [agency,source]of Object.entries(breakdown.sources))for(const item of Object.values(source.series??{})){
   const rows=item.observations,first=rows[0]?.date,last=rows.at(-1)?.date;
   if(currentAccountGdpQuarterSpan(first,last)>MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS)fail('current-account GDP breakdown calendar-quarter span limit');
   if(agency==='beaIta'&&first){if(!firstIta||first<firstIta)firstIta=first;if(!lastIta||last>lastIta)lastIta=last;}
  }
  if(currentAccountGdpQuarterSpan(firstIta,lastIta)>MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS)fail('current-account GDP breakdown combined ITA calendar-quarter span limit');
 }
 if(context.currentAccountGdpTrailing!==undefined){
  const trailing=context.currentAccountGdpTrailing;
  if(!object(trailing)||Object.keys(trailing).length!==3||['version','range','inputContext'].some(key=>!Object.hasOwn(trailing,key))||trailing.version!==1)fail('current-account GDP trailing envelope');
  validateRange(trailing.range);
  if(trailing.inputContext!=='currentAccountGdpBreakdown'||context.currentAccountGdpBreakdown===undefined)fail('current-account GDP trailing retained input context');
 }
 if(context.currentAccountGdpComparison!==undefined){
  const comparison=context.currentAccountGdpComparison;
  if(!object(comparison)||Object.keys(comparison).length!==4||['version','range','measure','inputContext'].some(key=>!Object.hasOwn(comparison,key))||comparison.version!==1)fail('current-account GDP comparison envelope');
  validateRange(comparison.range);
  if(!['currentAccountBalance','itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance'].includes(comparison.measure))fail('current-account GDP comparison measurement');
  if(comparison.inputContext!=='currentAccountGdpBreakdown'||context.currentAccountGdpBreakdown===undefined)fail('current-account GDP comparison retained input context');
 }
 if(context.currentAccountGdpContributions!==undefined){
  const contributions=context.currentAccountGdpContributions;
  if(!object(contributions)||Object.keys(contributions).length!==3||['version','range','inputContext'].some(key=>!Object.hasOwn(contributions,key))||contributions.version!==1)fail('current-account GDP contributions envelope');
  validateRange(contributions.range);
  if(contributions.inputContext!=='currentAccountGdpBreakdown'||context.currentAccountGdpBreakdown===undefined)fail('current-account GDP contributions retained input context');
 }
 if(context.currentAccountGdpBalanceEffects!==undefined){
  const effects=context.currentAccountGdpBalanceEffects;
  if(!object(effects)||Object.keys(effects).length!==4||['version','method','range','inputContext'].some(key=>!Object.hasOwn(effects,key))||effects.version!==1)fail('current-account GDP balance effects envelope');
  if(effects.method!=='symmetric-two-order-v1')fail('current-account GDP balance effects method');
  validateRange(effects.range);
  if(effects.inputContext!=='currentAccountGdpBreakdown'||context.currentAccountGdpBreakdown===undefined)fail('current-account GDP balance effects retained input context');
 }
 if(context.currentAccountGdpComponentEffects!==undefined){
  const effects=context.currentAccountGdpComponentEffects;
  if(!object(effects)||Object.keys(effects).length!==5||['version','method','measure','range','inputContext'].some(key=>!Object.hasOwn(effects,key))||effects.version!==1)fail('current-account GDP component effects envelope');
  if(effects.method!=='symmetric-two-order-v1')fail('current-account GDP component effects method');
  if(!['itaGoodsBalance','itaServicesBalance','itaPrimaryIncomeBalance','itaSecondaryIncomeBalance'].includes(effects.measure))fail('current-account GDP component effects measurement');
  validateRange(effects.range);
  if(effects.inputContext!=='currentAccountGdpBreakdown'||context.currentAccountGdpBreakdown===undefined)fail('current-account GDP component effects retained input context');
 }
 if(context.currentAccountGdpAllComponentEffects!==undefined){
  const effects=context.currentAccountGdpAllComponentEffects;
  if(!object(effects)||Object.keys(effects).length!==4||['version','method','range','inputContext'].some(key=>!Object.hasOwn(effects,key))||effects.version!==1)fail('current-account GDP all-component effects envelope');
  if(effects.method!=='symmetric-two-order-v1')fail('current-account GDP all-component effects method');
  validateRange(effects.range);
  if(effects.inputContext!=='currentAccountGdpBreakdown'||context.currentAccountGdpBreakdown===undefined)fail('current-account GDP all-component effects retained input context');
 }
 if(context.attachments!==undefined){
  if(!Array.isArray(context.attachments)||context.attachments.length>20)fail('attachment count');
  const names=new Set();
  for(const file of context.attachments){
   if(!object(file)||Object.keys(file).some(key=>!['name','content','type'].includes(key))||typeof file.name!=='string'||!/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,119}\.csv$/.test(file.name)||names.has(file.name)||file.type!=='text/csv')fail('attachment name or type');
   names.add(file.name);safeCsv(file.content);
  }
 }
}
function selection(state,catalog){
 const ids=state.selected;
 if(!Array.isArray(ids)||ids.length<1||ids.length>4||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!Object.hasOwn(catalog,id)))fail('select one to four unique captured series');
 ids.forEach(researchId);return [...ids];
}
function displayed(request,catalog){
 const result=compareSeries(request.ids,request.comparison,request.range,catalog);
 if(result.error)fail(result.error);
 const panels=request.comparison==='native'?result.panels.map(panel=>transformSeries(panel.series,request.transform,request.range,result.window)):result.panels;
 return {resolvedWindow:result.window,panels:panels.map(({series,...panel})=>({seriesId:series.id,...panel})),csv:toCsv(request.ids,{comparison:request.comparison,transform:request.transform,range:request.range,catalog,maxBytes:MAX_RESEARCH_JSON_BYTES})};
}
function validateRange(range){
 if(typeof range==='number'&&Number.isInteger(range)&&range>=0&&range<=50000)return;
 if(!object(range)||!Object.hasOwn(range,'preset')||!['1y','3y','5y','all','custom'].includes(range.preset)||Object.keys(range).some(key=>!['preset','startDate','endDate'].includes(key))||['startDate','endDate'].some(key=>range[key]!==undefined&&typeof range[key]!=='string'))fail('measurement date-window request');
 if(range.preset==='custom'&&(!isIsoDate(range.startDate)||!isIsoDate(range.endDate)||range.startDate>range.endDate))fail('measurement custom date-window request');
}
function validateBody(body){
 if(!object(body)||Object.keys(body).length!==keys.length||keys.some(key=>!Object.hasOwn(body,key))||Object.keys(body).some(key=>!keys.includes(key))||body.schema!=='meridian.research-package'||body.version!==1||body.calculationVersion!=='meridian-series-v1')fail('unsupported schema or calculation version');
 researchId(body.id);if(researchName(body.name)!==body.name)fail('stored package name');researchTimestamp(body.createdAt);
 if(!object(body.catalog)||!object(body.request)||Object.keys(body.request).length!==4||['ids','transform','comparison','range'].some(key=>!Object.hasOwn(body.request,key))||!['level','change'].includes(body.request.transform)||!['native','indexed','difference'].includes(body.request.comparison))fail('measurement request');
 validateRange(body.request.range);
 const ids=selection({selected:body.request.ids},body.catalog);
 if(Object.keys(body.catalog).length!==ids.length||Object.keys(body.catalog).some(id=>!ids.includes(id)))fail('captured catalog selection');
 for(const [id,item]of Object.entries(body.catalog))validateSeries(id,item);
 if(!object(body.workspace)||!object(body.sources)||!object(body.snapshot)||!object(body.assumptions))fail('captured context metadata');
 validateContext(body.context);safeCsv(body.csv,MAX_RESEARCH_JSON_BYTES);
 const expected=displayed(body.request,body.catalog);
 if(canonicalJson(expected.panels)!==canonicalJson(body.panels)||canonicalJson(expected.resolvedWindow)!==canonicalJson(body.resolvedWindow)||!matchingCsv(body.csv,expected.csv))fail('stored panels or CSV do not match the captured inputs and formulas');
}
function accept(body,digest){
 const value={...body,checksum:{algorithm:'SHA-256',value:digest}};
 if(researchByteLength(canonicalJson(value))>MAX_RESEARCH_JSON_BYTES)fail('JSON byte limit');
 deepFreeze(value);verified.add(value);return value;
}

/** The checksum proves byte integrity, never publisher identity or official authenticity. */
export async function createResearchPackage({name,state={},catalog=currentCatalog,sources=dataStatus.sources,snapshot={generatedAt:dataStatus.generatedAt},context={},assumptions={},id=globalThis.crypto.randomUUID(),now=new Date()}={}){
 const ids=selection(state,catalog),captured={};
 for(const selected of ids){
  const item=catalog[selected],official=sources?.[item.agency]?.series?.[selected];
  captured[selected]={...item,comparisonClass:item.comparisonClass??comparisonClassification(item)};
  for(const key of ['sourceNotice','redistributionNotice','termsUrl','licenseUrl','attribution','sourceTitle','programName'])if(!captured[selected][key]&&official?.[key])captured[selected][key]=official[key];
  if(item.agency==='bls'&&!captured[selected].sourceNotice?.includes(BLS_DATA_NOTICE))captured[selected].sourceNotice=[captured[selected].sourceNotice,BLS_DATA_NOTICE].filter(Boolean).join(' ');
 }
 const frozenCatalog=researchJsonCopy(captured),request={ids,transform:state.transform??'level',comparison:state.comparison??'native',range:viewRange(state)};
 const capturedSources={};
 for(const agency of [...new Set(ids.map(key=>catalog[key].agency))].filter(Boolean)){
  const source=sources?.[agency]??{};
  capturedSources[agency]=Object.fromEntries(['id','status','fetchedAt','lastAttemptAt','error','warnings','coverageNote','provenance','sourceNotice','licenseUrl','termsUrl','attribution','sourceTitle'].filter(key=>source[key]!==undefined).map(key=>[key,source[key]]));
  capturedSources[agency].seriesMetadata=Object.fromEntries(ids.filter(key=>catalog[key].agency===agency).map(key=>[key,Object.fromEntries(Object.entries(source.series?.[key]??{}).filter(([field])=>field!=='observations'))]));
 }
 const workspace=Object.fromEntries(Object.keys(defaults).filter(key=>state[key]!==undefined&&key!=='returnTo').map(key=>[key,state[key]]));workspace.selected=ids;
 const body=researchJsonCopy({schema:'meridian.research-package',version:1,calculationVersion:'meridian-series-v1',id:researchId(id),name:researchName(name),createdAt:researchTimestamp(now),workspace,request,catalog:frozenCatalog,sources:capturedSources,snapshot,context,assumptions,...displayed(request,captured)});
 validateBody(body);return accept(body,await checksum(body));
}
export async function importResearchPackage(text){
 if(typeof text!=='string'||researchByteLength(text)>MAX_RESEARCH_JSON_BYTES)fail('JSON byte limit');
 let value;try{value=JSON.parse(text.replace(/^\ufeff/,''));}catch{fail('invalid JSON');}
 value=researchJsonCopy(value);
 if(!object(value)||!object(value.checksum)||value.checksum.algorithm!=='SHA-256'||typeof value.checksum.value!=='string'||!/^[a-f0-9]{64}$/.test(value.checksum.value)||Object.keys(value.checksum).length!==2)fail('checksum metadata');
 const {checksum:digest,...body}=value;
 if(await checksum(body)!==digest.value)fail('checksum integrity mismatch');
 validateBody(body);return accept(body,digest.value);
}
export function exportResearchPackage(pkg){return canonicalJson(branded(pkg));}
export function researchPackageCsv(pkg){return branded(pkg).csv;}
export function packagePanels(pkg){
 branded(pkg);return deepFreeze(pkg.panels.map(({seriesId,...panel})=>({...panel,series:pkg.catalog[seriesId]})));
}
