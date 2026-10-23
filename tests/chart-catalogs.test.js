import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCharts } from '../src/charts.js';
import { series } from '../src/data.js';

// Keep the real chart/model/cursor pipeline; substitute only browser elements.
class Element {
  constructor(tag) { this.tag=tag; this.attributes={}; this.children=[]; this.listeners={}; }
  setAttribute(name,value) { this.attributes[name]=String(value); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children=children; }
  addEventListener(name,handler) { this.listeners[name]=handler; }
  set textContent(value) { this.children=[String(value)]; }
  get textContent() { return this.children.map(child=>typeof child==='string'?child:child.textContent).join(''); }
}
const nodes=element=>[element,...element.children.filter(child=>typeof child!=='string').flatMap(nodes)];
const ratio=(id,values)=>({
  ...series.debt,id,name:'Current-account-to-GDP ratio',short:'CA / GDP',frequency:'Quarterly',
  comparisonClass:'rate',format:'percent',precision:2,unit:'Percent of GDP',
  observations:values.map(([date,value])=>({date,value})),
});
const capturedRatio=ratio('currentAccountToGdp',[
  ['2025-01-01',-2],['2025-04-01',null],['2025-07-01',-3],['2025-10-01',-4],
]);
function withCharts(datasets,options,run) {
  const originalDocument=globalThis.document;
  globalThis.document={createElementNS:(_ns,tag)=>new Element(tag),createElement:tag=>new Element(tag)};
  try {
    const containers=datasets.map(dataset=>{
      const container=new Element('div'); container.clientWidth=374;
      container.dataset={series:'currentAccountToGdp',range:'{"preset":"all"}',...dataset};
      return container;
    });
    renderCharts({querySelectorAll:()=>containers},options);
    run(containers);
  } finally {
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  }
}
const readout=container=>nodes(container).find(node=>node.tag==='div'&&node.className?.startsWith('chart-readout'));
const svg=container=>nodes(container).find(node=>node.tag==='svg');
const key=(container,value)=>svg(container).listeners.keydown({key:value,preventDefault(){}});

test('scoped chart catalogs use supplied calculated values, evidence labels, keyboard readouts and null gaps',()=>{
  for(const catalogKey of ['current-account-gdp-history','another-calculated-history']) {
    withCharts([{chartCatalog:catalogKey}],{
      catalog:{currentAccountToGdp:ratio('currentAccountToGdp',[['2025-01-01',999]])},
      chartCatalogs:{[catalogKey]:{catalog:{currentAccountToGdp:capturedRatio},evidenceLabel:'Calculated from official BEA observations'}},
    },([container])=>{
      assert.match(readout(container).textContent,/-4\.00%/);
      assert.match(svg(container).attributes['aria-label'],/Calculated from official BEA observations/);
      assert.match(nodes(svg(container)).find(node=>node.tag==='title').textContent,/Calculated from official BEA observations/);
      assert.doesNotMatch(svg(container).attributes['aria-label'],/Frozen research snapshot|Official snapshot/);
      const path=nodes(container).find(node=>node.tag==='path').attributes.d;
      assert.equal((path.match(/M/g)??[]).length,2,'a missing quarter must break the line');
      key(container,'Home'); assert.match(readout(container).textContent,/Q1 2025.*-2\.00%/);
      key(container,'ArrowRight'); assert.match(readout(container).textContent,/Q2 2025.*—.*source value unavailable/);
      assert.match(svg(container).attributes['aria-label'],/Calculated from official BEA observations/);
    });
  }
});

test('scoped comparisons derive from the supplied catalog rather than the surrounding frozen catalog',()=>{
  withCharts([{chartCatalog:'current-account-gdp-history',comparison:'difference',panelId:'currentAccountToGdp'}],{
    catalog:{currentAccountToGdp:ratio('currentAccountToGdp',[['2025-01-01',10],['2025-10-01',20]])},
    chartCatalogs:{'current-account-gdp-history':{catalog:{currentAccountToGdp:capturedRatio},evidenceLabel:'Calculated ratio'}},
  },([container])=>{
    assert.match(readout(container).textContent,/-2\.00 Percentage points/);
    key(container,'Home'); assert.match(readout(container).textContent,/0\.00 Percentage points/);
  });
});

test('unbound scoped charts fail closed even when live or surrounding catalogs contain the requested series',()=>{
  const binding={catalog:{},evidenceLabel:'Calculated ratio'};
  for(const options of [
    {},
    {catalog:{debt:series.debt}},
    {catalog:{debt:series.debt},chartCatalogs:{'missing-history':binding}},
    {catalog:{debt:series.debt},chartCatalogs:{'missing-history':{catalog:{debt:series.debt}}}},
    {catalog:{debt:series.debt},chartCatalogs:Object.create({'missing-history':{catalog:{debt:series.debt},evidenceLabel:'Inherited'}})},
    {catalog:{debt:series.debt},chartCatalogs:{'missing-history':{catalog:Object.create({debt:series.debt}),evidenceLabel:'Calculated ratio'}}},
  ]) {
    withCharts([{chartCatalog:'missing-history',series:'debt'}],options,([container])=>{
      assert.equal(svg(container),undefined,'a scoped chart must not silently draw live or unrelated frozen observations');
      assert.match(container.textContent,/unavailable/i);
    });
  }
});

test('a scoped chart with no requested series shows an unavailable state rather than throwing',()=>{
  withCharts([{chartCatalog:'current-account-gdp-history',series:undefined}],{
    chartCatalogs:{'current-account-gdp-history':{catalog:{currentAccountToGdp:capturedRatio},evidenceLabel:'Calculated ratio'}},
  },([container])=>{
    assert.equal(Boolean(svg(container)),false);
    assert.match(container.textContent,/unavailable/i);
  });
});

test('unscoped charts retain their live and frozen catalog lookup and evidence labels',()=>{
  const id='chart-legacy-catalog-fixture';
  series[id]=ratio(id,[['2025-01-01',4.5]]);
  try {
    for(const [options,value,evidence] of [
      [{},'4.50%','Official snapshot'],
      [{catalog:{[id]:ratio(id,[['2025-01-01',8.75]])}},'8.75%','Frozen research snapshot'],
    ]) {
      withCharts([{series:id}],options,([container])=>{
        assert.ok(readout(container).textContent.includes(value));
        assert.ok(svg(container).attributes['aria-label'].includes(evidence));
        key(container,'Home'); assert.ok(svg(container).attributes['aria-label'].includes(evidence));
      });
    }
  } finally { delete series[id]; }
});

test('scoped catalogs never borrow live yield curves and do not share cursors with other catalogs',()=>{
  const chartCatalogs={'current-account-gdp-history':{catalog:{currentAccountToGdp:capturedRatio},evidenceLabel:'Calculated ratio'}};
  for(const kind of ['curve','history-curve']) {
    withCharts([{chartCatalog:'current-account-gdp-history',kind,dates:'2025-01-01'}],{chartCatalogs},([container])=>{
      assert.equal(Boolean(svg(container)),false);
      assert.match(container.textContent,/unavailable/i);
    });
  }
  withCharts([
    {cursorGroup:'same-label'},
    {chartCatalog:'current-account-gdp-history',cursorGroup:'same-label'},
  ],{
    catalog:{currentAccountToGdp:ratio('currentAccountToGdp',[['2024-01-01',1],['2024-04-01',2]])},chartCatalogs,
  },([legacy,scoped])=>{
    assert.match(readout(legacy).textContent,/Q2 2024.*2\.00%/);
    assert.match(readout(scoped).textContent,/Q4 2025.*-4\.00%/);
    key(scoped,'Home'); assert.match(readout(scoped).textContent,/Q1 2025.*-2\.00%/);
    assert.match(readout(legacy).textContent,/Q2 2024.*2\.00%/);
  });
});
