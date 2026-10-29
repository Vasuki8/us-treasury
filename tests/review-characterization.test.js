import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {transformSeries,toCsv,observationCapture} from '../src/model.js';
import {
  createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv,
} from '../src/research-packages.js';

// Captured before the review refactor at b3a7adf. Tests never regenerate fixtures.
// Inputs retain each requested window plus its predecessor, complete observations,
// catalog metadata, source receipts and source series metadata. Gzip preserves long
// source URLs and exact CRLF CSV/package bytes without unreadable fixture lines.
const directory=new URL('./fixtures/review-characterization/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
async function fixture(name){
  const raw=gunzipSync(await readFile(new URL(`${name}.json.gz`,directory)));
  assert.equal(raw.length,manifest[name].bytes,`${name} fixture byte count`);
  assert.equal(createHash('sha256').update(raw).digest('hex'),manifest[name].sha256,`${name} fixture integrity`);
  return JSON.parse(raw);
}
const inputs=await fixture('inputs'),expected=await fixture('expected');
const bytes=value=>Buffer.from(value,'utf8');

for(const entry of manifest.cases){
  const {id,startDate,endDate}=entry,range={preset:'custom',startDate,endDate};
  const item=inputs.catalog[id],baseline=expected[id];

  test(`review baseline ${id}: levels, changes and every observation provenance field survive the window`,()=>{
    assert.equal(item.observations[0].date,entry.precedingDate);
    for(const mode of ['level','change']){
      const {series,...panel}=transformSeries(item,mode,range);
      assert.deepEqual(panel,baseline.panels[mode]);
    }
    const panel=transformSeries(item,'level',range);
    assert.deepEqual(panel.observations.map(({date,value})=>[date,value]),entry.readings);
    assert.deepEqual(panel.observations.map(row=>observationCapture(item,row)),baseline.captures);
  });

  test(`review baseline ${id}: level and change CSV exports retain exact UTF-8 bytes`,()=>{
    for(const transform of ['level','change']){
      const csv=toCsv([id],{catalog:inputs.catalog,range,transform});
      assert.deepEqual(bytes(csv),bytes(baseline.csv[transform]));
      assert.ok(csv.endsWith('\r\n'));
    }
  });

  test(`review baseline ${id}: frozen package, source metadata and imported CSV retain exact bytes`,async()=>{
    const state={page:'indicator',seriesId:id,selected:[id],window:'custom',startDate,endDate};
    state.transform='level';state.comparison='native';
    const pkg=await createResearchPackage({
      ...inputs,id:`review-${id}`,name:`Review ${id}`,now:manifest.now,state,
    });
    assert.deepEqual(bytes(exportResearchPackage(pkg)),bytes(baseline.package));
    assert.deepEqual(bytes(researchPackageCsv(pkg)),bytes(baseline.csv.level));
    assert.ok(Object.isFrozen(pkg.catalog[id].observations));
    const restored=await importResearchPackage(baseline.package);
    assert.deepEqual(bytes(exportResearchPackage(restored)),bytes(baseline.package));
    assert.deepEqual(bytes(researchPackageCsv(restored)),bytes(baseline.csv.level));
    assert.deepEqual(restored.catalog[id].observations,item.observations);
  });
}
