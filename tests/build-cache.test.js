import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {decodeStoredSnapshot,encodeStoredSnapshot} from '../scripts/snapshot-storage.mjs';
import {importMapSource} from '../scripts/asset-references.mjs';
import {copyFixtureProject} from './helpers/snapshot-fixture.js';

const run = promisify(execFile);
const fontLicenses={
  'inter-variable.ttf':'inter-OFL.txt',
  'jetbrains-mono-regular.woff2':'jetbrains-mono-OFL.txt',
  'jetbrains-mono-medium.woff2':'jetbrains-mono-OFL.txt',
  'material-symbols-outlined.woff2':'material-symbols-LICENSE.txt',
};
const publicFontFiles=new Set([...Object.keys(fontLicenses),...Object.values(fontLicenses)]);

function elements(html,name){
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`,'gi'))].map(match=>({
    index:match.index,
    attributes:Object.fromEntries([...match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(([,key,doubleQuoted,singleQuoted])=>[key.toLowerCase(),doubleQuoted??singleQuoted])),
  }));
}
const stylesheet=html=>elements(html,'link').find(link=>link.attributes.rel==='stylesheet')?.attributes.href;

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'meridian-build-cache-'));
  t.after(async () => {
    const target = await realpath(root);
    assert.equal(path.dirname(target), await realpath(tmpdir()));
    assert(path.basename(target).startsWith('meridian-build-cache-'));
    await rm(target, { recursive: true, force: true });
  });
  await copyFixtureProject(root);
  return root;
}

async function build(root) {
  await run(process.execPath, ['scripts/build.mjs'], { cwd: root });
  const html = await readFile(path.join(root, 'dist', 'index.html'), 'utf8');
  const entry = elements(html,'script').find(script=>script.attributes.type==='module')?.attributes.src;
  assert.match(entry, /^\.\/assets\/src\/app\.[a-f0-9]{16}\.js$/, 'The entry needs its own content hash');
  const map = JSON.parse(importMapSource(html));
  return { html, entry, imports: map.imports };
}

test('each asset keeps its URL unless its bytes or a stylesheet font dependency change', async t => {
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
  assert.notEqual(stylesheet(styled.html),stylesheet(refreshed.html));
  const fontsBefore=(await readdir(path.join(root,'dist','assets','fonts'))).sort();
  const fontPath=path.join(root,'fonts','inter-variable.ttf');
  await writeFile(fontPath,Buffer.concat([await readFile(fontPath),Buffer.from([0])]));
  const retyped=await build(root),fontsAfter=(await readdir(path.join(root,'dist','assets','fonts'))).sort();
  assert.equal(retyped.entry,styled.entry);assert.deepEqual(retyped.imports,styled.imports);
  assert.equal(elements(retyped.html,'link').find(link=>link.attributes.rel==='icon')?.attributes.href,elements(styled.html,'link').find(link=>link.attributes.rel==='icon')?.attributes.href);
  assert.notEqual(stylesheet(retyped.html),stylesheet(styled.html),'A changed font URL invalidates its dependent stylesheet');
  const removed=fontsBefore.filter(name=>!fontsAfter.includes(name)),added=fontsAfter.filter(name=>!fontsBefore.includes(name));
  assert.equal(removed.length,1);assert.equal(added.length,1);
  assert.match(removed[0],/^inter-variable\.[a-f0-9]{16}\.ttf$/);assert.match(added[0],/^inter-variable\.[a-f0-9]{16}\.ttf$/);
  const css=await readFile(path.join(root,'dist',stylesheet(retyped.html)),'utf8');
  assert.ok(css.includes(`./fonts/${added[0]}`));assert.ok(!css.includes(removed[0]));
  assert.doesNotMatch(css,/url\(['"]?https?:/,'Local typography must not add runtime font CDN requests');
});

test('build packages only the entry and allowlisted versioned application files, which pass the HTTP smoke check', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'src', 'private-notes.txt'), 'not a public asset');
  await mkdir(path.join(root, 'src', 'internal'), { recursive: true });
  await writeFile(path.join(root, 'src', 'internal', 'private.js'), 'not a public asset');
  const built = await build(root);
  assert.match(stylesheet(built.html), /^\.\/assets\/styles\.[a-f0-9]{16}\.css$/);
  const icon=elements(built.html,'link').find(link=>link.attributes.rel==='icon')?.attributes.href;
  assert.match(icon, /^\.\/assets\/favicon\.[a-f0-9]{16}\.svg$/);
  const files = (await readdir(path.join(root, 'dist'), { recursive: true, withFileTypes: true })).filter(item => item.isFile());
  const fontFiles=new Set();
  for (const item of files) {
    const relative = path.relative(path.join(root, 'dist'), path.join(item.parentPath, item.name)).replaceAll(path.sep, '/');
    if (relative === 'index.html') continue;
    const hashed = relative.match(/^assets\/(?:src\/)?[a-zA-Z0-9_-]+\.([a-f0-9]{16})\.(?:js|css|svg)$/);
    const generated = relative.match(/^assets\/src\/(?:history|source)-([a-f0-9]{64})\.(?:js|json(?:\.gz)?)$/);
    const font=relative.match(/^assets\/fonts\/([a-zA-Z0-9_-]+)\.([a-f0-9]{16})\.(woff2|ttf|txt)$/);
    assert(hashed || generated || font, `Unexpected public file: ${relative}`);
    const bytes = await readFile(path.join(root, 'dist', relative));
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(hashed||font?digest.slice(0,16):digest,font?font[2]:(hashed||generated)[1],relative);
    if(font){
      const original=`${font[1]}.${font[3]}`;
      assert(publicFontFiles.has(original),`Unreviewed public font or license: ${original}`);
      assert.deepEqual(bytes,await readFile(path.join(root,'fonts',original)),`Font and license bytes remain intact: ${original}`);
      fontFiles.add(original);
    }
  }
  assert.deepEqual([...fontFiles].sort(),[...publicFontFiles].sort(),'Only the four official fonts and their three licenses are public');
  for(const [font,license]of Object.entries(fontLicenses)){
    assert(fontFiles.has(font)&&fontFiles.has(license),`${font} requires its bundled license`);
    assert.match(await readFile(path.join(root,'fonts',license),'utf8'),license.endsWith('-OFL.txt')?/SIL Open Font License, Version 1\.1/:/Apache License\s+Version 2\.0/);
  }
  const checked = await run(process.execPath, ['scripts/check-build.mjs'], { cwd: root });
  const checkedCount=checked.stdout.match(/smoke check passed \((\d+) assets\)/);
  assert.ok(checkedCount&&Number(checkedCount[1])>=14,'the full imported module graph and baseline assets are checked');
});

test('the built import map has an exact CSP hash and the server applies it without weakening the dev policy', async t => {
  const root = await fixture(t);
  const built = await build(root);
  const map = importMapSource(built.html);
  const digest = createHash('sha256').update(map).digest('base64');
  const policy=elements(built.html,'meta').find(meta=>meta.attributes['http-equiv']?.toLowerCase()==='content-security-policy')?.attributes.content;
  assert(policy?.includes(`script-src 'self' 'sha256-${digest}'`));
  const scripts=elements(built.html,'script');
  assert(scripts.find(script=>script.attributes.type==='importmap').index < scripts.find(script=>script.attributes.type==='module').index);
  const {createAppServer} = await import(pathToFileURL(path.join(root, 'server.mjs')).href);
  const server = createAppServer(path.join(root, 'dist'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert(response.headers.get('content-security-policy').includes(`'sha256-${digest}'`));
});
