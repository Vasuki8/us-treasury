import test from 'node:test';
import assert from 'node:assert/strict';
let api;
try {api=await import('../scripts/sources/activity.mjs');} catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('activity.mjs'))throw error;}
const use=()=>{assert.ok(api,'G17 activity collector must exist');return api;};
const now=new Date('2026-10-22T15:00:00Z');
const text=(last='101.0388 101.9053 NA')=>`"B50001: Total index"\r\n"B50001" 2017 100 100 100 100 100 100 100 100 100 100 100 100\r\n"B50001" 2026 ${last}\r\n"B50030: Other index"\r\n"B50030" 2026 999\r\n`;

test('G17 parser preserves monthly SA levels, full source precision and explicit missing markers',()=>{
 const rows=use().parseG17Total(text(),{now,kind:'production'});
 assert.equal(rows[0].date,'2017-01-01');
 assert.deepEqual(rows.slice(-3).map(row=>[row.date,row.value]),[['2026-01-01',101.0388],['2026-02-01',101.9053],['2026-03-01',null]]);
 assert.equal(rows.at(-1).sourceValue,'NA');assert.ok(rows.every(row=>row.publishedAt===null));
});

test('G17 parser rejects duplicate years, renamed aggregate, malformed values and a changed index base',()=>{
 const {parseG17Total}=use();
 for(const value of [text()+'"B50001" 2026 100',text().replaceAll('B50001','B99999'),text('oops'),text().replace('2017 100','2017 110'),'<html>Access Denied</html>']) assert.throws(()=>parseG17Total(value,{now,kind:'production'}),/G17|index|duplicate|numeric|base/i);
 assert.throws(()=>parseG17Total(text('-1'),{now,kind:'utilization'}),/G17|numeric|negative/i);
});

test('G17 parser omits future source months without backfilling absent years',()=>{
 const rows=use().parseG17Total(text('101 102 103 104 105 106 107 108 109 110 111 112'),{now:new Date('2026-03-15T00:00:00Z'),kind:'production'});
 assert.equal(rows.length,15);assert.equal(rows.at(-1).date,'2026-03-01');assert.ok(!rows.some(row=>row.date.startsWith('2018')));
});

test('activity collector uses only total production and utilization official text files with distinct units',async()=>{
 const urls=[];const result=await use().collectActivity({now,fetchImpl:async url=>{urls.push(url);return new Response(url.endsWith('ip_sa.txt')?text('101.0388 101.9053'):text('75.2420 75.8142'));}});
 assert.equal(result.id,'activity');assert.deepEqual(urls.sort(),['https://www.federalreserve.gov/releases/g17/Current/ipdisk/ip_sa.txt','https://www.federalreserve.gov/releases/g17/Current/ipdisk/utl_sa.txt']);
 assert.deepEqual(result.series.industrialProduction.sourceIds,['IP.B50001.SA']);assert.deepEqual(result.series.capacityUtilization.sourceIds,['CAPUTL.B50001.SA']);
 assert.equal(result.series.industrialProduction.unit,'Index 2017=100');assert.equal(result.series.capacityUtilization.unit,'Percent');
 assert.match(result.series.industrialProduction.attribution,/Board of Governors/);assert.match(result.series.industrialProduction.coverageNote,/revis/i);
 assert.ok(result.provenance.every(row=>row.sha256.length===64&&!('text'in row)));
});

test('activity access failure or redirected source rejects the candidate capture',async()=>{
 await assert.rejects(use().collectActivity({now,fetchImpl:async()=>new Response('blocked',{status:503})}),/503/);
 await assert.rejects(use().collectActivity({now,fetchImpl:async()=>({ok:true,redirected:true,url:'https://example.com'})}),/redirect|URL/i);
});

test('G17 backfill starts at January 2000 and retains exact native values, gaps and missing markers',()=>{
 const earlier='"B50001" 1999 90 90 90 90 90 90 90 90 90 90 90 90\n"B50001" 2000 95.1234 NA 0\n';
 for(const kind of ['production','utilization']){
  const rows=use().parseG17Total(text().replace('"B50001" 2017',earlier+'"B50001" 2017'),{now,kind});
  assert.deepEqual(rows.slice(0,3).map(o=>[o.date,o.value,o.sourceValue]),[['2000-01-01',95.1234,'95.1234'],['2000-02-01',null,'NA'],['2000-03-01',0,'0']]);
  assert.ok(!rows.some(o=>o.date.startsWith('1999')||o.date.startsWith('2001')));
  assert.equal(rows.find(o=>o.date==='2026-01-01').value,101.0388);
 }
});
