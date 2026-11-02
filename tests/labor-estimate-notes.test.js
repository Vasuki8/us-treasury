import test from 'node:test';
import assert from 'node:assert/strict';
import {laborPage} from '../src/labor-page.js';
import {getSeries} from '../src/model.js';
import {defaults} from '../src/router.js';

const state={...defaults,saved:[],selected:[]};
const payrollRow=html=>html.match(/<tr data-series-row="payroll"[^]*?<\/tr>/)?.[0];

test('Labor catalog retains preliminary estimate notes separately from capture status',()=>{
 const payroll=getSeries('payroll'),before=payroll.observations;
 try{
  payroll.observations=[{date:'2026-09-01',value:55,footnotes:[{code:'P',text:'Preliminary'}]}];
  const html=laborPage(state),row=payrollRow(html);
  assert.ok(row);
  assert.match(row,/class="labor-status">[^<]*Captured<\/span>/);
  assert.match(row,/class="labor-estimate-note[^\"]*">Source note: Preliminary<\/span>/);
  assert.doesNotMatch(html,/\[object Object\]/);
  assert.match(html,/Preliminary payroll estimate/);
 }finally{payroll.observations=before;}
});

test('Labor catalog does not manufacture an estimate stage when source notes are absent',()=>{
 const payroll=getSeries('payroll'),before=payroll.observations;
 try{
  payroll.observations=[{date:'2026-09-01',value:55}];
  assert.doesNotMatch(payrollRow(laborPage(state)),/labor-estimate-note|Preliminary/i);
 }finally{payroll.observations=before;}
});

test('Labor catalog escapes and deduplicates mixed source-note representations',()=>{
 const payroll=getSeries('payroll'),before=payroll.observations;
 try{
  payroll.observations=[{date:'2026-09-01',value:55,footnotes:['Preliminary',{code:'P',text:'Preliminary'},{code:'X',text:'<source note>'}]}];
  const row=payrollRow(laborPage(state));
  assert.match(row,/Source note: Preliminary; &lt;source note&gt;/);
  assert.doesNotMatch(row,/<source note>|Preliminary; Preliminary|\[object Object\]/);
 }finally{payroll.observations=before;}
});
