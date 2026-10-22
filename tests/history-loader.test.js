import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHistoryLoader } from '../src/history-loader.js';
import { recordVintages, revisionHistory } from '../src/vintages.js';

const at = '2026-10-20T12:00:00.000Z';
const source = (value, fetchedAt = at) => ({ id:'bea', fetchedAt, series:{gdp:{observations:[{date:'2026-04-01',value,publishedAt:null}]}} });
const baseline = recordVintages(null, {}, {bea:source(2.1)}, {checkedAt:at});
const nextAt = '2026-10-21T12:00:00.000Z';
const history = recordVintages(baseline, {}, {bea:source(2.2,nextAt)}, {checkedAt:nextAt});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function fixture(value = history) {
  const plain = Buffer.from(JSON.stringify(value)), compressed = gzipSync(plain);
  const descriptor = {version:1,compressed:{url:`./history-${sha(compressed)}.json.gz`,sha256:sha(compressed),bytes:compressed.length},fallback:{url:`./history-${sha(plain)}.json`,sha256:sha(plain),bytes:plain.length},captureCount:value.captures?.length??0,latestCaptureAt:value.captures?.at(-1)?.capturedAt??null};
  const requests = [];
  const fetchImpl = async (url, options) => {requests.push({url,options});return {ok:true,arrayBuffer:async()=>Uint8Array.from(url.pathname.endsWith('.gz')?compressed:plain).buffer};};
  return {plain,compressed,descriptor,requests,fetchImpl};
}
const decompress = bytes => gunzipSync(bytes);

test('history stays idle until requested; concurrent reads share a verified gzip load and memoized selected revisions', async () => {
  const f = fixture();
  let resolve;
  const loader = createHistoryLoader(f.descriptor,{fetchImpl:async (...args)=>{await new Promise(done=>{resolve=done;});return f.fetchImpl(...args);},cryptoImpl:webcrypto,decompress});
  assert.equal(loader.getState().status,'idle');
  assert.equal(f.requests.length,0);
  assert.throws(()=>loader.revisions('gdp'),/not ready/i);
  const first = loader.load(), second = loader.load();
  assert.equal(first,second);
  assert.equal(loader.getState().status,'loading');
  resolve();
  assert.deepEqual(await first,history);
  assert.equal(loader.getState().status,'ready');
  assert.equal(f.requests.length,1);
  assert.match(f.requests[0].url.pathname,/\/src\/history-[a-f0-9]{64}\.json\.gz$/);
  assert.equal(f.requests[0].options.credentials,'same-origin');
  assert.deepEqual(loader.revisions('gdp'),revisionHistory(history,'gdp'));
  assert.equal(loader.revisions('gdp'),loader.revisions('gdp'));
  await loader.load();
  assert.equal(f.requests.length,1);
});

test('browsers without native gzip support load and verify only the JSON fallback', async () => {
  const f=fixture();
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress:null});
  assert.deepEqual(await loader.load(),history);
  assert.equal(f.requests.length,1);
  assert.match(f.requests[0].url.pathname,/\.json$/);
});

test('native DecompressionStream decodes the exact browser archive bytes', async()=>{
  const f=fixture();
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto});
  assert.deepEqual(await loader.load(),history);
  assert.match(f.requests[0].url.pathname,/\.json\.gz$/);
});

for(const field of ['compressed','fallback','captureCount'])test(`archive ${field} exceeds the browser limit before fetching`,async()=>{
  const f=fixture();
  if(field==='captureCount')f.descriptor.captureCount=100001;
  else f.descriptor[field].bytes=512*1024*1024+1;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto});
  await assert.rejects(loader.load(),/descriptor|unsupported/i);
  assert.equal(f.requests.length,0);
  assert.equal(loader.getState().status,'error');
});

test('native gzip output stops as soon as it exceeds the declared decoded byte length',async()=>{
  const f=fixture({...history,padding:'x'.repeat(1024*1024)});
  f.descriptor.fallback.bytes=128;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto});
  await assert.rejects(loader.load(),/exceeds declared byte length/i);
  assert.equal(loader.getState().status,'error');
  assert.equal(loader.getState().history,null);
});

test('streamed fetch stops and cancels when it exceeds the declared resource bytes',async()=>{
  const f=fixture();let cancelled=false;
  const body=new ReadableStream({start(controller){controller.enqueue(f.compressed);controller.enqueue(new Uint8Array([0]));},cancel(){cancelled=true;}});
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:async()=>({ok:true,body}),cryptoImpl:webcrypto});
  await assert.rejects(loader.load(),/exceeds declared byte length/i);
  assert.equal(cancelled,true);
  assert.equal(loader.getState().status,'error');
});

test('streamed resources retain exact bytes across multiple chunks',async()=>{
  for(const compressed of [true,false]){
    const f=fixture(),bytes=compressed?f.compressed:f.plain;
    const body=new ReadableStream({start(controller){controller.enqueue(bytes.subarray(0,10));controller.enqueue(bytes.subarray(10));controller.close();}});
    const loader=createHistoryLoader(f.descriptor,{fetchImpl:async()=>({ok:true,body}),cryptoImpl:webcrypto,...(compressed?{}:{decompress:null})});
    assert.deepEqual(await loader.load(),history);
  }
});

test('failure remains an error until an explicit retry, then caches the successful archive', async () => {
  const f=fixture();let broken=true,calls=0;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:async(...args)=>{calls++;if(broken)throw new Error('offline');return f.fetchImpl(...args);},cryptoImpl:webcrypto,decompress});
  await assert.rejects(loader.load(),/offline/);
  assert.equal(loader.getState().status,'error');
  await assert.rejects(loader.load(),/offline/);
  assert.equal(calls,1);
  broken=false;
  assert.deepEqual(await loader.load({retry:true}),history);
  assert.equal(loader.getState().status,'ready');
  assert.equal(calls,2);
});

test('a verified empty archive is ready and distinct from unavailable history',async()=>{
  const f=fixture({version:1,captures:[]});
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress});
  assert.deepEqual(await loader.load(),{version:1,captures:[]});
  assert.equal(loader.getState().status,'ready');
  assert.deepEqual(loader.revisions('gdp'),[]);
});

for(const kind of ['compressed hash','compressed length','decoded hash','decoded length','capture count','latest capture','version','shape','malformed JSON','HTTP','redirect','path'])test(`archive ${kind} corruption fails closed`,async()=>{
  const f=fixture();let fetchImpl=f.fetchImpl;
  if(kind==='compressed hash')f.descriptor.compressed.sha256='0'.repeat(64);
  if(kind==='compressed length')f.descriptor.compressed.bytes++;
  if(kind==='decoded hash')f.descriptor.fallback.sha256='0'.repeat(64);
  if(kind==='decoded length')f.descriptor.fallback.bytes++;
  if(kind==='capture count')f.descriptor.captureCount++;
  if(kind==='latest capture')f.descriptor.latestCaptureAt=at;
  if(kind==='version')f.descriptor.version=2;
  if(kind==='shape'||kind==='malformed JSON'){
    const bytes=Buffer.from(kind==='shape'?JSON.stringify({version:1,captures:[{capturedAt:at}]}):'{');
    f.descriptor.fallback={url:`./history-${sha(bytes)}.json`,sha256:sha(bytes),bytes:bytes.length};
    fetchImpl=async()=>({ok:true,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)});
  }
  if(kind==='HTTP')fetchImpl=async()=>({ok:false,status:404});
  if(kind==='redirect')fetchImpl=async()=>({ok:true,url:'https://other.example/history.json',arrayBuffer:async()=>f.compressed});
  if(kind==='path')f.descriptor.compressed.url=`../history-${sha(f.compressed)}.json.gz`;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl,cryptoImpl:webcrypto,decompress:kind==='shape'||kind==='malformed JSON'?null:decompress});
  await assert.rejects(loader.load());
  assert.equal(loader.getState().status,'error');
  assert.equal(loader.getState().history,null);
});
