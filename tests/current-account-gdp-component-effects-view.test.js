import {humanTimestamp} from '../src/ui-time.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountGdpTrailingFixture} from './helpers/current-account-gdp-trailing-fixture.js';
import {currentAccountGdpComponentEffectsPanel,currentAccountGdpComponentEffectsCsv} from '../src/current-account-gdp-component-effects-view.js';
import {currentAccountGdpContributionsChartCatalog,currentAccountGdpContributionsCsv} from '../src/current-account-gdp-contributions-view.js';
import {currentAccountGdpBalanceEffectsCsv} from '../src/current-account-gdp-balance-effects-view.js';
import {currentAccountGdpComponentEffects,CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS} from '../src/current-account-gdp-component-effects.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const range={preset:'custom',startDate:'2026-04-01',endDate:'2026-04-01'};
const records=csv=>{const [headers,...rows]=parseCsv(csv);return rows.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));};

test('component panel has a labeled four-component selector, two three-line charts, shared dates and exact latest readings',()=>{
 const html=currentAccountGdpComponentEffectsPanel(currentAccountGdpTrailingFixture(),range,{measure:'itaServicesBalance'});
 assert.match(html,/COMPONENT BALANCE &amp; GDP EFFECT HISTORY/i);assert.match(html,/id="current-account-effect-component"/);assert.match(html,
  /aria-label="Effect history component"/);assert.match(html,/value="itaServicesBalance" selected/);
 assert.equal((html.match(/<option /g)??[]).length,4);assert.equal((html.match(/data-chart-catalog="current-account-gdp-component-effects"/g)??[]).length,2);
 assert.match(html,/itaServicesBalanceQuarterlyBalanceEffect,itaServicesBalanceQuarterlyGdpEffect,itaServicesBalanceQuarterlyRatioChange/);
 assert.match(html,/itaServicesBalanceTrailingBalanceEffect,itaServicesBalanceTrailingGdpEffect,itaServicesBalanceTrailingRatioChange/);
 assert.match(html,/Q2 2026 versus Q1 2026/);assert.match(html,/percentage points/i);assert.match(html,/symmetric-two-order-v1/);assert.match(html,/not official BEA contributions/);assert.match(html,/five.*quarters/i);
 assert.match(html,/data-export-current-account-gdp-component-effects/);assert.doesNotMatch(html,/id="window-start"/);
});

test('component-only selection explicitly defaults to Goods and displays the selected component source clock',()=>{
 const sources=currentAccountGdpTrailingFixture();sources.beaIta.series.itaServicesBalance.provenance=[{...sources.beaIta.provenance[0],retrievedAt:'2026-10-23T22:22:22.000Z'}];
 const html=currentAccountGdpComponentEffectsPanel(sources,range,{measure:'itaServicesBalance'});assert.match(html,/Services balance/);
  assert.match(html,new RegExp(humanTimestamp("2026-10-23T22:22:22.000Z")));
 const fallback=currentAccountGdpComponentEffectsPanel(sources,range,{measure:'currentAccountBalance'});assert.match(fallback,/defaults to Goods/i);assert.match(fallback,/value="itaGoodsBalance" selected/);
});

test('optional chart catalog projects all24 component series independently of total and contribution bindings',()=>{
 const sources=currentAccountGdpTrailingFixture(),normal=currentAccountGdpContributionsChartCatalog(sources,{effects:true}),binding=currentAccountGdpContributionsChartCatalog(sources,{componentEffects:true,includeContributions:false,frozen:true});
 assert.equal(normal['current-account-gdp-component-effects'],undefined);assert.deepEqual(Object.keys(binding),['current-account-gdp-component-effects']);
 const catalog=binding['current-account-gdp-component-effects'];assert.equal(Object.keys(catalog.catalog).length,24);assert.match(catalog.evidenceLabel,/Frozen calculated/);
 for(const {id}of CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS){const expected=currentAccountGdpComponentEffects(sources,range,id);for(const series of Object.values(expected.series).flat())assert.deepEqual(catalog.catalog[series.id].observations,series.observations);}
});

test('selected CSV contains both horizon changes and unique selected-component/GDP lookback inputs with exact effects',()=>{
 for(const {id}of CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS){
  const sources=currentAccountGdpTrailingFixture(),rows=records(currentAccountGdpComponentEffectsCsv(sources,range,id)),metadata=rows[0],changes=rows.filter(row=>row.record_type==='change'),inputs=rows.filter(row=>row.record_type==='input'),expected=currentAccountGdpComponentEffects(sources,range,id);
  assert.equal(metadata.component_measure_id,id);assert.equal(metadata.effect_method,'symmetric-two-order-v1');assert.equal(changes.length,2);assert.equal(inputs.length,10);
  assert.deepEqual([...new Set(inputs.map(row=>row.input_series_id))].sort(),[id,'nominalGdp'].sort());assert.equal(new Set(inputs.map(row=>`${row.input_reference_quarter}|${row.input_series_id}`)).size,10);
  assert.deepEqual([...new Set(inputs.map(row=>row.input_reference_quarter))],['2025-04-01','2025-07-01','2025-10-01','2026-01-01','2026-04-01']);
  const info=JSON.parse(metadata.input_metadata_json);assert.deepEqual(Object.keys(info.beaIta),[id]);assert.deepEqual(info.bea.nominalGdp.sourceIds,['A191RC']);
  for(const row of changes){assert.equal(row.measure_id,id);assert.equal(row.component_measure_id,id);const e=expected.observations[0][row.horizon].effects[id];for(const [key,field]of [['balance_effect_percentage_points','balanceEffect'],['gdp_effect_percentage_points','gdpEffect'],['contribution_percentage_points','totalChange']])assert.equal(Number(row[key]),e[field]);}
 }
 assert.throws(()=>currentAccountGdpContributionsCsv(currentAccountGdpTrailingFixture(),range,{effects:true,componentMeasure:'currentAccountBalance'}),RangeError);
 assert.throws(()=>currentAccountGdpContributionsCsv(currentAccountGdpTrailingFixture(),range,{componentMeasure:'itaGoodsBalance'}),RangeError);
 assert.equal(currentAccountGdpBalanceEffectsCsv(currentAccountGdpTrailingFixture(),range).includes('component_measure_id'),false);
});

test('missing selected inputs stay missing without moving endpoint or suppressing another valid component',()=>{
 const sources=currentAccountGdpTrailingFixture();sources.beaIta.series.itaGoodsBalance.observations.at(-1).value=null;
 const html=currentAccountGdpComponentEffectsPanel(sources,range,{measure:'itaGoodsBalance'}),rows=records(currentAccountGdpComponentEffectsCsv(sources,range,'itaGoodsBalance'));
 assert.match(html,/Q2 2026 versus Q1 2026/);assert.match(html,/Unavailable/);for(const row of rows.filter(row=>row.record_type==='change')){assert.equal(row.balance_effect_percentage_points,'');assert.ok(row.effect_unavailable_reason);}
 assert.ok(records(currentAccountGdpComponentEffectsCsv(sources,range,'itaServicesBalance')).filter(row=>row.record_type==='change').every(row=>row.balance_effect_percentage_points!==''));
});

test('frozen component panel has recorded selection and reconstruction action; empty windows stay explicit',()=>{
 const html=currentAccountGdpComponentEffectsPanel(currentAccountGdpTrailingFixture(),range,{measure:'itaPrimaryIncomeBalance',frozen:true,packageId:'recorded-component'});
 assert.match(html,/Frozen component:.*Primary income/);assert.match(html,/data-export-frozen-current-account-gdp-component-effects="recorded-component"/);assert.doesNotMatch(html,/id="current-account-effect-component"|data-export-current-account-gdp-component-effects(?:[\s=>])/);assert.match(html,/reconstructed from recorded inputs/i);
 const invalid=currentAccountGdpComponentEffectsPanel({}, {preset:'custom',startDate:'2026-04-01',endDate:'2025-01-01'});assert.match(invalid,/unavailable/i);assert.match(invalid,/disabled/);
 assert.equal(records(currentAccountGdpComponentEffectsCsv({}, {preset:'all'},'itaGoodsBalance')).length,1);
});
