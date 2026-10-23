import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../scripts/sources/http.mjs';
import {currentAccountGdpBreakdownFixture as fixture} from './helpers/current-account-gdp-breakdown-fixture.js';
const view=await import('../src/current-account-gdp-breakdown-view.js').catch(()=>({}));
const all={preset:'all'};
const records=csv=>{const [header,...rows]=parseCsv(csv);return rows.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]])));};

test('breakdown view supplies four calculated lines, same window, reconciliation and source evidence',()=>{
 assert.equal(typeof view.currentAccountGdpBreakdownPanel,'function');
 const html=view.currentAccountGdpBreakdownPanel(fixture(),all);
 assert.match(html,/HISTORICAL CURRENT ACCOUNT \/ GDP · BREAKDOWN/);
 assert.match(html,/data-chart-catalog="current-account-gdp-breakdown"/);
 assert.match(html,/itaGoodsBalanceToGdp,itaServicesBalanceToGdp,itaPrimaryIncomeBalanceToGdp,itaSecondaryIncomeBalanceToGdp/);
 for(const text of ['Goods','Services','Primary income','Secondary income','Published total','Component sum','Rounding residual'])assert.ok(html.includes(text));
 assert.match(html,/percentage points/);assert.match(html,/GDP SAAR.*four once/);assert.match(html,/not.*causal/i);
 assert.match(html,/2026-10-23T04:21:42.080Z/);assert.match(html,/2026-10-23T02:56:31.625Z/);
 assert.match(html,/bea.gov\/help\/faq\/147/);assert.match(html,/CSV BREAKDOWN &amp; INPUTS/);
 assert.doesNotMatch(html,/id="date-window"/);
 const binding=view.currentAccountGdpBreakdownChartCatalog(fixture())['current-account-gdp-breakdown'];
 assert.equal(Object.keys(binding.catalog).length,4);assert.match(binding.evidenceLabel,/Calculated/);
 assert.deepEqual(Object.values(binding.catalog).map(s=>s.observations.length),[2,2,2,2]);
});

test('breakdown CSV matches displayed quarters, retains signed raw values and reconciles without rounding away residual',()=>{
 assert.equal(typeof view.currentAccountGdpBreakdownCsv,'function');
 const rows=records(view.currentAccountGdpBreakdownCsv(fixture(),all));assert.equal(rows.length,2);
 const goods=rows.find(row=>row.reference_quarter==='2026-04-01');
 assert.equal(goods.itaGoodsBalance_source_value,'-291302');assert.equal(goods.denominator_source_value,'32,563,030');
 assert.equal(Number(goods.itaGoodsBalanceToGdp_value_percent),100*-291.302/(32563.03/4));assert.equal(goods.denominator_saar_divisor,'4');
 assert.equal(goods.itaGoodsBalance_publication_date,'');assert.equal(goods.denominator_publication_date,'');
 assert.equal(goods.numerator_retrieved_at,'2026-10-23T04:21:42.080Z');assert.equal(goods.denominator_retrieved_at,'2026-10-23T02:56:31.625Z');
 assert.match(goods.itaGoodsBalance_source_ids,/line32/);assert.equal(goods.observation_type,'calculated');
 assert.ok(Math.abs(Number(goods.currentAccountRoundingResidualToGdp_balance_quarter_billions)-.001)<1e-10);assert.ok(Math.abs(Number(goods.currentAccountRoundingResidualToGdp_value_percent))>0);
 assert.equal(goods.itaPrimaryIncomeBalance_source_value,'-11405');
 const one=records(view.currentAccountGdpBreakdownCsv(fixture(),{preset:'custom',startDate:'2026-04-01',endDate:'2026-04-01'}));
 assert.equal(one.length,1);assert.equal(one[0].reference_quarter,'2026-04-01');assert.equal(one[0].itaGoodsBalanceToGdp_change_percentage_points,'');
});

test('missing components remain gaps, valid siblings remain visible and no delta bridges a missing quarter',()=>{
 const sources=fixture();sources.beaIta.series.itaGoodsBalance.observations[0].value=null;
 const rows=records(view.currentAccountGdpBreakdownCsv(sources,all));
 assert.equal(rows[0].itaGoodsBalanceToGdp_value_percent,'');assert.equal(rows[0].itaGoodsBalanceToGdp_missing,'true');assert.equal(rows[1].itaGoodsBalanceToGdp_change_percentage_points,'');
 assert.match(rows[0].itaGoodsBalanceToGdp_unavailable_reason,/missing/i);
 assert.notEqual(rows[0].itaServicesBalanceToGdp_value_percent,'');
 assert.equal(rows[0].currentAccountComponentSumToGdp_value_percent,'');
 const html=view.currentAccountGdpBreakdownPanel(sources,all);assert.match(html,/1 missing component/);
 assert.match(html,/Unavailable/);assert.doesNotMatch(html,/>NaN|>undefined/);
});

test('empty, invalid, cached and frozen states stay explicit and source text is escaped',()=>{
 const sources=fixture();sources.bea.error='<failed>';sources.bea.status='error';
 assert.match(view.currentAccountGdpBreakdownPanel(sources,all),/Cached input/);assert.match(view.currentAccountGdpBreakdownPanel(sources,all),/&lt;failed&gt;/);
 assert.match(view.currentAccountGdpBreakdownPanel(sources,{preset:'custom',startDate:'2030-01-01',endDate:'2030-04-01'}),/No retained quarters/);
 assert.match(view.currentAccountGdpBreakdownPanel({},all),/unavailable/i);
 const frozen=view.currentAccountGdpBreakdownPanel(sources,all,{frozen:true});assert.match(frozen,/FROZEN HISTORICAL/);assert.doesNotMatch(frozen,/data-export-current-account-gdp-breakdown|data-window=/);
 assert.match(view.currentAccountGdpBreakdownChartCatalog(sources,{frozen:true})['current-account-gdp-breakdown'].evidenceLabel,/Frozen/);
 const invalid={preset:'custom',startDate:'bad',endDate:'bad'};
 assert.match(view.currentAccountGdpBreakdownPanel(sources,invalid),/unavailable/i);assert.equal(records(view.currentAccountGdpBreakdownCsv(sources,invalid)).length,0);
});

test('wide CSV keeps all columns aligned and neutralizes formula-like source metadata',()=>{
 const sources=fixture();sources.beaIta.series.currentAccountBalance.sourceTitle='=UNTRUSTED()';
 sources.beaIta.series.itaGoodsBalance.observations[1].footnotes=['Official note, with "quotes"'];
 const csv=view.currentAccountGdpBreakdownCsv(sources,all),[header,...rows]=parseCsv(csv);
 assert.equal(new Set(header).size,header.length);assert.ok(rows.every(row=>row.length===header.length));
 const row=Object.fromEntries(header.map((key,i)=>[key,rows[1][i]]));
 assert.equal(row.numerator_source_title,"'=UNTRUSTED()");assert.equal(row.itaGoodsBalance_source_value,'-291302');
 assert.deepEqual(JSON.parse(row.itaGoodsBalance_footnotes_json),['Official note, with "quotes"']);
 assert.equal(JSON.parse(row.numerator_provenance_json)[0].retrievedAt,'2026-10-23T04:21:42.080Z');
 assert.equal(JSON.parse(row.denominator_provenance_json)[0].retrievedAt,'2026-10-23T02:56:31.625Z');
});
