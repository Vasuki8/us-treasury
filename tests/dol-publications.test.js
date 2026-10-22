import test from 'node:test';import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as policy from '../scripts/dol-publication-policy.mjs';
import {parseClaimsPublication,collectClaimsPublications,reviewedClaimsText} from '../scripts/sources/dol-publications.mjs';
import {releaseFixture} from './helpers/dol-advance-fixture.js';
const current='https://oui.doleta.gov/press/2026/102226.pdf';
const receipt=url=>({url,sha256:'a'.repeat(64),retrievedAt:'2026-10-22T22:00:00.000Z',lastModified:null});
const now=new Date('2026-10-22T22:00:00Z');
const fixture=()=>parseClaimsPublication(releaseFixture(),{provenance:receipt(current),now});

test('reviewed scope is 140 discovered releases and 560 separate facts, preserving the 2026/2025 scope prefix',()=>{
 assert.equal(policy.claimsPublicationScope.length,560);assert.equal(new Set(policy.claimsPublicationScope.map(x=>x.sourceUrl)).size,140);
 assert.equal(new Set(policy.claimsPublicationScope.map(x=>x.id)).size,560);
 assert.deepEqual([...new Set(policy.claimsPublicationScope.map(x=>x.publicationDate))].sort().slice(0,1),['2024-01-04']);
 assert.ok(policy.claimsPublicationScope.slice(0,168).every(x=>x.publicationDate.startsWith('2026')));
 assert.ok(policy.claimsPublicationScope.slice(168,352).every(x=>x.publicationDate.startsWith('2025')));
 assert.ok(policy.claimsPublicationScope.slice(352).every(x=>x.publicationDate.startsWith('2024')));
 const unknown=policy.claimsPublicationScope.filter(x=>x.releaseStage==='prior-week-status-unknown');assert.equal(unknown.length,2);
 for(const scope of unknown){const row=policy.claimsPublicationMetadataFor(scope);assert.equal(row.estimate,'Prior comparison (status unknown)');assert.equal(row.previouslyPublishedSourceValue,null);assert.match(row.footnotes.join(' '),/October 2.*November 13/);assert.equal(row.seasonalAdjustmentNote,null);}
 assert.ok(policy.claimsPublicationScope.every(x=>['claimsAdvance','continuedClaimsAdvance'].includes(x.seriesId)));
 assert.throws(()=>policy.requestedClaimsPublicationIds(['unreviewed']),/scope|unknown|requested/i);
});

test('printed September11 continued-SA zero is restricted to its reviewed bytes and source row',()=>{
 const input={firstPage:'Unchanged source text',tableText:'Insured Unemployment (SA) 1,939,000 1,939,000 1,944,000 1,845,000 Insured Unemployment (NSA)'};
 const source={...receipt('https://oui.doleta.gov/press/2025/091125.pdf'),sha256:'f4ba1484bf28e725205ef24c3ddb0c25e279c25349fe07d3db0e6e8571f53f1a'};
 const corrected=reviewedClaimsText(input,source);assert.match(corrected.tableText,/1,939,000 1,939,000 0 1,944,000/);assert.equal(input.tableText.includes(' 0 '),false);
 assert.equal(reviewedClaimsText(input,{...source,sha256:'a'.repeat(64)}),input);
 assert.throws(()=>reviewedClaimsText({...input,tableText:input.tableText.replace('1,939,000','1,940,000')},source),/zero|table|cell/i);
 const notes=policy.claimsPublicationScope.filter(row=>row.publicationDate==='2025-09-11').map(row=>policy.claimsPublicationMetadataFor(row));
 assert.equal(notes.filter(row=>row.tableExtractionNote).length,2);assert.ok(notes.filter(row=>row.tableExtractionNote).every(row=>row.seriesId==='continuedClaimsAdvance'&&/September 11/.test(row.tableExtractionNote)));
});
test('archived release adapter preserves both measures, explicit roles and known release day with actual source receipt',()=>{
 const result=fixture();assert.equal(result.releases.length,4);policy.assertClaimsPublicationData(result);
 assert.deepEqual(result.releases.map(x=>[x.seriesId,x.period,x.estimate,x.value]),[['claimsAdvance','2026-10-10','Revised prior',200],['claimsAdvance','2026-10-17','Advance',194],['continuedClaimsAdvance','2026-10-03','Revised prior',1703],['continuedClaimsAdvance','2026-10-10','Advance',1728]]);
 for(const row of result.releases){assert.equal(row.sourceUrl,current);assert.equal(row.provenance[0].url,current);assert.equal(row.publicationDate,'2026-10-22');assert.equal(row.publicationDatePrecision,'day');assert.equal(row.publishedAt,null);assert.match(row.calculation,/separate|no.*splice/i);assert.match(row.licenseUrl,/dol.gov/);}
 assert.throws(()=>parseClaimsPublication(releaseFixture(),{provenance:receipt('https://www.dol.gov/ui/data.pdf'),now}),/source|scope|URL/i);
 assert.throws(()=>parseClaimsPublication(releaseFixture(),{provenance:receipt('https://oui.doleta.gov/press/2026/101526.pdf'),now}),/date|scope/i);
});
test('exact values, field mappings, roles, notices, units, source paths and retrieval evidence fail closed',()=>{
 const original=fixture();
 const changes=[x=>x.releases.push(x.releases[0]),x=>x.releases[0].seriesId='claims',x=>x.releases[0].sourceIds=['InitialClaims/SA'],x=>x.releases[0].period='2026-10-17',x=>x.releases[0].publicationDate='2026-10-15',x=>x.releases[0].publishedAt='2026-10-22T12:30:00Z',x=>x.releases[0].publicationDatePrecision='instant',x=>{x.releases[0].value=999;x.releases[0].sourceValue='999,000';},x=>x.releases[0].estimate='Advance',x=>x.releases[0].releaseStage='advance',x=>x.releases[0].previouslyPublishedSourceValue='197,000',x=>x.releases[0].sourceUrl='https://oui.doleta.gov/press/2025/102326.pdf',x=>x.releases[0].licenseUrl='',x=>x.releases[0].unit='People',x=>x.releases[0].seasonalAdjustmentNote='Assumed revision cause',x=>x.releases[0].provenance[0].sha256='bad',x=>x.releases[0].provenance[0].retrievedAt='2026-10-22',x=>x.releases[0].provenance[0].retrievedAt='2026-10-22T12:29:59.000Z',x=>x.releases[0].extra='unreviewed'];
 for(const change of changes){const value=structuredClone(original);change(value);assert.throws(()=>policy.assertClaimsPublicationData(value),/DOL.*publication/i);}
 assert.throws(()=>policy.assertClaimsPublicationData(original,{complete:true}),/incomplete/i);
});
test('collector fetches one PDF per requested release, not once per fact, and rejects unknown selections before network',async()=>{
 const ids=fixture().releases.map(x=>x.id),bytes=Buffer.from('%PDF-1.7\nSynthetic test bytes');let calls=0;
 const result=await collectClaimsPublications({ids,now,fetchImpl:async url=>{calls++;assert.equal(url,current);return new Response(bytes);},extractPdf:async()=>releaseFixture()});assert.equal(calls,1);assert.equal(result.releases.length,4);assert.equal(result.releases[0].provenance[0].sha256,createHash('sha256').update(bytes).digest('hex'));
 await assert.rejects(collectClaimsPublications({ids:['unknown'],fetchImpl:()=>{throw Error('Must not fetch');}}),/scope|unknown|requested/i);
 await assert.rejects(collectClaimsPublications({ids,fetchImpl:async()=>new Response('Denied',{status:403})}),/403/);
 await assert.rejects(collectClaimsPublications({ids,fetchImpl:async()=>new Response('HTML')}),/PDF/i);
 await assert.rejects(collectClaimsPublications({ids,fetchImpl:async()=>new Response(bytes),extractPdf:async()=>({...releaseFixture(),tableText:''})}),/table|DOL/i);
});
test('printed March5 table zero repair requires the exact reviewed URL/hash and row shape; other numeric gaps remain errors',()=>{
 const input={firstPage:'Unchanged source text',tableText:'Initial Claims (SA)   213,000   213,000   208,000   224,000 Initial Claims (NSA)'};
 const source={...receipt('https://oui.doleta.gov/press/2026/030526.pdf'),sha256:'752a7c93abb20ee7d2dc980da27935a238761d08f119fdce4e1a42b64be40674'};
 const corrected=reviewedClaimsText(input,source);assert.match(corrected.tableText,/213,000\s+213,000 0\s+208,000/);assert.equal(input.tableText.includes(' 0 '),false);
 for(const changed of [{sha256:'b'.repeat(64)},{url:current}])assert.equal(reviewedClaimsText(input,{...source,...changed}),input);
 assert.throws(()=>reviewedClaimsText({...input,tableText:input.tableText.replace('213,000','214,000')},source),/zero|table|cell/i);
});
test('a reviewed seasonal-update publication cannot acquire its explanatory note if that source notice is missing',()=>{
 const input=releaseFixture({header:'Thursday, March 19, 2026',initialDate:'March 14',priorInitialDate:'March 7',continuedDate:'March 7',priorContinuedDate:'February 28',initial:'205,000',initialChange:'a decrease of 8,000',initialPrior:'unrevised level of 213,000',initialTable:'205,000 213,000 -8,000',continued:'1,857,000',continuedChange:'an increase of 10,000',continuedPrior:"revised level. The previous week's level was revised down by 3,000 from 1,850,000 to 1,847,000",continuedTable:'1,857,000 1,847,000 +10,000'});
 assert.throws(()=>parseClaimsPublication(input,{provenance:receipt('https://oui.doleta.gov/press/2026/031926.pdf'),now}),/notice/i);
});
test('nonfinite values cannot masquerade as null publication instants or source notes',()=>{
 for(const [field,value]of [['publishedAt',NaN],['seasonalAdjustmentNote',Infinity],['tableExtractionNote',NaN],['seasonalAdjustmentKind',-Infinity]]){
  const input=fixture();input.releases[0][field]=value;assert.throws(()=>policy.assertClaimsPublicationData(input),/DOL.*publication/i);
 }
});
test('PDF hashes require actual strings rather than JSON values coerced by a regular expression',()=>{
 const input=fixture();input.releases[0].provenance[0].sha256=['a'.repeat(64)];assert.throws(()=>policy.assertClaimsPublicationData(input),/DOL.*publication/i);
});
