import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from '../server.mjs';
import {isBuiltAsset, moduleAssetReferences, parseImportMap, resolveModuleReference} from './asset-references.mjs';
import {assertBuildBudgets, measureBuild, reportBuildMetrics} from './build-metrics.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const metrics = await measureBuild(path.join(root, 'dist'));
reportBuildMetrics(metrics);
assertBuildBudgets(metrics);
const server = createAppServer(path.join(root, 'dist'));
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(origin);
  assert.equal(response.status, 200, 'Built entry page must be served');
  const html = await response.text();
  assert.match(html, /<title>Meridian/, 'Built entry must contain the application');
  const entry = new URL('/', origin);
  const imports = parseImportMap(html, entry);
  const pending = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(match => new URL(match[1], entry));
  assert(pending.some(url => /^\/assets\/src\/app\.[a-f0-9]{16}\.js$/.test(url.pathname)), 'Built entry must load its hashed module');
  assert(pending.some(url => /^\/assets\/styles\.[a-f0-9]{16}\.css$/.test(url.pathname)), 'Built entry must load its stylesheet');
  assert(pending.some(url => /^\/assets\/favicon\.[a-f0-9]{16}\.svg$/.test(url.pathname)), 'Built entry must load its icon');
  pending.push(...[...imports.values()].map(reference => new URL(reference)));
  const visited = new Set();
  while (pending.length) {
    const url = pending.shift();
    const asset = url.pathname;
    assert.equal(url.origin, origin, `Built asset must remain local: ${url.href}`);
    assert(isBuiltAsset(asset.slice(1)), `Built asset must use a reviewed content hash: ${asset}`);
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const result = await fetch(url);
    assert.equal(result.status, 200, `Built asset must load: ${asset}`);
    if (asset.endsWith('.js')) {
      assert.match(result.headers.get('content-type'), /javascript/, `Built module must have a JavaScript MIME type: ${asset}`);
      const source = await result.text();
      for (const reference of moduleAssetReferences(source)) pending.push(resolveModuleReference(reference, url, imports));
    } else if (asset.endsWith('.css')) {
      assert.match(result.headers.get('content-type'), /^text\/css(?:;|$)/, `Built stylesheet must have a CSS MIME type: ${asset}`);
      const css=await result.text();
      for(const [,reference]of css.matchAll(/url\(['"]?(\.\/fonts\/[^'")]+)['"]?\)/g))pending.push(new URL(reference,url));
    } else if (/\.(?:woff2|ttf)$/.test(asset)) {
      assert.match(result.headers.get('content-type'),/^font\/(?:woff2|ttf)$/,'Local font MIME type');
    } else if (asset.endsWith('.svg')) {
      assert.match(result.headers.get('content-type'), /^image\/svg\+xml(?:;|$)/, `Built icon must have an SVG MIME type: ${asset}`);
    } else if(asset.endsWith('.json')){
      assert.match(result.headers.get('content-type'),/^application\/json(?:;|$)/,'Lazy history JSON MIME');
    } else if(asset.endsWith('.bin')){
      assert.match(result.headers.get('content-type'),/^application\/octet-stream(?:;|$)/,'Lazy history binary MIME');
    } else if(asset.endsWith('.gz')){
      assert.match(result.headers.get('content-type'),/^application\/(?:gzip|octet-stream)(?:;|$)/,'Lazy gzip history MIME');
    }
  }
  console.log(`Built application smoke check passed (${visited.size} assets), including all source history bundles.`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
