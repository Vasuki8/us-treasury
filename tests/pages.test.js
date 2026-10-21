import test from 'node:test';
import assert from 'node:assert/strict';
import { renderPage } from '../src/pages.js';
import * as ui from '../src/ui.js';
import { escapeHtml, chart } from '../src/ui.js';
import { getSeries, latest, formatValue, transformSeries } from '../src/model.js';
import { releases, yieldCurve } from '../src/data.js';
import { renderCharts } from '../src/charts.js';

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
  assert.ok(html.includes(formatValue(series, latest(series)?.value)));
  assert.match(html, /data-series="cpi"/);
  assert.match(html, /data-series="unrate"/);
  assert.doesNotMatch(html, /data-chart[^>]*data-series="cpi,unrate"/);
  assert.match(html, /data-kind="curve"/);
  assert.match(html, /OFFICIAL SNAPSHOT/);
  assert.doesNotMatch(html, /synthetic|sample week|sample observations/i);
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
  assert.match(html, /No (verified )?releases (have been ingested|match)/i);
  assert.match(html, /data-reset-calendar/);
  assert.doesNotMatch(html, /class="detail-title"/);
  assert.match(html, /bls\.gov[^\"]*schedule/);
  assert.match(html, /bea\.gov[^\"]*schedule/);
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

test('an unconnected calendar has no invented release results or fixed displayed week', () => {
  const saved = releases.splice(0);
  try {
    const html = render({ page: 'calendar' });
    assert.match(html, /No verified releases have been ingested/i);
    assert.match(html, /official release schedules/i);
    assert.doesNotMatch(html, /2026-10-19|October 19|ACTUAL|CONSENSUS|PRIOR REVISED|class="detail-title"/);
    assert.match(html, /data-reset-calendar/);
  } finally { releases.push(...saved); }
});

test('indicator preserves unknown publication dates and exposes official retrieval and calculation metadata', () => {
  const current = getSeries('unrate');
  const saved = { ...current };
  Object.assign(current, {
    dataStatus: 'official', fetchedAt: '2026-10-21T16:00:00Z', error: null,
    calculation: 'Official unemployment rate, unchanged.', publicationNote: 'Historical publication dates are not supplied by this feed.',
    source: { name: 'Bureau of Labor Statistics', url: 'https://www.bls.gov/', seriesIds: ['LNS14000000'] },
    observations: [{ date: '2025-01-01', value: 4.0, publishedAt: null, footnotes: ['Preliminary <estimate>'] }], revisions: [],
  });
  try {
    const html = render({ page: 'indicator' });
    assert.match(html, /2026-10-21T16:00:00Z/);
    assert.match(html, /LNS14000000/);
    assert.match(html, /Preliminary &lt;estimate&gt;/);
    assert.match(html, /publication dates are not supplied/i);
    assert.doesNotMatch(html, /2025-02-02/);
    const methodology = render({ page: 'indicator', tab: 'methodology' });
    assert.match(methodology, /Official unemployment rate, unchanged\./);
    assert.match(render({ page: 'indicator', tab: 'revisions' }), /No revision history (has been )?captured/i);
  } finally { Object.assign(current, saved); }
});

test('unavailable indicators show missing values and the source explanation', () => {
  const current = getSeries('claims');
  const saved = { ...current };
  Object.assign(current, { dataStatus: 'unavailable', fetchedAt: null, error: 'DOL is outside the configured agency coverage.', observations: [], revisions: [] });
  try {
    const html = render({ page: 'indicator', seriesId: 'claims' });
    assert.match(html, /Unavailable/);
    assert.match(html, /DOL is outside the configured agency coverage\./);
    assert.match(html, /big-value">—</);
    assert.match(html, /No observations available/);
    assert.doesNotMatch(html, /OFFICIAL SNAPSHOT<\/span><\/div>/);
  } finally { Object.assign(current, saved); }
});

test('missing current Treasury tenors cannot produce a numeric spread', () => {
  const point = yieldCurve.find(item => item.years === 2);
  const saved = point.value;
  point.value = null;
  try { assert.match(render(), /10Y–2Y <strong class="amber">—<\/strong>/); }
  finally { point.value = saved; }
});

test('source status distinguishes cached retrievals from a failed refresh attempt', () => {
  const html = ui.sourceStatusList({
    bls: { status: 'error', fetchedAt: '2026-10-20T12:00:00Z', lastAttemptAt: '2026-10-21T16:00:00Z', error: 'HTTP 503', warnings: [] },
    bea: { status: 'unavailable', fetchedAt: null, lastAttemptAt: '2026-10-21T16:00:00Z', error: 'No response', warnings: [] },
  });
  assert.match(html, /BLS/);
  assert.match(html, /cached/i);
  assert.match(html, /2026-10-20T12:00:00Z/);
  assert.match(html, /2026-10-21T16:00:00Z/);
  assert.match(html, /HTTP 503/);
  assert.match(html, /unavailable/i);
});

test('global source notice credits agencies and ties the BLS disclaimer to the retained retrieval', () => {
  assert.equal(typeof ui.sourceNotice, 'function', 'source notice renderer is available');
  const html = ui.sourceNotice({
    bls: { status: 'error', fetchedAt: '2026-10-20T12:00:00Z', lastAttemptAt: '2026-10-21T16:00:00Z' },
  });
  assert.ok(html.includes('BLS.gov cannot vouch for the data or analyses derived from these data after the data have been retrieved from BLS.gov.'));
  assert.match(html, /datetime="2026-10-20T12:00:00Z"/);
  assert.doesNotMatch(html, /2026-10-21T16:00:00Z/);
  assert.match(html, /href="https:\/\/www\.bls\.gov\/developers\/termsOfService\.htm"/);
  assert.match(html, /U\.S\. Treasury/);
  assert.match(html, /Bureau of Labor Statistics/);
  assert.match(html, /Bureau of Economic Analysis/);
  assert.match(html, /Department of Labor/);
  assert.match(html, /Employment and Training Administration/);
  assert.match(html, /U\.S\. Census Bureau/);
  assert.match(html, /Advance Monthly Retail Trade Survey/);
  assert.match(html, /independent site/i);
  assert.match(html, /not endorsed/i);
});

test('historical claims coverage stays visible on headline, monitor, catalog and detail views', () => {
  const current = getSeries('claims');
  const saved = { ...current };
  Object.assign(current, {
    dataStatus: 'official', error: null,
    coverageNote: 'Historical feed <may lag> the latest advance release.',
    observations: [{ date: '2026-09-19', value: 225, publishedAt: null }],
  });
  try {
    for (const html of [ui.metrics(['claims']), ui.seriesTable(['claims']), render({ page: 'explore', query: 'claims' })]) {
      assert.match(html, /Historical feed/i);
      assert.match(html, /&lt;may lag&gt;/);
      assert.doesNotMatch(html, /<may lag>/);
    }
    const detail = render({ page: 'indicator', seriesId: 'claims' });
    assert.match(detail, /Historical feed &lt;may lag&gt; the latest advance release\./);
    assert.match(detail, /Week ending 19 Sep 2026/);
    assert.match(render({ page: 'indicator', seriesId: 'claims', tab: 'methodology' }), /<strong>Coverage\.<\/strong> Historical feed &lt;may lag&gt;/);
    assert.doesNotMatch(render({ page: 'labor' }), /DOL claims are unavailable/);
  } finally { Object.assign(current, saved); }
});

test('source warnings and historical coverage remain escaped in compact and expanded source status', () => {
  const sources = { dol: { status: 'ok', fetchedAt: '2026-10-21T12:00:00Z', coverageNote: 'Historical <feed>', warnings: ['Advance release <newer>'] } };
  for (const compact of [false, true]) {
    const html = ui.sourceStatusList(sources, { compact });
    assert.match(html, /DOL ETA/);
    assert.match(html, /Historical &lt;feed&gt;/);
    assert.match(html, /Advance release &lt;newer&gt;/);
    assert.doesNotMatch(html, /<feed>|<newer>/);
  }
});

test('compact source warnings are closed disclosures while coverage and refresh failures stay visible', () => {
  const source = { status: 'error', fetchedAt: '2026-10-21T12:00:00Z', error: 'HTTP 503', coverageNote: 'Historical feed through September.', warnings: ['First <note>', 'Second note'] };
  const compact = ui.sourceStatusList({ dol: source }, { compact: true });
  assert.match(compact, /<details[^>]*><summary>Source notes \(2\)<\/summary><p class="muted">First &lt;note&gt;<\/p><p class="muted">Second note<\/p><\/details>/);
  assert.doesNotMatch(compact, /<details[^>]*\bopen\b/);
  const visible = compact.replace(/<details[\s\S]*?<\/details>/g, '');
  assert.match(visible, /Historical feed through September\./);
  assert.match(visible, /HTTP 503/);
  const expanded = ui.sourceStatusList({ dol: source });
  assert.doesNotMatch(expanded, /<details/);
  assert.match(expanded, /First &lt;note&gt;/);
  assert.doesNotMatch(ui.sourceStatusList({ census: { status: 'ok' } }, { compact: true }), /<details/);
});

test('source notice does not invent a retrieval timestamp when BLS is unavailable', () => {
  assert.equal(typeof ui.sourceNotice, 'function', 'source notice renderer is available');
  const html = ui.sourceNotice({ bls: { status: 'unavailable', fetchedAt: null } });
  assert.match(html, /BLS retrieval unavailable/);
  assert.doesNotMatch(html, /<time/);
  const escaped = ui.sourceNotice({ bls: { fetchedAt: '<script>unsafe</script>' } });
  assert.doesNotMatch(escaped, /<script>/);
});

// A small DOM boundary keeps the real SVG renderer and interaction handlers in use.
function withChartDocument(run) {
  class Element {
    constructor(tag) { this.tag = tag; this.attributes = {}; this.children = []; this.listeners = {}; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    set textContent(value) { this.children = [String(value)]; }
    get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  }
  const saved = globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new Element(tag), createElement: tag => new Element(tag) };
  const nodes = element => [element, ...element.children.filter(child => typeof child !== 'string').flatMap(nodes)];
  try { run({ Element, nodes }); }
  finally { if (saved === undefined) delete globalThis.document; else globalThis.document = saved; }
}

test('a narrow official curve retains all tenor labels and hides a missing selected value', () => {
  const point = yieldCurve.find(item => item.years === 2);
  const saved = point.value;
  point.value = null;
  try {
    withChartDocument(({ Element, nodes }) => {
      const container = new Element('div');
      container.clientWidth = 300;
      container.dataset = { kind: 'curve', height: '254' };
      renderCharts({ querySelectorAll: () => [container] });
      const rendered = nodes(container);
      const svg = rendered.find(node => node.tag === 'svg');
      assert.match(svg.attributes['aria-label'], /Official snapshot/);
      const labels = rendered.filter(node => node.tag === 'text' && yieldCurve.some(item => item.tenor === node.textContent));
      assert.equal(labels.length, yieldCurve.length);
      for (const row of new Set(labels.map(node => node.attributes.y))) {
        const bounds = labels.filter(node => node.attributes.y === row).map(node => {
          const x = Number(node.attributes.x), width = node.textContent.length * 7;
          return { left: x - (node.attributes['text-anchor'] === 'end' ? width : node.attributes['text-anchor'] === 'middle' ? width / 2 : 0), width };
        });
        for (let index = 1; index < bounds.length; index++) assert.ok(bounds[index].left >= bounds[index - 1].left + bounds[index - 1].width, 'tenor labels must not overlap');
      }
      const index = yieldCurve.indexOf(point);
      svg.listeners.keydown({ key: 'Home', preventDefault() {} });
      for (let step = 0; step < index; step++) svg.listeners.keydown({ key: 'ArrowRight', preventDefault() {} });
      const dots = nodes(container).filter(node => node.tag === 'circle');
      assert.equal(dots[0].attributes.visibility, 'hidden');
      assert.match(container.textContent, /Latest \([^)]*\) —/);
      assert.doesNotMatch(container.textContent, /Synthetic/);
    });
  } finally { point.value = saved; }
});
