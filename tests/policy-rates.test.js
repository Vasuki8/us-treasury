import test from 'node:test';
import assert from 'node:assert/strict';
import { zipFixture } from './helpers/zip.mjs';
let api;
try { api = await import('../scripts/sources/policy-rates.mjs'); } catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('policy-rates.mjs')) throw error; }
const use = () => { assert.ok(api, 'Policy rate collector must exist'); return api; };
const now = new Date('2026-10-22T15:00:00Z');
const targets = () => ({ refRates: [
  { effectiveDate:'2026-10-21', type:'EFFR', targetRateFrom:3.75, targetRateTo:4, revisionIndicator:'' },
  { effectiveDate:'2017-01-03', type:'EFFR', targetRateFrom:0.5, targetRateTo:0.75, revisionIndicator:'Y' },
  { effectiveDate:'2026-10-23', type:'EFFR', targetRateFrom:3.75, targetRateTo:4, revisionIndicator:'' },
] });
const xml = (rows = '<frb:Obs OBS_STATUS="A" OBS_VALUE="0.15" TIME_PERIOD="2021-07-29"/><frb:Obs OBS_STATUS="A" OBS_VALUE="3.90" TIME_PERIOD="2026-10-21"/>') => `<?xml version="1.0"?><message:MessageGroup xmlns:message="http://www.SDMX.org/resources/SDMXML/schemas/v1_0/message"><frb:DataSet id="PRATES_POLICY_RATES"><kf:Series SERIES_NAME="RESBME_N.D" UNIT="Percent" UNIT_MULT="1" FREQ="8" INT_RATES_PAID="IOR"><frb:Obs OBS_STATUS="A" OBS_VALUE="0.75" TIME_PERIOD="2017-01-03"/></kf:Series><kf:Series SERIES_NAME="RESBM_N.D" UNIT="Percent" UNIT_MULT="1" FREQ="8" INT_RATES_PAID="IOR">${rows}</kf:Series></frb:DataSet></message:MessageGroup>`;

test('policy target parser retains published business dates and exact bounds without filling weekends', () => {
  const result = use().parsePolicyTargets(targets(), { now });
  assert.deepEqual(result.policyTargetLower.map(row => [row.date,row.value]), [['2017-01-03',0.5],['2026-10-21',3.75]]);
  assert.deepEqual(result.policyTargetUpper.map(row => row.value), [0.75,4]);
  assert.equal(result.policyTargetLower[0].revisionIndicator, 'Y');
  assert.ok(result.policyTargetUpper.every(row => row.publishedAt === null));
});

test('policy target parser preserves the lowercase revision marker published for May 31 2017', () => {
  // Exact row observed in the official 2017-through-2026 EFFR response.
  const published = { effectiveDate:'2017-05-31', type:'EFFR', percentRate:0.83, percentPercentile1:0.81, percentPercentile25:0.82, percentPercentile75:0.83, percentPercentile99:1.05, targetRateFrom:0.75, targetRateTo:1, volumeInBillions:79, revisionIndicator:'r' };
  const result=use().parsePolicyTargets({refRates:[published]},{now});
  assert.deepEqual(result.policyTargetLower,[{date:'2017-05-31',value:0.75,sourceValue:'0.75',publishedAt:null,revisionIndicator:'r'}]);
  assert.deepEqual(result.policyTargetUpper,[{date:'2017-05-31',value:1,sourceValue:'1',publishedAt:null,revisionIndicator:'r'}]);
});

test('policy target parser keeps unknown revision flags and wrong rate types rejected', () => {
  const {parsePolicyTargets}=use();
  for(const revisionIndicator of [null,undefined,'R','N','yes',true,1]) {
    const payload=targets();payload.refRates[0].revisionIndicator=revisionIndicator;
    assert.throws(()=>parsePolicyTargets(payload,{now}),/revision indicator/i);
  }
  const wrong=targets();wrong.refRates[0].type='SOFR';wrong.refRates[0].revisionIndicator='r';
  assert.throws(()=>parsePolicyTargets(wrong,{now}),/rate type/i);
});

test('policy parser rejects mismatched rate types, duplicate or invalid dates and reversed bounds', () => {
  const {parsePolicyTargets}=use();
  for (const mutate of [rows => rows[0].type='SOFR', rows => rows.push({...rows[0]}), rows => rows[0].effectiveDate='2026-02-30', rows => rows[0].targetRateFrom=5, rows => rows[0].targetRateTo='4.0']) {
    const payload=targets(); mutate(payload.refRates);
    assert.throws(() => parsePolicyTargets(payload,{now}), /policy|target|date|duplicate|numeric|bound/i);
  }
});

test('IORB parser selects RESBM_N.D only and starts at its actual 2021 inception', () => {
  const rows = use().parseIorbXml(xml(),{now});
  assert.deepEqual(rows.map(row=>[row.date,row.value]), [['2021-07-29',0.15],['2026-10-21',3.9]]);
  assert.ok(rows.every(row=>row.publishedAt===null));
});

test('IORB fails closed on unit changes, duplicate series/dates, external entities and malformed rows', () => {
  const {parseIorbXml}=use();
  for (const text of [xml().replace('SERIES_NAME="RESBM_N.D" UNIT="Percent"','SERIES_NAME="RESBM_N.D" UNIT="Basis points"'),xml().replace('</frb:DataSet>',xml().match(/<kf:Series SERIES_NAME="RESBM_N.D"[^]*?<\/kf:Series>/)[0]+'</frb:DataSet>'),xml('<frb:Obs OBS_STATUS="A" OBS_VALUE="NaN" TIME_PERIOD="2026-10-21"/>'),xml('<frb:Obs OBS_STATUS="A" OBS_VALUE="1" TIME_PERIOD="2026-10-21"/><frb:Obs OBS_STATUS="A" OBS_VALUE="1" TIME_PERIOD="2026-10-21"/>'),'<!DOCTYPE root [<!ENTITY x SYSTEM "file:///private">]>'+xml()]) assert.throws(()=>parseIorbXml(text,{now}), /IORB|policy|XML|duplicate|unit|numeric/i);
});

test('IORB excludes commented observation examples',()=>{
  const {parseIorbXml}=use();
  const comment='<!-- Not a published observation: <frb:Obs OBS_STATUS="A" OBS_VALUE="99.00" TIME_PERIOD="2026-10-20"/> -->';
  const withComment=xml().replace('<frb:Obs OBS_STATUS="A" OBS_VALUE="3.90"',comment+'<frb:Obs OBS_STATUS="A" OBS_VALUE="3.90"');
  assert.deepEqual(parseIorbXml(withComment,{now}).map(row=>[row.date,row.value]),[['2021-07-29',0.15],['2026-10-21',3.9]]);
});

test('IORB excludes commented duplicate series and cannot replace real history with commented history',()=>{
  const {parseIorbXml}=use();
  const selected=xml().match(/<kf:Series SERIES_NAME="RESBM_N.D"[^]*?<\/kf:Series>/)[0];
  const duplicate=xml().replace('</frb:DataSet>',`<!-- Retired example: ${selected} --></frb:DataSet>`);
  assert.deepEqual(parseIorbXml(duplicate,{now}).map(row=>[row.date,row.value]),[['2021-07-29',0.15],['2026-10-21',3.9]]);
  const onlyComment=xml().replace(selected,`<!-- ${selected} -->`);
  assert.throws(()=>parseIorbXml(onlyComment,{now}),/missing.*IORB|IORB.*missing|series/i,'commented history cannot supply the required series');
});

test('IORB rejects unclosed, nested and otherwise malformed XML comments',()=>{
  const {parseIorbXml}=use();
  for(const comment of ['<!-- unfinished','<!-- bad -- embedded -->','<!-- outer <!-- nested --> -->','-->']){
    const text=xml().replace('</frb:DataSet>',comment+'</frb:DataSet>');
    assert.throws(()=>parseIorbXml(text,{now}),/comment|XML/i,comment);
  }
});

test('policy collector records both official downloads, original rights and independent source IDs', async () => {
  const zip=zipFixture([{name:'PRATES_data.xml',text:xml()}]);
  const seen=[];
  const result=await use().collectPolicyRates({now,fetchImpl:async url=>{seen.push(url);return new Response(url.includes('newyorkfed')?JSON.stringify(targets()):zip);}});
  assert.equal(result.id,'policyRates');
  assert.equal(seen.length,2);
  assert.ok(seen.includes('https://www.federalreserve.gov/releases/prates/data/FRB_PRATES_xml.zip'));
  assert.ok(seen.includes('https://markets.newyorkfed.org/api/rates/unsecured/effr/search.json?startDate=2017-01-01&endDate=2026-10-22'));
  assert.deepEqual(result.series.policyTargetLower.sourceIds,['EFFR:targetRateFrom']);
  assert.deepEqual(result.series.iorb.sourceIds,['RESBM_N.D']);
  assert.match(result.series.policyTargetUpper.sourceNotice,/New York Fed.*Terms of Use/);
  assert.match(result.series.iorb.attribution,/Board of Governors/);
  assert.match(result.series.iorb.coverageNote,/2021-07-29.*IOER|IOER.*2021-07-29/);
  assert.ok(result.provenance.every(row=>/^[a-f0-9]{64}$/.test(row.sha256)&&!('bytes'in row)));
});

test('policy collection propagates access and redirect errors instead of using later or sample data',async()=>{
  await assert.rejects(use().collectPolicyRates({now,fetchImpl:async()=>new Response('blocked',{status:403})}),/403/);
  await assert.rejects(use().collectPolicyRates({now,fetchImpl:async()=>({ok:true,redirected:true,url:'https://example.com/'})}),/redirect|URL/i);
});
