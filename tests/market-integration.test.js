import test from 'node:test';import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';import {getSeries,periodLabel,toCsv} from '../src/model.js';import {parseCsv} from '../scripts/sources/http.mjs';import {getFreshness} from '../src/freshness.js';import {dataStatus} from '../src/data.js';
import {renderPage} from '../src/pages.js';
test('market route and stock/weekly-flow semantics survive shared registry integration',()=>{
 assert.equal(parseRoute('#/market').page,'market');assert.equal(routeFor({page:'market'}),'#/market');
 assert.match(periodLabel(getSeries('dealerRepo'),'2026-10-07'),/^As of /);assert.match(periodLabel(getSeries('dealerFailsDeliver'),'2026-10-07'),/^Week ending /);
 assert.equal(getSeries('sofrEffrSpread').observationType,'calculated');
});
test('shared indicator data tables show suppressed and source-revised observations',()=>{
 assert.match(renderPage({page:'indicator',seriesId:'dealerRepo'}),/SUPPRESSED/);
 const s=getSeries('sofr'),original=s.observations;try{s.observations=[{date:'2026-10-20',value:3.88,publishedAt:null,revisionIndicator:'Y'}];assert.match(renderPage({page:'indicator',seriesId:'sofr'}),/SOURCE REVISION FLAG/);}finally{s.observations=original;}
});
test('generic market exports retain required original titles, terms, suppression and revision flags',()=>{
 const [header,...rows]=parseCsv(toCsv(['sofr','effr','dealerRepo']));const records=rows.map(row=>Object.fromEntries(header.map((key,i)=>[key,row[i]])));
 assert.ok(records.some(row=>row.source_title==='Secured Overnight Financing Rate Data'));assert.ok(records.some(row=>row.suppressed==='true'&&row.value===''));
 assert.ok(records.every(row=>row.source_notice.includes('Federal Reserve Bank of New York')&&row.license_url.includes('termsofuse')));
 assert.ok(getFreshness(dataStatus).entries.some(row=>row.id==='data:marketFunctioning'));
});
