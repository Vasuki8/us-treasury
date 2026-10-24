import test from 'node:test';
import assert from 'node:assert/strict';
test('upkeep distinguishes missing approved evidence, candidate review and unchecked discovery',async()=>{
 const {publicationUpkeep}=await import('../src/publication-upkeep.js');
 const scopes={cpi:[{id:'approved',sourceUrl:'https://www.bls.gov/news.release/archives/cpi_10142026.htm'}]},archives={cpi:{version:1,releases:[]}};
 const missing=publicationUpkeep({archives,approvedScopes:scopes});assert.equal(missing.families.cpi.missingApprovedIds[0],'approved');assert.equal(missing.status,'missing-approved');
 const retained={cpi:{version:1,releases:[{id:'approved',sourceUrl:scopes.cpi[0].sourceUrl,publicationDate:'2026-10-14',period:'2026-09-01'}]}};
 assert.equal(publicationUpkeep({archives:retained,approvedScopes:scopes}).status,'discovery-unchecked');
 const discoveries={cpi:{status:'checked',candidates:[{sourceUrl:'https://www.bls.gov/news.release/archives/cpi_11102026.htm',publicationDate:'2026-11-10'}]}};
 const review=publicationUpkeep({archives:retained,approvedScopes:scopes,discoveries});assert.equal(review.status,'review-required');assert.equal(review.families.cpi.reviewQueue.length,1);assert.equal(retained.cpi.releases.length,1);
 assert.equal(publicationUpkeep({archives:retained,approvedScopes:scopes,discoveries:{cpi:{status:'error',error:'HTTP 403'}}}).status,'discovery-unavailable');
 assert.equal(publicationUpkeep({archives:{cpi:{version:1,releases:[...retained.cpi.releases,...retained.cpi.releases]}},approvedScopes:scopes,discoveries:{cpi:{status:'checked',candidates:[]}}}).status,'invalid-archive');
});
test('official candidate extraction is bounded, date-scoped, deduplicated and never admits facts',async()=>{
 const {discoverCpiCandidates}=await import('../scripts/check-publication-upkeep.mjs');
 const html='<h1>Consumer Price Index Archived News Releases</h1><a href="/news.release/archives/cpi_11102026.htm">Nov</a><a href="/news.release/archives/cpi_11102026.htm">same</a><a href="https://evil.invalid/news.release/archives/cpi_12102026.htm">bad</a><a href="/news.release/archives/cpi_02132020.htm">old</a>';
 const result=discoverCpiCandidates(html,{from:'2026-02-13',through:'2026-11-20'});assert.deepEqual(result,[{sourceUrl:'https://www.bls.gov/news.release/archives/cpi_11102026.htm',publicationDate:'2026-11-10'}]);
 assert.throws(()=>discoverCpiCandidates('Access Denied'),/archive index/);
});

test('maintenance summary preserves review-needed and source-unavailable states without claiming new admission',async()=>{
 const {publicationUpkeepSummary}=await import('../scripts/report-publication-upkeep.mjs');
 const report={checkedAt:'2026-10-23T00:00:00Z',status:'review-required',families:{cpi:{status:'review-required',retainedCount:54,approvedCount:54,missingApprovedIds:[],reviewQueue:[{}],discovery:{status:'checked'}},claims:{status:'discovery-unavailable',retainedCount:2,approvedCount:2,missingApprovedIds:[],reviewQueue:[],discovery:{status:'error'}}},interpretation:'Candidates <require> review | no auto-admission.'};
 const text=publicationUpkeepSummary(report);assert.match(text,/cpi \| review-required \| 54 \/ 54 \| 0 \| 1 \| checked/);assert.match(text,/claims \| discovery-unavailable/);assert.match(text,/does not admit new publications/);assert.doesNotMatch(text,/<require>/);
});
