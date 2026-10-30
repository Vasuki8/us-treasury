import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../scripts/sources/http.mjs';
import {series} from '../src/data.js';
let page;
try{page=await import('../src/ownership-page.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('ownership-page.js'))throw error;}
const api=()=>{assert.ok(page,'Ownership page and export must exist');return page;};
const notice='© 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.';
const terms='https://www.newyorkfed.org/privacy/termsofuse.html';
const source=()=>({status:'ok',fetchedAt:'2026-10-22T02:39:16.095Z',z1:{asOf:'2026-06-30',releaseDate:'2026-09-11',unit:'USD billions',assets:100,liabilities:105,valuationDiscrepancy:5,reconciled:true,sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'},{code:'LM263061105.Q',label:'Rest of the world',value:30,valuation:'market value'},{code:'FL633061105.Q',label:'Money market funds',value:null,valuation:'reported non-market basis'}],history:[{date:'2026-03-31',sectors:[{code:'LM713061103.Q',label:'Central bank',value:19,valuation:'market value'},{code:'LM263061105.Q',label:'Rest of the world',value:31,valuation:'market value'}],assets:99,liabilities:104,valuationDiscrepancy:5},{date:'2026-06-30',sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'},{code:'LM263061105.Q',label:'Rest of the world',value:30,valuation:'market value'},{code:'FL633061105.Q',label:'Money market funds',value:null,valuation:'reported non-market basis'}],assets:100,liabilities:105,valuationDiscrepancy:5}]},
  soma:{title:'SOMA Holdings',asOf:'2026-10-14',principal:24,inflationCompensation:1,adjustedPrincipal:25,attribution:notice,termsUrl:terms,redistributionNotice:'Redistribute under the same permissions, conditions and restrictions.',history:[{date:'2026-10-07',principal:25,inflationCompensation:1,adjustedPrincipal:26},{date:'2026-10-14',principal:24,inflationCompensation:1,adjustedPrincipal:25}]},
  provenance:[{url:'https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip',retrievedAt:'2026-10-22T02:39:16.095Z',sha256:'a'.repeat(64)},{url:'https://markets.newyorkfed.org/api/soma/summary.json',retrievedAt:'2026-10-22T02:39:15.864Z',sha256:'b'.repeat(64)}],warnings:[],limitations:['TIC country holdings are not ingested; country figures can reflect custody locations.']});
const rows=csv=>{const[headers,...data]=parseCsv(csv);return data.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));};

test('quarterly ownership history requests five calendar years while ownership exports retain their full scope',()=>{
  const data=source(),csv=api().ownershipCsv(data),html=api().ownershipPage(data);
  const chart=html.match(/<div class="chart" data-chart data-series="foreignTreasuryHoldings,fedTreasuryHoldings"[^>]*>/)?.[0];
  const range=chart?.match(/data-range="([^"]+)"/)?.[1];
  assert.deepEqual(JSON.parse(range.replaceAll('&quot;','"')),{preset:'5y'});
  assert.equal(api().ownershipCsv(data),csv);
});

test('ownership compact holdings keep one trillion unit even for small holdings while source tables and CSV stay exact',()=>{
  const ids=['foreignTreasuryHoldings','fedTreasuryHoldings'],originals=ids.map(id=>series[id].observations);
  const data=source(),original=JSON.stringify(data),csv=api().ownershipCsv(data);
  try{
    ids.forEach((id,index)=>{series[id].observations=[{date:'2026-06-30',value:index?0.000004567:0.012345}];});
    const html=api().ownershipPage(data),headlines=[...html.matchAll(/class="metric-value">([^<]+)</g)].map(match=>match[1]);
    assert.deepEqual(headlines,['$0.0123T','$0.00000457T']);
    assert.ok(html.includes('<td class="num">$20.00B</td>'));
    assert.equal(api().ownershipCsv(data),csv);
    assert.equal(JSON.stringify(data),original);
  }finally{ids.forEach((id,index)=>{series[id].observations=originals[index];});}
});

test('negative reported ownership positions keep native precision with the sign before currency',()=>{
  const data=source();data.z1.sectors[0].value=-20.1234;
  const html=api().ownershipPage(data);
  assert.ok(html.includes('<td class="num">−$20.12B</td>'));
  assert.doesNotMatch(html,/\$-/);
});

test('ownership page separates valuations and dates and preserves required SOMA title, notice and terms',()=>{
  const html=api().ownershipPage(source());
  for(const text of ['DEBT OWNERSHIP','WHAT CHANGED','WHAT CONTRIBUTED','WHY IT MATTERS','LIMITATIONS','30 Jun 2026','11 Sept 2026',
  '14 Oct 2026','market value','non-market basis','SOMA Holdings','TIC','custod',
  'valuation discrepancy'])assert.ok(html.toLowerCase().includes(text.toLowerCase()),text);
  assert.ok(html.includes(notice));assert.ok(html.includes(terms));assert.match(html,/data-export-ownership/);
  assert.match(html,/not.*purchases|not.*sales/i);
  assert.match(html,/not added|not summed|never summed/i);
  assert.match(html,/Unavailable/);
  assert.doesNotMatch(html,/data-kind="pie"/);
});

test('ownership missing and cached error states show limitations without fake zero holdings',()=>{
  const html=api().ownershipPage(null);assert.match(html,/unavailable/i);assert.match(html,/disabled/);assert.doesNotMatch(html,/NaN|\$0\.00B/);
  const cached=source();cached.status='error';cached.error='<script>unsafe</script>';
  const output=api().ownershipPage(cached);assert.match(output,/CACHED/);assert.match(output,/&lt;script&gt;/);assert.doesNotMatch(output,/<script>/);
});

test('ownership CSV preserves missing values, per-row valuations, source periods and current vintage semantics',()=>{
  const data=source(),output=rows(api().ownershipCsv(data));
  const missing=output.find(row=>row.series_code==='FL633061105.Q');assert.equal(missing.value,'');assert.equal(missing.valuation,'reported non-market basis');
  const z1=output.filter(row=>row.dataset==='Z.1');assert.ok(z1.every(row=>row.unit==='USD billions'&&row.source_unit==='USD millions'&&row.vintage_release_date==='2026-09-11'));
  assert.ok(z1.filter(row=>row.period==='2026-03-31').every(row=>row.release_date===''));
  assert.ok(z1.filter(row=>row.period==='2026-06-30').every(row=>row.release_date==='2026-09-11'));
  assert.ok(output.some(row=>row.series_code==='LM903061103.Q'&&row.value==='5'));
  assert.ok(output.every(row=>row.provenance.includes('sha256')));
});

test('every SOMA CSV row carries required attribution, title, terms and derivation qualification',()=>{
  const output=rows(api().ownershipCsv(source())),soma=output.filter(row=>row.dataset==='SOMA Holdings');
  assert.equal(soma.length,6);
  assert.ok(soma.every(row=>row.attribution===notice&&row.source_title==='SOMA Holdings'&&row.terms_url===terms&&row.redistribution_notice.includes('same permissions')));
  assert.ok(soma.every(row=>row.release_date===''&&row.source_unit==='USD'&&row.retrieved_at==='2026-10-22T02:39:15.864Z'));
  assert.ok(soma.some(row=>row.series_code==='SOMA:treasury-adjusted-par'&&row.observation_type==='Calculated metric'&&row.value==='25'));
  assert.ok(soma.some(row=>row.series_code==='SOMA:tips-inflation-compensation'&&row.observation_type==='Official observation'));
  assert.equal(rows(api().ownershipCsv(undefined)).length,0);
});

test('scoped ownership CSV keeps the exact prior quarter outside its exported periods and all SOMA rows',()=>{
  const data=source(),original=JSON.stringify(data),output=rows(api().ownershipCsv(data,{z1Periods:1}));
  const z1=output.filter(row=>row.dataset==='Z.1');
  assert.deepEqual([...new Set(z1.map(row=>row.period))],['2026-06-30']);
  const fed=z1.find(row=>row.series_code==='LM713061103.Q');
  assert.equal(fed.change_from_exact_prior,'1');assert.equal(fed.prior_period,'2026-03-31');
  assert.equal(output.filter(row=>row.dataset==='SOMA Holdings').length,6);
  assert.deepEqual([...new Set(rows(api().ownershipCsv(data)).filter(row=>row.dataset==='Z.1').map(row=>row.period))],['2026-03-31','2026-06-30']);
  assert.equal(JSON.stringify(data),original);
});

test('ownership CSV keeps annual gaps, historical valuation qualifications and source limitations',()=>{
  const data=source();
  data.z1.history[0].date='1945-12-31';data.z1.history[1].date='1946-12-31';data.z1.asOf='1946-12-31';
  data.z1.history[1].sectors[0].valuation='reported historical H.4.1 source basis (before 2012:Q1 fair-value methodology)';
  data.limitations.push('Annual-end observations before 1952; quarterly from 1952. Central-bank historical source methods differ before 2012:Q1.');
  const output=rows(api().ownershipCsv(data,{z1Periods:1})),fed=output.find(row=>row.series_code==='LM713061103.Q');
  assert.equal(fed.change_from_exact_prior,'');assert.equal(fed.prior_period,'');
  assert.match(fed.valuation,/H\.4\.1/);assert.match(fed.limitations,/Annual-end.*1952/);
  assert.doesNotMatch(fed.methodology,/LM market values/);
});

test('ownership CSV scopes numerical and release receipts to each dataset',()=>{
  const data=source(),release={url:'https://www.federalreserve.gov/releases/z1/default.htm',retrievedAt:'2026-10-22T02:39:16.050Z',sha256:'c'.repeat(64)};
  data.provenance.splice(1,0,release);
  const output=rows(api().ownershipCsv(data));
  for(const row of output){
    const expected=row.dataset==='Z.1'?[data.provenance[0],release]:[data.provenance[2]];
    assert.deepEqual(JSON.parse(row.provenance),expected);
    assert.equal(row.retrieved_at,row.dataset==='Z.1'?'2026-10-22T02:39:16.095Z':'2026-10-22T02:39:15.864Z');
  }
});

test('ownership CSV rejects an invalid period count instead of silently exporting a different scope',()=>{
  for(const z1Periods of [0,-1,1.5,NaN,Infinity,'36'])assert.throws(()=>api().ownershipCsv(source(),{z1Periods}),/period count/i);
});

test('SOMA CSV scope retains exact preceding-week comparisons outside its exported observations',()=>{
  const data=source(),original=JSON.stringify(data),output=rows(api().ownershipCsv(data,{somaPeriods:1}));
  const soma=output.filter(row=>row.dataset==='SOMA Holdings');
  assert.equal(soma.length,3);assert.ok(soma.every(row=>row.period==='2026-10-14'&&row.prior_period==='2026-10-07'));
  assert.equal(soma.find(row=>row.series_code==='SOMA:treasury-adjusted-par').change_from_exact_prior,'-1');
  assert.equal(output.filter(row=>row.dataset==='Z.1').length,11);
  assert.equal(rows(api().ownershipCsv(data)).filter(row=>row.dataset==='SOMA Holdings').length,6);
  for(const somaPeriods of [0,-1,1.5,NaN,Infinity,'104'])assert.throws(()=>api().ownershipCsv(data,{somaPeriods}),/period count/i);
  data.soma.history[0].date='2026-10-06';
  const gap=rows(api().ownershipCsv(data,{somaPeriods:1})).find(row=>row.series_code==='SOMA:treasury-adjusted-par');
  assert.equal(gap.prior_period,'');assert.equal(gap.change_from_exact_prior,'');
  data.soma.history[0].date='2026-10-07';assert.equal(JSON.stringify(data),original);
});

test('SOMA historical CSV distinguishes pre-issuance FRNs from unavailable holdings without inventing observed zeros',()=>{
  const data=source();
  data.soma.history.unshift(
    {date:'2014-01-22',principal:24,inflationCompensation:1,adjustedPrincipal:25,frnStatus:'not-issued',components:{bills:4,notesbonds:18,tips:2,frn:null,tipsInflationCompensation:1}},
    {date:'2014-02-05',principal:null,inflationCompensation:1,adjustedPrincipal:null,frnStatus:'unavailable',components:{bills:4,notesbonds:18,tips:2,frn:null,tipsInflationCompensation:1}},
  );
  const soma=rows(api().ownershipCsv(data)).filter(row=>row.dataset==='SOMA Holdings');
  for(const row of soma.filter(row=>row.period==='2014-01-22'))assert.match(row.methodology,/FRN.*not.*issued.*blank.*null.*excluded/i);
  const missing=soma.filter(row=>row.period==='2014-02-05');
  for(const row of missing)assert.match(row.methodology,/FRN.*unavailable.*not.*zero/i);
  assert.equal(missing.find(row=>row.series_code==='SOMA:treasury-par').value,'');
  assert.equal(missing.find(row=>row.series_code==='SOMA:treasury-adjusted-par').value,'');
  assert.equal(missing.find(row=>row.series_code==='SOMA:tips-inflation-compensation').value,'1');
  assert.ok(soma.filter(row=>row.period>='2026-01-01').every(row=>!row.methodology.includes('FRN field')));
});

test('supplemental SOMA CSV periods carry only their actual aggregate receipt and explain the retained API blank',()=>{
  const data=source(),alternate='https://www.newyorkfed.org/medialibrary/Interactives/markets/soma-interactive/soma-data/total-portfolio-summary.json';
  const receipt={url:alternate,retrievedAt:'2026-10-22T02:39:15.990Z',sha256:'c'.repeat(64)};
  data.provenance.push(receipt);
  data.soma.history.unshift(
    {date:'2014-02-05',principal:24,inflationCompensation:1,adjustedPrincipal:25,sourceUrl:alternate,frnStatus:'alternate-source',primaryFrn:null,components:{bills:4,notesbonds:18,tips:2,frn:0,tipsInflationCompensation:1}},
    {date:'2014-02-12',principal:25,inflationCompensation:1,adjustedPrincipal:26,sourceUrl:alternate,frnStatus:'alternate-source',primaryFrn:null,components:{bills:4,notesbonds:19,tips:2,frn:0,tipsInflationCompensation:1}},
  );
  const original=JSON.stringify(data),output=rows(api().ownershipCsv(data));
  for(const row of output.filter(row=>row.period.startsWith('2014-'))){
    assert.equal(row.source_url,alternate);assert.equal(row.retrieved_at,receipt.retrievedAt);assert.deepEqual(JSON.parse(row.provenance),[receipt]);
    assert.match(row.methodology,/official.*aggregate|aggregate.*official/i);assert.match(row.methodology,/FRN.*zero|FRN.*0/i);assert.match(row.methodology,/API.*blank.*null/i);assert.doesNotMatch(row.methodology,/API.*publish.*(?:zero|0)/i);
    assert.equal(row.release_date,'');assert.match(row.release_date_basis,/unknown/i);assert.equal(row.attribution,notice);assert.equal(row.terms_url,terms);
  }
  const changed=output.find(row=>row.period==='2014-02-12'&&row.series_code==='SOMA:treasury-adjusted-par');
  assert.equal(changed.change_from_exact_prior,'1');assert.equal(changed.prior_period,'2014-02-05');
  for(const row of output.filter(row=>row.dataset==='SOMA Holdings'&&row.period.startsWith('2026-'))){assert.equal(row.source_url,data.provenance[1].url);assert.deepEqual(JSON.parse(row.provenance),[data.provenance[1]]);assert.doesNotMatch(row.methodology,/official.*aggregate|API.*blank/i);}
  assert.equal(JSON.stringify(data),original);
});
