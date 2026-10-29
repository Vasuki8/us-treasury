/** Static native module imports and re-exports, excluding import(). */
export function staticModuleReferences(source) {
  const pattern = /(?:^|[;\r\n])\s*(?:import\s*(?:[^'";]*?\bfrom\s*)?|export\s*[^'";]*?\bfrom\s*)(['"])([^'"]+)\1/g;
  return [...new Set([...source.matchAll(pattern)].map(match => match[2]))];
}

/** Static/literal lazy native modules plus generated source-history bundles. */
export function moduleAssetReferences(source){
  const modules=staticModuleReferences(source);
  const history=[...source.matchAll(/(['"])(\.\/history-[a-f0-9]{64}\.json(?:\.gz)?)\1/g)].map(match=>match[2]);
  const lazy=[...source.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)].map(match=>match[2]);
  return [...new Set([...modules,...lazy,...history])];
}
