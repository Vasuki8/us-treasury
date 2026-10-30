import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../scripts/sources/http.mjs';
let page;
try{page=await import('../src/refinancing-page.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('refinancing-page.js'))throw error;}
const api=()=>{assert.ok(page,'Refinancing page and export must exist');return page;};
const source=()=>({status:'ok',asOf:'2026-09-30',unit:'USD billions',fetchedAt:'2026-10-22T02:27:14.574Z',series:{marketableDebt:{observations:[{date:'2026-08-31',value:0.7},{date:'2026-09-30',value:0.77}]}},
  securities:[{securityId:'meridian-00000000000000000001',type:'Bill',principal:100,unadjustedPrincipal:100,inflationAdjustment:0,couponRatePct:null,maturityDate:'2026-10-15'},{securityId:'meridian-00000000000000000002',type:'Note',principal:200,unadjustedPrincipal:200,inflationAdjustment:0,couponRatePct:2,maturityDate:'2026-12-31'},{securityId:'meridian-00000000000000000003',type:'Bond',principal:300,unadjustedPrincipal:300,inflationAdjustment:0,couponRatePct:3,maturityDate:'2056-09-30'},{securityId:'meridian-00000000000000000004',type:'TIPS',principal:120,unadjustedPrincipal:100,inflationAdjustment:20,couponRatePct:0.125,maturityDate:'2027-09-30'},{securityId:'meridian-00000000000000000005',type:'FRN',principal:50,unadjustedPrincipal:50,inflationAdjustment:0,couponRatePct:null,maturityDate:'2027-03-31'}],
  totals:{eligiblePrincipal:770,reportedMarketablePrincipal:774,ffbPrincipal:3,maturedUnredeemedPrincipal:1,reportedMarketableHeldByPublic:768,reportedMarketableIntragovernmental:6},provenance:[{url:'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/mspd_table_3_market?filter=record_date:eq:2026-09-30',sha256:'a'.repeat(64),retrievedAt:'2026-10-22T02:27:14.574Z'}],warnings:['TIPS current adjusted principal; future inflation unknown.']});
const rows=csv=>{const[headers,...data]=parseCsv(csv);return data.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));};

test('monthly refinancing history requests five calendar years without changing export scope',()=>{
  const data=source(),csv=api().refinancingCsv(data),html=api().refinancingPage({},data);
  const chart=html.match(/<div class="chart" data-chart data-series="marketableDebt"[^>]*>/)?.[0];
  const range=chart?.match(/data-range="([^"]+)"/)?.[1];
  assert.deepEqual(JSON.parse(range.replaceAll('&quot;','"')),{preset:'5y'});
  assert.equal(api().refinancingCsv(data),csv);
});

test('refinancing compact exposure uses trillions while exact maturity tables and numeric CSV stay unchanged',()=>{
  const data=source(),original=JSON.stringify(data),csv=api().refinancingCsv(data);
  const html=api().refinancingPage({},data);
  assert.ok(html.includes('<strong class="metric-value">$0.470T</strong>'));
  assert.match(html,/principal changed \+\$0\.0700T/);
  assert.ok(html.includes('<td class="num">$470.00B</td>'),'Source maturity amounts retain their original precision.');
  assert.equal(api().refinancingCsv(data),csv);
  assert.equal(JSON.stringify(data),original);
});

test('refinancing page preserves source dates and exposes accessible scenario controls with both directions',()=>{
  const html=api().refinancingPage({refinancingHorizon:3,refinancingShock:50},source());
  for(const text of ['REFINANCING','WHAT CHANGED','WHAT CONTRIBUTED','WHY IT MATTERS','LIMITATIONS','2026-09-30','2026-10-22T02:27:14.574Z','3 months','12 months','24 months','Bill','FRN','TIPS','4%','hypothetical','+50','−50','Original','Federal Financing Bank'])assert.ok(html.includes(text),text);
  assert.match(html,/<label[^>]*for="refinancing-horizon"/);
  assert.match(html,/<select[^>]*id="refinancing-horizon"[^>]*>[\s\S]*?<option value="3" selected/);
  assert.match(html,/<label[^>]*for="refinancing-shock"/);
  assert.match(html,/<option value="50" selected/);
  assert.match(html,/data-export-refinancing(?:\s|>)/);
  assert.match(html,/data-export-refinancing-scenario/);
  assert.match(html,/Release date[^<]*unknown/i);
  assert.match(html,/unmatured|contractual/);
  assert.match(html,/not.*forecast|not.*net budget interest/i);
});

test('refinancing missing, cached and malicious source messages stay explicit and escaped',()=>{
  const missing=api().refinancingPage({},null);
  assert.match(missing,/unavailable/i);assert.match(missing,/disabled/);assert.doesNotMatch(missing,/NaN|\$0\.00B/);
  const cached=source();cached.status='error';cached.error='<img src=x onerror=alert(1)>';
  const html=api().refinancingPage({refinancingHorizon:'bogus',refinancingShock:Infinity},cached);
  assert.match(html,/CACHED/);assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
  assert.match(html,/<option value="12" selected/);assert.match(html,/<option value="100" selected/);
});

test('observed refinancing CSV carries every instrument input, units, nulls, provenance and reconciliation',()=>{
  const data=source();const output=rows(api().refinancingCsv(data));
  const inputs=output.filter(row=>row.row_type==='security');assert.equal(inputs.length,5);
  const tips=inputs.find(row=>row.instrument==='TIPS');assert.equal(tips.principal_usd_billions,'120');assert.equal(tips.original_principal_usd_billions,'100');assert.equal(tips.inflation_adjustment_usd_billions,'20');
  assert.equal(tips.security_id,'meridian-00000000000000000004');assert.ok(inputs.every(row=>!('cusip' in row)));
  assert.equal(inputs.find(row=>row.instrument==='Bill').coupon_rate_pct,'');
  assert.ok(output.some(row=>row.metric==='reported_marketable_principal'&&row.value==='774'));
  assert.ok(output.some(row=>row.metric==='maturing_3_months'&&row.value==='300'));
  assert.ok(output.every(row=>row.release_date===''&&row.retrieved_at===data.fetchedAt&&row.provenance.includes('a'.repeat(64))));
  assert.ok(output.every(row=>row.data_status==='captured'));
  assert.ok(!output.some(row=>row.observation_type==='Modeled scenario'));
});

test('scenario CSV contains both signs, all inputs and assumptions without relabeling model outputs as observations',()=>{
  const data=source();data.status='error';const output=rows(api().refinancingCsv(data,{scenario:true,horizonMonths:12,shockBps:200}));
  const modeled=output.filter(row=>row.row_type==='scenario');
  assert.deepEqual([...new Set(modeled.map(row=>row.shock_bps))].sort(),['-200','200']);
  assert.ok(modeled.every(row=>row.observation_type==='Modeled scenario'&&row.baseline_rate_pct==='4'&&row.data_status==='cached'));
  assert.ok(modeled.every(row=>row.assumptions.includes('7-day')&&row.assumptions.includes('TIPS')&&row.assumptions.includes('not observed')));
  assert.ok(modeled.some(row=>row.instrument==='Bond'&&row.accrued_impact_usd_billions==='0'));
  assert.equal(output.filter(row=>row.row_type==='security').length,5);
  assert.equal(rows(api().refinancingCsv(undefined)).length,0);
});

test('refinancing maturity bars use the exact retained monthly principal and keep the exact table accessible',()=>{
 const html=api().refinancingPage({},source());
 assert.match(html,/class="maturity-ladder-chart"/);
 assert.match(html,/Monthly contractual principal/);
 assert.match(html,/data-page-disclosure="refinancing:maturity-table"/);
 assert.match(html,/<title>2026-10-31: \$100\.00B<\/title>/);
 assert.match(html,/CUMULATIVE PRINCIPAL/);
});
