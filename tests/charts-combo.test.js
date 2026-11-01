import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCharts } from '../src/charts.js';
import { chart } from '../src/ui.js';
import { series } from '../src/data.js';

// Exercise the SVG, date-window, model and cursor code with only DOM primitives replaced.
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
const hasClass=(node,name)=>(node.attributes.class??node.className??'').split(' ').includes(name);
const find=(container,name)=>nodes(container).find(node=>hasClass(node,name));
const all=(container,name)=>nodes(container).filter(node=>hasClass(node,name));
const fixture=(id,rows,metadata={})=>({
  ...series.debt,id,name:`${id} full name`,short:id,frequency:'Quarterly',
  format:'percent',precision:1,unit:'Percent annualized',comparisonClass:'growth',
  observations:rows.map(([date,value])=>({date,value})),...metadata,
});
const captured={
  a:fixture('a',[['2026-01-01',-2],['2026-04-01',null],['2026-07-01',4],['2026-10-01',null]]),
  b:fixture('b',[['2026-01-01',2],['2026-04-01',null],['2026-07-01',4],['2026-10-01',3]]),
};
function withChart(run,{catalog=captured,chartOptions={},dataset={},renderOptions={},width=374}={}) {
  const originalDocument=globalThis.document;
  globalThis.document={createElementNS:(_ns,tag)=>new Element(tag),createElement:tag=>new Element(tag)};
  try {
    const container=new Element('div'); container.clientWidth=width;
    const markup=chart(['a','b'],{kind:'combo',range:{preset:'all'},legend:true,endLabels:true,...chartOptions});
    container.dataset=Object.fromEntries([...markup.matchAll(/data-([\w-]+)="([^"]*)"/g)].map(([,name,value])=>[
      name.replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase()),value.replaceAll('&quot;','"').replaceAll('&amp;','&'),
    ]));
    Object.assign(container.dataset,dataset);
    renderCharts({querySelectorAll:()=>[container]},{catalog,...renderOptions});
    run(container);
  } finally {
    if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;
  }
}
const near=(actual,want)=>assert.ok(Math.abs(Number(actual)-want)<0.01,`${actual} should equal ${want}`);

test('combo charts plot signed bars and gapped lines on one native scale with exact-date keyboard inspection',()=>{
  withChart(container=>{
    const rendered=nodes(container),bars=all(container,'bar'),lines=all(container,'series-line');
    assert.equal(bars.length,2,'only finite first-series observations become bars');
    assert.equal(lines.length,1,'remaining series become lines rather than more bars');
    const zero=find(container,'zero-reference'); near(zero.attributes.y1,109.333333);
    near(bars[0].attributes.y,109.333333); near(bars[0].attributes.height,40.666667);
    near(bars[1].attributes.y,28); near(bars[1].attributes.height,81.333333);
    assert.ok(hasClass(bars[1],'latest-bar'),'the latest finite bar is accented even after a missing final period');
    assert.equal(hasClass(bars[0],'latest-bar'),false);
    assert.equal(bars[0].attributes['data-series-index'],'0');
    assert.match(lines[0].attributes.d,/^M[\d.]+ 68\.67  M[\d.]+ 28\.00 L[\d.]+ 48\.33$/);
    const grid=find(container,'gridline'),left=Number(grid.attributes.x1),right=Number(grid.attributes.x2);
    near(Number(bars[0].attributes.x)+Number(bars[0].attributes.width)/2,left);
    near(Number(bars[1].attributes.x)+Number(bars[1].attributes.width)/2,left+(right-left)*181/273);
    const svg=rendered.find(node=>node.tag==='svg');
    svg.listeners.keydown({key:'Home',preventDefault(){}});
    assert.match(find(container,'chart-readout').textContent,/Q1 2026.*a -2\.0%.*b 2\.0%/);
    svg.listeners.keydown({key:'ArrowRight',preventDefault(){}});
    assert.match(find(container,'chart-readout').textContent,/Q2 2026.*a —.*source value unavailable.*b —/);
    assert.match(svg.attributes['aria-label'],/Frozen research snapshot/);
    const legend=all(container,'chart-legend-item');
    assert.equal(legend.length,2);
    assert.equal(legend[0].textContent,'a · Percent annualized');
    assert.equal(legend[1].attributes['aria-label'],'b full name · Percent annualized');
    assert.ok(hasClass(find(legend[0],'chart-legend-swatch'),'is-bar'));
    assert.equal(hasClass(find(legend[1],'chart-legend-swatch'),'is-bar'),false);
  },{width:800,dataset:{yDomain:'[-2,4]',yDomainExact:'true'}});
});

test('combo charts reject incompatible populations and derived scale configurations',()=>{
  for(const options of [
    {catalog:{...captured,b:{...captured.b,unit:'USD billions'}}},
    {catalog:{...captured,b:{...captured.b,frequency:'Monthly'}}},
    {catalog:{...captured,b:{...captured.b,format:'billions'}}},
    {dataset:{series:'a'}},{dataset:{series:'a,a'}},
    {chartOptions:{transform:'change'}},{chartOptions:{comparison:'indexed'}},
    {chartOptions:{panelId:'a'}},
  ])withChart(container=>{
    assert.equal(nodes(container).some(node=>node.tag==='svg'),false);
    assert.match(container.textContent,/Chart configuration error:.*combo/i);
  },options);
});

test('dense combo history bars stay narrower than exact neighboring dates while legacy bars retain their minimum',()=>{
  const dates=Array.from({length:318},(_,index)=>new Date(Date.UTC(1947,index*3,1)).toISOString().slice(0,10));
  for(const retainedDates of [dates,['1847-01-01',...dates.slice(1)]]){
    const catalog={a:fixture('a',retainedDates.map(date=>[date,2])),b:fixture('b',retainedDates.map(date=>[date,3]))};
    for(const width of [210,320,800])withChart(container=>{
      const bars=all(container,'bar');assert.equal(bars.length,318);
      const centers=bars.map(bar=>Number(bar.attributes.x)+Number(bar.attributes.width)/2);
      for(let index=1;index<bars.length;index++){
        const previous=bars[index-1],current=bars[index],spacing=centers[index]-centers[index-1];
        assert.ok(Number(current.attributes.width)>0&&Number(current.attributes.width)<4);
        assert.ok((Number(previous.attributes.width)+Number(current.attributes.width))/2<spacing,'adjacent periods must remain visually distinct, including after a long retained gap');
      }
    },{catalog,width});
    withChart(container=>{
      const bars=all(container,'bar');assert.equal(bars.length,318);
      assert.ok(bars.every(bar=>Number(bar.attributes.width)===4),'existing bar charts preserve their established minimum width');
    },{catalog,width:320,chartOptions:{kind:'bar',legend:false,endLabels:false},dataset:{series:'a'}});
  }
});

test('endpoint labels use each series latest finite displayed observation and never borrow outside its window',()=>{
  withChart(container=>{
    const labels=all(container,'chart-end-label');
    assert.equal(labels.length,2);
    assert.match(labels[0].textContent,/a 4\.0%Q3 2026/);
    assert.match(labels[1].textContent,/b 3\.0%Q4 2026/);
    assert.match(labels[0].attributes['aria-label'],/a.*4\.0%.*Q3 2026.*Percent annualized/);
    assert.equal(labels[1].attributes['data-series-index'],'1');
    const dots=all(container,'chart-end-dot'),leaders=all(container,'chart-end-leader');
    assert.equal(dots.length,2,'finite endpoints remain marked when the cursor moves elsewhere');
    for(const dot of dots){
      const index=dot.attributes['data-series-index'],leader=leaders.find(node=>node.attributes['data-series-index']===index);
      assert.ok(hasClass(dot,`series-${index}`));
      assert.equal(dot.attributes.cx,leader.attributes.x1);assert.equal(dot.attributes.cy,leader.attributes.y1);
    }
  });
  const local={
    a:fixture('a',[['2025-10-01',99],['2026-04-01',null],['2026-07-01',null],['2027-01-01',88]]),
    b:fixture('b',[['2026-04-01',2],['2026-07-01',null]]),
  };
  withChart(container=>{
    const labels=all(container,'chart-end-label');
    assert.equal(labels.length,1);
    assert.match(labels[0].textContent,/b 2\.0%Q2 2026/);
    assert.doesNotMatch(container.textContent,/99\.0%|88\.0%|999/);
    assert.match(nodes(container).find(node=>node.tag==='svg').attributes['aria-label'],/Captured local population/);
  },{catalog:{a:fixture('a',[['2026-07-01',999]]),b:captured.b},dataset:{chartCatalog:'local'},chartOptions:{range:{preset:'custom',startDate:'2026-04-01',endDate:'2026-07-31'}},renderOptions:{chartCatalogs:{local:{catalog:local,evidenceLabel:'Captured local population'}}}});
  withChart(container=>{
    assert.equal(all(container,'chart-end-label').length,0);
    assert.match(container.textContent,/No observations available/);
  },{catalog:local,chartOptions:{range:{preset:'custom',startDate:'2026-07-01',endDate:'2026-07-31'}}});
});

test('line charts with endpoint labels use one shared calendar window across differently lagged sources',()=>{
  withChart(container=>{
    const svg=nodes(container).find(node=>node.tag==='svg');assert.ok(svg);
    assert.equal(all(container,'bar').length,0);
    assert.equal(all(container,'series-line').length,2);
    const labels=all(container,'chart-end-label');assert.equal(labels.length,2);
    assert.ok(labels.some(label=>label.textContent==='a 1.0%Oct 2026'));
    assert.ok(labels.some(label=>label.textContent==='b 2.0%Mar 2027'));
    assert.doesNotMatch(container.textContent,/500|600/,'observations outside the common selected window cannot change the axis or endpoints');
    svg.listeners.keydown({key:'Home',preventDefault(){}});
    assert.match(find(container,'chart-readout').textContent,/Oct 2026.*a 1\.0%.*b —/);
  },{catalog:{
    a:fixture('a',[['2026-01-01',500],['2026-02-01',600],['2026-10-01',1]],{frequency:'Monthly'}),
    b:fixture('b',[['2027-03-01',2]],{frequency:'Monthly'}),
  },chartOptions:{kind:'line',range:{preset:'1y'}},dataset:{yDomain:'[0,3]',yDomainExact:'true'}});
});

test('combo charts never fill missing scoped or frozen series from live data',()=>{
  const liveA=series.a,liveB=series.b;series.a=captured.a;series.b=captured.b;
  try {
    for(const options of [
      {catalog:{a:captured.a}},
      {dataset:{chartCatalog:'missing'}},
      {dataset:{chartCatalog:'local'},renderOptions:{chartCatalogs:{local:{catalog:{a:captured.a},evidenceLabel:'Local'}}}},
    ])withChart(container=>{
      assert.equal(nodes(container).some(node=>node.tag==='svg'),false);
      assert.match(container.textContent,/unavailable|configuration error/i);
    },options);
  } finally {
    if(liveA===undefined)delete series.a;else series.a=liveA;
    if(liveB===undefined)delete series.b;else series.b=liveB;
  }
});

test('close endpoint labels wrap, stay inside narrow charts and retain a usable plot',()=>{
  const catalog=Object.fromEntries(['a','b','c','d'].map((id,index)=>[id,fixture(id,[['2026-01-01',2],['2026-04-01',2+index*.001]],{short:`Series ${id}`})]));
  for(const width of [210,320,1280])withChart(container=>{
    const rendered=nodes(container),svg=rendered.find(node=>node.tag==='svg'),height=Number(svg.attributes.viewBox.split(' ')[3]);
    const grid=find(container,'gridline');
    assert.ok(Number(grid.attributes.x2)-Number(grid.attributes.x1)>=100);
    const labels=all(container,'chart-end-label'); assert.equal(labels.length,4);
    const bounds=labels.map(label=>{
      const lines=label.children.filter(node=>node.tag==='tspan');
      for(const [index,line]of lines.entries()){
        assert.ok(Number(line.attributes.x)>=0);
        assert.ok(Number(line.attributes.x)+line.textContent.length*8<=width-4);
        assert.ok(Number(line.attributes.y)>=28&&Number(line.attributes.y)<=height-30);
        if(index)assert.ok(Number(line.attributes.y)-Number(lines[index-1].attributes.y)>=16,'13px text needs readable baseline spacing');
      }
      return {top:Number(lines[0].attributes.y),bottom:Number(lines.at(-1).attributes.y)};
    }).sort((a,b)=>a.top-b.top);
    for(let i=1;i<bounds.length;i++)assert.ok(bounds[i].top-bounds[i-1].bottom>=16,'adjacent endpoint text must not overlap');
    assert.equal(all(container,'chart-end-leader').length,4);
  },{catalog,width,dataset:{series:'a,b,c,d'}});
});

test('endpoint margins preserve large signed axis readings and nonoverlapping calendar labels',()=>{
  for(const width of [210,320,374,1280])withChart(container=>{
    const rendered=nodes(container),svg=rendered.find(node=>node.tag==='svg'),height=Number(svg.attributes.viewBox.split(' ')[3]);
    const grid=find(container,'gridline'),left=Number(grid.attributes.x1),right=Number(grid.attributes.x2);
    assert.ok(right-left>=100,'both label margins must leave a usable plot');
    const ticks=rendered.filter(node=>node.tag==='text'&&node.attributes['text-anchor']==='end'&&Number(node.attributes.y)<height-46);
    for(const tick of ticks)assert.ok(Number(tick.attributes.x)-tick.textContent.length*8>=4,'scientific tick labels must remain within the SVG');
    const dates=rendered.filter(node=>node.tag==='text'&&Number(node.attributes.y)>=height-24&&!hasClass(node,'chart-end-label'));
    assert.ok(dates.length>=2);
    const bounds=dates.map(node=>{
      const x=Number(node.attributes.x),length=node.textContent.length*8,anchor=node.attributes['text-anchor'];
      return {left:x-(anchor==='end'?length:anchor==='middle'?length/2:0),right:x+(anchor==='start'?length:anchor==='middle'?length/2:0),y:node.attributes.y};
    });
    for(const [index,bound]of bounds.entries()){
      assert.ok(bound.left>=0&&bound.right<=width);
      for(const other of bounds.slice(index+1))if(other.y===bound.y)assert.ok(bound.right<=other.left||other.right<=bound.left,'calendar labels sharing a baseline must not overlap');
    }
  },{width,catalog:{
    a:fixture('a',[['2026-01-01',-2e12],['2026-10-01',4e12]]),
    b:fixture('b',[['2026-01-01',1e12],['2026-10-01',3e12]]),
  }});
});

test('legend and endpoint options leave existing charts unadorned by default',()=>{
  withChart(container=>{
    assert.equal(all(container,'chart-legend').length,0);
    assert.equal(all(container,'chart-end-label').length,0);
    assert.equal(all(container,'bar').length,0);
    assert.equal(all(container,'series-line').length,2);
  },{chartOptions:{kind:'line',legend:false,endLabels:false}});
});
