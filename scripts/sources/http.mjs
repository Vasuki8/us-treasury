import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const transientStatuses=[408,429,500,502,503,504];
const networkCodes=new Set(['ECONNRESET','ECONNREFUSED','ETIMEDOUT','EAI_AGAIN','ENOTFOUND','ENETUNREACH','EHOSTUNREACH','EPIPE','UND_ERR_CONNECT_TIMEOUT','UND_ERR_HEADERS_TIMEOUT','UND_ERR_BODY_TIMEOUT','UND_ERR_SOCKET']);
const retryWaitBudgetMs=60000;

function retryAfterMilliseconds(value,clock){
  if(typeof value!=='string')return null;
  const text=value.trim();let milliseconds;
  if(/^\d+$/.test(text))milliseconds=Number(text)*1000;
  else{
    const current=Number(clock()),obsolete=/^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), \d{2}-[A-Z][a-z]{2}-(\d{2}) \d{2}:\d{2}:\d{2} GMT$/.exec(text);
    if(!obsolete&&!/^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}:\d{2} GMT|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) [A-Z][a-z]{2} {1,2}\d{1,2} \d{2}:\d{2}:\d{2} \d{4})$/.test(text))return null;
    if(!Number.isFinite(current))return retryWaitBudgetMs+1;
    let parsed=Date.parse(text.endsWith(' GMT')?text:`${text} GMT`);
    if(obsolete){
      const year=Math.floor(new Date(current).getUTCFullYear()/100)*100+Number(obsolete[1]);
      parsed=Date.parse(text.replace(/-\d{2} /,`-${year} `));
      const limit=new Date(current);limit.setUTCFullYear(limit.getUTCFullYear()+50);
      if(parsed>+limit){const adjusted=new Date(parsed);adjusted.setUTCFullYear(adjusted.getUTCFullYear()-100);parsed=+adjusted;}
    }
    milliseconds=parsed-current;
  }
  if(Number.isNaN(milliseconds))return null;
  // One bounded sentinel means the server cooldown exceeds our whole budget.
  return Math.min(retryWaitBudgetMs+1,Math.max(0,milliseconds));
}

function transientFailure(error,statuses){
  if(error instanceof OfficialSourceUnavailableError)return !error.redirected&&error.url===error.requestedUrl;
  if(error instanceof OfficialSourceHttpError)return statuses.includes(error.status)&&!error.redirected&&error.url===error.requestedUrl;
  return error instanceof Error&&(['AbortError','TimeoutError'].includes(error.name)||error instanceof TypeError&&networkCodes.has(error.cause?.code??error.code));
}

/** RFC 4180 CSV, yielded row by row so BEA bulk files need no giant row array. */
export function* iterateCsv(input) {
  const text=String(input).replace(/^\ufeff/,'');
  let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++) {
    const char=text[i];
    if(quoted) {
      if(char==='"' && text[i+1]==='"'){cell+='"';i++;}
      else if(char==='"')quoted=false;
      else cell+=char;
    } else if(char==='"' && cell==='')quoted=true;
    else if(char===','){row.push(cell);cell='';}
    else if(char==='\n' || char==='\r') {
      if(char==='\r' && text[i+1]==='\n')i++;
      row.push(cell);
      if(row.some(value=>value!==''))yield row;
      row=[];cell='';
    } else cell+=char;
  }
  if(quoted)throw new Error('Unterminated quoted CSV field');
  if(cell!=='' || row.length){row.push(cell);yield row;}
}
export const parseCsv=text=>[...iterateCsv(text)];

export class OfficialSourceHttpError extends Error {
  constructor(status,requestedUrl,response={}) {
    super(`Official source HTTP ${status} (${new URL(requestedUrl).hostname})`);
    this.status=status;
    this.requestedUrl=requestedUrl;
    this.url=response.url||requestedUrl;
    this.redirected=Boolean(response.redirected);
  }
}

/** A trusted collector recognized an exact service-outage body, not a schema error. */
export class OfficialSourceUnavailableError extends Error {
  constructor(requestedUrl,response) {
    super(`Official source temporarily unavailable (${new URL(requestedUrl).hostname})`);
    this.status=response.status;
    this.requestedUrl=requestedUrl;
    this.url=response.url||requestedUrl;
    this.redirected=Boolean(response.redirected);
  }
}

async function requestOnce(url,{fetchImpl,method,body,headers,timeoutMs,maxBytes,retryNow,isTransientResponse}) {
  const response=await fetchImpl(url,{method,body,headers:{'Accept':'text/plain, application/json, text/csv, */*',...headers},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok){
    try{Promise.resolve(response.body?.cancel()).catch(()=>{});}catch{}
    const error=new OfficialSourceHttpError(response.status,url,response);
    const retryAfterMs=retryAfterMilliseconds(response.headers?.get('retry-after'),retryNow);
    if(retryAfterMs!==null)error.retryAfterMs=retryAfterMs;
    throw error;
  }
  const chunks=[];let length=0;
  if(response.body?.getReader) {
    const reader=response.body.getReader();
    try {
      while(true) {
        const {done,value}=await reader.read();if(done)break;
        length+=value.byteLength;
        if(length>maxBytes){try{await reader.cancel();}catch{}throw new Error('Official response exceeds the source byte limit');}
        chunks.push(Buffer.from(value));
      }
    } finally {reader.releaseLock();}
  } else {
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>maxBytes)throw new Error('Official response exceeds the source byte limit');
    chunks.push(bytes);length=bytes.length;
  }
  const bytes=Buffer.concat(chunks,length);
  if(isTransientResponse?.({bytes,status:response.status,url:response.url||url,redirected:Boolean(response.redirected),contentType:response.headers.get('content-type')||''})===true){
    const error=new OfficialSourceUnavailableError(url,response);
    const retryAfterMs=retryAfterMilliseconds(response.headers.get('retry-after'),retryNow);
    if(retryAfterMs!==null)error.retryAfterMs=retryAfterMs;
    throw error;
  }
  return {bytes,url:response.url||url,sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString(),lastModified:response.headers.get('last-modified')||null};
}

/** Retries are opt-in for trusted collection; read-only POST callers must opt in explicitly. */
export async function requestBytes(url,{fetchImpl=globalThis.fetch,method='GET',body,headers={},timeoutMs=45000,maxBytes=80*1024*1024,maxAttempts,retryStatuses=transientStatuses,sleepImpl=sleep,retryNow=Date.now,isTransientResponse}={}) {
  const configured=String(method).toUpperCase()==='GET'&&/^[123]$/.test(process.env.SOURCE_RETRY_ATTEMPTS??'')?Number(process.env.SOURCE_RETRY_ATTEMPTS):1;
  const attempts=maxAttempts===undefined?configured:maxAttempts;
  if(!Number.isInteger(attempts)||attempts<1||attempts>3)throw new RangeError('Source attempts must be an integer from one to three.');
  if(!Array.isArray(retryStatuses)||retryStatuses.some(status=>!transientStatuses.includes(status))||new Set(retryStatuses).size!==retryStatuses.length)throw new RangeError('Source retry statuses must be a unique subset of transient HTTP statuses.');
  if(typeof sleepImpl!=='function'||typeof retryNow!=='function')throw new TypeError('Source retry clock and sleep must be functions.');
  if(isTransientResponse!==undefined&&typeof isTransientResponse!=='function')throw new TypeError('Source response recognition must be a function.');
  let waited=0;
  for(let attempt=1;;attempt++){
    try{return await requestOnce(url,{fetchImpl,method,body,headers,timeoutMs,maxBytes,retryNow,isTransientResponse});}
    catch(error){
      if(attempt>=attempts||!transientFailure(error,retryStatuses))throw error;
      const wait=Math.max(attempt===1?5000:30000,error.retryAfterMs??0);
      if(wait>retryWaitBudgetMs-waited)throw error;
      await sleepImpl(wait);waited+=wait;
    }
  }
}

export async function requestText(url,options={}) {
  const {bytes,...metadata}=await requestBytes(url,options);
  return {text:bytes.toString('utf8'),...metadata};
}
