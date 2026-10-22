import test from 'node:test';import assert from 'node:assert/strict';
import {matchesMarketFeed,assertMarketData} from '../scripts/market-policy.mjs';
import {NY_FED_TERMS_URL,NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE} from '../src/market-functioning.js';
const rate=(kind,end='2026-10-21')=>`https://markets.newyorkfed.org/api/rates/${kind==='sofr'?'secured/sofr':'unsecured/effr'}/search.json?startDate=2024-07-03&endDate=${end}`;
const dealer='https://markets.newyorkfed.org/api/pd/get/SBN2024/timeseries/PDPOSGST-TOT_PDSORA-UTSETTOT_PDSIRRA-UTSETTOT_PDFTD-USTET_PDFTR-USTET.json';
function fixture(){return {fetchedAt:'2026-10-21T23:00:00.000Z',structuralBreak:'SBN2024',coverageStart:'2024-07-03',coverageEnd:'2026-10-21',provenance:[dealer,'https://markets.newyorkfed.org/api/pd/list/seriesbreaks.json',rate('sofr'),rate('effr')].map(url=>({url})),series:{sofrEffrSpread:{sourceTitle:'Secured Overnight Financing Rate Data; Effective Federal Funds Rate',sourceUrl:rate('sofr'),sourceUrls:[rate('sofr'),rate('effr')],licenseUrl:NY_FED_TERMS_URL,sourceNotice:[NY_FED_DATA_NOTICE,NY_FED_REFERENCE_RATE_NOTICE,NY_FED_PRODUCT_NOTICE].join(' '),observationType:'calculated',calculation:'Meridian same-date difference',observations:[{date:'2026-10-20',value:0,publishedAt:null}]}}};}
test('market feed admission rejects changed regime, keys, date bounds and extra query fields',()=>{
 assert.ok(matchesMarketFeed(dealer,'nyfed-market'));assert.ok(matchesMarketFeed(rate('sofr'),'nyfed-sofr'));assert.equal(matchesMarketFeed(rate('effr'),'nyfed-sofr'),false);
 for(const url of [dealer.replace('SBN2024','SBN2013'),dealer.replace('PDPOSGST-TOT','OTHER'),rate('sofr')+'&extra=1',rate('sofr','2026-02-30'),rate('sofr').replace('2024-07-03','2024-07-02')])assert.equal(matchesMarketFeed(url,'nyfed-market'),false,url);
});
test('market capture admission enforces notices, matched input coverage, suppression and unknown release clocks',()=>{
 assert.doesNotThrow(()=>assertMarketData(fixture()));
 for(const mutate of [s=>{delete s.structuralBreak;},s=>{delete s.series.sofrEffrSpread.sourceTitle;},s=>{s.series.sofrEffrSpread.sourceNotice=NY_FED_DATA_NOTICE;},s=>{s.series.sofrEffrSpread.sourceUrls.pop();},s=>{s.coverageEnd='2026-10-20';},s=>{s.series.sofrEffrSpread.observations[0].publishedAt='2026-10-21';},s=>{s.series.sofrEffrSpread.observations[0].suppressed=true;}]){const s=fixture();mutate(s);assert.throws(()=>assertMarketData(s));}
});
test('market observation overrides cannot silently replace a two-source spread with one input in exports',()=>{
 for(const fields of [{sourceUrl:rate('effr')},{sourceUrls:[rate('effr')]}]){const source=fixture();Object.assign(source.series.sofrEffrSpread.observations[0],fields);assert.throws(()=>assertMarketData(source),/override/);}
});
