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
function withRenderedCharts(range, comparison, run, {linked=false,transform='level',frozen=false,width=374,height=180,valueScale=1,unit=series.debt.unit}={}) {
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
    ...series.debt, id, name: id, short: id, comparisonClass: 'amount', frequency, unit,
    observations: observations.map(([date, value]) => ({ date, value:value*valueScale })),
  });
  series[ids[0]] = fixture(ids[0], [['2026-01-01', 1], ['2026-02-01', 2], ['2026-04-01', 4]], 'Daily');
  series[ids[1]] = fixture(ids[1], [['2026-02-01', 5], ['2026-03-01', 6]], 'Monthly');
  const originalDocument = globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new Element(tag), createElement: tag => new Element(tag) };
  try {
    const containers = (comparison === 'indexed' ? [null] : ids).map(panelId => {
      const container = new Element('div');
      container.clientWidth = width;
      container.dataset = { series: ids.join(','), range: JSON.stringify(range), comparison,transform,height:String(height), ...(panelId ? { panelId } : {}),...(linked?{cursorGroup:'comparison'}:{}) };
      return container;
    });
    renderCharts({ querySelectorAll: () => containers },frozen?{catalog:series}:{});
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

test('narrow chart panels use their actual width and only endpoint date labels without scaling text down',()=>{
 withRenderedCharts({preset:'all'},'native',({containers,nodes})=>{
  for(const container of containers){
   const svg=nodes(container).find(node=>node.tag==='svg');
   assert.equal(svg.attributes.viewBox,'0 0 232 180');
   const dates=nodes(container).filter(node=>node.tag==='text'&&Number(node.attributes.y)===172);
   assert.equal(dates.length,2);assert.equal(dates[0].textContent,'1 Jan 2026');assert.equal(dates[1].textContent,'1 Apr 2026');
  }
 },{width:232});
});

test('large positive and negative axis readings fit inside narrow and wide SVGs without consuming the plot',()=>{
 for(const width of [210,232,390,1280])for(const valueScale of [10000.123,-25000.123,1e12,-1e12]){
  withRenderedCharts({preset:'all'},'native',({containers,nodes,paths})=>{
   for(const [index,container]of containers.entries()){
    const rendered=nodes(container),svg=rendered.find(node=>node.tag==='svg'),ticks=rendered.filter(node=>node.tag==='text'&&node.attributes['text-anchor']==='end'&&Number(node.attributes.y)<170);
    assert.equal(svg.attributes.viewBox,`0 0 ${width} 180`);
    assert.equal(ticks.length,4);
    for(const tick of ticks)assert.ok(Number(tick.attributes.x)-tick.textContent.length*6.6>=4,`${tick.textContent} must fit within the SVG at ${width}px`);
    assert.ok(paths[index].width>=100,'The smallest chart retains at least 100px for observations.');
    for(const x of paths[index].xs)assert.ok(x>=paths[index].left-.01&&x<=paths[index].left+paths[index].width+.01);
    svg.listeners.keydown({key:'Home',preventDefault(){}});
    const guide=rendered.find(node=>node.attributes.class==='guide');
    assert.ok(Number(guide.attributes.x1)>=paths[index].left);
    assert.ok(Number(guide.attributes.x1)<=paths[index].left+paths[index].width);
    assert.match(container.children.find(node=>node.tag==='div').textContent,index?/^Feb 2026/:/^1 Jan 2026/);
   }
  },{width,valueScale});
 }
});

test('ordinary short axis readings retain the existing 54px plot margin',()=>{
 withRenderedCharts({preset:'all'},'native',({paths})=>{
  for(const path of paths)assert.equal(path.left,54);
 },{width:210});
});

test('long unit descriptions wrap above the plot without losing their exact text or reducing font size',()=>{
 const unit='USD billions per quarter (not annualized)';
 for(const width of [210,232,320,390,1280]){
  withRenderedCharts({preset:'all'},'native',({containers,nodes})=>{
   for(const container of containers){
    const rendered=nodes(container),label=rendered.find(node=>node.tag==='text'&&node.textContent===unit),lines=label.children.filter(node=>node.tag==='tspan'),hit=rendered.find(node=>node.tag==='rect'&&node.attributes.fill==='transparent');
    assert.ok(label,'The complete original unit remains visible SVG text.');
    assert.equal(label.attributes['font-size'],undefined);
    if(width<=320)assert.ok(lines.length>1,'Narrow charts need multiple unit lines.');
    const visibleLines=lines.length?lines:[label];
    for(const line of visibleLines)assert.ok(Number(line.attributes.x)+line.textContent.length*6.6<=width-20,`${line.textContent} must fit at ${width}px`);
    assert.ok(Number(hit.attributes.y)>=Math.max(...visibleLines.map(line=>Number(line.attributes.y)))+14,'The plot starts below every unit line.');
    assert.ok(Number(hit.attributes.height)>=60,'Even a 120px requested chart keeps a usable plot below wrapped units.');
    assert.match(rendered.find(node=>node.tag==='title').textContent,/USD billions per quarter \(not annualized\)/);
   }
  },{width,unit,height:120});
 }
});

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

test('linked SVG comparison keyboard updates every exact-date readout and never borrows a monthly value',()=>{
 withRenderedCharts({preset:'all'},'native',({containers,nodes})=>{
  const svg=nodes(containers[0]).find(node=>node.tag==='svg');
  const readout=container=>container.children.find(node=>node.tag==='div').textContent;
  svg.listeners.keydown({key:'Home',preventDefault(){}});
  assert.match(readout(containers[0]),/^1 Jan 2026/);
  assert.match(readout(containers[1]),/—.*no observation on this reference date/);
  svg.listeners.keydown({key:'ArrowRight',preventDefault(){}});
  assert.match(readout(containers[1]),/^Feb 2026/);
  assert.match(readout(containers[1]),/5/);
  svg.listeners.keydown({key:'End',preventDefault(){}});
  assert.match(readout(containers[1]),/^Apr 2026/);
  assert.match(readout(containers[1]),/—/);
 },{linked:true});
});

test('frozen native panel charts apply captured period-change transforms before drawing',()=>{
 withRenderedCharts({preset:'all'},'native',({containers,nodes})=>{
  const readout=containers[0].children.find(node=>node.tag==='div');
  assert.match(nodes(readout).find(node=>node.tag==='strong').textContent,/^2\.00 /);
 },{transform:'change'});
});

test('frozen SVG labels retain their evidence classification during keyboard interaction',()=>{
 withRenderedCharts({preset:'all'},'native',({containers,nodes})=>{
  const svg=nodes(containers[0]).find(node=>node.tag==='svg');
  assert.match(svg.attributes['aria-label'],/Frozen research snapshot/);
  assert.match(nodes(svg).find(node=>node.tag==='title').textContent,/Frozen research snapshot/);
  svg.listeners.keydown({key:'Home',preventDefault(){}});
  assert.match(svg.attributes['aria-label'],/Frozen research snapshot/);
  assert.doesNotMatch(svg.attributes['aria-label'],/Official snapshot/);
 },{frozen:true});
});
