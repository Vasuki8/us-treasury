import test from 'node:test';
import assert from 'node:assert/strict';
import {dataStatus,series} from '../src/data.js';
import {parseRoute} from '../src/router.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {buildPinContext} from '../src/research-context.js';
import {ownershipCsv} from '../src/ownership-page.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';

const parsedRows=text=>{const [header,...rows]=parseCsv(text);return rows.map(row=>Object.fromEntries(header.map((key,index)=>[key,row[index]])));};
function historicalInputs(){
  const source=structuredClone(dataStatus.sources.ownership),template=source.z1.history.at(-1);
  const dates=[...Array.from({length:7},(_,index)=>`${1945+index}-12-31`),...Array.from({length:298},(_,index)=>new Date(Date.UTC(1952,3+3*index,0)).toISOString().slice(0,10))];
  source.z1.history=dates.map((date,index)=>{
    const sectors=template.sectors.map(row=>({...row,value:row.value===null?null:row.value+index}));
    const complete=sectors.every(row=>Number.isFinite(row.value))&&Number.isFinite(template.valuationDiscrepancy);
    const assets=complete?sectors.reduce((sum,row)=>sum+row.value,0):null;
    return {...template,date,sectors,assets,liabilities:complete?assets+template.valuationDiscrepancy:null,reconciled:complete};
  });
  for(const field of ['sectors','assets','liabilities','valuationDiscrepancy','reconciled'])source.z1[field]=source.z1.history.at(-1)[field];
  for(const [id,code]of [['foreignTreasuryHoldings','LM263061105.Q'],['fedTreasuryHoldings','LM713061103.Q']]){
    const item=source.series[id],receipt=source.provenance.find(row=>row.url===item.sourceUrl);
    const evidence=item.inputProvenanceScope==='observation-source-urls'?{sourceUrl:receipt.url,sourceSha256:receipt.sha256,retrievedAt:receipt.retrievedAt}:{};
    item.observations=source.z1.history.map(row=>{const value=row.sectors.find(sector=>sector.code===code).value;return {date:row.date,value:value===null?null:value/1000,publishedAt:null,...evidence};});
  }
  const catalog={...series,...Object.fromEntries(Object.entries(source.series).map(([id,item])=>[id,{...series[id],...item,provenance:source.provenance,fetchedAt:source.fetchedAt}]))};
  return {catalog,sources:{...dataStatus.sources,ownership:source}};
}

test('ownership pins retain full histories with a portable page-scoped CSV and full-source lookback',async()=>{
  const inputs=historicalInputs(),original=JSON.stringify(inputs.sources.ownership);
  const args=buildPinContext(parseRoute('#/ownership?window=all'),inputs);
  assert.equal(args.context.moduleSources.ownership.z1.history.length,305);
  for(const id of ['foreignTreasuryHoldings','fedTreasuryHoldings']){
    assert.equal(args.catalog[id].observations.length,305);
    assert.equal(args.catalog[id].inputProvenanceScope,dataStatus.sources.ownership.series[id].inputProvenanceScope);
  }
  assert.equal(args.catalog.somaTreasuryHoldings.observations.length,104);
  const attachment=args.context.attachments[0],rows=parsedRows(attachment.content),z1=rows.filter(row=>row.dataset==='Z.1');
  assert.equal(new Set(z1.map(row=>row.period)).size,36);
  assert.equal(z1[0].period,'2017-09-30');
  const first=z1.find(row=>row.series_code==='LM713061103.Q');
  assert.equal(first.prior_period,'2017-06-30');assert.equal(first.change_from_exact_prior,'1');
  assert.equal(rows.filter(row=>row.dataset==='SOMA Holdings').length,312);
  assert.match(args.context.scope,/36.*Z\.1|Z\.1.*36/);assert.match(args.context.scope,/full.*inputs|complete.*inputs/i);
  assert.ok(Buffer.byteLength(attachment.content)<8*1024*1024);
  const pkg=await createResearchPackage({name:'Full ownership inputs',...args}),text=exportResearchPackage(pkg);
  assert.ok(Buffer.byteLength(text)<12*1024*1024);
  const restored=await importResearchPackage(text);
  assert.equal(exportResearchPackage(restored),text);
  assert.equal(restored.context.attachments[0].content,attachment.content);
  assert.deepEqual(restored.context.moduleSources.ownership,inputs.sources.ownership);
  assert.equal(parsedRows(ownershipCsv(inputs.sources.ownership)).filter(row=>row.dataset==='Z.1').length,8540);
  assert.equal(JSON.stringify(inputs.sources.ownership),original);
});
