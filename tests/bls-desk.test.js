import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const definitions=await import('../src/bls-desk-definitions.js').catch(()=>({}));
const collector=await import('../scripts/sources/bls-desk.mjs').catch(()=>({}));
const schema=await import('../src/bls-desk-schema.js').catch(()=>({}));
const policy=await import('../scripts/bls-desk-policy.mjs').catch(()=>({}));
const endpoint='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const row=(period,value,year='2026')=>({year,period,value:String(value),footnotes:[{code:'P',text:'Preliminary'}]});
const payload=(codes,data=code=>[row(code.startsWith('CI')||code.startsWith('PR')?'Q02':'M06',100)])=>({status:'REQUEST_SUCCEEDED',message:[],Results:{series:codes.map(seriesID=>({seriesID,data:data(seriesID)}))}});

test('BLS desk metadata distinguishes published PRS indexes, annual changes and annualized quarterly changes',()=>{
  const d=definitions.blsDeskDefinitions;assert.ok(d,'specialist definitions missing');
  assert.equal(d.productivityIndex.code,'PRS85006093');assert.equal(d.productivityAnnual.code,'PRS85006091');
  assert.equal(d.unitLaborCostIndex.code,'PRS85006113');assert.equal(d.unitLaborCostsAnnual.code,'PRS85006111');
  assert.equal(d.nonfarmOutputIndex.code,'PRS85006043');assert.equal(d.hoursWorkedIndex.code,'PRS85006033');
  assert.equal(d.nominalHourlyCompensationQuarterly.code,'PRS85006102');
  assert.equal(d.realHourlyCompensationIndex.code,'PRS85006153');
  assert.equal(d.productivityIndex.unit,'Index, 2017=100');assert.equal(d.productivityAnnual.unit,'Percent year over year');
  assert.equal(d.marginallyAttachedLevel.adjustment,'Seasonally adjusted');
});

test('BLS desk parser rejects missing, extra or duplicate codes and invalid periods instead of admitting a partial batch',()=>{
  assert.equal(typeof collector.parseBlsDeskBatch,'function','bounded parser missing');
  const codes=['LNS11000000','PRS85006093'];
  for(const edit of [p=>p.Results.series.pop(),p=>p.Results.series.push({seriesID:'SECRET',data:[row('M06',1)]}),p=>p.Results.series.push(p.Results.series[0]),p=>p.Results.series[0].data.push(row('M14',10)),p=>p.Results.series[0].data.push(row('M06',10)),p=>p.Results.series[0].data[0].value='NaN']){
    const p=payload(codes);edit(p);assert.throws(()=>collector.parseBlsDeskBatch(p,codes),/BLS|batch|scope|period|numeric|duplicate|missing/i);
  }
  const p=payload(codes);p.Results.series[0].data.push(row('M13',999));p.Results.series[1].data.push(row('Q05',999));
  p.Results.series[0].data[0].value='(S)';
  const parsed=collector.parseBlsDeskBatch(p,codes);assert.equal(parsed.LNS11000000[0].value,null);
  assert.equal(parsed.PRS85006093[0].date,'2026-04-01');assert.deepEqual(parsed.PRS85006093[0].footnotes,['Preliminary']);
});

async function capture(overrides={}){
  assert.equal(typeof collector.collectBlsDesk,'function','specialist collector missing');
  return collector.collectBlsDesk({now:new Date('2026-11-01T12:00:00Z'),pause:async()=>{},fetchImpl:async(url,options)=>{
    assert.equal(url,endpoint);const request=JSON.parse(options.body);assert.ok(request.seriesid.length<=25);assert.equal(Number(request.endyear)-Number(request.startyear),9);
    return new Response(JSON.stringify(payload(request.seriesid,code=>{
      if(overrides[code])return overrides[code];
      return code.startsWith('CI')||code.startsWith('PR')?[row('Q02',100),row('Q01',98),row('Q02',96,'2025')]:[row('M06',100),row('M05',98),row('M04',97),row('M03',96),row('M02',95),row('M01',94),row('M12',93,'2025'),row('M06',90,'2025')];
    })),{headers:{'Content-Type':'application/json'}});
  }});
}

test('BLS desk preserves genuine published levels and growth and uses exact baselines for calculated changes',async()=>{
  const source=await capture({'PRS85006093':[row('Q02',121.325)],'PRS85006091':[row('Q02',2.3)],'CES0500000003':[row('M06',30),row('M04',29)]});
  assert.equal(source.id,'blsDesk');assert.equal(source.series.productivityIndex.observations[0].value,121.325);
  assert.equal(source.series.productivityAnnual.observations[0].value,2.3);
  assert.equal(source.series.earningsMonthly.observations.at(-1).value,null);
  assert.equal(source.series.payrollManufacturingChange.observations.at(-1).value,2);
  assert.equal(source.series.weeklyEarnings.observationType,'official');
  assert.equal(source.series.eciCivilianWagesQuarterly.observations.at(-1).baseDate,'2026-01-01');
  assert.ok(Math.abs(source.series.eciCivilianWagesQuarterly.observations.at(-1).value-2.0408163265306145)<1e-10);
  assert.equal(source.series.eciCivilianWagesAnnual.observations.at(-1).baseDate,'2025-04-01');
  assert.equal(source.series.payrollSupersectorResidual.observations.at(-1).value,-20);
  assert.equal(source.series.payrollStateLocalLevel.observations.at(-1).value,200);
  assert.equal(source.series.underutilizationSpread.observations.at(-1).value,0);
  assert.ok(source.provenance.length>=3);assert.ok(source.provenance.every(p=>p.url===endpoint&&/^[a-f0-9]{64}$/.test(p.sha256)&&p.retrievedAt));
});

test('browser and server BLS desk admission reject forged units, code scopes, computed values and publication dates',async()=>{
  const source=await capture();assert.equal(typeof schema.validateBlsDeskSource,'function','browser validator missing');
  assert.match(source.series.productivityIndex.sourceNotice,/BLS.gov cannot vouch/);
  assert.equal(schema.validateBlsDeskSource(source),true);assert.doesNotThrow(()=>policy.assertBlsDeskSource(source));
  for(const edit of [s=>s.series.productivityIndex.unit='Percent',s=>s.series.productivityIndex.sourceNotice='',s=>s.series.productivityIndex.sourceIds=['PRS85006091'],s=>s.series.productivityIndex.observations[0].publishedAt='2026-01-01',s=>s.series.payrollManufacturingChange.observations.at(-1).value=999,s=>s.provenance[0].requestedSeries=['UNREVIEWED'],s=>s.provenance=[],s=>s.series.productivityIndex.sourceUrl=endpoint+'?key=secret',s=>delete s.series.hoursWorkedIndex]){
    const changed=structuredClone(source);edit(changed);assert.equal(schema.validateBlsDeskSource(changed),false);assert.throws(()=>policy.assertBlsDeskSource(changed),/BLS|blsDesk|scope|source|capture/i);
  }
});

test('BLS desk fails the full capture when a later public batch is incomplete',async()=>{
  let count=0;await assert.rejects(()=>collector.collectBlsDesk({now:new Date('2026-11-01'),pause:async()=>{},fetchImpl:async(url,options)=>{
    const codes=JSON.parse(options.body).seriesid;const p=payload(codes);if(++count===2)p.Results.series.pop();return new Response(JSON.stringify(p));
  }}),/BLS|batch|missing|scope/i);
});

test('every native specialist code matches retained primary BLS metadata including seasonal scope and PRS duration/base year',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/bls-desk-metadata.json',import.meta.url),'utf8'));
  for(const item of Object.values(definitions.blsDeskDefinitions).filter(item=>item.nativeCode)){
    const official=fixture.metadata[item.code];assert.ok(official,`Missing official metadata: ${item.code}`);
    assert.equal(official.seasonal??official.seasonality_code,item.adjustment==='Not seasonally adjusted'?'U':'S',item.id);
    if(item.code.startsWith('PR')){
      assert.equal(official.sector_code,'8500');assert.equal(official.base_year,item.unit.startsWith('Index')?'2017':'-');
      assert.equal(official.duration_code,item.unit.startsWith('Index')?'3':item.unit==='Percent year over year'?'1':'2');
    }
    if(item.code.startsWith('CI'))assert.equal(official.periodicity_code,'I');
    if(item.code.startsWith('CE'))assert.equal(official.data_type_code,item.unit==='Thousands of jobs'?'01':item.unit==='USD per hour'?(item.id==='productionHourlyEarnings'?'08':'03'):item.unit==='Hours per week'?'07':item.id==='productionWeeklyEarnings'?'30':'11');
  }
});

test('actual official response excerpts preserve September payroll reconciliation and independent PRS index/annual observations',async()=>{
  const fixture=JSON.parse(await readFile(new URL('./fixtures/bls-desk-response.json',import.meta.url),'utf8')),raw={};
  for(const batch of fixture.batches)Object.assign(raw,collector.parseBlsDeskBatch(batch.payload,batch.receipt.requestedSeries));
  const series=schema.buildBlsDeskSeries(raw);
  assert.equal(series.payrollDeskTotalLevel.observations.at(-1).value,159044);
  assert.equal(series.payrollDeskTotalLevel.observations.at(-1).date,'2026-09-01');
  assert.equal(series.payrollSupersectorResidual.observations.at(-1).value,0);
  assert.equal(series.productivityIndex.observations.at(-1).value,120.017);
  assert.equal(series.productivityAnnual.observations.at(-1).value,2.2);
  assert.equal(series.unitLaborCostIndex.observations.at(-1).value,123.979);
  assert.equal(series.eciCivilianCompensationSa.observations.at(-1).date,'2026-07-01');
  assert.deepEqual(series.hourlyEarnings.observations.at(-1).footnotes,['preliminary']);
});
