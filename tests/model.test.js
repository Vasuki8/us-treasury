import test from 'node:test';
import assert from 'node:assert/strict';
import { series, releases, yieldCurve } from '../src/data.js';
import {
  getSeries, filterSeries, latest, formatValue, formatChange,
  periodLabel, transformSeries, compareSeries, toCsv,
} from '../src/model.js';

const ids = ['unrate', 'payroll', 'cpi', 'pce', 'gdp', 'yield', 'debt', 'claims', 'participation', 'wages', 'openings', 'retail'];
const fixture = (values, extra = {}) => ({
  id: 'fixture', code: 'FIX', name: 'Example', short: 'Example', topic: 'Labor',
  frequency: 'Monthly', unit: 'Percent', precision: 1, format: 'percent',
  adjustment: 'Seasonally adjusted', source: { name: 'Synthetic agency', url: 'https://example.com' },
  definition: 'Test observations.', revisions: [],
  observations: values.map((value, i) => ({
    date: `2026-0${i + 1}-01`, value, publishedAt: `2026-0${i + 2}-01`,
  })), ...extra,
});

test('the fixture catalog supplies twelve complete synthetic series', () => {
  assert.deepEqual(Object.keys(series).sort(), [...ids].sort());
  for (const [id, s] of Object.entries(series)) {
    assert.equal(s.id, id);
    assert.equal(s.observations.length, 12);
    for (const key of ['code', 'name', 'short', 'topic', 'frequency', 'unit', 'adjustment', 'definition']) {
      assert.equal(typeof s[key], 'string', `${id}.${key}`);
      assert.ok(s[key].length > 0, `${id}.${key}`);
    }
    assert.match(s.source.name, /synthetic/i);
    assert.match(s.source.url, /^https:\/\//);
    assert.ok(Number.isInteger(s.precision));
    for (const [i, observation] of s.observations.entries()) {
      assert.match(observation.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.match(observation.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(observation.value === null || Number.isFinite(observation.value));
      assert.ok(observation.publishedAt >= observation.date);
      if (i) assert.ok(observation.date > s.observations[i - 1].date);
    }
    for (const revision of s.revisions) {
      const observation = s.observations.find((o) => o.date === revision.period);
      assert.ok(observation);
      assert.ok(Number.isFinite(revision.initial));
      assert.ok(Number.isFinite(revision.revised));
      assert.match(revision.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(observation.value, revision.revised);
      assert.ok(observation.publishedAt >= revision.publishedAt);
    }
  }
});

test('fixture periods follow monthly, quarterly, daily, and weekly frequencies', () => {
  assert.equal(series.gdp.frequency, 'Quarterly');
  assert.equal(series.gdp.observations[0].date, '2023-07-01');
  assert.equal(latest(series.gdp).date, '2026-04-01');
  for (const s of Object.values(series).filter((s) => s.frequency === 'Monthly')) {
    const endMonth = ['pce', 'openings'].includes(s.id) ? '2026-08-01' : '2026-09-01';
    assert.equal(latest(s).date, endMonth, s.id);
    for (let i = 1; i < s.observations.length; i++) {
      const before = new Date(`${s.observations[i - 1].date}T00:00:00Z`);
      const after = new Date(`${s.observations[i].date}T00:00:00Z`);
      assert.equal((after.getUTCFullYear() - before.getUTCFullYear()) * 12 + after.getUTCMonth() - before.getUTCMonth(), 1);
    }
  }
  for (const id of ['yield', 'debt']) {
    assert.equal(series[id].frequency, 'Daily');
    assert.equal(latest(series[id]).date, '2026-10-20');
    assert.ok(series[id].observations.every((o) => ![0, 6].includes(new Date(`${o.date}T00:00:00Z`).getUTCDay())));
  }
  assert.equal(series.claims.frequency, 'Weekly');
  assert.equal(latest(series.claims).date, '2026-10-10');
  for (let i = 1; i < series.claims.observations.length; i++) {
    assert.equal(Date.parse(series.claims.observations[i].date) - Date.parse(series.claims.observations[i - 1].date), 7 * 86400000);
  }
});

test('sample releases distinguish actuals, priors, revisions, and unavailable consensus', () => {
  assert.ok(releases.length >= 5);
  for (const release of releases) {
    assert.ok(release.date >= '2026-10-19' && release.date <= '2026-10-23');
    assert.ok(series[release.seriesId]);
    assert.equal(release.consensus, null);
    assert.match(release.time, /^\d{2}:\d{2}$/);
    assert.match(release.period, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(['released', 'scheduled'].includes(release.status));
    if (release.status === 'scheduled') assert.equal(release.actual, null);
    for (const field of ['actual', 'prior', 'revised']) {
      assert.ok(release[field] === null || Number.isFinite(release[field]));
    }
  }
  assert.ok(releases.some((r) => r.status === 'released' && r.actual !== null));
  assert.ok(releases.some((r) => r.status === 'scheduled'));
});

test('the synthetic yield curve has ordered tenors and separate previous values', () => {
  assert.ok(yieldCurve.length >= 6);
  for (let i = 0; i < yieldCurve.length; i++) {
    const point = yieldCurve[i];
    assert.equal(typeof point.tenor, 'string');
    assert.ok(Number.isFinite(point.value));
    assert.ok(Number.isFinite(point.previous));
    if (i) assert.ok(point.years > yieldCurve[i - 1].years);
  }
});

test('search recognizes ordinary-language aliases, source names, and codes', () => {
  assert.equal(getSeries('missing'), undefined);
  assert.deepEqual(filterSeries({ query: 'jobs' }).map((s) => s.id).sort(), ['payroll', 'unrate']);
  assert.deepEqual(filterSeries({ query: 'unemployment' }).map((s) => s.id), ['unrate']);
  assert.ok(filterSeries({ query: 'GDP' }).some((s) => s.id === 'gdp'));
  assert.ok(filterSeries({ query: 'treasury' }).some((s) => s.id === 'yield'));
  assert.ok(filterSeries({ query: 'debt' }).some((s) => s.id === 'debt'));
  assert.ok(filterSeries({ query: series.cpi.code.toLowerCase() }).some((s) => s.id === 'cpi'));
  assert.ok(filterSeries({ query: 'bureau of labor statistics' }).some((s) => s.id === 'unrate'));
});

test('catalog filters compose topic, frequency, and watchlist without stale results', () => {
  assert.equal(filterSeries().length, 12);
  assert.deepEqual(filterSeries({ frequency: 'Quarterly' }).map((s) => s.id), ['gdp']);
  assert.deepEqual(filterSeries({ query: 'jobs', watchlist: new Set(['unrate']) }).map((s) => s.id), ['unrate']);
  assert.deepEqual(filterSeries({ topic: series.cpi.topic, watchlist: ['cpi', 'gdp'] }).map((s) => s.id), ['cpi']);
  assert.deepEqual(filterSeries({ watchlist: [] }), []);
  assert.deepEqual(filterSeries({ query: 'nothing matches here' }), []);
});

test('catalog search treats object prototype property names as ordinary search text', () => {
  assert.deepEqual(filterSeries({ query: 'constructor' }), []);
  assert.deepEqual(filterSeries({ query: '__proto__' }), []);
  assert.deepEqual(filterSeries({ query: 'toString' }), []);
});

test('latest keeps a missing final observation instead of substituting an older value', () => {
  assert.equal(latest(fixture([4, null])).value, null);
  assert.equal(latest(fixture([])), undefined);
});

test('value formatting preserves the scale and marks unavailable observations', () => {
  assert.equal(formatValue(series.unrate, 4.2), '4.2%');
  assert.equal(formatValue(series.debt, 37.62), '$37.62T');
  assert.equal(formatValue(series.payroll, 142), '142k');
  assert.equal(formatValue(series.openings, 7.45), '7.45M');
  for (const value of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(formatValue(series.cpi, value), '—');
});

test('change labels use percentage points and basis points, including negative and zero changes', () => {
  assert.equal(formatChange(fixture([4.1, 4.2])), '+0.1 pp');
  assert.equal(formatChange(fixture([4.2, 4.1])), '−0.1 pp');
  assert.equal(formatChange(fixture([4.2, 4.2])), '0.0 pp');
  assert.equal(formatChange(fixture([4.15, 4.18], { id: 'yield', precision: 2, frequency: 'Daily' })), '+3 bp');
  assert.equal(formatChange(fixture([128, 142], { format: 'thousands', precision: 0 })), '+14k');
  assert.equal(formatChange(fixture([4, null])), '—');
  assert.equal(formatChange(fixture([null, 4])), '—');
  assert.equal(formatChange(fixture([4])), '—');
});

test('period labels describe observation frequency in UTC', () => {
  assert.equal(periodLabel(series.cpi, '2026-09-01'), 'Sep 2026');
  assert.equal(periodLabel(series.gdp, '2026-04-01'), 'Q2 2026');
  assert.equal(periodLabel(series.yield, '2026-10-20'), '20 Oct 2026');
  assert.equal(periodLabel(series.claims, '2026-10-10'), 'Week of 10 Oct 2026');
  assert.equal(periodLabel(series.cpi, 'invalid'), '—');
});

test('level ranges expose exact observations without mutating the source', () => {
  const s = fixture([1, null, 3]);
  const result = transformSeries(s, 'level', 2);
  assert.equal(result.series, s);
  assert.equal(result.unit, 'Percent');
  assert.deepEqual(result.observations, [
    { date: '2026-02-01', value: null, publishedAt: '2026-03-01' },
    { date: '2026-03-01', value: 3, publishedAt: '2026-04-01' },
  ]);
  result.observations[1].value = 99;
  assert.equal(s.observations[2].value, 3);
});

test('transformed observations retain the publication dates of their underlying values', () => {
  const s = fixture([1, 3, 6]);
  assert.equal(transformSeries(s, 'level', 1).observations[0].publishedAt, '2026-04-01');
  assert.equal(transformSeries(s, 'change', 1).observations[0].publishedAt, '2026-04-01');
  const indexed = compareSeries(['cpi', 'unrate'], 'indexed', 2);
  assert.equal(indexed.panels[0].observations[1].publishedAt, '2026-10-14');
});

test('indexed panels retain their original post-baseline dates instead of intersecting calendars', () => {
  const result = compareSeries(['cpi', 'gdp'], 'indexed', 12);
  assert.equal(result.error, null);
  assert.deepEqual(result.panels[0].observations.map((o) => o.date), [
    '2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01',
    '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01',
  ]);
  assert.deepEqual(result.panels[1].observations.map((o) => o.date), ['2025-10-01', '2026-01-01', '2026-04-01']);
});

test('changes use observations before the displayed range and preserve missing gaps', () => {
  assert.deepEqual(transformSeries(fixture([1, 3, 6]), 'change', 2).observations, [
    { date: '2026-02-01', value: 2, publishedAt: '2026-03-01' },
    { date: '2026-03-01', value: 3, publishedAt: '2026-04-01' },
  ]);
  assert.deepEqual(transformSeries(fixture([1, null, 6]), 'change').observations.map((o) => o.value), [null, null, null]);
  assert.equal(transformSeries(fixture([1, 2]), 'change').unit, 'Percentage points');
  const rates = fixture([4.15, 4.18], { id: 'yield' });
  assert.deepEqual(transformSeries(rates, 'change').observations.map((o) => o.value), [null, 3]);
  assert.equal(transformSeries(rates, 'change').unit, 'Basis points');
  assert.deepEqual(transformSeries(fixture([0, 2], { format: 'thousands', unit: 'Thousands' }), 'change').observations.map((o) => o.value), [null, 2]);
});

test('native comparisons keep mixed-frequency series in separate panels', () => {
  const result = compareSeries(['cpi', 'gdp'], 'native', 2);
  assert.equal(result.error, null);
  assert.equal(result.panels.length, 2);
  assert.equal(result.panels[0].unit, series.cpi.unit);
  assert.deepEqual(result.panels[0].observations.map((o) => o.date), ['2026-08-01', '2026-09-01']);
  assert.deepEqual(result.panels[1].observations.map((o) => o.date), ['2026-01-01', '2026-04-01']);
});

test('indexed comparisons use the earliest common date in the displayed ranges', () => {
  const result = compareSeries(['unrate', 'cpi'], 'indexed', 3);
  assert.equal(result.error, null);
  assert.equal(result.panels.length, 2);
  for (const panel of result.panels) {
    assert.equal(panel.observations[0].date, '2026-07-01');
    assert.equal(panel.observations[0].value, 100);
    assert.equal(panel.unit, 'Index (common baseline = 100)');
  }
  const gdpAndCpi = compareSeries(['gdp', 'cpi'], 'indexed', 2);
  assert.deepEqual(gdpAndCpi.panels, []);
  assert.match(gdpAndCpi.error, /common|frequency/i);
});

test('indexed comparison skips missing or zero baselines without filling observations', () => {
  const a = fixture([0, 2, null, 8], { id: 'custom-a' });
  const b = fixture([1, 4, 6, 8], { id: 'custom-b' });
  series[a.id] = a;
  series[b.id] = b;
  try {
    const result = compareSeries([a.id, b.id], 'indexed', 4);
    assert.equal(result.error, null);
    assert.deepEqual(result.panels[0].observations, [
      { date: '2026-02-01', value: 100, publishedAt: '2026-03-01' },
      { date: '2026-03-01', value: null, publishedAt: '2026-04-01' },
      { date: '2026-04-01', value: 400, publishedAt: '2026-05-01' },
    ]);
    assert.deepEqual(result.panels[1].observations.map((o) => o.value), [100, 150, 200]);
  } finally {
    delete series[a.id];
    delete series[b.id];
  }
});

test('empty and unknown comparisons fail safely without inventing series', () => {
  assert.deepEqual(compareSeries([]), { panels: [], error: null });
  assert.deepEqual(compareSeries(['unknown']).panels, []);
  assert.match(compareSeries(['unknown']).error, /unknown|unavailable/i);
});

test('CSV exports the displayed range with metadata and explicit synthetic status', () => {
  const csv = toCsv(['cpi'], { range: 1 });
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[0], 'series_id,name,date,value,unit,frequency,adjustment,source,publication_date,transform,data_status');
  assert.match(lines[1], /^cpi,/);
  assert.ok(lines[1].includes(',2026-09-01,2.9,'));
  assert.ok(lines[1].includes(`,${latest(series.cpi).publishedAt},level,synthetic`));
  assert.ok(!csv.includes('2026-08-01'));
});

test('CSV exports transformed and indexed values exactly as displayed', () => {
  const s = fixture([1, 3, 6], { id: 'csv-fixture' });
  series[s.id] = s;
  try {
    const change = toCsv([s.id], { range: 1, transform: 'change' });
    assert.ok(change.includes(',2026-03-01,3,Percentage points,'));
    assert.ok(change.includes(',change,synthetic'));
    const indexed = toCsv([s.id], { comparison: 'indexed', range: 2 });
    assert.ok(indexed.includes(',2026-02-01,100,Index (common baseline = 100),'));
    assert.ok(indexed.includes(',2026-03-01,200,Index (common baseline = 100),'));
    assert.ok(indexed.includes(',indexed,synthetic'));
    assert.throws(() => toCsv(['cpi', 'gdp'], { comparison: 'indexed', range: 2 }), /common|frequency/i);
  } finally {
    delete series[s.id];
  }
});

test('CSV escapes quotes and newlines, neutralizes formula text, and leaves missing numeric cells blank', () => {
  const s = fixture([null], { id: 'csv-escape', name: '=SUM(1,2)\n"Test"', adjustment: '@unsafe' });
  series[s.id] = s;
  try {
    const csv = toCsv([s.id]);
    assert.ok(csv.includes('"\'=SUM(1,2)\n""Test"""'));
    assert.ok(csv.includes(',2026-01-01,,Percent,'));
    assert.ok(csv.includes(",'@unsafe,"));
  } finally {
    delete series[s.id];
  }
});
