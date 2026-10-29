import {readFile, readdir, realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {staticModuleReferences} from './asset-references.mjs';

export async function measureBuild(directory) {
  const root = await realpath(directory);
  const relativePath = filename => {
    const relative = path.relative(root, filename);
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`Build assets must remain within dist: ${filename}`);
    }
    return relative.split(path.sep).join('/');
  };
  const localFile = async url => {
    if (url.protocol !== 'file:') throw new Error(`Build module dependency must remain local: ${url.href}`);
    const filename = fileURLToPath(url);
    relativePath(filename);
    const resolved = await realpath(filename);
    relativePath(resolved);
    return resolved;
  };
  const files = [];
  for (const item of await readdir(root, {recursive: true, withFileTypes: true})) {
    if (item.isSymbolicLink()) throw new Error(`Build assets must not contain symbolic links: ${item.name}`);
    if (!item.isFile()) continue;
    const filename = path.join(item.parentPath, item.name);
    files.push({path: relativePath(filename), bytes: (await stat(filename)).size});
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const entry = html.match(/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']+)["']/)?.[1];
  if (!entry) throw new Error('Built entry must specify its application module');
  const entryFile = await localFile(new URL(entry, pathToFileURL(path.join(root, 'index.html'))));
  const pending = [entryFile], visited = new Set();
  let rawBytes = 0, gzipBytes = 0;
  while (pending.length) {
    const filename = pending.pop();
    if (visited.has(filename)) continue;
    visited.add(filename);
    const bytes = await readFile(filename);
    rawBytes += bytes.length;
    gzipBytes += gzipSync(bytes).length;
    for (const reference of staticModuleReferences(bytes.toString('utf8'))) {
      if (!reference.startsWith('.') && !reference.startsWith('/')) {
        throw new Error(`Build module dependency must remain local: ${reference}`);
      }
      pending.push(await localFile(new URL(reference, pathToFileURL(filename))));
    }
  }
  return {files, firstLoad: {entry: relativePath(entryFile), moduleCount: visited.size, rawBytes, gzipBytes}};
}

export function reportBuildMetrics({files, firstLoad}, {strictAssetSize = process.env.STRICT_ASSET_SIZE} = {}) {
  for (const file of files) console.log(`Dist asset ${file.path}: ${file.bytes} bytes`);
  const {moduleCount, rawBytes, gzipBytes} = firstLoad;
  console.log(`Overview first load (static imports/re-exports): ${moduleCount} modules; ${rawBytes} raw bytes; ${gzipBytes} gzip bytes.`);
  console.log('Gzip method: sum of individually compressed module sizes using gzipSync default compression.');
  for (const file of files.filter(file => file.bytes > 20 * 1024 ** 2)) {
    console.warn(`Warning: ${file.path} exceeds 20 MiB (${file.bytes} bytes).`);
  }
  const oversized = files.find(file => file.bytes > 24 * 1024 ** 2);
  if (strictAssetSize === '1' && oversized) throw new Error(`${oversized.path} exceeds the strict 24 MiB asset limit.`);
}
