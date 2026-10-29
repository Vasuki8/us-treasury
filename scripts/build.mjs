import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { snapshot } from '../src/official-snapshot.js';
import {treasuryAuctionCalendarSnapshot} from '../src/treasury-auction-calendar-snapshot.js';
import {assertTreasuryAuctionCalendar} from './treasury-calendar-policy.mjs';
import { assertCommercialData } from './data-policy.mjs';
import {economicEvidenceSources} from '../src/economic-evidence-snapshot.js';
import {assertEconomicEvidenceSources} from './economic-evidence-policy.mjs';
import {loadSnapshotHistory,browserSnapshotAssets} from './snapshot-storage.mjs';
import {publicationArchive} from '../src/publication-archive.js';
import {assertPublicationData} from './publication-policy.mjs';
import {publicationExplanations} from '../src/publication-explanations.js';
import {assertPublicationExplanations} from './publication-explanation-policy.mjs';
import {claimsPublicationArchive} from '../src/claims-publication-archive.js';
import {assertClaimsPublicationData} from './dol-publication-policy.mjs';
import {cpiPublicationArchive} from '../src/cpi-publication-archive.js';
import {assertCpiPublicationData} from './cpi-publication-policy.mjs';
import {importMapCspHash} from './asset-references.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fullSnapshot={...snapshot,vintages:await loadSnapshotHistory(snapshot,{directory:path.join(root,'src')})};
assertCommercialData(fullSnapshot);
assertTreasuryAuctionCalendar(treasuryAuctionCalendarSnapshot);
assertEconomicEvidenceSources(economicEvidenceSources);
assertPublicationData(publicationArchive,{complete:true});
assertPublicationExplanations(publicationExplanations,{complete:true});
assertClaimsPublicationData(claimsPublicationArchive,{complete:true});
assertCpiPublicationData(cpiPublicationArchive,{complete:true});
const projected=browserSnapshotAssets(fullSnapshot);
const output = path.join(root, 'dist');
const modules = (await readdir(path.join(root, 'src'), { withFileTypes: true }))
  .filter(entry => entry.isFile() && /^[a-zA-Z0-9_-]+\.js$/.test(entry.name))
  .map(entry => `src/${entry.name}`);
const names = ['styles.css', 'favicon.svg', ...modules].sort();
const inputs = await Promise.all(names.map(async name => ({
  name, bytes: name === 'src/official-snapshot.js' ? Buffer.from(projected.module) : await readFile(path.join(root, name)),
})));
for (const [name, bytes] of projected.files) inputs.push({name: 'src/' + name, bytes});
inputs.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const assets = new Map(), imports = {};
for (const {name, bytes} of inputs) {
  if (bytes.length >= 20 * 1024 ** 2) throw new Error(`${name} must be below the 20 MiB build asset limit (${bytes.length} bytes).`);
  const generated = /^src\/(?:history-[a-f0-9]{64}\.json(?:\.gz)?|source-[a-f0-9]{64}\.js)$/.test(name);
  const extension = path.extname(name), digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
  const target = `assets/${generated ? name : name.slice(0, -extension.length) + '.' + digest + extension}`;
  assets.set(name, target);
  if (name.endsWith('.js') && !generated) imports[`./assets/${name}`] = `./${target}`;
}
// The map binds stable native module imports to each asset's own content hash.
const map = `<script type="importmap">${JSON.stringify({imports})}</script>`;
let html = (await readFile(path.join(root, 'index.html'), 'utf8'))
  .replace(/((?:src|href)=["'])\.\/(styles\.css|favicon\.svg|src\/app\.js)(["'])/g,
    (_, prefix, name, quote) => `${prefix}./${assets.get(name)}${quote}`)
  .replace('<script type="module"', `${map}\n  <script type="module"`);
html = html.replace("script-src 'self'", `script-src 'self' '${importMapCspHash(html)}'`);
// Only this project's fixed build directory is ever replaced.
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid build destination');
await rm(output, {recursive:true, force:true});
await mkdir(path.join(output, 'assets', 'src'), { recursive: true });
for (const { name, bytes } of inputs) {
  await writeFile(path.join(output, assets.get(name)), bytes);
}
await writeFile(path.join(output, 'index.html'), html);
console.log(`Static build ready: ${output}`);
