import test from 'node:test';
import assert from 'node:assert/strict';
import {currentAccountGdpTrailingFixture} from './helpers/current-account-gdp-trailing-fixture.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {currentAccountGdpContributionsPanel,currentAccountGdpContributionsChartCatalog,currentAccountGdpContributionsCsv} from '../src/current-account-gdp-contributions-view.js';

const range={preset:'custom',startDate:'2026-04-01',endDate:'2026-04-01'};
const records=text=>{const [head,...rows]=parseCsv(text);return rows.map(row=>Object.fromEntries(head.map((key,i)=>[key,row[i]])));};

test('contributions panel distinguishes changes from horizon gaps and reconciles both exact preceding endpoints',()=>{
 const html=currentAccountGdpContributionsPanel(currentAccountGdpTrailingFixture(),range);
 assert.match(html,/COMPONENT CONTRIBUTIONS TO RATIO CHANGES/);assert.equal((html.match(/data-chart-catalog="current-account-gdp-contributions"/g)??[]).length,2);
 assert.match(html,/Q2 2026 versus Q1 2026/);assert.match(html,/Reconciliation residual change/);assert.match(html,/Published total change/);
 assert.match(html,/denominator changes are already included/);assert.match(html,/not official BEA growth contributions/);assert.match(html,/overlap by three quarters/);
 assert.match(html,/predecessor can precede the selected window/);assert.match(html,/data-export-current-account-gdp-contributions/);
 assert.match(html,/CHANGE · PP/);assert.doesNotMatch(html,/id="window-start"/);
});

test('contributions chart catalog has eight calculated percentage-point series without observed-ratio labeling',()=>{
 const groups=currentAccountGdpContributionsChartCatalog(currentAccountGdpTrailingFixture(),{frozen:true}),binding=groups['current-account-gdp-contributions'];
 assert.equal(Object.keys(binding.catalog).length,8);assert.match(binding.evidenceLabel,/Frozen calculated/);
 for(const item of Object.values(binding.catalog)){assert.equal(item.unit,'Percentage points');assert.equal(item.observationType,'calculated');assert.match(item.name,/contribution/i);}
});

test('contributions CSV exports both horizons and all predecessor/lookback inputs once with separate source clocks',()=>{
 const rows=records(currentAccountGdpContributionsCsv(currentAccountGdpTrailingFixture(),range)),metadata=rows.filter(row=>row.record_type==='metadata'),changes=rows.filter(row=>row.record_type==='change'),inputs=rows.filter(row=>row.record_type==='input');
 assert.equal(metadata.length,1);assert.equal(changes.length,14);assert.equal(inputs.length,30);
 assert.deepEqual([...new Set(inputs.map(row=>row.input_reference_quarter))],['2025-04-01','2025-07-01','2025-10-01','2026-01-01','2026-04-01']);
 assert.equal(new Set(inputs.map(row=>`${row.input_reference_quarter}|${row.input_series_id}`)).size,inputs.length);
 const total=changes.find(row=>row.horizon==='quarterly'&&row.measure_id==='currentAccountBalance');assert.ok(Math.abs(Number(total.contribution_percentage_points)-100*(-279.999/9000+240/8000))<1e-12);
 const trailing=changes.find(row=>row.horizon==='trailing'&&row.measure_id==='currentAccountBalance');assert.ok(Math.abs(Number(trailing.contribution_percentage_points)-100*(-879.999/30000+680/26000))<1e-12);
 const info=JSON.parse(metadata[0].input_metadata_json);assert.ok(info.bea.nominalGdp);assert.ok(info.beaIta.itaGoodsBalance);assert.ok(Object.hasOwn(info.beaIta.itaGoodsBalance,'retrievedAt'));
 assert.ok(changes.every(row=>row.observation_type==='calculated'));assert.ok(inputs.every(row=>row.publication_date===''));
});

test('missing component inputs remain unavailable while complete components and total can display',()=>{
 const sources=currentAccountGdpTrailingFixture();sources.beaIta.series.itaGoodsBalance.observations.at(-1).value=null;
 const html=currentAccountGdpContributionsPanel(sources,range),rows=records(currentAccountGdpContributionsCsv(sources,range));
 assert.match(html,/Unavailable/);assert.match(html,/Published total change/);
 for(const horizon of ['quarterly','trailing']){const item=rows.find(row=>row.record_type==='change'&&row.horizon===horizon&&row.measure_id==='itaGoodsBalance');assert.equal(item.contribution_percentage_points,'');assert.ok(item.unavailable_reason);}
});

test('input evidence does not label valid raw observations unavailable when their paired ratio input is missing',()=>{
 const sources=currentAccountGdpTrailingFixture();sources.beaIta.series.currentAccountBalance.observations.at(-1).value=null;
 let rows=records(currentAccountGdpContributionsCsv(sources,range));
 let input=rows.find(row=>row.record_type==='input'&&row.input_series_id==='nominalGdp'&&row.input_reference_quarter==='2026-04-01');
 assert.equal(input.value_billions,'36000');assert.equal(input.unavailable_reason,'');
 sources.bea.series.nominalGdp.observations.at(-1).value=null;
 rows=records(currentAccountGdpContributionsCsv(sources,range));input=rows.find(row=>row.record_type==='input'&&row.input_series_id==='itaServicesBalance'&&row.input_reference_quarter==='2026-04-01');
 assert.equal(input.value_billions,'130');assert.equal(input.unavailable_reason,'');
 const info=JSON.parse(rows[0].input_metadata_json);assert.deepEqual(info.bea.nominalGdp.sourceIds,['A191RC']);
});

test('frozen panel only exposes reconstruction from its package and invalid windows keep a clear empty state',()=>{
 const html=currentAccountGdpContributionsPanel(currentAccountGdpTrailingFixture(),range,{frozen:true,packageId:'frozen-proof'});
 assert.match(html,/FROZEN COMPONENT CONTRIBUTIONS/);assert.match(html,/data-export-frozen-current-account-gdp-contributions="frozen-proof"/);assert.doesNotMatch(html,/data-export-current-account-gdp-contributions/);assert.match(html,/reconstructed from recorded inputs/i);
 const invalid=currentAccountGdpContributionsPanel({}, {preset:'custom',startDate:'2026-04-01',endDate:'2025-01-01'});assert.match(invalid,/unavailable/i);assert.match(invalid,/disabled/);
 const csv=records(currentAccountGdpContributionsCsv({}, {preset:'all'}));assert.equal(csv.length,1);
});
