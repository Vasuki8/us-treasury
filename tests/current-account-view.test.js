import {humanTimestamp} from '../src/ui-time.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../scripts/sources/http.mjs';

const view = await import('../src/current-account-view.js').catch(() => ({}));
const observation = (date, value) => ({ date, value, publishedAt: null, sourceValue: value === null ? '...' : String(value), footnotes: [] });
const series = (previous, current) => ({ observations: [observation('2026-01-01', previous), observation('2026-04-01', current)] });
function source() {
  return {
    status: 'ok', fetchedAt: '2026-10-23T20:00:00.000Z', error: null,
    coverageNote: 'Quarterly U.S. international transactions.', provenance: [],
    series: {
      currentAccountBalance: series(-400, -300.1),
      itaGoodsServicesBalance: series(-350, -260),
      itaGoodsBalance: series(-400, -300), itaServicesBalance: series(50, 40),
      itaPrimaryIncomeBalance: series(-30, -20), itaSecondaryIncomeBalance: series(-20, -20),
    },
  };
}

test('published component changes reconcile to the exact-quarter current-account change without annualizing', () => {
  assert.equal(typeof view.currentAccountContext, 'function', 'Current-account context must be exported');
  const result = view.currentAccountContext(source());
  assert.equal(result.date, '2026-04-01');
  assert.equal(result.previousDate, '2026-01-01');
  assert.equal(result.status, 'official');
  assert.equal(result.headline.current, -300.1);
  assert.equal(result.headline.previous, -400);
  assert.ok(Math.abs(result.headline.change - 99.9) < 1e-10);
  assert.equal(result.headline.balanceType, 'deficit');
  assert.equal(result.headline.movement, 'narrowed');
  assert.deepEqual(result.components.map(item => [item.id, item.change]), [
    ['itaGoodsBalance', 100], ['itaServicesBalance', -10],
    ['itaPrimaryIncomeBalance', 10], ['itaSecondaryIncomeBalance', 0],
  ]);
  assert.deepEqual(result.componentSum, { current: -300, previous: -400, change: 100 });
  assert.ok(Math.abs(result.reconciliation.current - -0.1) < 1e-10);
  assert.equal(result.reconciliation.previous, 0);
  assert.ok(Math.abs(result.reconciliation.change - -0.1) < 1e-10);
});

test('a missing latest headline value keeps its quarter and never backfills an older balance', () => {
  const input = source();
  input.series.currentAccountBalance.observations[1].value = null;
  const result = view.currentAccountContext(input);
  assert.equal(result.date, '2026-04-01');
  assert.equal(result.headline.current, null);
  assert.equal(result.headline.previous, -400);
  assert.equal(result.headline.change, null);
  assert.equal(result.headline.balanceType, 'unavailable');
  assert.equal(result.reconciliation.current, null);
  assert.equal(result.reconciliation.change, null);
});

test('a quarter gap leaves prior changes unavailable even when older rows exist', () => {
  const input = source();
  for (const item of Object.values(input.series)) item.observations[0].date = '2025-10-01';
  const result = view.currentAccountContext(input);
  assert.equal(result.previousDate, '2026-01-01');
  assert.equal(result.headline.current, -300.1);
  assert.equal(result.headline.previous, null);
  assert.equal(result.headline.change, null);
  assert.ok(result.components.every(item => item.previous === null && item.change === null));
  assert.deepEqual(result.componentSum, { current: -300, previous: null, change: null });
});

test('components are aligned to the headline quarter and incomplete components are never zero-filled', () => {
  const input = source();
  input.series.itaPrimaryIncomeBalance.observations = [observation('2026-01-01', -30), observation('2026-07-01', -999)];
  input.series.itaSecondaryIncomeBalance.observations[0].value = null;
  const result = view.currentAccountContext(input);
  assert.equal(result.date, '2026-04-01');
  assert.equal(result.headline.change.toFixed(1), '99.9');
  assert.deepEqual(result.components.map(item => item.change), [100, -10, null, null]);
  assert.equal(result.components[2].current, null);
  assert.equal(result.components[3].current, -20);
  assert.deepEqual(result.componentSum, { current: null, previous: null, change: null });
  assert.deepEqual(result.reconciliation, { current: null, previous: null, change: null });
});

test('quarter selection is order-independent, crosses years, and does not mutate captured rows', () => {
  const input = source();
  for (const item of Object.values(input.series)) {
    item.observations = [observation('2026-01-01', -2), observation('2025-10-01', -1)];
  }
  const before = structuredClone(input);
  const result = view.currentAccountContext(input);
  assert.equal(result.date, '2026-01-01');
  assert.equal(result.previousDate, '2025-10-01');
  assert.equal(result.headline.change, -1);
  assert.equal(result.headline.movement, 'widened');
  assert.deepEqual(input, before);
});

test('deficit wording is restricted to two negative balances and preserves surpluses and zero', () => {
  for (const [previous, current, balanceType, movement] of [
    [-5, -5, 'deficit', 'unchanged'], [-5, -8, 'deficit', 'widened'],
    [5, 8, 'surplus', 'balance-change'], [-5, 8, 'surplus', 'balance-change'],
    [5, -8, 'deficit', 'balance-change'], [-5, 0, 'balanced', 'balance-change'],
  ]) {
    const input = source();
    input.series.currentAccountBalance = series(previous, current);
    const result = view.currentAccountContext(input);
    assert.equal(result.headline.balanceType, balanceType);
    assert.equal(result.headline.movement, movement);
  }
});

test('cached captures retain values and source errors while absent captures stay unavailable', () => {
  const input = { ...source(), status: 'error', error: 'Official refresh failed.' };
  const result = view.currentAccountContext(input);
  assert.equal(result.status, 'cached');
  assert.equal(result.headline.current, -300.1);
  assert.equal(result.error, 'Official refresh failed.');
  assert.equal(result.fetchedAt, input.fetchedAt);
  for (const absent of [null, undefined, {}, { status: 'unavailable', error: 'HTTP 503' }]) {
    const missing = view.currentAccountContext(absent);
    assert.equal(missing.status, 'unavailable');
    assert.equal(missing.date, null);
    assert.equal(missing.previousDate, null);
    assert.equal(missing.headline.current, null);
  }
});

test('panel displays signed nonannualized quarterly amounts, four accounting changes, residual and source credit', () => {
  assert.equal(typeof view.currentAccountPanel, 'function', 'Current-account panel must be exported');
  const html = view.currentAccountPanel(source());
  assert.match(html, /Q2 2026/);
  assert.match(html, /Q1 2026/);
  assert.match(html, /-\$300\.100B/);
  assert.match(html, /\+\$99\.900B/);
  assert.match(html, /deficit narrowed/i);
  for (const name of ['Goods balance', 'Services balance', 'Primary income balance', 'Secondary income balance']) assert.match(html, new RegExp(name));
  assert.match(html, /Component sum/);
  assert.match(html, /reconciliation residual/i);
  assert.match(html, /seasonally adjusted/i);
  assert.match(html, /not annualized/i);
  assert.match(html, /NIPA.*SAAR/);
  assert.match(html, /Bureau of Economic Analysis/);
  assert.match(html, /data-export-current-account/);
  assert.match(html, /CSV CURRENT &amp; PRIOR/i);
});

test('panel keeps missing and cached states visible and escapes all supplied source text', () => {
  assert.equal(typeof view.currentAccountPanel, 'function');
  const input = source();
  input.status = 'error';
  input.error = '<img src=x onerror=alert(1)>';
  input.coverageNote = 'Coverage <script>bad()</script>';
  input.tableReleaseDate = '2026-09-23';
  input.series.currentAccountBalance.observations[1].value = null;
  input.series.currentAccountBalance.sourceTitle = '<b>ITA table</b>';
  input.series.currentAccountBalance.sourceUrl = 'javascript:alert(1)';
  input.series.currentAccountBalance.licenseUrl = 'https://www.bea.gov/about/policies-and-information?x="&y=<x>';
  const html = view.currentAccountPanel(input);
  assert.match(html, /Cached/i);
  assert.match(html, /Latest published current-account balance unavailable/i);
  assert.match(html, /Q2 2026/);
  assert.match(html, /Unavailable/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;b&gt;ITA table&lt;\/b&gt;/);
  assert.match(html, /x=&quot;&amp;y=&lt;x&gt;/);
  assert.doesNotMatch(html, /<img|<script|href="javascript:/i);
  assert.match(html, /2026-09-23/);
  assert.match(html, new RegExp(humanTimestamp("2026-10-23T20:00:00.000Z")));
  assert.match(view.currentAccountPanel({ status: 'unavailable', error: 'HTTP 503' }), /HTTP 503/);
});

test('CSV exports only the displayed exact quarters with missing rows, original values and capture evidence', () => {
  assert.equal(typeof view.currentAccountCsv, 'function', 'Current-account CSV must be exported');
  const input = source();
  input.tableReleaseDate = '2026-09-23';
  input.provenance = [{ url: 'https://apps.bea.gov/international/example.csv', sha256: 'a'.repeat(64), retrievedAt: input.fetchedAt }];
  input.series.itaGoodsBalance.observations.unshift(observation('2025-10-01', -999));
  input.series.itaPrimaryIncomeBalance.observations[1].value = null;
  input.series.itaPrimaryIncomeBalance.observations[1].sourceValue = '...';
  input.series.itaSecondaryIncomeBalance.observations.shift();
  input.series.currentAccountBalance.sourceUnit = 'USD millions';
  input.series.currentAccountBalance.sourceIds = ['BalCurrAcct'];
  input.series.currentAccountBalance.sourceUrl = 'https://apps.bea.gov/international/example.csv';
  input.series.currentAccountBalance.licenseUrl = 'https://www.bea.gov/about/policies-and-information';
  input.series.currentAccountBalance.publicationNote = 'Table release date differs from historical first publication.';
  const [headers, ...values] = parseCsv(view.currentAccountCsv(input));
  const rows = values.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  assert.equal(rows.length, 12);
  assert.deepEqual([...new Set(rows.map(row => row.date))].sort(), ['2026-01-01', '2026-04-01']);
  assert.equal(rows.filter(row => row.series_id === 'itaGoodsServicesBalance').length, 2);
  const headline = rows.find(row => row.series_id === 'currentAccountBalance' && row.date === '2026-04-01');
  assert.equal(headline.value, '-300.1');
  assert.equal(headline.unit, 'USD billions');
  assert.ok(rows.every(row => row.frequency === 'Quarterly'));
  assert.equal(headline.source_unit, 'USD millions');
  assert.equal(headline.adjustment, 'Seasonally adjusted');
  assert.equal(headline.annualization, 'Not annualized');
  assert.equal(headline.source_value, '-300.1');
  assert.equal(headline.publication_date, '');
  assert.equal(headline.table_release_date, '2026-09-23');
  assert.equal(headline.retrieved_at, input.fetchedAt);
  assert.deepEqual(JSON.parse(headline.capture_provenance_json), input.provenance);
  assert.equal(headline.source_ids, 'BalCurrAcct');
  assert.equal(headline.source_url, input.series.currentAccountBalance.sourceUrl);
  assert.equal(headline.license_url, input.series.currentAccountBalance.licenseUrl);
  assert.match(headline.attribution, /Bureau of Economic Analysis/);
  assert.match(headline.publication_note, /historical first publication/);
  const missing = rows.find(row => row.series_id === 'itaPrimaryIncomeBalance' && row.date === '2026-04-01');
  assert.equal(missing.value, '');
  assert.equal(missing.source_value, '...');
  assert.equal(missing.missing, 'true');
  assert.equal(rows.find(row => row.series_id === 'itaSecondaryIncomeBalance' && row.date === '2026-01-01').missing, 'true');
  assert.doesNotMatch(view.currentAccountCsv(input), /2025-10-01|-999/);
});

test('quarterly panel preserves sub-million source precision and does not label floating-point dust as negative zero', () => {
  const input = source();
  input.series.currentAccountBalance.observations[1].value = -300.1001;
  assert.match(view.currentAccountPanel(input), /-\$300\.1001B/);
  input.series.currentAccountBalance.observations[1].value = 0.3;
  input.series.itaGoodsBalance.observations[1].value = 0.1;
  input.series.itaServicesBalance.observations[1].value = 0.2;
  input.series.itaPrimaryIncomeBalance.observations[1].value = 0;
  input.series.itaSecondaryIncomeBalance.observations[1].value = 0;
  assert.doesNotMatch(view.currentAccountPanel(input), /-\$0\.000B/);
});

test('CSV safely quotes source text while preserving validated signed raw numbers with published precision', () => {
  const input = source();
  input.series.currentAccountBalance.observations[1].sourceValue = '-300,100.00';
  input.series.itaGoodsBalance.observations[1].sourceValue = '-2+3';
  input.series.currentAccountBalance.sourceTitle = '=HYPERLINK("bad")';
  input.coverageNote = 'Quoted, coverage\nsecond line';
  const [headers, ...values] = parseCsv(view.currentAccountCsv(input));
  const rows = values.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  assert.equal(rows.find(row => row.series_id === 'currentAccountBalance' && row.date === '2026-04-01').source_value, '-300,100.00');
  assert.equal(rows.find(row => row.series_id === 'itaGoodsBalance' && row.date === '2026-04-01').source_value, "'-2+3");
  assert.equal(rows[0].source_title, "'=HYPERLINK(\"bad\")");
  assert.equal(rows[0].coverage_note, input.coverageNote);
});

test('frozen accounting replay labels recorded status and omits the live CSV action', () => {
  for (const [input, status] of [
    [source(), 'official'],
    [{ ...source(), status: 'error', error: 'Refresh failed' }, 'cached'],
    [{ status: 'unavailable' }, 'unavailable'],
  ]) {
    const html = view.currentAccountPanel(input, { frozen: true });
    assert.match(html, /FROZEN CURRENT ACCOUNT · ACCOUNTING CHANGES/i);
    assert.match(html, new RegExp(`Frozen recorded source status: ${status}`));
    assert.doesNotMatch(html, /data-export-current-account|CSV CURRENT|Official capture|Cached · refresh failed/i);
  }
  assert.match(view.currentAccountPanel(source(), { frozen: false }), /data-export-current-account/);
});
