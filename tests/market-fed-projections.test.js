import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {zipFixture} from './helpers/zip.mjs';
import {extractZipEntry} from '../scripts/sources/zip.mjs';
let api;
try { api = await import('../scripts/sources/market-fed-projections.mjs'); } catch(error) { if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('market-fed-projections.mjs'))throw error; }
const use=()=>{assert.ok(api,'Official SEP/FX collectors must exist');return api;};
const now=new Date('2026-11-01T16:00:00Z');
const fixture=name=>readFile(new URL(`./fixtures/market-desks/${name}`,import.meta.url));
const fxXml=()=>`<?xml version="1.0"?><message:MessageGroup><frb:DataSet id="H10"><kf:Series CURRENCY="JPY" FREQ="9" FX="JPY" SERIES_NAME="RXI_N.B.JA" UNIT="Currency" UNIT_MULT="1"><frb:Obs OBS_STATUS="A" OBS_VALUE="156.8700" TIME_PERIOD="2026-10-23"/><frb:Obs OBS_STATUS="ND" OBS_VALUE="-9999" TIME_PERIOD="2026-10-26"/><frb:Obs OBS_STATUS="A" OBS_VALUE="157.0000" TIME_PERIOD="2026-11-02"/></kf:Series></frb:DataSet></message:MessageGroup>`;

test('SEP accessible tables preserve current official medians and anonymous counts with horizon-specific totals',async()=>{
 const result=use().parseSepProjectionHtml((await fixture('sep-20260916.html')).toString(),{asOf:'2026-09-16'});
 assert.equal(result.projections.asOf,'2026-09-16');
 assert.equal(result.projections.rows.length,25);
 const ff=result.projections.rows.find(r=>r.variable==='federalFundsRate'&&r.horizon==='2026');
 assert.equal(ff.median,4.1);assert.deepEqual(ff.centralTendency,[4.1,4.4]);assert.deepEqual(ff.range,[3.9,4.4]);
 assert.deepEqual(result.dots.horizonCounts,{'2026':18,'2027':18,'2028':17,'2029':17,'Longer run':18});
 assert.equal(result.dots.rows.find(r=>r.horizon==='2026'&&r.rate===4.125).count,12);
 assert.equal(result.dots.rows.find(r=>r.horizon==='2026'&&r.rate===4.5).count,0);
 assert.equal(result.projections.rows.find(r=>r.variable==='corePceInflation'&&r.horizon==='Longer run').median,null);
 assert.ok(result.dots.rows.every(r=>!('participantId' in r)&&r.asOf==='2026-09-16'));
});

test('SEP parser rejects absent or duplicate tables, date mismatch, non-integer counts and changed headings',async()=>{
 const text=(await fixture('sep-20260916.html')).toString(),parse=use().parseSepProjectionHtml;
 for(const changed of [text.replace('aria-labelledby="xt6 xt6p1b"','aria-labelledby="wrong"'),text.replace('>12</td>','>12.5</td>'),text.replace('Midpoint of target range or target level (Percent)','Probability'),text+text])assert.throws(()=>parse(changed,{asOf:'2026-09-16'}),/SEP|projection|table|count|heading|date/i);
 assert.throws(()=>parse(text,{asOf:'2026-06-17'}),/date/i);
});

test('H10 exact daily yen series retains native quote orientation and ND nulls without future values',()=>{
 const rows=use().parseFedFxXml(fxXml(),{now});
 assert.deepEqual(rows.fxUsdJpy.map(r=>[r.date,r.value]),[['2026-10-23',156.87],['2026-10-26',null]]);
 assert.equal(rows.fxUsdJpy[0].sourceValue,'156.8700');assert.equal(rows.fxUsdJpy[1].sourceValue,'-9999');
 for(const changed of [fxXml().replace('FREQ="9"','FREQ="129"'),fxXml().replace('UNIT="Currency"','UNIT="Percent"'),fxXml().replace('OBS_STATUS="ND"','OBS_STATUS="A"'),fxXml().replace('</frb:DataSet>',fxXml().match(/<kf:Series[^]*?<\/kf:Series>/)[0]+'</frb:DataSet>'),'<!DOCTYPE X>'+fxXml()])assert.throws(()=>use().parseFedFxXml(changed,{now}),/H10|H.10|XML|unit|status|numeric|duplicate/i);
});

test('ECB CSV parser checks full key, dimensions and native units while allowing historical negative deposit rates',async()=>{
 const fx=use().parseEcbCsv((await fixture('ecb-fx.csv')).toString(),{sourceId:'ecbFx',now});
 assert.deepEqual(Object.keys(fx).sort(),['fxGbpEur','fxJpyEur','fxUsdEur']);assert.ok(fx.fxUsdEur.every(r=>r.value>0));
 const policy=use().parseEcbCsv((await fixture('ecb-policy.csv')).toString(),{sourceId:'ecbPolicy',now});
 assert.equal(policy.ecbDepositRate[0].value,-0.5);
 const text=(await fixture('ecb-fx.csv')).toString();
 for(const changed of [text.replace('KEY,FREQ','BOGUS,FREQ'),text.replace('EXR.D.GBP.EUR.SP00.A','EXR.D.GBP.EUR.SP00.B'),text.replace(',GBP,0',',USD,0'),text.replace(',A,F,',',X,F,')])assert.throws(()=>use().parseEcbCsv(changed,{sourceId:'ecbFx',now}),/ECB|header|dimension|status|unit|key/i);
});

test('Fed and ECB collectors return independent sources and real byte receipts, with no model quotes',async()=>{
 const {collectFedFx,collectEcbFx,collectEcbPolicy,collectFedSep}=use();
 const feeds={
  'FRB_h10_xml.zip':zipFixture([{name:'H10_data.xml',text:fxXml()}]),
  'EXR/':await fixture('ecb-fx.csv'),'FM/':await fixture('ecb-policy.csv'),
  'fomccalendars.htm':Buffer.from('<a href="/monetarypolicy/fomcprojtabl20260916.htm">Projection Materials</a>'),
  'fomcprojtabl20260916.htm':await fixture('sep-20260916.html'),
 };
 const fetchImpl=async url=>{const entry=Object.entries(feeds).find(([key])=>url.includes(key));assert.ok(entry,`Reviewed request ${url}`);return new Response(entry[1]);};
 for(const fn of [collectFedFx,collectEcbFx,collectEcbPolicy,collectFedSep]){
  const source=await fn({now,fetchImpl});assert.equal(source.status,'ok');assert.ok(source.provenance.length);
  assert.ok(source.provenance.every(p=>/^[a-f0-9]{64}$/.test(p.sha256)&&!('bytes'in p)&&!('text'in p)));
  assert.equal(source.fetchedAt,source.provenance.map(p=>p.retrievedAt).sort().at(-1));
  for(const series of Object.values(source.series))assert.equal(series.observationType,'official');
 }
 await assert.rejects(collectFedFx({now,fetchImpl:async()=>({ok:true,redirected:true,url:'https://example.com'})}),/redirect/i);
});

test('bounded captured H10 archive parses actual observations without monthly/annual splicing',async()=>{
 const xml=extractZipEntry(await fixture('h10.zip'),'H10_data.xml',{maxOutputBytes:32*1024*1024}).toString();
 const rows=use().parseFedFxXml(xml,{now}).fxUsdJpy;
 assert.equal(rows.at(-1).date,'2026-10-23');assert.equal(rows.at(-1).value,156.87);
 assert.ok(rows.every(r=>r.date>='2020-01-01'&&r.date<='2026-11-01'));
});

test('H10 rejects malformed source observation tags and ECB requires break/confidentiality metadata',async()=>{
 const parser=use().parseFedFxXml;
 assert.throws(()=>parser(fxXml().replace('</kf:Series>','<frb:Obs OBS_STATUS="A" OBS_VALUE="158.0000" TIME_PERIOD="2026-10-22"></kf:Series>'),{now}),/H10|observation|XML/i);
 const fx=(await fixture('ecb-fx.csv')).toString();
 assert.throws(()=>use().parseEcbCsv(fx.replace('OBS_PRE_BREAK','ABSENT_PRE_BREAK'),{sourceId:'ecbFx',now}),/header/i);
});
