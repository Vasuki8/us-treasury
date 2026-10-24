import {createHash} from 'node:crypto';
import {isIsoDate} from '../../src/date-window.js';
import {cpiPublicationReleases} from '../cpi-publication-scope.mjs';

const CPI_FEED='https://www.bls.gov/feed/cpi.rss';
const CPI_INDEX='https://www.bls.gov/bls/news-release/cpi.htm';
const ATOM_NAMESPACE='http://www.w3.org/2005/Atom';
const USER_AGENT='us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)';
const MAX_BYTES=2*1024*1024;
const REQUEST_TIMEOUT_MS=12000;
const MAX_RETRY_WAIT_MS=5000;
const TRANSIENT_STATUSES=new Set([408,429,500,502,503,504]);
const reviewedDates=cpiPublicationReleases.map(row=>row.publicationDate).sort();
const FIRST_REVIEWED=reviewedDates[0];
const LATEST_REVIEWED=reviewedDates.at(-1);
const links=html=>[...html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi)].map(match=>match[1]);

/** Existing archive-index contract: bounded, dated, official links only. */
export function discoverCpiCandidates(html,{from='2026-02-13',through=new Date().toISOString().slice(0,10)}={}){
 if(typeof html!=='string'||Buffer.byteLength(html)>MAX_BYTES||!/<h1[^>]*>\s*Consumer Price Index Archived News Releases\s*<\/h1>/i.test(html))throw Error('Unrecognized CPI archive index; source review required.');
 const rows=new Map();
 for(const href of links(html)){
  let url;try{url=new URL(href,CPI_INDEX);}catch{continue;}
  const match=/^\/news\.release\/archives\/cpi_(\d{2})(\d{2})(\d{4})\.htm$/.exec(url.pathname);
  if(url.origin!=='https://www.bls.gov'||url.username||url.password||url.search||url.hash||!match)continue;
  const publicationDate=`${match[3]}-${match[1]}-${match[2]}`;
  if(isIsoDate(publicationDate)&&publicationDate>=from&&publicationDate<=through)rows.set(url.href,{sourceUrl:url.href,publicationDate});
 }
 if(rows.size>1000)throw Error('CPI candidate scope exceeds bound.');
 return [...rows.values()].sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate));
}

const invalidFeed=()=>{throw Error('Unrecognized CPI release feed; source review required.');};
const validXmlCodePoint=value=>value===9||value===10||value===13||(value>=32&&value<=0xd7ff)||(value>=0xe000&&value<=0xfffd)||(value>=0x10000&&value<=0x10ffff);
function decodeXml(text){
 return text.replace(/&(?:amp|lt|gt|apos|quot|#x[0-9a-fA-F]+|#\d+);|&/g,entity=>{
  const predefined={'&amp;':'&','&lt;':'<','&gt;':'>','&apos;':"'",'&quot;':'"'};
  if(Object.hasOwn(predefined,entity))return predefined[entity];
  if(entity==='&')invalidFeed();
  const value=entity.startsWith('&#x')?Number.parseInt(entity.slice(3,-1),16):Number.parseInt(entity.slice(2,-1),10);
  if(!validXmlCodePoint(value))invalidFeed();
  return String.fromCodePoint(value);
 });
}

// A strict, bounded XML subset is sufficient for this fixed plain-text Atom feed.
// There is no DTD, entity expansion, network resolution, recovery, or HTML parsing.
function parseAtomXml(input){
 if(typeof input!=='string'||Buffer.byteLength(input)>MAX_BYTES||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u.test(input))invalidFeed();
 for(const character of input)if(!validXmlCodePoint(character.codePointAt(0)))invalidFeed();
 let xml=input.replace(/^\ufeff/,''),position=0,root=null,nodes=0;
 const stack=[];
 if(xml.startsWith('<?xml')){
  const declaration=/^<\?xml\s+version=(["'])1\.0\1(?:\s+encoding=(["'])UTF-8\2)?\s*\?>/.exec(xml);
  if(!declaration)invalidFeed();
  position=declaration[0].length;
 }
 const appendText=(value,decode=true)=>{
  if(!stack.length){if(value.trim())invalidFeed();return;}
  if(decode&&value.includes(']]>'))invalidFeed();
  stack.at(-1).text+=decode?decodeXml(value):value;
 };
 while(position<xml.length){
  if(xml[position]!=='<'){
   const end=xml.indexOf('<',position),limit=end===-1?xml.length:end;
   appendText(xml.slice(position,limit));position=limit;continue;
  }
  if(xml.startsWith('<!--',position)){
   const end=xml.indexOf('-->',position+4);
   if(end===-1||xml.slice(position+4,end).includes('--')||xml[end-1]==='-')invalidFeed();
   position=end+3;continue;
  }
  if(xml.startsWith('<![CDATA[',position)){
   const end=xml.indexOf(']]>',position+9);
   if(end===-1||!stack.length)invalidFeed();
   appendText(xml.slice(position+9,end),false);position=end+3;continue;
  }
  if(xml.startsWith('<!',position)||xml.startsWith('<?',position))invalidFeed();
  let end=position+1,quote=null;
  for(;end<xml.length;end++){
   const char=xml[end];
   if(quote){if(char===quote)quote=null;}
   else if(char==='"'||char==="'")quote=char;
   else if(char==='>')break;
  }
  if(end===xml.length||quote)invalidFeed();
  let tag=xml.slice(position+1,end);position=end+1;
  if(tag.startsWith('/')){
   const closing=/^\/([A-Za-z_][\w.:-]*)\s*$/.exec(tag);
   if(!closing||!stack.length||stack.at(-1).qualifiedName!==closing[1])invalidFeed();
   stack.pop();continue;
  }
  const selfClosing=tag.endsWith('/');if(selfClosing)tag=tag.slice(0,-1);
  const name=/^([A-Za-z_][\w.:-]*)/.exec(tag);
  const qualifiedName=/^[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?$/;
  if(!name||!qualifiedName.test(name[1]))invalidFeed();
  const attributes={},namespace={...(stack.at(-1)?.namespace||{})};
  let remainder=tag.slice(name[0].length);
  while(remainder.length){
   if(/^\s*$/.test(remainder))break;
   const attribute=/^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"<]*)"|'([^'<]*)')/.exec(remainder);
   if(!attribute||!qualifiedName.test(attribute[1])||Object.hasOwn(attributes,attribute[1]))invalidFeed();
   attributes[attribute[1]]=decodeXml(attribute[2]??attribute[3]);
   remainder=remainder.slice(attribute[0].length);
  }
  for(const [key,value] of Object.entries(attributes)){
   if(key==='xmlns')namespace['']=value;
   else if(key.startsWith('xmlns:')){
    const prefix=key.slice(6);
    if(prefix==='xmlns'||(prefix==='xml'&&value!=='http://www.w3.org/XML/1998/namespace')||!value)invalidFeed();
    namespace[prefix]=value;
   }
  }
  const [prefix,localName]=name[1].includes(':')?name[1].split(':'):['',name[1]];
  if(namespace[prefix]!==ATOM_NAMESPACE)invalidFeed();
  const expandedAttributes=new Set();
  for(const key of Object.keys(attributes)){
   if(key==='xmlns'||key.startsWith('xmlns:'))continue;
   const parts=key.split(':');
   if(parts.length>2||(parts.length===2&&parts[0]!=='xml'&&!namespace[parts[0]]))invalidFeed();
   const expanded=parts.length===2?`${parts[0]==='xml'?'http://www.w3.org/XML/1998/namespace':namespace[parts[0]]}:${parts[1]}`:key;
   if(expandedAttributes.has(expanded))invalidFeed();
   expandedAttributes.add(expanded);
  }
  const node={qualifiedName:name[1],name:localName,namespace,attributes,text:'',children:[]};
  if(++nodes>15000||stack.length>=32)invalidFeed();
  if(stack.length){
   if(localName==='feed'||(localName==='entry'&&stack.at(-1)!==root))invalidFeed();
   stack.at(-1).children.push(node);
  }else{if(root)invalidFeed();root=node;}
  if(!selfClosing)stack.push(node);
 }
 if(stack.length||!root||root.name!=='feed')invalidFeed();
 return root;
}

function oneChild(node,name){
 const matches=node.children.filter(child=>child.name===name);
 if(matches.length!==1)return invalidFeed();
 return matches[0];
}
function scalarChild(node,name){
 const child=oneChild(node,name);
 if(child.children.length)invalidFeed();
 return child.text.trim();
}
function descendantLinks(node){
 return node.children.flatMap(child=>[...(child.name==='link'?[child]:[]),...descendantLinks(child)]);
}

/** Extract review-only dated release identities. Feed clocks and rate prose are ignored. */
export function parseCpiReleaseFeed(xml,{from=FIRST_REVIEWED,through=new Date().toISOString().slice(0,10)}={}){
 if(!isIsoDate(from)||!isIsoDate(through)||from>through)invalidFeed();
 const root=parseAtomXml(xml);
 if(root.text.trim()||scalarChild(root,'id')!=='bls.gov:feed:cpi'||scalarChild(root,'title')!=='Consumer Price Index')invalidFeed();
 const entries=root.children.filter(child=>child.name==='entry');
 if(!entries.length||entries.length>1000)invalidFeed();
 const ids=new Set(),urls=new Set(),candidates=[];
 for(const item of entries){
  if(item.text.trim())invalidFeed();
  const id=scalarChild(item,'id');
  const identity=/^cpi-(\d{4})_(\d{2})_(\d{2})__(?:[01]\d|2[0-3])_[0-5]\d_[0-5]\d$/.exec(id);
  const link=oneChild(item,'link'),allLinks=descendantLinks(item),sourceUrl=link.attributes.href;
  if(allLinks.length!==1||link.children.length||link.text.trim()||(link.attributes.rel&&link.attributes.rel!=='alternate'))invalidFeed();
  const dated=/^https:\/\/www\.bls\.gov\/news\.release\/archives\/cpi_(\d{2})(\d{2})(\d{4})\.htm$/.exec(sourceUrl||'');
  if(!identity||!dated||ids.has(id)||urls.has(sourceUrl))invalidFeed();
  const publicationDate=`${dated[3]}-${dated[1]}-${dated[2]}`;
  if(!isIsoDate(publicationDate)||publicationDate!==`${identity[1]}-${identity[2]}-${identity[3]}`)invalidFeed();
  ids.add(id);urls.add(sourceUrl);
  if(publicationDate>=from&&publicationDate<=through)candidates.push({sourceUrl,publicationDate});
 }
 return candidates.sort((a,b)=>a.publicationDate.localeCompare(b.publicationDate));
}

class DiscoveryFailure extends Error{
 constructor(errorCode,outcome,status=null,retryAfter=null){super(errorCode);Object.assign(this,{errorCode,outcome,status,retryAfter});}
}

function retryDelay(value,now){
 if(typeof value!=='string')return 1000;
 const trimmed=value.trim();
 // Numeric overflow is still a server request for more than our wait budget.
 if(/^\d+$/.test(trimmed))return Math.max(1000,Number(trimmed)*1000);
 const delay=/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), /i.test(trimmed)?Date.parse(trimmed)-now.getTime():NaN;
 return Number.isFinite(delay)?Math.max(1000,delay):1000;
}

// Cancellation must not extend the deadline when a remote body does not settle.
function cancelUnread(bodyOrReader){
 try{Promise.resolve(bodyOrReader?.cancel()).catch(()=>{});}catch{}
}

async function readOfficialResponse(url,accept,fetchImpl){
 const controller=new AbortController();
 let timer,reader,httpStatus=null,timedOut=false;
 const deadline=new Promise((resolve,reject)=>{
  timer=setTimeout(()=>{
   timedOut=true;
   controller.abort();
   if(reader)cancelUnread(reader);
   reject(new DiscoveryFailure('REQUEST_TIMEOUT','timeout',httpStatus));
  },REQUEST_TIMEOUT_MS);
 });
 const request=(async()=>{
  const response=await fetchImpl(url,{headers:{Accept:accept,'User-Agent':USER_AGENT},redirect:'manual',signal:controller.signal});
  httpStatus=Number.isInteger(response.status)?response.status:null;
  const rejectResponse=failure=>{cancelUnread(response.body);throw failure;};
  if(timedOut)rejectResponse(new DiscoveryFailure('REQUEST_TIMEOUT','timeout',httpStatus));
  if(response.redirected||(response.url&&response.url!==url)||(response.status>=300&&response.status<400))rejectResponse(new DiscoveryFailure('REDIRECT_REJECTED','redirect',response.status));
  if(response.status!==200)rejectResponse(new DiscoveryFailure(`HTTP_${Number.isInteger(response.status)?response.status:'INVALID'}`,'http-error',httpStatus,response.headers?.get('retry-after')));
  const lengthHeader=response.headers?.get('content-length');
  if(lengthHeader&&/^\d+$/.test(lengthHeader)&&Number(lengthHeader)>MAX_BYTES)rejectResponse(new DiscoveryFailure('RESPONSE_TOO_LARGE','too-large',200));
  const chunks=[];let length=0;
  if(response.body?.getReader){
   reader=response.body.getReader();let completed=false;
   try{
    while(true){
     const {done,value}=await reader.read();
     if(timedOut)throw new DiscoveryFailure('REQUEST_TIMEOUT','timeout',200);
     if(done){completed=true;break;}
     length+=value.byteLength;
     if(length>MAX_BYTES)throw new DiscoveryFailure('RESPONSE_TOO_LARGE','too-large',200);
     chunks.push(Buffer.from(value));
    }
   }finally{if(!completed)cancelUnread(reader);reader.releaseLock();reader=null;}
  }else{
   const bytes=Buffer.from(await response.arrayBuffer());
   if(bytes.length>MAX_BYTES)throw new DiscoveryFailure('RESPONSE_TOO_LARGE','too-large',200);
   chunks.push(bytes);length=bytes.length;
  }
  const bytes=Buffer.concat(chunks,length);
  let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw new DiscoveryFailure('INVALID_ENCODING','invalid-source',200);}
  const lastModified=response.headers?.get('last-modified');
  return {text,provenance:{url,sha256:createHash('sha256').update(bytes).digest('hex'),retrievedAt:new Date().toISOString(),lastModified:typeof lastModified==='string'&&lastModified.length<=200&&Number.isFinite(Date.parse(lastModified))?lastModified:null}};
 })();
 try{return await Promise.race([request,deadline]);}
 catch(error){if(timedOut)throw new DiscoveryFailure('REQUEST_TIMEOUT','timeout',httpStatus);if(error instanceof DiscoveryFailure)throw error;throw new DiscoveryFailure('TRANSPORT_ERROR','transport-error',httpStatus);}
 finally{clearTimeout(timer);}
}

/** Fixed official BLS surfaces, finite attempts, and no automatic source admission. */
export async function collectCpiReleaseDiscovery({fetchImpl=globalThis.fetch,now=new Date(),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}){
 const through=now.toISOString().slice(0,10),attempts=[];
 const endpoints=[
  {url:CPI_FEED,source:'release-feed',accept:'application/atom+xml, application/rss+xml, application/xml;q=0.9, text/xml;q=0.8',parse:parseCpiReleaseFeed},
  {url:CPI_INDEX,source:'archive-index',accept:'text/html',parse:discoverCpiCandidates},
 ];
 let deferred=false;
 for(const endpoint of endpoints){
  let rateLimited=false;
  for(let attempt=1;attempt<=2;attempt++){
   let downloaded;
   try{
    downloaded=await readOfficialResponse(endpoint.url,endpoint.accept,fetchImpl);
    let candidates;
    try{candidates=endpoint.parse(downloaded.text,{from:FIRST_REVIEWED,through});}
    catch{throw new DiscoveryFailure('INVALID_SOURCE','invalid-source',200);}
    if(!candidates.length)throw new DiscoveryFailure('NO_IN_SCOPE_CANDIDATES','invalid-source',200);
    if(endpoint.source==='release-feed'&&!candidates.some(candidate=>candidate.publicationDate===LATEST_REVIEWED))throw new DiscoveryFailure('FEED_ANCHOR_MISSING','invalid-source',200);
    attempts.push({url:endpoint.url,httpStatus:200,outcome:'accepted',attempt,errorCode:null});
    const rolling=endpoint.source==='release-feed';
    return {
     status:'checked',candidates,provenance:[downloaded.provenance],attempts,source:endpoint.source,
     coverage:{kind:rolling?'rolling-feed':'archive-index',from:rolling?candidates[0].publicationDate:FIRST_REVIEWED,through,anchorPublicationDate:LATEST_REVIEWED},
     note:rolling?'Checks the rolling recent official CPI release feed, anchored to the latest reviewed publication; does not inventory every historical edition. Dates are review-only URL identities, not verified publication instants.':'Checks official dated CPI archive-index links from the first reviewed publication through the check day; candidates still require source review.',
     error:null,
    };
   }catch(error){
    const failure=error instanceof DiscoveryFailure?error:new DiscoveryFailure('TRANSPORT_ERROR','transport-error');
    const row={url:endpoint.url,httpStatus:failure.status,outcome:failure.outcome,attempt,errorCode:failure.errorCode};
    attempts.push(row);
    rateLimited ||=failure.status===429;
    const transient=failure.outcome==='transport-error'||failure.outcome==='timeout'||TRANSIENT_STATUSES.has(failure.status);
    if(!transient)break;
    const delay=retryDelay(failure.retryAfter,now);
    if(delay>MAX_RETRY_WAIT_MS){row.errorCode='RETRY_AFTER_EXCEEDS_BUDGET';deferred=true;break;}
    if(attempt===2){deferred=rateLimited;break;}
    await pause(delay);
   }
  }
  if(deferred)break;
 }
 const reasons=attempts.map(row=>`${row.url===CPI_FEED?'release-feed':'archive-index'} ${row.errorCode}`).join('; ');
 return {status:'error',candidates:[],provenance:[],attempts,source:null,coverage:null,note:'CPI discovery did not establish a healthy official discovery surface; no publication candidates were admitted.',error:`CPI release discovery ${deferred?'deferred':'unavailable'}: ${reasons}.`};
}
