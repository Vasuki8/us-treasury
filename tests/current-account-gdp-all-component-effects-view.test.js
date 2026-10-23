import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountGdpTrailingFixture} from './helpers/current-account-gdp-trailing-fixture.js';
import {currentAccountGdpAllComponentEffectsPanel,currentAccountGdpAllComponentEffectDomain} from '../src/current-account-gdp-all-component-effects-view.js';
import {currentAccountGdpBalanceEffects} from '../src/current-account-gdp-balance-effects.js';
import {CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS} from '../src/current-account-gdp-component-effects.js';
import {currentAccountGdpBalanceEffectsCsv} from '../src/current-account-gdp-balance-effects-view.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const range={preset:'custom',startDate:'2026-04-01',endDate:'2026-04-01'};
const decode=text=>text.replaceAll('&quot;','"').replaceAll('&amp;','&');

test('all-component view compares four labeled rows and two horizons with identical scale, window and cursor',()=>{
 const sources=currentAccountGdpTrailingFixture(),html=currentAccountGdpAllComponentEffectsPanel(sources,range),charts=[...html.matchAll(/<div class="chart"[^>]+>/g)].map(match=>match[0]);
 assert.equal(charts.length,8);assert.equal((html.match(/class="all-component-effect-row"/g)??[]).length,4);
 const domains=charts.map(chart=>JSON.parse(decode(chart.match(/data-y-domain="([^"]+)"/)[1])));
 assert.ok(domains.every(domain=>JSON.stringify(domain)===JSON.stringify(domains[0])));assert.ok(domains[0][0]<=0&&domains[0][1]>=0);
 for(const chart of charts){assert.match(chart,/data-chart-catalog="current-account-gdp-component-effects"/);assert.match(chart,/data-cursor-group="current-account-all-component-effects"/);assert.deepEqual(JSON.parse(decode(chart.match(/data-range="([^"]+)"/)[1])),range);assert.doesNotMatch(chart,/RatioChange/);}
 for(const {id,label}of CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS){assert.match(html,new RegExp(`${id}QuarterlyBalanceEffect,${id}QuarterlyGdpEffect`));assert.match(html,new RegExp(`${id}TrailingBalanceEffect,${id}TrailingGdpEffect`));assert.match(html,new RegExp(label));}
 assert.match(html,/One shared.*scale/i);assert.match(html,/Q2 2026 versus Q1 2026/);assert.match(html,/not official BEA contributions/);assert.match(html,/data-export-current-account-gdp-all-component-effects/);assert.doesNotMatch(html,/id="window-start"|<select/);
});

test('shared domain uses only finite displayed effects including zero, excluding combined changes and out-of-window history',()=>{
 const result=currentAccountGdpBalanceEffects(currentAccountGdpTrailingFixture(),range),values=result.observations.flatMap(row=>['quarterly','trailing'].flatMap(key=>CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS.flatMap(({id})=>[row[key].effects[id].balanceEffect,row[key].effects[id].gdpEffect]))).filter(Number.isFinite);
 const expected=[Math.min(0,...values),Math.max(0,...values)];assert.deepEqual(currentAccountGdpAllComponentEffectDomain(result),expected);
 const copy=structuredClone(result);copy.allObservations[0].quarterly.effects.itaGoodsBalance.balanceEffect=-1e9;copy.observations[0].quarterly.effects.itaGoodsBalance.totalChange=1e9;assert.deepEqual(currentAccountGdpAllComponentEffectDomain(copy),expected);
 assert.equal(currentAccountGdpAllComponentEffectDomain({...result,observations:[]}),null);
 assert.deepEqual(currentAccountGdpAllComponentEffectDomain({observations:[{quarterly:{effects:{itaGoodsBalance:{balanceEffect:0,gdpEffect:null}}},trailing:{effects:{}}}]}),[0,0]);
});

test('missing latest component remains explicit at the same endpoint without hiding valid peers',()=>{
 const sources=currentAccountGdpTrailingFixture();sources.beaIta.series.itaGoodsBalance.observations.at(-1).value=null;
 const html=currentAccountGdpAllComponentEffectsPanel(sources,range);
 assert.match(html,/Q2 2026 versus Q1 2026/);assert.match(html,/Goods.*Quarterly effects unavailable/s);assert.match(html,/itaServicesBalanceQuarterlyBalanceEffect/);assert.equal((html.match(/data-chart-catalog=/g)??[]).length,6);assert.match(html,/Unavailable/);assert.match(html,/exact|missing/i);
 const model=currentAccountGdpBalanceEffects(sources,range);assert.equal(model.observations[0].quarterly.effects.itaGoodsBalance.balanceEffect,null);assert.ok(Number.isFinite(model.observations[0].quarterly.effects.itaServicesBalance.balanceEffect));
});

test('all-component CSV remains the existing full effect export including reconciliation and unique evidence',()=>{
 const sources=currentAccountGdpTrailingFixture(),csv=currentAccountGdpBalanceEffectsCsv(sources,range),[headers,...values]=parseCsv(csv),rows=values.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));
 assert.equal(rows.filter(row=>row.record_type==='change').length,14);assert.equal(rows.filter(row=>row.record_type==='input').length,30);
 for(const {id}of CURRENT_ACCOUNT_GDP_EFFECT_COMPONENTS)assert.equal(rows.filter(row=>row.record_type==='change'&&row.measure_id===id).length,2);
 assert.match(csv,/reconciliation|residual/i);assert.match(csv,/symmetric-two-order-v1/);
 const html=currentAccountGdpAllComponentEffectsPanel(sources,range);assert.match(html,/CSV includes.*total.*residual/i);
});

test('empty, invalid, loading and frozen scopes are clear and avoid live actions or fabricated observations',()=>{
 const sources=currentAccountGdpTrailingFixture(),frozen=currentAccountGdpAllComponentEffectsPanel(sources,range,{frozen:true,packageId:'all-four'});
 assert.match(frozen,/data-export-frozen-current-account-gdp-all-component-effects="all-four"/);assert.doesNotMatch(frozen,/data-export-current-account-gdp-all-component-effects(?:[\s=>])/);assert.match(frozen,/reconstructed from recorded inputs/i);
 for(const selected of [{preset:'custom',startDate:'2030-01-01',endDate:'2030-04-01'},{preset:'custom',startDate:'invalid',endDate:'2026-04-01'}]){const html=currentAccountGdpAllComponentEffectsPanel(sources,selected);assert.match(html,/unavailable|No retained ending quarters/i);assert.match(html,/disabled/);assert.doesNotMatch(html,/data-chart-catalog=/);}
 const absent=currentAccountGdpAllComponentEffectsPanel({}, {preset:'all'});assert.match(absent,/Unavailable|unavailable/);assert.doesNotMatch(absent,/data-chart-catalog=/);
 assert.match(currentAccountGdpAllComponentEffectsPanel(sources,range),/calculated effects loading/);
});
