import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
import {renderPage} from '../src/pages.js';
import {series} from '../src/data.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {recordVintages} from '../src/vintages.js';
test('vintage routes preserve UTC cutoff and registered series',()=>{
 const route='#/vintages?cutoff=2026-10-22T03%3A00%3A00.000Z&series=debt';const state=parseRoute(route);assert.equal(state.page,'vintages');assert.equal(state.vintageSeries,'debt');assert.equal(state.vintageCutoff,'2026-10-22T03:00:00.000Z');assert.equal(routeFor(state),route);
 assert.equal(parseRoute('#/vintages?series=unknown').vintageSeries,'gdp');
});
test('series revision tab labels captured changes without invented publication or revision reason',()=>{
 const previous=series.gdp.revisions;try{series.gdp.revisions=[{date:'2026-04-01',firstCaptured:{capturedAt:'2026-10-20T12:00:00.000Z',value:2.1},latest:{capturedAt:'2026-10-21T12:00:00.000Z',value:2.2},changes:[{kind:'observed-value-change',reason:'unknown'}]}];const html=renderPage({page:'indicator',seriesId:'gdp',tab:'revisions',saved:[]});assert.match(html,/FIRST CAPTURED/);assert.match(html,/2\.1%/);assert.match(html,/2\.2%/);assert.match(html,/Unknown/);assert.doesNotMatch(html,/Verified publication snapshots|REVISION PUBLISHED/);}finally{series.gdp.revisions=previous;}
});
test('publication admission rejects an unreviewed source retained only in vintage history',()=>{
 const at='2026-10-20T12:00:00.000Z';const vintages=recordVintages(null,{}, {other:{id:'other',fetchedAt:at,provenance:[{url:'https://example.com/data',sha256:'a'.repeat(64),retrievedAt:at}],series:{unknown:{sourceIds:['other'],sourceUrl:'https://example.com/data',observations:[{date:'2026-09-01',value:1,publishedAt:null}]}}}},{checkedAt:at});assert.throws(()=>assertCommercialData({sources:{},vintages}),/review|source/i);
});
