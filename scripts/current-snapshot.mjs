import { createHash } from 'node:crypto';
import { encodeSnapshot } from '../src/source-codec.js';

const specialized = new Set([
  'monthly', 'fiscal', 'securities', 'totals', 'curveHistory', 'h15GapEvidence', 'auctions', 'z1', 'soma',
  'quarterly', 'cpiCategoryEffects', 'dealerHistory', 'fundingRates',
]);

function recentSeries(item) {
  const rows = item.observations ?? [], endDate = rows.at(-1)?.date ?? null;
  const previousYear = endDate ? `${Number(endDate.slice(0, 4)) - 1}${endDate.slice(4)}` : null;
  // February 29's anniversary in a non-leap year is February 28.
  const startDate = previousYear?.endsWith('-02-29') ? `${previousYear.slice(0, 4)}-02-28` : previousYear;
  const first = startDate ? rows.findIndex(row => row.date >= startDate) : -1;
  return {
    ...item, observations:first > 0 ? rows.slice(first - 1) : rows,
    retainedCoverage:{ startDate:rows[0]?.date ?? null, endDate, count:rows.length },
  };
}

/** Project current readings without changing the stored snapshot or complete source assets. */
export function currentSnapshotAssets(snapshot, serialize) {
  const files = new Map(), sources = {}, descriptors = {};
  for (const [sourceId, source] of Object.entries(snapshot.sources ?? {})) {
    const bytes = Buffer.from(serialize({ source })), sha256 = createHash('sha256').update(bytes).digest('hex');
    const filename = `source-${sha256}.js`;
    files.set(filename, bytes);
    descriptors[sourceId] = {
      url:`./${filename}`, sha256, bytes:bytes.length, seriesIds:Object.keys(source.series ?? {}),
      observationCount:Object.values(source.series ?? {}).reduce((count, item) => count + (item.observations?.length ?? 0), 0),
    };
    sources[sourceId] = {
      ...Object.fromEntries(Object.entries(source).filter(([key]) => !specialized.has(key))),
      series:Object.fromEntries(Object.entries(source.series ?? {}).map(([id, item]) => [id, recentSeries(item)])),
    };
  }
  const current = { ...snapshot, sources, sourceArchive:{ version:1, sources:descriptors } };
  const encoded = serialize(encodeSnapshot(current)).replace('export const snapshot=', 'const compactSnapshot=');
  const module = `import {decodeSnapshot} from './source-codec.js';\n${encoded}export const snapshot=decodeSnapshot(compactSnapshot);\n`;
  return { snapshot:current, module, files };
}
