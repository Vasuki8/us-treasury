import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRoute,routeFor} from '../src/router.js';
import {getSeries,periodLabel,toCsv} from '../src/model.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
const soma={sourceIds:['SOMA:treasury-adjusted-par'],sourceUrl:'https://markets.newyorkfed.org/api/soma/summary.json',sourceTitle:'SOMA Holdings',termsUrl:'https://www.newyorkfed.org/privacy/termsofuse.html',attribution:'© 2026 Federal Reserve Bank of New York',redistributionNotice:'Retain the same permissions, conditions and restrictions.'};
test('ownership route and weekly stock periods retain their meaning',()=>{
 assert.equal(parseRoute('#/ownership').page,'ownership');assert.equal(routeFor({page:'ownership'}),'#/ownership');
 assert.equal(getSeries('somaTreasuryHoldings')?.observationType,'calculated');
 assert.match(periodLabel(getSeries('somaTreasuryHoldings'),'2026-10-14'),/^As of /);
 assert.match(periodLabel(getSeries('claims'),'2026-10-14'),/^Week ending /);
});
test('ownership admission is scoped and requires conditional SOMA redistribution metadata',()=>{
 const snapshot={sources:{ownership:{series:{somaTreasuryHoldings:soma}}}};
 assert.doesNotThrow(()=>assertCommercialData(snapshot));
 for(const key of ['sourceTitle','termsUrl','attribution','redistributionNotice']){const copy=structuredClone(snapshot);delete copy.sources.ownership.series.somaTreasuryHoldings[key];assert.throws(()=>assertCommercialData(copy));}
 const copy=structuredClone(snapshot);copy.sources.ownership.series.somaTreasuryHoldings.sourceUrl='https://markets.newyorkfed.org/api/other.json';assert.throws(()=>assertCommercialData(copy));
 assert.throws(()=>assertCommercialData({sources:{ownership:{series:{foreignTreasuryHoldings:{sourceIds:['LM263061105.Q'],sourceUrl:'https://www.federalreserve.gov/releases/z1/default.htm'}}}}}),/Unreviewed feed/);
});
test('captured ownership joins generic exports with title, terms and provenance',()=>{
 const csv=toCsv(['somaTreasuryHoldings']);assert.match(csv,/SOMA Holdings/);assert.match(csv,/termsofuse/);assert.match(csv,/calculated/);
});
