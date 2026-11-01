import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewPage} from '../src/overview-page.js';
import {laborPage} from '../src/labor-page.js';
import {indicatorPage} from '../src/indicator-page.js';
import {series} from '../src/data.js';
import {defaults} from '../src/router.js';
import {latest,periodLabel} from '../src/model.js';
import {formatDisplayValue} from '../src/display-format.js';
import {createOverviewDisclosureMemory} from '../src/overview-disclosures.js';
import {createResearchSaveDrafts,renderResearchSave} from '../src/research-save.js';
import {measurementChange} from '../src/measurement-change.js';

const state=overrides=>({...defaults,saved:[],selected:[],...overrides});
const count=(html,text)=>html.split(text).length-1;
function outsideDetails(html){
 let depth=0,result='';
 for(const match of html.matchAll(/<\/?details\b[^>]*>|[^<]+|<(?!\/?details\b)[^>]*>/g)){
  const token=match[0];
  if(token.startsWith('<details'))depth++;
  else if(token.startsWith('</details'))depth--;
  else if(!depth)result+=token;
 }
 return result;
}

test('Overview combines each top reading with context instead of a repeated briefing row',()=>{
 const html=overviewPage(state()),top=html.slice(0,html.indexOf('class="stitch-workstation"'));
 assert.doesNotMatch(top,/class="reading-brief/);
 const cards=[...top.matchAll(/<article class="oh-topic stitch-card"[^]*?<\/article>/g)].map(match=>match[0]);
 for(const id of ['gdp','pceCore','unrate','yield']){
  assert.equal(count(top,`data-overview-reading="${id}"`),1,id);
  const card=cards.find(card=>card.includes(`data-overview-reading="${id}"`));
  assert.ok(card,id);
  assert.ok(card.includes(formatDisplayValue(series[id],latest(series[id])?.value)),id+' value');
  assert.ok(card.includes(periodLabel(series[id],latest(series[id])?.date)),id+' period');
 }
 assert.match(top,/data-overview-disclosure="reading-context:gdp"/);
 assert.match(top,/data-overview-disclosure="reading-context:pceCore"/);
 assert.match(html,/Does recent inflation match the annual trend\?/);
 assert.match(html,/stitch-monitor-meta"><span>Net interest burden<\/span>/);
});

test('Labor gives four readings one home and keeps hero actions reachable in a native menu',()=>{
 const html=laborPage(state()),top=html.slice(0,html.indexOf('class="labor-revision-context"'));
 assert.doesNotMatch(top,/labor-reading-guide/);
 assert.equal(count(top,'class="labor-metric"'),4);
 for(const id of ['payroll','unrate','participation','wages'])assert.equal(count(top,`data-labor-reading="${id}"`),1,id);
 const menu=top.match(/<details class="labor-action-menu"[^]*?<\/details>/)?.[0];
 assert.ok(menu);assert.match(menu,/<summary>More actions<\/summary>/);
 for(const marker of ['data-compare="unrate,claims"','data-export-macro-measure','data-labor-section="labor-notes"'])assert.ok(menu.includes(marker),marker);
 assert.match(outsideDetails(top),/data-save="payroll"/);
 assert.equal(count(top,'class="labor-source-line"'),1);
});

test('Labor More actions stays open around an open Save panel after a measurement selection redraw',()=>{
 const memory=createOverviewDisclosureMemory(),drafts=createResearchSaveDrafts(),scope='labor';
 const menuNode=html=>{
  const tag=html.match(/<details class="labor-action-menu"[^>]*>/)?.[0]??'';
  const key=tag.match(/data-page-disclosure="([^"]+)"/)?.[1];
  assert.equal(key,'labor-actions','the native outer menu must participate in existing disclosure memory');
  return {dataset:{pageDisclosure:key},open:/\sopen(?:\s|>)/.test(tag)};
 };
 const outer=menuNode(laborPage(state()));outer.open=true;
 drafts.update(scope,{name:'Labor research',selected:['payroll','unrate'],open:true});
 memory.capture({querySelectorAll:()=>[outer]});
 drafts.update(scope,{selected:['unrate']});
 const redrawn=menuNode(laborPage(state())),save=renderResearchSave({scope,draft:drafts.get(scope),candidates:['payroll','unrate'],catalog:series});
 memory.restore({querySelectorAll:()=>[redrawn]});
 assert.equal(redrawn.open,true,'redraw must leave the outer menu open');
 assert.match(save,/<details class="context-save"[^>]* open>/,'Save remains open inside the menu');
 assert.match(save,/data-freeze-select="unrate" checked/);assert.doesNotMatch(save,/data-freeze-select="payroll" checked/);
 outer.open=false;memory.capture({querySelectorAll:()=>[outer]});
 const closed=menuNode(laborPage(state()));memory.restore({querySelectorAll:()=>[closed]});assert.equal(closed.open,false,'an intentional close is also remembered');
});

test('Labor headline comparisons keep their prior period compact and preserve the full explanation as a title',()=>{
 const html=laborPage(state());
 for(const id of ['unrate','participation','wages']){
  const card=html.match(new RegExp(`data-labor-reading="${id}"[^]*?</article>`))?.[0]??'';
  const change=measurementChange(series[id]),reading=card.match(/<p class="labor-metric-change"[^>]*>([^<]+)<\/p>/)?.[1];
  assert.ok(reading,id);
  assert.ok(reading.includes(change.priorPeriod),id+' prior reference');
  assert.ok(!reading.includes('previous retained observation'),id+' concise comparison');
  assert.ok(card.includes(`title="${change.text}"`),id+' complete explanation');
 }
});

test('headline warnings remain visible when interpretation is collapsed',()=>{
 const old=series.payroll;
 series.payroll={...old,dataStatus:'cached',error:'Delayed <source>',observations:[{date:'2026-08-01',value:45},{date:'2026-09-01',value:null,footnotes:['Preliminary <estimate>']} ]};
 try{
  const labor=laborPage(state()),headlines=outsideDetails(labor.slice(0,labor.indexOf('class="labor-revision-context"')));
  for(const pattern of [/Cached/,/Delayed &lt;source&gt;/,/Preliminary &lt;estimate&gt;/,/<strong>—<\/strong>/])assert.match(headlines,pattern);
  const overview=overviewPage(state()),monitor=outsideDetails(overview.slice(overview.indexOf('class="oh-monitor"'),overview.indexOf('class="stitch-card stitch-provenance"')));
  for(const pattern of [/CACHED/,/Delayed &lt;source&gt;/,/Preliminary &lt;estimate&gt;/,/reading-value">—/])assert.match(monitor,pattern);
 }finally{series.payroll=old;}
});

test('indicator selected native reading precedes history and related readings follow it',()=>{
 for(const id of ['payroll','payrollLevel','underemployment','wages','eciCompensation','cpiCoreMonthly']){
  const html=indicatorPage(state({seriesId:id,transform:'level'})),chart=html.indexOf('class="indicator-chart"');
  const selected=html.match(/<section class="indicator-snapshot"[^]*?<\/section>/)?.[0]??'';
  assert.equal((selected.match(/<article class="indicator-stat(?: |")/g)??[]).length,1,id);
  assert.match(selected,new RegExp(`data-stat-series="${id}"`));
  assert.ok(selected.includes(formatDisplayValue(series[id],latest(series[id])?.value)),id+' selected value');
  assert.ok(html.indexOf('class="indicator-reading-context"')>chart,id+' related context below history');
  const context=html.match(/<details class="indicator-reading-context"[^]*?<\/details>/)?.[0]??'';
  assert.equal((context.match(/<article class="indicator-stat(?: |")/g)??[]).length,4,id+' retained related slots');
  assert.match(context,new RegExp(`data-page-disclosure="indicator-context-${id}"`));
  for(const marker of ['data-legend="true"','data-end-labels="true"','data-export','data-copy-link'])assert.ok(html.includes(marker),marker);
 }
 const payroll=indicatorPage(state({seriesId:'payroll',transform:'level'}));
 assert.doesNotMatch(payroll.slice(payroll.indexOf('class="indicator-chart"'),payroll.indexOf('class="indicator-reading-context"')),/U-3 and U-6/);
 assert.match(indicatorPage(state({seriesId:'unrate',transform:'level'})),/overlay[^]*?U-3 and U-6 have different denominators/);
 assert.match(indicatorPage(state({seriesId:'wages'})),/Average hourly earnings reflect the employee/);
});
