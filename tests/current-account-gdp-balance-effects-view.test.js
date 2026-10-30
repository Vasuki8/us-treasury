import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountGdpTrailingFixture} from './helpers/current-account-gdp-trailing-fixture.js';
import {currentAccountGdpBalanceEffectsPanel,currentAccountGdpBalanceEffectsCsv} from '../src/current-account-gdp-balance-effects-view.js';
import {currentAccountGdpContributionsCsv,currentAccountGdpContributionsChartCatalog} from '../src/current-account-gdp-contributions-view.js';
import {currentAccountGdpBalanceEffects} from '../src/current-account-gdp-balance-effects.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const range={preset:'custom',startDate:'2026-04-01',endDate:'2026-04-01'};
const records=csv=>{const [headers,...rows]=parseCsv(csv);return rows.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));};
const close=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-12,`${a} ≈ ${b}`);

test('balance effects view identifies the symmetric interaction allocation and keeps each horizon separate',()=>{
 const html=currentAccountGdpBalanceEffectsPanel(currentAccountGdpTrailingFixture(),range);
 assert.match(html,/BALANCE CHANGES VS GDP-DENOMINATOR EFFECTS/i);assert.equal((html.match
  (/data-chart-catalog="current-account-gdp-balance-effects"/g)??[]).length,2);
 assert.match(html,/Q2 2026 versus Q1 2026/);assert.match(html,/BALANCE EFFECT · PP/i);assert.match(html,/GDP-DENOMINATOR EFFECT · PP/i);
  assert.match(html,/COMBINED CHANGE · PP/i);
 assert.match(html,/symmetric two-order/i);assert.match(html,/interaction.*equally/i);assert.match(html,/not an official BEA contribution/i);assert.match(html,/not.*causal/i);
 assert.match(html,/not added again/i);assert.match(html,/five.*quarters/i);assert.match(html,/Reconciliation residual/);assert.match(html,/data-export-current-account-gdp-balance-effects/);
 assert.doesNotMatch(html,/id="window-start"/);
});

test('optional effect chart binding preserves default contributions and creates six calculated pp series',()=>{
 const sources=currentAccountGdpTrailingFixture(),original=currentAccountGdpContributionsChartCatalog(sources),combined=currentAccountGdpContributionsChartCatalog(sources,{effects:true,frozen:true});
 assert.deepEqual(Object.keys(original),['current-account-gdp-contributions']);
 assert.equal(Object.keys(combined['current-account-gdp-contributions'].catalog).length,8);
 const binding=combined['current-account-gdp-balance-effects'];assert.ok(binding);assert.equal(Object.keys(binding.catalog).length,6);assert.match(binding.evidenceLabel,/Frozen calculated/);
 for(const item of Object.values(binding.catalog)){assert.equal(item.unit,'Percentage points');assert.equal(item.observationType,'calculated');}
 const only=currentAccountGdpContributionsChartCatalog(sources,{effects:true,includeContributions:false});assert.deepEqual(Object.keys(only),['current-account-gdp-balance-effects']);
});

test('effect CSV appends the method, paired effects and signed flow inputs to existing evidence records',()=>{
 const sources=currentAccountGdpTrailingFixture(),expected=currentAccountGdpBalanceEffects(sources,range),rows=records(currentAccountGdpBalanceEffectsCsv(sources,range)),metadata=rows.find(row=>row.record_type==='metadata'),changes=rows.filter(row=>row.record_type==='change'),inputs=rows.filter(row=>row.record_type==='input');
 assert.equal(metadata.effect_method,'symmetric-two-order-v1');assert.match(metadata.calculation,/symmetric|two.order/i);assert.equal(changes.length,14);assert.equal(inputs.length,30);
 for(const row of changes){const e=expected.observations[0][row.horizon].effects[row.measure_id];close(Number(row.balance_effect_percentage_points),e.balanceEffect);close(Number(row.gdp_effect_percentage_points),e.gdpEffect);close(Number(row.contribution_percentage_points),e.totalChange);close(Number(row.balance_effect_percentage_points)+Number(row.gdp_effect_percentage_points),Number(row.contribution_percentage_points));assert.equal(Number(row.current_balance_billions),e.currentBalance);assert.equal(Number(row.prior_gdp_billions),e.priorGdp);}
 assert.deepEqual([...new Set(inputs.map(row=>row.input_reference_quarter))],['2025-04-01','2025-07-01','2025-10-01','2026-01-01','2026-04-01']);
 assert.equal(currentAccountGdpContributionsCsv(sources,range).includes('balance_effect_percentage_points'),false);
});

test('incomplete components preserve total effects and expose missing split reasons without filling them',()=>{
 const sources=currentAccountGdpTrailingFixture();sources.beaIta.series.itaGoodsBalance.observations.at(-1).value=null;
 const rows=records(currentAccountGdpBalanceEffectsCsv(sources,range)),html=currentAccountGdpBalanceEffectsPanel(sources,range);
 const missing=rows.find(row=>row.record_type==='change'&&row.horizon==='quarterly'&&row.measure_id==='itaGoodsBalance'),total=rows.find(row=>row.record_type==='change'&&row.horizon==='quarterly'&&row.measure_id==='currentAccountBalance');
 assert.equal(missing.balance_effect_percentage_points,'');assert.equal(missing.gdp_effect_percentage_points,'');assert.ok(missing.effect_unavailable_reason);assert.notEqual(total.balance_effect_percentage_points,'');assert.match(html,/Unavailable/);
});

test('frozen effect action reconstructs from a recorded package, while invalid or empty windows remain explicit',()=>{
 const html=currentAccountGdpBalanceEffectsPanel(currentAccountGdpTrailingFixture(),range,{frozen:true,packageId:'effect-proof'});
 assert.match(html,/FROZEN BALANCE CHANGES/i);assert.match(html,/data-export-frozen-current-account-gdp-balance-effects="effect-proof"/);
  assert.doesNotMatch(html,/data-export-current-account-gdp-balance-effects(?:[\s=>])/);assert.match(html,/reconstructed from recorded inputs/i);
 const invalid=currentAccountGdpBalanceEffectsPanel({}, {preset:'custom',startDate:'2026-04-01',endDate:'2025-01-01'});assert.match(invalid,/unavailable/i);assert.match(invalid,/disabled/);
 assert.equal(records(currentAccountGdpBalanceEffectsCsv({}, {preset:'all'})).length,1);
});
