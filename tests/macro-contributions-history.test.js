import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {snapshot} from '../src/official-snapshot.js';
import {loadSnapshotHistory} from '../scripts/snapshot-storage.mjs';
import {asKnownOn} from '../src/vintages.js';

test('retained contribution backfill has all approved history with original capture clocks and earlier captures intact',async()=>{
 const source=snapshot.sources.macroContributions;
 assert.equal(source.status,'ok');assert.equal(source.coverageStart,'1947-04-01');assert.equal(source.coverageEnd,'2026-04-01');
 assert.equal(source.quarterly.length,317);assert.equal(Object.keys(source.series).length,10);
 for(const series of Object.values(source.series)){
  assert.equal(series.observations.length,317);assert.equal(series.observations[0].date,'1947-04-01');assert.equal(series.observations[0].publishedAt,null);
  assert.ok(series.observations.every(row=>Object.hasOwn(row,'sourceValue')));
 }
 assert.equal(source.provenance[0].retrievedAt,source.fetchedAt);assert.match(source.coverageNote,/first captured on the actual retrieval date/i);
 assert.equal(source.quarterly.at(-1).imports,-1.66);assert.equal(source.quarterly.at(-1).fixedInvestment,1.35);assert.equal(source.quarterly.at(-1).reconciliationResidual,-.02);
 const history=await loadSnapshotHistory(snapshot,{directory:fileURLToPath(new URL('../src/',import.meta.url))});
 const captures=history.captures.filter(row=>row.sourceId==='macroContributions');
 const latest=captures.at(-1);assert.equal(latest.capturedAt,source.fetchedAt);assert.equal(latest.series.gdpTotalContribution.upserts.length,281);assert.deepEqual(latest.series.gdpTotalContribution.deletedDates,[]);
 assert.equal(asKnownOn(history,source.fetchedAt).sources.macroContributions.series.gdpTotalContribution.observations.length,317);
 const earlier=captures.filter(row=>row.capturedAt<source.fetchedAt);assert.ok(earlier.length>=2);assert.equal(asKnownOn(history,earlier.at(-1).capturedAt).sources.macroContributions.series.gdpTotalContribution.observations.length,36);
 assert.ok(earlier.every(row=>row.capturedAt<latest.capturedAt));
});
