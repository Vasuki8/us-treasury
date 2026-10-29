import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, realpath, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {measureBuild, reportBuildMetrics} from '../scripts/build-metrics.mjs';
const MiB = 1024 ** 2;

async function fixture(t, modules) {
  const root = await mkdtemp(path.join(tmpdir(), 'meridian-build-metrics-'));
  t.after(async () => {
    const target = await realpath(root);
    assert.equal(path.dirname(target), await realpath(tmpdir()));
    assert(path.basename(target).startsWith('meridian-build-metrics-'));
    await rm(target, {recursive: true, force: true});
  });
  for (const [name, source] of Object.entries(modules)) {
    const filename = path.join(root, name);
    await mkdir(path.dirname(filename), {recursive: true});
    await writeFile(filename, source);
  }
  return root;
}

function captureReport(t, files, strictAssetSize) {
  const log = t.mock.method(console, 'log', () => {});
  const warn = t.mock.method(console, 'warn', () => {});
  const firstLoad = {entry: 'src/app.js', moduleCount: 1, rawBytes: 18, gzipBytes: 38};
  return {log, warn, run: () => reportBuildMetrics({files, firstLoad}, {strictAssetSize})};
}

test('build metrics count static dependencies once and exclude lazy modules', async t => {
  const prefix = 'assets/0123456789abcdef/src/';
  const app = "import './a.js';\nexport {n} from './shared.js';\nconst later=()=>import('./lazy.js');\n";
  const a = "import './shared.js';\nexport * from './app.js';\n";
  const shared = 'export const n=3;\n';
  const directory = await fixture(t, {
    'index.html': `<script type="module" src="./${prefix}app.js"></script>`,
    [`${prefix}app.js`]: app,
    [`${prefix}a.js`]: a,
    [`${prefix}shared.js`]: shared,
    [`${prefix}lazy.js`]: "export default 'late';\n",
    'unreferenced.txt': 'é',
  });
  const result = await measureBuild(directory);
  assert.deepEqual(result.firstLoad, {
    entry: `${prefix}app.js`, moduleCount: 3, rawBytes: 151, gzipBytes: 186,
  });
  assert.deepEqual(result.files, [
    {path: `${prefix}a.js`, bytes: 48},
    {path: `${prefix}app.js`, bytes: 85},
    {path: `${prefix}lazy.js`, bytes: 23},
    {path: `${prefix}shared.js`, bytes: 18},
    {path: 'index.html', bytes: 74},
    {path: 'unreferenced.txt', bytes: 2},
  ]);
});

test('build metrics reject a missing static dependency instead of undercounting the first load', async t => {
  const directory = await fixture(t, {
    'index.html': '<script type="module" src="./src/app.js"></script>',
    'src/app.js': "import './missing.js';\n",
  });
  await assert.rejects(measureBuild(directory), /missing\.js/);
});

test('build metrics reject static imports that escape dist or use a remote URL', async t => {
  for (const reference of ['../../outside.js', 'https://example.test/app.js']) {
    const directory = await fixture(t, {
      'index.html': '<script type="module" src="./src/app.js"></script>',
      'src/app.js': `import '${reference}';\n`,
    });
    await assert.rejects(measureBuild(directory), /local|within|outside|escape/i);
  }
  for (const entry of ['../outside.js', 'https://example.test/app.js']) {
    const directory = await fixture(t, {'index.html': `<script type="module" src="${entry}"></script>`});
    await assert.rejects(measureBuild(directory), /local|within|outside|escape/i);
  }
});

test('asset reporting prints exact byte sizes and warns only above 20 MiB with strict mode disabled', t => {
  const files = [
    {path: 'at-warning.js', bytes: 20 * MiB},
    {path: 'above-warning.js', bytes: 20 * MiB + 1},
    {path: 'at-limit.js', bytes: 24 * MiB},
    {path: 'above-limit.js', bytes: 24 * MiB + 1},
  ];
  const report = captureReport(t, files, '0');
  assert.doesNotThrow(report.run);
  for (const file of files) {
    assert.ok(report.log.mock.calls.some(call => call.arguments[0].includes(file.path) && call.arguments[0].includes(String(file.bytes))));
  }
  assert.equal(report.warn.mock.calls.length, 3);
  assert.ok(report.warn.mock.calls.every(call => !call.arguments[0].includes('at-warning.js')));
  assert.ok(report.log.mock.calls.some(call => /Overview/.test(call.arguments[0]) && /gzip/i.test(call.arguments[0])));
});

test('asset reporting enforces 24 MiB only when strict mode is exactly 1', t => {
  for (const strictAssetSize of ['', '0', 'true', '01']) {
    const report = captureReport(t, [{path: 'large.js', bytes: 24 * MiB + 1}], strictAssetSize);
    assert.doesNotThrow(report.run, strictAssetSize);
    t.mock.restoreAll();
  }
  const atLimit = captureReport(t, [{path: 'at-limit.js', bytes: 24 * MiB}], '1');
  assert.doesNotThrow(atLimit.run);
  t.mock.restoreAll();
  const aboveLimit = captureReport(t, [{path: 'above-limit.js', bytes: 24 * MiB + 1}], '1');
  assert.throws(aboveLimit.run, /above-limit\.js.*24 MiB/);
});
