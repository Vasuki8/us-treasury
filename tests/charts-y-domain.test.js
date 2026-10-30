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
const ticks=container=>nodes(container)
  .filter(node=>node.tag==='text'&&node.attributes['text-anchor']==='end'&&Number(node.attributes.y)<170)
  .map(node=>({label:node.textContent,y:node.attributes.y}));
const fixture=(id,values)=>({
  ...series.debt,id,name:id,short:id,frequency:'Quarterly',comparisonClass:'rate',
  format:'percentagePoints',precision:3,unit:'Percentage points',
  observations:values.map((value,index)=>({date:['2026-01-01','2026-04-01','2026-07-01'][index],value})),
});
function withCharts(datasets,run,{a=[-2,null,1],b=[1,4,0],seriesA={}}={}) {
  const originalDocument=globalThis.document;
  globalThis.document={createElementNS:(_ns,tag)=>new Element(tag),createElement:tag=>new Element(tag)};
  try {
    const catalog={a:{...fixture('a',a),...seriesA},b:fixture('b',b)};
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

test('manual charts without a range inherit the first supplied series frequency',()=>{
  const observations=['2020-01-01','2022-01-01','2026-01-01'].map((date,index)=>({date,value:index+1}));
  for(const [frequency,count] of [['Monthly',2],['Quarterly',2],['Daily',1],['Weekly',1]]){
    withCharts([{range:undefined}],([container])=>{
      assert.ok(svg(container));assert.equal((paths(container)[0].match(/[ML]/g)??[]).length,count);
    },{seriesA:{frequency,observations}});
  }
});

test('explicit raw shared domains produce identical ticks and value coordinates with padding applied once',()=>{
  withCharts([{yDomain:'[-2,4]'},{yDomain:'[-2,4]'}],([a,b])=>{
    assert.deepEqual(ticks(a),ticks(b));
    assert.deepEqual(ticks(a).map(tick=>tick.label),['-2','0','2','4']);
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
    assert.deepEqual(ticks(container).map(tick=>tick.label),['-0.04','-0.02','0','0.02','0.04']);
    assert.deepEqual(ys(paths(container)[0]),[89,89,89]);
    assert.doesNotMatch(paths(container)[0],/NaN|Infinity/);
  },{a:[0,0,0]});
});

test('fractional ticks retain distinct 1-2-5 readings and normalize signed zero',()=>{
  withCharts([{yDomain:'[-0.1,0.2]',yDomainExact:'true'}],([container])=>{
    assert.deepEqual(ticks(container).map(tick=>tick.label),['-0.1','0','0.1','0.2']);
    assert.equal(ys(paths(container)[0])[0],109.33);
  },{a:[-0,0.1,0.2]});
  withCharts([{yDomain:'[0,0.000004]',yDomainExact:'true'}],([container])=>{
    assert.deepEqual(ticks(container).map(tick=>tick.label),['0','0.000001','0.000002','0.000003','0.000004']);
  },{a:[0,0.000002,0.000004]});
});

test('every bar chart marks its real zero baseline for positive, negative and zero values',()=>{
  for(const values of [[1,2,3],[-1,-2,-3],[-1,0,2],[0,-0,0]]){
    withCharts([{kind:'bar'}],([container])=>{
      const rendered=nodes(container),baseline=rendered.find(node=>node.attributes.class==='zero-reference');
      assert.ok(baseline,'A bar chart must expose the origin of every bar.');
      const zero=Number(baseline.attributes.y1);
      assert.ok(Number.isFinite(zero));
      assert.ok(ticks(container).some(tick=>tick.label==='0'));
      for(const bar of rendered.filter(node=>node.attributes.class==='bar')){
        const top=Number(bar.attributes.y),bottom=top+Number(bar.attributes.height);
        assert.ok(Math.abs(top-zero)<1e-8||Math.abs(bottom-zero)<1e-8);
      }
    },{a:values});
  }
});

test('exact scale endpoints and references stay fixed while ticks include the zero crossing',()=>{
  withCharts([{yDomain:'[-3,7]',yDomainExact:'true',yReference:'2'}],([container])=>{
    assert.deepEqual(ticks(container).map(tick=>tick.label),['-2','0','2','4','6']);
    assert.deepEqual(ys(paths(container)[0]),[150,113.4,28]);
    const reference=nodes(container).find(node=>node.attributes.class==='value-reference');
    assert.equal(Number(reference.attributes.y1),89);
  },{a:[-3,0,7]});
});

test('unrepresentable automatic scales fail visibly instead of emitting invalid SVG',()=>{
  withCharts([{}],([container])=>{
    assert.equal(svg(container),undefined);
    assert.match(container.textContent,/finite chart scale/);
  },{a:[-Number.MAX_VALUE,0,Number.MAX_VALUE]});
});

test('extreme finite tick magnitudes stay distinct while subnormal and exact zero domains fail clearly',()=>{
  for(const [domain,values,expected] of [
    ['[-2e200,2e200]',[-2e200,0,2e200],['-2.0e+200','-1.0e+200','0','1.0e+200','2.0e+200']],
    ['[0,1e-300]',[0,5e-301,1e-300],['0','2.0e-301','4.0e-301','6.0e-301','8.0e-301','1.0e-300']],
  ]){
    withCharts([{yDomain:domain,yDomainExact:'true'}],([container])=>{
      assert.deepEqual(ticks(container).map(tick=>tick.label),expected);
      assert.doesNotMatch(paths(container)[0],/NaN|Infinity/);
    },{a:values});
  }
  for(const domain of ['[0,5e-324]','[0,0]']){
    withCharts([{yDomain:domain,yDomainExact:'true'}],([container])=>{
      assert.equal(svg(container),undefined);
      assert.match(container.textContent,/finite chart scale/);
    },{a:[0,0,0]});
  }
});

test('missing periods remain visibly dated with their original source note and respect the selected window',()=>{
  const note='October 2025 data unavailable due to the lapse in appropriations. <source notice>';
  const observations=[
    {date:'2025-09-01',value:1},
    {date:'2025-10-01',value:null,footnotes:[note]},
    {date:'2025-11-01',value:2},
  ];
  withCharts([{}, {series:'a',range:'1'}],([all,recent])=>{
    const annotations=all.children.filter(node=>node.attributes.class==='panel-note chart-missing-period');
    assert.equal(annotations.length,1);
    assert.match(annotations[0].textContent,/Oct 2025/);
    assert.ok(annotations[0].textContent.includes(note),'The chart reuses the table source footnote verbatim.');
    assert.equal(annotations[0].children.some(child=>typeof child!=='string'),false,'Source markup remains text.');
    assert.equal(recent.children.some(node=>node.attributes.class==='panel-note chart-missing-period'),false);
    assert.equal((paths(all)[0].match(/M/g)??[]).length,2,'The note must not interpolate across the source gap.');
  },{seriesA:{frequency:'Monthly',observations}});
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
