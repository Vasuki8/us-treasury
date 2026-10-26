import test from 'node:test';
import assert from 'node:assert/strict';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {matchesResearchFeed} from '../scripts/research-policy.mjs';
import {observationCapture,toCsv} from '../src/model.js';
import {registry} from '../src/registry.js';
import {recordVintages,asKnownOn} from '../src/vintages.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const primary='https://markets.newyorkfed.org/api/soma/summary.json';
const alternate='https://www.newyorkfed.org/medialibrary/Interactives/markets/soma-interactive/soma-data/total-portfolio-summary.json';
const zip='https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip';
const dates=['2014-02-05','2014-02-12','2014-02-19','2014-02-26','2014-03-05','2014-03-12','2014-03-19','2014-03-26','2014-04-02','2014-04-09','2014-04-16','2014-04-23','2014-04-30','2014-05-07','2014-05-14'];
const primaryReceipt={url:primary,sha256:'a'.repeat(64),retrievedAt:'2026-10-26T19:00:00.000Z',lastModified:null};
const alternateReceipt={url:alternate,sha256:'b'.repeat(64),retrievedAt:'2026-10-26T19:00:01.000Z',lastModified:null};
const observation=(date,receipt,value=2.5)=>({date,value,publishedAt:null,sourceUrl:receipt.url,sourceSha256:receipt.sha256,retrievedAt:receipt.retrievedAt});
function fixture(){return {status:'ok',fetchedAt:'2026-10-26T19:00:01.000Z',provenance:[{...primaryReceipt},{...alternateReceipt}],series:{somaTreasuryHoldings:{sourceUrl:primary,sourceUrls:[primary,alternate],sourceIds:['SOMA:treasury-adjusted-par'],inputProvenanceScope:'observation-source-urls',sourceTitle:'SOMA Holdings',termsUrl:'https://www.newyorkfed.org/privacy/termsofuse.html',attribution:'Source: Federal Reserve Bank of New York.',redistributionNotice:'Redistribute under the same permissions, conditions and restrictions.',observations:[observation('2014-01-29',primaryReceipt),...dates.map(date=>observation(date,alternateReceipt)),observation('2014-05-21',primaryReceipt)]}}};}
const admit=source=>assertCommercialData({sources:{ownership:source}});
const catalog=source=>({somaTreasuryHoldings:{...registry.somaTreasuryHoldings,...source.series.somaTreasuryHoldings,source:{...registry.somaTreasuryHoldings.source,seriesIds:['SOMA:treasury-adjusted-par']},fetchedAt:source.fetchedAt,provenance:source.provenance}});

test('SOMA admission accepts only the exact reviewed summary API and supplemental aggregate URLs',()=>{
 assert.equal(matchesResearchFeed(primary,'nyfed-soma'),true);
 assert.equal(matchesResearchFeed(alternate,'nyfed-soma'),true);
 for(const url of [alternate+'?date=2014-02-05',alternate+'#summary',alternate.replace('summary.json','summary.json/'),alternate.replace('total-portfolio-summary.json','treasury-holdings.json'),'https://markets.newyorkfed.org/api/soma/tsy/get/2014-02-05.json'])assert.equal(matchesResearchFeed(url,'nyfed-soma'),false,url);
});

test('reviewed SOMA gap dates use their own single receipt while adjacent API observations keep theirs',()=>{
 const source=fixture();assert.doesNotThrow(()=>admit(source));
 const item=catalog(source).somaTreasuryHoldings;
 for(const row of item.observations)assert.deepEqual(observationCapture(item,row).provenance,[dates.includes(row.date)?alternateReceipt:primaryReceipt]);
 const [headers,...rows]=parseCsv(toCsv(['somaTreasuryHoldings'],{catalog:catalog(source),range:{preset:'all'}}));
 for(const fields of rows){
  const row=Object.fromEntries(headers.map((key,index)=>[key,fields[index]])),receipt=dates.includes(row.date)?alternateReceipt:primaryReceipt;
  assert.equal(row.source_url,receipt.url);assert.equal(row.source_urls,receipt.url);assert.equal(row.retrieved_at,receipt.retrievedAt);assert.equal(row.publication_date,'');assert.deepEqual(JSON.parse(row.capture_provenance_json),[receipt]);
 }
});

test('supplemental SOMA admission rejects foreign series, unreviewed dates and receipt or scope overrides',()=>{
 const cases=[
  ['outside reviewed dates',source=>{source.series.somaTreasuryHoldings.observations[1].date='2014-05-28';}],
  ['duplicate gap date',source=>{source.series.somaTreasuryHoldings.observations[2].date='2014-02-05';}],
  ['missing value',source=>{source.series.somaTreasuryHoldings.observations[1].value=null;}],
  ['nonfinite value',source=>{source.series.somaTreasuryHoldings.observations[1].value=Infinity;}],
  ['string value',source=>{source.series.somaTreasuryHoldings.observations[1].value='2.5';}],
  ['wrong receipt hash',source=>{source.series.somaTreasuryHoldings.observations[1].sourceSha256='c'.repeat(64);}],
  ['missing receipt hash',source=>{delete source.series.somaTreasuryHoldings.observations[1].sourceSha256;}],
  ['missing receipt clock',source=>{delete source.series.somaTreasuryHoldings.observations[1].retrievedAt;}],
  ['different receipt clock',source=>{source.series.somaTreasuryHoldings.observations[1].retrievedAt='2026-10-26T19:00:00.500Z';}],
  ['future receipt clock',source=>{source.provenance[1].retrievedAt=source.series.somaTreasuryHoldings.observations[1].retrievedAt='2026-10-27T19:00:00.000Z';}],
  ['missing receipt',source=>{source.provenance.pop();}],
  ['duplicate receipt',source=>{source.provenance.push({...alternateReceipt});}],
  ['invented publication instant',source=>{source.series.somaTreasuryHoldings.observations[1].publishedAt='2014-02-06T09:00:00.000Z';}],
  ['row URL list override',source=>{source.series.somaTreasuryHoldings.observations[1].sourceUrls=[alternate];}],
  ['row provenance override',source=>{source.series.somaTreasuryHoldings.observations[1].inputProvenance=[alternateReceipt];}],
  ['unmarked row scope',source=>{delete source.series.somaTreasuryHoldings.inputProvenanceScope;}],
  ['unknown row scope',source=>{source.series.somaTreasuryHoldings.inputProvenanceScope='supplemental';}],
  ['missing source URL declaration',source=>{delete source.series.somaTreasuryHoldings.sourceUrls;}],
  ['extra declared URL',source=>{source.series.somaTreasuryHoldings.sourceUrls.push(zip);}],
  ['duplicate declared URL',source=>{source.series.somaTreasuryHoldings.sourceUrls.push(alternate);}],
  ['supplemental primary URL',source=>{source.series.somaTreasuryHoldings.sourceUrl=alternate;}],
  ['unmarked supplemental primary bypass',source=>{const item=source.series.somaTreasuryHoldings;item.sourceUrl=alternate;delete item.inputProvenanceScope;item.observations=item.observations.map(({date,value,publishedAt})=>({date,value,publishedAt}));}],
  ['unused supplemental receipt bypass',source=>{const item=source.series.somaTreasuryHoldings;delete item.inputProvenanceScope;delete item.sourceUrls;item.observations=item.observations.map(({date,value,publishedAt})=>({date,value,publishedAt}));}],
  ['supplemental query lookalike',source=>{const url=alternate+'?source=official';source.series.somaTreasuryHoldings.sourceUrls[1]=source.provenance[1].url=url;for(const row of source.series.somaTreasuryHoldings.observations)if(row.sourceUrl===alternate)row.sourceUrl=url;}],
 ];
 for(const id of ['foreignTreasuryHoldings','fedTreasuryHoldings'])cases.push([`supplemental ${id}`,source=>{source.series[id]={...structuredClone(source.series.somaTreasuryHoldings),sourceUrl:zip,sourceIds:[id==='foreignTreasuryHoldings'?'LM263061105.Q':'LM713061103.Q']};}]);
 for(const [name,mutate]of cases){const source=fixture();mutate(source);assert.throws(()=>admit(source),/ownership|provenance|source|feed/i,name);}
});

test('legacy and ordinary marked SOMA captures remain admissible without supplemental metadata',()=>{
 const source=fixture();source.provenance=[{...primaryReceipt}];
 const item=source.series.somaTreasuryHoldings;delete item.sourceUrls;item.observations=[observation('2014-02-05',primaryReceipt,null)];
 assert.doesNotThrow(()=>admit(source));
 delete item.inputProvenanceScope;item.observations=[{date:'2014-02-05',value:null,publishedAt:null}];
 assert.doesNotThrow(()=>admit(source));
});

test('supplemental row receipts replay exactly without rewriting the earlier ownership capture',()=>{
 const next=fixture(),old=structuredClone(next);old.fetchedAt='2026-10-26T19:00:00.000Z';old.provenance=[{...primaryReceipt}];
 const item=old.series.somaTreasuryHoldings;delete item.sourceUrls;item.observations=item.observations.map(row=>observation(row.date,primaryReceipt,dates.includes(row.date)?null:row.value));
 const before=recordVintages(null,{}, {ownership:old},{checkedAt:old.fetchedAt,seriesMetadata:registry}),bytes=JSON.stringify(before.captures);
 const after=recordVintages(before,{ownership:old},{ownership:next},{checkedAt:next.fetchedAt,seriesMetadata:registry});
 assert.equal(JSON.stringify(after.captures.slice(0,before.captures.length)),bytes);
 const replay=asKnownOn(after,next.fetchedAt).sources.ownership;
 assert.deepEqual(replay.series.somaTreasuryHoldings.observations,next.series.somaTreasuryHoldings.observations);
 assert.deepEqual(replay.series.somaTreasuryHoldings.sourceUrls,[primary,alternate]);assert.equal(replay.series.somaTreasuryHoldings.inputProvenanceScope,'observation-source-urls');assert.deepEqual(replay.provenance,next.provenance);
 assert.doesNotThrow(()=>assertCommercialData({sources:{ownership:next},vintages:after}));
});
