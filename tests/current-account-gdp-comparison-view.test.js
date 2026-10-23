import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../scripts/sources/http.mjs';
import {currentAccountGdpTrailingFixture as fixture} from './helpers/current-account-gdp-trailing-fixture.js';
import {currentAccountGdpTrailingCsv} from '../src/current-account-gdp-trailing-view.js';
import {currentAccountGdpBalanceEffectsPanel} from '../src/current-account-gdp-balance-effects-view.js';
import {currentAccountGdpComponentEffectsPanel} from '../src/current-account-gdp-component-effects-view.js';
import {currentAccountGdpAllComponentEffectsPanel} from '../src/current-account-gdp-all-component-effects-view.js';
const view=await import('../src/current-account-gdp-comparison-view.js').catch(()=>({}));
const all={preset:'all'},records=csv=>{const [headers,...rows]=parseCsv(csv);assert.equal(new Set(headers).size,headers.length);assert.ok(rows.every(row=>row.length===headers.length));return rows.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));};

test('live and frozen chart legends identify their measures without relying on theme-specific color names',()=>{
 const panels=[
  [view.currentAccountGdpComparisonPanel,/Chart readouts identify Quarterly and Trailing four quarters\./,false],
  [currentAccountGdpBalanceEffectsPanel,/Chart readouts identify Balance change effect and GDP-denominator effect\./,true],
  [currentAccountGdpComponentEffectsPanel,/Chart readouts identify Balance change effect and GDP-denominator effect\./,true],
  [currentAccountGdpAllComponentEffectsPanel,/Chart readouts identify Balance change effect and GDP-denominator effect\./,false],
 ];
 for(const [render,labels,combinedLine]of panels)for(const frozen of [false,true]){
  const html=render(fixture(),all,{frozen});
  assert.doesNotMatch(html,/lavender|teal/i,'Chart explanations must remain accurate in either color theme.');
  assert.match(html,labels,'Measures must be named explicitly alongside their chart.');
  if(combinedLine)assert.match(html,/The dashed third line is Combined ratio change\./);
 }
});

test('comparison panel supplies two labeled horizons, five-measure selector, all-five table and independent source evidence',()=>{
 assert.equal(typeof view.currentAccountGdpComparisonPanel,'function');
 const html=view.currentAccountGdpComparisonPanel(fixture(),all,{measure:'itaGoodsBalance'});
 assert.match(html,/QUARTERLY VS TRAILING FOUR QUARTERS/);assert.match(html,/data-chart-catalog="current-account-gdp-comparison"/);
 assert.match(html,/itaGoodsBalanceQuarterlyComparison,itaGoodsBalanceTrailingComparison/);
 assert.match(html,/id="current-account-comparison-measure"/);assert.match(html,/value="itaGoodsBalance" selected/);
 for(const label of ['Current account','Goods','Services','Primary income','Secondary income'])assert.ok(html.includes(label));
 assert.match(html,/Quarterly minus trailing/i);assert.match(html,/percentage points/);assert.match(html,/different.*horizons/i);assert.match(html,/not a revision/i);
 assert.match(html,/Q3 2025.*Q2 2026/);assert.match(html,/2026-10-23T04:21:42.080Z/);assert.match(html,/2026-10-23T02:56:31.625Z/);assert.match(html,/bea.gov\/help\/faq\/147/);
 assert.match(html,/CSV COMPARISON &amp; INPUTS/);assert.doesNotMatch(html,/id="window-start"/);
 const binding=view.currentAccountGdpComparisonChartCatalog(fixture())['current-account-gdp-comparison'];assert.equal(Object.keys(binding.catalog).length,10);assert.match(binding.evidenceLabel,/Calculated/);
});

test('optional comparison CSV extends the existing self-contained export without changing its default schema',()=>{
 const defaultRows=records(currentAccountGdpTrailingCsv(fixture(),all));assert.ok(defaultRows.every(row=>!Object.hasOwn(row,'comparison_measure_id')));
 const csv=currentAccountGdpTrailingCsv(fixture(),all,{comparisonMeasure:'itaGoodsBalance'}),rows=records(csv),metadata=rows.find(row=>row.record_type==='metadata'),ratios=rows.filter(row=>row.record_type==='ratio');
 assert.equal(metadata.comparison_measure_id,'itaGoodsBalance');assert.match(metadata.calculation,/quarterly minus trailing/i);
 assert.equal(ratios.length,6);const last=ratios.at(-1),q=100*-340/(36000/4),t=100*-1100/30000;
 assert.equal(Number(last.comparison_quarterly_value_percent),q);assert.equal(Number(last.comparison_trailing_value_percent),t);assert.equal(Number(last.comparison_gap_percentage_points),q-t);
 assert.equal(ratios[0].comparison_trailing_value_percent,'');assert.notEqual(ratios[0].comparison_quarterly_value_percent,'');assert.equal(ratios[0].comparison_gap_percentage_points,'');
 assert.equal(view.currentAccountGdpComparisonCsv(fixture(),all,'itaGoodsBalance'),csv);
 const originalInput=rows.find(row=>row.record_type==='input'&&row.reference_quarter==='2026-04-01');assert.equal(originalInput.itaGoodsBalance_source_value,'-340000');
 assert.equal(JSON.parse(metadata.input_metadata_json).bea.nominalGdp.retrievedAt,'2026-10-23T02:56:31.625Z');
 assert.throws(()=>currentAccountGdpTrailingCsv(fixture(),all,{comparisonMeasure:'nominalImports'}),/measure/i);
});

test('comparison views preserve latest endpoint missingness, cached status and finite-or-null gaps',()=>{
 const sources=fixture();sources.beaIta.series.itaGoodsBalance.observations[2].value=null;sources.bea.status='error';sources.bea.error='<blocked>';
 const html=view.currentAccountGdpComparisonPanel(sources,all,{measure:'itaGoodsBalance'});assert.match(html,/Cached input/);assert.match(html,/&lt;blocked&gt;/);assert.match(html,/Unavailable/);assert.match(html,/Q2 2026/);
 const rows=records(view.currentAccountGdpComparisonCsv(sources,all,'itaGoodsBalance')),last=rows.filter(row=>row.record_type==='ratio').at(-1);
 assert.notEqual(last.comparison_quarterly_value_percent,'');assert.equal(last.comparison_trailing_value_percent,'');assert.equal(last.comparison_gap_percentage_points,'');assert.match(last.comparison_trailing_unavailable_reason,/missing/i);
 assert.doesNotMatch(html,/>NaN|>Infinity|>undefined/);
});

test('empty, invalid and frozen comparison states stay explicit and frozen panels omit mutable controls',()=>{
 assert.match(view.currentAccountGdpComparisonPanel({},all),/unavailable/i);
 assert.match(view.currentAccountGdpComparisonPanel(fixture(),{preset:'custom',startDate:'2030-01-01',endDate:'2030-04-01'}),/No retained quarters/);
 const invalid={preset:'custom',startDate:'bad',endDate:'bad'};assert.match(view.currentAccountGdpComparisonPanel(fixture(),invalid),/unavailable/i);
 const frozen=view.currentAccountGdpComparisonPanel(fixture(),all,{measure:'itaServicesBalance',frozen:true});assert.match(frozen,/FROZEN QUARTERLY VS TRAILING/);assert.match(frozen,/Services/);assert.doesNotMatch(frozen,/data-export-current-account-gdp-comparison|id="current-account-comparison-measure"|data-window=/);
 assert.match(view.currentAccountGdpComparisonChartCatalog(fixture(),{frozen:true})['current-account-gdp-comparison'].evidenceLabel,/Frozen/);
});
