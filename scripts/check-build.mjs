import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from '../server.mjs';

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
    assert.match(asset, /^\/assets\/[a-f0-9]{16}\/(?:styles\.css|favicon\.svg|src\/[a-zA-Z0-9_-]+\.js)$/, `Built asset must use the reviewed versioned directory: ${asset}`);
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const result = await fetch(url);
    assert.equal(result.status, 200, `Built asset must load: ${asset}`);
    if (asset.endsWith('.js')) {
      assert.match(result.headers.get('content-type'), /javascript/, `Built module must have a JavaScript MIME type: ${asset}`);
      const source = await result.text();
      for (const match of source.matchAll(/\b(?:import\s+(?:[^'";]*?\s+from\s+)?|export\s+[^'";]*?\s+from\s+)(['"])([^'"]+)\1/g)) {
        pending.push(new URL(match[2], url));
      }
    } else if (asset.endsWith('.css')) {
      assert.match(result.headers.get('content-type'), /^text\/css(?:;|$)/, `Built stylesheet must have a CSS MIME type: ${asset}`);
    } else if (asset.endsWith('.svg')) {
      assert.match(result.headers.get('content-type'), /^image\/svg\+xml(?:;|$)/, `Built icon must have an SVG MIME type: ${asset}`);
    }
  }
  console.log(`Built application smoke check passed (${visited.size} assets).`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
