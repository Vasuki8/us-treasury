import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from '../src/official-snapshot.js';
import { assertCommercialData } from './data-policy.mjs';
import {loadSnapshotHistory,browserSnapshotAssets} from './snapshot-storage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fullSnapshot={...snapshot,vintages:await loadSnapshotHistory(snapshot,{directory:path.join(root,'src')})};
assertCommercialData(fullSnapshot);
const projected=browserSnapshotAssets(fullSnapshot);
const output = path.join(root, 'dist');
const modules = (await readdir(path.join(root, 'src'), { withFileTypes: true }))
  .filter(entry => entry.isFile() && /^[a-zA-Z0-9_-]+\.js$/.test(entry.name))
  .map(entry => `src/${entry.name}`);
const names = ['index.html', 'styles.css', 'favicon.svg', ...modules].sort();
const inputs = await Promise.all(names.map(async name => ({ name, bytes: name==='src/official-snapshot.js'?Buffer.from(projected.module):await readFile(path.join(root, name)) })));
for(const [name,bytes] of projected.files)inputs.push({name:'src/'+name,bytes});
inputs.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
// A refreshed snapshot versions every import URL, including modules cached by an open tab.
const hash = createHash('sha256');
for (const { name, bytes } of inputs) hash.update(`${name.length}:${name}:${bytes.length}:`).update(bytes);
const directory = `assets/${hash.digest('hex').slice(0, 16)}`;
// Only this project's fixed build directory is ever replaced.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid build destination');
await rm(output, {recursive:true, force:true});
await mkdir(path.join(output, directory, 'src'), { recursive: true });
for (const { name, bytes } of inputs) {
  if (name === 'index.html') {
    const html = bytes.toString('utf8').replace(/((?:src|href)=["'])\.\/(styles\.css|favicon\.svg|src\/app\.js)(["'])/g, `$1./${directory}/$2$3`);
    await writeFile(path.join(output, name), html);
  } else {
    await writeFile(path.join(output, directory, name), bytes);
  }
}
console.log(`Static build ready: ${output}`);
