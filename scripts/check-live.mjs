import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function deploymentRoot(input) {
  let url;
  try { url = new URL(input); } catch { /* Report the same actionable URL requirement. */ }
  if (!url || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) {
    throw new Error('Provide a clean HTTPS deployment root ending in /, without credentials, query or fragment.');
  }
  return url;
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map(match => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]]));
}

function entryAssets(html) {
  const assets = [];
  let stylesheet = false;
  let icon = false;
  let module = false;
  for (const match of html.matchAll(/<(link|script)\b[^>]*>/gi)) {
    const attr = attributes(match[0]);
    const relations = (attr.rel ?? '').toLowerCase().split(/\s+/);
    if (match[1].toLowerCase() === 'link' && (relations.includes('stylesheet') || relations.includes('icon'))) {
      stylesheet ||= relations.includes('stylesheet');
      icon ||= relations.includes('icon');
      if (attr.href) assets.push(attr.href);
    }
    if (match[1].toLowerCase() === 'script' && attr.type === 'module' && attr.src) {
      module = true;
      assets.push(attr.src);
    }
  }
  if (!stylesheet || !icon || !module) throw new Error('Entry must load a stylesheet, icon and application module.');
  return assets;
}

// The application uses static native ES modules, including re-exports and side-effect imports.
function moduleImports(source) {
  return [...source.matchAll(/\b(?:import\s+(?:[^'";]*?\s+from\s+)?|export\s+[^'";]*?\s+from\s+)(['"])([^'"]+)\1/g)]
    .map(match => match[2]);
}

/** Confirm that an HTTPS deployment serves the exact locally tested static build. */
export async function verifyLiveBuild(input, { directory = path.join(projectRoot, 'dist'), fetchImpl = globalThis.fetch } = {}) {
  const base = deploymentRoot(input);
  const localRoot = path.resolve(directory);
  const pending = [base];
  const visited = new Set();

  function resolveAsset(reference, parent) {
    const url = new URL(reference, parent);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname) || url.search || url.hash || url.username || url.password) {
      throw new Error(`Asset is outside deployment root: ${reference}`);
    }
    return url;
  }

  while (pending.length) {
    const url = pending.shift();
    if (visited.has(url.href)) continue;
    visited.add(url.href);
    const name = decodeURIComponent(url.pathname.slice(base.pathname.length)) || 'index.html';
    const localPath = path.resolve(localRoot, name);
    const relative = path.relative(localRoot, localPath);
    if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative) || name.includes('\\')) {
      throw new Error(`Asset is outside deployment root: ${url.href}`);
    }
    const expected = await readFile(localPath);
    const response = await fetchImpl(url.href, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} loading ${name}`);
    if (response.redirected || (response.url && response.url !== url.href)) throw new Error(`Unexpected redirect loading ${name}`);
    if (name.endsWith('.js') && !/^(?:text|application)\/(?:javascript|ecmascript)(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
      throw new Error(`Expected JavaScript MIME type for ${name}`);
    }
    const actual = Buffer.from(await response.arrayBuffer());
    if (!actual.equals(expected)) throw new Error(`Deployed file differs from local build: ${name}`);
    const source = actual.toString('utf8');
    const dependencies = name === 'index.html' ? entryAssets(source) : name.endsWith('.js') ? moduleImports(source) : [];
    for (const dependency of dependencies) pending.push(resolveAsset(dependency, url));
  }
  return { url: base.href, assets: visited.size - 1 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const result = await verifyLiveBuild(process.argv[2]);
    console.log(`Live application matches local build (${result.assets} assets): ${result.url}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
