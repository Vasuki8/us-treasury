import test from 'node:test';
import assert from 'node:assert/strict';
import { series, releases, yieldCurve, dataStatus } from '../src/data.js';
import { parseCsv } from '../scripts/sources/http.mjs';
import {
  getSeries, filterSeries, latest, formatValue, formatChange,
  periodLabel, transformSeries, compareSeries, toCsv,
} from '../src/model.js';

const ids = ['unrate', 'payroll', 'cpi', 'pce', 'gdp', 'yield', 'debt', 'claims', 'participation', 'wages', 'openings', 'retail'];
const fixture = (values, extra = {}) => ({
  id: 'fixture', code: 'FIX', name: 'Example', short: 'Example', topic: 'Labor',
  frequency: 'Monthly', unit: 'Percent', precision: 1, format: 'percent',
  adjustment: 'Seasonally adjusted', source: { name: 'Synthetic agency', url: 'https://example.com' },
  definition: 'Test observations.', revisions: [], dataStatus:'test',
  observations: values.map((value, i) => ({
    date: `2026-0${i + 1}-01`, value, publishedAt: `2026-0${i + 2}-01`,
  })), ...extra,
});

test('official catalog has traced observations and explicitly unavailable out-of-scope series', () => {
  assert.deepEqual(Object.keys(series).sort(), [...ids].sort());
  for (const [id, s] of Object.entries(series)) {
    assert.equal(s.id,id);
    assert.doesNotMatch(s.source.name,/synthetic/i);
    assert.match(s.source.url,/^https:\/\//);
    assert.ok(Number.isInteger(s.precision));
    assert.deepEqual(s.revisions,[], 'no invented revision history');
    if (['claims','retail'].includes(id)) {
      assert.equal(s.dataStatus,'unavailable');
      assert.deepEqual(s.observations,[]);
      continue;
    }
    assert.equal(s.dataStatus,'official',id);
    assert.ok(s.observations.filter(o=>Number.isFinite(o.value)).length>=12,id);
    assert.match(s.fetchedAt,/^\d{4}-\d{2}-\d{2}T/);
    assert.ok(s.source.seriesIds.length);
    for (const [i,o] of s.observations.entries()) {
      assert.match(o.date,/^\d{4}-\d{2}-\d{2}$/);
      assert.equal(o.publishedAt,null,'retrieval is not a publication date');
      assert.ok(o.value===null || Number.isFinite(o.value));
      if(i)assert.ok(o.date>s.observations[i-1].date);
    }
  }
});

test('official observations follow their real frequencies and maintain source provenance', () => {
  assert.equal(series.gdp.frequency,'Quarterly');
  assert.ok(series.gdp.observations.every(o=>/^\d{4}-(01|04|07|10)-01$/.test(o.date)));
  for (const s of Object.values(series).filter(s=>s.frequency==='Monthly')) {
    assert.ok(s.observations.every(o=>o.date.endsWith('-01')));
  }
  assert.equal(series.cpi.adjustment,'Not seasonally adjusted');
  for(const id of ['treasury','bls','bea']) {
    assert.equal(dataStatus.sources[id].status,'ok');
    assert.ok(dataStatus.sources[id].provenance.length);
    for(const source of dataStatus.sources[id].provenance) {
      assert.match(source.sha256,/^[a-f0-9]{64}$/);
      assert.match(source.url,/^https:\/\//);
    }
  }
});

test('production calendar has no invented releases, consensus or revision snapshots', () => {
  assert.deepEqual(releases,[]);
  assert.equal(dataStatus.calendar.status,'unavailable');
  assert.ok(dataStatus.calendar.links.some(link=>link.url.includes('bls.gov')));
  assert.ok(dataStatus.calendar.links.some(link=>link.url.includes('bea.gov')));
});

test('official Treasury curve preserves exact dated snapshots and unavailable tenors', () => {
  assert.match(dataStatus.curveDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(dataStatus.previousCurveDate<dataStatus.curveDate);
  assert.ok(yieldCurve.length>=6);
  for(const [i,point] of yieldCurve.entries()) {
    assert.ok(point.value===null || Number.isFinite(point.value));
    assert.ok(point.previous===null || Number.isFinite(point.previous));
    if(i)assert.ok(point.years>yieldCurve[i-1].years);
  }
  assert.equal(yieldCurve.find(point=>point.tenor==='10Y').value,latest(series.yield).value);
});

test('captured official measures reconcile with their retained source values and exact baselines',()=>{
  for(const [id,s] of Object.entries(series)) {
    if(['claims','retail','yield'].includes(id))continue;
    for(const o of s.observations) {
      if(o.value===null)continue;
      const raw=Number(String(o.sourceValue).replaceAll(',',''));
      let expected=raw;
      if(id==='debt')expected=raw/1e12;
      else if(id==='openings')expected=raw/1000;
      else if(id==='payroll')expected=raw-Number(o.baseValue);
      else if(['cpi','wages','pce'].includes(id))expected=100*(raw/Number(o.baseValue??o.yearAgoSourceValue)-1);
      assert.ok(Number.isFinite(expected),`${id} ${o.date} source inputs`);
      assert.ok(Math.abs(o.value-expected)<1e-9,`${id} ${o.date} calculation`);
    }
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
  assert.equal(indexed.panels[0].observations[1].publishedAt, latest(series.cpi).publishedAt);
});

test('indexed panels retain their original post-baseline dates instead of intersecting calendars', () => {
  const monthly=fixture([], {id:'monthly-calendar',observations:Array.from({length:12},(_,i)=>({date:new Date(Date.UTC(2025,9+i,1)).toISOString().slice(0,10),value:i+1,publishedAt:null}))});
  const quarterly=fixture([], {id:'quarterly-calendar',frequency:'Quarterly',observations:Array.from({length:12},(_,i)=>({date:new Date(Date.UTC(2023,6+3*i,1)).toISOString().slice(0,10),value:i+1,publishedAt:null}))});
  series[monthly.id]=monthly;series[quarterly.id]=quarterly;
  try {
  const result = compareSeries([monthly.id,quarterly.id], 'indexed', 12);
  assert.equal(result.error, null);
  assert.deepEqual(result.panels[0].observations.map((o) => o.date), [
    '2025-10-01', '2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01', '2026-03-01',
    '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01',
  ]);
  assert.deepEqual(result.panels[1].observations.map((o) => o.date), ['2025-10-01', '2026-01-01', '2026-04-01']);
  } finally { delete series[monthly.id];delete series[quarterly.id]; }
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
  assert.deepEqual(result.panels[0].observations.map((o) => o.date), series.cpi.observations.slice(-2).map(o=>o.date));
  assert.deepEqual(result.panels[1].observations.map((o) => o.date), series.gdp.observations.slice(-2).map(o=>o.date));
});

test('indexed comparisons use the earliest common date in the displayed ranges', () => {
  const result = compareSeries(['unrate', 'cpi'], 'indexed', 3);
  assert.equal(result.error, null);
  assert.equal(result.panels.length, 2);
  for (const panel of result.panels) {
    assert.equal(panel.observations[0].date, series.unrate.observations.at(-3).date);
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

test('CSV exports the displayed range with official provenance and an unknown release date', () => {
  const csv = toCsv(['cpi'], { range: 1 });
  const lines = csv.trim().split('\r\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('publication_date,transform,data_status,retrieved_at,source_url,source_series,calculation'));
  assert.match(lines[1], /^cpi,/);
  const [header,values]=parseCsv(csv);
  const row=Object.fromEntries(header.map((key,index)=>[key,values[index]]));
  assert.equal(row.date,latest(series.cpi).date);
  assert.equal(Number(row.value),latest(series.cpi).value);
  assert.equal(row.publication_date,'');
  assert.equal(row.data_status,'official');
  assert.equal(row.retrieved_at,series.cpi.fetchedAt);
  assert.equal(row.source_series,'CUUR0000SA0');
  assert.match(row.source_url,/api.bls.gov/);
});

test('CSV exports transformed and indexed values exactly as displayed', () => {
  const s = fixture([1, 3, 6], { id: 'csv-fixture' });
  series[s.id] = s;
  try {
    const change = toCsv([s.id], { range: 1, transform: 'change' });
    assert.ok(change.includes(',2026-03-01,3,Percentage points,'));
    assert.ok(change.includes(',change,test'));
    const indexed = toCsv([s.id], { comparison: 'indexed', range: 2 });
    assert.ok(indexed.includes(',2026-02-01,100,Index (common baseline = 100),'));
    assert.ok(indexed.includes(',2026-03-01,200,Index (common baseline = 100),'));
    assert.ok(indexed.includes(',indexed,test'));
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

test('CSV preserves validated negative numeric source strings without a formula-escape apostrophe',()=>{
  const example=fixture([-28],{id:'negative-source',observations:[{date:'2020-04-01',value:-28,publishedAt:null,sourceValue:'-28.0'}]});
  series[example.id]=example;
  try {
    const [headers,row]=parseCsv(toCsv([example.id]));
    assert.equal(row[headers.indexOf('source_value')],'-28.0');
  } finally {delete series[example.id];}
});
