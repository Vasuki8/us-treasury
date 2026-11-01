import test from 'node:test';
import assert from 'node:assert/strict';
import {isBuiltAsset,moduleAssetReferences,staticModuleReferences,parseImportMap,resolveModuleReference} from '../scripts/asset-references.mjs';
import {readFile} from 'node:fs/promises';

test('font and license build paths require content hashes and reject arbitrary nested files',()=>{
 for(const extension of ['woff2','ttf','txt'])assert.equal(isBuiltAsset(`assets/fonts/inter-variable.0123456789abcdef.${extension}`),true);
 for(const name of ['assets/fonts/inter.ttf','assets/fonts/other.js','assets/fonts/nested/inter.0123456789abcdef.ttf','assets/fonts/inter.0123456789ABCDEF.ttf'])assert.equal(isBuiltAsset(name),false,name);
});
test('static discovery includes imports and re-exports while excluding lazy modules and history descriptors', () => {
  const source = [
    "import './side-effect.js';",
    "import value from './default.js';",
    "import {a} from './named.js';",
    "export {b} from './re-export.js';",
    "export * from './all.js';",
    "import{c}from'./compact-import.js';",
    "export{d}from'./compact-export.js';",
    "export*from'./compact-all.js';",
    "const action='import'; const label='not a module';",
    "const lazy=()=>import('./later.js');",
    `const archive={url:'./history-${'a'.repeat(64)}.json.gz'};`,
  ].join('\n');
  assert.deepEqual(staticModuleReferences(source), [
    './side-effect.js', './default.js', './named.js', './re-export.js', './all.js',
    './compact-import.js', './compact-export.js', './compact-all.js',
  ]);
});
test('asset discovery includes static modules and both lazy archive variants without interpreting arbitrary code',()=>{
 const a='a'.repeat(64),b='b'.repeat(64);assert.deepEqual(moduleAssetReferences(`import {a} from './data.js'; export {b} from './other.js';const descriptor={compressed:{url:'./history-${a}.json.gz'},fallback:{url:"./history-${b}.json"}};`),['./data.js','./other.js',`./history-${a}.json.gz`,`./history-${b}.json`]);
});
test('asset discovery follows literal lazy module imports for publication archive verification',()=>{
 assert.deepEqual(moduleAssetReferences(`const load=()=>import('./publication-archive.js'); const same=import( './publication-archive.js' ); const opaque=import(variable);`),['./publication-archive.js']);
});

test('asset discovery follows every binary history part and recognizes only content-addressed build paths',()=>{
 const a='a'.repeat(64),b='b'.repeat(64);
 const files=[`./history-${a}.bin`,`./history-${b}.bin.gz`];
 const source=`export const historyArchive={sources:{treasury:{parts:[{fallback:{url:'${files[0]}'},compressed:{url:'${files[1]}'}}]}}};`;
 assert.deepEqual(moduleAssetReferences(source),files);
 for(const file of files)assert.equal(isBuiltAsset('assets/src/'+file.slice(2)),true);
 for(const file of [`history-${a}.bin`,`assets/src/history-${a}.BIN`,`assets/src/history-short.bin`,`assets/src/nested/history-${a}.bin`]){
  assert.equal(isBuiltAsset(file),false,file);
 }
});
test('the claims archive remains a discoverable literal lazy asset while retries may use a query',async()=>{
 const source=await readFile(new URL('../src/claims-publication-loader.js',import.meta.url),'utf8');
 assert.ok(moduleAssetReferences(source).includes('./claims-publication-archive.js'));
});

test('module resolution follows per-file import maps under a deployment prefix and preserves literal lazy data', () => {
  const base = new URL('https://example.test/preview/');
  const html = '<script type="importmap">{"imports":{"./assets/src/data.js":"./assets/src/data.0123456789abcdef.js"}}</script>';
  const imports = parseImportMap(html, base);
  const parent = new URL('./assets/src/app.fedcba9876543210.js', base);
  assert.equal(resolveModuleReference('./data.js', parent, imports).href,
    'https://example.test/preview/assets/src/data.0123456789abcdef.js');
  const source = `./source-${'a'.repeat(64)}.js`;
  assert.deepEqual(moduleAssetReferences(`export const descriptor={url:'${source}'};`), [source]);
  assert.equal(resolveModuleReference(source, parent, imports).href, new URL(source, parent).href);
});

test('import-map parsing rejects malformed or remote maps instead of skipping dependencies', () => {
  const base = new URL('https://example.test/preview/');
  for (const contents of ['{', '{"imports":[]}', '{"imports":{"./data.js":"https://other.test/data.js"}}']) {
    assert.throws(() => parseImportMap(`<script type="importmap">${contents}</script>`, base), /JSON|import.map|local/i);
  }
});
