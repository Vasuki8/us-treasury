import { mkdir, copyFile, cp, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from '../src/official-snapshot.js';
import { assertCommercialData } from './data-policy.mjs';

assertCommercialData(snapshot);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
// Only this project's fixed build directory is ever replaced.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid build destination');
await rm(output, {recursive:true, force:true});
await mkdir(output, {recursive:true});
for (const file of ['index.html','styles.css','favicon.svg']) await copyFile(path.join(root,file),path.join(output,file));
await cp(path.join(root,'src'),path.join(output,'src'),{recursive:true});
console.log(`Static build ready: ${output}`);
