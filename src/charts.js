import { yieldCurve, dataStatus } from './data.js';
import { getSeries, compareSeries, transformSeries, formatValue, periodLabel, observationCoverageLabel } from './model.js';
import { selectCurveOverlays, NOMINAL_YIELD_TENORS } from './yields.js';
import {createLinkedCursor} from './comparison-cursor.js';

const ns = 'http://www.w3.org/2000/svg';
let chartId = 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function chartDateLabel(panels, date) {
  const frequencies = new Set(panels.map(panel => panel.series.frequency));
  return periodLabel(frequencies.size > 1 ? {frequency:'Daily'} : panels[0].series, date);
}
export function readChartRange(value) {
  if(value===undefined)return 12;
  try {const parsed=JSON.parse(value);if(typeof parsed==='number'&&Number.isFinite(parsed)||parsed&&typeof parsed==='object'&&!Array.isArray(parsed))return parsed;} catch { /* Invalid configuration must not widen the window. */ }
  return {preset:'custom',startDate:'invalid',endDate:'invalid'};
}
function svgElement(name, attributes, parent, text) {
  const node = document.createElementNS(ns, name);
  Object.entries(attributes).forEach(([key,value]) => node.setAttribute(key,String(value)));
  if (text !== undefined) node.textContent = text;
  parent.append(node);
  return node;
}

function draw(container, panels, {height = 180, bars = false, curve = false, transformed = false,cursor=null,evidenceLabel='Official snapshot',yDomain} = {}) {
  container.replaceChildren();
  let domain;
  if(yDomain!==undefined){
    try {domain=JSON.parse(yDomain);} catch { /* An explicit comparison scale must never silently become an automatic scale. */ }
    if(!Array.isArray(domain)||domain.length!==2||!domain.every(finite)||domain[0]>domain[1]){
      container.textContent='Chart configuration error: y-domain must be a finite ordered pair.';return;
    }
  }
  const width = Math.max(300, Math.round(container.clientWidth));
  const h = Math.max(120,height), left = 54, right = 20, top = 28;
  const staggerCurveLabels = curve && (width-left-right) / Math.max(1,yieldCurve.length-1) < 32;
  const bottom = staggerCurveLabels ? 46 : 30;
  const pw = width-left-right, ph = h-top-bottom;
  const values = panels.flatMap(panel => panel.observations.map(o => o.value)).filter(finite);
  if (!values.length) { container.textContent = 'No observations available for this chart.'; return; }
  if(domain&&(values.some(value=>value<domain[0]||value>domain[1])||bars&&(domain[0]>0||domain[1]<0))){
    container.textContent='Chart configuration error: y-domain must cover every displayed value and any bar zero baseline.';return;
  }
  const dates = [...new Set(panels.flatMap(panel => panel.observations.map(o => o.date)))].sort();
  const orderedDates = curve ? yieldCurve.map(point => point.tenor) : dates;
  const positions = orderedDates.map((date,index) => curve ? index : Date.parse(`${date}T00:00:00Z`));
  // Calendar bounds belong to the requested window, including empty coverage
  // before a source starts or a derived comparison's common baseline.
  const window = !curve && panels[0].window?.mode === 'calendar' ? panels[0].window : null;
  const minX = window ? Date.parse(`${window.startDate}T00:00:00Z`) : positions[0];
  const maxX = window ? Date.parse(`${window.endDate}T00:00:00Z`) : positions.at(-1);
  const spanX = maxX-minX || 1;
  const xPosition = position => left+(position-minX)/spanX*pw;
  const xIndex = index => xPosition(positions[index]);
  const xDate = date => curve ? xIndex(orderedDates.indexOf(date)) : xPosition(Date.parse(`${date}T00:00:00Z`));
  let lo = domain?domain[0]:Math.min(...values), hi = domain?domain[1]:Math.max(...values);
  if (bars&&!domain) { lo = Math.min(0,lo); hi = Math.max(0,hi); }
  const pad = Math.max((hi-lo)*.13,Math.abs(hi)*.015,.05);
  lo -= bars && !domain && lo === 0 ? 0 : pad;
  hi += pad;
  if(domain&&(!finite(lo)||!finite(hi)||!finite(hi-lo)||hi<=lo)){
    container.textContent='Chart configuration error: y-domain cannot be represented on a finite chart scale.';return;
  }
  const y = value => top+(hi-value)/(hi-lo)*ph;
  const id = `chart-readout-${++chartId}`;
  const title = curve ? 'Treasury par yield curve' : panels.map(panel => panel.series.name).join(' and ');
  const svg = svgElement('svg',{viewBox:`0 0 ${width} ${h}`,tabindex:0,role:'group','aria-label':`${title}. ${evidenceLabel}. Use left and right arrow keys for exact values.`,'aria-describedby':id},container);
  svgElement('title',{},svg,`${title} · ${panels[0].unit} · ${evidenceLabel}`);
  svgElement('text',{x:left,y:14},svg,panels[0].unit);
  for (let index=0;index<4;index++) {
    const value = lo+(hi-lo)*index/3;
    svgElement('line',{x1:left,x2:width-right,y1:y(value),y2:y(value),class:'gridline'},svg);
    const label = new Intl.NumberFormat('en-US',{maximumFractionDigits:Math.abs(hi-lo)<3?2:1}).format(value);
    svgElement('text',{x:left-8,y:y(value)+4,'text-anchor':'end'},svg,label);
  }
  if(domain&&lo<=0&&hi>=0)svgElement('line',{x1:left,x2:width-right,y1:y(0),y2:y(0),class:'zero-reference',stroke:'currentColor','stroke-opacity':'.35','stroke-dasharray':'3 3','aria-hidden':'true'},svg);
  const labelDates = curve ? orderedDates : window
    ? [window.startDate, new Date(minX+(maxX-minX)/2).toISOString().slice(0,10), window.endDate]
    : [orderedDates[0], orderedDates[Math.floor((orderedDates.length-1)/2)], orderedDates.at(-1)];
  const uniqueLabelDates = [...new Set(labelDates)];
  uniqueLabelDates.forEach((date,index) => {
    let label = curve ? date : window ? periodLabel({frequency:'Daily'},date) : chartDateLabel(panels,date);
    if (!curve && !window && panels[0].series.frequency === 'Weekly') label = label.replace('Week ending ','');
    svgElement('text',{x:xDate(date),y:h-(staggerCurveLabels && index%2===0 ? 24 : 8),'text-anchor':index===0?'start':index===uniqueLabelDates.length-1?'end':'middle'},svg,label);
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
    selectDate(orderedDates[selected],announce);
  }
  function selectDate(date,announce=false){
    if(!date)return;
    const x=xDate(date);
    guide.setAttribute('x1',x); guide.setAttribute('x2',x);
    guide.setAttribute('visibility',x>=left&&x<=width-right?'visible':'hidden');
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
      const label=curve?panel.label:panel.series.short;
      const isIndex = panel.unit.startsWith('Index');
      const display = !finite(value)?'—':isIndex?value.toFixed(2):transformed?`${value.toFixed(panel.series.precision)} ${panel.unit}`:formatValue(panel.series,value);
      span.className = `readout-series series-${panelIndex}`;
      span.append(`${label} `);
      const strong=document.createElement('strong'); strong.textContent=display; span.append(strong);
      const coverage=observationCoverageLabel(observation);if(coverage)span.append(` · ${coverage}`);
      if(!observation)span.append(' · no observation on this reference date');
      else if(!finite(value))span.append(' · source value unavailable');
      readout.append(span);
    });
    if (announce) svg.setAttribute('aria-label',`${title}. ${evidenceLabel}. ${readout.textContent}. Use left and right arrow keys.`);
  }
  function pointer(event) {
    const box = svg.getBoundingClientRect();
    const target = (event.clientX-box.left)*width/box.width;
    let nearest = 0;
    const candidates=cursor?.dates??orderedDates;
    candidates.forEach((date,index)=>{if(Math.abs(xDate(date)-target)<Math.abs(xDate(candidates[nearest])-target))nearest=index;});
    if(cursor)cursor.select(candidates[nearest],{origin:id});else select(nearest);
  }
  hit.addEventListener('pointermove',pointer);
  hit.addEventListener('pointerdown',pointer);
  svg.addEventListener('keydown',event=>{
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    if(cursor)cursor.move(event.key==='Home'?'home':event.key==='End'?'end':event.key==='ArrowRight'?1:-1,{announce:true,origin:id});
    else select(event.key==='Home'?0:event.key==='End'?orderedDates.length-1:selected+(event.key==='ArrowRight'?1:-1),true);
  });
  if(cursor)cursor.subscribe(({date,announce,origin})=>selectDate(date,announce&&origin===id));else select(selected);
}

/** Responsive view boxes avoid layout mutations inside ResizeObserver callbacks. */
export function renderCharts(root,{catalog,chartCatalogs={}}={}) {
  const cursorCatalogs=new Map();
  root.querySelectorAll('[data-chart]').forEach(container => {
    const scoped=Object.hasOwn(container.dataset,'chartCatalog');
    const binding=scoped&&chartCatalogs&&Object.hasOwn(chartCatalogs,container.dataset.chartCatalog)?chartCatalogs[container.dataset.chartCatalog]:null;
    if(scoped&&(!binding||!binding.catalog||typeof binding.catalog!=='object'||Array.isArray(binding.catalog)||typeof binding.evidenceLabel!=='string'||!binding.evidenceLabel.trim())){
      container.textContent='Chart data unavailable: the requested chart catalog is not bound.';return;
    }
    const selectedCatalog=scoped?binding.catalog:catalog;
    const lookup=id=>scoped?(Object.hasOwn(selectedCatalog,id)?selectedCatalog[id]:undefined):catalog?catalog[id]:getSeries(id);
    const evidenceLabel=scoped?binding.evidenceLabel.trim():catalog?'Frozen research snapshot':'Official snapshot';
    const {kind,transform='level',comparison='native'} = container.dataset;
    const range=readChartRange(container.dataset.range), height=Number(container.dataset.height)||180;
    // Curve charts use the live yield feed; a scoped chart must never borrow it.
    if(scoped&&(kind==='history-curve'||kind==='curve')){container.textContent='Chart data unavailable: yield curves are not supplied by this chart catalog.';return;}
    if(kind==='history-curve'){
      const curves=selectCurveOverlays(dataStatus.sources.yields,container.dataset.dates.split(',').filter(Boolean));
      draw(container,curves.map(curve=>({series:getSeries('yield'),label:curve.date+(curve.available?'':' — unavailable'),unit:'Yield · %',observations:NOMINAL_YIELD_TENORS.map(tenor=>({date:tenor,value:curve.nominal[tenor]??null}))})),{height,curve:true,yDomain:container.dataset.yDomain});
      return;
    }
    if (kind === 'curve') {
      const reference=getSeries('yield');
      draw(container,[
        {series:reference,label:`Latest (${dataStatus.curveDate ?? 'date unavailable'})`,unit:'Yield · %',observations:yieldCurve.map(p=>({date:p.tenor,value:p.value}))},
        {series:reference,label:`Prior (${dataStatus.previousCurveDate ?? 'date unavailable'})`,unit:'Yield · %',observations:yieldCurve.map(p=>({date:p.tenor,value:p.previous}))},
      ],{height,curve:true,yDomain:container.dataset.yDomain});
      return;
    }
    const ids=(scoped?container.dataset.series??'':container.dataset.series).split(',').filter(Boolean);
    if(scoped&&(!ids.length||ids.some(id=>!lookup(id)))){container.textContent='Chart data unavailable: one or more selected series are unavailable in the requested chart catalog.';return;}
    const result=comparison!=='native'||container.dataset.panelId?compareSeries(ids,comparison,range,selectedCatalog):{panels:ids.map(id=>transformSeries(lookup(id),transform,range))};
    if(comparison==='native'&&container.dataset.panelId&&transform!=='level'&&!result.error)result.panels=result.panels.map(panel=>transformSeries(panel.series,transform,range,result.window));
    result.error??=result.panels?.find(panel=>panel.error)?.error;
    if (result.error) {container.textContent=result.error;return;}
    const panels=container.dataset.panelId?result.panels.filter(panel=>panel.series.id===container.dataset.panelId):result.panels;
    if(!panels.length){container.textContent='No observations available for this chart.';return;}
    const group=container.dataset.cursorGroup;
    // A matching group name cannot link dates across independent evidence catalogs.
    const cursorScope=scoped?binding:selectedCatalog;
    if(!cursorCatalogs.has(cursorScope))cursorCatalogs.set(cursorScope,new Map());
    const cursors=cursorCatalogs.get(cursorScope);
    if(group&&!cursors.has(group))cursors.set(group,createLinkedCursor(result.panels));
    draw(container,panels,{height,bars:kind==='bar',transformed:transform==='change'||comparison==='difference',cursor:group?cursors.get(group):null,evidenceLabel,yDomain:container.dataset.yDomain});
  });
}
