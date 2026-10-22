import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceNotice} from '../src/ui.js';

const terms='https://www.newyorkfed.org/privacy/termsofuse';
const attribution='© 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.';
const ratesNotice='The SOFR and EFFR data are subject to the Terms of Use posted at newyorkfed.org. The New York Fed is not responsible for publication of the SOFR and EFFR data by Meridian, does not endorse any particular republication, and has no liability for your use.';
const observation=[{date:'2026-10-20',value:3.88}];

test('global source credit retains New York Fed reference-rate terms alongside existing agency notices',()=>{
  const html=sourceNotice({bls:{fetchedAt:'2026-10-20T12:00:00Z'},marketFunctioning:{status:'ok',series:{
    sofr:{observations:observation,sourceTitle:'Secured Overnight Financing Rate Data',sourceUrl:'https://markets.newyorkfed.org/api/rates/secured/sofr/search.json',sourceNotice:ratesNotice,licenseUrl:terms,attribution},
    effr:{observations:observation,sourceTitle:'Effective Federal Funds Rate',sourceUrl:'https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json',sourceNotice:ratesNotice,licenseUrl:terms,attribution},
  }}});
  assert.ok(html.includes(ratesNotice));
  assert.ok(html.includes(attribution));
  assert.ok(html.includes('Secured Overnight Financing Rate Data'));
  assert.ok(html.includes('Effective Federal Funds Rate'));
  assert.ok(html.includes('href="https://markets.newyorkfed.org/api/rates/secured/sofr/search.json"'));
  assert.ok(html.includes('href="https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json"'));
  assert.ok(html.includes(`href="${terms}"`));
  assert.equal(html.split(ratesNotice).length-1,1,'shared terms are not repeated for every series');
  assert.equal(html.split(attribution).length-1,1);
  assert.match(html,/BLS.gov cannot vouch/);
  assert.match(html,/datetime="2026-10-20T12:00:00Z"/);
  for(const agency of ['U.S. Treasury','Bureau of Labor Statistics','Bureau of Economic Analysis','Department of Labor','U.S. Census Bureau'])assert.ok(html.includes(agency));
});

test('SOMA source credit retains its title and redistribution conditions for cached observations',()=>{
  const html=sourceNotice({ownership:{status:'error',fetchedAt:'2026-10-20T12:00:00Z',series:{
    somaTreasuryHoldings:{observations:observation,sourceTitle:'SOMA Holdings',sourceUrl:'https://markets.newyorkfed.org/api/soma/summary.json',attribution,termsUrl:terms,redistributionNotice:'SOMA Holdings remain under the same permissions, conditions and restrictions. Meridian calculated the Treasury-only sum.'},
  }}});
  assert.match(html,/SOMA Holdings/);
  assert.ok(html.includes(attribution));
  assert.match(html,/same permissions, conditions and restrictions/);
  assert.match(html,/Meridian calculated the Treasury-only sum/);
  assert.ok(html.includes(`href="${terms}"`));
});

test('repeated New York Fed series share source credit while distinct source titles remain visible',()=>{
  const series=Object.fromEntries(Array.from({length:8},(_,index)=>[`rate${index}`,{observations:observation,sourceTitle:index%2?'Effective Federal Funds Rate':'Secured Overnight Financing Rate Data',sourceUrl:index%2?'https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json':'https://markets.newyorkfed.org/api/rates/secured/sofr/search.json',sourceNotice:ratesNotice,attribution,licenseUrl:terms}]));
  const html=sourceNotice({marketFunctioning:{series}});
  assert.equal(html.split(ratesNotice).length-1,1);
  assert.equal(html.split('Secured Overnight Financing Rate Data').length-1,1);
  assert.equal(html.split('Effective Federal Funds Rate').length-1,1);
});

test('unconnected New York Fed sources do not claim any captured data or reuse notices',()=>{
  const html=sourceNotice({ownership:{status:'unavailable',fetchedAt:null,series:{}},marketFunctioning:{status:'unavailable',series:{sofr:{observations:[],sourceUrl:'https://markets.newyorkfed.org/api/rates/secured/sofr/search.json',sourceNotice:ratesNotice,licenseUrl:terms}}}});
  assert.doesNotMatch(html,/New York Fed|SOFR|SOMA Holdings|newyorkfed.org/);
});

test('New York Fed source credit escapes metadata and never links unsafe source or terms URLs',()=>{
  const html=sourceNotice({ownership:{series:{somaTreasuryHoldings:{observations:observation,sourceTitle:'SOMA Holdings <script>',sourceUrl:'https://markets.newyorkfed.org/api/soma/summary.json?x=" onmouseover="unsafe',attribution:'Credit <unsafe>',redistributionNotice:'Conditions <img src=x>',termsUrl:'javascript:alert(1)'}}}});
  assert.match(html,/SOMA Holdings &lt;script&gt;/);
  assert.match(html,/Credit &lt;unsafe&gt;/);
  assert.match(html,/Conditions &lt;img src=x&gt;/);
  assert.doesNotMatch(html,/<script>|<unsafe>|<img|href="javascript:/);
  assert.ok(html.includes('?x=&quot; onmouseover=&quot;unsafe"'));
  assert.match(html,/terms unavailable/i);
  const unsafeSource=sourceNotice({marketFunctioning:{series:{sofr:{observations:observation,title:'SOFR',sourceUrl:'http://markets.newyorkfed.org/rates',licenseUrl:terms,sourceNotice:ratesNotice}}}});
  assert.match(unsafeSource,/SOFR/);
  assert.doesNotMatch(unsafeSource,/href="http:/);
});
