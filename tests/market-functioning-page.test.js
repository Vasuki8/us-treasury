import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../scripts/sources/http.mjs';
import {NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE,NY_FED_TERMS_URL} from '../src/market-functioning.js';
let page;
try{page=await import('../src/market-functioning-page.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('market-functioning-page.js'))throw error;}
const ui=()=>{assert.ok(page,'The Graphite market-functioning page must exist');return page;};
const series=(sourceIds,values,extra={})=>({sourceIds,sourceUrl:'https://markets.newyorkfed.org/api/pd/get/SBN2024/timeseries/PDPOSGST-TOT.json',observations:values,calculation:'Source millions / 1000.',observationType:'official',...extra});
function fixture(){return {status:'error',fetchedAt:'2026-10-21T23:00:00Z',lastAttemptAt:'2026-10-22T23:00:00Z',error:'HTTP 503 <retry>',coverageStart:'2024-07-03',coverageEnd:'2026-10-21',series:{
  dealerNetTreasury:series(['PDPOSGST-TOT'],[{date:'2026-09-30',value:432.032},{date:'2026-10-07',value:444.683}]),
  dealerRepo:series(['PDSORA-UTSETTOT'],[{date:'2026-10-07',value:null,sourceValue:'*',suppressed:true}]),
  dealerFailsDeliver:series(['PDFTD-USTET'],[{date:'2026-10-07',value:121.178}]),
  dealerFailsReceive:series(['PDFTR-USTET'],[{date:'2026-10-07',value:137.453}]),
  sofr:series(['SOFR:percentRate'],[{date:'2026-10-20',value:3.88,revisionIndicator:'Y',volumeInBillions:2925}],{sourceUrl:'https://markets.newyorkfed.org/api/rates/secured/sofr/search.json',sourceTitle:'Secured Overnight Financing Rate Data'}),
  effr:series(['EFFR:percentRate'],[{date:'2026-10-20',value:3.88,revisionIndicator:'',volumeInBillions:110}]),
  sofrEffrSpread:series(['SOFR:percentRate','EFFR:percentRate'],[{date:'2026-10-20',value:0}],{observationType:'calculated'}),
}};}

test('market page visibly retains conditional-license notices, suppression and separate reporting bases',()=>{
  const html=ui().marketFunctioningPage(fixture());
  assert.ok(html.includes(NY_FED_DATA_NOTICE));assert.ok(html.includes(NY_FED_REFERENCE_RATE_NOTICE));assert.ok(html.includes(NY_FED_PRODUCT_NOTICE));assert.ok(html.includes(NY_FED_TERMS_URL));
  for(const label of ['WHAT CHANGED','WHAT CONTRIBUTED','WHY IT MATTERS','LIMITATIONS','SUPPRESSED','CACHED','Wednesday','Cumulative weekly','SOFR','EFFR'])assert.ok(html.includes(label),label);
  assert.match(html,/not a definitive liquidity or default-risk score/);assert.match(html,/HTTP 503 &lt;retry&gt;/);assert.doesNotMatch(html,/<retry>/);
  assert.match(html,/data-export-market/);assert.match(html,/REVISED/);
});

test('unavailable market page never displays another global snapshot as fixture data',()=>{
  const html=ui().marketFunctioningPage({status:'unavailable',series:{},error:'Not connected'});
  assert.match(html,/No verified market-functioning capture/i);assert.doesNotMatch(html,/444\.683|121\.178/);
  assert.ok(html.includes(NY_FED_REFERENCE_RATE_NOTICE));
});

test('market compact readings use billions, three significant figures and integer bp while source tables and CSV stay exact',()=>{
  const data=fixture();
  data.series.dealerNetTreasury.observations[1].value=-444.683;
  data.series.sofr.observations[0].value=0.088654;
  data.series.sofrEffrSpread.observations[0].value=-12.67;
  const original=JSON.stringify(data),csv=ui().marketFunctioningCsv(data);
  const html=ui().marketFunctioningPage(data);
  const headlines=[...html.matchAll(/class="metric-value">([^<]+)</g)].map(match=>match[1]);
  const daily=[...html.matchAll(/class="stitch-kpi-value">([^<]+)</g)].map(match=>match[1]);
  assert.deepEqual(daily,['0.0887%','3.88%','−13 bp','Unavailable']);
  assert.deepEqual(headlines,['−$445B','$121B','$137B']);
  assert.ok(html.includes('<td class="num">−$444.683B</td>'));
  assert.ok(html.includes('<td class="num">-12.7 bp</td>'));
  assert.equal(ui().marketFunctioningCsv(data),csv);
  assert.ok(csv.includes('0.088654'));
  assert.equal(JSON.stringify(data),original);
});

test('market CSV keeps missing/suppressed values blank, revision flags and all required source and license notices',()=>{
  const rows=parseCsv(ui().marketFunctioningCsv(fixture())),headers=rows.shift();
  const records=rows.map(row=>Object.fromEntries(headers.map((key,index)=>[key,row[index]])));
  const repo=records.find(row=>row.series_id==='dealerRepo'),sofr=records.find(row=>row.series_id==='sofr'),spread=records.find(row=>row.series_id==='sofrEffrSpread');
  assert.equal(repo.value,'');assert.equal(repo.missing,'true');assert.equal(repo.suppressed,'true');assert.equal(repo.unit,'USD billions');
  assert.equal(sofr.revision_indicator,'Y');assert.equal(sofr.volume_in_billions,'2925');assert.equal(sofr.publication_date,'');
  assert.ok(sofr.source_notice.includes(NY_FED_REFERENCE_RATE_NOTICE));assert.equal(sofr.license_url,NY_FED_TERMS_URL);
  assert.equal(sofr.source_title,'Secured Overnight Financing Rate Data');
  assert.equal(spread.value,'0');assert.equal(spread.unit,'Basis points');assert.equal(spread.observation_type,'calculated');
  assert.ok(records.every(row=>row.source_notice.includes(NY_FED_DATA_NOTICE)&&row.source_notice.includes(NY_FED_PRODUCT_NOTICE)));
});
