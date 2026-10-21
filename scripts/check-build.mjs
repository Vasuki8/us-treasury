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
  const pending = [...html.matchAll(/(?:src|href)="\.\/(src\/[^"#]+|styles\.css|favicon\.svg)"/g)].map(match => match[1]);
  assert(pending.includes('src/app.js'), 'Built entry must load the application module');
  const visited = new Set();
  while (pending.length) {
    const asset = pending.shift();
    if (visited.has(asset)) continue;
    visited.add(asset);
    const result = await fetch(`${origin}/${asset}`);
    assert.equal(result.status, 200, `Built asset must load: ${asset}`);
    if (asset.endsWith('.js')) {
      assert.match(result.headers.get('content-type'), /javascript/, `Built module must have a JavaScript MIME type: ${asset}`);
      const source = await result.text();
      for (const match of source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)) {
        pending.push(path.posix.join(path.posix.dirname(asset), match[1]));
      }
    }
  }
  console.log(`Built application smoke check passed (${visited.size} assets).`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
