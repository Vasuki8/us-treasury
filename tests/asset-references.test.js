import test from 'node:test';import assert from 'node:assert/strict';import {moduleAssetReferences} from '../scripts/asset-references.mjs';
test('asset discovery includes static modules and both lazy archive variants without interpreting arbitrary code',()=>{
 const a='a'.repeat(64),b='b'.repeat(64);assert.deepEqual(moduleAssetReferences(`import {a} from './data.js'; export {b} from './other.js';const descriptor={compressed:{url:'./history-${a}.json.gz'},fallback:{url:"./history-${b}.json"}};`),['./data.js','./other.js',`./history-${a}.json.gz`,`./history-${b}.json`]);
});
test('asset discovery follows literal lazy module imports for publication archive verification',()=>{
 assert.deepEqual(moduleAssetReferences(`const load=()=>import('./publication-archive.js'); const same=import( './publication-archive.js' ); const opaque=import(variable);`),['./publication-archive.js']);
});
