import test from 'node:test';
import assert from 'node:assert/strict';
import { series, releases, yieldCurve, dataStatus } from '../src/data.js';
import { parseCsv } from '../scripts/sources/http.mjs';
import { easternFields } from '../scripts/sources/calendar-utils.mjs';
import { registry } from '../src/registry.js';
import {
  getSeries, filterSeries, latest, formatValue, formatChange,
  periodLabel, transformSeries, compareSeries, toCsv,
} from '../src/model.js';

const ids = ['unrate', 'payroll', 'cpi', 'pce', 'gdp', 'yield', 'debt', 'claims', 'participation', 'wages', 'openings', 'retail'];
function expectedCaptureStatus(agency){
  const source=dataStatus.sources[agency];
  if(agency==='bls'&&source.status==='error'){
    assert.equal(dataStatus.publicationPolicy?.mode,'allow-cached-bls-data');
    assert.deepEqual(dataStatus.publicationPolicy.cachedDataSources,['bls']);
    assert.deepEqual(source.failure,{kind:'http',status:503,requestedUrl:'https://api.bls.gov/publicAPI/v1/timeseries/data/',url:'https://api.bls.gov/publicAPI/v1/timeseries/data/',redirected:false});
    assert.ok(source.fetchedAt<source.lastAttemptAt,'the failed attempt cannot replace the original successful retrieval');
    return 'cached';
  }
  assert.equal(source.status,'ok');
  return 'official';
}
const fixture = (values, extra = {}) => ({
  id: 'fixture', code: 'FIX', name: 'Example', short: 'Example', topic: 'Labor',
  frequency: 'Monthly', unit: 'Percent', precision: 1, format: 'percent',
  adjustment: 'Seasonally adjusted', source: { name: 'Synthetic agency', url: 'https://example.com' },
  definition: 'Test observations.', revisions: [], dataStatus:'test',
  observations: values.map((value, i) => ({
    date: `2026-0${i + 1}-01`, value, publishedAt: `2026-0${i + 2}-01`,
  })), ...extra,
});

test('original and admitted research indicators have traced observations and retrieval provenance', () => {
  assert.ok(ids.every(id=>Object.hasOwn(series,id)),'all twelve original indicators are preserved');
  assert.deepEqual(Object.keys(series).sort(), Object.keys(registry).sort());
  for (const [id, s] of Object.entries(series)) {
    assert.equal(s.id,id);
    assert.doesNotMatch(s.source.name,/synthetic/i);
    assert.match(s.source.url,/^https:\/\//);
    assert.ok(Number.isInteger(s.precision));
    assert.equal(Object.hasOwn(s,'revisions'),false,'ordinary startup does not compute archived revision rows');
    assert.equal(s.dataStatus,expectedCaptureStatus(s.agency),id);
    if(s.agency==='dolAdvance')assert.equal(s.observations.length,2,'latest release context contains the prior comparison and current advance only');
    else assert.ok(s.observations.filter(o=>Number.isFinite(o.value)).length>=12,id);
    assert.match(s.fetchedAt,/^\d{4}-\d{2}-\d{2}T/);
    assert.ok(s.source.seriesIds.length);
    for (const [i,o] of s.observations.entries()) {
      assert.match(o.date,/^\d{4}-\d{2}-\d{2}$/);
      if(s.agency==='dolAdvance'){assert.match(o.publishedAt,/^\d{4}-\d{2}-\d{2}$/);assert.equal(o.publicationDatePrecision,'day');}
      else assert.equal(o.publishedAt,null,'retrieval is not a publication date');
      assert.ok(o.value===null || Number.isFinite(o.value));
      if(i)assert.ok(o.date>s.observations[i-1].date);
    }
  }
});

test('official observations follow their real frequencies and maintain source provenance', () => {
  assert.equal(series.gdp.frequency,'Quarterly');
  assert.ok(series.gdp.observations.every(o=>/^\d{4}-(01|04|07|10)-01$/.test(o.date)));
  for (const s of Object.values(series).filter(s=>s.frequency==='Monthly')) {
    assert.ok(s.observations.every(o=>s.dateConvention==='month-end'?new Date(Date.parse(`${o.date}T00:00:00Z`)+86400000).getUTCDate()===1:o.date.endsWith('-01')),`${s.id} follows its declared monthly dating convention`);
  }
  assert.equal(series.cpi.adjustment,'Not seasonally adjusted');
  assert.ok(series.claims.observations.every(o=>new Date(`${o.date}T00:00:00Z`).getUTCDay()===6),'claims dates are week endings');
  assert.match(series.claims.coverageNote,/historical|lag|advance/i);
  assert.match(series.retail.source.name,/Census.*Advance Monthly Retail Trade/i);
  for(const id of ['treasury','bls','bea','dol','census']) {
    expectedCaptureStatus(id);
    assert.ok(dataStatus.sources[id].provenance.length);
    for(const source of dataStatus.sources[id].provenance) {
      assert.match(source.sha256,/^[a-f0-9]{64}$/);
      assert.match(source.url,/^https:\/\//);
    }
  }
});

test('production calendar contains traced official schedules without invented publication results', () => {
  assert.ok(releases.length>0);
  assert.ok(dataStatus.calendar.links.some(link=>link.url.includes('bls.gov')||link.url==='https://www.newyorkfed.org/research/calendars/nationalecon_cal.html'));
  assert.ok(dataStatus.calendar.links.some(link=>link.url.includes('bea.gov')));
  let unpublishedNextYear=false,cachedBls=false;
  for(const sourceId of ['bls','bea','census','dol','treasury','treasury-yield-timing']) {
    const source=dataStatus.calendar.sources[sourceId];
    assert.ok(source, `${sourceId} calendar is connected`);
    if(source.status!=='ok') {
      assert.equal(sourceId,'bls','only the explicitly approved BLS calendar access denial may remain cached');
      assert.equal(source.status,'error');
      assert.deepEqual(dataStatus.publicationPolicy,{mode:'allow-cached-bls-calendar',cachedCalendarSources:['bls']});
      const year=Number(easternFields(source.lastAttemptAt).date.slice(0,4));
      assert.ok([year,year+1].some(value=>source.failure?.requestedUrl===`https://www.bls.gov/schedule/${value}/home.htm`));
      assert.deepEqual(source.failure,{kind:'http',status:403,requestedUrl:source.failure.requestedUrl,url:source.failure.requestedUrl,redirected:false});
      assert.match(source.error,/HTTP 403/);
      assert.ok(source.events.length>0,'cached coverage must contain verified dated records');
      assert.ok(Date.parse(source.fetchedAt)<=Date.parse(source.lastAttemptAt));
      assert.equal(source.lastAttemptAt,dataStatus.calendar.checkedAt);
      cachedBls=true;
    }
    assert.match(source.fetchedAt,/^\d{4}-\d{2}-\d{2}T/);
    assert.ok(source.provenance.length>0);
    assert.ok(source.provenance.every(item=>/^[a-f0-9]{64}$/.test(item.sha256)));
    if(source.failedYears?.length) {
      assert.equal(sourceId,'bls','only the unpublished BLS next-year schedule may reduce successful calendar coverage');
      const capturedYear=Number(easternFields(source.fetchedAt).date.slice(0,4));
      assert.deepEqual(source.coveredYears,[capturedYear]);
      assert.deepEqual(source.failedYears,[capturedYear+1]);
      assert.ok(source.warnings.some(warning=>warning.includes(String(capturedYear+1))&&/unavailable/i.test(warning)));
      unpublishedNextYear=true;
    }
  }
  assert.equal(dataStatus.calendar.status,unpublishedNextYear||cachedBls?'partial':'ok','partial coverage requires the explicit unpublished next-year warning or approved BLS access denial');
  const timing=dataStatus.calendar.sources['treasury-yield-timing'];
  assert.deepEqual(timing.events,[],'ongoing availability adds no dated releases');
  assert.equal(timing.timing.availableBy,'18:00');
  assert.equal(timing.timing.delaysPossible,true);
  assert.equal(timing.timing.frequency,'each-trading-day');
  for(const key of ['date','scheduledAt','publishedAt'])assert.equal(Object.hasOwn(timing.timing,key),false);
  assert.equal(new Set(releases.map(event=>event.id)).size,releases.length);
  for(const event of releases) {
    assert.ok(dataStatus.calendar.sources[event.sourceId].events.some(captured=>captured.id===event.id));
    assert.ok(event.seriesIds.every(id=>Object.hasOwn(series,id)));
    if(['fomc','treasury-auctions'].includes(event.sourceId)) {
      assert.equal(event.datePrecision,'day');
      assert.equal(event.time,null);
      assert.equal(event.scheduledAt,null);
      assert.match(event.date,/^\d{4}-\d{2}-\d{2}$/);
    } else assert.match(event.scheduledAt,/^\d{4}-\d{2}-\d{2}T/);
    for(const key of ['actual','consensus','forecast','publishedAt'])assert.equal(Object.hasOwn(event,key),false);
  }
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
    if(id==='yield'||!ids.includes(id)&&!['receipts','outlays','netInterest','publicDebt'].includes(id))continue;
    for(const o of s.observations) {
      if(o.value===null)continue;
      const raw=Number(String(o.sourceValue).replaceAll(',',''));
      let expected=raw;
      if(['debt','publicDebt'].includes(id))expected=raw/(o.sourceUnit==='USD millions'?1e6:1e12);
      else if(['receipts','outlays','netInterest'].includes(id))expected=raw/1e9;
      else if(['openings','claims'].includes(id))expected=raw/1000;
      else if(id==='payroll')expected=raw-Number(o.baseValue);
      else if(['cpi','wages','pce'].includes(id))expected=100*(raw/Number(o.baseValue??o.yearAgoSourceValue)-1);
      else if(id==='retail')expected=100*(raw/Number(o.baseValue)-1);
      assert.ok(Number.isFinite(expected),`${id} ${o.date} source inputs`);
      assert.ok(Math.abs(o.value-expected)<1e-9,`${id} ${o.date} calculation`);
    }
  }
});
test('search recognizes ordinary-language aliases, source names, and codes', () => {
  assert.equal(getSeries('missing'), undefined);
  // Aliases expand the catalog instead of excluding other matching measures.
  const jobs = filterSeries({ query: 'jobs' }).map(s => s.id);
  for (const id of ['claims','payroll','unrate','payrollLevel','underemployment','employmentPopulation','continuedClaims']) assert.ok(jobs.includes(id), id);
  assert.ok(!jobs.includes('housingStarts'));
  const unemployment = filterSeries({ query: 'unemployment' }).map(s => s.id);
  for (const id of ['unrate','claims','continuedClaims','underemployment']) assert.ok(unemployment.includes(id), id);
  assert.ok(filterSeries({ query: 'GDP' }).some((s) => s.id === 'gdp'));
  assert.ok(filterSeries({ query: 'treasury' }).some((s) => s.id === 'yield'));
  assert.ok(filterSeries({ query: 'treasury' }).some((s) => s.id === 'marketableDebt'));
  assert.equal(filterSeries({ query: series.sofr.source.seriesIds[0] })[0]?.id, 'sofr');
  assert.ok(filterSeries({ query: 'debt' }).some((s) => s.id === 'debt'));
  assert.ok(filterSeries({ query: series.cpi.code.toLowerCase() }).some((s) => s.id === 'cpi'));
  assert.ok(filterSeries({ query: 'bureau of labor statistics' }).some((s) => s.id === 'unrate'));
});

test('catalog filters compose topic, frequency, and watchlist without stale results', () => {
  assert.equal(filterSeries().length, Object.keys(registry).length);
  assert.deepEqual(filterSeries({ frequency: 'Quarterly' }).map((s) => s.id).sort(),Object.values(registry).filter(s=>s.frequency==='Quarterly').map(s=>s.id).sort());
  assert.ok(filterSeries({frequency:'Quarterly'}).some(s=>s.id==='gdp'));
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
  assert.equal(periodLabel(series.claims, '2026-10-10'), 'Week ending 10 Oct 2026');
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
  const difference = compareSeries(['cpi', 'unrate'], 'difference', 2);
  assert.equal(difference.error, null);
  assert.equal(difference.panels[0].observations[1].publishedAt, latest(series.cpi).publishedAt);
});

test('indexed panels retain their original post-baseline dates instead of intersecting calendars', () => {
  const monthly=fixture([], {id:'monthly-calendar',comparisonClass:'level',format:'number',unit:'Index',observations:Array.from({length:12},(_,i)=>({date:new Date(Date.UTC(2025,9+i,1)).toISOString().slice(0,10),value:i+1,publishedAt:null}))});
  const quarterly=fixture([], {id:'quarterly-calendar',comparisonClass:'level',format:'number',unit:'Index',frequency:'Quarterly',observations:Array.from({length:12},(_,i)=>({date:new Date(Date.UTC(2023,6+3*i,1)).toISOString().slice(0,10),value:i+1,publishedAt:null}))});
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

test('indexed positive amount comparisons use the earliest common date in the displayed ranges', () => {
  const result = compareSeries(['receipts', 'outlays'], 'indexed', 3);
  assert.equal(result.error, null);
  assert.equal(result.panels.length, 2);
  for (const panel of result.panels) {
    assert.equal(panel.observations[0].date, series.receipts.observations.at(-3).date);
    assert.equal(panel.observations[0].value, 100);
    assert.equal(panel.unit, 'Index (common baseline = 100)');
  }
  const gdpAndCpi = compareSeries(['gdp', 'cpi'], 'indexed', 2);
  assert.deepEqual(gdpAndCpi.panels, []);
  assert.match(gdpAndCpi.error, /growth|index/i);
});

test('indexed eligible level comparison skips missing baselines without filling observations', () => {
  const a = fixture([null, 2, null, 8], { id: 'custom-a', comparisonClass:'level', format:'number', unit:'Index' });
  const b = fixture([1, 4, 6, 8], { id: 'custom-b', comparisonClass:'level', format:'number', unit:'Index' });
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
  assert.equal(row.data_status,expectedCaptureStatus('bls'));
  assert.equal(row.retrieved_at,series.cpi.fetchedAt);
  assert.equal(row.source_series,'CUUR0000SA0');
  assert.match(row.source_url,/api.bls.gov/);
});

test('CSV exports transformed and indexed values exactly as displayed', () => {
  // Synthetic positive-level metadata opts this fixture into ratio indexing.
  // The production percent-rate series now correctly fail the eligibility policy.
  const s = fixture([1, 3, 6], { id: 'csv-fixture', comparisonClass:'level' });
  series[s.id] = s;
  try {
    const change = toCsv([s.id], { range: 1, transform: 'change' });
    assert.ok(change.includes(',2026-03-01,3,Percentage points,'));
    assert.ok(change.includes(',change,test'));
    const indexed = toCsv([s.id], { comparison: 'indexed', range: 2 });
    assert.ok(indexed.includes(',2026-02-01,100,Index (common baseline = 100),'));
    assert.ok(indexed.includes(',2026-03-01,200,Index (common baseline = 100),'));
    assert.ok(indexed.includes(',indexed,test'));
    assert.throws(() => toCsv(['cpi', 'gdp'], { comparison: 'indexed', range: 2 }), /growth|index/i);
  } finally {
    delete series[s.id];
  }
});

test('CSV preserves claims coverage and Census attribution with exact retail calculation inputs', () => {
  const [headers, ...values] = parseCsv(toCsv(['claims', 'retail'], { range: 1 }));
  const rows = values.map(row => Object.fromEntries(headers.map((key, index) => [key, row[index]])));
  const claims = rows.find(row => row.series_id === 'claims');
  const retail = rows.find(row => row.series_id === 'retail');
  const point = latest(series.claims);
  assert.equal(claims.coverage_note, series.claims.coverageNote);
  assert.ok(claims.coverage_note.length > 0);
  assert.equal(claims.date, point.date);
  assert.equal(claims.source_value, point.sourceValue);
  assert.equal(claims.retrieved_at, point.retrievedAt ?? series.claims.fetchedAt);
  assert.equal(claims.source_url, point.sourceUrl ?? series.claims.sourceUrl);
  const receipts = series.claims.inputProvenanceScope === 'observation-source-urls'
    ? series.claims.provenance.filter(receipt => receipt.url === point.sourceUrl && receipt.sha256 === point.sourceSha256 && receipt.retrievedAt === point.retrievedAt)
    : series.claims.provenance;
  assert.ok(receipts.length > 0);
  assert.deepEqual(JSON.parse(claims.capture_provenance_json), receipts);
  assert.match(retail.source, /Census.*Advance Monthly Retail Trade/i);
  assert.equal(retail.source_value, latest(series.retail).sourceValue);
  assert.equal(retail.source_baseline_value, latest(series.retail).baseValue);
  assert.equal(retail.source_baseline_date, latest(series.retail).baseDate);
  assert.equal(Number(retail.value), 100 * (Number(retail.source_value) / Number(retail.source_baseline_value) - 1));
  assert.equal(retail.publication_date, '');
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

test('CSV keeps the BLS required notice on each BLS observation in a mixed-source export', () => {
  const bls = fixture([4.2, 4.3], { id: 'bls-export', agency: 'bls', source: { name: 'Bureau of Labor Statistics', url: 'https://www.bls.gov/' } });
  const bea = fixture([2.1], { id: 'bea-export', agency: 'bea', source: { name: 'Bureau of Economic Analysis', url: 'https://www.bea.gov/' } });
  series[bls.id] = bls;
  series[bea.id] = bea;
  try {
    const [headers, ...rows] = parseCsv(toCsv([bls.id, bea.id]));
    const noticeIndex = headers.indexOf('source_notice');
    assert.ok(noticeIndex >= 0, 'source notice is included in exported provenance');
    assert.deepEqual(rows.filter(row => row[0] === bls.id).map(row => row[noticeIndex]), [
      'BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.',
      'BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.',
    ]);
    assert.equal(rows.find(row => row[0] === bea.id)[noticeIndex], '');
  } finally {
    delete series[bls.id];
    delete series[bea.id];
  }
});

test('calendar transforms use full prior history and report displayed versus retained coverage', () => {
  const s = fixture([], { observations: [
    { date:'2024-12-31', value: 1 }, { date:'2025-12-31', value: 3 },
    { date:'2026-01-01', value: null }, { date:'2026-12-31', value: 6 },
  ] });
  const result = transformSeries(s, 'change', { preset:'1y' });
  assert.deepEqual(result.observations.map(o=>[o.date,o.value]), [['2025-12-31',2],['2026-01-01',null],['2026-12-31',null]]);
  assert.equal(result.error,null);
  assert.equal(result.window.startDate,'2025-12-31');
  assert.deepEqual(result.coverage,{fullStartDate:'2024-12-31',fullEndDate:'2026-12-31',fullCount:4,startDate:'2025-12-31',endDate:'2026-12-31',count:3});
  assert.equal(transformSeries(s,'level').observations.length,4,'default remains twelve observations');
  assert.equal(transformSeries(s,'level',{preset:'custom',startDate:'2026-02-30',endDate:'2026-03-01'}).observations.length,0);
});

test('comparison calendar bounds anchor to the latest selected observation rather than each panel separately', () => {
  const a=fixture([],{id:'shared-window-a',observations:[{date:'2025-06-01',value:1},{date:'2025-12-31',value:2},{date:'2026-12-31',value:3}]});
  const b=fixture([],{id:'shared-window-b',frequency:'Quarterly',observations:[{date:'2025-01-01',value:4},{date:'2025-10-01',value:5},{date:'2026-07-01',value:6}]});
  series[a.id]=a;series[b.id]=b;
  try {
    const result=compareSeries([a.id,b.id],'native',{preset:'1y'});
    assert.equal(result.error,null);
    assert.deepEqual(result.panels.map(p=>p.window.startDate),['2025-12-31','2025-12-31']);
    assert.deepEqual(result.panels[1].observations.map(o=>o.date),['2026-07-01']);
    assert.equal(result.panels[1].coverage.fullCount,3);
    assert.equal(result.panels[1].coverage.count,1);
    const [header,...rows]=parseCsv(toCsv([a.id,b.id],{range:{preset:'1y'},transform:'change'}));
    const values=rows.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]])));
    assert.deepEqual(values.filter(r=>r.series_id===b.id).map(r=>[r.date,Number(r.value)]),[['2026-07-01',1]]);
    assert.ok(values.every(r=>r.window_start_date==='2025-12-31'&&r.window_end_date==='2026-12-31'));
  } finally {delete series[a.id];delete series[b.id];}
});

test('baseline differences admit zero and negative values and retain native units in separate panels', () => {
  const a=fixture([-2,0,null,3],{id:'difference-a',name:'Negative level',format:'billions',unit:'USD billions'});
  const b=fixture([null,0,1,2],{id:'difference-b',name:'Rate'});
  series[a.id]=a;series[b.id]=b;
  try {
    const result=compareSeries([a.id,b.id],'difference',{preset:'all'});
    assert.equal(result.error,null);
    assert.equal(result.panels.length,2);
    assert.deepEqual(result.panels.map(p=>p.baselineDate),['2026-02-01','2026-02-01']);
    assert.deepEqual(result.panels.map(p=>p.baselineValue),[0,0]);
    assert.deepEqual(result.panels[0].observations.map(o=>o.value),[0,null,3]);
    assert.deepEqual(result.panels[1].observations.map(o=>o.value),[0,1,2]);
    assert.deepEqual(result.panels.map(p=>p.unit),['USD billions','Percentage points']);
    assert.ok(result.panels.every(p=>p.formula.includes('baseline')));
    const negativeBaseline=compareSeries([a.id],'difference',{preset:'all'});
    assert.equal(negativeBaseline.panels[0].baselineValue,-2);
    assert.deepEqual(negativeBaseline.panels[0].observations.map(o=>o.value),[0,2,null,5]);
  } finally {delete series[a.id];delete series[b.id];}
});

test('yield baseline differences convert percent to basis points while preserving source dates and CSV formula', () => {
  const s=fixture([4.15,4.18,null],{id:'yield-difference-fixture',changeInBasisPoints:true});
  series[s.id]=s;
  try {
    const range={preset:'custom',startDate:'2026-01-01',endDate:'2026-03-01'};
    const result=compareSeries([s.id],'difference',range);
    assert.equal(result.error,null);
    assert.equal(result.panels[0].unit,'Basis points');
    assert.deepEqual(result.panels[0].observations.map(o=>o.value),[0,3,null]);
    const [header,...values]=parseCsv(toCsv([s.id],{range,comparison:'difference'}));
    const rows=values.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]])));
    assert.deepEqual(rows.map(r=>r.value),['0','3','']);
    assert.ok(rows.every(r=>r.transform==='difference'&&r.comparison_mode==='difference'));
    assert.ok(rows.every(r=>r.comparison_baseline_date==='2026-01-01'&&r.comparison_baseline_value==='4.15'));
    assert.ok(rows.every(r=>r.comparison_formula.includes('100')));
    assert.ok(rows.every(r=>r.index_baseline_date===''),'difference never impersonates ratio indexing');
    assert.deepEqual(rows.map(r=>r.publication_date),s.observations.map(o=>o.publishedAt));
    assert.throws(()=>toCsv([s.id],{range,comparison:'difference',transform:'change'}),/difference.*level|native.*change/i);
  } finally {delete series[s.id];}
});

test('derived comparisons fail without an exact shared finite date and never aggregate source frequencies', () => {
  const a=fixture([],{id:'no-baseline-a',observations:[{date:'2026-01-01',value:0},{date:'2026-02-01',value:null}]});
  const b=fixture([],{id:'no-baseline-b',frequency:'Weekly',observations:[{date:'2026-01-03',value:-2},{date:'2026-02-01',value:3}]});
  series[a.id]=a;series[b.id]=b;
  try {
    const result=compareSeries([a.id,b.id],'difference',{preset:'all'});
    assert.deepEqual(result.panels,[]);
    assert.match(result.error,/common.*finite.*baseline/i);
    assert.throws(()=>toCsv([a.id,b.id],{comparison:'difference',range:{preset:'all'}}),/common.*finite.*baseline/i);
  } finally {delete series[a.id];delete series[b.id];}
});

test('All exposes every retained SOFR date and its CSV matches exact custom-window changes', () => {
  assert.deepEqual(transformSeries(series.sofr,'level',{preset:'all'}).observations,series.sofr.observations);
  assert.ok(series.sofr.observations.length>12);
  const range={preset:'custom',startDate:series.sofr.observations.at(-20).date,endDate:series.sofr.observations.at(-2).date};
  const displayed=transformSeries(series.sofr,'change',range);
  const [headers,...values]=parseCsv(toCsv(['sofr'],{range,transform:'change'}));
  const rows=values.map(row=>Object.fromEntries(headers.map((key,index)=>[key,row[index]])));
  assert.deepEqual(rows.map(r=>[r.date,r.value===''?null:Number(r.value)]),displayed.observations.map(o=>[o.date,o.value]));
  assert.ok(rows.every(r=>r.unit==='Basis points'));
});
