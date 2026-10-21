import { createHash } from 'node:crypto';

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

export async function requestBytes(url,{fetchImpl=globalThis.fetch,method='GET',body,headers={},timeoutMs=45000,maxBytes=80*1024*1024}={}) {
  const response=await fetchImpl(url,{method,body,headers:{'Accept':'text/plain, application/json, text/csv, */*',...headers},signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok)throw new Error(`Official source HTTP ${response.status} (${new URL(url).hostname})`);
  const chunks=[];let length=0;
  if(response.body?.getReader) {
    const reader=response.body.getReader();
    try {
      while(true) {
        const {done,value}=await reader.read();if(done)break;
        length+=value.byteLength;
        if(length>maxBytes){await reader.cancel();throw new Error('Official response exceeds the source byte limit');}
        chunks.push(Buffer.from(value));
      }
    } finally {reader.releaseLock();}
  } else {
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>maxBytes)throw new Error('Official response exceeds the source byte limit');
    chunks.push(bytes);length=bytes.length;
  }
  const bytes=Buffer.concat(chunks,length);
  return {bytes,url:response.url||url,sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString(),lastModified:response.headers.get('last-modified')||null};
}

export async function requestText(url,options={}) {
  const {bytes,...metadata}=await requestBytes(url,options);
  return {text:bytes.toString('utf8'),...metadata};
}
