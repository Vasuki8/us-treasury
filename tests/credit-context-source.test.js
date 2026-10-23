import test from 'node:test';
import assert from 'node:assert/strict';
import {zipFixture} from './helpers/zip.mjs';
let adapter;
try{adapter=await import('../scripts/sources/credit-context.mjs');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||!error.message.includes('credit-context.mjs'))throw error;}
const source=()=>{assert.ok(adapter,'The reviewed banking and funding collectors must exist');return adapter;};
const frame=(id,rows)=>`<message:MessageGroup><message:Header><message:ID>${id}</message:ID></message:Header><kf:DataSet>${rows}</kf:DataSet></message:MessageGroup>`;
const obs=(date,value,status='A')=>`<frb:Obs OBS_STATUS="${status}" OBS_VALUE="${value}" TIME_PERIOD="${date}" />`;
const series=(attrs,rows)=>`<kf:Series ${attrs}>${rows}</kf:Series>`;
function h8(){return frame('H8',[
  series('BG="CB" CATEGORY="A" CURRENCY="USD" FREQ="19" H8_UNITS="LEVEL" ITEM="1020" SA="SA" SERIES_NAME="B1020NCBA" UNIT="Currency" UNIT_MULT="1000000"',obs('2026-10-07','14182513.2')),
  series('BG="CB" CATEGORY="L" CURRENCY="USD" FREQ="19" H8_UNITS="LEVEL" ITEM="1058" SA="SA" SERIES_NAME="B1058NCBA" UNIT="Currency" UNIT_MULT="1000000"',obs('2026-10-07','19771474.9')),
].join(''));}
function sloos(){return frame('SLOOS',[['CILG','DEMAND','SUBLPDCILD_N.Q','16.1'],['CILG','STND','SUBLPDCILS_N.Q','0.0'],['CISM','DEMAND','SUBLPDCISD_N.Q','-3.6'],['CISM','STND','SUBLPDCISS_N.Q','1.8']].map(([loan,measure,code,value])=>series(`BANKSIZE="ALL" CURRENCY="NA" FREQ="162" LOANTYPE="${loan}" MEASURE="${measure}" PANEL="DOM" SERIES_NAME="${code}" TERMS="NA" UNIT="Percentage" UNIT_MULT="1"`,obs('2026-09-30',value))).join(''));}
function h41(){return frame('H41',[
  ['RESPPMA_N.WW','ASSET','TA','TA','TOTC','6753604'],['RESH4R_N.WW','LIABCAP','OFDRB','RBFRB','TOT','2969522'],['RESPPLLDT_N.WW','LIABCAP','LIAB','DEPUSTG','TOT','945153'],
].map(([code,category,subcategory,component,distribution,value])=>series(`SERIES_NAME="${code}" FREQ="19" CATEGORY="${category}" SUBCATEGORY="${subcategory}" COMPONENT="${component}" DISTRIBUTION="${distribution}" SERIESTYPE="L" UNIT="Currency" UNIT_MULT="1000000" CURRENCY="USD"`,obs('2026-10-21',value))).join(''));}
const now=new Date('2026-10-22T22:00:00Z');

test('H8 parser preserves all-bank weekly SA stocks and scales source millions to billions',()=>{
  const result=source().parseBankCreditXml(h8(),{now});
  assert.equal(result.bankLoans.observations[0].value,14182.5132);
  assert.equal(result.bankDeposits.observations[0].value,19771.4749);
  assert.equal(result.bankLoans.observations[0].sourceValue,'14182513.2');
  assert.equal(result.bankLoans.observations[0].publishedAt,null);
  assert.equal(result.bankLoans.frequency,'Weekly');assert.equal(result.bankLoans.adjustment,'Seasonally adjusted');
});

test('Board parser rejects changed units, populations, frequency, duplicate dates and invalid week dates',()=>{
  for(const xml of [h8().replace('UNIT_MULT="1000000"','UNIT_MULT="1"'),h8().replace('BG="CB"','BG="DM"'),h8().replace('FREQ="19"','FREQ="129"'),h8().replace(obs('2026-10-07','14182513.2'),obs('2026-10-07','1')+obs('2026-10-07','2')),h8().replaceAll('2026-10-07','2026-10-08'),h8().replace('14182513.2','NaN'),h8().replace('14182513.2','-1'),h8().replace('OBS_STATUS="A"','OBS_STATUS="X"'),h8().replace('19771474.9','')])assert.throws(()=>source().parseBankCreditXml(xml,{now}),/Board|H8|date|unit|metadata|numeric|status|duplicate/i);
  assert.throws(()=>source().parseBankCreditXml('<!DOCTYPE x>'+h8(),{now}),/XML|Board/i);
});

test('SLOOS keeps signed net percentages and native source quarter labels without turning them into publication dates',()=>{
  const result=source().parseLendingSurveyXml(sloos(),{now});
  assert.equal(result.ciDemandLarge.observations[0].value,16.1);
  assert.equal(result.ciStandardsLarge.observations[0].value,0);
  assert.equal(result.ciDemandSmall.observations[0].value,-3.6);
  assert.equal(result.ciStandardsSmall.observations[0].date,'2026-07-01');
  assert.equal(result.ciStandardsSmall.observations[0].sourcePeriodLabel,'2026-09-30');
  assert.equal(result.ciStandardsSmall.observations[0].publishedAt,null);
  assert.match(result.ciStandardsLarge.coverageNote,/quarter.*label|label.*quarter/i);
  assert.throws(()=>source().parseLendingSurveyXml(sloos().replace('16.1','100.1'),{now}),/numeric|percentage|Board/i);
  assert.throws(()=>source().parseLendingSurveyXml(sloos().replaceAll('2026-09-30','2026-09-29'),{now}),/quarter|date|Board/i);
});

test('SLOOS already-released July survey remains current in August despite its September quarter-end source label',()=>{
  const xml=sloos().replace(/(<frb:Obs OBS_STATUS="A" OBS_VALUE="[^"]+" TIME_PERIOD="2026-09-30" \/>)/g,obs('2026-06-30','10')+'$1');
  const result=source().parseLendingSurveyXml(xml,{now:new Date('2026-08-04T15:00:00Z')});
  assert.deepEqual(result.ciStandardsLarge.observations.map(row=>[row.date,row.value,row.sourcePeriodLabel]),[['2026-04-01',10,'2026-06-30'],['2026-07-01',0,'2026-09-30']]);
  assert.equal(result.ciStandardsLarge.dateConvention,'source-quarter-start-label');
  assert.ok(result.ciStandardsLarge.observations.every(row=>row.publishedAt===null));
  assert.throws(()=>source().parseLendingSurveyXml(xml.replaceAll('2026-09-30','2026-09-29'),{now:new Date('2026-08-04T15:00:00Z')}),/quarter|date|Board/i);
});

test('H41 parser selects consolidated total assets and Wednesday stocks rather than weekly averages',()=>{
  const result=source().parseFedBalanceXml(h41(),{now});
  assert.equal(result.fedAssets.observations[0].value,6753.604);
  assert.equal(result.reserveBalances.observations[0].value,2969.522);
  assert.equal(result.tgaBalance.observations[0].value,945.153);
  assert.deepEqual(result.fedAssets.sourceIds,['RESPPMA_N.WW']);
  assert.throws(()=>source().parseFedBalanceXml(h41().replace('SERIESTYPE="L"','SERIESTYPE="A"'),{now}),/metadata|Board/i);
  assert.equal(Object.keys(result).length,3);
});

test('Board collector reads the exact ZIP member, hashes the response and rejects redirects without rewriting publication clocks',async()=>{
  const api=source(),zip=zipFixture([{name:'H8_data.xml',text:h8()}]);
  const result=await api.collectBankCredit({now,fetchImpl:async url=>{assert.equal(url,'https://www.federalreserve.gov/releases/h8/data/FRB_h8_xml.zip');return new Response(zip);}});
  assert.equal(result.id,'bankCredit');assert.equal(result.provenance[0].filename,'H8_data.xml');assert.match(result.provenance[0].sha256,/^[a-f0-9]{64}$/);
  assert.equal(result.series.bankLoans.licenseUrl,'https://www.federalreserve.gov/disclaimer.htm');assert.match(result.series.bankLoans.attribution,/Board of Governors/);
  assert.equal(result.series.bankLoans.observations[0].publishedAt,null);
  await assert.rejects(api.collectBankCredit({now,fetchImpl:async()=>Object.defineProperty(new Response(zip),'redirected',{value:true})}),/redirect|source/i);
});

test('Board XML removes commented examples and rejects malformed nested comments',()=>{
  const api=source(),example=obs('2026-10-14','1'),valid=h8().replace('</kf:Series>',`<!-- ${example} --></kf:Series>`);
  assert.deepEqual(api.parseBankCreditXml(valid,{now}).bankLoans.observations.map(row=>row.date),['2026-10-07']);
  for(const comment of ['<!-- bad -- embedded -->','<!-- outer <!-- nested --> -->'])assert.throws(()=>api.parseBankCreditXml(h8().replace('</kf:Series>',`${comment}</kf:Series>`),{now}),/comment|XML/i);
});

const regular=(extra={})=>({operationId:'RP 102226 26',auctionStatus:'Results',operationDate:'2026-10-22',settlementDate:'2026-10-22',maturityDate:'2026-10-23',operationType:'Reverse Repo',operationMethod:'Fixed Rate',settlementType:'Same Day',termCalenderDays:1,term:'Overnight',releaseTime:'12:45',closeTime:'13:15',note:'',lastUpdated:'2026-10-22 13:15:29',participatingCpty:2,acceptedCpty:2,totalAmtSubmitted:351000000,totalAmtAccepted:351000000,details:[{securityType:'Treasury',amtSubmitted:351000000,amtAccepted:351000000,percentOfferingRate:3.75,percentAwardRate:3.75}],...extra});

test('ON RRP selects regular operations, excludes explicit small-value tests and retains operation rather than outstanding balance',()=>{
  const rows=source().parseOnRrp({repo:{operations:[regular(),regular({operationId:'SVE',closeTime:'10:30',note:'This operation is a Small Value Exercise (SVE)'})]}},{now});
  assert.equal(rows.length,1);assert.equal(rows[0].value,.351);assert.equal(rows[0].sourceValue,'351000000');
  assert.equal(rows[0].operationId,'RP 102226 26');assert.equal(rows[0].publishedAt,null);assert.equal(rows[0].settlementDate,'2026-10-22');
  const friday=regular({operationDate:'2026-10-16',settlementDate:'2026-10-16',maturityDate:'2026-10-19',termCalenderDays:3});
  assert.equal(source().parseOnRrp({repo:{operations:[friday]}},{now})[0].termCalendarDays,3);
});

test('ON RRP rejects duplicate daily regular results, changed operation metadata and mismatched totals',()=>{
  for(const operations of [[regular(),regular({operationId:'other'})],[regular({closeTime:'14:00'})],[regular({totalAmtAccepted:-1})],[regular({totalAmtAccepted:'351000000'})],[regular({maturityDate:'2026-10-24'})],[regular({details:[{securityType:'Agency',amtAccepted:351000000}]})]])assert.throws(()=>source().parseOnRrp({repo:{operations}},{now}),/RRP|operation|numeric|duplicate|maturity|tranche/i);
});

test('ON RRP preserves published 12:44 regular-operation opening metadata without confusing it with a publication instant',()=>{
  const row=source().parseOnRrp({repo:{operations:[regular({releaseTime:'12:44'})]}},{now})[0];
  assert.equal(row.value,.351);assert.equal(row.operationReleaseTime,'12:44');assert.equal(row.publishedAt,null);
});

test('ON RRP collector retains precise reviewed query, raw hash, conditional commercial notices and distinct clocks',async()=>{
  const result=await source().collectOnRrp({now,fetchImpl:async url=>{
    assert.equal(url,'https://markets.newyorkfed.org/api/rp/results/search.json?startDate=2024-01-01&endDate=2026-10-22&operationTypes=Reverse%20Repo&method=fixed&securityType=tsy&term=overnight');
    return new Response(JSON.stringify({repo:{operations:[regular()]}}));
  }});
  assert.equal(result.id,'onRrp');assert.equal(result.series.onRrpAccepted.sourceTitle,'Reverse Repo Operations');
  assert.match(result.series.onRrpAccepted.sourceNotice,/© 2026 Federal Reserve Bank of New York/);
  assert.match(result.series.onRrpAccepted.sourceNotice,/Meridian is not affiliated/);
  assert.match(result.series.onRrpAccepted.calculation,/billion|1,000,000,000/);
  assert.match(result.provenance[0].sha256,/^[a-f0-9]{64}$/);assert.equal(result.series.onRrpAccepted.observations[0].publishedAt,null);
  await assert.rejects(source().collectOnRrp({now,fetchImpl:async()=>new Response('denied',{status:403})}),/403/);
  await assert.rejects(source().collectOnRrp({now,fetchImpl:async()=>Object.defineProperty(new Response('{}'),'redirected',{value:true})}),/redirect|source/i);
});
