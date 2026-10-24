import {createHash} from 'node:crypto';
import {parseCsv} from './http.mjs';
import {easternFields} from './calendar-utils.mjs';
import {isIsoDate} from '../../src/date-window.js';
import {cpiPublicationScope} from '../cpi-publication-scope.mjs';

const LANDING_URL='https://www.clevelandfed.org/indicators-and-data/median-cpi';
const ENDPOINTS=[
 {series:'headline',url:'https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/cpi.csv?sc_lang=en'},
 {series:'core',url:'https://www.clevelandfed.org/-/media/files/webcharts/mediancpi/core.csv?sc_lang=en'},
];
const USER_AGENT='us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)';
const MAX_BYTES=2*1024*1024,REQUEST_TIMEOUT_MS=12000,MAX_RETRY_WAIT_MS=5000;
const TRANSIENT_STATUSES=new Set([408,429,500,502,503,504]);
const ANCHOR_PERIOD=cpiPublicationScope.map(row=>row.referencePeriod).sort().at(-1);
const EXCLUDED_PERIOD='2025-10-01';
const DECIMAL=/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/;

const invalidCsv=reason=>{throw Error(`Invalid Cleveland CPI CSV: ${reason}.`);};

/** Validate exact monthly index availability; never return rounded indexes or annualized rates. */
export function parseClevelandCpiCsv(input,{series,through=new Date().toISOString().slice(0,10)}={}){
 if(!['headline','core'].includes(series))invalidCsv('unknown series');
 if(!isIsoDate(through))invalidCsv('invalid through date');
 if(typeof input!=='string'||Buffer.byteLength(input)>MAX_BYTES)invalidCsv('invalid or oversized body');
 const text=input.replace(/^\ufeff/,''),lines=text.split(/\r\n|\n|\r/);
 if(lines.at(-1)==='')lines.pop();
 // The expected scalar fields cannot contain newlines. Validate quoting first:
 // the shared CSV parser deliberately tolerates stray quotes in other sources.
 const record=/^(?:"(?:[^"\r\n]|"")*"|[^",\r\n]*)(?:,(?:"(?:[^"\r\n]|"")*"|[^",\r\n]*))*$/;
 if(!lines.length||lines.some(line=>!line||!record.test(line)))invalidCsv('malformed CSV quoting or record');
 let rows;try{rows=parseCsv(text);}catch{invalidCsv('malformed CSV');}
 if(rows.length!==lines.length)invalidCsv('empty CSV record');
 const expected=['date',series==='headline'?'cpi_index':'core_index','ann_monthly_chg'];
 if(rows[0]?.length!==3||rows[0].some((cell,index)=>cell!==expected[index]))invalidCsv('wrong series header');
 if(rows.length<2)invalidCsv('no reference periods');
 let latestReferencePeriod=null,latestAvailablePeriod=null,latestAvailable=false,availablePeriodCount=0;
 const missingPeriods=[],excludedPeriods=[];
 for(const row of rows.slice(1)){
  if(row.length!==3)invalidCsv('wrong record schema');
  const [date,index,change]=row,match=/^(\d{2})\/01\/(\d{4})$/.exec(date);
  const period=match?`${match[2]}-${match[1]}-01`:null;
  if(!isIsoDate(period))invalidCsv('invalid monthly reference date');
  if(latestReferencePeriod&&period<=latestReferencePeriod)invalidCsv('duplicate or unordered reference period');
  if(index!==''&&(!DECIMAL.test(index)||!Number.isFinite(Number(index))||Number(index)<=0))invalidCsv('invalid positive index');
  if(change!==''&&(!DECIMAL.test(change)||!Number.isFinite(Number(change))))invalidCsv('invalid optional numeric change');
  const excluded=period===EXCLUDED_PERIOD,available=index!==''&&!excluded;
  if(available&&period>=`${through.slice(0,7)}-01`)invalidCsv('future or incomplete available reference period');
  if(excluded)excludedPeriods.push(period);
  else if(!available)missingPeriods.push(period);
  if(available){latestAvailablePeriod=period;availablePeriodCount++;}
  latestReferencePeriod=period;latestAvailable=available;
 }
 return {series,latestReferencePeriod,latestAvailablePeriod,latestAvailable,referencePeriodCount:rows.length-1,availablePeriodCount,missingPeriods,excludedPeriods};
}

class SourceFailure extends Error{
 constructor(errorCode,outcome,httpStatus=null,retryAfter=null){super(errorCode);Object.assign(this,{errorCode,outcome,httpStatus,retryAfter});}
}

function retryDelay(value,now){
 if(typeof value!=='string')return 1000;
 const trimmed=value.trim();
 if(/^\d+$/.test(trimmed))return Math.max(1000,Number(trimmed)*1000);
 const delay=/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), /i.test(trimmed)?Date.parse(trimmed)-now.getTime():NaN;
 return Number.isFinite(delay)?Math.max(1000,delay):1000;
}

// A body that ignores cancellation must not extend the request deadline.
function cancelUnread(bodyOrReader){try{Promise.resolve(bodyOrReader?.cancel()).catch(()=>{});}catch{}}

async function readSource(url,fetchImpl){
 const controller=new AbortController();
 let timer,reader,httpStatus=null,timedOut=false;
 const deadline=new Promise((resolve,reject)=>{
  timer=setTimeout(()=>{
   timedOut=true;controller.abort();
   if(reader)cancelUnread(reader);
   reject(new SourceFailure('REQUEST_TIMEOUT','timeout',httpStatus));
  },REQUEST_TIMEOUT_MS);
 });
 const request=(async()=>{
  const response=await fetchImpl(url,{headers:{Accept:'text/csv, text/plain;q=0.9','User-Agent':USER_AGENT},redirect:'manual',signal:controller.signal});
  httpStatus=Number.isInteger(response.status)?response.status:null;
  const rejectResponse=failure=>{cancelUnread(response.body);throw failure;};
  if(timedOut)rejectResponse(new SourceFailure('REQUEST_TIMEOUT','timeout',httpStatus));
  if(response.redirected||(response.url&&response.url!==url)||(response.status>=300&&response.status<400))rejectResponse(new SourceFailure('REDIRECT_REJECTED','redirect',httpStatus));
  if(response.status!==200)rejectResponse(new SourceFailure(`HTTP_${httpStatus??'INVALID'}`,'http-error',httpStatus,response.headers?.get('retry-after')));
  const type=response.headers?.get('content-type')?.split(';')[0].trim().toLowerCase();
  if(type&&!['text/csv','application/csv','text/plain','application/octet-stream','application/vnd.ms-excel'].includes(type))rejectResponse(new SourceFailure('INVALID_CONTENT_TYPE','invalid-source',200));
  const contentLength=response.headers?.get('content-length');
  if(contentLength&&/^\d+$/.test(contentLength)&&Number(contentLength)>MAX_BYTES)rejectResponse(new SourceFailure('RESPONSE_TOO_LARGE','too-large',200));
  const chunks=[];let length=0;
  if(response.body?.getReader){
   reader=response.body.getReader();let completed=false;
   try{
    while(true){
     const {done,value}=await reader.read();
     if(timedOut)throw new SourceFailure('REQUEST_TIMEOUT','timeout',200);
     if(done){completed=true;break;}
     length+=value.byteLength;
     if(length>MAX_BYTES)throw new SourceFailure('RESPONSE_TOO_LARGE','too-large',200);
     chunks.push(Buffer.from(value));
    }
   }finally{if(!completed)cancelUnread(reader);reader.releaseLock();reader=null;}
  }else{
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length>MAX_BYTES)throw new SourceFailure('RESPONSE_TOO_LARGE','too-large',200);
   chunks.push(bytes);length=bytes.length;
  }
  const bytes=Buffer.concat(chunks,length);
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new SourceFailure('INVALID_ENCODING','invalid-source',200);}
  const lastModified=response.headers?.get('last-modified');
  return {text,provenance:{url,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:length,retrievedAt:new Date().toISOString(),lastModified:typeof lastModified==='string'&&lastModified.length<=200&&Number.isFinite(Date.parse(lastModified))?lastModified:null}};
 })();
 try{return await Promise.race([request,deadline]);}
 catch(error){
  if(timedOut)throw new SourceFailure('REQUEST_TIMEOUT','timeout',httpStatus);
  if(error instanceof SourceFailure)throw error;
  throw new SourceFailure('TRANSPORT_ERROR','transport-error',httpStatus);
 }finally{clearTimeout(timer);}
}

/** Secondary data availability only. Every new reference period still requires source review. */
export async function collectClevelandCpiAvailability({fetchImpl=globalThis.fetch,now=new Date(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Invalid CPI availability check time.');
 const through=easternFields(now.toISOString()).date,attempts=[],provenance=[],availability={headline:null,core:null};
 let deferred=false;
 for(const [endpointIndex,endpoint] of ENDPOINTS.entries()){
  if(endpointIndex)await pause(1000);
  let rateLimited=false;
  for(let attempt=1;attempt<=2;attempt++){
   try{
    const downloaded=await readSource(endpoint.url,fetchImpl);
    let parsed;
    try{parsed=parseClevelandCpiCsv(downloaded.text,{series:endpoint.series,through});}
    catch{throw new SourceFailure('INVALID_SOURCE','invalid-source',200);}
    availability[endpoint.series]=parsed;provenance.push(downloaded.provenance);
    attempts.push({url:endpoint.url,attempt,httpStatus:200,outcome:'accepted',errorCode:null});
    break;
   }catch(error){
    const failure=error instanceof SourceFailure?error:new SourceFailure('TRANSPORT_ERROR','transport-error');
    const row={url:endpoint.url,attempt,httpStatus:failure.httpStatus,outcome:failure.outcome,errorCode:failure.errorCode};
    attempts.push(row);rateLimited ||=failure.httpStatus===429;
    const transient=failure.outcome==='transport-error'||failure.outcome==='timeout'||TRANSIENT_STATUSES.has(failure.httpStatus);
    if(!transient){deferred=rateLimited;break;}
    const delay=retryDelay(failure.retryAfter,now);
    if(delay>MAX_RETRY_WAIT_MS){row.errorCode='RETRY_AFTER_EXCEEDS_BUDGET';deferred=true;break;}
    // A fresh server cooldown still applies when this document has no retries left.
    if(attempt===2){deferred=rateLimited||Boolean(failure.retryAfter);break;}
    await pause(delay);
   }
  }
  if(deferred)break;
 }
 const {headline,core}=availability;
 let error=null;
 if(!headline||!core){
  const failures=ENDPOINTS.filter(endpoint=>!availability[endpoint.series]).map(endpoint=>`${endpoint.series}: ${attempts.filter(row=>row.url===endpoint.url).map(row=>row.errorCode).join(', ')||'not requested'}`).join('; ');
  error=`Cleveland CPI availability ${deferred?'deferred':'unavailable'} (${failures}).`;
 }else if(!headline.latestAvailable||!core.latestAvailable)error='Cleveland CPI latest reference row is unavailable; both latest observations must be usable.';
 else if(headline.latestReferencePeriod!==core.latestReferencePeriod||headline.latestAvailablePeriod!==core.latestAvailablePeriod)error='Cleveland CPI headline and core latest periods do not align.';
 else if(headline.latestReferencePeriod<ANCHOR_PERIOD)error=`Cleveland CPI availability is stale and trails approved reference period ${ANCHOR_PERIOD}.`;
 const latestPeriod=error?null:headline.latestReferencePeriod;
 return {
  source:'cleveland-fed-cpi',status:error?'error':'checked',error,latestPeriod,availability,attempts,provenance,
  candidates:error?[]:[{sourceUrl:LANDING_URL,matchBy:'referencePeriod',period:latestPeriod,publicationDate:null,evidenceType:'secondary-data-availability',seriesIds:['cpiMonthly','cpiCoreMonthly']}],
  coverage:{kind:'latest-reference-period',through,anchorReferencePeriod:ANCHOR_PERIOD},
  sourceNotice:`Federal Reserve Bank of Cleveland secondary CPI data, linked from ${LANDING_URL}. Only headline and core monthly index availability is used.`,
  attribution:'Source: Federal Reserve Bank of Cleveland; underlying Consumer Price Index data: U.S. Bureau of Labor Statistics (BLS). BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.',
  license:{name:'Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)',url:'https://creativecommons.org/licenses/by-sa/4.0/'},
  changesNotice:'Derived monthly availability metadata only, shared under CC BY-SA 4.0. Rounded index values and annualized monthly changes are omitted. October 2025 is a missing and excluded month; the bank’s broader median CPI material warns about interpolation.',
  note:'Checks only the latest aligned secondary data reference period. This is not evidence of an original BLS release date or publication instant; the source may lag BLS, and new periods require source review.',
 };
}
