import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from '../server.mjs';
import {moduleAssetReferences} from './asset-references.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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
  const pending = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map(match => new URL(match[1], entry));
  assert(pending.some(url => /^\/assets\/[a-f0-9]{16}\/src\/app\.js$/.test(url.pathname)), 'Built entry must load the versioned application module');
  assert(pending.some(url => /^\/assets\/[a-f0-9]{16}\/styles\.css$/.test(url.pathname)), 'Built entry must load its stylesheet');
  assert(pending.some(url => /^\/assets\/[a-f0-9]{16}\/favicon\.svg$/.test(url.pathname)), 'Built entry must load its icon');
  const visited = new Set();
  while (pending.length) {
    const url = pending.shift();
    const asset = url.pathname;
    assert.equal(url.origin, origin, `Built asset must remain local: ${url.href}`);
    assert.match(asset, /^\/assets\/[a-f0-9]{16}\/(?:styles\.css|favicon\.svg|src\/(?:[a-zA-Z0-9_-]+\.js|history-[a-f0-9]{64}\.json(?:\.gz)?))$/, `Built asset must use the reviewed versioned directory: ${asset}`);
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const result = await fetch(url);
    assert.equal(result.status, 200, `Built asset must load: ${asset}`);
    if (asset.endsWith('.js')) {
      assert.match(result.headers.get('content-type'), /javascript/, `Built module must have a JavaScript MIME type: ${asset}`);
      const source = await result.text();
      for (const reference of moduleAssetReferences(source))pending.push(new URL(reference,url));
    } else if (asset.endsWith('.css')) {
      assert.match(result.headers.get('content-type'), /^text\/css(?:;|$)/, `Built stylesheet must have a CSS MIME type: ${asset}`);
    } else if (asset.endsWith('.svg')) {
      assert.match(result.headers.get('content-type'), /^image\/svg\+xml(?:;|$)/, `Built icon must have an SVG MIME type: ${asset}`);
    } else if(asset.endsWith('.json')){
      assert.match(result.headers.get('content-type'),/^application\/json(?:;|$)/,'Lazy history JSON MIME');
    } else if(asset.endsWith('.gz')){
      assert.match(result.headers.get('content-type'),/^application\/(?:gzip|octet-stream)(?:;|$)/,'Lazy gzip history MIME');
    }
  }
  console.log(`Built application smoke check passed (${visited.size} assets), including both lazy archive history bundles.`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
