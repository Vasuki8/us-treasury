import test from 'node:test';
import assert from 'node:assert/strict';
import { chartDateLabel, renderCharts, readChartRange } from '../src/charts.js';
import { getSeries } from '../src/model.js';
import { series } from '../src/data.js';

test('chart range decoding preserves calendar descriptors and fails closed on malformed attributes',()=>{
  assert.equal(readChartRange('6'),6);assert.equal(readChartRange(undefined),12);
  assert.deepEqual(readChartRange('{"preset":"custom","startDate":"2026-09-01","endDate":"2026-09-30"}'),{preset:'custom',startDate:'2026-09-01',endDate:'2026-09-30'});
  for(const value of ['oops','null','[]','"all"'])assert.equal(readChartRange(value).startDate,'invalid');
});

test('mixed-frequency chart dates keep the exact date regardless of series order', () => {
  const panels = ['gdp','cpi'].map(id=>({series:getSeries(id)}));
  assert.equal(chartDateLabel(panels,'2026-09-01'),'1 Sep 2026');
  assert.equal(chartDateLabel([...panels].reverse(),'2026-09-01'),'1 Sep 2026');
  assert.equal(chartDateLabel([panels[0]],'2026-04-01'),'Q2 2026');
});

test('weekly chart readouts identify the week-ending date', () => {
  assert.equal(chartDateLabel([{series:getSeries('claims')}], '2026-09-19'), 'Week ending 19 Sep 2026');
});

// Exercise the real SVG renderer; only the browser's element boundary is replaced.
function withRenderedCharts(range, comparison, run) {
  class Element {
    constructor(tag) { this.tag = tag; this.attributes = {}; this.children = []; this.listeners = {}; }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    set textContent(value) { this.children = [String(value)]; }
    get textContent() { return this.children.map(child => typeof child === 'string' ? child : child.textContent).join(''); }
  }
  const nodes = element => [element, ...element.children.filter(child => typeof child !== 'string').flatMap(nodes)];
  const ids = ['chart-long', 'chart-short'];
  const fixture = (id, observations, frequency) => ({
    ...series.debt, id, name: id, short: id, comparisonClass: 'amount', frequency,
    observations: observations.map(([date, value]) => ({ date, value })),
  });
  series[ids[0]] = fixture(ids[0], [['2026-01-01', 1], ['2026-02-01', 2], ['2026-04-01', 4]], 'Daily');
  series[ids[1]] = fixture(ids[1], [['2026-02-01', 5], ['2026-03-01', 6]], 'Monthly');
  const originalDocument = globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new Element(tag), createElement: tag => new Element(tag) };
  try {
    const containers = (comparison === 'indexed' ? [null] : ids).map(panelId => {
      const container = new Element('div');
      container.clientWidth = 374;
      container.dataset = { series: ids.join(','), range: JSON.stringify(range), comparison, ...(panelId ? { panelId } : {}) };
      return container;
    });
    renderCharts({ querySelectorAll: () => containers });
    const paths = containers.flatMap(container => {
      const rendered = nodes(container), grid = rendered.find(node => node.attributes.class === 'gridline');
      const left = Number(grid.attributes.x1), width = Number(grid.attributes.x2) - left;
      return rendered.filter(node => node.tag === 'path').map(node => ({
        xs: [...node.attributes.d.matchAll(/[ML]([\d.]+) /g)].map(match => Number(match[1])), left, width,
      }));
    });
    run({ containers, nodes, paths });
  } finally {
    delete series[ids[0]]; delete series[ids[1]];
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
}

test('calendar panels align exact shared dates and leave shorter source coverage inside the requested extent', () => {
  for (const [range, fractions, firstLabel] of [
    [{ preset: 'all' }, [31 / 90, 59 / 90], '1 Jan 2026'],
    [{ preset: 'custom', startDate: '2026-01-01', endDate: '2026-04-01' }, [31 / 90, 59 / 90], '1 Jan 2026'],
    [{ preset: '1y' }, [306 / 365, 334 / 365], '1 Apr 2025'],
  ]) {
    withRenderedCharts(range, 'native', ({ paths, containers, nodes }) => {
      const [daily, monthly] = paths;
      assert.equal(monthly.xs[0], daily.xs[1], '1 February must have the same x position in both panels');
      // January has 31 days, February 28: 1 February/1 March lie 31/59 days into this 90-day window.
      for (const [index, fraction] of fractions.entries()) {
        assert.ok(Math.abs((monthly.xs[index] - monthly.left) / monthly.width - fraction) < 0.00002);
      }
      for (const container of containers) {
        const labels = nodes(container).filter(node => node.tag === 'text').map(node => node.textContent);
        assert.ok(labels.includes(firstLabel));
        assert.ok(labels.includes('1 Apr 2026'), 'every panel labels the same exact calendar boundaries');
      }
      const svg = nodes(containers[1]).find(node => node.tag === 'svg');
      const readout = containers[1].children.find(node => node.tag === 'div');
      svg.listeners.keydown({ key: 'Home', preventDefault() {} });
      assert.match(readout.textContent, /^Feb 2026/);
      svg.listeners.keydown({ key: 'End', preventDefault() {} });
      assert.match(readout.textContent, /^Mar 2026/, 'axis bounds must not become fabricated selectable observations');
    });
  }
});

test('calendar difference and indexed charts keep the requested extent before their later shared baseline', () => {
  for (const comparison of ['difference', 'indexed']) {
    withRenderedCharts({ preset: 'all' }, comparison, ({ paths }) => {
      for (const path of paths) {
        assert.ok(Math.abs((path.xs[0] - path.left) / path.width - 31 / 90) < 0.00002,
          `${comparison} baseline on 1 February must leave January empty`);
      }
      assert.equal(paths[0].xs[0], paths[1].xs[0]);
    });
  }
});

test('explicit observation windows retain each panel\'s own observation extent', () => {
  withRenderedCharts(12, 'native', ({ paths }) => {
    const [daily, monthly] = paths;
    assert.equal(monthly.xs[0], monthly.left);
    assert.equal(monthly.xs.at(-1), monthly.left + monthly.width);
    assert.notEqual(monthly.xs[0], daily.xs[1], 'OBS panels intentionally use their independent retained date extents');
  });
});
