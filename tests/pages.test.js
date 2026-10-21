import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../src/pages.js';
import { escapeHtml, chart } from '../src/ui.js';
import { getSeries, latest, formatValue, transformSeries } from '../src/model.js';
import { releases } from '../src/data.js';

const base = {
  page: 'overview', seriesId: 'unrate', range: 12, transform: 'level', tab: 'data',
  query: '', topic: 'All topics', frequency: 'All frequencies', selected: ['unrate', 'cpi'],
  exploreMode: 'catalog', comparison: 'native', day: 'all', calendarTopic: 'All topics',
  watchOnly: false, eventId: 'cpi', saved: [], density: 'compact',
};
const render = (state = {}) => renderPage({ ...base, ...state });

test('HTML helpers escape untrusted values and expose declarative chart controls', () => {
  assert.equal(escapeHtml('<a title="x">&\'test\'</a>'), '&lt;a title=&quot;x&quot;&gt;&amp;&#39;test&#39;&lt;/a&gt;');
  assert.match(chart(['unrate'], { range: 6, transform: 'change' }), /data-series="unrate"/);
  assert.match(chart(['unrate'], { range: 6, transform: 'change' }), /data-range="6"/);
  assert.match(chart(['unrate'], { range: 6, transform: 'change' }), /data-transform="change"/);
});

test('overview derives headlines and keeps inflation and unemployment in separate charts', () => {
  const html = render();
  const series = getSeries('unrate');
  assert.ok(html.includes(formatValue(series, latest(series).value)));
  assert.match(html, /data-series="cpi"/);
  assert.match(html, /data-series="unrate"/);
  assert.doesNotMatch(html, /data-chart[^>]*data-series="cpi,unrate"/);
  assert.match(html, /data-kind="curve"/);
  assert.match(html, /SYNTHETIC/i);
});

test('indicator data table uses the same transformed observations as its chart', () => {
  const html = render({ page: 'indicator', transform: 'change', range: 6 });
  const transformed = transformSeries(getSeries('unrate'), 'change', 6);
  assert.match(html, /data-transform="change"/);
  assert.match(html, /Percentage points|percentage points|pp/);
  for (const observation of transformed.observations) {
    assert.ok(html.includes(observation.date));
  }
  assert.match(html, /id="transform-select"/);
  assert.match(html, /data-tab="methodology"/);
  assert.match(html, /href="https:\/\//);
});

test('calendar empty filters remove any release preview and keep a clear recovery action', () => {
  const html = render({ page: 'calendar', watchOnly: true, saved: [] });
  assert.match(html, /No releases match/i);
  assert.match(html, /data-reset-calendar/);
  assert.doesNotMatch(html, /class="detail-title"/);
  assert.match(html, /Consensus unavailable/i);
});

test('catalog escapes search input and renders a useful no-results state', () => {
  const html = render({ page: 'explore', query: '"><script>bad</script>' });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&quot;&gt;&lt;script&gt;bad&lt;\/script&gt;/);
  assert.match(html, /No series match/i);
  assert.match(html, /data-reset-filters/);
  assert.match(html, /data-select|data-remove/);
});

test('compare preserves native units in separate panels and handles an empty selection', () => {
  const html = render({ page: 'explore', exploreMode: 'compare' });
  assert.match(html, /data-series="unrate"/);
  assert.match(html, /data-series="cpi"/);
  assert.doesNotMatch(html, /data-chart[^>]*data-series="unrate,cpi"/);
  assert.match(html, /id="comparison-select"/);
  assert.match(render({ page: 'explore', exploreMode: 'compare', selected: [] }), /No series selected/i);
});

test('indexed comparisons describe their shared baseline and export units accurately', () => {
  const html = render({ page: 'explore', exploreMode: 'compare', comparison: 'indexed' });
  assert.match(html, /shared starting date/i);
  assert.match(html, /original observation dates thereafter/i);
  assert.match(html, /UNITS <b class="mono">INDEXED/);
  assert.doesNotMatch(html, /retain each series’ native units/i);
});

test('calendar replaces an excluded selected release with a matching preview', () => {
  const selected = releases[0];
  const matching = releases.find(event => event.date !== selected.date);
  assert.ok(matching, 'fixture contains multiple release days');
  const html = render({ page: 'calendar', eventId: selected.id, day: matching.date });
  const title = html.match(/class="detail-title">([^<]*)/)[1];
  assert.equal(title, matching.name);
  assert.doesNotMatch(html, new RegExp(`data-event="${selected.id}"`));
});
