import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceNotice} from '../src/ui.js';
import {BLS_DATA_NOTICE} from '../src/model.js';

const api=await import('../src/page-source-scope.js').catch(error=>{
 if(error.code==='ERR_MODULE_NOT_FOUND')return {};
 throw error;
});
const notice='Exact New York Fed reuse notice <retained>.';
const ny={observations:[{date:'2026-10-20',value:1}],sourceTitle:'SOMA holdings',sourceNotice:notice,
 sourceUrl:'https://markets.newyorkfed.org/api/soma/summary.json',termsUrl:'https://www.newyorkfed.org/privacy/termsofuse'};
const sources={bls:{fetchedAt:'2026-10-20T12:00:00Z'},treasury:{series:{}},ownership:{series:{soma:ny}}};
const catalog={unrate:{agency:'bls'},soma:{agency:'ownership'},debt:{agency:'treasury'}};

test('page notices are limited to rendered measurements and retain literal rights wording',()=>{
 assert.equal(typeof api.pageSourceScope,'function');
 const scope=api.pageSourceScope({page:'indicator',seriesId:'unrate'},'',{catalog,sources});
 const html=sourceNotice(scope.sources,{scoped:true});
 assert.ok(html.includes(BLS_DATA_NOTICE));
 assert.doesNotMatch(html,/SOMA|New York Fed|U.S. Treasury/);
 const holdings=api.pageSourceScope({page:'indicator',seriesId:'soma'},'',{catalog,sources});
 const credit=sourceNotice(holdings.sources,{scoped:true});
 assert.ok(credit.includes(notice.replace('<','&lt;').replace('>','&gt;')));
 assert.doesNotMatch(credit,/BLS.gov cannot vouch|Bureau of Labor Statistics/);
});

test('catalog and charts include only displayed source evidence without mutating inputs',()=>{
 const original=JSON.stringify(sources);
 const scope=api.pageSourceScope({page:'explore',exploreMode:'catalog'},
  '<input data-select="debt"><div data-series="soma"></div>',{catalog,sources});
 assert.deepEqual(Object.keys(scope.sources).sort(),['ownership','treasury']);
 assert.deepEqual(Object.keys(scope.sources.ownership.series),['soma']);
 assert.equal(JSON.stringify(sources),original);
});

test('all-source notices remain available in the dedicated terms page',async()=>{
 const {sourcesPage}=await import('../src/sources-page.js');
 const html=sourcesPage({sources,calendar:{sources:{}}});
 assert.ok(html.includes('Sources &amp; terms'));
 assert.ok(html.includes(BLS_DATA_NOTICE));
 assert.ok(html.includes('Exact New York Fed reuse notice &lt;retained&gt;.'));
 assert.ok(html.includes('U.S. Treasury'));
});
