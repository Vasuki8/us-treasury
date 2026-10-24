import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {discoverCpiCandidates,parseCpiReleaseFeed,collectCpiReleaseDiscovery} from '../scripts/sources/cpi-discovery.mjs';

const FEED='https://www.bls.gov/feed/cpi.rss';
const INDEX='https://www.bls.gov/bls/news-release/cpi.htm';
const NOW=new Date('2026-10-24T12:00:00.000Z');
const OCTOBER='https://www.bls.gov/news.release/archives/cpi_10142026.htm';
const NOVEMBER='https://www.bls.gov/news.release/archives/cpi_11102026.htm';
const entry=(date='2026-10-14',url=OCTOBER,id=`cpi-${date.replaceAll('-','_')}__07_50_31`)=>`<entry><title>CPI for all items increases 0.6% in September; gasoline rises</title><link href="${url}"/><id>${id}</id><content>Rates in this text are not admitted.</content><published>2026-10-14T07:50:31.2-04:00</published><updated>2026-10-14T07:50:31.2-04:00</updated><category>News Release</category></entry>`;
const feed=(entries=entry())=>`<?xml version='1.0' encoding='UTF-8'?><feed xmlns="http://www.w3.org/2005/Atom"><id>bls.gov:feed:cpi</id><title>Consumer Price Index</title><updated>2026-10-14T07:50:31.2-04:00</updated><author><name>Bureau of Labor Statistics Publications</name><uri>https://www.bls.gov</uri></author>${entries}</feed>`;
const html=`<h1>Consumer Price Index Archived News Releases</h1><a href="${OCTOBER}">October</a>`;
const response=(body,status=200,headers={})=>new Response(body,{status,headers});

test('Atom dated links produce review identities only, with dates taken from the URL',()=>{
 const xml=feed(entry('2026-11-10',NOVEMBER)+entry()+entry('2026-01-13','https://www.bls.gov/news.release/archives/cpi_01132026.htm'));
 assert.deepEqual(parseCpiReleaseFeed(xml,{from:'2026-02-13',through:'2026-11-20'}),[
  {sourceUrl:OCTOBER,publicationDate:'2026-10-14'},
  {sourceUrl:NOVEMBER,publicationDate:'2026-11-10'},
 ]);
});

test('the actual official 12-entry Atom shape yields the nine currently in-scope reviewed identities',async()=>{
 const xml=await readFile(new URL('./fixtures/cpi-discovery-feed.atom',import.meta.url),'utf8');
 const candidates=parseCpiReleaseFeed(xml,{through:'2026-10-24'});
 assert.equal(candidates.length,9);
 assert.deepEqual(candidates[0],{sourceUrl:'https://www.bls.gov/news.release/archives/cpi_02132026.htm',publicationDate:'2026-02-13'});
 assert.deepEqual(candidates.at(-1),{sourceUrl:OCTOBER,publicationDate:'2026-10-14'});
});

test('foreign feeds, malformed XML and declared or unresolved entities are rejected',()=>{
 const xml=feed();
 for(const invalid of [
  xml.replace('http://www.w3.org/2005/Atom','https://example.invalid/Atom'),
  xml.replace('bls.gov:feed:cpi','bls.gov:feed:ppi'),
  xml.replace('<title>Consumer Price Index</title>','<title>Latest Numbers</title>'),
  xml.replace('</entry>','</item>'),
  xml.replace('</feed>',''),
  xml+'<another/>',
  xml.replace('<entry>','<entry bad="1" bad="2">'),
  xml.replace('<entry>','<entry xmlns="https://example.invalid/Atom">'),
  xml.replace('<entry>','<entry xmlns:="unused">'),
  xml.replace('<entry>','<entry attr:="unused">'),
  xml.replace('<entry>','<entry xmlns:xml="http://www.w3.org/2005/Atom">'),
  xml.replace('Consumer Price Index</title>','Consumer Price Index\ud800</title>'),
  xml.replace('<?xml','<?XML'),
  xml.replace('<id>bls.gov:feed:cpi</id>','<id>bls.gov:feed:cpi &unknown;</id>'),
  '<!DOCTYPE feed [<!ENTITY injected "cpi">]>'+xml,
 ])assert.throws(()=>parseCpiReleaseFeed(invalid),/CPI release feed/);
});

test('mutable, external, invalid-date, conflicting and duplicate entry identities are rejected',()=>{
 for(const invalidEntry of [
  entry('2026-10-14','https://www.bls.gov/news.release/cpi.htm'),
  entry('2026-10-14','https://evil.invalid/news.release/archives/cpi_10142026.htm'),
  entry('2026-10-14',OCTOBER+'?download=1'),
  entry('2026-10-14',OCTOBER+'#table'),
  entry('2026-10-14','https://www.bls.gov/news.release/archives/cpi_02302026.htm'),
  entry('2026-09-11',OCTOBER),
  entry()+entry(),
  entry()+entry('2026-10-14',OCTOBER,'cpi-2026_10_14__08_30_00'),
  entry().replace('<link href=', '<link href="https://example.invalid/"/><link href='),
 ])assert.throws(()=>parseCpiReleaseFeed(feed(invalidEntry)),/CPI release feed/);
});

test('archive HTML extraction retains its date-scoped deduplication contract',()=>{
 assert.deepEqual(discoverCpiCandidates(html+`<a href="${OCTOBER}">same</a><a href="https://evil.invalid/news.release/archives/cpi_11102026.htm">foreign</a><a href="/news.release/archives/cpi_01132026.htm">old</a>`,{through:'2026-10-24'}),[{sourceUrl:OCTOBER,publicationDate:'2026-10-14'}]);
 assert.throws(()=>discoverCpiCandidates('Access denied'),/CPI archive index/);
 assert.deepEqual(discoverCpiCandidates(html.replace(OCTOBER,'https://untrusted@www.bls.gov/news.release/archives/cpi_10142026.htm'),{through:'2026-10-24'}),[]);
});

test('healthy primary feed uses the honest fixed request and preserves the accepted body receipt',async()=>{
 const calls=[],xml=feed();
 const result=await collectCpiReleaseDiscovery({now:NOW,fetchImpl:async(url,options)=>{calls.push({url,options});return response(xml);}});
 assert.equal(result.status,'checked');
 assert.equal(result.source,'release-feed');
 assert.equal(result.coverage.kind,'rolling-feed');
 assert.equal(result.coverage.anchorPublicationDate,'2026-10-14');
 assert.match(result.note,/rolling|recent/i);
 assert.match(result.note,/does not|not.*histor/i);
 assert.deepEqual(result.candidates,[{sourceUrl:OCTOBER,publicationDate:'2026-10-14'}]);
 assert.deepEqual(calls.map(call=>call.url),[FEED]);
 assert.equal(calls[0].options.redirect,'manual');
 assert.equal(calls[0].options.headers['User-Agent'],'us-treasury-data-refresh/1.0 (+https://github.com/Vasuki8/us-treasury/issues)');
 assert.match(calls[0].options.headers.Accept,/atom\+xml/);
 assert.match(calls[0].options.headers.Accept,/rss\+xml/);
 assert.ok(calls[0].options.signal instanceof AbortSignal);
 assert.equal(result.provenance[0].url,FEED);
 assert.equal(result.provenance[0].sha256,createHash('sha256').update(xml).digest('hex'));
 assert.ok(Number.isFinite(Date.parse(result.provenance[0].retrievedAt)));
 assert.deepEqual(result.attempts,[{url:FEED,httpStatus:200,outcome:'accepted',attempt:1,errorCode:null}]);
});

test('denial falls back once to the archive and keeps sanitized endpoint evidence',async()=>{
 const urls=[];
 const result=await collectCpiReleaseDiscovery({now:NOW,fetchImpl:async url=>{urls.push(url);return url===FEED?response('private denial body',403):response(html);}});
 assert.equal(result.status,'checked');
 assert.equal(result.source,'archive-index');
 assert.equal(result.coverage.kind,'archive-index');
 assert.deepEqual(urls,[FEED,INDEX]);
 assert.equal(result.attempts[0].errorCode,'HTTP_403');
 assert.equal(result.attempts[0].httpStatus,403);
 assert.equal(result.provenance.length,1);
 assert.equal(result.provenance[0].url,INDEX);
 assert.doesNotMatch(JSON.stringify(result),/private denial body/);
});

test('a stale feed without the latest reviewed publication falls back without claiming full-history scope',async()=>{
 const urls=[];
 const stale=feed(entry('2026-09-11','https://www.bls.gov/news.release/archives/cpi_09112026.htm'));
 const result=await collectCpiReleaseDiscovery({now:NOW,fetchImpl:async url=>{urls.push(url);return response(url===FEED?stale:html);}});
 assert.equal(result.status,'checked');
 assert.equal(result.source,'archive-index');
 assert.deepEqual(urls,[FEED,INDEX]);
 assert.equal(result.attempts[0].errorCode,'FEED_ANCHOR_MISSING');
});

test('empty and future-only feeds cannot establish a healthy discovery surface',async()=>{
 for(const xml of [feed(''),feed(entry('2026-11-10',NOVEMBER))]){
  const urls=[];
  const result=await collectCpiReleaseDiscovery({now:NOW,fetchImpl:async url=>{urls.push(url);return response(url===FEED?xml:html);}});
  assert.equal(result.status,'checked');
  assert.equal(result.source,'archive-index');
  assert.deepEqual(urls,[FEED,INDEX]);
 }
});

test('transient HTTP and transport failures retry at most twice with bounded backoff',async()=>{
 for(const transient of [408,429,500,502,503,504,'transport']){
  const urls=[],pauses=[];
  const result=await collectCpiReleaseDiscovery({now:NOW,pause:async delay=>pauses.push(delay),fetchImpl:async url=>{
   urls.push(url);
   if(urls.length===1){if(transient==='transport')throw new Error('secret transport details');return response('unavailable',transient);}
   return response(feed());
  }});
  assert.equal(result.status,'checked',String(transient));
  assert.deepEqual(urls,[FEED,FEED]);
  assert.deepEqual(pauses,[1000]);
  assert.equal(result.attempts.length,2);
  assert.doesNotMatch(JSON.stringify(result),/secret transport/);
 }
});

test('exhausted transient attempts fall back only after the endpoint attempt bound',async()=>{
 const urls=[],pauses=[];
 const result=await collectCpiReleaseDiscovery({now:NOW,pause:async ms=>pauses.push(ms),fetchImpl:async url=>{urls.push(url);return url===FEED?response('temporarily unavailable',503):response(html);}});
 assert.equal(result.status,'checked');
 assert.deepEqual(urls,[FEED,FEED,INDEX]);
 assert.deepEqual(pauses,[1000]);
 assert.equal(result.attempts.length,3);
});

test('Retry-After is honored within budget and long waits defer the whole same-host collection',async()=>{
 for(const retryAfter of ['3','Sat, 24 Oct 2026 12:00:04 GMT']){
  const urls=[],pauses=[];
  const result=await collectCpiReleaseDiscovery({now:NOW,pause:async ms=>pauses.push(ms),fetchImpl:async url=>{urls.push(url);return urls.length===1?response('later',429,{'Retry-After':retryAfter}):response(feed());}});
  assert.equal(result.status,'checked');
  assert.deepEqual(pauses,[retryAfter==='3'?3000:4000]);
  assert.deepEqual(urls,[FEED,FEED]);
 }
 const urls=[],pauses=[];
 const deferred=await collectCpiReleaseDiscovery({now:NOW,pause:async ms=>pauses.push(ms),fetchImpl:async url=>{urls.push(url);return response('sensitive challenge text',429,{'Retry-After':'6'});}});
 assert.equal(deferred.status,'error');
 assert.deepEqual(urls,[FEED]);
 assert.deepEqual(pauses,[]);
 assert.equal(deferred.attempts[0].errorCode,'RETRY_AFTER_EXCEEDS_BUDGET');
 assert.match(deferred.error,/defer/i);
 assert.doesNotMatch(JSON.stringify(deferred),/sensitive challenge/);
});

test('repeated rate limiting does not immediately hit the same-host archive fallback',async()=>{
 const urls=[];
 const result=await collectCpiReleaseDiscovery({now:NOW,pause:async()=>{},fetchImpl:async url=>{urls.push(url);return response('later',429);}});
 assert.equal(result.status,'error');
 assert.deepEqual(urls,[FEED,FEED]);
 assert.equal(result.attempts.length,2);
 assert.match(result.error,/defer/i);
 assert.deepEqual(result.provenance,[]);
});

test('an overflowing numeric Retry-After defers rather than becoming a one-second retry',async()=>{
 const urls=[],pauses=[];
 const result=await collectCpiReleaseDiscovery({now:NOW,pause:async ms=>pauses.push(ms),fetchImpl:async url=>{urls.push(url);return response('later',429,{'Retry-After':'9'.repeat(400)});}});
 assert.equal(result.status,'error');
 assert.deepEqual(urls,[FEED]);
 assert.deepEqual(pauses,[]);
 assert.equal(result.attempts[0].errorCode,'RETRY_AFTER_EXCEEDS_BUDGET');
});

test('redirects, parse failures, partial responses and size failures are never retried',async()=>{
 for(const badResponse of [
  ()=>response('',302,{'Location':OCTOBER}),
  ()=>response(feed(),206),
  ()=>response('malformed XML'),
  ()=>response('x'.repeat(2*1024*1024+1)),
 ]){
  const urls=[],pauses=[];
  const result=await collectCpiReleaseDiscovery({now:NOW,pause:async ms=>pauses.push(ms),fetchImpl:async url=>{urls.push(url);return url===FEED?badResponse():response(html);}});
  assert.equal(result.status,'checked');
  assert.equal(result.source,'archive-index');
  assert.deepEqual(urls,[FEED,INDEX]);
  assert.deepEqual(pauses,[]);
 }
});

test('rejected status, redirect and oversized headers cancel unread bodies',async()=>{
 for(const [status,headers] of [[403,{}],[302,{Location:OCTOBER}],[200,{'Content-Length':String(2*1024*1024+1)}]]){
  let canceled=0;
  const body=new ReadableStream({cancel(){canceled++;}});
  const result=await collectCpiReleaseDiscovery({now:NOW,fetchImpl:async url=>url===FEED?new Response(body,{status,headers}):response(html)});
  assert.equal(result.status,'checked');
  assert.equal(result.source,'archive-index');
  assert.equal(canceled,1);
 }
});

test('both denied endpoints remain a visible error with no candidates or invented receipt',async()=>{
 const urls=[];
 const result=await collectCpiReleaseDiscovery({now:NOW,fetchImpl:async url=>{urls.push(url);return response('denial <sensitive>',403);}});
 assert.equal(result.status,'error');
 assert.deepEqual(result.candidates,[]);
 assert.deepEqual(result.provenance,[]);
 assert.deepEqual(urls,[FEED,INDEX]);
 assert.equal(result.attempts.length,2);
 assert.match(result.error,/HTTP_403/);
 assert.doesNotMatch(JSON.stringify(result),/sensitive/);
});

test('the request deadline includes a body read that never settles',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const urls=[],signals=[];
 const resultPromise=collectCpiReleaseDiscovery({now:NOW,pause:async()=>{},fetchImpl:async(url,options)=>{
  urls.push(url);signals.push(options.signal);
  return {status:200,url,redirected:false,headers:new Headers(),body:null,arrayBuffer:()=>new Promise(()=>{})};
 }});
 for(let attempt=0;attempt<4;attempt++){
  await new Promise(resolve=>setImmediate(resolve));
  t.mock.timers.tick(12000);
 }
 const result=await resultPromise;
 assert.equal(result.status,'error');
 assert.deepEqual(urls,[FEED,FEED,INDEX,INDEX]);
 assert.ok(signals.every(signal=>signal.aborted));
 assert.ok(result.attempts.every(attempt=>attempt.errorCode==='REQUEST_TIMEOUT'));
 assert.ok(result.attempts.every(attempt=>attempt.httpStatus===200));
});
