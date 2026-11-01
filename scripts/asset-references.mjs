import {createHash} from 'node:crypto';

/** Static native module imports and re-exports, excluding import(). */
export function staticModuleReferences(source) {
  const pattern = /(?:^|[;\r\n])\s*(?:import\s*(?:[^'";]*?\bfrom\s*)?|export\s*[^'";]*?\bfrom\s*)(['"])([^'"]+)\1/g;
  return [...new Set([...source.matchAll(pattern)].map(match => match[2]))];
}

/** Static/literal lazy native modules plus generated source-history bundles. */
export function moduleAssetReferences(source){
  const modules=staticModuleReferences(source);
  const history=[...source.matchAll(/(['"])(\.\/history-[a-f0-9]{64}\.(?:json|bin)(?:\.gz)?)\1/g)].map(match=>match[2]);
  const lazy=[...source.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)].map(match=>match[2]);
  const sources = [...source.matchAll(/(['"])(\.\/source-[a-f0-9]{64}\.js)\1/g)].map(match => match[2]);
  return [...new Set([...modules,...lazy,...history,...sources])];
}
export function importMapSource(html) {
  return html.match(/<script\b[^>]*\btype=["']importmap["'][^>]*>([\s\S]*?)<\/script\s*>/i)?.[1];
}

export function importMapCspHash(html) {
  const source = importMapSource(html);
  return source === undefined ? null : `sha256-${createHash('sha256').update(source).digest('base64')}`;
}

export function parseImportMap(html, base) {
  const source = importMapSource(html);
  if (source === undefined) return new Map();
  const {imports} = JSON.parse(source);
  if (!imports || typeof imports !== 'object' || Array.isArray(imports)) throw new Error('Invalid import map imports');
  return new Map(Object.entries(imports).map(([key, value]) => {
    if (typeof value !== 'string') throw new Error('Invalid import map target');
    const logical = new URL(key, base), target = new URL(value, base);
    if (logical.origin !== base.origin || target.origin !== base.origin || target.protocol !== base.protocol) {
      throw new Error('Import map assets must remain local');
    }
    return [logical.href, target.href];
  }));
}

export function resolveModuleReference(reference, parent, imports = new Map()) {
  const logical = new URL(reference, parent);
  return new URL(imports.get(logical.href) ?? logical.href);
}

export function isBuiltAsset(name) {
  return /^assets\/(?:styles\.[a-f0-9]{16}\.css|favicon\.[a-f0-9]{16}\.svg)$/.test(name)
    || /^assets\/fonts\/[a-zA-Z0-9_-]+\.[a-f0-9]{16}\.(?:woff2|ttf|txt)$/.test(name)
    || /^assets\/src\/(?:[a-zA-Z0-9_-]+\.[a-f0-9]{16}\.js|source-[a-f0-9]{64}\.js)$/.test(name)
    || /^assets\/src\/history-[a-f0-9]{64}\.(?:json|bin)(?:\.gz)?$/.test(name);
}
