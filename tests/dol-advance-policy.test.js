import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {assertDolAdvanceData,dolAdvancePolicy} from '../scripts/dol-advance-policy.mjs';
import {parseDolAdvanceText} from '../scripts/sources/dol-advance.mjs';
import {releaseFixture} from './helpers/dol-advance-fixture.js';
const at='2026-10-22T20:00:00.000Z';
const fixture=()=>({sources:{dolAdvance:{...parseDolAdvanceText(releaseFixture(),{now:new Date(at)}),status:'ok',fetchedAt:at,provenance:[{url:'https://www.dol.gov/ui/data.pdf',sha256:'a'.repeat(64),retrievedAt:at,lastModified:null}]}}});

test('admission approves only the separate latest-release identities and exact official PDF with rights',()=>{
 const value=fixture();assert.equal(assertDolAdvanceData(value),true);assertCommercialData(value);
 assert.deepEqual(dolAdvancePolicy.series,{claimsAdvance:['InitialClaims/SA/Release'],continuedClaimsAdvance:['ContinuedClaims/SA/Release']});
 assert.equal(dolAdvancePolicy.commercialUse,true);assertDolAdvanceData({sources:{}});
 assertDolAdvanceData({sources:{dolAdvance:{status:'unavailable',fetchedAt:null,series:{},provenance:[]}}});
});

test('admission rejects source substitutions, rights/timing/roles and any merge into revised history',()=>{
 const changes=[
  s=>s.sources.dolAdvance.series.claimsAdvance.sourceIds=['InitialClaims/SA'],
  s=>s.sources.dolAdvance.series.claimsAdvance.sourceUrl='https://example.com/release.pdf',
  s=>s.sources.dolAdvance.provenance[0].url='https://www.dol.gov/newsroom/',
  s=>s.sources.dolAdvance.series.claimsAdvance.licenseUrl='',
  s=>s.sources.dolAdvance.series.claimsAdvance.attribution='',
  s=>s.sources.dolAdvance.series.claimsAdvance.publicationNote='Instant verified',
  s=>s.sources.dolAdvance.series.claimsAdvance.observations.push({...s.sources.dolAdvance.series.claimsAdvance.observations[0],date:'1967-01-07'}),
  s=>s.sources.dolAdvance.series.claimsAdvance.observations[1].value=999,
  s=>s.sources.dolAdvance.series.claimsAdvance.observations[1].publishedAt='2026-10-22T12:30:00Z',
  s=>s.sources.dolAdvance.series.claimsAdvance.observations[1].publicationDatePrecision='second',
  s=>s.sources.dolAdvance.series.claimsAdvance.observations[0].releaseStage='advance',
  s=>s.sources.dolAdvance.series.claimsAdvance.observations[1].date='2026-10-18',
  s=>s.sources.dolAdvance.series.claimsAdvance.observations[1].sourceUrl='https://example.com',
  s=>s.sources.dolAdvance.provenance[0].sha256='x',
  s=>s.sources.dolAdvance.series.claims=s.sources.dolAdvance.series.claimsAdvance,
 ];
 for(const mutate of changes){const value=fixture();mutate(value);assert.throws(()=>assertCommercialData(value),/DOL advance|unreviewed/i);}
});
