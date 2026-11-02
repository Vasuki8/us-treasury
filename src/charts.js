import { yieldCurve, dataStatus } from './data.js';
import { getSeries, compareSeries, transformSeries, formatValue, periodLabel, observationCoverageLabel, isRoundedSourceObservation } from './model.js';
import { selectCurveOverlays, NOMINAL_YIELD_TENORS } from './yields.js';
import {createLinkedCursor} from './comparison-cursor.js';
import {resolveDateWindow,defaultWindowPreset} from './date-window.js';
import {maturityYears,observationEvidence} from './chart-evidence.js';

const ns = 'http://www.w3.org/2000/svg';
let chartId = 0;
const chartInspection=new WeakMap();
const chartKey=container=>container.id||container.dataset.chartKey||['kind','chartCatalog','series','panelId','cursorGroup','transform','comparison'].map(key=>container.dataset[key]??'').join('|');
/** Session-only inspection is keyed by chart identity and exact date, never observation index. */
export function captureChartInspection(root){
 const result=new Map();
 for(const container of root.querySelectorAll('[data-chart]')){
  const key=chartKey(container),rows=result.get(key)??[],previous=chartInspection.get(container);
  rows.push(previous?{...previous,focused:globalThis.document?.activeElement===previous.svg}:null);result.set(key,rows);
 }
 return result;
}
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function chartDateLabel(panels, date) {
  const frequencies = new Set(panels.map(panel => panel.series.frequency));
  return periodLabel(frequencies.size > 1 ? {frequency:'Daily'} : panels[0].series, date);
}
export function readChartRange(value,seriesList=[]) {
  if(value===undefined)return {preset:defaultWindowPreset(seriesList)};
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

function niceTicks(lo,hi){
  const target=(hi-lo)/4,power=10**Math.floor(Math.log10(target));
  const error=target/power,step=power*(error>=Math.sqrt(50)?10:error>=Math.sqrt(10)?5:error>=Math.sqrt(2)?2:1);
  const first=Math.ceil(lo/step-1e-10),last=Math.floor(hi/step+1e-10),count=last-first+1;
  if(!finite(step)||step<=0||!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||count<1||count>10)return [];
  return [...new Set(Array.from({length:count},(_,index)=>Number(((first+index)*step).toPrecision(15))))]
    .filter(value=>finite(value)&&value>=lo&&value<=hi).map(value=>Object.is(value,-0)?0:value);
}

function appendMissingPeriods(container,panels){
  for(const panel of panels)for(const row of panel.observations.filter(row=>!finite(row.value))){
    const original=panel.series.observations?.find(observation=>observation.date===row.date)??row;
    const notes=observationEvidence(panel.series,original);
    const note=document.createElement('p');
    note.setAttribute('class','panel-note chart-missing-period');
    note.textContent=[`Missing period · ${panel.series.short} · ${periodLabel(panel.series,row.date)}`,...notes].join(' · ');
    container.append(note);
  }
}

function chartValueLabel(panel,value,transformed){
  return !finite(value)?'—':panel.unit.startsWith('Index')?value.toFixed(2)
    :transformed?`${value.toFixed(panel.series.precision)} ${panel.unit}`:formatValue(panel.series,value);
}

function wrapLabel(text,characters){
  const lines=[];let remaining=String(text);
  while(remaining.length>characters){
    const space=remaining.lastIndexOf(' ',characters),end=space>0?space:characters;
    lines.push(remaining.slice(0,end));remaining=remaining.slice(end).trimStart();
  }
  if(remaining)lines.push(remaining);
  return lines;
}

function draw(container, panels, {height = 180, bars = false, combo = false, legend = false, endLabels = false, curve = false, transformed = false,cursor=null,evidenceLabel='Official snapshot',yDomain,exactDomain=false,yReference,distribution=false,inspection} = {}) {
  const previous=inspection??chartInspection.get(container),active=document.activeElement;
  const restoreFocused=Boolean(previous&&(previous.focused||active===previous.svg));
  container.replaceChildren();
  const hasBars=bars||combo;
  let domain;
  if(yDomain!==undefined){
    try {domain=JSON.parse(yDomain);} catch { /* An explicit comparison scale must never silently become an automatic scale. */ }
    if(!Array.isArray(domain)||domain.length!==2||!domain.every(finite)||domain[0]>domain[1]){
      container.textContent='Chart configuration error: y-domain must be a finite ordered pair.';return;
    }
  }
  const width = Math.max(210, Math.round(container.clientWidth));
  let right = endLabels ? Math.min(148,Math.max(20,width-154)) : 20;
  const values = panels.flatMap(panel => panel.observations.flatMap(o => distribution?[o.value,o.percentile1,o.percentile25,o.percentile75,o.percentile99]:[o.value])).filter(finite);
  if (!values.length) {
    container.textContent = 'No observations available for this chart.';
    if(!curve)appendMissingPeriods(container,panels);
    return;
  }
  if(domain&&(values.some(value=>value<domain[0]||value>domain[1])||hasBars&&(domain[0]>0||domain[1]<0))){
    container.textContent='Chart configuration error: y-domain must cover every displayed value and any bar zero baseline.';return;
  }
  const dates = [...new Set(panels.flatMap(panel => panel.observations.map(o => o.date)))].sort();
  const orderedDates = curve ? yieldCurve.map(point => point.tenor) : dates;
  const positions = orderedDates.map(date => curve ? maturityYears(date) : Date.parse(`${date}T00:00:00Z`));
  // Calendar bounds belong to the requested window, including empty coverage
  // before a source starts or a derived comparison's common baseline.
  const window = !curve && panels[0].window?.mode === 'calendar' ? panels[0].window : null;
  const minX = window ? Date.parse(`${window.startDate}T00:00:00Z`) : positions[0];
  const maxX = window ? Date.parse(`${window.endDate}T00:00:00Z`) : positions.at(-1);
  const spanX = maxX-minX || 1;
  let lo = domain?domain[0]:Math.min(...values), hi = domain?domain[1]:Math.max(...values);
  if (hasBars&&!domain) { lo = Math.min(0,lo); hi = Math.max(0,hi); }
  if((exactDomain&&!domain)||(yReference!==undefined&&(!domain||!finite(Number(yReference))||Number(yReference)<domain[0]||Number(yReference)>domain[1]))){container.textContent='Chart configuration error: reference and exact bounds require a valid covering y-domain.';return;}
  const pad = exactDomain?0:Math.max((hi-lo)*.13,Math.abs(hi)*.015,.05);
  lo -= hasBars && !domain && lo === 0 ? 0 : pad;
  hi += pad;
  if(!finite(lo)||!finite(hi)||!finite(hi-lo)||hi<=lo){
    container.textContent='Chart configuration error: y-domain cannot be represented on a finite chart scale.';return;
  }
  const tickValues=niceTicks(lo,hi);
  if(!tickValues.length){container.textContent='Chart configuration error: y-domain cannot be represented on a finite chart scale.';return;}
  const tickFormat = new Intl.NumberFormat('en-US',{maximumSignificantDigits:15});
  let tickLabels = tickValues.map(value=>tickFormat.format(value));
  // Reserve seven pixels per 11px monospace character, plus the tick gap and
  // edge padding. Keep ordinary axes stable and leave at least 100px to plot.
  const labelMargin = labels => Math.max(54,...labels.map(label=>label.length*(endLabels?8:7)+12));
  const maximumLeft = Math.min(120,width-(endLabels?20:right)-100);
  if(labelMargin(tickLabels)>maximumLeft)tickLabels=tickValues.map(value=>value===0?'0':value.toExponential(1));
  const left = Math.min(maximumLeft,labelMargin(tickLabels));
  if(endLabels)right=Math.min(right,width-left-100);
  const unitLines = [], unitCharacters = Math.max(1,Math.floor((width-left-right)/7));
  let remainingUnit = panels[0].unit;
  while(remainingUnit.length>unitCharacters){
    const space = remainingUnit.lastIndexOf(' ',unitCharacters-1), end = space>0?space+1:unitCharacters;
    unitLines.push(remainingUnit.slice(0,end));remainingUnit=remainingUnit.slice(end);
  }
  unitLines.push(remainingUnit);
  const top = 28+(unitLines.length-1)*14;
  const staggerCurveLabels = curve && (width-left-right) / Math.max(1,yieldCurve.length-1) < 32;
  const staggerDateLabels = endLabels && width-left-right<200;
  const bottom = staggerCurveLabels||staggerDateLabels ? 46 : 30;
  const endpoints=endLabels?panels.flatMap((panel,index)=>{
    // Only displayed observations qualify; an older source value outside this
    // window must never become an apparently current endpoint.
    const observation=panel.observations.filter(row=>finite(row.value)).reduce((latest,row)=>!latest||row.date>latest.date?row:latest,null);
    if(!observation)return [];
    const value=chartValueLabel(panel,observation.value,transformed),period=periodLabel(panel.series,observation.date);
    const characters=Math.max(1,Math.floor((right-16)/8));
    const lines=[...wrapLabel(`${panel.series.short} ${value}`,characters),...wrapLabel(period,characters)];
    return [{index,observation,lines,height:lines.length*16,label:`${panel.series.short} ${value} · ${period} · ${panel.unit}`}];
  }):[];
  const endpointHeight=endpoints.reduce((total,endpoint)=>total+endpoint.height,0)+Math.max(0,endpoints.length-1)*8;
  const h = Math.max(120,height,top+bottom+60,top+bottom+endpointHeight);
  const pw = width-left-right, ph = h-top-bottom;
  const xPosition = position => left+(position-minX)/spanX*pw;
  const xIndex = index => xPosition(positions[index]);
  const xDate = date => curve ? xIndex(orderedDates.indexOf(date)) : xPosition(Date.parse(`${date}T00:00:00Z`));
  const y = value => top+(hi-value)/(hi-lo)*ph;
  const id = `chart-readout-${++chartId}`;
  const title = curve ? 'Treasury par yield curve · quantitative elapsed maturity spacing' : panels.map(panel => panel.series.name).join(' and ');
  if(legend){
    const list=document.createElement('div');list.setAttribute('class','chart-legend');list.setAttribute('aria-label','Chart series');
    panels.forEach((panel,index)=>{
      const item=document.createElement('span'),label=`${panel.series.name} · ${panel.unit}`;
      item.setAttribute('class',`chart-legend-item series-${index}`);item.setAttribute('aria-label',label);item.setAttribute('title',label);
      const swatch=document.createElement('span');swatch.setAttribute('class',`chart-legend-swatch${bars||combo&&index===0?' is-bar':''}`);swatch.setAttribute('aria-hidden','true');
      item.append(swatch,`${panel.series.short} · ${panel.unit}`);list.append(item);
    });
    container.append(list);
  }
  const svg = svgElement('svg',{viewBox:`0 0 ${width} ${h}`,tabindex:0,role:'group','aria-label':`${title}. ${evidenceLabel}. Use left and right arrow keys for exact values.`,'aria-describedby':id},container);
  svgElement('title',{},svg,`${title} · ${panels[0].unit} · ${evidenceLabel}`);
  const unitLabel = svgElement('text',{x:left,y:14},svg);
  if(unitLines.length===1)unitLabel.textContent=unitLines[0];
  else unitLines.forEach((line,index)=>svgElement('tspan',{x:left,y:14+index*14},unitLabel,line));
  for (let index=0;index<tickValues.length;index++) {
    const value = tickValues[index];
    svgElement('line',{x1:left,x2:width-right,y1:y(value),y2:y(value),class:'gridline'},svg);
    svgElement('text',{x:left-8,y:y(value)+4,'text-anchor':'end'},svg,tickLabels[index]);
  }
  if((domain||hasBars)&&lo<=0&&hi>=0){
    svgElement('line',{
      x1:left,x2:width-right,y1:y(0),y2:y(0),class:'zero-reference',stroke:'currentColor',
      'stroke-opacity':'.6','stroke-dasharray':'3 3','aria-hidden':'true',
    },svg);
  }
  if(yReference!==undefined)svgElement('line',{x1:left,x2:width-right,y1:y(Number(yReference)),y2:y(Number(yReference)),class:'value-reference',stroke:'currentColor','stroke-opacity':'.5','stroke-dasharray':'4 4','aria-label':`Reference ${yReference}`},svg);
  const labelDates = curve ? ['1M','1Y','5Y','10Y','20Y','30Y'].filter(date=>orderedDates.includes(date)) : window
    ? [window.startDate, new Date(minX+(maxX-minX)/2).toISOString().slice(0,10), window.endDate]
    : [orderedDates[0], orderedDates[Math.floor((orderedDates.length-1)/2)], orderedDates.at(-1)];
  const uniqueLabelDates = [...new Set(curve&&width<500?labelDates.filter(date=>['1M','5Y','10Y','20Y','30Y'].includes(date)):!curve&&(endLabels?pw:width)<350?[labelDates[0],labelDates.at(-1)]:labelDates)];
  uniqueLabelDates.forEach((date,index) => {
    let label = curve ? date : window ? periodLabel({frequency:'Daily'},date) : chartDateLabel(panels,date);
    if (!curve && !window && panels[0].series.frequency === 'Weekly') label = label.replace('Week ending ','');
    svgElement('text',{x:xDate(date),y:h-((staggerCurveLabels||staggerDateLabels) && index%2===0 ? 24 : 8),'text-anchor':index===0?'start':index===uniqueLabelDates.length-1?'end':'middle'},svg,label);
  });
  panels.forEach((panel,index) => {
    const className = curve && index>0 ? ' previous' : ['', ' secondary', ' tertiary', ' quaternary'][index]??'';
    if(distribution) {
      // Each band has its own availability calendar; a missing median cannot erase it.
      for(const [name,low,high,opacity] of [['outer','percentile1','percentile99',.12],['inner','percentile25','percentile75',.26]]) {
        const segments=[];let segment=[];
        for(const observation of panel.observations) {
          if(finite(observation[low])&&finite(observation[high]))segment.push(observation);
          else if(segment.length){segments.push(segment);segment=[];}
        }
        if(segment.length)segments.push(segment);
        const path=segments.map(rows=>rows.map((o,i)=>`${i?'L':'M'}${xDate(o.date).toFixed(2)} ${y(o[high]).toFixed(2)}`).join(' ')
          +' '+[...rows].reverse().map(o=>`L${xDate(o.date).toFixed(2)} ${y(o[low]).toFixed(2)}`).join(' ')+' Z').join(' ');
        svgElement('path',{d:path,class:`funding-band ${name}`,fill:'var(--accent)','fill-opacity':opacity,stroke:'none','aria-hidden':'true'},svg);
      }
    }
    if (bars||combo&&index===0) {
      const desiredBarWidth=Math.min(30,pw/orderedDates.length*.6);
      const barWidth=combo?positions.slice(1).reduce((width,position,index)=>Math.min(width,(position-positions[index])/spanX*pw*.6),desiredBarWidth)
        :Math.max(4,desiredBarWidth);
      const latestDate=panel.observations.filter(o=>finite(o.value)).at(-1)?.date;
      panel.observations.filter(o=>finite(o.value)).forEach(o => {
        svgElement('rect',{x:xDate(o.date)-barWidth/2,y:Math.min(y(o.value),y(0)),width:barWidth,height:Math.max(1,Math.abs(y(o.value)-y(0))),class:`bar${combo&&o.date===latestDate?' latest-bar':''}`,'data-series-index':index},svg);
      });
    } else {
      let gap = true;
      const path = panel.observations.map(o => {
        if (!finite(o.value)) { gap=true; return ''; }
        const command = gap?'M':'L'; gap=false;
        return `${command}${xDate(o.date).toFixed(2)} ${y(o.value).toFixed(2)}`;
      }).join(' ');
      svgElement('path',{d:path,class:`series-line${className}`,'data-series-index':index},svg);
      panel.observations.forEach((observation,point,all)=>{
        if(finite(observation.value)&&!finite(all[point-1]?.value)&&!finite(all[point+1]?.value))
          svgElement('circle',{cx:xDate(observation.date),cy:y(observation.value),r:3,class:`dot${curve&&index>0?' previous':index%2?' secondary':''}${legend||endLabels||combo?` series-${index}`:''} isolated-point`,'aria-hidden':'true'},svg);
      });
    }
  });
  const placed=endpoints.map(endpoint=>({...endpoint,anchor:y(endpoint.observation.value)})).sort((a,b)=>a.anchor-b.anchor);
  let nextTop=top;
  for(const endpoint of placed){endpoint.top=Math.max(nextTop,endpoint.anchor-endpoint.height/2);nextTop=endpoint.top+endpoint.height+8;}
  let nextBottom=h-bottom;
  for(const endpoint of [...placed].reverse()){endpoint.top=Math.min(endpoint.top,nextBottom-endpoint.height);nextBottom=endpoint.top-8;}
  for(const endpoint of placed){
    const {index,observation,lines}=endpoint,labelX=width-right+8;
    const attributes={class:`chart-end-leader series-${index} endpoint-series-${index}`,'data-series-index':index,'aria-hidden':'true'};
    svgElement('line',{x1:xDate(observation.date),y1:endpoint.anchor,x2:labelX-4,y2:endpoint.top+endpoint.height/2,...attributes},svg);
    svgElement('circle',{cx:xDate(observation.date),cy:endpoint.anchor,r:3,class:`dot chart-end-dot series-${index} endpoint-series-${index}`,'data-series-index':index,'aria-hidden':'true'},svg);
    const text=svgElement('text',{x:labelX,y:endpoint.top+12,class:`chart-end-label series-${index} endpoint-series-${index}`,'data-series-index':index,'aria-label':endpoint.label},svg);
    lines.forEach((line,lineIndex)=>svgElement('tspan',{x:labelX,y:endpoint.top+12+lineIndex*16},text,line));
  }
  const guide = svgElement('line',{x1:0,x2:0,y1:top,y2:h-bottom,class:'guide'},svg);
  const dots = panels.map((_,index)=>svgElement('circle',{cx:0,cy:0,r:3,class:`dot${curve&&index>0?' previous':index%2?' secondary':''}${legend||endLabels||combo?` series-${index}`:''}`},svg));
  const hit = svgElement('rect',{x:left,y:top,width:pw,height:ph,fill:'transparent'},svg);
  const readout = document.createElement('div');
  readout.id=id; readout.className=`chart-readout${curve?' curve-readout':''}`; container.append(readout);
  if(!curve)appendMissingPeriods(container,panels);
  const inspected={date:null,svg};chartInspection.set(container,inspected);
  // If the exact observation leaves the window, inspect the latest visible date.
  const availableDates=cursor?.dates??orderedDates;
  const initialDate=availableDates.includes(previous?.date)?previous.date:availableDates.at(-1);
  let selected=Math.max(0,orderedDates.indexOf(initialDate));
  function select(index, announce = false) {
    selected = Math.max(0,Math.min(orderedDates.length-1,index));
    selectDate(orderedDates[selected],announce);
  }
  function selectDate(date,announce=false){
    if(!date)return;
    inspected.date=date;
    if(orderedDates.includes(date))selected=orderedDates.indexOf(date);
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
      const label=distribution?'Median':curve?panel.label:panel.series.short;
      const display = chartValueLabel(panel,value,transformed);
      span.className = `readout-series series-${panelIndex}`;
      span.append(`${label} `);
      const strong=document.createElement('strong'); strong.textContent=display; span.append(strong);
      if(distribution){
        for(const [label,field] of [['p1','percentile1'],['p25','percentile25'],['p75','percentile75'],['p99','percentile99']]) {
          const value=observation?.[field];span.append(` · ${label} ${finite(value)?`${value.toFixed(2)}%`:'—'}`);
        }
        const volume=observation?.volumeInBillions;
        span.append(` · Volume ${finite(volume)?`$${volume.toLocaleString('en-US',{maximumFractionDigits:12})}B`:'—'} (USD billions) · Revision flag ${observation?.revisionIndicator||'not supplied'}`);
        if(observation?.footnoteId!=null)span.append(` · Footnote ${observation.footnoteId}`);

      }
      const coverage=observationCoverageLabel(observation);if(coverage)span.append(` · ${coverage}`);
      for(const note of observationEvidence(panel.series,observation))span.append(` · ${note}`);
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
  if(cursor){if(initialDate&&cursor.date!==initialDate)cursor.select(initialDate);cursor.subscribe(({date,announce,origin})=>selectDate(date,announce&&origin===id));}else select(selected);
  if(restoreFocused&&(!document.activeElement||document.activeElement===document.body||document.activeElement===previous.svg))svg.focus?.({preventScroll:true});
}

/** Responsive view boxes avoid layout mutations inside ResizeObserver callbacks. */
export function renderCharts(root,{catalog,chartCatalogs={},inspection}={}) {
  const occurrences=new Map();
  const cursorCatalogs=new Map();
  root.querySelectorAll('[data-chart]').forEach(container => {
    const key=chartKey(container),occurrence=occurrences.get(key)??0;occurrences.set(key,occurrence+1);
    const previous=inspection?.get(key)?.[occurrence]??chartInspection.get(container);
    const renderDraw=(target,panels,options)=>draw(target,panels,{...options,inspection:previous});
    const scoped=Object.hasOwn(container.dataset,'chartCatalog');
    const binding=scoped&&chartCatalogs&&Object.hasOwn(chartCatalogs,container.dataset.chartCatalog)?chartCatalogs[container.dataset.chartCatalog]:null;
    if(scoped&&(!binding||!binding.catalog||typeof binding.catalog!=='object'||Array.isArray(binding.catalog)||typeof binding.evidenceLabel!=='string'||!binding.evidenceLabel.trim())){
      container.textContent='Chart data unavailable: the requested chart catalog is not bound.';return;
    }
    const selectedCatalog=scoped?binding.catalog:catalog;
    const lookup=id=>scoped?(Object.hasOwn(selectedCatalog,id)?selectedCatalog[id]:undefined):catalog?catalog[id]:getSeries(id);
    const evidenceLabel=scoped?binding.evidenceLabel.trim():catalog?'Frozen research snapshot':'Official snapshot';
    const {kind,transform='level',comparison='native'} = container.dataset;
    const height=Number(container.dataset.height)||180;
    // Curve charts use the live yield feed; a scoped chart must never borrow it.
    if(scoped&&(kind==='history-curve'||kind==='curve')){container.textContent='Chart data unavailable: yield curves are not supplied by this chart catalog.';return;}
    if(kind==='history-curve'){
      const curves=selectCurveOverlays(dataStatus.sources.yields,container.dataset.dates.split(',').filter(Boolean));
      renderDraw(container,curves.map(curve=>({series:{...getSeries('yield'),methodologyBreaks:[]},label:curve.date+(curve.available?'':' — unavailable'),unit:'Yield · % · elapsed maturity years',observations:NOMINAL_YIELD_TENORS.map(tenor=>({date:tenor,value:curve.nominal[tenor]??null,footnotes:observationEvidence({id:'yield',methodologyBreaks:dataStatus.sources.yields.methodologyBreaks},{date:curve.date})}))})),{height,curve:true,yDomain:container.dataset.yDomain});
      return;
    }
    if (kind === 'curve') {
      const reference=getSeries('yield');
      renderDraw(container,[
        {series:reference,label:`Latest (${dataStatus.curveDate ?? 'date unavailable'})`,unit:'Yield · %',observations:yieldCurve.map(p=>({date:p.tenor,value:p.value}))},
        {series:reference,label:`Prior (${dataStatus.previousCurveDate ?? 'date unavailable'})`,unit:'Yield · %',observations:yieldCurve.map(p=>({date:p.tenor,value:p.previous}))},
      ],{height,curve:true,yDomain:container.dataset.yDomain});
      return;
    }
    const ids=(scoped?container.dataset.series??'':container.dataset.series).split(',').filter(Boolean);
    const range=readChartRange(container.dataset.range,ids.map(lookup));
    if(scoped&&(!ids.length||ids.some(id=>!lookup(id)))){container.textContent='Chart data unavailable: one or more selected series are unavailable in the requested chart catalog.';return;}
    const combo=kind==='combo';
    if(combo){
      const selected=ids.map(lookup),first=selected[0];
      if(ids.length<2||new Set(ids).size!==ids.length||selected.some(item=>!item)||transform!=='level'||comparison!=='native'||container.dataset.panelId
        ||!first?.unit||!first?.frequency||selected.some(item=>item.unit!==first.unit||item.frequency!==first.frequency||item.format!==first.format)){
        container.textContent='Chart configuration error: combo charts require at least two distinct available series with matching native units, formats and frequencies, in untransformed native levels.';return;
      }
    }
    const distribution=kind==='funding-distribution';
    const fundingSpread=scoped&&container.dataset.chartCatalog==='funding'&&ids.length===1&&ids[0]==='sofrEffrSpread'&&kind==='line'&&transform==='level'&&comparison==='native';
    if(distribution||fundingSpread){
      if(distribution&&(!scoped||!['funding','specialist'].includes(container.dataset.chartCatalog)||ids.length!==1||!['sofr','effr'].includes(ids[0])||transform!=='level'||comparison!=='native')){
        container.textContent='Chart configuration error: funding distributions require one bound SOFR or EFFR population in published levels.';return;
      }
      const window=resolveDateWindow(range,Object.values(selectedCatalog)),panel=transformSeries(lookup(ids[0]),'level',range,window);
      if(panel.error){container.textContent=panel.error;return;}
      renderDraw(container,[panel],{height,evidenceLabel,yDomain:container.dataset.yDomain,distribution});return;
    }
    const endLabels=container.dataset.endLabels==='true';
    const result=combo||endLabels||comparison!=='native'||container.dataset.panelId?compareSeries(ids,comparison,range,selectedCatalog):{panels:ids.map(id=>transformSeries(lookup(id),transform,range))};
    if(comparison==='native'&&(container.dataset.panelId||endLabels)&&transform!=='level'&&!result.error)result.panels=result.panels.map(panel=>transformSeries(panel.series,transform,range,result.window));
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
    renderDraw(container,panels,{height,bars:kind==='bar',combo,legend:container.dataset.legend==='true',endLabels,transformed:transform==='change'||comparison==='difference',cursor:group?cursors.get(group):null,evidenceLabel,yDomain:container.dataset.yDomain,exactDomain:container.dataset.yDomainExact==='true',yReference:container.dataset.yReference});
  });
}
