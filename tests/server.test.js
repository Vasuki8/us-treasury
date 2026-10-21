import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppServer } from '../server.mjs';

test('server serves app assets and keeps project internals private', async t => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const root = await fetch(origin);
  assert.equal(root.status, 200);
  assert.match(await root.text(), /src\/app.js/);
  const css = await fetch(`${origin}/styles.css`);
  assert.equal(css.headers.get('content-type'), 'text/css; charset=utf-8');
  assert.equal((await fetch(`${origin}/package.json`)).status, 404);
  assert.equal((await fetch(`${origin}/economy-pulse-preview.html`)).status, 404);
  assert.equal((await fetch(`${origin}/src/%2e%2e%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${origin}/src/not-found.js`)).status, 404);
  assert.equal((await fetch(`${origin}/%E0%A4%A`)).status, 400);
  assert.equal((await fetch(origin, {method:'POST'})).status, 405);
});
