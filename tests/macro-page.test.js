import test from 'node:test';
import assert from 'node:assert/strict';
import { macroPage, macroContributionsCsv } from '../src/macro-page.js';
import { parseCsv } from '../scripts/sources/http.mjs';

function fixture() {
  const quarterly = [{ date: '2026-01-01', total: 2.5, consumption: .49, investment: 1.25, government: .8, exports: 1.43, imports: -1.47, reconciliationResidual: 0, complete: true }, { date: '2026-04-01', total: 2.2, consumption: 2.51, investment: .82, government: -.01, exports: .56, imports: -1.66, reconciliationResidual: -.02, complete: true }];
  const ids = { total: ['gdpTotalContribution', 'A191RL'], consumption: ['gdpConsumptionContribution', 'DPCERY'], investment: ['gdpInvestmentContribution', 'A006RY'], government: ['gdpGovernmentContribution', 'A822RY'], exports: ['gdpExportsContribution', 'A020RY'], imports: ['gdpImportsContribution', 'A021RY'] };
  return { status: 'ok', fetchedAt: '2026-10-21T22:00:00.000Z', quarterly, coverageNote: 'Latest revised BEA history; release dates unknown.', series: Object.fromEntries(Object.entries(ids).map(([key, [id, code]]) => [id, { sourceIds: [code], sourceUrl: 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt', calculation: 'Published NIPA 1.1.2 contribution; import sign retained', observations: quarterly.map(q => ({ date: q.date, value: q[key], publishedAt: null })) }])), cpiCategoryEffects: { status: 'unavailable', reason: 'Official BLS tables returned HTTP 403.', observations: [], sourceUrls: ['https://www.bls.gov/news.release/cpi.t06.htm', 'https://www.bls.gov/news.release/cpi.t07.htm'], methodology: 'No relative-importance weights approximation.' } };
}

test('macro page explains published GDP accounting contributions, units, signs and timing', () => {
  const html = macroPage(fixture());
  for (const text of ['GDP CONTRIBUTIONS', '2026 Q2', '2.2%', '2.51', '-1.66', '-0.02', 'percentage points', '2026-10-21T22:00:00.000Z', 'Release date: unknown', 'HTTP 403', 'WHAT CHANGED', 'WHAT CONTRIBUTED', 'WHY IT MATTERS', 'LIMITATIONS']) assert.ok(html.includes(text), text);
  assert.match(html, /data-export-macro/);
  assert.match(html, /imports.*published sign|published sign.*imports/is);
  assert.match(html, /chained-dollar/i);
  assert.match(html, /not establish.*caus|not.*causal/i);
});

test('macro page shows missing/loading/error states and safely escapes source text', () => {
  assert.match(macroPage(null), /unavailable|no.*capture/i);
  assert.match(macroPage({ status: 'loading' }), /loading/i);
  const source = fixture(); source.status = 'error'; source.error = '<script>alert(1)</script>'; source.coverageNote = '<img src=x>';
  const html = macroPage(source);
  assert.match(html, /CACHED/);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  const invalid = fixture(); invalid.quarterly[1].imports = 1.66;
  assert.match(macroPage(invalid), /reconciliation|cannot.*valid|unavailable/i);
  const missing = fixture(); missing.quarterly[1].total = null;
  assert.ok(!macroPage(missing).includes('Unavailable%'));
  const zero = fixture(); for (const key of ['total', 'consumption', 'investment', 'government', 'exports', 'imports']) zero.quarterly[1][key] = 0;
  assert.match(macroPage(zero), /No positive or negative contribution/i);
});

test('macro CSV preserves published negative imports, missing release dates, method and unavailable CPI status', () => {
  const [header, ...values] = parseCsv(macroContributionsCsv(fixture()));
  const rows = values.map(row => Object.fromEntries(header.map((key, index) => [key, row[index]])));
  const imports = rows.find(row => row.series_id === 'gdpImportsContribution' && row.date === '2026-04-01');
  assert.equal(imports.value, '-1.66');
  assert.equal(imports.unit, 'Percentage points q/q annualized');
  assert.equal(imports.release_date, '');
  assert.equal(imports.retrieved_at, '2026-10-21T22:00:00.000Z');
  assert.equal(imports.source_series, 'A021RY');
  assert.equal(imports.observation_type, 'official');
  const total = rows.find(row => row.series_id === 'gdpTotalContribution');
  assert.equal(total.unit, 'Percent q/q annualized');
  const residual = rows.find(row => row.series_id === 'gdpContributionResidual' && row.date === '2026-04-01');
  assert.equal(residual.value, '-0.02');
  assert.equal(residual.observation_type, 'calculated');
  const cpi = rows.find(row => row.series_id === 'cpiCategoryEffects');
  assert.equal(cpi.value, ''); assert.equal(cpi.data_status, 'unavailable'); assert.match(cpi.availability_reason, /403/);
});
test('macro CSV carries captured response provenance for GDP but does not imply a CPI capture',()=>{
 const source=fixture();source.provenance=[{url:'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt',sha256:'a'.repeat(64),retrievedAt:source.fetchedAt}];
 const [headers,...rows]=parseCsv(macroContributionsCsv(source)),column=headers.indexOf('capture_provenance_json');assert.ok(column>=0);
 assert.deepEqual(JSON.parse(rows[0][column]),source.provenance);assert.deepEqual(JSON.parse(rows.at(-1)[column]),[]);
});
