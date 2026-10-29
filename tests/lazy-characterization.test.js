import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {currentSnapshotAssets} from '../scripts/current-snapshot.mjs';
import {snapshotModule} from '../scripts/snapshot-storage.mjs';
import {createSourceLoader} from '../src/source-loader.js';
import {toCsv} from '../src/model.js';
import {createResearchPackage,exportResearchPackage} from '../src/research-packages.js';

const directory=new URL('./fixtures/review-characterization/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',directory),'utf8'));
const fixture=async name=>JSON.parse(gunzipSync(await readFile(new URL(`${name}.json.gz`,directory))));
const inputs=await fixture('inputs'),expected=await fixture('expected');
const sources=structuredClone(inputs.sources);
for(const source of Object.values(sources))for(const [id,item] of Object.entries(source.series)){
  item.observations=inputs.catalog[id].observations;
}
const projected=currentSnapshotAssets({...inputs.snapshot,sources},snapshotModule);
const loader=createSourceLoader(projected.snapshot.sourceArchive,{
  importer:async url=>{
    const bytes=projected.files.get(new URL(url).pathname.split('/').at(-1));
    assert.ok(bytes,'Only generated, same-deployment source modules can load');
    return import(`data:text/javascript;base64,${bytes.toString('base64')}`);
  },
});

for(const {id,startDate,endDate} of manifest.cases){
  test(`lazy ${id} source retains golden CSV and frozen-package bytes after loading`,async()=>{
    const sourceId=Object.keys(sources).find(key=>Object.hasOwn(sources[key].series,id));
    const source=await loader.load(sourceId);
    assert.deepEqual(source,sources[sourceId]);
    assert.equal(JSON.stringify(source),JSON.stringify(sources[sourceId]));
    const catalog={...inputs.catalog,[id]:{...inputs.catalog[id],observations:source.series[id].observations}};
    const range={preset:'custom',startDate,endDate};
    for(const transform of ['level','change']){
      assert.equal(toCsv([id],{catalog,range,transform}),expected[id].csv[transform]);
    }
    const state={page:'indicator',seriesId:id,selected:[id],window:'custom',startDate,endDate};
    state.transform='level';state.comparison='native';
    const pkg=await createResearchPackage({
      ...inputs,catalog,id:`review-${id}`,name:`Review ${id}`,now:manifest.now,state,
    });
    assert.equal(exportResearchPackage(pkg),expected[id].package);
  });
}
