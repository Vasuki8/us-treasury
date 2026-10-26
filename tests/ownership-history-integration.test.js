import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../src/official-snapshot.js';
import {registry} from '../src/registry.js';
import {recordVintages,asKnownOn} from '../src/vintages.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {toCsv,transformSeries,observationCapture} from '../src/model.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {buildCoverageInventory} from '../src/coverage-inventory.js';

const ids=['foreignTreasuryHoldings','fedTreasuryHoldings','somaTreasuryHoldings'];
const zip='https://www.federalreserve.gov/releases/z1/current/z1_csv_files.zip';
const page='https://www.federalreserve.gov/releases/z1/default.htm';
const soma='https://markets.newyorkfed.org/api/soma/summary.json';
function fixture(){
 const retained=snapshot.sources.ownership,old={...structuredClone(retained)};
 // This fixture exercises registered capture lineage. Supplementary sector
 // tables and their real full-history parsing are checked separately.
 delete old.z1;delete old.soma;
 old.provenance=old.provenance.filter(receipt=>[zip,page,soma].includes(receipt.url));
 old.fetchedAt=old.provenance.map(receipt=>receipt.retrievedAt).sort().at(-1);
 for(const [index,id]of ids.entries()){
  const item=old.series[id];delete item.inputProvenanceScope;delete item.sourceUrls;
  item.observations=item.observations.slice(index===2?-104:-36).map(({date,value,publishedAt})=>({date,value,publishedAt}));
 }
 const at=new Date(Date.parse(old.fetchedAt)+60000).toISOString();
 const receipts=[{url:zip,sha256:'a'.repeat(64),retrievedAt:at,lastModified:null},{url:page,sha256:'b'.repeat(64),retrievedAt:new Date(Date.parse(at)-1000).toISOString(),lastModified:null},{url:soma,sha256:'c'.repeat(64),retrievedAt:new Date(Date.parse(at)-2000).toISOString(),lastModified:null}];
 const next={...structuredClone(old),fetchedAt:at,provenance:receipts};
 for(const [index,id]of ids.entries()){
  const item=next.series[id],receipt=receipts.find(row=>row.url===(index===2?soma:zip));
  // Synthetic early amounts test sparse native-date behavior, not real levels.
  if(index<2)item.observations=[{date:'1945-12-31',value:1+index,publishedAt:null},{date:'1946-12-31',value:2+index,publishedAt:null},{date:'1952-03-31',value:3+index,publishedAt:null},...item.observations];
  item.inputProvenanceScope='observation-source-urls';
  item.observations=item.observations.map(row=>({...row,sourceUrl:receipt.url,sourceSha256:receipt.sha256,retrievedAt:receipt.retrievedAt}));
 }
 return {old,next};
}
const catalog=source=>Object.fromEntries(ids.map(id=>[id,{...registry[id],...source.series[id],source:{...registry[id].source,seriesIds:source.series[id].sourceIds},fetchedAt:source.fetchedAt,provenance:source.provenance}]));

test('Fed ownership definition qualifies the earlier source before the 2012 fair-value method',()=>{
 assert.match(registry.fedTreasuryHoldings.definition,/2012/);
 assert.match(registry.fedTreasuryHoldings.definition,/H\.4\.1/);
});

test('new ownership row receipts must match their own admitted numerical feed, hash and clock',()=>{
 const {old,next}=fixture();assert.doesNotThrow(()=>assertCommercialData({sources:{ownership:old}}));assert.doesNotThrow(()=>assertCommercialData({sources:{ownership:next}}));
 for(const mutate of [
  source=>{Object.assign(source.series.foreignTreasuryHoldings.observations[0],{sourceUrl:soma,sourceSha256:'c'.repeat(64),retrievedAt:source.provenance[2].retrievedAt});},
  source=>{source.series.fedTreasuryHoldings.observations[0].sourceSha256='d'.repeat(64);},
  source=>{source.series.somaTreasuryHoldings.observations[0].retrievedAt=source.fetchedAt;},
  source=>{delete source.series.foreignTreasuryHoldings.inputProvenanceScope;},
  source=>{source.series.foreignTreasuryHoldings.observations[0].inputProvenance=[source.provenance[2]];},
  source=>{source.series.foreignTreasuryHoldings.observations[0].sourceUrls=[zip];},
  source=>{source.series.foreignTreasuryHoldings.observations[0].sourceSha256=['a'.repeat(64)];},
  source=>{source.series.foreignTreasuryHoldings.observations[0].retrievedAt=[source.fetchedAt];},
 ]){const invalid=structuredClone(next);mutate(invalid);assert.throws(()=>assertCommercialData({sources:{ownership:invalid}}),/ownership|provenance|source/i);}
});

test('annual-prefix ownership levels keep native dates in All/custom views and exact per-feed CSV',()=>{
 const {next}=fixture(),data=catalog(next),inventory=buildCoverageInventory(data);
 for(const id of ids.slice(0,2)){
  assert.equal(inventory.rows.find(row=>row.id===id).firstReference,'1945-12-31');
  const range={preset:'custom',startDate:'1945-12-31',endDate:'1952-03-31'};
  assert.deepEqual(transformSeries(data[id],'level',range).observations.map(row=>row.date),['1945-12-31','1946-12-31','1952-03-31']);
  assert.equal(transformSeries(data[id],'change',range).observations[1].value,1,'the change is between actual annual observations');
 }
 const [headers,...rows]=parseCsv(toCsv(ids,{catalog:data,range:{preset:'all'}})),columns=Object.fromEntries(headers.map((key,index)=>[key,index]));
 for(const row of rows){const item=data[row[columns.series_id]],original=item.observations.find(point=>point.date===row[columns.date]),capture=observationCapture(item,original);assert.equal(row[columns.publication_date],'');assert.equal(capture.provenance.length,1);assert.deepEqual(JSON.parse(row[columns.capture_provenance_json]),capture.provenance);assert.equal(row[columns.retrieved_at],original.retrievedAt);assert.equal(capture.provenance[0].url,item.sourceUrl);}
});

test('new ownership source scope replays exactly while the old archive prefix and old CSV remain unchanged',()=>{
 const {old,next}=fixture(),before=recordVintages(null,{}, {ownership:old},{checkedAt:old.fetchedAt,seriesMetadata:registry}),bytes=JSON.stringify(before.captures),oldCsv=toCsv(ids,{catalog:catalog(old),range:{preset:'all'}});
 const after=recordVintages(before,{ownership:old},{ownership:next},{checkedAt:next.fetchedAt,seriesMetadata:registry});
 assert.equal(JSON.stringify(after.captures.slice(0,before.captures.length)),bytes);
 const prior=asKnownOn(after,old.fetchedAt).sources.ownership,replay=asKnownOn(after,next.fetchedAt).sources.ownership;
 assert.equal(toCsv(ids,{catalog:catalog(prior),range:{preset:'all'}}),oldCsv);
 for(const id of ids){assert.equal(replay.series[id].inputProvenanceScope,'observation-source-urls');assert.deepEqual(replay.series[id].observations,next.series[id].observations);assert.equal(prior.series[id].inputProvenanceScope,undefined);}
 assert.doesNotThrow(()=>assertCommercialData({sources:{ownership:next},vintages:after}));
});
