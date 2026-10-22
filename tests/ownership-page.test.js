import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../scripts/sources/http.mjs';
let page;
try{page=await import('../src/ownership-page.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('ownership-page.js'))throw error;}
const api=()=>{assert.ok(page,'Ownership page and export must exist');return page;};
const notice='© 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.';
const terms='https://www.newyorkfed.org/privacy/termsofuse.html';
const source=()=>({status:'ok',fetchedAt:'2026-10-22T02:39:16.095Z',z1:{asOf:'2026-06-30',releaseDate:'2026-09-11',unit:'USD billions',assets:100,liabilities:105,valuationDiscrepancy:5,reconciled:true,sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'},{code:'LM263061105.Q',label:'Rest of the world',value:30,valuation:'market value'},{code:'FL633061105.Q',label:'Money market funds',value:null,valuation:'reported non-market basis'}],history:[{date:'2026-03-31',sectors:[{code:'LM713061103.Q',label:'Central bank',value:19,valuation:'market value'},{code:'LM263061105.Q',label:'Rest of the world',value:31,valuation:'market value'}],assets:99,liabilities:104,valuationDiscrepancy:5},{date:'2026-06-30',sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'},{code:'LM263061105.Q',label:'Rest of the world',value:30,valuation:'market value'},{code:'FL633061105.Q',label:'Money market funds',value:null,valuation:'reported non-market basis'}],assets:100,liabilities:105,valuationDiscrepancy:5}]},
  soma:{title:'SOMA Holdings',asOf:'2026-10-14',principal:24,inflationCompensation:1,adjustedPrincipal:25,attribution:notice,termsUrl:terms,redistributionNotice:'Redistribute under the same permissions, conditions and restrictions.',history:[{date:'2026-10-07',principal:25,inflationCompensation:1,adjustedPrincipal:26},{date:'2026-10-14',principal:24,inflationCompensation:1,adjustedPrincipal:25}]},
  provenance:[{url:'https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip',retrievedAt:'2026-10-22T02:39:16.095Z',sha256:'a'.repeat(64)},{url:'https://markets.newyorkfed.org/api/soma/summary.json',retrievedAt:'2026-10-22T02:39:15.864Z',sha256:'b'.repeat(64)}],warnings:[],limitations:['TIC country holdings are not ingested; country figures can reflect custody locations.']});
const rows=csv=>{const[headers,...data]=parseCsv(csv);return data.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));};

test('ownership page separates valuations and dates and preserves required SOMA title, notice and terms',()=>{
  const html=api().ownershipPage(source());
  for(const text of ['DEBT OWNERSHIP','WHAT CHANGED','WHAT CONTRIBUTED','WHY IT MATTERS','LIMITATIONS','2026-06-30','2026-09-11','2026-10-14','market value','non-market basis','SOMA Holdings','TIC','custod','valuation discrepancy'])assert.ok(html.includes(text),text);
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
