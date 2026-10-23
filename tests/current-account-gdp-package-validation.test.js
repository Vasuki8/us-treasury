import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { series } from '../src/data.js';
import { canonicalJson } from '../src/research-workspaces.js';
import { createResearchPackage, exportResearchPackage, importResearchPackage } from '../src/research-packages.js';

const observation = (date, value) => ({ date, value, sourceValue: value === null ? '...' : String(value), publishedAt: null });
const denominator = () => ({
  id: 'bea', status: 'ok', fetchedAt: '2026-10-23T20:00:00.000Z', error: null,
  coverageNote: 'Recorded current-dollar GDP at a seasonally adjusted annual rate.', warnings: [],
  provenance: [{ url: 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt', sha256: '0'.repeat(64), retrievedAt: '2026-10-23T20:00:00.000Z' }],
  series: { nominalGdp: {
    sourceIds: ['A191RC'], sourceUrl: 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt',
    observationType: 'official', dataStatus: 'official',
    calculation: 'NIPA Table 1.1.5 line 1, millions / 1000 = billions at a seasonally adjusted annual rate.',
    observations: [observation('2026-01-01', 31906.274), observation('2026-04-01', 32563.03)],
  } },
});
const base = exportResearchPackage(await createResearchPackage({
  name: 'Recorded current-account denominator', state: { selected: ['gdp'], range: 1 },
  catalog: { gdp: { ...series.gdp, observations: series.gdp.observations.slice(-2) } },
}));
function withDenominator(source) {
  const value = JSON.parse(base);
  value.context.currentAccountGdpDenominator = source;
  delete value.checksum;
  value.checksum = { algorithm: 'SHA-256', value: createHash('sha256').update(canonicalJson(value)).digest('hex') };
  return JSON.stringify(value);
}
async function rejects(change) {
  const value = denominator(), replacement = change(value);
  await assert.rejects(importResearchPackage(withDenominator(replacement === undefined ? value : replacement)), /current.account.*GDP denominator/i);
}

test('checksum-valid GDP denominator imports reject malformed containers and unscoped series', async () => {
  for (const change of [
    () => null, () => [], () => 'GDP source',
    value => { value.series = []; },
    value => { value.series.nominalGdp = null; },
    value => { value.series.realGdp = value.series.nominalGdp; },
    value => { value.series.nominalGdp.observations = {}; },
    value => { value.series.nominalGdp.observations = [null]; },
    value => { value.series.nominalGdp.observations.unshift(observation('2025-10-01', 31000)); },
  ]) await rejects(change);
});

test('GDP denominator imports require ordered unique quarter dates and finite or null values', async () => {
  for (const change of [
    value => { value.series.nominalGdp.observations[0].date = 123; },
    value => { value.series.nominalGdp.observations[0].date = '2026-02-01'; },
    value => { value.series.nominalGdp.observations[0].date = '2026-04-31'; },
    value => { value.series.nominalGdp.observations[0].date = '2026-04-01'; },
    value => { value.series.nominalGdp.observations.reverse(); },
    value => { value.series.nominalGdp.observations[0].value = '31906.274'; },
    value => { value.series.nominalGdp.observations[0].value = false; },
    value => { delete value.series.nominalGdp.observations[0].value; },
  ]) await rejects(change);
});

test('consumed GDP denominator metadata retains render-safe text and array types', async () => {
  for (const change of [
    value => { value.status = ['ok']; },
    value => { value.fetchedAt = 123; },
    value => { value.error = { message: 'Recorded failure' }; },
    value => { value.coverageNote = []; },
    value => { value.warnings = 'Warning'; },
    value => { value.provenance = {}; },
    value => { value.provenance = [null]; },
    value => { value.provenance[0].retrievedAt = 123; },
    value => { value.series.nominalGdp.sourceIds = 'A191RC'; },
    value => { value.series.nominalGdp.sourceUrl = ['https://www.bea.gov']; },
    value => { value.series.nominalGdp.calculation = {}; },
    value => { value.series.nominalGdp.dataStatus = []; },
    value => { value.series.nominalGdp.observations[0].sourceValue = {}; },
    value => { value.series.nominalGdp.observations[0].publishedAt = 123; },
    value => { value.series.nominalGdp.observations[0].footnotes = 'Footnote'; },
  ]) await rejects(change);
});

test('valid raw BEA denominator metadata, gaps, nulls and missing coverage round-trip as recorded claims', async () => {
  const missing = denominator();
  missing.status = 'error'; missing.error = 'Recorded refresh failure';
  missing.series.nominalGdp.observations = [observation('2025-10-01', 31000), observation('2026-04-01', null)];
  const empty = denominator(); empty.series.nominalGdp.observations = [];
  for (const source of [denominator(), missing, empty, { status: 'unavailable', series: {}, error: 'No capture' }, {}]) {
    const text = withDenominator(source), pkg = await importResearchPackage(text);
    assert.deepEqual(pkg.context.currentAccountGdpDenominator, source);
    assert.equal(exportResearchPackage(pkg), canonicalJson(JSON.parse(text)));
    // Absence of unit/frequency on raw NIPA metadata is legitimate; imports
    // preserve supplied claims rather than certifying their official origin.
    assert.equal(pkg.context.currentAccountGdpDenominator.series?.nominalGdp?.unit, undefined);
  }
});

test('older frozen packages stay byte-identical and acquire no current GDP denominator', async () => {
  const pkg = await importResearchPackage(base);
  assert.equal(exportResearchPackage(pkg), base);
  assert.equal(Object.hasOwn(pkg.context, 'currentAccountGdpDenominator'), false);
});
