import {humanTimestamp} from '../src/ui-time.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../scripts/sources/http.mjs';
import {currentAccountGdpTrailingFixture as fixture} from './helpers/current-account-gdp-trailing-fixture.js';
const view=await import('../src/current-account-gdp-trailing-view.js').catch(()=>({}));
const all={preset:'all'},records=csv=>{const [headers,...rows]=parseCsv(csv);assert.ok(rows.every(row=>row.length===headers.length));assert.equal(new Set(headers).size,headers.length);return rows.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));};

test('trailing panel supplies separate total and four-component charts, exact window and derived labels',()=>{
 assert.equal(typeof view.currentAccountGdpTrailingPanel,'function');
 const html=view.currentAccountGdpTrailingPanel(fixture(),all);
 assert.match(html,/TRAILING FOUR QUARTERS · CURRENT ACCOUNT \/ GDP/i);
 assert.equal((html.match(/data-chart-catalog="current-account-gdp-trailing"/g)??[]).length,2);
 assert.match(html,/currentAccountTrailingToGdp/);assert.match(html,/itaGoodsBalanceTrailingToGdp,itaServicesBalanceTrailingToGdp,itaPrimaryIncomeBalanceTrailingToGdp,itaSecondaryIncomeBalanceTrailingToGdp/);
 assert.match(html,/Q3 2025.*Q2 2026/);assert.match(html,/ratio of sums/i);assert.match(html,/overlap/i);assert.match(html,/Rounding residual/);
 assert.match(html,/CSV TRAILING &amp; INPUTS/i);assert.match(html,new RegExp(humanTimestamp("2026-10-23T04:21:42.080Z")));assert.match(html,
  new RegExp(humanTimestamp("2026-10-23T02:56:31.625Z")));
  assert.match(html,/bea.gov\/help\/faq\/147/);
 assert.doesNotMatch(html,/id="window-start"/);
 const binding=view.currentAccountGdpTrailingChartCatalog(fixture())['current-account-gdp-trailing'];
 assert.equal(Object.keys(binding.catalog).length,5);assert.match(binding.evidenceLabel,/Calculated/);
});

test('compact trailing CSV is self-contained with one metadata record, unique supporting quarters and endpoint rows',()=>{
 assert.equal(typeof view.currentAccountGdpTrailingCsv,'function');
 const rows=records(view.currentAccountGdpTrailingCsv(fixture(),{preset:'custom',startDate:'2026-04-01',endDate:'2026-04-01'}));
 const metadata=rows.filter(row=>row.record_type==='metadata'),inputs=rows.filter(row=>row.record_type==='input'),ratios=rows.filter(row=>row.record_type==='ratio');
 assert.equal(metadata.length,1);assert.equal(inputs.length,4);assert.equal(ratios.length,1);
 assert.deepEqual(inputs.map(row=>row.reference_quarter),['2025-07-01','2025-10-01','2026-01-01','2026-04-01']);
 assert.equal(ratios[0].window_start_quarter,'2025-07-01');assert.equal(ratios[0].window_end_quarter,'2026-04-01');
 assert.equal(Number(ratios[0].nominal_gdp_t4q_billions),30000);
 assert.equal(Number(ratios[0].itaGoodsBalanceTrailingToGdp_value_percent),100*-1100/30000);
 assert.equal(ratios[0].itaGoodsBalanceTrailingToGdp_change_percentage_points,'');
 assert.equal(inputs.at(-1).itaGoodsBalance_source_value,'-340000');assert.equal(inputs.at(-1).nominalGdp_source_value,'36000000');
 assert.equal(inputs.at(-1).itaGoodsBalance_publication_date,'');
 assert.ok(inputs.every(row=>row.observation_type==='official'));assert.ok(ratios.every(row=>row.observation_type==='calculated'));
 const evidence=JSON.parse(metadata[0].input_metadata_json);assert.equal(evidence.beaIta.currentAccountBalance.retrievedAt,'2026-10-23T04:21:42.080Z');assert.equal(evidence.bea.nominalGdp.retrievedAt,'2026-10-23T02:56:31.625Z');
 assert.match(metadata[0].calculation,/sum/i);assert.match(metadata[0].metadata_scope,/all.*records/i);
});

test('incomplete four-quarter windows and component gaps stay explicit in views and exports',()=>{
 const sources=fixture();sources.beaIta.series.itaGoodsBalance.observations[2].value=null;
 const rows=records(view.currentAccountGdpTrailingCsv(sources,all)),ratios=rows.filter(row=>row.record_type==='ratio');
 assert.equal(ratios.length,6);assert.equal(ratios[0].currentAccountTrailingToGdp_value_percent,'');
 assert.match(ratios[0].currentAccountTrailingToGdp_unavailable_reason,/four|4|coverage/i);
 assert.equal(ratios.at(-1).itaGoodsBalanceTrailingToGdp_value_percent,'');assert.notEqual(ratios.at(-1).itaServicesBalanceTrailingToGdp_value_percent,'');
 assert.equal(ratios.at(-1).currentAccountTrailingComponentSumToGdp_value_percent,'');
 assert.match(view.currentAccountGdpTrailingPanel(sources,all),/Unavailable/);
});

test('trailing states are explicit and frozen panels omit live actions and share no controls',()=>{
 assert.match(view.currentAccountGdpTrailingPanel({},all),/unavailable/i);
 assert.match(view.currentAccountGdpTrailingPanel(fixture(),{preset:'custom',startDate:'2030-01-01',endDate:'2030-04-01'}),/No retained quarters/);
 const sources=fixture();sources.bea.status='error';sources.bea.error='<blocked>';
 assert.match(view.currentAccountGdpTrailingPanel(sources,all),/Cached input/);assert.match(view.currentAccountGdpTrailingPanel(sources,all),/&lt;blocked&gt;/);
 const frozen=view.currentAccountGdpTrailingPanel(sources,all,{frozen:true});assert.match(frozen,/FROZEN TRAILING/i);assert.doesNotMatch(frozen,
  /data-export-current-account-gdp-trailing|data-window=/);
 assert.match(view.currentAccountGdpTrailingChartCatalog(sources,{frozen:true})['current-account-gdp-trailing'].evidenceLabel,/Frozen/);
 const invalid={preset:'custom',startDate:'bad',endDate:'bad'};assert.match(view.currentAccountGdpTrailingPanel(sources,invalid),/unavailable/i);
 assert.equal(records(view.currentAccountGdpTrailingCsv(sources,invalid)).filter(row=>row.record_type==='ratio').length,0);
});

test('CSV retains exact footnotes once with explicit per-input references and neutralizes untrusted source strings',()=>{
 const sources=fixture(),notes=['A repeated official note, with "quotes" and a newline\nsecond line.'];
 for(const row of sources.beaIta.series.currentAccountBalance.observations)row.footnotes=notes;
 sources.beaIta.series.itaGoodsBalance.observations[3].sourcePeriodLabel='=UNTRUSTED()';
 const rows=records(view.currentAccountGdpTrailingCsv(sources,all)),metadata=rows.find(row=>row.record_type==='metadata'),inputs=rows.filter(row=>row.record_type==='input');
 const dictionary=JSON.parse(metadata.footnote_dictionary_json);
 assert.equal(Object.keys(dictionary).length,2);
 for(const row of inputs.filter(row=>row.currentAccountBalance_source_value!==''))assert.deepEqual(dictionary[row.currentAccountBalance_footnotes_ref],notes);
 assert.equal(inputs.find(row=>row.reference_quarter==='2025-10-01').itaGoodsBalance_source_period_label,"'=UNTRUSTED()");
 assert.equal(inputs.find(row=>row.reference_quarter==='2025-10-01').itaGoodsBalance_source_value,'-260000');
 assert.match(metadata.metadata_scope,/footnote/i);
});

test('CSV labels absent supporting observations and rejects nonfinite endpoint changes',()=>{
 const sources=fixture();
 for(const [id,item] of Object.entries(sources.beaIta.series))for(const [index,row] of item.observations.entries())row.value=id==='currentAccountBalance'?[1e100,0,0,0,-1e100,0][index]:0;
 for(const [index,row] of sources.bea.series.nominalGdp.observations.entries())row.value=[4e-206,4e-300,4e-300,4e-300,4e-206,4e-300][index];
 const csv=view.currentAccountGdpTrailingCsv(sources,all),rows=records(csv),ratios=rows.filter(row=>row.record_type==='ratio');
 assert.equal(ratios[4].currentAccountTrailingToGdp_change_percentage_points,'');
 assert.ok(!csv.includes('Infinity')&&!csv.includes('NaN'));
 const absent=rows.find(row=>row.record_type==='input'&&row.reference_quarter==='2024-04-01');
 assert.equal(absent.currentAccountBalance_observation_type,'unavailable');assert.equal(absent.observation_type,'unavailable');
});
