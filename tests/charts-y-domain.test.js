import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCharts } from '../src/charts.js';
import { series } from '../src/data.js';

// Retain the chart, date-window and cursor code; replace only DOM primitives.
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
const svg=container=>nodes(container).find(node=>node.tag==='svg');
const paths=container=>nodes(container).filter(node=>node.tag==='path').map(node=>node.attributes.d);
const ys=path=>[...path.matchAll(/[ML][\d.]+ ([\d.]+)/g)].map(match=>Number(match[1]));
const ticks=container=>nodes(container).filter(node=>node.tag==='text'&&node.attributes.x==='46').map(node=>({label:node.textContent,y:node.attributes.y}));
const fixture=(id,values)=>({
  ...series.debt,id,name:id,short:id,frequency:'Quarterly',comparisonClass:'rate',
  format:'percentagePoints',precision:3,unit:'Percentage points',
  observations:values.map((value,index)=>({date:['2026-01-01','2026-04-01','2026-07-01'][index],value})),
});
function withCharts(datasets,run,{a=[-2,null,1],b=[1,4,0]}={}) {
  const originalDocument=globalThis.document;
  globalThis.document={createElementNS:(_ns,tag)=>new Element(tag),createElement:tag=>new Element(tag)};
  try {
    const catalog={a:fixture('a',a),b:fixture('b',b)};
    const containers=datasets.map((dataset,index)=>{
      const container=new Element('div'); container.clientWidth=374;
      container.dataset={series:index?'b':'a',range:'{"preset":"all"}',...dataset};
      return container;
    });
    renderCharts({querySelectorAll:()=>containers},{catalog});
    run(containers);
  } finally {
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  }
}

test('explicit raw shared domains produce identical ticks and value coordinates with padding applied once',()=>{
  withCharts([{yDomain:'[-2,4]'},{yDomain:'[-2,4]'}],([a,b])=>{
    assert.deepEqual(ticks(a),ticks(b));
    assert.deepEqual(ticks(a).map(tick=>tick.label),['-2.8','-0.3','2.3','4.8']);
    assert.equal(ys(paths(a)[0]).at(-1),ys(paths(b)[0])[0],'the same percentage-point value has the same height');
    const expectedY=28+(4.78-1)/7.56*122;
    assert.ok(Math.abs(ys(paths(a)[0]).at(-1)-expectedY)<0.005);
    assert.equal((paths(a)[0].match(/M/g)??[]).length,2,'missing quarters remain line gaps');
    for(const container of [a,b]) {
      const zero=nodes(container).find(node=>node.tag==='line'&&node.attributes.class==='zero-reference');
      assert.ok(zero,'signed shared charts identify the zero boundary');
      assert.ok(Math.abs(Number(zero.attributes.y1)-(28+4.78/7.56*122))<1e-10);
      assert.equal(zero.attributes.y1,zero.attributes.y2);
    }
  });
});

test('shared-domain bounds only validate displayed observations rather than excluded history',()=>{
  withCharts([{yDomain:'[-2,4]',range:'2'},{yDomain:'[-2,4]',range:'2'}],([a,b])=>{
    assert.ok(svg(a)); assert.ok(svg(b)); assert.deepEqual(ticks(a),ticks(b));
  },{a:[999,-2,1]});
});

test('a zero-only raw domain is padded into a finite signed axis',()=>{
  withCharts([{yDomain:'[0,0]'}],([container])=>{
    assert.ok(svg(container));
    assert.deepEqual(ticks(container).map(tick=>tick.label),['-0.05','-0.02','0.02','0.05']);
    assert.deepEqual(ys(paths(container)[0]),[89,89,89]);
    assert.doesNotMatch(paths(container)[0],/NaN|Infinity/);
  },{a:[0,0,0]});
});

test('malformed, nonfinite, reversed and value-clipping explicit domains fail visibly without drawing',()=>{
  for(const yDomain of ['', 'oops','null','{}','[]','[-2]','[-2,4,5]','["-2",4]','[false,4]','[-2,1e400]','[4,-2]','[-1,4]','[-2,0]']) {
    withCharts([{yDomain}],([container])=>{
      assert.equal(svg(container),undefined,yDomain);
      assert.match(container.textContent,/Chart configuration error:.*y-domain/i,yDomain);
    });
  }
});

test('a valid domain preserves unavailable observations while malformed bounds still identify a configuration error',()=>{
  withCharts([{yDomain:'[-2,4]'},{yDomain:'bad',series:'a'}],([empty,invalid])=>{
    assert.equal(svg(empty),undefined); assert.match(empty.textContent,/No observations available/);
    assert.equal(svg(invalid),undefined); assert.match(invalid.textContent,/Chart configuration error:.*y-domain/i);
  },{a:[null,null,null]});
});

test('finite domain endpoints that overflow chart arithmetic fail visibly',()=>{
  withCharts([{yDomain:`[${-Number.MAX_VALUE},${Number.MAX_VALUE}]`}],([container])=>{
    assert.equal(svg(container),undefined);
    assert.match(container.textContent,/Chart configuration error:.*y-domain/i);
  });
});

test('unconfigured charts retain independent automatic scales and no zero reference line',()=>{
  withCharts([{},{}],([a,b])=>{
    assert.ok(svg(a)); assert.ok(svg(b)); assert.notDeepEqual(ticks(a),ticks(b));
    assert.equal(ys(paths(a)[0]).at(-1),40.59);
    assert.equal(ys(paths(b)[0])[0],113.21);
    assert.equal(nodes(a).some(node=>node.attributes.class==='zero-reference'),false);
    assert.equal(nodes(b).some(node=>node.attributes.class==='zero-reference'),false);
  });
});
