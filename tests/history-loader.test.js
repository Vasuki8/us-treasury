import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createHistoryLoader } from '../src/history-loader.js';
import { asKnownOn, recordVintages, revisionHistory } from '../src/vintages.js';

const at = '2026-10-20T12:00:00.000Z';
const nextAt = '2026-10-21T12:00:00.000Z';
const latestAt = '2026-10-22T12:00:00.000Z';
const source = (id, series, fetchedAt = at) => ({ id, fetchedAt, series:Object.fromEntries(Object.entries(series).map(([key,value])=>[key,{observations:[{date:'2026-04-01',value,publishedAt:null}]}])) });
const baseline = recordVintages(null, {}, {bea:source('bea',{gdp:2.1,gdi:2}),bls:source('bls',{cpi:3})}, {checkedAt:at});
const history = recordVintages(baseline, {}, {bea:source('bea',{gdp:2.2,gdi:2},nextAt),bls:source('bls',{cpi:3.1},latestAt)}, {checkedAt:latestAt});
const beaHistory = {version:1,captures:[history.captures[0],history.captures[2]]};
const blsHistory = {version:1,captures:[history.captures[1],history.captures[3]]};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const decompress = bytes => gunzipSync(bytes);

function fixture(value = history) {
  const groups = new Map();
  value.captures.forEach((capture,index)=>{
    if(!groups.has(capture.sourceId))groups.set(capture.sourceId,{version:1,sourceId:capture.sourceId,captureIndexes:[],captures:[]});
    const group=groups.get(capture.sourceId);group.captureIndexes.push(index);group.captures.push(capture);
  });
  const descriptor={version:2,captureCount:value.captures.length,latestCaptureAt:value.captures.reduce((latest,capture)=>latest===null||capture.capturedAt>latest?capture.capturedAt:latest,null),sources:{}};
  const assets=new Map(), requests=[];
  const replaceBundle=(id,bundle)=>{
    const plain=Buffer.from(typeof bundle==='string'?bundle:JSON.stringify(bundle)), compressed=gzipSync(plain);
    const entry=descriptor.sources[id]??={};
    entry.compressed={url:`./history-${sha(compressed)}.json.gz`,sha256:sha(compressed),bytes:compressed.length};
    entry.fallback={url:`./history-${sha(plain)}.json`,sha256:sha(plain),bytes:plain.length};
    assets.set(entry.compressed.url.slice(2),{id,bytes:compressed});assets.set(entry.fallback.url.slice(2),{id,bytes:plain});
    return {plain,compressed};
  };
  for(const [id,bundle]of groups){
    descriptor.sources[id]={captureCount:bundle.captures.length,latestCaptureAt:bundle.captures.reduce((latest,capture)=>latest===null||capture.capturedAt>latest?capture.capturedAt:latest,null),seriesIds:[...new Set(bundle.captures.flatMap(capture=>[...Object.keys(capture.series),...capture.removedSeries]))]};
    replaceBundle(id,bundle);
  }
  const fetchImpl=async(url,options)=>{
    const asset=assets.get(url.pathname.split('/').at(-1));
    if(!asset)throw new Error('Unexpected history resource');
    requests.push({url,options,sourceId:asset.id});
    return {ok:true,arrayBuffer:async()=>Uint8Array.from(asset.bytes).buffer};
  };
  return {descriptor,requests,fetchImpl,replaceBundle,bundles:Object.fromEntries(groups),assets};
}

function splitBundle(f,id,boundaries){
  const plain=Buffer.from(JSON.stringify(f.bundles[id])),entry=f.descriptor.sources[id];
  const ends=[0,...(boundaries??[Math.floor(plain.length/2)]),plain.length];
  delete entry.compressed;delete entry.fallback;
  entry.contentBytes=plain.length;entry.contentSha256=sha(plain);
  entry.parts=ends.slice(1).map((end,index)=>{
    const bytes=plain.subarray(ends[index],end),compressed=gzipSync(bytes);
    const part={
      compressed:{url:`./history-${sha(compressed)}.bin.gz`,sha256:sha(compressed),bytes:compressed.length},
      fallback:{url:`./history-${sha(bytes)}.bin`,sha256:sha(bytes),bytes:bytes.length},
    };
    f.assets.set(part.compressed.url.slice(2),{id,bytes:compressed});
    f.assets.set(part.fallback.url.slice(2),{id,bytes});
    return part;
  });
  return plain;
}

test('construction stays idle; a selected source shares one verified load and memoized revisions', async()=>{
  const f=fixture();let resolve;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:async(...args)=>{await new Promise(done=>{resolve=done;});return f.fetchImpl(...args);},cryptoImpl:webcrypto,decompress});
  assert.equal(loader.getState().status,'idle');assert.equal(f.requests.length,0);
  assert.throws(()=>loader.revisions('gdp'),/not ready/i);
  const first=loader.load(),second=loader.load();
  assert.equal(first,second);assert.equal(loader.getState().status,'loading');
  resolve();
  assert.deepEqual(await first,beaHistory);
  assert.equal(loader.getState().status,'ready');
  assert.deepEqual(loader.getState().sourceIds,['bea']);
  assert.equal(loader.getState().latestCaptureAt,latestAt);
  assert.equal(f.requests.length,1);assert.equal(f.requests[0].sourceId,'bea');
  assert.match(f.requests[0].url.pathname,/\/src\/history-[a-f0-9]{64}\.json\.gz$/);
  assert.equal(f.requests[0].options.credentials,'same-origin');assert.equal(f.requests[0].options.redirect,'error');
  assert.deepEqual(loader.revisions('gdp'),revisionHistory(beaHistory,'gdp'));
  assert.equal(loader.revisions('gdp'),loader.revisions('gdp'));
  assert.equal(loader.getState().history,await loader.load());assert.equal(f.requests.length,1);
});

test('series in one source share in-flight requests and cached source captures',async()=>{
  const f=fixture();let resolve;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:async(...args)=>{await new Promise(done=>{resolve=done;});return f.fetchImpl(...args);},cryptoImpl:webcrypto,decompress});
  const gdp=loader.load('gdp'),gdi=loader.load('gdi');
  assert.equal(loader.getState('gdi').status,'loading');resolve();
  assert.deepEqual(await gdp,beaHistory);assert.deepEqual(await gdi,beaHistory);
  assert.equal(f.requests.length,1);assert.equal(loader.getState('cpi').status,'idle');
  assert.deepEqual(loader.revisions('gdi'),[]);
});

test('different sources load concurrently and completing one never exposes the other as ready',async()=>{
  const f=fixture(),pending=new Map();
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:async(url,options)=>{const id=f.assets.get(url.pathname.split('/').at(-1)).id;await new Promise(resolve=>pending.set(id,resolve));return f.fetchImpl(url,options);},cryptoImpl:webcrypto,decompress});
  const gdp=loader.load('gdp'),cpi=loader.load('cpi');
  assert.deepEqual([...pending.keys()],['bea','bls']);
  pending.get('bls')();assert.deepEqual(await cpi,blsHistory);
  assert.equal(loader.getState('gdp').status,'loading');assert.equal(loader.getState('cpi').status,'ready');
  pending.get('bea')();assert.deepEqual(await gdp,beaHistory);
  assert.deepEqual(f.requests.map(item=>item.sourceId),['bls','bea']);
});

test('historically moved and removed series load every mapping and restore original global payload order',async()=>{
  const first=recordVintages(null,{}, {old:source('old',{gdp:1}),other:source('other',{other:9})},{checkedAt:at});
  const moved=recordVintages(first,{}, {old:source('old',{},nextAt),new:source('new',{gdp:2},nextAt)},{checkedAt:nextAt});
  // Global payload order is immutable, even when it differs from timestamp/source sorting.
  const value={version:1,captures:[moved.captures[3],moved.captures[1],moved.captures[0],moved.captures[2]]};
  const f=fixture(value),loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress});
  const expected={version:1,captures:[value.captures[0],value.captures[2],value.captures[3]]};
  assert.deepEqual(await loader.load('gdp'),expected);
  assert.deepEqual(loader.getState('gdp').sourceIds,['new','old']);
  assert.deepEqual(f.requests.map(item=>item.sourceId),['new','old']);
  assert.deepEqual(asKnownOn(loader.getState('gdp').history,nextAt).sources, {new:{id:'new',series:{gdp:{observations:[{date:'2026-04-01',value:2,publishedAt:null}]}},fetchedAt:nextAt,provenance:[]},old:{id:'old',series:{},fetchedAt:nextAt,provenance:[]}});
  assert.equal(loader.getState('gdp').history,await loader.load('gdp'));
});

test('a multiple-source selection remains unavailable until every selected source verifies',async()=>{
  const first=recordVintages(null,{}, {bea:source('bea',{gdp:1}),bls:source('bls',{gdp:2})},{checkedAt:at});
  const f=fixture(first);let resolveBls;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:async(url,options)=>{if(f.assets.get(url.pathname.split('/').at(-1)).id==='bls')await new Promise(resolve=>{resolveBls=resolve;});return f.fetchImpl(url,options);},cryptoImpl:webcrypto,decompress});
  const loading=loader.load();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(loader.getState().status,'loading');assert.equal(loader.getState().history,null);
  resolveBls();assert.deepEqual(await loading,first);
});

test('unmapped series and an empty manifest are ready without fetching unrelated archives',async()=>{
  for(const f of [fixture(),fixture({version:1,captures:[]})]){
    const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress});
    const state=loader.getState('unmapped');
    assert.equal(state.status,'ready');assert.deepEqual(state.sourceIds,[]);
    assert.equal(state.latestCaptureAt,f.descriptor.latestCaptureAt);
    assert.deepEqual(await loader.load('unmapped'),{version:1,captures:[]});
    assert.equal(state.history,loader.getState('unmapped').history);
    assert.deepEqual(loader.revisions('unmapped'),[]);assert.equal(f.requests.length,0);
  }
});

test('browsers without native gzip support verify only the selected JSON fallback',async()=>{
  const f=fixture(),loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress:null});
  assert.deepEqual(await loader.load(),beaHistory);assert.equal(f.requests.length,1);assert.match(f.requests[0].url.pathname,/\.json$/);
});

test('native DecompressionStream decodes exact selected browser archive bytes',async()=>{
  const f=fixture(),loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto});
  assert.deepEqual(await loader.load(),beaHistory);assert.match(f.requests[0].url.pathname,/\.json\.gz$/);
});

test('source failures stay isolated and require explicit retry without refetching ready sources',async()=>{
  const f=fixture();let broken=true,beaCalls=0;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:async(url,options)=>{const id=f.assets.get(url.pathname.split('/').at(-1)).id;if(id==='bea'){beaCalls++;if(broken)throw new Error('offline');}return f.fetchImpl(url,options);},cryptoImpl:webcrypto,decompress});
  await assert.rejects(loader.load('gdp'),/offline/);assert.equal(loader.getState('gdp').status,'error');
  assert.deepEqual(await loader.load('cpi'),blsHistory);assert.equal(loader.getState('cpi').status,'ready');
  await assert.rejects(loader.load('gdi'),/offline/);assert.equal(beaCalls,1);
  broken=false;
  assert.deepEqual(await loader.load('gdi',{retry:true}),beaHistory);
  assert.equal(loader.getState('gdp').status,'ready');assert.equal(beaCalls,2);
  assert.deepEqual(await loader.load('gdp'),beaHistory);
  await loader.load('cpi',{retry:true});assert.equal(f.requests.filter(item=>item.sourceId==='bls').length,1);
});

test('a failed multi-source selection retries only its failed source and never exposes partial history',async()=>{
  const value=recordVintages(null,{}, {bea:source('bea',{gdp:1}),bls:source('bls',{gdp:2})},{checkedAt:at});
  const f=fixture(value);let broken=true;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:async(url,options)=>{if(f.assets.get(url.pathname.split('/').at(-1)).id==='bls'&&broken)throw new Error('offline');return f.fetchImpl(url,options);},cryptoImpl:webcrypto,decompress});
  await assert.rejects(loader.load(),/offline/);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(loader.getState().status,'error');assert.equal(loader.getState().history,null);
  await assert.rejects(loader.load(),/offline/);broken=false;
  assert.deepEqual(await loader.load('gdp',{retry:true}),value);
  assert.deepEqual(f.requests.map(item=>item.sourceId),['bea','bls']);
});

for(const kind of ['version','capture count limit','source ID','source count','total count','global latest','source latest','duplicate series ID','invalid series ID','compressed bytes','fallback bytes','compressed total bytes','fallback total bytes','path'])test(`manifest ${kind} is rejected before any source request`,async()=>{
  const f=fixture(),entry=f.descriptor.sources.bea;
  if(kind==='version')f.descriptor.version=1;
  if(kind==='capture count limit')f.descriptor.captureCount=100001;
  if(kind==='source ID'){f.descriptor.sources['bad/id']=entry;delete f.descriptor.sources.bea;}
  if(kind==='source count')entry.captureCount=0;
  if(kind==='total count')f.descriptor.captureCount++;
  if(kind==='global latest')f.descriptor.latestCaptureAt=nextAt;
  if(kind==='source latest')entry.latestCaptureAt='invalid';
  if(kind==='duplicate series ID')entry.seriesIds.push('gdp');
  if(kind==='invalid series ID')entry.seriesIds.push('../gdp');
  if(kind==='compressed bytes')entry.compressed.bytes=512*1024*1024+1;
  if(kind==='fallback bytes')entry.fallback.bytes=512*1024*1024+1;
  if(kind==='compressed total bytes')for(const value of Object.values(f.descriptor.sources))value.compressed.bytes=256*1024*1024+1;
  if(kind==='fallback total bytes')for(const value of Object.values(f.descriptor.sources))value.fallback.bytes=256*1024*1024+1;
  if(kind==='path')entry.compressed.url=`../history-${entry.compressed.sha256}.json.gz`;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress});
  await assert.rejects(loader.load());assert.equal(loader.getState().status,'error');assert.equal(f.requests.length,0);
});

for(const kind of ['source identity','bundle version','capture count','latest capture','series union','removed series union','index count','index range','index integer','index duplicate','index order','capture identity','shape','missing baseline','duplicate immutable key','invalid observation'])test(`source bundle ${kind} fails closed`,async()=>{
  const f=fixture(),bundle=copy(f.bundles.bea),entry=f.descriptor.sources.bea;
  if(kind==='source identity')bundle.sourceId='bls';
  if(kind==='bundle version')bundle.version=2;
  if(kind==='capture count')bundle.captures.pop();
  if(kind==='latest capture')entry.latestCaptureAt=at;
  if(kind==='series union')entry.seriesIds.push('missing');
  if(kind==='removed series union')bundle.captures[1].removedSeries.push('retired');
  if(kind==='index count')bundle.captureIndexes.pop();
  if(kind==='index range')bundle.captureIndexes[1]=f.descriptor.captureCount;
  if(kind==='index integer')bundle.captureIndexes[1]=1.5;
  if(kind==='index duplicate')bundle.captureIndexes[1]=bundle.captureIndexes[0];
  if(kind==='index order')bundle.captureIndexes.reverse();
  if(kind==='capture identity')bundle.captures[0].sourceId='bls';
  if(kind==='shape')bundle.captures[0]={capturedAt:at};
  if(kind==='missing baseline')bundle.captures[0].baseline=false;
  if(kind==='duplicate immutable key')bundle.captures[1].capturedAt=at;
  if(kind==='invalid observation')bundle.captures[0].series.gdp.upserts[0].date='2026-02-30';
  f.replaceBundle('bea',bundle);
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress});
  await assert.rejects(loader.load());assert.equal(loader.getState().status,'error');assert.equal(loader.getState().history,null);
  assert.equal(f.requests.length,1);
});

test('duplicate global indexes across selected source bundles fail without a partial ready state',async()=>{
  const value=recordVintages(null,{}, {bea:source('bea',{gdp:1}),bls:source('bls',{gdp:2})},{checkedAt:at});
  const f=fixture(value),bundle=copy(f.bundles.bls);bundle.captureIndexes=[0];f.replaceBundle('bls',bundle);
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress});
  await assert.rejects(loader.load(),/index/i);assert.equal(loader.getState().status,'error');assert.equal(loader.getState().history,null);
});

test('native gzip output stops when it exceeds the selected declared decoded byte length',async()=>{
  const f=fixture(),bundle={...f.bundles.bea,padding:'x'.repeat(1024*1024)};f.replaceBundle('bea',bundle);f.descriptor.sources.bea.fallback.bytes=128;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto});
  await assert.rejects(loader.load(),/exceeds declared byte length/i);assert.equal(loader.getState().history,null);
});

test('streamed fetch stops and cancels when it exceeds selected resource bytes',async()=>{
  const f=fixture(),bytes=f.assets.get(f.descriptor.sources.bea.compressed.url.slice(2)).bytes;let cancelled=false;
  const body=new ReadableStream({start(controller){controller.enqueue(bytes);controller.enqueue(new Uint8Array([0]));},cancel(){cancelled=true;}});
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:async()=>({ok:true,body}),cryptoImpl:webcrypto});
  await assert.rejects(loader.load(),/exceeds declared byte length/i);assert.equal(cancelled,true);assert.equal(loader.getState().status,'error');
});

test('streamed selected resources retain exact bytes across multiple chunks',async()=>{
  for(const compressed of [true,false]){
    const f=fixture(),entry=f.descriptor.sources.bea,bytes=f.assets.get((compressed?entry.compressed:entry.fallback).url.slice(2)).bytes;
    const body=new ReadableStream({start(controller){controller.enqueue(bytes.subarray(0,10));controller.enqueue(bytes.subarray(10));controller.close();}});
    const loader=createHistoryLoader(f.descriptor,{fetchImpl:async()=>({ok:true,body}),cryptoImpl:webcrypto,...(compressed?{}:{decompress:null})});
    assert.deepEqual(await loader.load(),beaHistory);
  }
});

for(const kind of ['compressed hash','compressed length','decoded hash','decoded length','malformed JSON','HTTP','redirect','integrity unavailable'])test(`selected resource ${kind} corruption fails closed`,async()=>{
  const f=fixture(),entry=f.descriptor.sources.bea;let fetchImpl=f.fetchImpl;
  if(kind==='compressed hash')entry.compressed.sha256='0'.repeat(64);
  if(kind==='compressed length')entry.compressed.bytes++;
  if(kind==='decoded hash')entry.fallback.sha256='0'.repeat(64);
  if(kind==='decoded length')entry.fallback.bytes++;
  if(kind==='malformed JSON')f.replaceBundle('bea','{');
  if(kind==='HTTP')fetchImpl=async()=>({ok:false,status:404});
  if(kind==='redirect')fetchImpl=async()=>({ok:true,url:'https://other.example/history.json',arrayBuffer:async()=>new Uint8Array()});
  const loader=createHistoryLoader(f.descriptor,{fetchImpl,cryptoImpl:kind==='integrity unavailable'?null:webcrypto,decompress});
  await assert.rejects(loader.load());assert.equal(loader.getState().status,'error');assert.equal(loader.getState().history,null);
});

test('multipart sources reconstruct exact UTF-8 bytes before parsing with gzip and binary fallback',async()=>{
  for(const decode of [decompress,null,undefined]){
    const f=fixture(copy(history));f.bundles.bea.captures[0].metadata.note='漢字😀';
    const plain=Buffer.from(JSON.stringify(f.bundles.bea)),middle=plain.indexOf(Buffer.from('😀'))+2;
    splitBundle(f,'bea',[middle]);
    const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress:decode});
    const expected={version:1,captures:f.bundles.bea.captures};
    assert.deepEqual(await loader.load('gdp'),expected);
    assert.deepEqual(asKnownOn(loader.getState('gdp').history,nextAt),asKnownOn(expected,nextAt));
    assert.equal(f.requests.length,2);assert.equal(loader.getState('cpi').status,'idle');
    assert.ok(f.requests.every(item=>item.url.pathname.endsWith(decode===null?'.bin':'.bin.gz')));
  }
});

test('multipart source loads share one promise and expose no history until the final part verifies',async()=>{
  const f=fixture();splitBundle(f,'bea');let release,requested;
  const waiting=new Promise(resolve=>{requested=resolve;});
  const last=f.descriptor.sources.bea.parts[1].compressed.url.slice(2);
  const fetchImpl=async(url,options)=>{
    if(url.pathname.endsWith(last)){requested();await new Promise(resolve=>{release=resolve;});}
    return f.fetchImpl(url,options);
  };
  const loader=createHistoryLoader(f.descriptor,{fetchImpl,cryptoImpl:webcrypto,decompress});
  const gdp=loader.load('gdp'),again=loader.load('gdp'),gdi=loader.load('gdi');
  assert.equal(gdp,again);await waiting;
  assert.equal(loader.getState('gdp').status,'loading');assert.equal(loader.getState('gdp').history,null);
  assert.equal(loader.getState('gdi').history,null);assert.equal(f.requests.length,1);
  release();assert.deepEqual(await gdp,beaHistory);assert.deepEqual(await gdi,beaHistory);
  assert.equal(f.requests.length,2);await loader.load('gdp');assert.equal(f.requests.length,2);
});

test('a multipart failure remains unavailable and explicit retry preserves ready unrelated sources',async()=>{
  const f=fixture();splitBundle(f,'bea');let broken=true;
  const last=f.descriptor.sources.bea.parts[1].compressed.url.slice(2);
  const fetchImpl=async(url,options)=>{
    if(broken&&url.pathname.endsWith(last))throw new Error('part offline');
    return f.fetchImpl(url,options);
  };
  const loader=createHistoryLoader(f.descriptor,{fetchImpl,cryptoImpl:webcrypto,decompress});
  await loader.load('cpi');await assert.rejects(loader.load('gdp'),/part offline/);
  assert.equal(loader.getState('gdp').status,'error');assert.equal(loader.getState('gdp').history,null);
  const count=f.requests.length;await assert.rejects(loader.load('gdi'),/part offline/);assert.equal(f.requests.length,count);
  broken=false;assert.deepEqual(await loader.load('gdp',{retry:true}),beaHistory);
  assert.equal(loader.getState('cpi').status,'ready');assert.equal(f.requests.filter(item=>item.sourceId==='bls').length,1);
});

test('multipart moved sources preserve original global indexes and accept identical content-addressed parts',async()=>{
  const first=recordVintages(null,{}, {bea:source('bea',{gdp:1}),bls:source('bls',{gdp:2})},{checkedAt:at});
  const value=recordVintages(first,{}, {bea:source('bea',{gdp:3},nextAt),bls:source('bls',{gdp:4},nextAt)},{checkedAt:nextAt});
  const f=fixture(value);f.bundles.bea.captures[0].metadata.note='a'.repeat(16);
  const plain=Buffer.from(JSON.stringify(f.bundles.bea)),start=plain.indexOf(Buffer.from('a'.repeat(16)));
  splitBundle(f,'bea',[start,start+8,start+16]);splitBundle(f,'bls');
  assert.equal(f.descriptor.sources.bea.parts[1].fallback.url,f.descriptor.sources.bea.parts[2].fallback.url);
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress});
  assert.deepEqual(await loader.load('gdp'),value);
});

for(const kind of ['ambiguous','empty','single','non-array','content bytes','content limit','content hash',
  'part shape','part extra','part path','part hash','compressed limit','fallback limit','compressed total','sum']){
  test(`multipart manifest ${kind} fails before fetching`,async()=>{
  const f=fixture();splitBundle(f,'bea');const entry=f.descriptor.sources.bea;
  if(kind==='ambiguous')entry.fallback=entry.parts[0].fallback;
  if(kind==='empty')entry.parts=[];
  if(kind==='single')entry.parts.pop();
  if(kind==='non-array')entry.parts={};
  if(kind==='content bytes')entry.contentBytes=0;
  if(kind==='content limit')entry.contentBytes=512*1024*1024+1;
  if(kind==='content hash')entry.contentSha256='invalid';
  if(kind==='part shape')entry.parts[0]=null;
  if(kind==='part extra')entry.parts[0].extra=true;
  if(kind==='part path')entry.parts[0].fallback.url='../outside.bin';
  if(kind==='part hash')entry.parts[0].compressed.sha256='invalid';
  if(kind==='compressed limit')entry.parts[0].compressed.bytes=20*1024*1024;
  if(kind==='fallback limit')entry.parts[0].fallback.bytes=20*1024*1024;
  if(kind==='compressed total'){
    const parts=entry.parts;
    entry.parts=Array.from({length:28},(_,i)=>({
      fallback:parts[i%2].fallback,compressed:{...parts[i%2].compressed,bytes:20*1024*1024-1},
    }));
    entry.contentBytes=entry.parts.reduce((total,part)=>total+part.fallback.bytes,0);
  }
  if(kind==='sum')entry.contentBytes++;
  const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto,decompress});
  await assert.rejects(loader.load('gdp'));assert.equal(f.requests.length,0);assert.equal(loader.getState('gdp').history,null);
  });
}

for(const kind of ['order','omission','compressed hash','decoded hash','whole hash','decoded limit']){
  test(`multipart ${kind} corruption never exposes partial history`,async()=>{
    const f=fixture();splitBundle(f,'bea');const entry=f.descriptor.sources.bea;
    if(kind==='order')entry.parts.reverse();
    if(kind==='omission')entry.parts.pop();
    if(kind==='compressed hash')entry.parts[1].compressed.sha256='0'.repeat(64);
    if(kind==='decoded hash')entry.parts[1].fallback.sha256='0'.repeat(64);
    if(kind==='whole hash')entry.contentSha256='0'.repeat(64);
    if(kind==='decoded limit'){entry.parts[1].fallback.bytes--;entry.contentBytes--;}
    const loader=createHistoryLoader(f.descriptor,{fetchImpl:f.fetchImpl,cryptoImpl:webcrypto});
    await assert.rejects(loader.load('gdp'));assert.equal(loader.getState('gdp').history,null);
    assert.equal(loader.getState('gdp').status,'error');
  });
}
