import { releases, dataStatus } from './data.js';
import { filterSeries, getSeries, latest, formatValue, formatChange, toCsv } from './model.js';
import {fiscalFinancingCsv} from './research-exports.js';
import {refinancingCsv} from './refinancing-page.js';
import {yieldCurvesCsv} from './yields-page.js';
import {auctionsCsv} from './auctions-page.js';
import {isResearchPage} from './research-navigation.js';
import { renderPage } from './pages.js';
import { escapeHtml as esc, sourceStatusList, sourceNotice } from './ui.js';
import { mountFreshnessBanner } from './freshness-controller.js';
import { renderCharts } from './charts.js';
import { parseRoute, routeFor } from './router.js';
import { readPreferences, writePreferences } from './storage.js';

const root = document.getElementById('app');
const main = document.getElementById('main-content');
const status = document.getElementById('app-status');
// Recheck source age while keeping native disclosure state independent of routes.
mountFreshnessBanner(document.getElementById('data-freshness'),dataStatus);
let storage;
try { storage = window.localStorage; } catch { /* Session remains usable without persistence. */ }
let state = { ...parseRoute(location.hash), ...readPreferences(storage) };
const pageNames = {overview:'Overview',labor:'Labor Market',indicator:'Indicator Detail',calendar:'Calendar',explore:'Explore Data',fiscal:'Fiscal pressure',refinancing:'Refinancing risk',yields:'Yield explanations',auctions:'Auction demand'};

document.querySelector('.skip-link').addEventListener('click',event=>{
  event.preventDefault();
  main.focus();
});

function announce(message) { status.textContent=message; }
function downloadCsv(content,filename,notice){
  const url=URL.createObjectURL(new Blob(['\ufeff',content],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce(notice);
}
function persist() {
  state.storageAvailable=writePreferences(storage,state);
  return state.storageAvailable;
}

function rememberFocus() {
  const active=document.activeElement;
  if (!main.contains(active))return null;
  return {id:active.id,tag:active.tagName,data:{...active.dataset},start:active.selectionStart,end:active.selectionEnd};
}
function restoreFocus(focus) {
  if (!focus)return;
  let element=focus.id?document.getElementById(focus.id):null;
  if (!element && Object.keys(focus.data).length) {
    element=[...main.querySelectorAll(focus.tag)].find(node=>Object.entries(focus.data).every(([key,value])=>node.dataset[key]===value));
  }
  if (!element)return;
  element.focus({preventScroll:true});
  if (typeof focus.start==='number' && typeof element.setSelectionRange==='function') {
    try {element.setSelectionRange(focus.start,focus.end);} catch { /* Not all input types support selections. */ }
  }
}

function render({focusHeading=false,preserveFocus=false}={}) {
  const focus=preserveFocus?rememberFocus():null;
  root.dataset.theme=state.theme;
  root.dataset.density=state.density;
  document.getElementById('theme-select').value=state.theme;
  document.getElementById('density-select').value=state.density;
  main.innerHTML=`<div class="breadcrumbs"><a href="#/overview">US</a><span>/</span><span>${esc(pageNames[state.page].toUpperCase())}</span></div>${renderPage(state)}`;
  root.querySelectorAll('[data-nav]').forEach(link=>{
    if(link.dataset.nav===state.page||link.dataset.nav==='research'&&isResearchPage(state.page))link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  });
  for(const id of ['indicator-nav','indicator-rail']) document.getElementById(id).href=`#/series/${state.seriesId}`;
  document.getElementById('ticker').innerHTML=['yield','unrate','cpi','payroll'].map(id=>{
    const item=getSeries(id);
    return `<a href="#/series/${id}"><span>${esc(item.code)}</span><strong>${esc(formatValue(item,latest(item)?.value))}</strong><span class="mono">${esc(formatChange(item))}</span></a>`;
  }).join('');
  document.getElementById('saved-count').textContent=state.saved.length;
  document.getElementById('saved-list').innerHTML=state.saved.length?state.saved.map(id=>`<div class="saved-item"><a href="#/series/${id}">${esc(getSeries(id).short)}</a><button type="button" data-save="${id}" aria-label="Remove ${esc(getSeries(id).name)} from watchlist">×</button></div>`).join(''):'<p class="rail-note">No saved series.<br>Open an indicator to save it.</p>';
  document.getElementById('source-status').innerHTML=sourceStatusList(dataStatus.sources,{compact:true});
  document.getElementById('source-notice').innerHTML=sourceNotice(dataStatus.sources);
  document.getElementById('snapshot-time').textContent=`OFFICIAL SNAPSHOT · ASSEMBLED ${dataStatus.generatedAt ?? 'UNAVAILABLE'}`;
  document.title=`${state.page==='indicator'?getSeries(state.seriesId).name:pageNames[state.page]} — Meridian`;
  renderCharts(main);
  if(focusHeading) {
    const heading=main.querySelector('h1');
    heading.tabIndex=-1;heading.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  } else restoreFocus(focus);
}

function navigate(patch,{replace=false,preserveFocus=true}={}) {
  const previous={page:state.page,seriesId:state.seriesId};
  state={...state,...patch};
  const route=routeFor(state);
  if(location.hash!==route)history[replace?'replaceState':'pushState'](null,'',route);
  render({focusHeading:previous.page!==state.page || previous.seriesId!==state.seriesId,preserveFocus});
}

window.addEventListener('hashchange',()=>{
  if(location.hash==='#main-content'){main.focus();return;}
  const route=parseRoute(location.hash), oldPage=state.page, oldId=state.seriesId;
  if(route.page!=='indicator')route.seriesId=state.seriesId;
  if(route.page!=='explore' || !location.hash.includes('selected='))route.selected=state.selected;
  state={...state,...route};
  render({focusHeading:oldPage!==state.page || oldId!==state.seriesId});
});

function save(id) {
  if(!getSeries(id))return;
  const wasSaved=state.saved.includes(id);
  state.saved=wasSaved?state.saved.filter(value=>value!==id):[...state.saved,id];
  const durable=persist();
  render({preserveFocus:true});
  announce(wasSaved?`${getSeries(id).short} removed from watchlist.`:`${getSeries(id).short} saved ${durable?'in this browser':'for this session; browser storage is unavailable'}.`);
}

function exportCsv(selection=null) {
  const ids=selection??(state.page==='indicator'?[state.seriesId]:state.selected);
  if(!ids.length){announce('Select at least one series to export.');return;}
  try {
    const comparison=state.page==='explore' && state.exploreMode==='compare'?state.comparison:'native';
    const content=toCsv(ids,{transform:state.page==='indicator'?state.transform:'level',range:state.range,comparison});
    downloadCsv(content,`meridian-${ids.join('-')}.csv`,'CSV downloaded with displayed observations, units, official source identifiers, retrieval times and per-series data status. Unknown publication dates remain empty.');
  } catch(error) {announce(`Export unavailable: ${error.message}`);}
}

root.addEventListener('click',async event=>{
  const button=event.target.closest('button');
  if(!button)return;
  const d=button.dataset;
  if('reloadSnapshot' in d){
    const url=new URL(window.location.href);
    url.searchParams.set('_refresh',Date.now().toString(36));
    window.location.replace(url.href);
  }
  else if('save' in d)save(d.save);
  else if('series' in d && getSeries(d.series))navigate({page:'indicator',seriesId:d.series,transform:'level',tab:'data'});
  else if('page' in d && pageNames[d.page])navigate({page:d.page});
  else if('compare' in d)navigate({page:'explore',selected:[...new Set(d.compare.split(',').filter(id=>getSeries(id)))].slice(0,4),exploreMode:'compare',comparison:'native'});
  else if('event' in d){
    const selected=releases.find(release=>release.id===d.event);
    if(selected)navigate(state.page==='calendar'?{eventId:selected.id}:{page:'calendar',eventId:selected.id,calendarMonth:selected.date.slice(0,7),day:'all',calendarTopic:'All topics',watchOnly:false});
  }
  else if('range' in d)navigate({range:Number(d.range)});
  else if('tab' in d)navigate({tab:d.tab});
  else if('exploreMode' in d)navigate({exploreMode:d.exploreMode});
  else if('remove' in d)navigate({selected:state.selected.filter(id=>id!==d.remove)});
  else if('day' in d)navigate({day:d.day});
  else if('resetFilters' in d)navigate({query:'',topic:'All topics',frequency:'All frequencies'});
  else if('resetCalendar' in d)navigate({calendarMonth:'upcoming',day:'all',calendarTopic:'All topics',watchOnly:false});
  else if('export' in d)exportCsv();
  else if('exportFiscal' in d)exportCsv(['receipts','outlays','netInterest','budgetDeficit','primaryDeficit','receiptsTtm','outlaysTtm','netInterestTtm','primaryDeficitTtm','interestRevenueRatio','publicDebt']);
  else if('exportFiscalFinancing' in d){
    downloadCsv(fiscalFinancingCsv(dataStatus.sources.fiscal),'meridian-fiscal-financing.csv','MTS financing CSV downloaded with reported amounts and calculated residuals; release dates remain unknown.');
  }
  else if('exportRefinancing' in d||'exportRefinancingScenario' in d)downloadCsv(refinancingCsv(dataStatus.sources.refinancing,{scenario:'exportRefinancingScenario' in d,horizonMonths:state.refinancingHorizon,shockBps:state.refinancingShock}),'meridian-refinancing.csv','Refinancing CSV downloaded with observed principal, generated identifiers and explicitly modeled assumptions.');
  else if('exportYieldCurves' in d)downloadCsv(yieldCurvesCsv(dataStatus.sources.yields,state),'meridian-yield-curves.csv','Selected historical curves downloaded; input URLs and calculated compensation are labeled.');
  else if('exportYieldIndicators' in d)exportCsv(['spread2s10s','spread3m10y','realYield10','inflationComp10','nominalYield2','nominalYield3m']);
  else if('auctionId' in d)navigate({auctionId:d.auctionId});
  else if('exportAuctions' in d||'exportAuctionBenchmark' in d)downloadCsv(auctionsCsv(dataStatus.sources.auctions,{securityType:state.auctionType,auctionId:state.auctionId,benchmark:'exportAuctionBenchmark' in d}),'meridian-auctions.csv','Auction CSV downloaded with matching scope, observed results, calculated allocations and source provenance.');
  else if('copyLink' in d) {
    try {await navigator.clipboard.writeText(location.href);announce('Link copied with the current series, range, view and tab.');}
    catch {announce('Copy is unavailable. The address bar contains the shareable link.');}
  }
});

root.addEventListener('change',event=>{
  const target=event.target;
  if(target.id==='theme-select' || target.id==='density-select') {
    const preference=target.id==='theme-select'?'theme':'density';
    state[preference]=target.value;
    const durable=persist();render({preserveFocus:true});
    announce(durable?'Appearance saved in this browser.':'Appearance changed for this session; browser storage is unavailable.');
    return;
  }
  const fields={'topic-filter':'topic','frequency-filter':'frequency','transform-select':'transform','comparison-select':'comparison','calendar-topic':'calendarTopic','yield-curve-date-a':'yieldDateA','yield-curve-date-b':'yieldDateB','auction-type':'auctionType'};
  if(target.id==='refinancing-horizon')navigate({refinancingHorizon:Number(target.value)});
  else if(target.id==='refinancing-shock')navigate({refinancingShock:Number(target.value)});
  else if(target.id==='calendar-month')navigate({calendarMonth:target.value,day:'all'});
  else if(target.id==='calendar-day')navigate({day:target.value});
  else if(fields[target.id])navigate({[fields[target.id]]:target.value});
  else if(target.id==='calendar-watch-only')navigate({watchOnly:target.checked});
  else if(target.matches('[data-select]')) {
    const id=target.dataset.select;
    if(target.checked && state.selected.length>=4){target.checked=false;announce('Compare up to four series. Remove a selected series first.');return;}
    navigate({selected:target.checked?[...new Set([...state.selected,id])]:state.selected.filter(value=>value!==id)},{replace:true});
  }
});

root.addEventListener('input',event=>{
  if(event.target.id==='catalog-search')navigate({query:event.target.value},{replace:true});
});

document.getElementById('command-form').addEventListener('submit',event=>{
  event.preventDefault();
  const input=document.getElementById('command-input'), query=input.value.trim().replace(/<go>/ig,'').trim();
  const command=query.toUpperCase();
  const pages={US:'overview',OVERVIEW:'overview',LABOR:'labor',CAL:'calendar',CALENDAR:'calendar',FIND:'explore',EXPLORE:'explore'};
  if(pages[command])navigate({page:pages[command]});
  else {
    const matches=filterSeries({query});
    if(query && matches.length===1)navigate({page:'indicator',seriesId:matches[0].id,transform:'level',tab:'data'});
    else navigate({page:'explore',query,topic:'All topics',frequency:'All frequencies',exploreMode:'catalog'});
    announce(matches.length?`${matches.length} matching series.`:'No matching series. Try jobs, GDP, CPI or Treasury.');
  }
  input.value='';
});

document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
    event.preventDefault();document.getElementById('command-input').focus();return;
  }
  const editable=event.target.matches('input,select,textarea,[contenteditable]');
  const key=['F1','F2','F3','F4','F5'].indexOf(event.key);
  if(key>=0 && !editable){event.preventDefault();navigate({page:['overview','labor','indicator','calendar','explore'][key]});}
  const tab=event.target.closest('[role="tab"]');
  if(tab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
    event.preventDefault();
    const tabs=[...tab.parentElement.querySelectorAll('[role="tab"]')], index=tabs.indexOf(tab);
    const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length;
    const id=tabs[next].id;tabs[next].click();document.getElementById(id)?.focus();
  }
});

let resizeFrame;
window.addEventListener('resize',()=>{
  cancelAnimationFrame(resizeFrame);
  resizeFrame=requestAnimationFrame(()=>renderCharts(main));
});

render();
if(!location.hash || location.hash==='#/')history.replaceState(null,'',routeFor(state));
if(!state.storageAvailable)announce('Browser storage is unavailable; watchlists and preferences will last for this session.');
