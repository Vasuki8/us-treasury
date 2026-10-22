/** Static/literal lazy native modules plus generated source-history bundles. */
export function moduleAssetReferences(source){
  const modules=[...source.matchAll(/\b(?:import\s+(?:[^'";]*?\s+from\s+)?|export\s+[^'";]*?\s+from\s+)(['"])([^'"]+)\1/g)].map(match=>match[2]);
  const history=[...source.matchAll(/(['"])(\.\/history-[a-f0-9]{64}\.json(?:\.gz)?)\1/g)].map(match=>match[2]);
  const lazy=[...source.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g)].map(match=>match[2]);
  return [...new Set([...modules,...lazy,...history])];
}
