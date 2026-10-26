import test from 'node:test';
import assert from 'node:assert/strict';
import {dataStatus,series} from '../src/data.js';
import {parseRoute} from '../src/router.js';
import {parseCsv} from '../scripts/sources/http.mjs';
import {buildPinContext} from '../src/research-context.js';
import {ownershipCsv} from '../src/ownership-page.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';

const parsedRows=text=>{const [header,...rows]=parseCsv(text);return rows.map(row=>Object.fromEntries(header.map((key,index)=>[key,row[index]])));};
function historicalInputs({somaCount=104}={}){
  const source=structuredClone(dataStatus.sources.ownership),template=source.z1.history.at(-1);
  // This fixture deliberately retains the pre-expansion weekly scope.
  source.soma.history=source.soma.history.slice(-104);
  source.series.somaTreasuryHoldings.observations=source.series.somaTreasuryHoldings.observations.slice(-104);
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
  if(somaCount>104){
    // Synthetic dates and amounts test retention, not official historical levels.
    const latest=source.soma.history,start=Date.parse('2003-07-09T00:00:00Z');
    source.soma.history=Array.from({length:somaCount},(_,index)=>{
      const row={...structuredClone(latest[index%104]),date:new Date(start+index*7*86400000).toISOString().slice(0,10)};
      if(row.date==='2014-02-05')Object.assign(row,{principal:null,adjustedPrincipal:null,frnStatus:'unavailable',components:{...row.components,frn:null}});
      return row;
    });
    for(const key of ['principal','inflationCompensation','adjustedPrincipal'])source.soma[key]=source.soma.history.at(-1)[key];
    source.soma.asOf=source.soma.history.at(-1).date;
    const item=source.series.somaTreasuryHoldings,receipt=source.provenance.find(row=>row.url===item.sourceUrl);
    item.observations=source.soma.history.map(row=>({date:row.date,value:row.adjustedPrincipal===null?null:row.adjustedPrincipal/1000,publishedAt:null,sourceUrl:receipt.url,sourceSha256:receipt.sha256,retrievedAt:receipt.retrievedAt}));
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

test('full SOMA inputs survive frozen results with a 104-observation supplementary CSV and exact lookback',async()=>{
  const inputs=historicalInputs({somaCount:1216}),original=JSON.stringify(inputs.sources.ownership);
  const args=buildPinContext(parseRoute('#/ownership?window=all'),inputs),source=inputs.sources.ownership;
  assert.deepEqual(args.context.moduleSources.ownership,source);
  assert.equal(args.catalog.somaTreasuryHoldings.observations.length,1216);
  assert.equal(args.catalog.somaTreasuryHoldings.observations.find(row=>row.date==='2014-02-05').value,null);
  const attachment=args.context.attachments[0],rows=parsedRows(attachment.content),weekly=rows.filter(row=>row.dataset==='SOMA Holdings');
  assert.equal(new Set(weekly.map(row=>row.period)).size,104);
  const first=weekly.find(row=>row.series_code==='SOMA:treasury-adjusted-par'),current=source.soma.history.at(-104);
  const priorDate=new Date(Date.parse(current.date+'T00:00:00Z')-7*86400000).toISOString().slice(0,10),prior=source.soma.history.find(row=>row.date===priorDate);
  assert.equal(first.prior_period,priorDate);assert.equal(first.change_from_exact_prior,String(current.adjustedPrincipal-prior.adjustedPrincipal));
  assert.equal(parsedRows(ownershipCsv(source)).filter(row=>row.dataset==='SOMA Holdings').length,3648);
  assert.match(args.context.scope,/104.*SOMA|SOMA.*104/);assert.match(args.context.scope,/complete.*inputs|full.*inputs/i);
  assert.ok(Buffer.byteLength(attachment.content)<8*1024*1024);
  const pkg=await createResearchPackage({name:'Full weekly SOMA ownership history',...args}),text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
  assert.ok(Buffer.byteLength(text)<12*1024*1024);assert.equal(exportResearchPackage(restored),text);
  assert.deepEqual(restored.context.moduleSources.ownership,source);
  assert.deepEqual(restored.catalog.somaTreasuryHoldings.observations,source.series.somaTreasuryHoldings.observations);
  assert.equal(restored.context.attachments[0].content,attachment.content);
  assert.equal(JSON.stringify(source),original);
});
