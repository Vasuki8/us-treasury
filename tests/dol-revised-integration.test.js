import test from 'node:test';
import assert from 'node:assert/strict';
import {dolRevisedFixture} from './helpers/dol-revised-fixture.js';
import {registry} from '../src/registry.js';
import {asKnownOn,recordVintages} from '../src/vintages.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {toCsv} from '../src/model.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv} from '../src/research-packages.js';
import {buildPinContext} from '../src/research-context.js';
import {parseRoute} from '../src/router.js';

const xml='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const ids=['claims','continuedClaims'];
function inputs(){
 const source=dolRevisedFixture();
 for(const item of Object.values(source.series)){
  item.calculation='Published seasonally adjusted national regular UI count / 1000; thousands, week ending.';
  item.coverageNote='XML base through 2026-09-26; later rows are confirmed prior-week PDF readings. Advance readings stay separate.';
  item.publicationNote='Known PDF publication days are retained separately; exact publication instants are unknown.';
 }
 const catalog=Object.fromEntries(ids.map(id=>[id,{...registry[id],...source.series[id],source:{...registry[id].source,seriesIds:source.series[id].sourceIds},fetchedAt:source.fetchedAt,provenance:source.provenance}]));
 return {source,catalog};
}
function nativeSource(source){
 const prior=structuredClone(source),receipt=prior.provenance.find(row=>row.url===xml);
 delete prior.revisedHistoryProfile;prior.provenance=[receipt];prior.fetchedAt=receipt.retrievedAt;
 for(const [id,item]of Object.entries(prior.series)){
  delete item.inputProvenanceScope;delete item.sourceUrls;delete item.publicationNote;
  item.observations=item.observations.filter(row=>row.sourceUrl===xml).map(({date,value,publishedAt,sourceValue})=>({date,value,publishedAt,sourceValue}));
  item.latestObservationDate=item.observations.at(-1).date;
 }
 prior.latestObservationDate=prior.series.claims.latestObservationDate;
 return prior;
}

test('DOL confirmed PDF profile, row receipts and publication notes survive replay while legacy capture keys stay exact',()=>{
 const {source}=inputs(),prior=nativeSource(source);
 const before=recordVintages(null,{}, {dol:prior},{checkedAt:prior.fetchedAt,seriesMetadata:registry});
 const bytes=JSON.stringify(before.captures);
 assert.deepEqual(recordVintages(before,{dol:prior},{dol:prior},{checkedAt:prior.fetchedAt,seriesMetadata:registry}),before);
 const after=recordVintages(before,{dol:prior},{dol:source},{checkedAt:source.fetchedAt,seriesMetadata:registry});
 assert.equal(JSON.stringify(after.captures.slice(0,-1)),bytes);
 const replay=asKnownOn(after,source.fetchedAt).sources.dol;
 assert.deepEqual(replay.revisedHistoryProfile,source.revisedHistoryProfile);
 for(const id of ids){
  assert.deepEqual(replay.series[id].observations,source.series[id].observations);
  assert.equal(replay.series[id].publicationNote,source.series[id].publicationNote);
 }
 assert.equal(asKnownOn(after,prior.fetchedAt).sources.dol.revisedHistoryProfile,undefined);
 assert.doesNotThrow(()=>assertCommercialData({sources:{dol:source},vintages:after}));
});

test('DOL revised CSV and portable research preserve each selected actual receipt and confirmed role',async()=>{
 const {source,catalog}=inputs(),csv=toCsv(ids,{catalog,range:{preset:'all'}}),[headers,...cells]=parseCsv(csv);
 const rows=cells.map(row=>Object.fromEntries(headers.map((name,index)=>[name,row[index]])));
 assert.equal(rows.length,8);
 const initial=rows.find(row=>row.series_id==='claims'&&row.date==='2026-10-10');
 assert.equal(initial.value,'200');assert.equal(initial.source_value,'200,000');assert.equal(initial.publication_date,'');
 assert.equal(initial.source_url,'https://oui.doleta.gov/press/2026/102226.pdf');
 assert.equal(JSON.parse(initial.capture_provenance_json).length,1);
 for(const row of rows){
  const original=catalog[row.series_id].observations.find(value=>value.date===row.date);
  const receipt=JSON.parse(row.capture_provenance_json);
  assert.equal(row.retrieved_at,original.retrievedAt);assert.equal(receipt[0].sha256,original.sourceSha256);assert.equal(receipt[0].url,original.sourceUrl);
  assert.ok(!receipt.some(value=>value.url.endsWith('archive.asp')));
 }
 const pkg=await createResearchPackage({name:'Confirmed DOL PDF study',state:{page:'explore',selected:ids,window:'all',comparison:'native',transform:'level'},catalog,sources:{dol:source},snapshot:{generatedAt:source.fetchedAt}});
 const text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
 assert.equal(exportResearchPackage(restored),text);assert.equal(researchPackageCsv(restored),csv);
 assert.equal(restored.catalog.claims.observations.at(-1).releaseStage,'prior-week-revised');
 assert.equal(restored.catalog.continuedClaims.observations.at(-1).date,'2026-10-03');
});

test('DOL captured-by pins retain the supplement contract and exact captured CSV independently of current data',async()=>{
 const {source,catalog}=inputs(),history=recordVintages(null,{}, {dol:source},{checkedAt:source.fetchedAt,seriesMetadata:registry});
 const state=parseRoute(`#/vintages?series=claims&cutoff=${source.fetchedAt}`);
 const args=buildPinContext(state,{historyState:{status:'ready',history},catalog,sources:{dol:source},snapshot:{generatedAt:source.fetchedAt}});
 assert.deepEqual(args.catalog.claims.observations,source.series.claims.observations);
 assert.equal(args.catalog.claims.inputProvenanceScope,'observation-source-urls');
 const pkg=await createResearchPackage({name:'Captured confirmed DOL history',...args});
 const text=exportResearchPackage(pkg);assert.equal(exportResearchPackage(await importResearchPackage(text)),text);
});
