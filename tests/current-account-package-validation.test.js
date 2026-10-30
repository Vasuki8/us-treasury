import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { series } from '../src/data.js';
import { canonicalJson } from '../src/research-workspaces.js';
import { createResearchPackage, exportResearchPackage, importResearchPackage } from '../src/research-packages.js';
import { buildPinContext } from '../src/research-context.js';
import { parseRoute } from '../src/router.js';
import { researchPage } from '../src/research-page.js';

const observation = (date, value) => ({ date, value, sourceValue: value === null ? '...' : String(value), publishedAt: null, footnotes: [] });
function inputs() {
  return {
    status: 'ok', fetchedAt: '2026-10-23T20:00:00.000Z', tableReleaseDate: '2026-09-23', error: null,
    coverageNote: 'Recorded quarterly amounts.', warnings: [], provenance: [],
    series: { currentAccountBalance: {
      sourceTitle: 'Recorded ITA table', sourceUrl: 'https://www.bea.gov/example', sourceIds: ['ITA:T1.1:line30:World:SA:Q'],
      observations: [observation('2026-01-01', -400), observation('2026-04-01', -300)],
    } },
  };
}
const base = exportResearchPackage(await createResearchPackage({
  name: 'Imported current-account supplement', state: { selected: ['gdp'], range: 1 },
  catalog: { gdp: { ...series.gdp, observations: series.gdp.observations.slice(-2) } },
}));
function withContext(currentAccountInputs) {
  const value = JSON.parse(base);
  value.context.currentAccountInputs = currentAccountInputs;
  delete value.checksum;
  value.checksum = { algorithm: 'SHA-256', value: createHash('sha256').update(canonicalJson(value)).digest('hex') };
  return JSON.stringify(value);
}
async function rejects(change) {
  const value = inputs();
  const replacement = change(value);
  await assert.rejects(importResearchPackage(withContext(replacement === undefined ? value : replacement)), /current.account/i);
}

test('checksum-valid imported current-account supplements reject malformed source and observation containers', async () => {
  for (const change of [
    () => [], () => 'Recorded source',
    value => { value.series = []; },
    value => { value.series.currentAccountBalance = null; },
    value => { value.series.unrecognizedBalance = value.series.currentAccountBalance; },
    value => { value.series.currentAccountBalance.observations = { date: '2026-04-01', value: 1 }; },
    value => { value.series.currentAccountBalance.observations = [null]; },
  ]) await rejects(change);
});

test('supplemental observations require ordered unique valid quarter-start dates and finite or null values', async () => {
  for (const change of [
    value => { value.series.currentAccountBalance.observations[0].date = 123; },
    value => { value.series.currentAccountBalance.observations[0].date = '2026-02-01'; },
    value => { value.series.currentAccountBalance.observations[0].date = '2026-04-31'; },
    value => { value.series.currentAccountBalance.observations[0].date = '2026-04-01'; },
    value => { value.series.currentAccountBalance.observations.reverse(); },
    value => { value.series.currentAccountBalance.observations[0].value = '-400'; },
    value => { value.series.currentAccountBalance.observations[0].value = false; },
    value => { delete value.series.currentAccountBalance.observations[0].value; },
  ]) await rejects(change);
});

test('consumed source and series metadata must retain string, date and array types', async () => {
  for (const change of [
    value => { value.status = ['ok']; },
    value => { value.status = 'official'; },
    value => { value.fetchedAt = 123; },
    value => { value.tableReleaseDate = '2026-02-30'; },
    value => { value.error = { message: 'HTTP 503' }; },
    value => { value.coverageNote = ['Recorded source']; },
    value => { value.warnings = 'Warning'; },
    value => { value.provenance = {}; },
    value => { value.provenance = [null]; },
    value => { value.series.currentAccountBalance.sourceTitle = ['Table']; },
    value => { value.series.currentAccountBalance.sourceIds = 'ITA:T1.1'; },
    value => { value.series.currentAccountBalance.publicationNote = {}; },
    value => { value.series.currentAccountBalance.observations[0].footnotes = 'Footnote'; },
    value => { value.series.currentAccountBalance.observations[0].publishedAt = 123; },
    value => { value.series.currentAccountBalance.observations[0].sourceValue = {}; },
  ]) await rejects(change);
});

test('valid missing balances, gaps and an unavailable source remain renderable recorded claims', async () => {
  const missing = inputs();
  missing.status = 'error';
  missing.error = 'Recorded refresh failure';
  missing.series.currentAccountBalance.observations = [observation('2025-10-01', -400), observation('2026-04-01', null)];
  for (const currentAccountInputs of [missing, { status: 'unavailable', series: {}, error: 'No capture' }]) {
    const pkg = await importResearchPackage(withContext(currentAccountInputs));
    const html = researchPage({ ...parseRoute('#/research?view=packages'), packageId: pkg.id }, { library: { packages: [pkg] } });
    assert.match(html, /FROZEN CURRENT ACCOUNT/i);
    assert.match(html, /Unavailable|unavailable/);
    assert.doesNotMatch(html, /data-export-current-account/);
  }
});

test('genuine frozen current-account inputs and original scoped CSV still round-trip unchanged', async () => {
  const args = buildPinContext(parseRoute('#/economy?family=external&window=all'));
  const pkg = await createResearchPackage({ name: 'Recorded current-account accounting', ...args });
  const text = exportResearchPackage(pkg), imported = await importResearchPackage(text);
  assert.equal(exportResearchPackage(imported), text);
  assert.equal(imported.context.attachments[0].content, args.context.attachments[0].content);
  assert.equal(Object.keys(imported.context.currentAccountInputs.series).length, 6);
});
