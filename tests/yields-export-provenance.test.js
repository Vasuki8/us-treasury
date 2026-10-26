import test from 'node:test';
import assert from 'node:assert/strict';
import {toCsv} from '../src/model.js';
import {treasuryParYieldUrl} from '../scripts/sources/yields.mjs';
import {parseCsv} from '../scripts/sources/http.mjs';
import {createResearchPackage,exportResearchPackage,importResearchPackage,researchPackageCsv} from '../src/research-packages.js';

const first='2026-10-25T12:00:00.000Z',last='2026-10-25T13:00:00.000Z';
const nominal=treasuryParYieldUrl(2003),real=treasuryParYieldUrl(2003,'real');
const receipts=[
  {url:nominal,sha256:'a'.repeat(64),retrievedAt:first,lastModified:null},
  {url:real,sha256:'b'.repeat(64),retrievedAt:'2026-10-25T12:01:00.000Z',lastModified:null},
  {url:treasuryParYieldUrl(2026),sha256:'c'.repeat(64),retrievedAt:last,lastModified:null},
];
const measurement=(extra={})=>({id:'yieldFixture',name:'Retained Treasury rate',frequency:'Daily',unit:'Percent',format:'percent',precision:2,comparisonClass:'rate',adjustment:'Not seasonally adjusted',definition:'Published par yield.',source:{name:'U.S. Treasury',url:nominal,seriesIds:['BC_10YEAR']},sourceUrl:nominal,fetchedAt:last,provenance:receipts,observations:[{date:'2003-01-02',value:4.07,publishedAt:null,sourceUrl:nominal,sourceUrls:[nominal]}],...extra});
const exported=item=>{
  const [headers,...rows]=parseCsv(toCsv([item.id],{catalog:{[item.id]:item},range:{preset:'all'}}));
  return rows.map(row=>Object.fromEntries(headers.map((header,index)=>[header,row[index]])));
};

test('opted-in CSV resolves only actual observation input receipts and their retrieval clocks',()=>{
  for(const [urls,expected,clock] of [
    [[nominal],[receipts[0]],first],[[real],[receipts[1]],receipts[1].retrievedAt],
    [[nominal,real],receipts.slice(0,2),receipts[1].retrievedAt],
  ]){
    const item=measurement({inputProvenanceScope:'observation-source-urls',observations:[{date:'2003-01-02',value:4.07,publishedAt:null,sourceUrl:urls[0],sourceUrls:urls}]});
    const [row]=exported(item);
    assert.deepEqual(JSON.parse(row.capture_provenance_json),expected);
    assert.equal(row.retrieved_at,clock);
    assert.equal(row.publication_date,'');
  }
});

test('opted-in main 10Y CSV selects the exact retained response hash and retrieval time',()=>{
  const newer={...receipts[0],sha256:'d'.repeat(64),retrievedAt:last};
  const item=measurement({inputProvenanceScope:'observation-source-urls',provenance:[receipts[0],newer],observations:[{date:'2003-01-02',value:4.07,publishedAt:null,sourceUrl:nominal,sourceSha256:'a'.repeat(64),retrievedAt:first}]});
  const [row]=exported(item);
  assert.deepEqual(JSON.parse(row.capture_provenance_json),[receipts[0]]);
  assert.equal(row.retrieved_at,first);
  for(const observation of [
    {...item.observations[0],sourceSha256:'f'.repeat(64)},
    {...item.observations[0],retrievedAt:last},
  ])assert.throws(()=>exported({...item,observations:[observation]}),/provenance|receipt|capture/i);
});

test('opted-in CSV fails on missing, ambiguous or incomplete capture evidence',()=>{
  const item=measurement({inputProvenanceScope:'observation-source-urls'});
  for(const change of [
    {provenance:[]},
    {provenance:[receipts[0],{...receipts[0],sha256:'d'.repeat(64),retrievedAt:last}]},
    {provenance:[{...receipts[0],sha256:'invalid'}]},
    {provenance:[{...receipts[0],retrievedAt:null}]},
    {observations:[{date:'2003-01-02',value:4.07}]},
    {observations:[{...item.observations[0],sourceUrls:[nominal,real]}],provenance:[receipts[0]]},
  ])assert.throws(()=>exported({...item,...change}),/provenance|receipt|capture/i);
});

test('explicit row evidence keeps priority and legacy frozen CSV retains full receipts and source clock',async()=>{
  const explicit=measurement({inputProvenanceScope:'observation-source-urls',observations:[{date:'2003-01-02',value:4.07,sourceUrl:nominal,inputProvenance:[receipts[0]]}]});
  assert.deepEqual(JSON.parse(exported(explicit)[0].capture_provenance_json),[receipts[0]]);
  assert.equal(exported(explicit)[0].retrieved_at,last,'explicit row evidence retains its existing clock behavior');
  const legacy=measurement(),[row]=exported(legacy);
  assert.equal(row.capture_provenance_json,JSON.stringify(receipts));
  assert.equal(row.retrieved_at,last);
  const pkg=await createResearchPackage({id:'legacy-yield-export',name:'Legacy yield export',now:last,state:{page:'indicator',seriesId:legacy.id,selected:[legacy.id],window:'all',transform:'level',comparison:'native'},catalog:{[legacy.id]:legacy},sources:{},snapshot:{},context:{}});
  const csv=researchPackageCsv(pkg),restored=await importResearchPackage(exportResearchPackage(pkg));
  assert.equal(researchPackageCsv(restored),csv);
  assert.equal(parseCsv(csv)[1][parseCsv(csv)[0].indexOf('capture_provenance_json')],JSON.stringify(receipts));
});

test('annual receipt selection bounds CSV growth without duplicating receipts on observation rows',()=>{
  const annual=Array.from({length:24},(_,index)=>2003+index),provenance=annual.flatMap(year=>['nominal','real'].map(kind=>({url:treasuryParYieldUrl(year,kind),sha256:(kind==='nominal'?'a':'b').repeat(64),retrievedAt:first,lastModified:null})));
  const item=measurement({inputProvenanceScope:'observation-source-urls',provenance,observations:annual.map(year=>({date:`${year}-01-02`,value:2,publishedAt:null,sourceUrl:treasuryParYieldUrl(year),sourceUrls:[treasuryParYieldUrl(year),treasuryParYieldUrl(year,'real')]}))});
  const csv=toCsv([item.id],{catalog:{[item.id]:item},range:{preset:'all'},maxBytes:60000});
  assert.equal(parseCsv(csv).length,25);
  assert.ok(Buffer.byteLength(csv)<60000);
  assert.ok(item.observations.every(row=>!Object.hasOwn(row,'inputProvenance')));
  assert.equal(item.provenance.length,48);
});

test('opted-in cross-year change CSV retains the real predecessor receipt, URL and latest input clock',()=>{
  const currentUrl=treasuryParYieldUrl(2004),previous={...receipts[0],retrievedAt:last},current={...receipts[0],url:currentUrl,sha256:'d'.repeat(64),retrievedAt:first};
  const item=measurement({inputProvenanceScope:'observation-source-urls',provenance:[previous,current],observations:[
    {date:'2003-12-31',value:4,publishedAt:null,sourceUrl:nominal},
    {date:'2004-01-02',value:5,publishedAt:null,sourceUrl:currentUrl},
  ]});
  const [headers,row]=parseCsv(toCsv([item.id],{catalog:{[item.id]:item},transform:'change',range:{preset:'custom',startDate:'2004-01-02',endDate:'2004-01-02'}}));
  const data=Object.fromEntries(headers.map((header,index)=>[header,row[index]]));
  assert.equal(data.value,'1');
  assert.deepEqual(JSON.parse(data.capture_provenance_json),[current,previous]);
  assert.equal(data.source_urls,`${currentUrl}; ${nominal}`);
  assert.equal(data.source_url,currentUrl);
  assert.equal(data.retrieved_at,last);
  assert.equal(data.publication_date,'');
});

test('opted-in eligible indexed and difference CSVs merge baseline evidence while respecting explicit current evidence',async()=>{
  const currentUrl=treasuryParYieldUrl(2004),baseline={...receipts[0],retrievedAt:last},current={...receipts[0],url:currentUrl,sha256:'d'.repeat(64),retrievedAt:first};
  const item=measurement({name:'Eligible positive level fixture',unit:'Units',format:'number',comparisonClass:'level',inputProvenanceScope:'observation-source-urls',provenance:[baseline,current,{...current,sha256:'e'.repeat(64),retrievedAt:last}],observations:[
    {date:'2003-12-31',value:4,publishedAt:null,sourceUrl:nominal},
    {date:'2004-01-02',value:5,publishedAt:null,sourceUrl:currentUrl,inputProvenance:[current]},
  ]});
  for(const [comparison,expected] of [['indexed','125'],['difference','1']]){
    const [headers,...rows]=parseCsv(toCsv([item.id],{catalog:{[item.id]:item},comparison,range:{preset:'all'}}));
    const data=Object.fromEntries(headers.map((header,index)=>[header,rows.at(-1)[index]]));
    assert.equal(data.value,expected);
    assert.deepEqual(JSON.parse(data.capture_provenance_json),[current,baseline]);
    assert.equal(data.source_urls,`${currentUrl}; ${nominal}`);
    assert.equal(data.retrieved_at,last);
    const pkg=await createResearchPackage({id:`scoped-${comparison}`,name:'Scoped comparison',now:last,state:{page:'indicator',seriesId:item.id,selected:[item.id],window:'all',transform:'level',comparison},catalog:{[item.id]:item},sources:{},snapshot:{},context:{}});
    assert.equal(researchPackageCsv(await importResearchPackage(exportResearchPackage(pkg))),researchPackageCsv(pkg));
  }
});
