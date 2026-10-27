import test from 'node:test';
import assert from 'node:assert/strict';
import {toCsv} from '../src/model.js';
import {series} from '../src/data.js';
import {registry} from '../src/registry.js';
import {renderCharts} from '../src/charts.js';
import {indicatorPage} from '../src/indicator-page.js';
import {defaults,parseRoute} from '../src/router.js';
import {recordVintages,asKnownOn} from '../src/vintages.js';
import {vintagesCsv,vintagesPage} from '../src/vintages-page.js';
import {researchPage} from '../src/research-page.js';
import {buildPinContext} from '../src/research-context.js';
import {createResearchPackage,exportResearchPackage,importResearchPackage} from '../src/research-packages.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const first='2026-10-26T21:00:00.000Z',last='2026-10-26T21:01:00.000Z';
const primary='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?fields=record_date,debt_held_public_amt,intragov_hold_amt,tot_pub_debt_out_amt';
const pdf='https://fiscaldata.treasury.gov/static-data/published-reports/dts/DailyTreasuryStatement_20250804.pdf';
const receipts=[{url:primary,sha256:'a'.repeat(64),retrievedAt:first,lastModified:null},{url:pdf,sha256:'2afa2b2497dc88fb4b14893681d127d651c868b7c3d46ad0c52455df7e6f5c9f',retrievedAt:last,lastModified:null}];
const note='Official rounded fallback: August 4, 2025 DTS Table IIIC closing balances are in USD millions, with USD 1,000,000 reporting precision; exact cents are unavailable.';
function fixture(id='debt'){
 const agency=id==='debt'?'treasury':'fiscal',value=id==='debt'?36.838165:29.5233;
 const row={date:'2025-08-04',value,publishedAt:null,sourceValue:id==='debt'?'36838165':'29523300',sourceUnit:'USD millions',sourcePrecisionUSD:1000000,sourceSeriesId:`DTS:IIIC:closing:${id==='debt'?'gross':'public'}`,sourceUrl:pdf,sourceSha256:receipts[1].sha256,retrievedAt:last,reconciliation:'official-rounded-fallback',reconciliationResidualUSD:-10000000000,primarySourceValues:{debt_held_public_amt:'29523300148538.85',intragov_hold_amt:'7314864649375.46',tot_pub_debt_out_amt:'36828164797914.31'},fallbackSourceValues:{debt_held_public_amt:'29523300',intragov_hold_amt:'7314865',tot_pub_debt_out_amt:'36838165'},inputProvenance:structuredClone(receipts),footnotes:[note]};
 const official={sourceIds:[id==='debt'?'tot_pub_debt_out_amt':'debt_held_public_amt'],sourceUrl:primary,sourceUrls:[primary,pdf],provenance:structuredClone(receipts),fetchedAt:last,calculation:'Dollars divided by one trillion. August 4, 2025 uses the official rounded DTS row.',observations:[row,{date:'2025-08-05',value:value+1,publishedAt:null,sourceValue:String((value+1)*1e12)}]};
 const item={...registry[id],...official,comparisonClass:'amount',source:{...registry[id].source,seriesIds:official.sourceIds},agency,dataStatus:'official'};
 return {row,item,source:{id:agency,status:'ok',fetchedAt:last,provenance:structuredClone(receipts),series:{[id]:official}}};
}
const csvRows=text=>{const [headers,...rows]=parseCsv(text);return rows.map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]])));};

test('rounded debt CSV preserves million units, precision, raw conflict and both actual receipts',()=>{
 for(const id of ['debt','publicDebt']){
  const {row,item}=fixture(id),[output]=csvRows(toCsv([id],{catalog:{[id]:item},range:{preset:'all'}}));
  assert.equal(output.source_value,id==='debt'?'36838165':'29523300');
  assert.equal(output.source_unit,'USD millions');assert.equal(output.source_precision_usd,'1000000');
  assert.equal(output.source_series_id,row.sourceSeriesId);assert.equal(output.source_sha256,receipts[1].sha256);
  assert.equal(output.reconciliation,'official-rounded-fallback');assert.equal(output.reconciliation_residual_usd,'-10000000000');
  assert.deepEqual(JSON.parse(output.primary_source_values_json),row.primarySourceValues);
  assert.deepEqual(JSON.parse(output.fallback_source_values_json),row.fallbackSourceValues);
  assert.deepEqual(JSON.parse(output.capture_provenance_json),receipts);assert.equal(output.retrieved_at,last);assert.equal(output.publication_date,'');
  assert.equal(output.source_notes,note);assert.deepEqual(JSON.parse(output.rounded_source_inputs_json),[row]);
 }
});

test('rounded predecessors and comparison baselines keep their evidence on derived CSV rows',async()=>{
 const {row,item}=fixture();
 for(const options of [
  {transform:'change',range:{preset:'custom',startDate:'2025-08-05',endDate:'2025-08-05'}},
  {comparison:'indexed',range:{preset:'all'}},
  {comparison:'difference',range:{preset:'all'}},
 ]){
  const output=csvRows(toCsv(['debt'],{catalog:{debt:item},...options})).at(-1);
  assert.deepEqual(JSON.parse(output.rounded_source_inputs_json),[row]);
  assert.deepEqual(JSON.parse(output.capture_provenance_json),receipts);
  assert.ok(output.source_notes.includes(note));
  const pkg=await createResearchPackage({name:'Derived rounded debt',catalog:{debt:item},sources:{},snapshot:{},now:last,state:{selected:['debt'],window:options.range.preset,startDate:options.range.startDate??'',endDate:options.range.endDate??'',transform:options.transform??'level',comparison:options.comparison??'native'}});
  const text=exportResearchPackage(pkg);
  assert.equal(exportResearchPackage(await importResearchPackage(text)),text);
 }
 const {sourceUnit,sourcePrecisionUSD,reconciliation,...ordinary}=row;
 const legacy=toCsv(['debt'],{catalog:{debt:{...item,observations:[ordinary]}},range:{preset:'all'}});
 assert.ok(!parseCsv(legacy)[0].includes('source_unit'),'old input shapes retain their original CSV columns');
});

test('rounded debt evidence survives capture CSV, current and historical frozen context, and exact portable round trips',async()=>{
 for(const id of ['debt','publicDebt']){
  const {row,item,source}=fixture(id),agency=item.agency,catalog={[id]:item},sources={[agency]:source};
  const history=recordVintages(null,{},sources,{checkedAt:last,seriesMetadata:registry});
  assert.deepEqual(asKnownOn(history,last).sources[agency].series[id].observations[0],row);
  const output=csvRows(vintagesCsv(history,{seriesId:id,cutoff:last}))[0];
  assert.equal(output.source_value,row.sourceValue);assert.equal(output.source_unit,'USD millions');assert.equal(output.source_precision_usd,'1000000');
  assert.deepEqual(JSON.parse(output.primary_source_values_json),row.primarySourceValues);
  assert.deepEqual(JSON.parse(output.capture_provenance_json),receipts);
  for(const state of [parseRoute(`#/series/${id}?window=all`),parseRoute(`#/vintages?series=${id}`),{...defaults,page:'indicator',seriesId:id,window:'custom',startDate:'2025-08-05',endDate:'2025-08-05'}]){
   const args=buildPinContext(state,{catalog,sources,snapshot:{generatedAt:last},historyState:{status:'ready',history,latestCaptureAt:last}});
   const pkg=await createResearchPackage({name:'Rounded debt evidence',...args,now:last});
   assert.deepEqual(pkg.catalog[id].observations[0],row);
   const text=exportResearchPackage(pkg),restored=await importResearchPackage(text);
   assert.equal(exportResearchPackage(restored),text);assert.equal(restored.csv,pkg.csv);
   assert.deepEqual(restored.catalog[id].observations[0].inputProvenance,receipts);
  }
 }
});

test('existing indicator notes and keyboard chart readout identify the rounded debt input',()=>{
 class Element{
  constructor(tag){this.tag=tag;this.attributes={};this.children=[];this.listeners={};}
  setAttribute(key,value){this.attributes[key]=String(value);}append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}addEventListener(key,fn){this.listeners[key]=fn;}
  set textContent(value){this.children=[String(value)];}get textContent(){return this.children.map(child=>typeof child==='string'?child:child.textContent).join('');}
 }
 const originalDocument=globalThis.document;
 try{
  globalThis.document={createElementNS:(_ns,tag)=>new Element(tag),createElement:tag=>new Element(tag)};
  for(const id of ['debt','publicDebt']){
   const original=series[id];series[id]=fixture(id).item;
   try{
    const html=indicatorPage({...defaults,page:'indicator',seriesId:id,window:'all',saved:[],selected:[]});assert.ok(html.includes(note));
    const container=new Element('div');container.clientWidth=500;container.dataset={series:id,range:JSON.stringify({preset:'all'}),height:'180'};
    renderCharts({querySelectorAll:()=>[container]});
    const svg=container.children.find(node=>node.tag==='svg');svg.listeners.keydown({key:'Home',preventDefault(){}});
    assert.ok(container.textContent.includes(note),'exact chart readout exposes retained precision footnote');
   }finally{series[id]=original;}
  }
 }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;}
});

test('historical cutoff and frozen value cells disclose rounded precision without adding table columns',async()=>{
 const {item,source}=fixture(),sources={treasury:source},catalog={debt:item};
 const history=recordVintages(null,{},sources,{checkedAt:last,seriesMetadata:registry});
 const historical=vintagesPage({...defaults,vintageSeries:'debt',vintageCutoff:last},history,{status:'ready'});
 assert.ok(historical.includes(`<span class="table-code muted">${note}</span>`),'historical table value keeps the precision note');
 const args=buildPinContext(parseRoute('#/series/debt?window=all'),{catalog,sources,snapshot:{generatedAt:last}});
 const pkg=await createResearchPackage({name:'Rounded debt display',...args,now:last});
 const frozen=researchPage({...defaults,page:'research',researchView:'packages',packageId:pkg.id},{library:{packages:[pkg]}});
 assert.ok(frozen.includes(`<span class="table-code muted">${note}</span>`),'frozen table value keeps the precision note');
});
