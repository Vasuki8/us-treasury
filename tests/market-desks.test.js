import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const api=await import('../scripts/sources/market-desks.mjs').catch(()=>null);
const schema=await import('../src/market-desk-schema.js').catch(()=>null);
const definitions=await import('../src/market-desk-definitions.js').catch(()=>null);
const policy=await import('../scripts/market-desks-policy.mjs').catch(()=>null);
const path=new URL('./fixtures/market-desks/',import.meta.url);
const json=async name=>JSON.parse(await readFile(new URL(name,path),'utf8'));
const now=new Date('2026-11-01T12:00:00Z');

test('specialist families expose separate bounded collectors and browser-safe definitions',()=>{
 assert.ok(api&&schema&&definitions&&policy,'missing specialist collectors, definitions and admission');
 for(const id of ['fedQt','dealerDetails','moneyRates','repoOperations','ofrRepo','ofrMmf','nyfedTriParty','dkwInflation'])assert.equal(typeof api.marketDeskCollectors[id],'function',id);
 assert.equal(definitions.marketDeskRegistry.dealerNetBills.agency,'dealerDetails');
 assert.equal(definitions.marketDeskRegistry.dkwInflationExpected10.observationType,'model-estimate');
});

test('dealer maturity groups preserve signed net stock and require every component',()=>{
 assert.ok(api,'missing specialist collector');
 const rows=Object.values(definitions.dealerDetailDefinitions).flatMap(d=>d.codes).filter((v,i,a)=>a.indexOf(v)===i).map(keyid=>({keyid,asofdate:'2026-10-28',value:'-1000'}));
 const parsed=api.parseDealerDetails({pd:{timeseries:rows}},{now});
 assert.equal(parsed.dealerNetBills.observations[0].value,-1);
 assert.equal(parsed.dealerNetCouponsLe3.observations[0].value,-2);
 rows.find(r=>r.keyid==='PDPOSGSC-L2').value='*';
 assert.equal(api.parseDealerDetails({pd:{timeseries:rows}},{now}).dealerNetCouponsLe3.observations[0].value,null);
 assert.throws(()=>api.parseDealerDetails({pd:{timeseries:rows.slice(1)}},{now}),/missing|incomplete/i);
 assert.throws(()=>api.parseDealerDetails({pd:{timeseries:[...rows,rows[0]]}},{now}),/duplicate/i);
 assert.throws(()=>api.parseDealerDetails({pd:{timeseries:[...rows,{keyid:'PDPOSGS-BC',asofdate:'2026-10-28',value:'1'}]}},{now}),/unreviewed/i);
});

test('public TGCR/BGCR/OBFR preserve native published distribution and reject unexpected series',async()=>{
 assert.ok(api,'missing specialist collector');
 const payload=await json('nyfedTgcr.bin');
 const rows=api.parseMoneyReferenceRates(payload,'TGCR',{now});
 assert.equal(rows.at(-1).volumeInBillions,1212);
 assert.equal(rows.at(-1).percentile99,3.95);
 assert.throws(()=>api.parseMoneyReferenceRates(payload,'BGCR',{now}),/type|identifier/i);
 const altered=structuredClone(payload);altered.refRates[0].revisionIndicator='unknown';
 assert.throws(()=>api.parseMoneyReferenceRates(altered,'TGCR',{now}),/revision/i);
 altered.refRates[0].revisionIndicator='';altered.refRates[0].footnoteId=3;
 assert.throws(()=>api.parseMoneyReferenceRates(altered,'TGCR',{now}),/contingency/i);
});

test('repo operations retain separate operation identities and sum only regular same-day amounts',async()=>{
 assert.ok(api,'missing specialist collector');
 const payload=await json('nyfedRepo.bin');
 const parsed=api.parseRepoOperations(payload,{now});
 assert.equal(parsed.tables.operations.rows.filter(r=>r.date==='2026-10-30').length,2);
 assert.equal(parsed.series.standingRepoAccepted.observations.at(-1).value,0);
 const altered=structuredClone(payload);altered.repo.operations[0].details[0].amtAccepted=1;
 assert.throws(()=>api.parseRepoOperations(altered,{now}),/tranche|total|amount/i);
 const exercise=structuredClone(payload);exercise.repo.operations[0].note='Operational readiness testing';
 assert.equal(api.parseRepoOperations(exercise,{now}).tables.operations.rows.length,parsed.tables.operations.rows.length-1);
});

test('OFR exact full-series metadata distinguishes percent mean rates, dollar volumes and monthly stocks',async()=>{
 assert.ok(api,'missing specialist collector');
 const input=await json('repoData.json'), volume=JSON.parse(await readFile(new URL('repoVolume.txt',path),'utf8')), mmf=await json('mmfData.json');
 const rate=api.parseOfrSeries(input,definitions.ofrRepoDefinitions.ofrDvpMeanRate,{now});
 assert.equal(rate.at(-1).value,3.96);
 assert.ok(api.parseOfrSeries(volume,definitions.ofrRepoDefinitions.ofrDvpTransactionVolume,{now}).at(-1).value>3000);
 assert.equal(api.parseOfrSeries(mmf,definitions.ofrMmfDefinitions.mmfTotalInvestments,{now}).at(-1).date,'2026-09-30');
 const wrong=structuredClone(input);wrong['REPO-DVP_AR_TOT-P'].metadata.unit.name='USD';
 assert.throws(()=>api.parseOfrSeries(wrong,definitions.ofrRepoDefinitions.ofrDvpMeanRate,{now}),/unit/i);
 const nonMonth=structuredClone(mmf);nonMonth['MMF-MMF_TOT-M'].timeseries.aggregation[0][0]='2026-01-30';
 assert.throws(()=>api.parseOfrSeries(nonMonth,definitions.ofrMmfDefinitions.mmfTotalInvestments,{now}),/month.end/i);
});

test('OFR disclosure edits remain missing rather than zero or historical replacement',async()=>{
 assert.ok(api,'missing specialist collector');
 const payload=await json('repoData.json');payload['REPO-DVP_AR_TOT-P'].timeseries.aggregation[0][1]=null;
 const rows=api.parseOfrSeries(payload,definitions.ofrRepoDefinitions.ofrDvpMeanRate,{now});
 assert.equal(rows[0].value,null);assert.equal(rows[0].sourceValue,'null');
 const wrong=structuredClone(payload);wrong['REPO-DVP_AR_TOT-P'].metadata.rights.description='Redistribution prohibited';
 assert.throws(()=>api.parseOfrSeries(wrong,definitions.ofrRepoDefinitions.ofrDvpMeanRate,{now}),/rights/i);
});

test('H41 component parser selects exact Wednesday stock metadata and native millions conversion',async()=>{
 assert.ok(api,'missing specialist collector');
 const parsed=api.parseFedQtXml(await readFile(new URL('h41-components.xml',path),'utf8'),{now});
 assert.ok(parsed.fedTreasurySecurities.observations.at(-1).value>3000);
 assert.equal(parsed.fedTreasurySecurities.sourceIds[0],'RESPPALGUO_N.WW');
 const wrong=(await readFile(new URL('h41-components.xml',path),'utf8')).replace('UNIT_MULT="1000000"','UNIT_MULT="1000"');
 assert.throws(()=>api.parseFedQtXml(wrong,{now}),/metadata|unit/i);
});

test('tri-party workbook preserves monthly snapshot dates and structural break in published quantities',async()=>{
 assert.ok(api,'missing specialist collector');
 const parsed=api.parseTriPartyWorkbook(await readFile(new URL('triParty.bin',path)),{now});
 assert.ok(parsed.series.triPartyCollateralValue.observations.length>0);
 assert.ok(parsed.series.triPartyCollateralValue.observations.every(r=>r.date>='2025-11-01'));
 assert.match(parsed.coverageNote,/November 2025/);
 assert.equal(parsed.tables.collateral.unit,'USD billions');
 assert.ok(parsed.tables.collateral.rows.every(r=>r.asOf===r.date&&r.observationType==='official'));
});

test('DKW file remains a named staff model estimate with signed premia and pre-TIPS nulls',async()=>{
 assert.ok(api,'missing specialist collector');
 const text=await readFile(new URL('dkw.csv',path),'utf8');
 const parsed=api.parseDkwCsv(text,{now});
 assert.equal(parsed.dkwTipsLiquidity10.observations[0].value,null);
 assert.equal(parsed.dkwInflationExpected10.observationType,'model-estimate');
 assert.ok(parsed.dkwInflationRisk10.observations.some(r=>r.value<0));
 assert.throws(()=>api.parseDkwCsv(text.replace('all rates are in percentage points','all rates are in decimals'),{now}),/unit|header/i);
});

test('shared admission verifies source identities, receipts and exact numeric lineage',async()=>{
 assert.ok(api&&schema&&policy,'missing specialist admission');
 const payloads={tgcr:await json('nyfedTgcr.bin'),bgcr:await json('bgcr.json'),obfr:await json('obfr.json')};
 const source=await api.marketDeskCollectors.moneyRates({now,fetchImpl:async url=>new Response(JSON.stringify(payloads[Object.keys(payloads).find(id=>url.includes('/'+id+'/'))]),{headers:{'content-type':'application/json'}})});
 assert.equal(schema.validateMarketDeskSource(source),true);
 assert.doesNotThrow(()=>policy.assertMarketDeskSources({moneyRates:source},{complete:false}));
 const bad=structuredClone(source);bad.series.tgcr.observations[0].value+=1;
 assert.equal(schema.validateMarketDeskSource(bad),false);
 assert.throws(()=>policy.assertMarketDeskSources({moneyRates:bad},{complete:false}),/lineage|value/i);
 const spoof=structuredClone(source);spoof.provenance[0].url+='&provider=other';assert.equal(schema.validateMarketDeskSource(spoof),false);
 const missing=structuredClone(source);delete missing.series.obfr;assert.equal(schema.validateMarketDeskSource(missing),false);
 const unit=structuredClone(source);unit.series.obfr.unit='Basis points';assert.equal(schema.validateMarketDeskSource(unit),false);
});

test('SEP admission keeps participant totals and projection horizons separate from observations',async()=>{
 assert.ok(schema,'missing specialist admission');const source=await json('fedSep-candidate.json');source.status='ok';
 assert.equal(schema.validateMarketDeskSource(source),true);
 const bad=structuredClone(source);bad.tables.dots.rows[0].count+=1;assert.equal(schema.validateMarketDeskSource(bad),false);
 const named=structuredClone(source);named.tables.dots.rows[0].participant='Governor';assert.equal(schema.validateMarketDeskSource(named),false);
 const future=structuredClone(source);future.tables.projections.rows[0].asOf='2099-09-16';assert.equal(schema.validateMarketDeskSource(future),false);
});

test('regular repo pre-December-2025 multiple-price auctions preserve minimum-bid and offering-rate meanings',async()=>{
 const payload=await json('repo-full.json');const historic=payload.repo.operations.find(r=>r.operationMethod==='Multiple Price'&&r.settlementType==='Same Day'&&r.term==='Overnight'&&!r.note);
 const parsed=api.parseRepoOperations({repo:{operations:[historic]}},{now});const detail=parsed.tables.operations.rows[0].details[0];
 assert.equal(detail.minimumBidRate,historic.details[0].minimumBidRate);assert.equal(detail.offeringRate,null);
 assert.equal(parsed.tables.operations.rows[0].method,'Multiple Price');
});

test('captured provider candidates pass browser and Node admission and reject metadata tampering',async()=>{
 for(const id of ['fedQt','dealerDetails','moneyRates','repoOperations','ofrRepo','ofrMmf','nyfedTriParty','dkwInflation','fedSep','fedFx','ecbFx','ecbPolicy']){
  const source=await json(`${id}-candidate.json`);
  assert.doesNotThrow(()=>policy.assertMarketDeskSources({[id]:source},{complete:false}),id);
  const bad=structuredClone(source);bad.provenance[0].sha256='not a hash';assert.equal(schema.validateMarketDeskSource(bad),false,id);
  const wrong=structuredClone(source);if(Object.keys(wrong.series).length){const s=Object.values(wrong.series)[0];s.sourceTitle='Fabricated title';assert.equal(schema.validateMarketDeskSource(wrong),false,id);}else{wrong.tables.projections.rows[0].horizon='2022';assert.equal(schema.validateMarketDeskSource(wrong),false,id);}
 }
});
