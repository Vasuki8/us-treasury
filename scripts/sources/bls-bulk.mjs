import {createHash} from 'node:crypto';
import {OfficialSourceHttpError} from './http.mjs';

const base='https://download.bls.gov/pub/time.series/';
const MiB=1024*1024;
const projectAgent='us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)';

// BLS documents these partitions and their native series/period/value columns in each family's .txt file.
export const BLS_BULK_FILES=Object.freeze([
 ['ce/ce.data.00a.TotalNonfarm.Employment',['CES0000000001'],MiB],
 ['ce/ce.data.05b.TotalPrivate.AllEmployeeHoursAndEarnings',['CES0500000002','CES0500000003'],2*MiB],
 ['cu/cu.data.1.AllItems',['CUUR0000SA0','CUSR0000SA0'],8*MiB],
 ['cu/cu.data.20.USCommoditiesServicesSpecial',['CUUR0000SA0L1E','CUSR0000SA0L1E'],8*MiB],
 ['jt/jt.data.1.AllItems',['JTS000000000000000JOL','JTS000000000000000HIR','JTS000000000000000QUR','JTS000000000000000LDR'],64*MiB],
 ['ci/ci.data.1.AllData',['CIS1010000000000I'],16*MiB],
 ['pr/pr.data.1.AllData',['PRS85006092','PRS85006112'],8*MiB],
 ['ln/ln.data.1.AllData',['LNS14000000','LNS11300000','LNS13327709','LNS12300000','LNS12300060','LNS11300060'],512*MiB],
].map(([path,seriesIds,maxBytes])=>Object.freeze({url:`${base}${path}`,seriesIds:Object.freeze(seriesIds),maxBytes,footnoteUrl:`${base}${path.split('/')[0]}/${path.split('/')[0]}.footnote`})));

/** Hash the complete decoded file while retaining only one bounded, incomplete line. */
async function readLines(url,{fetchImpl,maxBytes,timeoutMs,onLine}) {
 const controller=new AbortController(),hash=createHash('sha256'),decoder=new TextDecoder('utf-8',{fatal:true});
 let response,reader,timer,bytes=0,carry='';
 const cancel=()=>{
  const pending=reader?reader.cancel():response?.body?.cancel();
  pending?.catch(()=>{});
 };
 function consume(text) {
  text=carry+text;let offset=0,newline;
  while((newline=text.indexOf('\n',offset))!==-1){
   if(newline-offset>64*1024)throw new Error('BLS bulk line exceeds the line buffer limit');
   let line=text.slice(offset,newline);if(line.endsWith('\r'))line=line.slice(0,-1);
   onLine(line);offset=newline+1;
  }
  carry=text.slice(offset);
  if(carry.length>64*1024)throw new Error('BLS bulk line exceeds the line buffer limit');
 }
 const work=(async()=>{
  try{
   response=await fetchImpl(url,{headers:{'Accept':'text/plain','User-Agent':projectAgent},redirect:'error',signal:controller.signal});
   controller.signal.throwIfAborted();
   if(response.redirected||response.url!==url)throw new Error('Unexpected BLS bulk source URL or redirect');
   if(!response.ok)throw new OfficialSourceHttpError(response.status,url,response);
   if(!response.body?.getReader)throw new Error('Missing BLS bulk response stream');
   reader=response.body.getReader();
   while(true){
    const {done,value}=await reader.read();if(done)break;
    bytes+=value.byteLength;
    if(bytes>maxBytes)throw new Error('BLS bulk response exceeds the source byte limit');
    hash.update(value);consume(decoder.decode(value,{stream:true}));
   }
   consume(decoder.decode());if(carry)onLine(carry.endsWith('\r')?carry.slice(0,-1):carry);
   return {url,sha256:hash.digest('hex'),retrievedAt:new Date().toISOString(),lastModified:response.headers.get('last-modified')||null,bytes};
  }catch(error){controller.abort(error);cancel();throw error;}
  finally{if(reader)reader.releaseLock();}
 })();
 const deadline=new Promise((resolve,reject)=>{timer=setTimeout(()=>{
  const error=new Error('BLS bulk request/body deadline exceeded');controller.abort(error);cancel();reject(error);
 },timeoutMs);});
 try{return await Promise.race([work,deadline]);}finally{clearTimeout(timer);}
}

function checkHeader(line,columns,label) {
 if(line.replace(/^\ufeff/,'').split('\t').map(value=>value.trim()).join('|')!==columns.join('|'))throw new Error(`Invalid BLS bulk ${label} header schema`);
}

export async function collectBlsBulk({fetchImpl=globalThis.fetch,now=new Date(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms)),timeoutMs=45000}={}) {
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw new Error('Invalid BLS bulk collection date');
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw new Error('Invalid BLS bulk request deadline');
 const year=now.getUTCFullYear(),startYear=year-9,provenance=[],footnotesByUrl=new Map(),series=[],seriesUrls={};
 async function request(url,maxBytes,onLine){
  if(provenance.length)await pause(1000);
  provenance.push(await readLines(url,{fetchImpl,maxBytes,timeoutMs,onLine}));
 }
 for(const url of new Set(BLS_BULK_FILES.map(file=>file.footnoteUrl))){
  const footnotes=new Map();let headerSeen=false;
  await request(url,64*1024,line=>{
   if(!headerSeen){checkHeader(line,['footnote_code','footnote_text'],'footnote');headerSeen=true;return;}
   if(!line)return;
   const fields=line.split('\t').map(value=>value.trim());
   if(fields.length!==2||!fields[0]||!fields[1])throw new Error('Invalid BLS bulk footnote record schema or empty meaning');
   if(footnotes.has(fields[0]))throw new Error(`Duplicate BLS bulk footnote code: ${fields[0]}`);
   footnotes.set(fields[0],fields[1]);
  });
  if(!headerSeen||!footnotes.size)throw new Error('Empty BLS bulk footnote file');
  footnotesByUrl.set(url,footnotes);
 }
 for(const file of BLS_BULK_FILES){
  const targets=new Map(file.seriesIds.map(id=>[id,{seriesID:id,data:[],seen:new Set()}]));
  const meanings=footnotesByUrl.get(file.footnoteUrl);let headerSeen=false;
  await request(file.url,file.maxBytes,line=>{
   if(!headerSeen){checkHeader(line,['series_id','year','period','value','footnote_codes'],'data');headerSeen=true;return;}
   if(!line)return;
   const tab=line.indexOf('\t'),id=(tab===-1?line:line.slice(0,tab)).trim(),target=targets.get(id);
   if(!target)return;
   const fields=line.split('\t').map(value=>value.trim());
   if(fields.length!==5)throw new Error(`Invalid BLS bulk record schema for ${id}`);
   const [,sourceYear,period,value,codes]=fields;
   if(!/^\d{4}$/.test(sourceYear)||sourceYear==='0000')throw new Error(`Invalid BLS bulk year for ${id}`);
   if(Number(sourceYear)<startYear||Number(sourceYear)>year)return;
   const quarterly=/^(?:CI|PR)/.test(id);
   if(!(quarterly?/^Q0[1-5]$/:/^M(?:0[1-9]|1[0-3])$/).test(period))throw new Error(`Invalid BLS bulk period for ${id}`);
   if(!['-','—','(D)','(S)','null'].includes(value)&&(!/^-?\d+(?:\.\d+)?$/.test(value)||!Number.isFinite(Number(value))))throw new Error(`Invalid BLS bulk numeric value for ${id}`);
   const key=`${sourceYear}-${period}`;
   if(target.seen.has(key))throw new Error(`Duplicate BLS bulk observation for ${id}: ${key}`);
   target.seen.add(key);
   if(target.data.length>=(quarterly?50:130))throw new Error(`BLS bulk target row limit exceeded for ${id}`);
   const footnotes=codes?codes.split(',').map(code=>{
    code=code.trim();if(!meanings.has(code))throw new Error(`Unknown BLS bulk footnote code for ${id}: ${code}`);
    return {code,text:meanings.get(code)};
   }):[];
   target.data.push({year:sourceYear,period,value,footnotes});
  });
  if(!headerSeen)throw new Error('Empty BLS bulk data file');
  for(const id of file.seriesIds){
   const target=targets.get(id);
   if(!target.data.some(row=>row.period!=='M13'&&row.period!=='Q05'))throw new Error(`Missing BLS bulk observations for ${id}`);
   target.data.sort((a,b)=>a.year.localeCompare(b.year)||a.period.localeCompare(b.period));
   series.push({seriesID:id,data:target.data});seriesUrls[id]=file.url;
  }
 }
 return {payload:{status:'REQUEST_SUCCEEDED',message:[],Results:{series}},provenance,fetchedAt:provenance.at(-1).retrievedAt,warnings:[],seriesUrls};
}
