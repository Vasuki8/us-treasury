import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeStoredSnapshot,encodeStoredSnapshot} from '../scripts/snapshot-storage.mjs';

const run = promisify(execFile);
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'meridian-build-cache-'));
  t.after(async () => {
    const target = await realpath(root);
    assert.equal(path.dirname(target), await realpath(tmpdir()));
    assert(path.basename(target).startsWith('meridian-build-cache-'));
    await rm(target, { recursive: true, force: true });
  });
  for (const name of ['src', 'scripts', 'index.html', 'styles.css', 'favicon.svg', 'package.json', 'server.mjs']) {
    await cp(path.join(project, name), path.join(root, name), { recursive: true });
  }
  return root;
}

async function build(root) {
  await run(process.execPath, ['scripts/build.mjs'], { cwd: root });
  const html = await readFile(path.join(root, 'dist', 'index.html'), 'utf8');
  const entry = html.match(/<script type="module" src="([^"]+)"/)[1];
  assert.match(entry, /^\.\/assets\/src\/app\.[a-f0-9]{16}\.js$/, 'The entry needs its own content hash');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  return { html, entry, imports: map.imports };
}

test('each asset keeps its URL unless its own bytes change, including snapshot-only and stylesheet refreshes', async t => {
  const root = await fixture(t);
  const first = await build(root);
  assert.deepEqual(await build(root), first);
  const snapshotPath = path.join(root, 'src', 'official-snapshot.json.gz');
  const updated = decodeStoredSnapshot(await readFile(snapshotPath));
  updated.generatedAt = '2026-10-22T02:00:00.000Z';
  await writeFile(snapshotPath, encodeStoredSnapshot(updated));
  const refreshed = await build(root);
  assert.equal(refreshed.entry, first.entry);
  assert.notEqual(refreshed.html, first.html);
  const snapshotKey = './assets/src/official-snapshot.js';
  assert.notEqual(refreshed.imports[snapshotKey], first.imports[snapshotKey]);
  for (const [key, url] of Object.entries(first.imports)) {
    if (key !== snapshotKey) assert.equal(refreshed.imports[key], url, `Unchanged module URL: ${key}`);
  }
  const projected = await readFile(path.join(root, 'dist', refreshed.imports[snapshotKey]), 'utf8');
  assert.match(projected, /2026-10-22T02:00:00\.000Z/);
  await writeFile(path.join(root, 'styles.css'), `${await readFile(path.join(root, 'styles.css'), 'utf8')}\n/* updated appearance */\n`);
  const styled = await build(root);
  assert.equal(styled.entry, refreshed.entry);
  assert.deepEqual(styled.imports, refreshed.imports);
  assert.notEqual(styled.html.match(/href="([^\"]+\.css)"/)[1], refreshed.html.match(/href="([^\"]+\.css)"/)[1]);
});

test('build packages only the entry and allowlisted versioned application files, which pass the HTTP smoke check', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'src', 'private-notes.txt'), 'not a public asset');
  await mkdir(path.join(root, 'src', 'internal'), { recursive: true });
  await writeFile(path.join(root, 'src', 'internal', 'private.js'), 'not a public asset');
  const built = await build(root);
  assert.match(built.html, /href="\.\/assets\/styles\.[a-f0-9]{16}\.css"/);
  assert.match(built.html, /href="\.\/assets\/favicon\.[a-f0-9]{16}\.svg"/);
  const files = (await readdir(path.join(root, 'dist'), { recursive: true, withFileTypes: true })).filter(item => item.isFile());
  for (const item of files) {
    const relative = path.relative(path.join(root, 'dist'), path.join(item.parentPath, item.name)).replaceAll(path.sep, '/');
    if (relative === 'index.html') continue;
    const hashed = relative.match(/^assets\/(?:src\/)?[a-zA-Z0-9_-]+\.([a-f0-9]{16})\.(?:js|css|svg)$/);
    const generated = relative.match(/^assets\/src\/(?:history|source)-([a-f0-9]{64})\.(?:js|json(?:\.gz)?)$/);
    assert(hashed || generated, `Unexpected public file: ${relative}`);
    const bytes = await readFile(path.join(root, 'dist', relative));
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(hashed ? digest.slice(0, 16) : digest, (hashed || generated)[1], relative);
  }
  const checked = await run(process.execPath, ['scripts/check-build.mjs'], { cwd: root });
  const checkedCount=checked.stdout.match(/smoke check passed \((\d+) assets\)/);
  assert.ok(checkedCount&&Number(checkedCount[1])>=14,'the full imported module graph and baseline assets are checked');
});

test('the built import map has an exact CSP hash and the server applies it without weakening the dev policy', async t => {
  const root = await fixture(t);
  const built = await build(root);
  const map = built.html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
  const digest = createHash('sha256').update(map).digest('base64');
  assert(built.html.includes(`script-src 'self' 'sha256-${digest}'`));
  assert(built.html.indexOf('type="importmap"') < built.html.indexOf('type="module"'));
  const {createAppServer} = await import(pathToFileURL(path.join(root, 'server.mjs')).href);
  const server = createAppServer(path.join(root, 'dist'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert(response.headers.get('content-security-policy').includes(`'sha256-${digest}'`));
});
