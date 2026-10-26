import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {requestBytes,OfficialSourceHttpError} from '../scripts/sources/http.mjs';

const url='https://example.test/official-data';
async function configured(value,run){
 const previous=process.env.SOURCE_RETRY_ATTEMPTS;
 if(value===undefined)delete process.env.SOURCE_RETRY_ATTEMPTS;else process.env.SOURCE_RETRY_ATTEMPTS=value;
 try{return await run();}finally{if(previous===undefined)delete process.env.SOURCE_RETRY_ATTEMPTS;else process.env.SOURCE_RETRY_ATTEMPTS=previous;}
}

test('manual defaults stay single-attempt and trusted GET configuration enables bounded retries, while POST stays single-attempt',async()=>{
 await configured(undefined,async()=>{
  let calls=0;await assert.rejects(requestBytes(url,{fetchImpl:async()=>{calls++;return new Response('',{status:503});},sleepImpl:async()=>assert.fail('default must not sleep')}),/503/);assert.equal(calls,1);
 });
 await configured('3',async()=>{
  const pauses=[];let calls=0;
  await assert.rejects(requestBytes(url,{fetchImpl:async()=>{calls++;return new Response('',{status:503});},sleepImpl:async ms=>pauses.push(ms)}),/503/);
  assert.equal(calls,3);assert.deepEqual(pauses,[5000,30000]);
  calls=0;await assert.rejects(requestBytes(url,{method:'POST',body:'{}',fetchImpl:async()=>{calls++;return new Response('',{status:503});},sleepImpl:async()=>assert.fail('implicit POST must not retry')}),/503/);assert.equal(calls,1);
 });
});

test('only final accepted response bytes and retrieval metadata are returned after transient failures',async()=>{
 let calls=0;const pauses=[],body=Buffer.from([0x50,0x4b,0xff,0,0x80]);
 const result=await requestBytes(url,{maxAttempts:3,fetchImpl:async()=>++calls<3?new Response('unavailable',{status:503}):new Response(body,{headers:{'last-modified':'Sun, 25 Oct 2026 12:00:00 GMT'}}),sleepImpl:async ms=>pauses.push(ms)});
 assert.equal(calls,3);assert.deepEqual(pauses,[5000,30000]);assert.deepEqual(result.bytes,body);
 assert.equal(result.sha256,createHash('sha256').update(body).digest('hex'));
 assert.equal(result.lastModified,'Sun, 25 Oct 2026 12:00:00 GMT');assert.equal(result.url,url);
 assert.doesNotMatch(JSON.stringify(result),/unavailable/);
});

test('explicit POST attempts and status subset preserve caller-controlled fallback behavior',async()=>{
 let calls=0;
 await assert.rejects(requestBytes(url,{method:'POST',maxAttempts:3,retryStatuses:[408,429,500,502,504],fetchImpl:async()=>{calls++;return new Response('primary failure',{status:503});},sleepImpl:async()=>assert.fail('excluded503 must immediately reach caller fallback')}),/503/);
 assert.equal(calls,1);
 const pauses=[];calls=0;
 await requestBytes(url,{method:'POST',maxAttempts:2,fetchImpl:async()=>++calls===1?new Response('',{status:502}):new Response('complete'),sleepImpl:async ms=>pauses.push(ms)});
 assert.equal(calls,2);assert.deepEqual(pauses,[5000]);
});

test('Retry-After seconds and HTTP dates are respected against an advancing clock',async()=>{
 let clock=Date.parse('2026-10-25T12:00:00Z'),calls=0;const pauses=[];
 await requestBytes(url,{maxAttempts:3,retryNow:()=>clock,sleepImpl:async ms=>{pauses.push(ms);clock+=ms;},fetchImpl:async()=>{
  calls++;return calls===1?new Response('',{status:429,headers:{'retry-after':'12'}}):calls===2?new Response('',{status:503,headers:{'retry-after':'Sun, 25 Oct 2026 12:00:50 GMT'}}):new Response('accepted');
 }});
 assert.equal(calls,3);assert.deepEqual(pauses,[12000,38000]);
 for(const retryAfter of ['Sunday, 25-Oct-26 12:00:12 GMT','Sun Oct 25 12:00:12 2026']){
  let requests=0;const waits=[];await requestBytes(url,{maxAttempts:2,retryNow:()=>new Date('2026-10-25T12:00:00Z'),sleepImpl:async ms=>waits.push(ms),fetchImpl:async()=>++requests===1?new Response('',{status:503,headers:{'retry-after':retryAfter}}):new Response('accepted')});
  assert.deepEqual(waits,[12000],'HTTP obsolete date forms still establish the minimum cooldown');
 }
});

test('server cooldown exceeding total remaining wait budget is deferred without retrying early or exposing header text',async()=>{
 for(const retryAfter of ['61','999999999999999999999999999','Sun, 25 Oct 2026 13:00:00 GMT']){
  let calls=0;await assert.rejects(requestBytes(url,{maxAttempts:3,retryNow:()=>Date.parse('2026-10-25T12:00:00Z'),fetchImpl:async()=>{calls++;return new Response('private-response-canary',{status:429,headers:{'retry-after':retryAfter}});},sleepImpl:async()=>assert.fail('over-budget cooldown cannot be truncated')}),error=>{
   assert.ok(error instanceof OfficialSourceHttpError);assert.equal(error.retryAfterMs,60001);assert.doesNotMatch(JSON.stringify(error),/private-response-canary|Sun, 25 Oct/);return true;
  });assert.equal(calls,1);
 }
 let calls=0;const pauses=[];
 await assert.rejects(requestBytes(url,{maxAttempts:3,fetchImpl:async()=>{calls++;return new Response('',{status:503,headers:{'retry-after':calls===1?'40':'30'}});},sleepImpl:async ms=>pauses.push(ms)}),/503/);
 assert.equal(calls,2);assert.deepEqual(pauses,[40000],'remaining20s cannot accommodate second30s cooldown');
});

test('denials, redirects and ordinary HTTP failures are terminal',async()=>{
 for(const status of [301,302,400,401,403,404,405,409,422,501]){
  let calls=0;await assert.rejects(requestBytes(url,{maxAttempts:3,fetchImpl:async()=>{calls++;return new Response('',{status});},sleepImpl:async()=>assert.fail('non-transient HTTP must not sleep')}),new RegExp(String(status)));assert.equal(calls,1);
 }
 let calls=0;await assert.rejects(requestBytes(url,{maxAttempts:3,fetchImpl:async()=>{calls++;const response=new Response('',{status:503});Object.defineProperties(response,{url:{value:'https://other.test/denied'},redirected:{value:true}});return response;},sleepImpl:async()=>assert.fail('redirected failure must not retry')}),/503/);assert.equal(calls,1);
});

test('known network fetch/stream failures and timeout/abort retry; parser, configuration and size errors do not',async()=>{
 for(const failure of [new TypeError('fetch failed',{cause:{code:'ECONNRESET'}}),new TypeError('fetch failed',{cause:{code:'UND_ERR_CONNECT_TIMEOUT'}}),new TypeError('network route unavailable',{cause:{code:'ENETUNREACH'}}),new TypeError('host route unavailable',{cause:{code:'EHOSTUNREACH'}}),new DOMException('request timeout','TimeoutError'),new DOMException('request aborted','AbortError')]){
  let calls=0;const pauses=[];await requestBytes(url,{maxAttempts:2,fetchImpl:async()=>{if(++calls===1)throw failure;return new Response('accepted');},sleepImpl:async ms=>pauses.push(ms)});assert.equal(calls,2);assert.deepEqual(pauses,[5000]);
 }
 for(const failure of [new Error('bad schema'),new TypeError('invalid options'),new TypeError('blocked',{cause:{code:'EACCES'}}),new TypeError('certificate',{cause:{code:'CERT_HAS_EXPIRED'}})]){
  let calls=0;await assert.rejects(requestBytes(url,{maxAttempts:3,fetchImpl:async()=>{calls++;throw failure;},sleepImpl:async()=>assert.fail('nontransport failure cannot retry')}),error=>error===failure);assert.equal(calls,1);
 }
 let calls=0;await requestBytes(url,{maxAttempts:2,fetchImpl:async()=>++calls===1?new Response(new ReadableStream({start(controller){controller.error(new TypeError('stream reset',{cause:{code:'ECONNRESET'}}));}})):new Response('accepted'),sleepImpl:async()=>{}});assert.equal(calls,2);
 calls=0;await assert.rejects(requestBytes(url,{maxAttempts:3,maxBytes:2,fetchImpl:async()=>{calls++;return new Response('oversized');},sleepImpl:async()=>assert.fail('byte limit cannot retry')}),/limit/);assert.equal(calls,1);
 calls=0;await assert.rejects(requestBytes(url,{maxAttempts:3,maxBytes:2,fetchImpl:async()=>{calls++;return new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array([1,2,3]));},cancel(){throw new TypeError('cancel reset',{cause:{code:'ECONNRESET'}});}}));},sleepImpl:async()=>assert.fail('unexpected retry after response rejection')}),error=>error.message==='Official response exceeds the source byte limit');assert.equal(calls,1);
});

test('invalid Retry-After uses bounded backoff; explicit options are validated before requests',async()=>{
 let calls=0;const pauses=[];await requestBytes(url,{maxAttempts:2,fetchImpl:async()=>++calls===1?new Response('',{status:503,headers:{'retry-after':'private-header-canary'}}):new Response('accepted'),sleepImpl:async ms=>pauses.push(ms)});assert.deepEqual(pauses,[5000]);
 for(const maxAttempts of [0,4,1.5,'3',null])await assert.rejects(requestBytes(url,{maxAttempts,fetchImpl:async()=>assert.fail('invalid attempt count must not request')}),RangeError);
 for(const retryStatuses of [[403],[503,503],['503'],null])await assert.rejects(requestBytes(url,{retryStatuses,fetchImpl:async()=>assert.fail('invalid retry status list must not request')}),RangeError);
});
