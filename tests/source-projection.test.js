import test from 'node:test';
import assert from 'node:assert/strict';
import { currentSnapshotAssets } from '../scripts/current-snapshot.mjs';
import { snapshotModule } from '../scripts/snapshot-storage.mjs';

const moduleValue = async source => (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).snapshot;
const codecUrl = new URL('../src/source-codec.js', import.meta.url).href;
const projectedValue = source => moduleValue(source.replace("'./source-codec.js'", JSON.stringify(codecUrl)));

test('current projection keeps one calendar year plus predecessor and complete metadata, without changing full sources', async () => {
  const rows = [
    { date:'2021-12-31', value:-0 }, { date:'2022-02-28', value:1 }, { date:'2023-02-27', value:2 },
    { date:'2023-02-28', value:3 }, { date:'2023-03-01', value:null }, { date:'2024-02-29', value:5 },
  ];
  const source = {
    id:'alpha', provenance:[{ url:'https://example.test/original', sha256:'a'.repeat(64) }],
    series:{ measure:{ unit:'Original units', coverageNote:'Original limitation.', observations:rows } },
    curveHistory:[{ date:'2021-12-31', nominal:{ '10Y':-0 } }], sourceNotice:'Exact required terms.',
  };
  const input = { generatedAt:'2026-10-29T00:00:00Z', sources:{ alpha:source }, releases:[] };
  const before = snapshotModule(input), result = currentSnapshotAssets(input, snapshotModule);
  assert.equal(snapshotModule(input), before);
  assert.deepEqual(result.snapshot.sources.alpha.series.measure.observations, rows.slice(2));
  assert.deepEqual(result.snapshot.sources.alpha.series.measure.retainedCoverage, {
    startDate:'2021-12-31', endDate:'2024-02-29', count:6,
  });
  assert.equal(result.snapshot.sources.alpha.curveHistory, undefined);
  assert.equal(result.snapshot.sources.alpha.sourceNotice, source.sourceNotice);
  assert.deepEqual(result.snapshot.sources.alpha.provenance, source.provenance);
  assert.deepEqual(await projectedValue(result.module), result.snapshot);
  const entry = result.snapshot.sourceArchive.sources.alpha;
  assert.deepEqual((await moduleValue(result.files.get(entry.url.slice(2)))).source, source);
});
