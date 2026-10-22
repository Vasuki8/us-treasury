import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
import {getSeries,toCsv,observationCoverageLabel} from '../src/model.js';
import {parseCsv} from '../scripts/sources/http.mjs';
test('auction routes preserve instrument and selected result identity',()=>{
  const route=parseRoute('#/auctions?type=FRN&auction=2026-example');assert.equal(route.page,'auctions');assert.equal(route.auctionType,'FRN');assert.equal(route.auctionId,'2026-example');assert.equal(routeFor(route),'#/auctions?type=FRN&auction=2026-example');
});
test('monthly auction series carries point-level partial coverage and counts into generic exports',()=>{
  assert.equal(getSeries('auctionOfferingMonthly')?.observationType,'calculated');
  const [headers,...rows]=parseCsv(toCsv(['auctionOfferingMonthly']));assert.ok(headers.includes('partial'));assert.ok(headers.includes('pending_count'));assert.ok(rows.length>0);assert.ok(rows.some(row=>row[headers.indexOf('partial')]==='true'));
});
test('partial point labels retain explicit zero counts without labeling unrelated observations',()=>{
  assert.equal(observationCoverageLabel({partial:true,auctionCount:0,pendingCount:4}),'PARTIAL · 0 result auctions · 4 awaiting results');assert.equal(observationCoverageLabel({}), '');
});
