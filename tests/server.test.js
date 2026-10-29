import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

test('server serves versioned native modules and rejects unreviewed or malformed asset paths', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'meridian-server-assets-'));
  t.after(async () => {
    const target = await realpath(root);
    assert.equal(path.dirname(target), await realpath(tmpdir()));
    assert(path.basename(target).startsWith('meridian-server-assets-'));
    await rm(target, { recursive: true, force: true });
  });
  const prefix = 'assets/';
  await mkdir(path.join(root, prefix, 'src'), { recursive: true });
  const fixtures = [
    ['src/app.0123456789abcdef.js', 'export const loaded = true;'], ['styles.0123456789abcdef.css', 'body {}'],
    ['favicon.0123456789abcdef.svg', '<svg/>'], ['src/private.txt', 'private'], ['package.json', '{}'],
  ];
  for (const [name, contents] of fixtures) {
    await writeFile(path.join(root, prefix, name), contents);
  }
  const server = createAppServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const module = await fetch(`${origin}/${prefix}src/app.0123456789abcdef.js`);
  assert.equal(module.status, 200);
  assert.equal(module.headers.get('content-type'), 'text/javascript; charset=utf-8');
  assert.equal(await module.text(), 'export const loaded = true;');
  assert.equal((await fetch(`${origin}/${prefix}styles.0123456789abcdef.css`)).headers.get('content-type'), 'text/css; charset=utf-8');
  assert.equal((await fetch(`${origin}/${prefix}favicon.0123456789abcdef.svg`)).headers.get('content-type'), 'image/svg+xml');
  const invalidPaths = [
    'assets/src/app.short.js', 'assets/src/app.0123456789ABCDEF.js', 'assets/src/app.js', `${prefix}package.json`,
    `${prefix}src/private.txt`, `${prefix}src/%2e%2e%2fpackage.json`, `${prefix}src/nested/app.js`, `${prefix}src/app.js/extra`,
  ];
  for (const invalid of invalidPaths) {
    assert.equal((await fetch(`${origin}/${invalid}`)).status, 404, invalid);
  }
});
