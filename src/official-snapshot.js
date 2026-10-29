import {readFileSync} from 'node:fs';
import {decodeStoredSnapshot} from '../scripts/snapshot-storage.mjs';

// Node entry only. Build and development HTTP delivery substitute the browser projection.
export const snapshot=decodeStoredSnapshot(readFileSync(new URL('./official-snapshot.json.gz',import.meta.url)));
