import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceNotice} from '../src/ui.js';
let adapter;
try {adapter=await import('../scripts/sources/market-functioning.mjs');}
catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('market-functioning.mjs'))throw error;}
const market=()=>{assert.ok(adapter,'The official market-functioning adapter must exist');return adapter;};
const ids=['PDPOSGST-TOT','PDSORA-UTSETTOT','PDSIRRA-UTSETTOT','PDFTD-USTET','PDFTR-USTET'];
const dealerPayload=()=>({pd:{timeseries:ids.flatMap(keyid=>[{asofdate:'2026-09-30',keyid,value:'100000'},{asofdate:'2026-10-07',keyid,value:keyid==='PDSORA-UTSETTOT'?'*':'121178'}])}});
const rates=type=>({refRates:[{effectiveDate:'2026-10-20',type,percentRate:type==='SOFR'?3.88:3.87,percentPercentile1:3.8,percentPercentile25:3.85,percentPercentile75:3.9,percentPercentile99:3.95,volumeInBillions:100,revisionIndicator:'Y'}]});

test('dealer parser converts official million-dollar units to billions and preserves suppressed values',()=>{
  const parsed=market().parseDealerStatistics(dealerPayload());
  assert.equal(parsed.series.dealerFailsDeliver.observations.at(-1).value,121.178);
  assert.equal(parsed.series.dealerRepo.observations.at(-1).value,null);
  assert.equal(parsed.series.dealerRepo.observations.at(-1).sourceValue,'*');
  assert.equal(parsed.series.dealerRepo.observations.at(-1).suppressed,true);
  assert.equal(parsed.series.dealerNetTreasury.measure,'Wednesday net position stock at fair value');
  assert.match(parsed.series.dealerFailsDeliver.measure,/cumulative/i);
  assert.ok(Object.values(parsed.series).every(series=>series.observations.every(row=>row.publishedAt===null)));
});

test('dealer parser rejects conflicting dates/keys, wrong structures and malformed or negative financing amounts',()=>{
  for(const mutate of [p=>p.pd.timeseries.push({...p.pd.timeseries[0]}),p=>p.pd.timeseries[0].asofdate='2026-02-30',p=>p.pd.timeseries[0].keyid='VENDOR',p=>p.pd.timeseries[1].value='oops',p=>p.pd.timeseries[2].value='-1']){
    const payload=dealerPayload();mutate(payload);assert.throws(()=>market().parseDealerStatistics(payload),/dealer|date|number|duplicate|identifier/i);
  }
  const payload=dealerPayload();payload.pd.timeseries[0].value='-1000';
  assert.equal(market().parseDealerStatistics(payload).series.dealerNetTreasury.observations[0].value,-1);
  assert.throws(()=>market().parseDealerStatistics({pd:{timeseries:[]}}),/dealer|usable|missing/i);
});

test('reference-rate parser preserves effective dates, revisions, missing volume and basis-point precision',()=>{
  const payload=rates('SOFR');payload.refRates[0].volumeInBillions=null;
  const row=market().parseReferenceRates(payload,'SOFR')[0];
  assert.equal(row.date,'2026-10-20');assert.equal(row.value,3.88);assert.equal(row.revisionIndicator,'Y');assert.equal(row.volumeInBillions,null);assert.equal(row.publishedAt,null);
  assert.throws(()=>market().parseReferenceRates(payload,'EFFR'),/type|rate/i);
  payload.refRates.push({...payload.refRates[0]});assert.throws(()=>market().parseReferenceRates(payload,'SOFR'),/duplicate/i);
  assert.throws(()=>market().parseReferenceRates({refRates:[{...rates('SOFR').refRates[0],percentRate:'3.88'}]},'SOFR'),/number|rate/i);
});

function fixtureFetch(calls,{changedBreak=false}={}){return async url=>{calls.push(url);const path=new URL(url).pathname;
  const payload=path.includes('seriesbreaks')?{pd:{seriesbreaks:[{seriesbreak:'SBN2024',startdate:'2024-07-03',enddate:changedBreak?'2025-12-31':'9999-12-31'}]}}:path.includes('/pd/get/')?dealerPayload():rates(path.includes('/sofr/')?'SOFR':'EFFR');
  return new Response(JSON.stringify(payload));
};}

test('collector uses the current structural regime and four exact official requests with hashes and required reuse notices',async()=>{
  const calls=[],result=await market().collectMarketFunctioning({fetchImpl:fixtureFetch(calls),now:new Date('2026-10-22T01:00:00Z')});
  assert.equal(result.id,'marketFunctioning');assert.equal(calls.length,4);assert.equal(result.series.sofrEffrSpread.observations.at(-1).value,1);
  assert.deepEqual(result.series.dealerFailsReceive.sourceIds,['PDFTR-USTET']);
  assert.deepEqual(result.series.sofrEffrSpread.sourceIds,['SOFR:percentRate','EFFR:percentRate']);
  assert.ok(calls.every(url=>new URL(url).origin==='https://markets.newyorkfed.org'));
  assert.ok(calls.filter(url=>url.includes('/rates/')).every(url=>new URL(url).searchParams.get('endDate')==='2026-10-21'));
  assert.ok(result.provenance.every(row=>/^[a-f\d]{64}$/.test(row.sha256)&&!Object.hasOwn(row,'text')));
  assert.match(result.series.sofr.sourceNotice,/Terms of Use/);assert.match(result.series.sofr.sourceNotice,/Meridian/);
  assert.equal(result.series.sofr.licenseUrl,'https://www.newyorkfed.org/privacy/termsofuse');
  assert.ok(!Object.hasOwn(result,'score'));
});

test('collected funding data retain official source titles and applicable notices in shared source credit',async()=>{
  const result=await market().collectMarketFunctioning({fetchImpl:fixtureFetch([]),now:new Date('2026-10-22T01:00:00Z')});
  const expectedTitles={
    dealerNetTreasury:'Primary Dealer Statistics',dealerRepo:'Primary Dealer Statistics',dealerReverseRepo:'Primary Dealer Statistics',dealerFailsDeliver:'Primary Dealer Statistics',dealerFailsReceive:'Primary Dealer Statistics',
    sofr:'Secured Overnight Financing Rate Data',effr:'Effective Federal Funds Rate',sofrEffrSpread:'Secured Overnight Financing Rate Data; Effective Federal Funds Rate',
  };
  for(const [id,title] of Object.entries(expectedTitles)){
    const series=result.series[id];
    assert.equal(series.sourceTitle,title,`${id} must identify its original source content`);
    assert.equal(series.licenseUrl,'https://www.newyorkfed.org/privacy/termsofuse');
    assert.match(series.sourceNotice,/© 2026 Federal Reserve Bank of New York/);
    assert.match(series.sourceNotice,/Meridian is not affiliated with the New York Fed/);
    if(['sofr','effr','sofrEffrSpread'].includes(id))assert.match(series.sourceNotice,/not responsible for publication.*by Meridian.*no liability for your use/);
  }
  assert.equal(result.series.sofrEffrSpread.observationType,'calculated');
  assert.match(result.series.sofrEffrSpread.sourceNotice,/difference is a Meridian calculation/);
  const html=sourceNotice({marketFunctioning:result});
  for(const title of ['Primary Dealer Statistics','Secured Overnight Financing Rate Data','Effective Federal Funds Rate'])assert.ok(html.includes(title),`${title} must survive to a shared-view notice`);
  assert.doesNotMatch(html,/>New York Fed data ↗/,'generic credit must not replace the official titles');
});

test('collector fails on structural changes, redirects or HTTP errors; future dates cannot enter observations',async()=>{
  const now=new Date('2026-10-21T23:00:00Z');
  await assert.rejects(market().collectMarketFunctioning({fetchImpl:fixtureFetch([],{changedBreak:true}),now}),/structure|regime|break/i);
  await assert.rejects(market().collectMarketFunctioning({fetchImpl:async()=>new Response('denied',{status:403}),now}),/403/);
  await assert.rejects(market().collectMarketFunctioning({fetchImpl:async()=>Object.defineProperty(new Response('{}'),'redirected',{value:true}),now}),/redirect|source/i);
  const base=fixtureFetch([]);const result=await market().collectMarketFunctioning({now:new Date('2026-10-19T23:00:00Z'),fetchImpl:async url=>new URL(url).pathname.includes('/rates/')?new Response(JSON.stringify({refRates:[{...rates(url.includes('sofr')?'SOFR':'EFFR').refRates[0],effectiveDate:'2026-10-19'},{...rates(url.includes('sofr')?'SOFR':'EFFR').refRates[0],effectiveDate:'2026-10-20'}]})):base(url)});
  assert.equal(result.series.sofr.observations.at(-1).date,'2026-10-19');
});
