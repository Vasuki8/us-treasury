import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {pathToFileURL} from 'node:url';

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
  assert.match(entry, /^\.\/assets\/[a-f0-9]{16}\/src\/app\.js$/, 'The whole module graph needs a content-specific directory');
  return { html, entry, directory: entry.slice(2, -'src/app.js'.length) };
}

test('unchanged builds reuse asset URLs while a refreshed snapshot changes the entire module graph URL', async t => {
  const root = await fixture(t);
  const first = await build(root);
  assert.deepEqual(await build(root), first);
  const snapshotPath = path.join(root, 'src', 'official-snapshot.js');
  const original = await readFile(snapshotPath, 'utf8');
  await writeFile(snapshotPath, original.replace(/"generatedAt":\s*"[^"]+"/, '"generatedAt": "2026-10-22T02:00:00.000Z"'));
  const refreshed = await build(root);
  assert.notEqual(refreshed.entry, first.entry);
  const {snapshot:projected}=await import(pathToFileURL(path.join(root,'dist',refreshed.directory,'src','official-snapshot.js')).href);
  assert.equal(projected.generatedAt,'2026-10-22T02:00:00.000Z');
  assert.equal(projected.vintages,undefined,'the browser only loads history on demand');assert.equal(projected.vintageArchive,undefined);
  assert.equal(projected.historyArchive.version,2);assert.ok(Object.values(projected.historyArchive.sources).every(source=>source.compressed.url.endsWith('.json.gz')));
  const modules = (await readdir(path.join(root, 'dist', refreshed.directory, 'src'))).filter(name => name.endsWith('.js'));
  for (const name of modules) {
    const moduleURL = new URL(`src/${name}`, `https://example.test/us-treasury/${refreshed.directory}`);
    assert(moduleURL.pathname.startsWith(`/us-treasury/${refreshed.directory}`));
    assert.notEqual(moduleURL.pathname, `/us-treasury/${first.directory}src/${name}`);
  }
  await writeFile(path.join(root, 'styles.css'), `${await readFile(path.join(root, 'styles.css'), 'utf8')}\n/* updated appearance */\n`);
  assert.notEqual((await build(root)).entry, refreshed.entry, 'A stylesheet change must invalidate the shared directory too');
});

test('build packages only the entry and allowlisted versioned application files, which pass the HTTP smoke check', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'src', 'private-notes.txt'), 'not a public asset');
  await mkdir(path.join(root, 'src', 'internal'), { recursive: true });
  await writeFile(path.join(root, 'src', 'internal', 'private.js'), 'not a public asset');
  const built = await build(root);
  assert(built.html.includes(`href="./${built.directory}styles.css"`));
  assert(built.html.includes(`href="./${built.directory}favicon.svg"`));
  const files = (await readdir(path.join(root, 'dist'), { recursive: true, withFileTypes: true })).filter(item => item.isFile());
  for (const item of files) {
    const relative = path.relative(path.join(root, 'dist'), path.join(item.parentPath, item.name)).replaceAll(path.sep, '/');
    assert(relative === 'index.html' || /^assets\/[a-f0-9]{16}\/(?:styles\.css|favicon\.svg|src\/(?:[a-zA-Z0-9_-]+\.js|history-[a-f0-9]{64}\.json(?:\.gz)?))$/.test(relative), `Unexpected public file: ${relative}`);
  }
  const checked = await run(process.execPath, ['scripts/check-build.mjs'], { cwd: root });
  const checkedCount=checked.stdout.match(/smoke check passed \((\d+) assets\)/);
  assert.ok(checkedCount&&Number(checkedCount[1])>=14,'the full imported module graph and baseline assets are checked');
});
