import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {snapshot} from '../src/official-snapshot.js';import {loadSnapshotHistory,browserSnapshotAssets} from './snapshot-storage.mjs';
import {assertCommercialData} from './data-policy.mjs';import {asKnownOn,revisionHistory} from '../src/vintages.js';
import {vintagesCsv} from '../src/vintages-page.js';

const directory=fileURLToPath(new URL('../src/',import.meta.url));
const history=await loadSnapshotHistory(snapshot,{directory}),full={...snapshot,vintages:history};assertCommercialData(full);
const option=process.argv.slice(2);if(option.some(arg=>!arg.startsWith('--baseline=')))throw new Error('Only --baseline=<saved snapshot JSON> is supported');
let checkedCutoffs=0,checkedSeries=0,checkedCsv=0;
if(option.length){
 const before=JSON.parse(await readFile(option[0].slice('--baseline='.length),'utf8')),prior=before.vintages;
 assert.ok(prior?.version===1&&Array.isArray(prior.captures),'Baseline must contain the original full capture history');
 const retained={version:1,captures:history.captures.slice(0,prior.captures.length)};
 assert.deepEqual(retained,prior,'Every original capture object and its order must remain exact');
 const cutoffs=[...new Set(prior.captures.flatMap(c=>[new Date(c.capturedAt).toISOString(),new Date(Date.parse(c.capturedAt)-1).toISOString()]))].sort();
 for(const cutoff of cutoffs){assert.deepEqual(asKnownOn(retained,cutoff),asKnownOn(prior,cutoff),`As-known mismatch at ${cutoff}`);checkedCutoffs++;}
 const ids=[...new Set(prior.captures.flatMap(c=>[...Object.keys(c.series),...c.removedSeries]))];
 const latest=cutoffs.at(-1);
 for(const id of ids){assert.deepEqual(revisionHistory(retained,id),revisionHistory(prior,id),`Revision mismatch for ${id}`);checkedSeries++;assert.equal(vintagesCsv(retained,{seriesId:id,cutoff:latest}),vintagesCsv(prior,{seriesId:id,cutoff:latest}),`CSV mismatch for ${id}`);checkedCsv++;}
}
const assets=browserSnapshotAssets(full),compressed=assets.snapshot.historyArchive.compressed,fallback=assets.snapshot.historyArchive.fallback;
const storedBytes=(await stat(path.join(directory,'official-snapshot.js'))).size;
const archiveBytes=snapshot.vintageArchive?.captures.reduce((n,c)=>n+c.bytes,0)??0;
console.log(JSON.stringify({captures:history.captures.length,checkedCutoffs,checkedSeries,checkedCsv,currentModuleBytes:Buffer.byteLength(assets.module),lazyGzipBytes:compressed.bytes,lazyFallbackBytes:fallback.bytes,storedRootBytes:storedBytes,immutableArchiveBytes:archiveBytes},null,2));
