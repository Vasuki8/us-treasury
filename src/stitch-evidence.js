import {registry} from './registry.js';
import {stitchDeskContracts,stitchPageSources} from './stitch-desk-contracts.js';
import {validateBlsDeskSource} from './bls-desk-schema.js';
import {validateMarketDeskSource} from './market-desk-schema.js';
import {validateTreasuryDeskSource} from './treasury-desk-schema.js';
import {validateRefundingDeskSource} from './refunding-desk.js';
import {validateInflationDeskSource} from './inflation-desk-schema.js';
import {resolveDateWindow,isIsoDate} from './date-window.js';
import {validateCpiDetailSource} from './cpi-detail.js';
import {momentumInputs} from './momentum.js';
import {fundingRateDifference,DEALER_METRICS} from './market-functioning.js';
import {aggregateAuctionOfferings,auctionAllocations} from './auctions.js';
import {summarizeRefinancing} from './refinancing.js';
import {H15_TREASURY_CMT_URL,H15_3M_GAP_DATES,NOMINAL_YIELD_TENORS,REAL_YIELD_TENORS} from './yields.js';
import {DTS_DEBT_URL} from './debt-fallback.js';
const marketIds=['fedQt','dealerDetails','moneyRates','repoOperations','ofrRepo','ofrMmf','nyfedTriParty','dkwInflation','fedFx','fedSep','ecbFx','ecbPolicy'];
const validators={blsDesk:validateBlsDeskSource,cpiDetail:validateCpiDetailSource,dtsDesk:validateTreasuryDeskSource,ticHolders:validateTreasuryDeskSource,treasuryRefunding:validateRefundingDeskSource,inflationBea:validateInflationDeskSource,inflationCleveland:validateInflationDeskSource,...Object.fromEntries(marketIds.map(id=>[id,validateMarketDeskSource]))};
export const stitchEvidenceSourceIds=Object.keys(validators);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const same=(a,b)=>a===b||finite(a)&&finite(b)&&Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10;
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)&&Number.isFinite(Date.parse(value));
const equal=(a,b)=>a===b||Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>equal(value,b[i]))||plain(a)&&plain(b)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>Object.hasOwn(b,key)&&equal(a[key],b[key]));
const legacyFail=detail=>{throw Error('Invalid specialist supporting source: '+detail);};
const check=(condition,detail)=>{if(!condition)legacyFail(detail);};
const nativeNumber=value=>{
 check(typeof value==='string'||typeof value==='number','native numeric input');
 const text=String(value).trim().replaceAll(',','');
 if(['','NULL','NA','N/A','ND','NAN','-','—','(D)','(S)','(NA)','(ND)','...','---','*'].includes(text.toUpperCase()))return null;
 check(/^[+-]?\d+(?:\.\d+)?$/.test(text)&&Number.isFinite(Number(text)),'native numeric input');return Number(text);
};
const shifted=(date,months)=>{const d=new Date(date+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+months);return d.toISOString().slice(0,10);};
const policyIorb='https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip';
const h41='https://www.federalreserve.gov/releases/h41/data/FRB_h41_xml.zip';
const beaMonthly='https://apps.bea.gov/national/Release/TXT/NipaDataM.txt',beaQuarterly='https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt';
function reviewedLegacyUrl(id,value){try{
 const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.hash)return false;
 const path=u.origin+u.pathname,dates=()=>[...u.searchParams].every(([key,value])=>['startDate','endDate'].includes(key)&&isIsoDate(value));
 if(id==='bls')return /^https:\/\/api\.bls\.gov\/publicAPI\/v[12]\/timeseries\/data\/$/.test(value);
 if(['bea','pcePriceContributions'].includes(id))return [beaMonthly,...(id==='bea'?[beaQuarterly]:[])].includes(value);
 if(id==='fedBalance')return value===h41;
 if(id==='policyRates')return value===policyIorb||path==='https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json'&&u.searchParams.size===2&&dates();
 if(id==='onRrp')return path==='https://markets.newyorkfed.org/api/rp/results/search.json'&&u.searchParams.size===6&&u.searchParams.get('startDate')==='2024-01-01'&&isIsoDate(u.searchParams.get('endDate'))&&u.searchParams.get('operationTypes')==='Reverse Repo'&&u.searchParams.get('method')==='fixed'&&u.searchParams.get('securityType')==='tsy'&&u.searchParams.get('term')==='overnight';
 if(id==='marketFunctioning')return path==='https://markets.newyorkfed.org/api/pd/list/seriesbreaks.json'&&!u.search||path==='https://markets.newyorkfed.org/api/pd/get/SBN2024/timeseries/PDPOSGST-TOT_PDSORA-UTSETTOT_PDSIRRA-UTSETTOT_PDFTD-USTET_PDFTR-USTET.json'&&!u.search||['https://markets.newyorkfed.org/api/rates/secured/sofr/search.json','https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json'].includes(path)&&u.searchParams.size===2&&dates();
 if(['treasury','yields'].includes(id)){
  if(value===H15_TREASURY_CMT_URL)return id==='yields';
  if(id==='treasury'&&value===DTS_DEBT_URL)return true;
  if(id==='treasury'&&path==='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny')return [...u.searchParams.keys()].every(key=>['fields','filter','sort','page[size]','page[number]'].includes(key));
  const match=/^https:\/\/home\.treasury\.gov\/resource-center\/data-chart-center\/interest-rates\/daily-treasury-rates\.csv\/(\d{4})\/all$/.exec(path);
  return Boolean(match&&u.searchParams.get('field_tdr_date_value')===match[1]&&['daily_treasury_yield_curve',...(id==='yields'?['daily_treasury_real_yield_curve']:[])].includes(u.searchParams.get('type'))&&[...u.searchParams.keys()].every(key=>['type','field_tdr_date_value','page','_format'].includes(key)));
 }
 if(['refinancing','auctions'].includes(id))return (id==='auctions'?['https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/auctions_query']:['https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/mspd_table_3_market','https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/mspd_table_1']).includes(path)&&[...u.searchParams.keys()].every(key=>['fields','filter','sort','page[size]','page[number]'].includes(key));
 return false;
 }catch{return false;}}
const sourceCodes={spread2s10s:['BC_10YEAR','BC_2YEAR'],spread3m10y:['BC_10YEAR','BC_3MONTH'],inflationComp10:['BC_10YEAR','TC_10YEAR'],sofrEffrSpread:['SOFR:percentRate','EFFR:percentRate'],marketableDebt:['mspd_table_3_market:unmatured-outstanding'],auctionOfferingMonthly:['offering_amt','auction_date','bid_to_cover_ratio']};
function legacySourceBase(id,source){
 check(plain(source)&&source.id===id&&timestamp(source.fetchedAt)&&['ok','cached','error'].includes(source.status),id+' capture');
 check(Array.isArray(source.provenance)&&source.provenance.length>0&&source.provenance.length<=1000,id+' receipts');
 const receipts=source.provenance;
 for(const r of receipts){
  check(plain(r)&&reviewedLegacyUrl(id,r.url)&&/^[a-f0-9]{64}$/.test(r.sha256)&&timestamp(r.retrievedAt)&&r.retrievedAt<=source.fetchedAt,id+' reviewed receipt');
  if(id==='bls')check(Number.isInteger(r.startYear)&&Number.isInteger(r.endYear)&&r.startYear<=r.endYear&&Array.isArray(r.seriesIds)&&r.seriesIds.length>0&&r.seriesIds.every(code=>typeof code==='string'),'BLS native request receipt scope');
 }
 check(receipts.some(r=>r.retrievedAt===source.fetchedAt),id+' capture clock');
 const definitions=Object.values(registry).filter(d=>d.agency===id);
 check(plain(source.series)&&equal(Object.keys(source.series).sort(),definitions.map(d=>d.id).sort()),id+' complete registered measurements');
 for(const d of definitions){
  const item=source.series[d.id],codes=sourceCodes[d.id]??[d.code.split(' ')[0]];
  check(plain(item)&&equal(item.sourceIds,codes),id+'/'+d.id+' native identity');
  for(const key of ['unit','frequency','adjustment','format','precision'])if(item[key]!==undefined)check(item[key]===d[key],id+'/'+d.id+' '+key);
  if(item.observationType!==undefined)check(item.observationType===(d.observationType??'official'),id+'/'+d.id+' calculation classification');
  const urls=[item.sourceUrl,...(item.sourceUrls??[])];
  check(urls.length>0&&urls.every(url=>reviewedLegacyUrl(id,url)&&receipts.some(r=>r.url===url)),id+'/'+d.id+' source receipt lineage');
  if(item.provenance!==undefined)check(Array.isArray(item.provenance)&&item.provenance.every(r=>receipts.some(original=>r.url===original.url&&r.sha256===original.sha256&&r.retrievedAt===original.retrievedAt)),id+'/'+d.id+' measurement receipt override');
  check(Array.isArray(item.observations)&&item.observations.length>0&&item.observations.length<=50000,id+'/'+d.id+' observations');
  let prior='';
  for(const row of item.observations){
   check(plain(row)&&isIsoDate(row.date)&&row.date>prior&&row.date<=source.fetchedAt.slice(0,10)&&row.publishedAt===null&&(row.value===null||finite(row.value)),id+'/'+d.id+' ordered native observations');prior=row.date;
   if(row.footnotes!==undefined)check(Array.isArray(row.footnotes)&&row.footnotes.every(note=>typeof note==='string'||plain(note)&&typeof note.text==='string'),id+'/'+d.id+' footnotes');
   for(const url of [row.sourceUrl,...(row.sourceUrls??[])].filter(Boolean))check(reviewedLegacyUrl(id,url)&&receipts.some(r=>r.url===url&&(!row.sourceSha256||r.sha256===row.sourceSha256)&&(!row.retrievedAt||r.retrievedAt===row.retrievedAt)),id+'/'+d.id+' observation receipt lineage');
   if(id==='bls'&&row.sourceSha256)check(receipts.some(r=>r.url===row.sourceUrl&&r.sha256===row.sourceSha256&&r.retrievedAt===row.retrievedAt&&codes.every(code=>r.seriesIds.includes(code))&&Number(row.date.slice(0,4))>=r.startYear&&Number(row.date.slice(0,4))<=r.endYear),id+'/'+d.id+' native code/year receipt scope');
   if(['bls','bea','pcePriceContributions'].includes(id))check(row.date.endsWith('-01')&&(d.frequency!=='Quarterly'||['01','04','07','10'].includes(row.date.slice(5,7))),id+'/'+d.id+' native period');
  }
 }
 return source.series;
}
function nativeSeries(source,id,scale=1){for(const row of source.series[id].observations)check(same(row.value,nativeNumber(row.sourceValue)===null?null:nativeNumber(row.sourceValue)/scale),source.id+'/'+id+' native numeric lineage');}
function validatePolicySource(source){
 const s=legacySourceBase('policyRates',source);
 check(source.provenance.length===2&&new Set(source.provenance.map(r=>r.url)).size===2,'policyRates complete distinct native receipts');
 for(const [id,field]of [['policyTargetLower','targetRateFrom'],['policyTargetUpper','targetRateTo'],['iorb',null]]){
  const item=s[id],method=field?`Published New York Fed EFFR ${field} field, in percent; no interpolation.`:'Published Board IORB rate, percent, on each actual source effective date.';
  check(item.unit==='Percent'&&item.frequency==='Daily'&&item.adjustment==='Not seasonally adjusted'&&item.observationType==='official'&&item.calculation===method,'policyRates/'+id+' measurement contract');
  check(field?new URL(item.sourceUrl).pathname==='/api/rates/unsecured/effr/search.json':item.sourceUrl===policyIorb,'policyRates/'+id+' native feed');nativeSeries(source,id);
  for(const row of item.observations)check((row.value===null||row.value>=0)&&row.date>=(field?'2017-01-01':'2021-07-29')&&(!field||['','Y','r'].includes(row.revisionIndicator))&&!Object.hasOwn(row,'sourceUrl')&&!Object.hasOwn(row,'sourceUrls'),'policyRates/'+id+' native period, source or revision');
 }
 check(equal(s.policyTargetLower.observations.map(r=>r.date),s.policyTargetUpper.observations.map(r=>r.date)),'policy target matching dates');
 s.policyTargetLower.observations.forEach((row,i)=>check(!finite(row.value)||!finite(s.policyTargetUpper.observations[i].value)||row.value<=s.policyTargetUpper.observations[i].value,'policy target bound ordering'));
}
function validateStatisticalSource(id,source){
 const series=legacySourceBase(id,source),maps=Object.fromEntries(Object.entries(series).map(([id,s])=>[id,new Map(s.observations.map(r=>[r.date,r]))]));
 const levelFor={payroll:'payrollLevel',cpi:'cpiIndex',cpiCore:'cpiCoreIndex',cpiMonthly:'cpiSaIndex',cpiCoreMonthly:'cpiCoreSaIndex',eciCompensationQuarterly:'eciCompensation',pce:'pceIndex',pceCore:'pceCoreIndex'};
 for(const [key,item]of Object.entries(series)){
  if(momentumInputs[key]){
   const [inputId,months,kind]=momentumInputs[key];
   for(const row of item.observations){const dates=kind==='average'?[shifted(row.date,-2),shifted(row.date,-1),row.date]:[shifted(row.date,-months),row.date],inputs=row.inputValues;
    check(equal(row.inputDates,dates)&&Array.isArray(inputs)&&inputs.length===dates.length,id+'/'+key+' exact calculation endpoints');
    dates.forEach((date,i)=>{const native=maps[inputId]?.get(date);if(native)check(same(inputs[i],native.value),id+'/'+key+' calculation input');});
    const expected=inputs.every(finite)?kind==='average'?inputs.reduce((a,b)=>a+b,0)/3:inputs.every(value=>value>0)?100*((inputs[1]/inputs[0])**(12/months)-1):null:null;
    const method=kind==='average'?'Arithmetic mean of three exact consecutive monthly payroll job changes in the same retrieval vintage; no gap filling.':`100 × [(index(t) / index(t-${months} months))^${12/months} − 1]; exact SA index endpoints in the same retrieval vintage.`;
    check(same(row.value,expected)&&row.calculation===method&&item.calculation===method,id+'/'+key+' calculation lineage');
   }
   continue;
  }
  if(['payroll','cpi','cpiCore','cpiMonthly','cpiCoreMonthly','wages','eciCompensationQuarterly','pce','pceCore'].includes(key)){
   const months=key==='payroll'||key.endsWith('Monthly')?1:key==='eciCompensationQuarterly'?3:12;
   for(const row of item.observations){
    const value=nativeNumber(row.sourceValue),base=nativeNumber(row.baseValue??row.yearAgoSourceValue??'null'),expected=finite(value)&&finite(base)?key==='payroll'?value-base:base!==0?100*(value/base-1):null:null;
    check(same(row.value,expected),id+'/'+key+' native calculation lineage');
    if(row.baseDate!==undefined)check(row.baseDate===null||row.baseDate===shifted(row.date,-months),id+'/'+key+' baseline date');
    const original=maps[levelFor[key]]?.get(row.date),prior=maps[levelFor[key]]?.get(shifted(row.date,-months));
    if(original)check(same(value,original.value),id+'/'+key+' native current index');
    if(prior)check(same(base,prior.value),id+'/'+key+' native baseline index');
   }
  }else nativeSeries(source,key,key==='openings'?1000:id==='bea'&&/Billions/.test(registry[key].unit)?1000:1);
 }
}
function validateFundingSource(source){
 const series=legacySourceBase('marketFunctioning',source);
 for(const id of Object.keys(DEALER_METRICS)){
  nativeSeries(source,id,1000);
  for(const row of series[id].observations)check(row.suppressed===(row.sourceValue==='*')&&row.date>='2024-07-03'&&new Date(row.date+'T00:00:00Z').getUTCDay()===3,'dealer native period or suppression');
 }
 for(const id of ['sofr','effr']){
  nativeSeries(source,id);
  check(equal(source.fundingRates?.[id],series[id].observations),'funding duplicate native inputs');
  for(const row of series[id].observations){check(['','r','Y'].includes(row.revisionIndicator),'funding revision');for(const key of ['volumeInBillions','percentile1','percentile25','percentile75','percentile99'])check(row[key]===null||finite(row[key]),'funding native distribution');}
 }
 check(equal(series.sofrEffrSpread.observations,fundingRateDifference(series.sofr.observations,series.effr.observations).filter(row=>row.date>='2018-04-02')),'SOFR/EFFR exact-date calculation');
 check(Array.isArray(source.dealerHistory)&&source.dealerHistory.length===series.dealerNetTreasury.observations.length,'dealer history scope');
 for(const row of source.dealerHistory)for(const id of Object.keys(DEALER_METRICS))check(same(row[id],series[id].observations.find(r=>r.date===row.date)?.value),'dealer history input');
}
function validateBalanceSource(id,source){
 const series=legacySourceBase(id,source);
 for(const key of Object.keys(series)){
  nativeSeries(source,key,id==='onRrp'?1e9:1000);
  for(const row of series[key].observations){
   check(row.value===null||row.value>=0,id+' native nonnegative amount');
   check(!Object.hasOwn(row,'sourceUrl')&&!Object.hasOwn(row,'sourceUrls'),id+' native source override');
   if(id==='fedBalance')check(new Date(row.date+'T00:00:00Z').getUTCDay()===3,'H.4.1 Wednesday basis');
   else{const days=(Date.parse(row.maturityDate+'T00:00:00Z')-Date.parse(row.settlementDate+'T00:00:00Z'))/86400000;check(row.settlementDate===row.date&&isIsoDate(row.maturityDate)&&days===row.termCalendarDays&&days>=1&&days<=7&&['12:44','12:45'].includes(row.operationReleaseTime)&&row.operationCloseTime==='13:15'&&typeof row.operationId==='string','ON RRP operation basis');}
  }
 }
}
function curveReceiptLookup(source){
 const index=new Map();
 for(const receipt of source.provenance){const u=new URL(receipt.url),year=/\.csv\/(\d{4})\/all$/.exec(u.pathname)?.[1],type=u.searchParams.get('type');if(year&&['daily_treasury_yield_curve','daily_treasury_real_yield_curve'].includes(type)){const key=year+':'+(type==='daily_treasury_real_yield_curve'?'real':'nominal');if(!index.has(key))index.set(key,new Set());index.get(key).add(receipt.url);}}
 return(date,kind)=>{const urls=[...(index.get(date.slice(0,4)+':'+kind)??[])];check(urls.length===1,'Treasury exact year/kind receipt');return urls[0];};
}
function validateYieldSource(source){
 const series=legacySourceBase('yields',source),curves=new Map(),receiptUrl=curveReceiptLookup(source);let previous='';
 check(Array.isArray(source.curveHistory)&&source.curveHistory.length>0&&source.curveHistory.length<=50000,'Treasury curve history');
 for(const row of source.curveHistory){
  check(isIsoDate(row.date)&&row.date>previous,'ordered Treasury curve inputs');previous=row.date;curves.set(row.date,row);
  for(const [kind,tenors]of [['nominal',NOMINAL_YIELD_TENORS],['real',REAL_YIELD_TENORS]]){check(plain(row[kind])&&Object.keys(row[kind]).every(key=>tenors.includes(key)),'Treasury tenor identity');for(const value of Object.values(row[kind]))check(value===null||finite(value),'Treasury native par input');}
  for(const kind of ['nominal','real'])if(Object.values(row[kind]).some(finite))receiptUrl(row.date,kind);
 }
 const evidence=source.h15GapEvidence,supplements=new Map(),retained=source.curveHistory.filter(row=>row.nominalSupplements);
 if(evidence!==undefined){
  check(plain(evidence)&&[1,2].includes(evidence.version)&&Array.isArray(evidence.curves)&&evidence.curves.length>0&&evidence.curves.length<=3&&(evidence.version!==2||evidence.scope==='selected-inputs'),'H15 retained native evidence');
  for(const row of evidence.curves){
   const s=row.nominalSupplements?.['3M'];
   check(isIsoDate(row.date)&&H15_3M_GAP_DATES.includes(row.date)&&!supplements.has(row.date)&&equal(Object.keys(row.nominalSupplements??{}),['3M'])&&plain(s)&&s.value===0&&row.nominal?.['3M']===0&&s.primaryValue===null&&s.sourceValue==='0.00'&&s.sourceSeriesId==='RIFLGFCM03_N.B'&&s.sourceUrl===H15_TREASURY_CMT_URL&&s.primarySourceUrl===receiptUrl(row.date,'nominal')&&finite(row.nominal['2Y'])&&finite(row.nominal['10Y']),'H15 exact native zero, code and primary input');
   check(source.provenance.some(r=>r.url===s.sourceUrl&&r.sha256===s.sourceSha256&&r.retrievedAt===s.retrievedAt),'H15 exact capture receipt');
   const curve=curves.get(row.date);if(curve)check(equal(row,{date:curve.date,nominal:curve.nominal,nominalSupplements:curve.nominalSupplements}),'H15 evidence/curve mirror');
   supplements.set(row.date,s);
  }
 }
 check(retained.every(row=>supplements.has(row.date))&&source.provenance.some(r=>r.url===H15_TREASURY_CMT_URL)===(supplements.size>0),'H15 evidence scope');
 const operations={spread2s10s:r=>finite(r.nominal['10Y'])&&finite(r.nominal['2Y'])?100*(r.nominal['10Y']-r.nominal['2Y']):null,spread3m10y:r=>finite(r.nominal['10Y'])&&finite(r.nominal['3M'])?100*(r.nominal['10Y']-r.nominal['3M']):null,realYield10:r=>r.real['10Y']??null,inflationComp10:r=>finite(r.nominal['10Y'])&&finite(r.real['10Y'])?100*(r.nominal['10Y']-r.real['10Y']):null,nominalYield2:r=>r.nominal['2Y']??null,nominalYield3m:r=>r.nominal['3M']??null};
 for(const [id,item]of Object.entries(series))for(const row of item.observations){
  const native=curves.get(row.date);check(native&&same(row.value,operations[id](native)),'Treasury '+id+' curve calculation');
  const primary=receiptUrl(row.date,id==='realYield10'?'real':'nominal'),s=supplements.get(row.date),usesH15=s&&['nominalYield3m','spread3m10y'].includes(id);
  const urls=id==='inflationComp10'?[primary,receiptUrl(row.date,'real')]:usesH15?[primary,H15_TREASURY_CMT_URL]:[primary];
  check(row.sourceUrl===primary&&equal(row.sourceUrls,urls),'Treasury '+id+' exact dated native source set');
  if(usesH15)check(item.inputProvenanceScope==='observation-source-urls'&&row.footnotes?.some(note=>typeof note==='string'&&note.includes('RIFLGFCM03_N.B')),'H15 observation qualification');
 }
 return curves;
}
function validateTreasurySource(source,yields){
 const series=legacySourceBase('treasury',source),receiptUrl=curveReceiptLookup(source);
 for(const row of series.debt.observations){const scale=row.sourceUrl===DTS_DEBT_URL?1e6:1e12;check(same(row.value,nativeNumber(row.sourceValue)===null?null:nativeNumber(row.sourceValue)/scale),'Treasury debt native unit conversion');}
 for(const row of series.yield.observations)check(row.sourceUrl===receiptUrl(row.date,'nominal'),'Treasury 10Y exact dated native source');
 if(yields){const curves=new Map(yields.curveHistory.map(row=>[row.date,row]));for(const row of series.yield.observations)check(same(row.value,curves.get(row.date)?.nominal?.['10Y']??null),'Treasury nominal/real desk same-date 10Y input');for(const row of source.yieldCurve??[])check(same(row.value,curves.get(source.curveDate)?.nominal?.[row.tenor]??null)&&same(row.previous,curves.get(source.previousCurveDate)?.nominal?.[row.tenor]??null),'Treasury current curve input');}
}
function validateRefinancingSource(source){
 legacySourceBase('refinancing',source);nativeSeries(source,'marketableDebt',1e6);
 const summary=summarizeRefinancing(source),totals=source.totals;
 check(source.unit==='USD billions'&&summary.status==='ok'&&plain(totals)&&same(summary.totalPrincipal,totals.eligiblePrincipal)&&same(summary.totalPrincipal/1000,source.series.marketableDebt.observations.at(-1).value),'MSPD principal reconstruction');
 check(same(totals.eligiblePrincipal+totals.ffbPrincipal+totals.maturedUnredeemedPrincipal,totals.reportedMarketablePrincipal)&&same(totals.reportedMarketableHeldByPublic+totals.reportedMarketableIntragovernmental,totals.reportedMarketablePrincipal),'MSPD official accounting reconciliation');
}
function validateAuctionSource(source){
 legacySourceBase('auctions',source);check(Array.isArray(source.auctions)&&source.auctions.length>0&&source.auctions.length<=10000,'auction retained native rows');
 let previous='';const ids=new Set();
 for(const row of source.auctions){
  const key=row.auctionDate+'|'+row.id;check(isIsoDate(row.auctionDate)&&key>previous&&!ids.has(row.id)&&['Bill','Note','Bond','FRN','TIPS'].includes(row.securityType)&&row.publishedAt===null,'auction native identity');previous=key;ids.add(row.id);
  for(const field of ['issueDate','maturityDate','announcementDate','sourceRecordDate'])check(isIsoDate(row[field]),'auction native dates');
  for(const field of ['offeringAmount','competitiveAccepted','totalAccepted','somaAccepted','primaryDealerAccepted','directAccepted','indirectAccepted','bidToCover','highYield','highDiscountRate','highDiscountMargin'])check(row[field]===null||finite(row[field]),'auction native numeric fields');
  check(reviewedLegacyUrl('auctions',row.sourceUrl)&&Number.isInteger(row.sourceReceiptIndex)&&source.provenance[row.sourceReceiptIndex],'auction native receipt');
  if(row.resultUrl)check(/^https:\/\/www\.treasurydirect\.gov\/xml\/R_\d{8}_\d+\.xml$/.test(row.resultUrl),'auction official result reference');
  check(equal(row.allocations,auctionAllocations(row)),'auction allocation calculation');
 }
 check(equal(source.series.auctionOfferingMonthly.observations,aggregateAuctionOfferings(source.auctions,{startDate:source.coverageStart,endDate:source.coverageEnd})),'auction monthly aggregation');
}
/** Admission checks retained claims and calculations; a file checksum is not agency authentication. */
export function assertStitchLegacySources(context){
 const page=context?.stitchEvidence?.page,contract=stitchDeskContracts[page];if(!contract)return true;
 const expected=contract.sources.filter(id=>!Object.hasOwn(validators,id)).sort(),sources=context.moduleSources;
 check(plain(sources)&&equal(Object.keys(sources).sort(),expected),'complete page-specific legacy family scope');
 for(const id of expected){const source=sources[id];
  if(id==='policyRates')validatePolicySource(source);
  else if(['bls','bea','pcePriceContributions'].includes(id))validateStatisticalSource(id,source);
  else if(id==='marketFunctioning')validateFundingSource(source);
  else if(['fedBalance','onRrp'].includes(id))validateBalanceSource(id,source);
  else if(id==='yields')validateYieldSource(source);
  else if(id==='treasury')validateTreasurySource(source,sources.yields);
  else if(id==='refinancing')validateRefinancingSource(source);
  else if(id==='auctions')validateAuctionSource(source);
  else legacyFail('unsupported required family '+id);
 }
 return true;
}
export function validateStitchLegacySources(context){try{return assertStitchLegacySources(context);}catch{return false;}}
function expectedSourceIds(state){return [...new Set([...stitchPageSources(state),...(state.page==='indicator'?[registry[state.seriesId]?.agency]:[])])].filter(id=>Object.hasOwn(validators,id)).sort();}
/** Reconstruct display metadata from immutable local definitions and retained native source inputs. */
export function stitchEvidenceCatalog(sources={}){
 return Object.fromEntries(Object.entries(registry).filter(([id,d])=>sources[d.agency]?.series?.[id]).map(([id,d])=>{const source=sources[d.agency],s=source.series[id];return[id,{...d,...s,id,source:{...d.source,seriesIds:s.sourceIds},observations:s.observations,provenance:s.provenance??source.provenance,fetchedAt:s.fetchedAt??source.fetchedAt,lastAttemptAt:source.lastAttemptAt??null,dataStatus:source.status==='ok'?'official':'cached',coverageNote:s.coverageNote??source.coverageNote,definition:d.definition,comparisonClass:d.comparisonClass??'amount',error:source.error??null}];}));
}
function scopedSource(source,range){
 if(!['dkwInflation','fedQt','fedFx','ecbFx'].includes(source.id)||typeof range==='number'||range?.preset==='all'||range?.preset==='observations')return source;
 const window=resolveDateWindow(range,Object.values(source.series));if(window.error)throw Error(window.error);
 const series=Object.fromEntries(Object.entries(source.series).map(([id,s])=>{const selected=s.observations.filter(r=>r.date>=window.startDate&&r.date<=window.endDate);const before=s.observations.findLast(r=>r.date<window.startDate);return[id,{...s,observations:before?[before,...selected]:selected}];}));
 return {...source,series,frozenScope:{version:1,range,startDate:window.startDate,endDate:window.endDate,lookback:'One immediately preceding native observation per measurement is retained for endpoint changes. No interpolation.'}};
}
export function createStitchEvidence(state,sources,range){
 const ids=expectedSourceIds(state);
 if(!ids.length)return null;
 if(!ids.some(id=>sources[id])&&!stitchDeskContracts[state.page])return null;
 if(ids.some(id=>!sources[id]))throw Error('Complete specialist source inputs must load before freezing this page');
 const retained=Object.fromEntries(ids.map(id=>{
  let selectedRange=range;
  if(stitchDeskContracts[state.page]){
   selectedRange={preset:({MAX:'all','3Y':'3y','5Y':'5y'})[state.specialistRange]??'1y'};
   if(state.specialistRange==='1M'){
    const end=Object.values(sources[id].series??{}).flatMap(s=>s.observations??[]).map(r=>r.date).sort().at(-1);
    if(end){const start=new Date(end+'T00:00:00Z');start.setUTCMonth(start.getUTCMonth()-1);selectedRange={preset:'custom',startDate:start.toISOString().slice(0,10),endDate:end};}
   }
  }
  return[id,scopedSource(sources[id],selectedRange)];
 }));
 const context={version:1,page:state.page,...(state.page==='indicator'?{seriesId:state.seriesId}:{}),...(state.page==='macroCoverage'?{macroFamily:state.macroFamily}:{}),sources:retained,scope:'All displayed specialist source families, independent of the primary four-measurement comparison. Full BLS and inflation calculation inputs; selected-window Fed/H.10/ECB/DKW inputs with a native preceding observation. Native units, public-data coverage restrictions and original retrieval receipts are retained.'};
 if(!validateStitchEvidence(context))throw Error('Specialist evidence did not pass frozen-source admission');return context;
}
export function validateStitchEvidence(context){try{
 if(!context||context.version!==1||typeof context.page!=='string'||typeof context.scope!=='string'||!context.sources||Array.isArray(context.sources)||!Object.keys(context.sources).length)return false;
 const expected=expectedSourceIds(context),actual=Object.keys(context.sources).sort();if(!expected.length||JSON.stringify(expected)!==JSON.stringify(actual)||actual.some(id=>!Object.hasOwn(validators,id)||context.sources[id]?.id!==id||!validators[id](context.sources[id])))return false;
 for(const s of Object.values(context.sources)){if(s.frozenScope){const f=s.frozenScope;if(!['dkwInflation','fedQt','fedFx','ecbFx'].includes(s.id)||f.version!==1||!f.range||typeof f.lookback!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(f.startDate)||!/^\d{4}-\d{2}-\d{2}$/.test(f.endDate)||f.startDate>f.endDate)return false;for(const item of Object.values(s.series)){if(item.observations.filter(r=>r.date<f.startDate).length>1||item.observations.some(r=>r.date>f.endDate))return false;}}}
 return true;
 }catch{return false;}}
export function stitchFrozenSources(context={}){return {...context.moduleSources,...context.stitchEvidence?.sources};}
export function stitchFreezeSourceIds(state){return [...new Set([...(stitchDeskContracts[state.page]?.sources??[]),...stitchPageSources(state)])];}
