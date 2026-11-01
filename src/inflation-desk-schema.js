import {inflationDeskDefinitions,inflationDeskRegistry,INFLATION_DESK_LIMIT,INFLATION_INPUT_LIMIT,CLEVELAND_IMPUTED_DATES,CLEVELAND_METHOD_URL,CLEVELAND_LICENSE,BEA_MONTHLY_URL} from './inflation-desk-definitions.js';
const fail=message=>{throw new Error('Inflation desk: '+message);};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
const canonical=value=>Array.isArray(value)?value.map(canonical):plain(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
function keys(value,allowed){if(!plain(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail('unreviewed object fields');}
function date(value){return typeof value==='string'&&/^\d{4}-\d{2}-01$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function instant(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value;}
function monthOffset(value,offset){const d=new Date(value+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+offset);return d.toISOString().slice(0,10);}
function nativeNumber(value){if(typeof value!=='string'||value.length>80)fail('native source string');if(['','(NA)','(ND)','(D)','NA','N/A','...','---'].includes(value))return null;if(!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value))fail('native numeric syntax');const n=Number(value.replaceAll(',',''));if(!finite(n))fail('nonfinite native number');return n;}
function checkedInputs(id,inputs,cutoff){
 const d=inflationDeskDefinitions[id];if(!d||!plain(inputs)||!equal(Object.keys(inputs).sort(),Object.keys(d.native).sort())||!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)||!Number.isFinite(Date.parse(cutoff+'T00:00:00Z'))||new Date(cutoff+'T00:00:00Z').toISOString().slice(0,10)!==cutoff)fail('input family or cutoff');
 const maps={};for(const [code,spec]of Object.entries(d.native)){
  const rows=inputs[code];if(!Array.isArray(rows)||!rows.length||rows.length>INFLATION_INPUT_LIMIT)fail('native observation count');let previous='';const map=new Map();
  for(const row of rows){keys(row,['date','value','sourceValue','publishedAt']);if(!date(row.date)||row.date<=previous||row.date>cutoff||row.publishedAt!==null)fail('native observation date or publication precision');previous=row.date;
   const n=nativeNumber(row.sourceValue);if(n!==row.value)fail('native source value differs');
   if(n!==null&&(spec.metric==='Current Dollars'&&n<0||spec.metric==='Fisher Price Index'&&spec.calculation==='Level'&&n<=0||spec.kind==='monthly-fraction'&&n<=-1||spec.kind==='annualized-percent'&&n<=-100))fail('native units or bounds');map.set(row.date,row);
  }maps[code]=map;
 }return maps;
}
/** Browser-safe deterministic arithmetic; captured native inputs are the replay authority. */
export function buildInflationDeskSeries(id,inputs,{cutoff}={}){
 const d=inflationDeskDefinitions[id],maps=checkedInputs(id,inputs,cutoff),series={};
 for(const [key,s]of Object.entries(d.series)){
  const registry=inflationDeskRegistry[key],url=id==='inflationBea'?BEA_MONTHLY_URL:s.url;
  const observations=[...maps[s.code].values()].slice(-INFLATION_DESK_LIMIT).map(raw=>{
   let value=raw.value,imputed=false,imputationAffected=false,inputDates=[raw.date];
   if(s.mode==='fraction')value=value===null?null:value*100;
   if(s.mode==='annual'){const base=maps[s.code].get(monthOffset(raw.date,-12));value=finite(value)&&finite(base?.value)&&base.value>0?100*(value/base.value-1):null;inputDates=[monthOffset(raw.date,-12),raw.date];}
   if(s.mode==='share'){const base=maps[s.denominator].get(raw.date);value=finite(value)&&finite(base?.value)&&base.value>0?100*value/base.value:null;if(finite(value)&&value>100)fail('category expenditure share exceeds total');}
   if(s.mode==='compound'){inputDates=Array.from({length:12},(_,n)=>monthOffset(raw.date,n-11));const rows=inputDates.map(day=>maps[s.code].get(day));value=rows.every(row=>finite(row?.value))?100*(rows.reduce((product,row)=>product*(1+row.value),1)-1):null;}
   if(id==='inflationCleveland'){imputed=CLEVELAND_IMPUTED_DATES.includes(raw.date);imputationAffected=inputDates.some(day=>CLEVELAND_IMPUTED_DATES.includes(day));}
   return {...raw,value,...(['annual','share','compound'].includes(s.mode)?{inputDates}:{}),...(id==='inflationCleveland'?{imputed,imputationAffected,observationStatus:imputationAffected?'imputation-affected':'statistical-estimate'}:{})};
  });
  const attribution=id==='inflationBea'?'Source: U.S. Bureau of Economic Analysis, NIPA Tables 2.8.4, 2.8.5, 2.8.7 and 9.1U.':'Source: Federal Reserve Bank of Cleveland, '+s.title+'.';
  series[key]={...registry,source:{...registry.source},observations,sourceIds:[...s.codes],sourceUrl:url,sourceTitle:id==='inflationBea'?d.title:s.title,licenseUrl:d.licenseUrl,attribution,calculation:registry.definition,dataStatus:registry.observationType,sourceNotice:id==='inflationBea'?'BEA public-domain statistical values; Meridian calculations are identified separately.':'Federal Reserve Bank of Cleveland. Licensed under Creative Commons Attribution-ShareAlike 4.0 International ('+CLEVELAND_LICENSE+'). Changes: Meridian scales monthly fractions to percent and compounds trailing 12-month growth; original published annualized monthly rates are retained separately. Redistributed data and adaptations retain the same license. Imputation method: '+CLEVELAND_METHOD_URL+'.'};
 }
 if(id==='inflationBea'){
  const values=code=>maps[code];
  for(const row of inputs.QPCERV){const codes=['W902RV','W913RV','W921RV','W927RV','W931RV','SRSA0V'],v=codes.map(code=>values(code).get(row.date)?.value);if([row.value,...v].every(finite)&&Math.abs(row.value-v[0]-v[1]-v[2]+v[3]-v[4]-v[5])>.125000001)fail('CPI–PCE reconciliation exceeds published rounding');}
  for(const row of inputs.DPCERC){const goods=maps.DGDSRC.get(row.date)?.value,services=maps.DSERRC.get(row.date)?.value;if([row.value,goods,services].every(finite)&&Math.abs(row.value-goods-services)>2)fail('current-dollar goods/services reconciliation');}
 }
 if(id==='inflationCleveland')for(const prefix of ['mcpi','trim'])for(const row of inputs[prefix+'_monthly_chg']){const annualized=maps[prefix+'_ann_monthly_chg'].get(row.date)?.value;if(finite(row.value)&&finite(annualized)&&Math.abs(100*((1+row.value)**12-1)-annualized)>.0500001)fail('Cleveland published annualized rate differs from monthly fraction');}
 return series;
}
export function validateInflationDeskSource(source){
 keys(source,['id','status','definitionVersion','fetchedAt','coverageNote','warnings','inputs','series','provenance','lastAttemptAt','error','failure']);
 const d=inflationDeskDefinitions[source.id];if(!d||source.definitionVersion!==1||!instant(source.fetchedAt)||!['ok','error'].includes(source.status)||source.lastAttemptAt!==undefined&&!instant(source.lastAttemptAt)||source.coverageNote!==d.coverageNote||!equal(source.warnings,d.warnings))fail('source identity, clocks or coverage');
 if(source.error!==undefined&&source.error!==null&&(typeof source.error!=='string'||source.error.length>2000))fail('source error');
 if(source.failure!==undefined&&source.failure!==null){keys(source.failure,['kind','status','requestedUrl','url','redirected']);if(source.failure.kind!=='http'||!Number.isInteger(source.failure.status)||source.failure.status<100||source.failure.status>599||!d.feeds.includes(source.failure.requestedUrl)||source.failure.url!==source.failure.requestedUrl||typeof source.failure.redirected!=='boolean')fail('source HTTP failure');}
 if(!Array.isArray(source.provenance)||source.provenance.length!==d.feeds.length)fail('source receipt scope');const seen=new Set();
 for(const receipt of source.provenance){keys(receipt,['url','sha256','retrievedAt','lastModified']);if(!d.feeds.includes(receipt.url)||seen.has(receipt.url)||!/^[a-f0-9]{64}$/.test(receipt.sha256)||!instant(receipt.retrievedAt)||receipt.retrievedAt>source.fetchedAt||receipt.lastModified!==null&&typeof receipt.lastModified!=='string')fail('source receipt');seen.add(receipt.url);}
 if(!source.provenance.some(r=>r.retrievedAt===source.fetchedAt))fail('capture time lacks receipt');
 const expected=buildInflationDeskSeries(source.id,source.inputs,{cutoff:source.fetchedAt.slice(0,10)});if(!equal(source.series,expected))fail('normalized series differ from captured inputs, definitions or rights');
 return source;
}
