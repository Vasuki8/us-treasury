import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMacroContributions, collectMacroContributions } from '../scripts/sources/macro-contributions.mjs';

const codes = ['A191RL', 'DPCERY', 'A006RY', 'A822RY', 'A020RY', 'A021RY'];
function fixture(values = [2.2, 2.51, .82, -.01, .56, -1.66], period = '2026Q2') {
  return '%SeriesCode,Period,Value\r\n' + codes.map((code, i) => `${code},${period},${values[i]}`).join('\r\n') + '\r\nA191RX,2026Q2,99999\r\nA191RL,2025,2.0\r\n'+[['A007RY',1.28],['A014RY',-.46],['DGDSRY',1.01],['DSERRY',1.5]].map(([code,value])=>`${code},${period},${value}`).join('\r\n')+'\r\n';
}

test('parses official NIPA contribution codes without adding chained-dollar components', () => {
  const result = parseMacroContributions(fixture());
  assert.equal(result.series.gdpConsumptionContribution.sourceIds[0], 'DPCERY');
  assert.equal(result.series.gdpTotalContribution.sourceIds[0], 'A191RL');
  assert.equal(result.quarterly[0].date, '2026-04-01');
  assert.equal(result.quarterly[0].imports, -1.66);
  assert.equal(result.series.gdpTotalContribution.observations[0].publishedAt, null);
  assert.equal(result.series.gdpImportsContribution.observations[0].sourceValue, '-1.66');
});

test('preserves missing published values and rejects inconsistent decompositions or duplicates', () => {
  const missing = parseMacroContributions(fixture([2.2, 2.51, .82, '(NA)', .56, -1.66]));
  assert.equal(missing.quarterly[0].government, null);
  assert.equal(missing.quarterly[0].reconciliationResidual, null);
  assert.throws(() => parseMacroContributions(fixture([2.2, 2.51, .82, -.01, .56, 1.66])), /reconcil|round/i);
  assert.throws(() => parseMacroContributions(fixture() + 'DPCERY,2026Q2,2.51\r\n'), /Duplicate/i);
});

test('filters future reference periods without inventing release times', () => {
  const result = parseMacroContributions(fixture() + codes.map((code, i) => `${code},2026Q3,${[2.2, 2.51, .82, -.01, .56, -1.66][i]}`).join('\n'), { cutoff: '2026-06-30' });
  assert.deepEqual(result.quarterly.map(x => x.date), ['2026-04-01']);
  assert.match(result.coverageNote, /revis/i);
});

test('collector retains official provenance and marks blocked CPI effects unavailable', async () => {
  let count = 0;
  const result = await collectMacroContributions({ now: new Date('2026-10-21T20:00:00Z'), fetchImpl: async url => { count++; assert.equal(url, 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt'); return new Response(fixture()); } });
  assert.equal(count, 1);
  assert.equal(result.id, 'macroContributions');
  assert.ok(/^[a-f0-9]{64}$/.test(result.provenance[0].sha256));
  assert.equal(result.cpiCategoryEffects.status, 'unavailable');
  assert.equal(result.cpiCategoryEffects.observations.length, 0);
  assert.match(result.cpiCategoryEffects.reason, /403|blocked/i);
  assert.match(result.cpiCategoryEffects.methodology, /weights/i);
  await assert.rejects(() => collectMacroContributions({ fetchImpl: async () => Object.defineProperty(new Response(fixture()), 'redirected', { value: true }) }), /redirect/i);
});
