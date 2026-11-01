import test from 'node:test';
import assert from 'node:assert/strict';
import {series} from '../src/data.js';
import {indicatorStats} from '../src/stitch-indicator-context.js';
import {familyStatRows} from '../src/stitch-family-view.js';
import {formatDisplayValue} from '../src/display-format.js';
import {periodLabel} from '../src/model.js';

const state={saved:[],selected:[],window:'all',transform:'level'};
const outsideDetails=html=>html.replace(/<details\b[^]*?<\/details>/g,'');

test('all eight family strips keep four ordered cards and a concise native reference/prior without repeated unit labels',()=>{
 for(const id of ['payroll','unrate','wages','eciCompensationQuarterly','laborProductivity','unitLaborCosts','cpi','pce']){
  const current=series[id],html=indicatorStats(current,{...state,seriesId:id});
  assert.equal((html.match(/<article class="indicator-stat/g)??[]).length,4,id);
  assert.doesNotMatch(html,/Native unit|<p class="indicator-change">/,id);
  const selected=html.match(new RegExp(`<article[^>]*data-stat-series="${id}"[^]*?</article>`))?.[0];
  assert.ok(selected,id+' primary native reading');
  assert.ok(selected.includes(formatDisplayValue(current,current.observations.at(-1)?.value)),id+' selected value');
  assert.ok(selected.includes(current.unit),id+' selected native unit');
  assert.ok(selected.includes(periodLabel(current,current.observations.at(-1)?.date)),id+' latest date');
  assert.ok(selected.includes(formatDisplayValue(current,current.observations.at(-2)?.value)),id+' prior value');
  assert.ok(selected.includes(periodLabel(current,current.observations.at(-2)?.date)),id+' prior date');
 }
});

test('payroll level may display millions only when it is supplementary and retains the original value/code',()=>{
 const payroll=indicatorStats(series.payroll,{...state,seriesId:'payroll'}),level=series.payrollLevel.observations.at(-1);
 const supplement=payroll.match(/data-stat-series="payrollLevel"[^]*?<\/article>/)?.[0]??'';
 assert.match(supplement,/Millions of jobs/);
 assert.ok(supplement.includes((level.value/1000).toFixed(2)+'M'));
 assert.ok(supplement.includes(level.value+' '+series.payrollLevel.unit));
 assert.ok(supplement.includes(series.payrollLevel.code));
 const selected=indicatorStats(series.payrollLevel,{...state,seriesId:'payrollLevel'}).match(/data-stat-series="payrollLevel"[^]*?<\/article>/)?.[0]??'';
 assert.ok(selected.includes(formatDisplayValue(series.payrollLevel,level.value)));
 assert.ok(selected.includes(series.payrollLevel.unit));assert.doesNotMatch(selected,/Millions of jobs/);
});

test('supporting dates appear when unaligned; repeated qualifications stay visible once with cached/missing statuses',()=>{
 const original=series.underemployment;
 series.underemployment={...original,dataStatus:'cached',error:'Delayed <capture>',observations:[{date:'2026-08-01',value:7.5,footnotes:['Preliminary <estimate>']}]};
 try{
  const unaligned=familyStatRows([['Broad rate','underemployment']],state,{referenceDate:'2026-09-01',referenceUnit:original.unit});
  assert.match(unaligned,/indicator-row-context">Aug 2026/);
  assert.match(unaligned,/Preliminary &lt;estimate&gt;/);assert.match(unaligned,/Cached reading/);assert.match(unaligned,/Delayed &lt;capture&gt;/);
  const aligned=familyStatRows([['Broad rate','underemployment']],state,{referenceDate:'2026-08-01',referenceUnit:original.unit});
  assert.doesNotMatch(aligned,/<small class="indicator-row-context">/);
  assert.match(aligned,/title="Percent · Aug 2026"/);
  series.underemployment={...series.underemployment,dataStatus:'unavailable',observations:[]};
  assert.match(familyStatRows([['Broad rate','underemployment']],state),/Unavailable reading/);
 }finally{series.underemployment=original;}
 const prior=series.payroll;
 series.payroll={...prior,dataStatus:'cached',error:'Source <warning>',observations:[...prior.observations.slice(0,-1),{...prior.observations.at(-1),footnotes:['Preliminary <estimate>','Preliminary <estimate>']}]};
 try{
  const visible=outsideDetails(indicatorStats(series.payroll,{...state,seriesId:'payroll'}));
  assert.match(visible,/Source &lt;warning&gt;/);assert.match(visible,/Cached reading/);
  const selected=visible.match(/data-stat-series="payroll"[^]*?<\/article>/)?.[0]??'';
  assert.equal((selected.match(/Preliminary &lt;estimate&gt;/g)??[]).length,1);
 }finally{series.payroll=prior;}
});

test('a missing supplementary payroll level remains unavailable without attempting a display conversion',()=>{
 const original=series.payrollLevel;delete series.payrollLevel;
 try{
  const html=indicatorStats(series.payroll,{...state,seriesId:'payroll'}),level=html.match(/data-stat-series="payrollLevel"[^]*?<\/article>/)?.[0]??'';
  assert.match(level,/big-value">—<\/strong>/);assert.match(level,/Unavailable reading/);
  assert.doesNotMatch(html,/NaN|Infinity|undefined|Millions of jobs/);
 }finally{series.payrollLevel=original;}
});

test('supporting payroll units do not repeat the compact formatter’s thousands suffix',()=>{
 const html=familyStatRows([['Monthly jobs','payroll']],state);
 assert.match(html,/k<\/a><small class="indicator-row-context">[^<]*jobs<\/small>/);
 assert.doesNotMatch(html,/k jobs|k jobs\/month/);
});
