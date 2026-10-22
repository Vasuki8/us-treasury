import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyLiveBuild } from '../scripts/check-live.mjs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const html = '<!doctype html><title>Meridian</title><link rel="stylesheet" href="./styles.css"><link rel="icon" href="./favicon.svg"><script type="module" src="./src/app.js"></script>';

async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'meridian-live-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const files = {
    'index.html': html,
    'styles.css': 'body { color: white; }',
    'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'src/app.js': "import { value } from './data.js';\nimport './init.js';\nconsole.log(value);",
    'src/data.js': "export { value } from './nested/value.js';",
    'src/init.js': 'export const initialized = true;',
    'src/nested/value.js': 'export const value = 42;',
    ...overrides,
  };
  for (const [name, source] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(directory, name)), { recursive: true });
    await writeFile(path.join(directory, name), source);
  }
  const remote = new Map(Object.entries(files).map(([name, body]) => [name, { body }]));
  const fetchImpl = async input => {
    const url = new URL(input);
    if (url.origin !== 'https://meridian.example' || !url.pathname.startsWith('/preview/')) throw new Error('Unexpected request');
    const name = url.pathname.slice('/preview/'.length) || 'index.html';
    const entry = remote.get(name);
    const type = name.endsWith('.js') ? 'text/javascript; charset=utf-8' : name.endsWith('.html') ? 'text/html' : 'text/plain';
    return new Response(entry?.body ?? 'Missing', { status: entry?.status ?? (entry ? 200 : 404), headers: { 'content-type': entry?.type ?? type } });
  };
  return { directory, remote, fetchImpl };
}

test('live verifier confirms the tested artifact including nested and side-effect modules', async t => {
  const setup = await fixture(t);
  const result = await verifyLiveBuild('https://meridian.example/preview/', setup);
  assert.equal(result.assets, 6);
  assert.equal(result.url, 'https://meridian.example/preview/');
});

test('live verifier accepts a deployment origin without an explicit trailing slash', async t => {
  const setup = await fixture(t);
  const result = await verifyLiveBuild('https://meridian.example', {
    directory: setup.directory,
    fetchImpl: input => setup.fetchImpl(`https://meridian.example/preview${new URL(input).pathname}`),
  });
  assert.equal(result.url, 'https://meridian.example/');
  assert.equal(result.assets, 6);
});

test('live verifier catches a missing recursively imported module', async t => {
  const setup = await fixture(t);
  setup.remote.delete('src/nested/value.js');
  await assert.rejects(verifyLiveBuild('https://meridian.example/preview/', setup), /404.*src\/nested\/value\.js/);
});

test('live verifier catches HTML fallback responses for JavaScript modules', async t => {
  const setup = await fixture(t);
  setup.remote.set('src/data.js', { body: '<html>Not found</html>', type: 'text/html' });
  await assert.rejects(verifyLiveBuild('https://meridian.example/preview/', setup), /JavaScript MIME.*src\/data\.js/);
});

test('live verifier rejects stale deployed bytes even when the app entry still loads', async t => {
  const setup = await fixture(t);
  setup.remote.set('src/nested/value.js', { body: 'export const value = 41;' });
  await assert.rejects(verifyLiveBuild('https://meridian.example/preview/', setup), /differs.*src\/nested\/value\.js/);
});

test('live verifier compares entry HTML and stylesheet bytes', async t => {
  for (const name of ['index.html', 'styles.css']) {
    const setup = await fixture(t);
    setup.remote.set(name, { body: 'Stale deployment' });
    await assert.rejects(verifyLiveBuild('https://meridian.example/preview/', setup), /differs/);
  }
});

test('live verifier rejects module imports that escape the deployment directory or origin', async t => {
  for (const specifier of ['../../outside.js', 'https://other.example/data.js', '/src/data.js']) {
    const setup = await fixture(t, { 'src/app.js': `import '${specifier}';` });
    await assert.rejects(verifyLiveBuild('https://meridian.example/preview/', setup), /outside deployment root/);
  }
});

test('live verifier rejects entry assets outside the deployment directory', async t => {
  const setup = await fixture(t, { 'index.html': html.replace('./styles.css', '../styles.css') });
  await assert.rejects(verifyLiveBuild('https://meridian.example/preview/', setup), /outside deployment root/);
});

test('live verifier requires an HTTPS deployment root without credentials, query or fragment', async t => {
  const setup = await fixture(t);
  for (const url of ['http://meridian.example/preview/', 'https://meridian.example/preview/?v=1', 'https://meridian.example/preview/#/overview', 'https://user:password@meridian.example/preview/', 'https://meridian.example/preview']) {
    await assert.rejects(verifyLiveBuild(url, setup), /HTTPS deployment root/);
  }
});

test('live verifier fails when the entry omits required application assets', async t => {
  const setup = await fixture(t, { 'index.html': '<title>Meridian</title>' });
  await assert.rejects(verifyLiveBuild('https://meridian.example/preview/', setup), /stylesheet.*icon.*module/);
});
async function lazyFixture(t){
 const json=Buffer.from(JSON.stringify({version:1,captures:[]})),gz=gzipSync(json),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 const plain=`history-${sha(json)}.json`,compressed=`history-${sha(gz)}.json.gz`;
 const setup=await fixture(t,{'src/data.js':`export {value} from './nested/value.js';export const historyArchive={fallback:{url:'./${plain}'},compressed:{url:'./${compressed}'}};`,['src/'+plain]:json,['src/'+compressed]:gz});
 setup.remote.get('src/'+plain).type='application/json';setup.remote.get('src/'+compressed).type='application/gzip';return {...setup,plain,compressed};
}
test('live verification includes both lazy history bundles under the deployment prefix',async t=>{
 const setup=await lazyFixture(t);assert.equal((await verifyLiveBuild('https://meridian.example/preview/',setup)).assets,8);
});
test('missing, corrupt or incorrectly served lazy history stops release verification',async t=>{
 for(const variant of ['plain','compressed'])for(const failure of ['missing','corrupt','mime']){const setup=await lazyFixture(t),name='src/'+setup[variant];if(failure==='missing')setup.remote.delete(name);else setup.remote.set(name,{body:failure==='corrupt'?'wrong':setup.remote.get(name).body,type:failure==='mime'?'text/html':setup.remote.get(name).type});await assert.rejects(verifyLiveBuild('https://meridian.example/preview/',setup),/404|differs|MIME/);}
});
