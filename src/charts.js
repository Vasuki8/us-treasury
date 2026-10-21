import { yieldCurve } from './data.js';
import { getSeries, compareSeries, transformSeries, formatValue, periodLabel } from './model.js';

const ns = 'http://www.w3.org/2000/svg';
let chartId = 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function chartDateLabel(panels, date) {
  const frequencies = new Set(panels.map(panel => panel.series.frequency));
  return periodLabel(frequencies.size > 1 ? {frequency:'Daily'} : panels[0].series, date);
}
function svgElement(name, attributes, parent, text) {
  const node = document.createElementNS(ns, name);
  Object.entries(attributes).forEach(([key,value]) => node.setAttribute(key,String(value)));
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

function draw(container, panels, {height = 180, bars = false, curve = false, transformed = false} = {}) {
  container.replaceChildren();
  const width = Math.max(300, Math.round(container.clientWidth));
  const h = Math.max(120,height), left = 54, right = 20, top = 28, bottom = 30;
  const pw = width-left-right, ph = h-top-bottom;
  const values = panels.flatMap(panel => panel.observations.map(o => o.value)).filter(finite);
  if (!values.length) { container.textContent = 'No observations available for this chart.'; return; }
  const dates = [...new Set(panels.flatMap(panel => panel.observations.map(o => o.date)))].sort();
  const orderedDates = curve ? yieldCurve.map(point => point.tenor) : dates;
  const positions = orderedDates.map((date,index) => curve ? index : Date.parse(`${date}T00:00:00Z`));
  const minX = positions[0], spanX = positions.at(-1)-minX || 1;
  const xIndex = index => left+(positions[index]-minX)/spanX*pw;
  const xDate = date => xIndex(orderedDates.indexOf(date));
  let lo = Math.min(...values), hi = Math.max(...values);
  if (bars) { lo = Math.min(0,lo); hi = Math.max(0,hi); }
  const pad = Math.max((hi-lo)*.13,Math.abs(hi)*.015,.05);
  lo -= bars && lo === 0 ? 0 : pad;
  hi += pad;
  const y = value => top+(hi-value)/(hi-lo)*ph;
  const id = `chart-readout-${++chartId}`;
  const title = curve ? 'Treasury par yield curve' : panels.map(panel => panel.series.name).join(' and ');
  const svg = svgElement('svg',{viewBox:`0 0 ${width} ${h}`,tabindex:0,role:'group','aria-label':`${title}. Synthetic observations. Use left and right arrow keys for exact values.`,'aria-describedby':id},container);
  svgElement('title',{},svg,`${title} · ${panels[0].unit} · synthetic data`);
  svgElement('text',{x:left,y:14},svg,panels[0].unit);
  for (let index=0;index<4;index++) {
    const value = lo+(hi-lo)*index/3;
    svgElement('line',{x1:left,x2:width-right,y1:y(value),y2:y(value),class:'gridline'},svg);
    const label = new Intl.NumberFormat('en-US',{maximumFractionDigits:Math.abs(hi-lo)<3?2:1}).format(value);
    svgElement('text',{x:left-8,y:y(value)+4,'text-anchor':'end'},svg,label);
  }
  const labelIndexes = curve ? orderedDates.map((_,i)=>i) : [0,Math.floor((orderedDates.length-1)/2),orderedDates.length-1];
  [...new Set(labelIndexes)].forEach(index => {
    const date = orderedDates[index];
    let label = curve ? date : chartDateLabel(panels,date);
    if (!curve && panels[0].series.frequency === 'Weekly') label = label.replace('Week of ','');
    svgElement('text',{x:xIndex(index),y:h-8,'text-anchor':index===0?'start':index===orderedDates.length-1?'end':'middle'},svg,label);
  });
  panels.forEach((panel,index) => {
    const className = curve && index>0 ? ' previous' : ['', ' secondary', ' tertiary', ' quaternary'][index];
    if (bars) {
      const barWidth = Math.max(4,Math.min(30,pw/orderedDates.length*.6));
      panel.observations.filter(o=>finite(o.value)).forEach(o => {
        svgElement('rect',{x:xDate(o.date)-barWidth/2,y:Math.min(y(o.value),y(0)),width:barWidth,height:Math.max(1,Math.abs(y(o.value)-y(0))),class:'bar'},svg);
      });
    } else {
      let gap = true;
      const path = panel.observations.map(o => {
        if (!finite(o.value)) { gap=true; return ''; }
        const command = gap?'M':'L'; gap=false;
        return `${command}${xDate(o.date).toFixed(2)} ${y(o.value).toFixed(2)}`;
      }).join(' ');
      svgElement('path',{d:path,class:`series-line${className}`},svg);
    }
  });
  const guide = svgElement('line',{x1:0,x2:0,y1:top,y2:h-bottom,class:'guide'},svg);
  const dots = panels.map((_,index)=>svgElement('circle',{cx:0,cy:0,r:3,class:`dot${curve&&index>0?' previous':index%2?' secondary':''}`},svg));
  const hit = svgElement('rect',{x:left,y:top,width:pw,height:ph,fill:'transparent'},svg);
  const readout = document.createElement('div');
  readout.id=id; readout.className=`chart-readout${curve?' curve-readout':''}`; container.append(readout);
  let selected=orderedDates.length-1;
  function select(index, announce = false) {
    selected = Math.max(0,Math.min(orderedDates.length-1,index));
    const date=orderedDates[selected], x=xIndex(selected);
    guide.setAttribute('x1',x); guide.setAttribute('x2',x);
    const dateLabel = curve ? `${date} maturity` : chartDateLabel(panels,date);
    readout.replaceChildren();
    const dateSpan = document.createElement('span'); dateSpan.textContent = dateLabel; readout.append(dateSpan);
    panels.forEach((panel,panelIndex) => {
      const observation = panel.observations.find(o=>o.date===date);
      const value = observation?.value;
      dots[panelIndex].setAttribute('cx',x);
      dots[panelIndex].setAttribute('cy',finite(value)?y(value):top);
      dots[panelIndex].setAttribute('visibility',finite(value)?'visible':'hidden');
      const span=document.createElement('span');
      const label=curve?(panelIndex?'Prior':'Latest'):panel.series.short;
      const isIndex = panel.unit.startsWith('Index');
      const display = !finite(value)?'—':isIndex?value.toFixed(2):transformed?`${value.toFixed(panel.series.precision)} ${panel.unit}`:formatValue(panel.series,value);
      span.className = `readout-series series-${panelIndex}`;
      span.append(`${label} `);
      const strong=document.createElement('strong'); strong.textContent=display; span.append(strong); readout.append(span);
    });
    if (announce) svg.setAttribute('aria-label',`${title}. ${readout.textContent}. Use left and right arrow keys.`);
  }
  function pointer(event) {
    const box = svg.getBoundingClientRect();
    const target = (event.clientX-box.left)*width/box.width;
    let nearest = 0;
    orderedDates.forEach((_,index)=>{if(Math.abs(xIndex(index)-target)<Math.abs(xIndex(nearest)-target))nearest=index;});
    select(nearest);
  }
  hit.addEventListener('pointermove',pointer);
  hit.addEventListener('pointerdown',pointer);
  svg.addEventListener('keydown',event=>{
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    select(event.key==='Home'?0:event.key==='End'?orderedDates.length-1:selected+(event.key==='ArrowRight'?1:-1),true);
  });
  select(selected);
}

/** Responsive view boxes avoid layout mutations inside ResizeObserver callbacks. */
export function renderCharts(root) {
  root.querySelectorAll('[data-chart]').forEach(container => {
    const {kind,transform='level',comparison='native'} = container.dataset;
    const range=Number(container.dataset.range)||12, height=Number(container.dataset.height)||180;
    if (kind === 'curve') {
      const reference=getSeries('yield');
      draw(container,[
        {series:reference,unit:'Yield · %',observations:yieldCurve.map(p=>({date:p.tenor,value:p.value}))},
        {series:reference,unit:'Yield · %',observations:yieldCurve.map(p=>({date:p.tenor,value:p.previous}))},
      ],{height,curve:true});
      return;
    }
    const ids=container.dataset.series.split(',').filter(Boolean);
    const result=comparison==='indexed'?compareSeries(ids,'indexed',range):{panels:ids.map(id=>transformSeries(getSeries(id),transform,range))};
    if (result.error) {container.textContent=result.error;return;}
    draw(container,result.panels,{height,bars:kind==='bar',transformed:transform==='change'});
  });
}
