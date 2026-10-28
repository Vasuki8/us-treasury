import {series as currentCatalog,dataStatus}from'./data.js';
import {compareSeries,transformSeries,toCsv,comparisonClassification,BLS_DATA_NOTICE}from'./model.js';
import {isIsoDate}from'./date-window.js';
import {defaults}from'./router.js';
import {viewRange}from'./workspace-context.js';
import {MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS,currentAccountGdpQuarterSpan}from'./current-account-gdp.js';
import {DEALER_METRICS}from'./market-functioning.js';
import {generatedFundingCsv}from'./market-functioning-page.js';
import {generatedAuctionsCsv}from'./auctions-page.js';
import {aggregateAuctionOfferings}from'./auctions.js';
import {validateEconomicEvidenceContext,validatePceBaseEffectsContext}from'./economic-evidence-validation.js';
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
 const rows=safeCsv(actual,MAX_RESEARCH_JSON_BYTES),computed=safeCsv(expected,MAX_RESEARCH_JSON_BYTES),jsonColumns=new Set(['capture_provenance_json','primary_source_values_json','fallback_source_values_json','rounded_source_inputs_json'].map(header=>computed[0].indexOf(header)));
 if(rows.length!==computed.length)return false;
 return rows.every((row,index)=>row.length===computed[index].length&&row.every((cell,column)=>{
  if(cell===computed[index][column])return true;
  if(!index||!jsonColumns.has(column))return false;
  // Canonical package JSON sorts object keys. Preserve the original exported
  // bytes, while proving JSON-valued cells have identical source data.
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
function validateFundingContext(context){
 const profile=context.fundingDistributions;
 if(!object(profile)||![1,2].includes(profile.version)||Object.keys(profile).some(key=>!(profile.version===1?['version','range']:['version','range','csvMode']).includes(key)))fail('funding distribution profile version');
 validateRange(profile.range);
 if(profile.version===1)return;
 if(profile.csvMode!=='generated-full-retained-v1')fail('funding distribution generated CSV method');
 if(context.attachments?.some(file=>file?.name?.toLowerCase()==='market-functioning.csv'))fail('funding generated CSV conflicts with a stored copy');
 const source=context.moduleSources?.marketFunctioning,ids=new Set([...Object.keys(DEALER_METRICS),'sofr','effr','sofrEffrSpread']);
 const invalid=detail=>fail(`funding retained market inputs: ${detail}`);
 const text=(value,fields)=>{for(const key of fields)if(value[key]!=null&&typeof value[key]!=='string')invalid(`${key} must be text`);};
 const strings=(value,key)=>{if(value[key]!==undefined&&(!Array.isArray(value[key])||value[key].some(item=>typeof item!=='string')))invalid(`${key} must be an array of text`);};
 const urls=value=>{
  strings(value,'sourceUrls');
  for(const url of [value.sourceUrl,value.licenseUrl,...(value.sourceUrls??[])].filter(Boolean))checkedUrl(url);
 };
 const metadata=['measure','observationType','calculation','coverageNote','sourceNotice','licenseUrl','sourceTitle','sourceUrl'];
 if(!object(source)||!object(source.series)||Object.keys(source.series).length!==ids.size||[...ids].some(id=>!Object.hasOwn(source.series,id)))invalid('complete frozen source required');
 text(source,[...metadata,'fetchedAt','lastAttemptAt']);urls(source);
 if(source.status!==undefined&&!['ok','error','unavailable'].includes(source.status))invalid('capture status');
 if(source.provenance!==undefined){
  if(!Array.isArray(source.provenance)||source.provenance.length>1000||source.provenance.some(receipt=>!object(receipt)))invalid('bounded source receipts required');
  for(const receipt of source.provenance){text(receipt,['url','retrievedAt','sha256','lastModified']);if(receipt.url)checkedUrl(receipt.url);}
 }
 for(const [id,item]of Object.entries(source.series)){
  if(!ids.has(id)||!object(item))invalid('unknown or malformed series');
  text(item,metadata);urls(item);strings(item,'sourceIds');
  if(!Array.isArray(item.observations)||!item.observations.length||item.observations.length>50000)invalid('nonempty bounded observations required');
  let previous='';
  for(const row of item.observations){
   if(!object(row)||!isIsoDate(row.date)||row.date<=previous)invalid('ordered unique observation dates required');
   previous=row.date;
   for(const key of ['value','volumeInBillions','percentile1','percentile25','percentile75','percentile99'])if(row[key]!==undefined&&row[key]!==null&&(typeof row[key]!=='number'||!Number.isFinite(row[key])))invalid('finite or null observations required');
   if(row.value===undefined)invalid('observation value required');
   text(row,['revisionIndicator','sourceValue','publishedAt','sourceUrl']);urls(row);strings(row,'footnotes');
   if(row.footnoteId!==undefined&&(!Number.isInteger(row.footnoteId)||row.footnoteId<1||row.footnoteId>3))invalid('source footnote identifier');
   if(row.percentileSourceValues!==undefined){
    const fields=['percentile1','percentile25','percentile75','percentile99'],raw=row.percentileSourceValues;
    if(id!=='sofr'||row.footnoteId!==2||!object(raw)||Object.keys(raw).length!==4||fields.some(key=>raw[key]!=='NA'||row[key]!==null))invalid('source NA percentile evidence');
   }
  }
 }
 // Count encoded rows without retaining them. Repeated receipts or notices must
 // not amplify a small import into unbounded work when the user downloads it.
 generatedFundingCsv(source,{validateOnly:true});
}
function validateAuctionContext(context){
 const profile=context.auctionExports,types=['All','Bill','Note','Bond','FRN','TIPS'];
 const invalid=detail=>fail(`auction retained inputs: ${detail}`);
 if(!object(profile)||profile.version!==1||Object.keys(profile).length!==4||['version','securityType','auctionId','csvMode'].some(key=>!Object.hasOwn(profile,key))||!types.includes(profile.securityType)||typeof profile.auctionId!=='string'||profile.csvMode!=='generated-full-retained-v1')invalid('unsupported export profile');
 if(context.attachments?.some(file=>['auction-results.csv','auction-peers.csv'].includes(file?.name?.toLowerCase())))invalid('generated CSV conflicts with a stored copy');
 const source=context.moduleSources?.auctions;
 if(!object(source)||!Array.isArray(source.auctions)||!source.auctions.length||source.auctions.length>10000)invalid('complete bounded auction source required');
 const text=(item,fields)=>{for(const field of fields)if(item[field]!=null&&typeof item[field]!=='string')invalid(`${field} must be text`);};
 text(source,['id','status','fetchedAt','lastAttemptAt','error','coverageNote','inputProvenanceScope']);
 if(source.status!==undefined&&!['ok','error','unavailable'].includes(source.status))invalid('capture status');
 if(!isIsoDate(source.coverageStart)||!isIsoDate(source.coverageEnd)||source.coverageStart>source.coverageEnd)invalid('coverage dates');
 if(source.inputProvenanceScope!==undefined&&source.inputProvenanceScope!=='auction-response-page-v1')invalid('unsupported receipt scope');
 if(!Array.isArray(source.provenance)||!source.provenance.length||source.provenance.length>10||source.provenance.some(receipt=>!object(receipt)))invalid('bounded response receipts required');
 for(const receipt of source.provenance){
  text(receipt,['url','sha256','retrievedAt','lastModified']);
  if(typeof receipt.url!=='string'||typeof receipt.sha256!=='string'||!/^[a-f0-9]{64}$/.test(receipt.sha256)||typeof receipt.retrievedAt!=='string')invalid('response receipt evidence');
  checkedUrl(receipt.url);
 }
 const ids=new Set();let previous='';
 for(const row of source.auctions){
  if(!object(row)||typeof row.id!=='string'||!row.id||ids.has(row.id)||!types.slice(1).includes(row.securityType)||typeof row.securityTerm!=='string'||!row.securityTerm||!['results','announced'].includes(row.status))invalid('auction identity or instrument');
  ids.add(row.id);
  for(const key of ['auctionDate','announcementDate','issueDate','maturityDate','sourceRecordDate'])if(!isIsoDate(row[key]))invalid('auction dates');
  const ordered=`${row.auctionDate}|${row.id}`;
  if(ordered<=previous||row.auctionDate<source.coverageStart||row.auctionDate>source.coverageEnd)invalid('ordered unique auction dates within coverage required');
  previous=ordered;
  text(row,['originalTerm','sourceUrl','resultUrl']);
  if(typeof row.sourceUrl!=='string')invalid('auction source URL');
  for(const url of [row.sourceUrl,row.resultUrl].filter(Boolean))checkedUrl(url);
  for(const key of ['reopening','cashManagement'])if(row[key]!==null&&typeof row[key]!=='boolean')invalid('auction class flags');
  for(const key of ['offeringAmount','competitiveAccepted','totalAccepted','somaAccepted','primaryDealerAccepted','directAccepted','indirectAccepted','bidToCover','highYield','highDiscountRate','highDiscountMargin'])if(row[key]!==null&&(typeof row[key]!=='number'||!Number.isFinite(row[key])))invalid('finite or null auction amounts');
  if(row.publishedAt!==null)invalid('unknown publication instant must remain null');
  if(source.inputProvenanceScope==='auction-response-page-v1'&&(!Number.isInteger(row.sourceReceiptIndex)||row.sourceReceiptIndex<0||row.sourceReceiptIndex>=source.provenance.length))invalid('response receipt index');
  if(source.inputProvenanceScope!=='auction-response-page-v1'&&Object.hasOwn(row,'sourceReceiptIndex'))invalid('response receipt indices require the explicit capture scope');
 }
 if(!source.auctions.some(row=>row.id===profile.auctionId&&(profile.securityType==='All'||row.securityType===profile.securityType))){
  if(profile.auctionId!==''||source.auctions.some(row=>profile.securityType==='All'||row.securityType===profile.securityType))invalid('selected auction does not match the retained filter');
 }
 const monthly=source.series?.auctionOfferingMonthly;
 if(!object(monthly)||!Array.isArray(monthly.observations)||!monthly.observations.length||monthly.observations.length>1200)invalid('complete monthly offering inputs required');
 previous='';
 for(const row of monthly.observations){
  if(!object(row)||!isIsoDate(row.date)||!row.date.endsWith('-01')||row.date<=previous||row.value!==null&&(typeof row.value!=='number'||!Number.isFinite(row.value)))invalid('ordered monthly offering observations');
  previous=row.date;
 }
 const fields=['date','value','auctionCount','pendingCount','partial','publishedAt'],facts=row=>Object.fromEntries(fields.map(key=>[key,row[key]]));
 const expected=aggregateAuctionOfferings(source.auctions,{startDate:source.coverageStart,endDate:source.coverageEnd});
 if(canonicalJson(monthly.observations.map(facts))!==canonicalJson(expected.map(facts)))invalid('monthly offering inputs do not match the complete retained auction history');
 // Count encoded rows without storing duplicate CSV strings or allowing a small
 // imported source note to amplify into an unbounded generated download.
 for(const benchmark of [false,true])generatedAuctionsCsv(source,{securityType:profile.securityType,auctionId:profile.auctionId,benchmark,validateOnly:true});
}
function validateContext(context){
 if(!object(context))fail('context must be data');
 if(context.economicEvidence!==undefined){
  if(!object(context.economicEvidence)||Object.keys(context.economicEvidence).some(id=>!['laborEvidence','pcePriceContributions'].includes(id)))fail('economic evidence source scope');
  for(const [id,evidence]of Object.entries(context.economicEvidence)){if(evidence?.source?.id!==id)fail('economic evidence source key');validateEconomicEvidenceContext(evidence);}
 }
 if(context.pceBaseEffects!==undefined)validatePceBaseEffectsContext(context.pceBaseEffects);
 const economicFiles=[...Object.values(context.economicEvidence??{}).flatMap(value=>value.attachments),...(context.pceBaseEffects?.attachments??[])];
 for(const expected of economicFiles){
  const actual=context.attachments?.find(file=>file?.name===expected.name);
  if(!actual||actual.content!==expected.content||actual.type!==expected.type)fail('economic evidence attachment differs from its validated source or scenario');
 }
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
 if(context.fundingDistributions!==undefined)validateFundingContext(context);
 if(context.auctionExports!==undefined)validateAuctionContext(context);
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
 if(!object(range)||!Object.hasOwn(range,'preset')||!['1y','3y','5y','all','custom','observations'].includes(range.preset)||Object.keys(range).some(key=>!['preset','startDate','endDate','alignment','count'].includes(key))||['startDate','endDate'].some(key=>range[key]!==undefined&&typeof range[key]!=='string')||range.alignment!==undefined&&range.alignment!=='quarter')fail('measurement date-window request');
 if(range.preset==='observations'&&(!Number.isInteger(range.count)||range.count<0||range.count>50000))fail('measurement observation count');
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
export function researchPackageAttachments(pkg){
 const context=branded(pkg).context,files=(context.attachments??[]).map(({name,type})=>({name,type,generated:false}));
 if(context.fundingDistributions?.version===2)files.push({name:'market-functioning.csv',type:'text/csv',generated:true});
 if(context.auctionExports?.version===1)for(const name of ['auction-results.csv','auction-peers.csv'])files.push({name,type:'text/csv',generated:true});
 return files;
}
/** Resolve the existing specialist-download action from validated frozen inputs. */
export function researchPackageAttachment(pkg,index){
 branded(pkg);
 if(!Number.isInteger(index)||index<0)fail('frozen attachment unavailable');
 const descriptor=researchPackageAttachments(pkg)[index];if(!descriptor)fail('frozen attachment unavailable');
 if(!descriptor.generated)return pkg.context.attachments[index];
 const profile=pkg.context.auctionExports;
 const content=descriptor.name==='market-functioning.csv'?generatedFundingCsv(pkg.context.moduleSources.marketFunctioning):generatedAuctionsCsv(pkg.context.moduleSources.auctions,{securityType:profile.securityType,auctionId:profile.auctionId,benchmark:descriptor.name==='auction-peers.csv'});
 return {name:descriptor.name,type:descriptor.type,content};
}
export function packagePanels(pkg){
 branded(pkg);return deepFreeze(pkg.panels.map(({seriesId,...panel})=>({...panel,series:pkg.catalog[seriesId]})));
}
