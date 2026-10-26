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
 const urls=[],startedAt=Date.now();const result=await use().collectActivity({now,fetchImpl:async url=>{urls.push(url);return new Response(url.endsWith('ip_sa.txt')?text('101.0388 101.9053')+'"B50001" 1919 4.8900\n':text('75.2420 75.8142')+'"B50001" 1967 87.2020\n');}});
 assert.equal(result.id,'activity');assert.deepEqual(urls.sort(),['https://www.federalreserve.gov/releases/g17/Current/ipdisk/ip_sa.txt','https://www.federalreserve.gov/releases/g17/Current/ipdisk/utl_sa.txt']);
 assert.deepEqual(result.series.industrialProduction.sourceIds,['IP.B50001.SA']);assert.deepEqual(result.series.capacityUtilization.sourceIds,['CAPUTL.B50001.SA']);
 assert.equal(result.series.industrialProduction.unit,'Index 2017=100');assert.equal(result.series.capacityUtilization.unit,'Percent');
 assert.equal(result.series.industrialProduction.observations[0].date,'1919-01-01');assert.equal(result.series.capacityUtilization.observations[0].date,'1967-01-01');
 assert.ok(Object.values(result.series).every(series=>series.frequency==='Monthly'&&series.adjustment==='Seasonally adjusted'&&series.observations.every(row=>row.publishedAt===null)));
 assert.match(result.series.industrialProduction.attribution,/Board of Governors/);assert.match(result.series.industrialProduction.coverageNote,/revis/i);
 assert.ok(result.provenance.every(row=>row.sha256.length===64&&!('text'in row)));
 assert.ok(result.provenance.every(row=>Date.parse(row.retrievedAt)>=startedAt&&Date.parse(row.retrievedAt)<=Date.now()));
 assert.equal(result.fetchedAt,result.provenance.map(row=>row.retrievedAt).sort().at(-1));
});

test('activity access failure or redirected source rejects the candidate capture',async()=>{
 await assert.rejects(use().collectActivity({now,fetchImpl:async()=>new Response('blocked',{status:503})}),/503/);
 await assert.rejects(use().collectActivity({now,fetchImpl:async()=>({ok:true,redirected:true,url:'https://example.com'})}),/redirect|URL/i);
});

test('G17 retains full supplied histories from 1919 and 1967 with native values, gaps and missing markers',()=>{
 for(const [kind,start] of [['production','1919'],['utilization','1967']]){
  const earlier=`"B50001" ${start} 4.8900 ND 0 n.a. .\n"B50001" 1999 90.4321\n"B50001" 2000 95.1234 NA 0\n`;
  const rows=use().parseG17Total(text().replace('"B50001" 2017',earlier+'"B50001" 2017'),{now,kind});
  assert.deepEqual(rows.slice(0,5).map(o=>[o.date,o.value,o.sourceValue]),[[`${start}-01-01`,4.89,'4.8900'],[`${start}-02-01`,null,'ND'],[`${start}-03-01`,0,'0'],[`${start}-04-01`,null,'n.a.'],[`${start}-05-01`,null,'.']]);
  assert.deepEqual(rows.slice(5,9).map(o=>[o.date,o.value,o.sourceValue]),[['1999-01-01',90.4321,'90.4321'],['2000-01-01',95.1234,'95.1234'],['2000-02-01',null,'NA'],['2000-03-01',0,'0']]);
  assert.ok(!rows.some(o=>o.date===`${start}-06-01`||o.date.startsWith('1999-02')||o.date.startsWith('2001')));
  assert.equal(rows.find(o=>o.date==='2026-01-01').value,101.0388);
  assert.ok(rows.every(o=>o.publishedAt===null));
 }
});
