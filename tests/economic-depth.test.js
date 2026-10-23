import test from 'node:test';
import assert from 'node:assert/strict';
import * as bea from '../scripts/sources/bea.mjs';
import * as bls from '../scripts/sources/bls.mjs';
import * as treasury from '../scripts/sources/treasury.mjs';

const quarterlyCodes=['A191RC','LB000003','PB000003','A261RC','A261RL','A008RL','A011RL','A009RL','Y033RL','Y001RL','B020RC','B021RC','A019RC'];
test('BEA economic depth preserves exact published growth and scales dollar levels without adding chained components',()=>{
  assert.equal(typeof bea.parseBeaEconomicDepth,'function');
  const quarterly='%SeriesCode,Period,Value\n'+quarterlyCodes.map((code,index)=>`${code},2026Q2,${code==='PB000003'?'4.6':1000000+index}`).join('\n');
  const monthly='%SeriesCode,Period,Value\nA072RC,2026M08,4.0';
  const result=bea.parseBeaEconomicDepth(quarterly,monthly);
  assert.equal(result.nominalGdp.observations[0].value,1000);
  assert.equal(result.privateDomesticDemand.observations[0].value,1000.001);
  assert.equal(result.privateDomesticDemandGrowth.observations[0].value,4.6);
  assert.equal(result.privateDomesticDemandGrowth.observations[0].sourceValue,'4.6');
  assert.equal(result.savingRate.observations[0].value,4);
  assert.equal(result.nominalGdi.observations[0].value,1000.003);
  assert.deepEqual(result.nominalGdp.sourceIds,['A191RC']);
  assert.match(result.privateDomesticDemand.calculation,/not.*add|nonadditive|Do not sum/i);
  assert.ok(Object.values(result).every(s=>s.observations.every(o=>o.publishedAt===null)));
  assert.throws(()=>bea.parseBeaEconomicDepth(quarterly.replace('PB000003,2026Q2,4.6',''),monthly),/missing.*PB000003/i);
});

test('BLS economic depth accepts quarterly Q01-Q04 and excludes annual averages without turning them into months',()=>{
  assert.equal(typeof bls.parseBlsEconomicDepth,'function');
  const quarterly=['CIS1010000000000I','PRS85006092','PRS85006112'];
  const codes=['JTS000000000000000HIR','JTS000000000000000QUR','JTS000000000000000LDR','LNS12300060','LNS11300060',...quarterly];
  const payload={status:'REQUEST_SUCCEEDED',Results:{series:codes.map(seriesID=>({seriesID,data:quarterly.includes(seriesID)?[
    {year:'2026',period:'Q01',value:'175',footnotes:[]},{year:'2026',period:'Q02',value:seriesID==='CIS1010000000000I'?'177.178':'1.4',footnotes:[{text:'Revised'}]},
    {year:'2025',period:'Q05',value:'999',footnotes:[]},
  ]:[{year:'2026',period:'M08',value:'3.3',footnotes:[]},{year:'2025',period:'M13',value:'999',footnotes:[]}]}))}};
  const result=bls.parseBlsEconomicDepth(payload);
  assert.deepEqual(result.eciCompensation.observations.map(o=>o.date),['2026-01-01','2026-04-01']);
  assert.equal(result.laborProductivity.observations.at(-1).value,1.4,'published annualized growth is not annualized twice');
  assert.equal(result.hiresRate.observations[0].value,3.3,'rates are not thousands or divided by 1000');
  assert.ok(Math.abs(result.eciCompensationQuarterly.observations.at(-1).value-100*(177.178/175-1))<1e-12);
  assert.match(result.eciCompensationQuarterly.calculation,/not annualized/i);
  assert.deepEqual(result.unitLaborCosts.observations.at(-1).footnotes,['Revised']);
  assert.equal(result.primeAgeParticipation.observations[0].publishedAt,null);
  const gap=structuredClone(payload);gap.Results.series.find(s=>s.seriesID==='CIS1010000000000I').data=gap.Results.series.find(s=>s.seriesID==='CIS1010000000000I').data.filter(o=>o.period!=='Q01');
  assert.equal(bls.parseBlsEconomicDepth(gap).eciCompensationQuarterly.observations[0].value,null);
  assert.throws(()=>bls.parseBlsEconomicDepth({status:'REQUEST_SUCCEEDED',Results:{series:[]}}),/missing/i);
});

test('main 10Y reuses reviewed curve history with exact dates and annual input provenance',()=>{
  assert.equal(typeof treasury.harmonizeTreasuryYieldHistory,'function');
  const url=year=>`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  const base={id:'treasury',fetchedAt:'2026-10-22T21:00:00Z',series:{debt:{observations:[]},yield:{sourceIds:['BC_10YEAR'],observations:[{date:'2026-10-21',value:4.1,publishedAt:null}],sourceUrl:url(2026)}},provenance:[{url:url(2026),sha256:'a'.repeat(64)}]};
  const curves={id:'yields',fetchedAt:'2026-10-22T22:00:00Z',curveHistory:[{date:'2022-01-03',nominal:{'10Y':0}},{date:'2026-10-21',nominal:{'10Y':null}}],provenance:[{url:url(2022),sha256:'b'.repeat(64),retrievedAt:'2026-10-22T22:00:00Z'},{url:url(2026),sha256:'c'.repeat(64),retrievedAt:'2026-10-22T22:00:00Z'}]};
  const result=treasury.harmonizeTreasuryYieldHistory(base,curves);
  assert.deepEqual(result.series.yield.observations.map(o=>[o.date,o.value,o.publishedAt]),[['2022-01-03',0,null],['2026-10-21',null,null]]);
  assert.equal(result.series.yield.observations[0].sourceUrl,url(2022));
  assert.equal(result.series.yield.fetchedAt,curves.fetchedAt);
  assert.equal(result.fetchedAt,curves.fetchedAt,'compound source clock cannot predate its newly added capture');
  assert.equal(result.series.debt.fetchedAt,base.fetchedAt,'debt retains its independently older real retrieval');
  assert.ok(result.provenance.some(o=>o.sha256==='b'.repeat(64)));
  assert.equal(base.series.yield.observations.length,1,'old source captures are not mutated');
  const missing=structuredClone(curves);missing.provenance=[];
  assert.throws(()=>treasury.harmonizeTreasuryYieldHistory(base,missing),/provenance/i);
});

test('10Y harmonization retains older history and newer Treasury dates when curves are cached',()=>{
  const url=year=>`https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  const previous={id:'treasury',fetchedAt:'2026-10-20T22:00:00Z',series:{yield:{sourceIds:['BC_10YEAR'],observations:[{date:'2022-01-03',value:1.6,publishedAt:null,sourceUrl:url(2022)}],sourceUrl:url(2026)}},provenance:[{url:url(2022),sha256:'a'.repeat(64),retrievedAt:'2026-10-20T22:00:00Z'}]};
  const fresh={id:'treasury',fetchedAt:'2026-10-23T02:00:00Z',series:{yield:{sourceIds:['BC_10YEAR'],observations:[{date:'2026-10-21',value:4.95,publishedAt:null},{date:'2026-10-22',value:4.96,publishedAt:null}],sourceUrl:url(2026)}},provenance:[{url:url(2026),sha256:'b'.repeat(64),retrievedAt:'2026-10-23T02:00:00Z'}]};
  const cached={id:'yields',fetchedAt:'2026-10-22T01:00:00Z',curveHistory:[{date:'2023-01-03',nominal:{'10Y':3.8}},{date:'2026-10-21',nominal:{'10Y':4.9}}],provenance:[{url:url(2023),sha256:'c'.repeat(64),retrievedAt:'2026-10-22T01:00:00Z'},{url:url(2026),sha256:'d'.repeat(64),retrievedAt:'2026-10-22T01:00:00Z'}]};
  const result=treasury.harmonizeTreasuryYieldHistory(fresh,cached,{previousTreasury:previous});
  assert.deepEqual(result.series.yield.observations.map(row=>[row.date,row.value]),[['2022-01-03',1.6],['2023-01-03',3.8],['2026-10-21',4.95],['2026-10-22',4.96]]);
  assert.equal(result.series.yield.fetchedAt,fresh.fetchedAt);
  assert.equal(result.series.yield.observations[2].retrievedAt,fresh.fetchedAt);
  assert.equal(result.series.yield.observations[0].sourceSha256,'a'.repeat(64));
  assert.equal(result.provenance.length,4,'both captures of the same annual file are retained');
  const repeated=treasury.harmonizeTreasuryYieldHistory(result,cached,{previousTreasury:previous});
  assert.deepEqual(repeated,result,'repeated refreshes do not alter row vintages or duplicate provenance');
});

test('fiscal ratios align quarter-end debt stock and trailing-year actual fiscal flows with nominal GDP',async()=>{
  let module;try{module=await import('../src/economic-depth.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
  assert.equal(typeof module?.fiscalGdpContext,'function');
  const nominal=[['2025-07-01',20000],['2025-10-01',22000],['2026-01-01',24000],['2026-04-01',26000]].map(([date,value])=>({date,value}));
  const monthly=Array.from({length:12},(_,i)=>({date:new Date(Date.UTC(2025,6+i,1)).toISOString().slice(0,10),receipts:100,outlays:120,netInterest:10}));
  const sources={bea:{fetchedAt:'2026-10-22T20:00:00Z',series:{nominalGdp:{observations:nominal}}},treasury:{fetchedAt:'2026-10-22T21:00:00Z',series:{debt:{observations:[{date:'2026-06-30',value:39},{date:'2026-10-21',value:40}]}}},fiscal:{fetchedAt:'2026-10-22T22:00:00Z',series:{publicDebt:{observations:[{date:'2026-06-30',value:30}]}},monthly}};
  const result=module.fiscalGdpContext(sources);
  assert.equal(result.quarterDate,'2026-04-01');assert.equal(result.quarterEnd,'2026-06-30');
  assert.equal(result.grossDebtToGdp.value,150,'stock uses same-quarter nominal GDP SAAR, converting trillions to billions');
  assert.equal(result.publicDebtToGdp.value,100*30000/26000);
  assert.equal(result.deficitToGdp.value,100*240/23000,'four SAAR GDP quarters divided by four is one actual annual flow');
  assert.equal(result.netInterestToGdp.value,100*120/23000);
  assert.equal(result.grossDebtToGdp.numeratorDate,'2026-06-30');
  assert.equal(result.grossDebtToGdp.numeratorCapturedAt,sources.treasury.fetchedAt);
  assert.equal(result.grossDebtToGdp.denominatorCapturedAt,sources.bea.fetchedAt);
  assert.equal(result.basis,'latest-revised');
  const missing=structuredClone(sources);missing.fiscal.monthly.splice(3,1);missing.treasury.series.debt.observations.shift();
  const unavailable=module.fiscalGdpContext(missing);
  assert.equal(unavailable.deficitToGdp.value,null);assert.equal(unavailable.grossDebtToGdp.value,null);
  assert.equal(unavailable.publicDebtToGdp.value,result.publicDebtToGdp.value);
  const gap=structuredClone(sources);gap.bea.series.nominalGdp.observations.splice(1,1);
  assert.equal(module.fiscalGdpContext(gap).netInterestToGdp.value,null,'missing exact quarter is not replaced by an adjacent quarter');
  const noInterest=structuredClone(sources);noInterest.fiscal.monthly[0].netInterest=null;
  assert.equal(module.fiscalGdpContext(noInterest).deficitToGdp.value,result.deficitToGdp.value,'deficit does not depend on an unrelated missing interest input');
  assert.equal(module.fiscalGdpContext(noInterest).netInterestToGdp.value,null);
  const realOnly=structuredClone(sources);delete realOnly.bea.series.nominalGdp;realOnly.bea.series.gdp={observations:nominal};
  assert.equal(module.fiscalGdpContext(realOnly),null,'real GDP or a growth series never substitutes for nominal GDP');
  const separateClock=structuredClone(sources);separateClock.treasury.series.debt.fetchedAt='2026-10-21T20:00:00Z';
  assert.equal(module.fiscalGdpContext(separateClock).grossDebtToGdp.numeratorCapturedAt,'2026-10-21T20:00:00Z','a later curve retrieval cannot update the debt denominator context vintage');
});
