import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBeaItaCsv,collectBeaIta} from '../scripts/sources/bea-ita.mjs';
import {currentAccountRegistry,BEA_ITA_URL} from '../src/current-account-registry.js';
import {assertCommercialData} from '../scripts/data-policy.mjs';
import {refreshSnapshot} from '../scripts/sources/refresh.mjs';
import {asKnownOn} from '../src/vintages.js';
import {toCsv,compareSeries} from '../src/model.js';
import {parseCsv} from '../scripts/sources/http.mjs';

const now=new Date('2026-10-23T12:00:00.000Z');
const labels=[['30','Balance on current account (line 1 less line 9) /4/'],['31','Balance on goods and services (line 2 less line 10)'],['32','Balance on goods (line 3 less line 11)'],['33','Balance on services (line 4 less line 12)'],['34','Balance on primary income (line 5 less line 13)'],['35','Balance on secondary income (line 8 less line 16)']];
const native=[[-212597,-246023],[-180000,-199817],[-270000,-291302],[90000,91485],[10000,-11405],[-42597,-34802]];
const cell=value=>'"'+String(value).replaceAll('"','""')+'"';
function fixture({values=native}={}){
 const rows=[['Table 1.1. U.S. International Transactions'],['[Millions of dollars]'],['Bureau of Economic Analysis'],['Release Date: September 24, 2026 - Next Release Date: December 18, 2026'],
 ['\u00a0Line','\u00a0','2025','Not seasonally adjusted','Seasonally adjusted','Seasonally adjusted'],
 ['Line','','2025','2026','2026','2026'],['Line','','2025','Q2','Q1','Q2'],
 ...labels.map(([line,label],i)=>[line,label,999999,888888,...values[i]]),['Quarterly estimates are not annualized and are expressed at quarterly rates.'],['4. Current- and capital-account statistics differ from NIPA concepts.']];
 return rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
function retained(text=fixture(),at=now.toISOString()){
 return {...parseBeaItaCsv(text,{now:new Date(at)}),id:'beaIta',status:'ok',fetchedAt:at,provenance:[{url:BEA_ITA_URL,sha256:'a'.repeat(64),retrievedAt:at,lastModified:null}]};
}

test('ITA selects only SA quarterly columns by all three headers and retains official signed quarter amounts',()=>{
 const source=parseBeaItaCsv(fixture(),{now}),rows=source.series.currentAccountBalance.observations;
 assert.deepEqual(rows.map(row=>[row.date,row.value]),[['2026-01-01',-212.597],['2026-04-01',-246.023]]);
 assert.equal(rows[1].sourceValue,'-246023');assert.equal(rows[1].sourcePeriodLabel,'2026Q2');assert.equal(rows[1].publishedAt,null);
 assert.equal(source.tableReleaseDate,'2026-09-24');assert.equal(source.nextReleaseDate,'2026-12-18');
 assert.match(source.series.currentAccountBalance.unit,/not annualized/i);
 assert.equal(Object.keys(source.series).length,6);
 assert.equal(source.series.itaServicesBalance.observations.at(-1).value,91.485);
 assert.ok(rows[1].footnotes.some(note=>/NIPA/.test(note)));
});

test('missing, suppressed and small-value source markers stay unavailable rather than becoming zero',()=>{
 for(const marker of ['', '.....','n.a.','(D)','(*)']){
  const values=structuredClone(native);values[2][1]=marker;
  const source=parseBeaItaCsv(fixture({values}),{now}),row=source.series.itaGoodsBalance.observations.at(-1);
  assert.equal(row.value,null,marker);assert.equal(row.sourceValue,marker);assert.ok(row.footnotes.length,marker);
 }
 const values=structuredClone(native);values[0][1]=0;values[1][1]=0;values[2][1]=-10;values[3][1]=10;values[4][1]=0;values[5][1]=0;
 assert.equal(parseBeaItaCsv(fixture({values}),{now}).series.currentAccountBalance.observations.at(-1).value,0);
});

test('ITA rejects incompatible table, unit, annualization, duplicate/renamed rows and ambiguous columns',()=>{
 const text=fixture();
 for(const invalid of [
  text.replace('Table 1.1.','Table 1.2.'),text.replace('[Millions of dollars]','[Billions of dollars]'),
  text.replace('Quarterly estimates are not annualized','Quarterly estimates are annualized'),
  text.replaceAll('"Seasonally adjusted"','"Not seasonally adjusted"'),
  text.replace('Balance on current account','Balance on capital account'),
  text.replace('"Q1","Q2"','"Q2","Q2"'),text.replace('"2026","2026","2026"','"2026","2026","bad"'),
  text+'\r\n'+text.split('\r\n').find(line=>line.startsWith('"30",')),
  text.replace('"-246023"','"bogus"'),text.replace('September 24, 2026','September 31, 2026'),
  text.replace('September 24, 2026','November 24, 2026'),
 ])assert.throws(()=>parseBeaItaCsv(invalid,{now}),/ITA|table|quarter|date|unit|annual|duplicate|balance|header|row|number|label/i);
});

test('rounded published components reconcile in source millions without adjusting balances',()=>{
 const values=structuredClone(native);values[0][1]=-246022; // Published four-component sum differs by two million.
 assert.equal(parseBeaItaCsv(fixture({values}),{now}).series.currentAccountBalance.observations.at(-1).value,-246.022);
 values[0][1]=-246020;
 assert.throws(()=>parseBeaItaCsv(fixture({values}),{now}),/reconcil|balance/i);
});

test('collector decodes Windows-1252, hashes exact response bytes and rejects changed endpoints and HTTP failures',async()=>{
 const bytes=Buffer.from(fixture().replaceAll('\u00a0','\xa0'),'latin1');
 const source=await collectBeaIta({now,fetchImpl:async url=>{assert.equal(url,BEA_ITA_URL);return new Response(bytes,{headers:{'last-modified':'Thu, 24 Sep 2026 12:30:03 GMT'}});}});
 assert.equal(source.series.currentAccountBalance.observations.at(-1).value,-246.023);
 assert.match(source.provenance[0].sha256,/^[a-f0-9]{64}$/);assert.equal(source.provenance[0].url,BEA_ITA_URL);
 assert.equal(source.fetchedAt,source.provenance[0].retrievedAt);assertCommercialData({sources:{beaIta:source}});
 await assert.rejects(collectBeaIta({now,fetchImpl:async()=>new Response('Unavailable',{status:503})}),/503/);
 await assert.rejects(collectBeaIta({now,fetchImpl:async()=>{const response=new Response(bytes);Object.defineProperty(response,'url',{value:'https://example.com/table.csv'});return response;}}),/endpoint|redirect|URL/i);
});

test('admission requires exact source scope, nonannualized units, row inputs, notes and genuine metadata',()=>{
 const source=retained();assertCommercialData({sources:{beaIta:source}});
 for(const change of [
  s=>s.series.currentAccountBalance.sourceIds=['A019RC'],s=>s.series.currentAccountBalance.sourceUrl=BEA_ITA_URL+'?unreviewed=1',
  s=>s.series.currentAccountBalance.adjustment='Seasonally adjusted annual rate',s=>s.series.currentAccountBalance.unit='USD billions (SAAR)',
  s=>s.series.currentAccountBalance.observations.at(-1).value=-246,s=>s.series.currentAccountBalance.observations.at(-1).publishedAt='2026-09-24',
  s=>s.tableReleaseDate='2026-09-31',s=>s.series.currentAccountBalance.observations.at(-1).sourcePeriodLabel='2026Q1',
  s=>s.provenance[0].url='https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.2.csv',
  s=>delete s.series.itaPrimaryIncomeBalance,s=>s.series.currentAccountBalance.licenseUrl='https://example.com/terms',
 ]){const invalid=structuredClone(source);change(invalid);assert.throws(()=>assertCommercialData({sources:{beaIta:invalid}}),/ITA|identifier|feed|provenance|review|annual|unit|balance|date|publication/i);}
});

test('refreshes append independent immutable ITA captures; failure retains only last successful ITA values',async()=>{
 const first=await refreshSnapshot({collectors:{beaIta:async()=>retained()},now}),original=JSON.stringify(first.vintages);
 const later='2026-10-24T12:00:00.000Z',values=structuredClone(native);values[0][1]=-246024;
 const second=await refreshSnapshot({previous:first,collectors:{beaIta:async()=>retained(fixture({values}),later)},now:new Date(later)});
 assert.equal(JSON.stringify(first.vintages),original);assert.deepEqual(second.vintages.captures[0],first.vintages.captures[0]);
 assert.equal(asKnownOn(second.vintages,now.toISOString()).sources.beaIta.series.currentAccountBalance.observations.at(-1).value,-246.023);
 assert.equal(asKnownOn(second.vintages,later).sources.beaIta.tableReleaseDate,'2026-09-24');assertCommercialData(second);
 const failed=await refreshSnapshot({previous:second,collectors:{beaIta:async()=>{throw Error('Official ITA HTTP503');}},now:new Date('2026-10-25T12:00:00Z')});
 assert.equal(failed.sources.beaIta.status,'error');assert.equal(failed.sources.beaIta.fetchedAt,later);assert.deepEqual(failed.vintages,second.vintages);
});

test('native export preserves quarter units and current-account inputs; ratio indexing rejects signed balances',()=>{
 const source=retained(),catalog=Object.fromEntries(Object.entries(source.series).map(([id,item])=>[id,{...currentAccountRegistry[id],...item,source:{...currentAccountRegistry[id].source,seriesIds:item.sourceIds},fetchedAt:source.fetchedAt,provenance:source.provenance,dataStatus:'official'}]));
 const [headers,...rows]=parseCsv(toCsv(['currentAccountBalance'],{range:{preset:'all'},catalog}));
 assert.equal(rows.length,2);const row=Object.fromEntries(headers.map((h,i)=>[h,rows.at(-1)[i]]));
 assert.equal(row.value,'-246.023');assert.match(row.unit,/not annualized/i);assert.equal(row.publication_date,'');assert.equal(row.source_period_label,'2026Q2');assert.match(row.license_url,/bea.gov/);
 assert.ok(compareSeries(['currentAccountBalance','itaGoodsBalance'],'indexed',{preset:'all'},catalog).error);
});
