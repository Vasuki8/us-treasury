import test from 'node:test';
import assert from 'node:assert/strict';
import {series} from '../src/data.js';
import {defaults} from '../src/router.js';
import {indicatorPage} from '../src/indicator-page.js';
import {indicatorStats} from '../src/stitch-indicator-context.js';
import {familyStatRows} from '../src/stitch-family-view.js';
import {renderFamilyAnalysis} from '../src/stitch-family-analysis.js';
import {toCsv} from '../src/model.js';

const state=extra=>({...defaults,saved:[],selected:[],window:'all',...extra});
const footnotes=[{code:'P',text:' Preliminary <estimate> '},'Preliminary <estimate>',{code:'A',text:''},{code:'A'},' Source string & note ',{},null,12,{text:{unexpected:true}},{code:{unexpected:true}}];
const input=(id,value,extra={})=>({id,name:id,short:id,format:'percent',precision:2,unit:'Percent year over year',frequency:'Monthly',observations:[{date:'2026-09-01',value,footnotes}],...extra});
const assertNotes=html=>{
 assert.match(html,/Preliminary &lt;estimate&gt;/);
 assert.match(html,/Source footnote code A/);
 assert.match(html,/Source string &amp; note/);
 assert.doesNotMatch(html,/\[object Object\]|<estimate>|unexpected|>12</);
};
const withSeries=(replacements,run)=>{
 const originals=Object.fromEntries(Object.keys(replacements).map(id=>[id,series[id]]));
 Object.assign(series,replacements);
 try{return run();}finally{Object.assign(series,originals);}
};

test('indicator KPI and supporting rows normalize structured source notes before deduplication and escaping',()=>{
 const selected={...series.wages,observations:[{date:'2026-09-01',value:3.5,footnotes}]};
 withSeries({wages:selected},()=>{
  const html=indicatorStats(selected,state({seriesId:'wages'}));
  const card=html.match(/data-stat-series="wages"[^]*?<\/article>/)?.[0]??'';
  assertNotes(card);
  assert.equal((card.match(/Preliminary &lt;estimate&gt;/g)??[]).length,1);
  assert.equal((card.match(/Source footnote code A/g)??[]).length,1);
  const rows=familyStatRows([['Wages','wages']],state(),{seenNotes:new Set(['Preliminary <estimate>'])});
  assert.match(rows,/Source footnote code A/);
  assert.doesNotMatch(rows,/Preliminary|\[object Object\]/);
 });
});

test('family analysis preserves source object notes, code-only qualifiers and missing/imputed flags',()=>{
 const items={wages:input('wages',null,{observations:[{date:'2026-09-01',value:null,footnotes,imputed:true,imputationAffected:true,suppressed:true}]})};
 const html=renderFamilyAnalysis(items.wages,'earnings',id=>items[id],{sources:{}});
 assertNotes(html);
 assert.equal((html.match(/Preliminary &lt;estimate&gt;/g)??[]).length,1);
 assert.match(html,/Source-imputed monthly observation/);
 assert.match(html,/Window includes source-imputed months/);
 assert.match(html,/Suppressed by source/);
 assert.match(html,/All private employees · nominal[^]*?<span>—<\/span>/);
});

test('CPI weight and effect notes use the same source-note normalization as observation inputs',()=>{
 const row={id:'cpipress2.r.1.1',label:'Food',date:'2026-09-01',importance:13.5,importanceDate:'2026-08-01',footnotes};
 const source={tables:{detail:{date:row.date,rows:[row]},monthly:{date:row.date,rows:[{...row,id:'cpipress6.r.1.1',effect:0.01}]},annual:{date:row.date,rows:[{...row,id:'cpipress7.r.1.1',effect:0.1}]}}};
 const html=renderFamilyAnalysis(input('cpi',3),'cpi',()=>undefined,{sources:{cpiDetail:source}});
 assertNotes(html);
 const effects=html.match(/data-cpi-table="monthly" data-cpi-row="cpipress6.r.1.1"[^]*?<\/tr>/)?.[0]??'';
 assert.equal((effects.match(/Preliminary &lt;estimate&gt;/g)??[]).length,1);
 assert.equal((effects.match(/Source footnote code A/g)??[]).length,1);
});

test('selected history and family ledger display normalized source notes while leaving missing values unavailable',()=>{
 const selected={...series.wages,observations:[{date:'2026-09-01',value:null,footnotes,suppressed:true}]};
 withSeries({wages:selected},()=>{
  const html=indicatorPage(state({page:'indicator',seriesId:'wages'}));
  const ledger=html.match(/data-family-ledger="earnings"[^]*?<\/section>/)?.[0]??'';
  const history=html.match(/id="detail-content"[^]*?<\/table>/)?.[0]??'';
  for(const section of [ledger,history]){
   assertNotes(section);
   assert.equal((section.match(/Preliminary &lt;estimate&gt;/g)??[]).length,1);
   assert.equal((section.match(/Source footnote code A/g)??[]).length,1);
   assert.match(section,/Suppressed|SUPPRESSED/);
  }
  assert.match(ledger,/data-family-input="wages">—<\/td>/);
  assert.match(history,/<td class="num">—<\/td>/);
 });
});

test('ECI chart basis follows its annual NSA plotted series while the selected quarterly table and CSV retain native units',()=>{
 const selected={...series.eciCompensationQuarterly,observations:[{date:'2026-01-01',value:0.6},{date:'2026-04-01',value:0.8}]};
 const annual=Object.fromEntries(['Compensation','Wages','Benefits'].map((part,index)=>{
  const id=`eciCivilian${part}Annual`;
  return [id,{...series[id],dataStatus:'official',observations:[{date:'2026-04-01',value:3.5+index/10}]}];
 }));
 withSeries({eciCompensationQuarterly:selected,...annual},()=>{
  const html=indicatorPage(state({page:'indicator',seriesId:'eciCompensationQuarterly'}));
  const chart=html.match(/<div class="indicator-chart">[^]*?<\/section><\/div>/)?.[0]??'';
  assert.match(chart,/data-series="eciCivilianCompensationAnnual,eciCivilianWagesAnnual,eciCivilianBenefitsAnnual"/);
  assert.match(chart,/Quarterly · Percent year over year · Not seasonally adjusted · Official snapshot/);
  assert.doesNotMatch(chart,/Quarterly · Percent quarter over quarter/);
  const history=html.match(/id="detail-content"[^]*?<\/table>/)?.[0]??'';
  assert.match(history,/Percent quarter over quarter/);
  assert.match(history,/<td class="num">0\.80%<\/td>/);
  const csv=toCsv(['eciCompensationQuarterly'],{range:{preset:'all'}});
  assert.match(csv,/,0\.8,Percent quarter over quarter,Quarterly,Seasonally adjusted,/);
  assert.doesNotMatch(csv,/eciCivilianCompensationAnnual/);
  const change=indicatorPage(state({page:'indicator',seriesId:'eciCompensationQuarterly',transform:'change'})).match(/<div class="indicator-chart">[^]*?<\/section><\/div>/)?.[0]??'';
  assert.match(change,/data-series="eciCompensationQuarterly"/);
  assert.match(change,/Quarterly · Percentage points · Seasonally adjusted · Official snapshot/);
 });
});

test('chart metadata resolves the actual family catalog and falls back to the native ECI series when annual inputs are absent',()=>{
 const production={...series.productionHourlyEarnings,adjustment:'Not seasonally adjusted',dataStatus:'cached',observations:[{date:'2025-09-01',value:40},{date:'2026-09-01',value:44}]};
 withSeries({productionHourlyEarnings:production},()=>{
  const wage=indicatorPage(state({page:'indicator',seriesId:'wages'})).match(/<div class="indicator-chart">[^]*?<\/section><\/div>/)?.[0]??'';
  assert.match(wage,/data-chart-catalog="indicator-family"/);
  assert.match(wage,/Monthly · Percent year over year · Seasonally adjusted · Official snapshot/);
  assert.match(wage,/Monthly · Percent year over year · Not seasonally adjusted · Cached official snapshot/);
 });
 const emptyAnnual=Object.fromEntries(['Compensation','Wages','Benefits'].map(part=>{
  const id=`eciCivilian${part}Annual`;return [id,{...series[id],observations:[]}];
 }));
 withSeries(emptyAnnual,()=>{
  const chart=indicatorPage(state({page:'indicator',seriesId:'eciCompensationQuarterly'})).match(/<div class="indicator-chart">[^]*?<\/section><\/div>/)?.[0]??'';
  assert.match(chart,/data-series="eciCompensationQuarterly"/);
  assert.match(chart,/Quarterly · Percent quarter over quarter · Seasonally adjusted · Official snapshot/);
  assert.doesNotMatch(chart,/Annual compensation, wages and benefits/);
 });
});
