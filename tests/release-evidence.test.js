import test from 'node:test';
import assert from 'node:assert/strict';
import {claimsFact as fixtureClaimsFact} from './helpers/claims-publications-fixture.js';

const api=await import('../src/release-evidence.js').catch(error=>{if(error.code==='ERR_MODULE_NOT_FOUND')return {};throw error;});
const sourceUrl='https://www.bea.gov/sites/default/files/2026-06/gdp-gdi-vintage-history.xlsx';
const gdp=(overrides={})=>{const row={seriesId:'gdp',period:'2026-01-01',estimate:'Second',value:1.6,unit:'Percent change from preceding quarter, annualized',frequency:'Quarterly',adjustment:'Seasonally adjusted annual rate',publicationDate:'2026-05-28',publicationDatePrecision:'day',publishedAt:null,releaseEvidenceUrl:'https://www.bea.gov/news/2026/gdp-second',sourceUrl,sourceIds:['A191RL'],provenance:[{url:sourceUrl,sha256:'a'.repeat(64),retrievedAt:'2026-05-28T16:00:00.000Z'}],...overrides};return {id:`bea-gdp-${row.period.slice(0,4)}q${(Number(row.period.slice(5,7))+2)/3}-${row.estimate.toLowerCase()}-${row.publicationDate}`,...row};};
const claimsFact=(overrides={})=>{const row=fixtureClaimsFact(overrides);return {...row,id:`dol-${row.seriesId}-${row.period}-${row.releaseStage}-${row.publicationDate}`};};
const event={id:'gdp-event',sourceId:'bea',program:'gdp',name:'Gross Domestic Product, 1st Quarter 2026 (Second Estimate)',period:null,periodLabel:'1st Quarter 2026',date:'2026-05-28',time:'08:30',scheduledAt:'2026-05-28T12:30:00.000Z'};
const claimsEvent={id:'claims-event',sourceId:'dol',program:'weekly-claims',date:'2026-03-19',time:'08:30',scheduledAt:'2026-03-19T12:30:00.000Z'};

test('GDP matches the exact quarter and estimate and retains its earlier estimate separately',()=>{
 assert.equal(typeof api.matchReleaseEvidence,'function');
 const before=gdp({publicationDate:'2026-04-30',estimate:'Advance',value:2});
 const result=api.matchReleaseEvidence(event,{releases:[before,gdp(),gdp({period:'2025-10-01',value:9})]});
 assert.equal(result.status,'verified');assert.equal(result.actual.value,1.6);assert.equal(result.earlierPublication.value,2);assert.equal(result.revision,-0.4);assert.equal(result.sameReleasePrior,null);assert.equal(result.actual.publishedAt,null);
});

test('a past schedule never proves a result and mismatched dimensions are rejected',()=>{
 assert.equal(typeof api.matchReleaseEvidence,'function');
 for(const change of [{unit:'Percent year over year'},{frequency:'Monthly'},{adjustment:'Not seasonally adjusted'},{estimate:'Advance'},{period:'2026-04-01'},{publicationDate:'2026-05-29'},{publicationDatePrecision:'instant'},{value:null}]){
  assert.equal(api.matchReleaseEvidence(event,{releases:[gdp(change)]}).status,'unavailable',JSON.stringify(change));
 }
 assert.equal(api.matchReleaseEvidence({...event,sourceId:'census'},{releases:[gdp()]}).status,'unsupported');
 assert.equal(api.matchReleaseEvidence({...event,period:'2026-04-01'},{releases:[gdp()]}).status,'unavailable');
 assert.equal(api.matchReleaseEvidence(event,{releases:[gdp(),gdp()]}).status,'ambiguous');
});

test('claims actual, revised prior and earlier published prior remain distinct roles',()=>{
 assert.equal(typeof api.matchReleaseEvidence,'function');
 const earlier=claimsFact({period:'2026-03-07',publicationDate:'2026-03-12',value:200});
 const prior=claimsFact({period:'2026-03-07',publicationDate:'2026-03-19',releaseStage:'prior-week-revised',value:201});
 const actual=claimsFact({period:'2026-03-14',publicationDate:'2026-03-19',value:202});
 const result=api.matchReleaseEvidence(claimsEvent,{releases:[earlier,prior,actual]},{seriesId:'claimsAdvance'});
 assert.equal(result.status,'verified');assert.equal(result.period,'2026-03-14');assert.equal(result.actual.value,202);assert.equal(result.sameReleasePrior.value,201);assert.equal(result.earlierPrior.value,200);assert.equal(result.priorRevision,1);assert.equal(result.earlierPublication,null);
 assert.equal(api.matchReleaseEvidence(claimsEvent,{releases:[prior]},{seriesId:'claimsAdvance'}).status,'unavailable');
 assert.equal(api.matchReleaseEvidence(claimsEvent,{releases:[actual]},{seriesId:'continuedClaimsAdvance'}).status,'unavailable');
});

test('claims period conflicts, incomparable priors and unretained original advances stay unavailable',()=>{
 assert.equal(typeof api.matchReleaseEvidence,'function');
 const actual=claimsFact({period:'2026-03-14',publicationDate:'2026-03-19'}),prior=claimsFact({period:'2026-03-07',publicationDate:'2026-03-19',releaseStage:'prior-week-revised'});
 assert.equal(api.matchReleaseEvidence({...claimsEvent,period:'2026-03-07'},{releases:[actual]},{seriesId:'claimsAdvance'}).status,'unavailable');
 const result=api.matchReleaseEvidence(claimsEvent,{releases:[actual,{...prior,adjustment:'NSA'}]},{seriesId:'claimsAdvance'});
 assert.equal(result.sameReleasePrior,null);assert.equal(result.earlierPrior,null);assert.equal(result.priorRevision,null);
 const retained=api.matchReleaseEvidence(claimsEvent,{releases:[actual,prior]},{seriesId:'claimsAdvance'});
 assert.equal(retained.earlierPrior,null);assert.equal(retained.priorRevision,null);
});

test('date-only evidence exposes schedule-to-retrieval latency without a publication instant',()=>{
 assert.equal(typeof api.releaseDelivery,'function');
 const delivery=api.releaseDelivery(event,gdp());
 assert.equal(delivery.scheduleToRetrievalMinutes,210);assert.equal(delivery.publicationInstant,null);assert.equal(delivery.publicationDate,'2026-05-28');assert.equal(delivery.publicationToRetrievalMinutes,null);
 assert.equal(api.releaseDelivery(event,gdp({provenance:[{retrievedAt:'2026-05-28T12:00:00Z'}]})).scheduleToRetrievalMinutes,null);
});

test('publication-only selection keeps the requested cutoff and reference period',()=>{
 assert.equal(typeof api.selectReleaseEvidence,'function');
 const releases=[gdp({estimate:'Advance',value:2,publicationDate:'2026-04-30'}),gdp(),gdp({period:'2026-04-01',publicationDate:'2026-07-30',estimate:'Advance'})];
 const result=api.selectReleaseEvidence({releases},{seriesId:'gdp',period:'2026-01-01',publicationCutoff:'2026-05-01'});
 assert.equal(result.status,'verified');assert.equal(result.actual.id,'bea-gdp-2026q1-advance-2026-04-30');assert.equal(result.event,null);
 assert.equal(api.selectReleaseEvidence({releases},{seriesId:'gdp',period:'2026-01-01',publicationCutoff:'2026-04-01'}).status,'unavailable');
});
test('malformed archive rows and unreviewed identities cannot become verified publications',()=>{
 for(const row of [null,[],gdp({id:'made-up'}),gdp({period:'2026-02-01'}),gdp({estimate:'unreviewed-stage'}),gdp({sourceIds:['DIFFERENT']}),gdp({provenance:[]}),gdp({provenance:[{url:sourceUrl,sha256:'bad',retrievedAt:'2026-05-28T16:00:00.000Z'}]}),gdp({provenance:[{url:sourceUrl,sha256:'a'.repeat(64),retrievedAt:'2026-02-30T16:00:00.000Z'}]}),gdp({releaseEvidenceUrl:'https://example.com/unreviewed'}),gdp({releaseEvidenceUrl:'https://www.bea.gov@evil.example/news/2026/gdp'}),gdp({sourceUrl:'https://www.bea.gov/unreviewed.xlsx'})]){
  assert.equal(api.selectReleaseEvidence({releases:[row]}).status,'unavailable');
  assert.equal(api.matchReleaseEvidence(event,{releases:[row]}).status,'unavailable');
 }
 assert.equal(api.selectReleaseEvidence({releases:{}}).status,'unavailable');
 const valid=claimsFact({publicationDate:'2026-03-19',period:'2026-03-14'});
 for(const row of [{...valid,id:'made-up'},{...valid,estimate:'Revised prior'},{...valid,period:'2026-03-13'}, {...valid,releaseEvidenceUrl:'https://example.com/claims.pdf'}])assert.equal(api.selectReleaseEvidence({releases:[row]},{seriesId:'claimsAdvance'}).status,'unavailable');
});
test('every retained admitted GDP stage and claims advance remains usable under strict evidence validation',async()=>{
 const [{publicationArchive},{claimsPublicationArchive}]=await Promise.all([import('../src/publication-archive.js'),import('../src/claims-publication-archive.js')]);
 for(const row of publicationArchive.releases)assert.equal(api.selectReleaseEvidence({releases:[row]},{seriesId:'gdp'}).status,'verified',row.id);
 for(const row of claimsPublicationArchive.releases.filter(row=>row.releaseStage==='advance')){
  const selected=api.selectReleaseEvidence(claimsPublicationArchive,{seriesId:row.seriesId,period:row.period,publicationCutoff:row.publicationDate});
  assert.equal(selected.actual.id,row.id);assert.ok(selected.sameReleasePrior,row.id);
 }
});
