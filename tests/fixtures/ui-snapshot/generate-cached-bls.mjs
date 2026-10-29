// Manual fixture authoring only; runtime tests never read the production capture archive.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeStoredSnapshot,encodeStoredSnapshot,loadSnapshotHistory} from '../../../scripts/snapshot-storage.mjs';
import {assertCommercialData} from '../../../scripts/data-policy.mjs';
import {canPublishCachedBlsData} from '../../../scripts/sources/refresh.mjs';
import {asKnownOn} from '../../../src/vintages.js';
import {addMomentumSeries} from '../../../src/momentum.js';
import {registry} from '../../../src/registry.js';

const cutoff='2026-10-24T00:05:02.137Z',now=new Date('2026-10-25T00:17:00.000Z');
const rootBytes=await readFile(new URL('../../../src/official-snapshot.json.gz',import.meta.url));
const stored=decodeStoredSnapshot(rootBytes);
const captures=stored.vintageArchive.captures.filter(row=>row.sourceId==='bls'&&row.capturedAt<=cutoff);
const history=await loadSnapshotHistory({vintageArchive:{version:1,captures}},{
  directory:fileURLToPath(new URL('../../../src/',import.meta.url)),
});
let source=asKnownOn(history,cutoff).sources.bls;
const originalBytes=Buffer.byteLength(JSON.stringify(source));
for(const [id,item] of Object.entries(source.series)){
  const count=registry[id]?.frequency==='Quarterly'?16:24;
  const first=source.historyProfile?.firstPeriods?.[id];
  item.observations=item.observations.filter((row,index)=>index>=item.observations.length-count||row.date===first);
}
source=addMomentumSeries(source);
assertCommercialData({sources:{bls:source}});
const endpoint='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const failure={kind:'http',status:503,requestedUrl:endpoint,url:endpoint,redirected:false};
assert.equal(canPublishCachedBlsData({...source,status:'error',failure},now),true);
const bytes=encodeStoredSnapshot({sources:{bls:source}});
const manifest={version:1,cutoff,capturedAt:source.fetchedAt,sourceSha256:createHash('sha256').update(rootBytes).digest('hex'),
  sha256:createHash('sha256').update(bytes).digest('hex'),compressedBytes:bytes.length,
  jsonBytes:Buffer.byteLength(JSON.stringify(source)),originalBytes,seriesCount:Object.keys(source.series).length};
await writeFile(new URL('./cached-bls.json.gz',import.meta.url),bytes);
await writeFile(new URL('./cached-bls-manifest.json',import.meta.url),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));
