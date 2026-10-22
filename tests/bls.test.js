import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBls, collectBls, BLS_IDS } from '../scripts/sources/bls.mjs';

const raw = {
  LNS14000000:[4,4.2], CES0000000001:[159000,159120], CUUR0000SA0:[300,306],
  LNS11300000:[62,62.1], CES0500000003:[30,31.2], JTS000000000000000JOL:[7000,7100],
  CUUR0000SA0L1E:[250,260], CUSR0000SA0:[300,303], CUSR0000SA0L1E:[250,252.5],
  LNS13327709:[7.5,8], LNS12300000:[60,60.1], CES0500000002:[34.2,34.3],
};

function payload(overrides={}) {
  return {status:'REQUEST_SUCCEEDED',message:[],Results:{series:Object.entries(raw).map(([seriesID,values])=>({seriesID,data:[
    {year:'2025',period:'M01',value:String(values[0]),footnotes:[]},
    {year:'2026',period:'M01',value:String(values[1]),footnotes:[{code:'P',text:'preliminary'}]},
    {year:'2025',period:'M12',value:String(values[0]),footnotes:[]},
    {year:'2025',period:'M13',value:'999',footnotes:[]},
  ]})),...overrides}};
}

test('BLS parses levels, exact-year changes, payroll differences and openings units', () => {
  const result=parseBls(payload());
  assert.equal(result.unrate.observations.at(-1).value,4.2);
  assert.equal(result.payroll.observations.at(-1).value,120);
  assert.ok(Math.abs(result.cpi.observations.at(-1).value-2)<1e-9);
  assert.ok(Math.abs(result.wages.observations.at(-1).value-4)<1e-9);
  assert.equal(result.openings.observations.at(-1).value,7.1);
  assert.equal(result.unrate.observations.at(-1).publishedAt,null);
  assert.match(result.wages.observations.at(-1).footnotes.join(' '),/preliminary/);
  assert.ok(result.cpi.observations.every(o=>o.date.endsWith('-01')));
});

test('BLS missing months never become adjacent-month payroll changes or invented annual rates', () => {
  const p=payload();
  p.Results.series.find(s=>s.seriesID===BLS_IDS.payroll).data=p.Results.series.find(s=>s.seriesID===BLS_IDS.payroll).data.filter(o=>o.period!=='M12');
  p.Results.series.find(s=>s.seriesID===BLS_IDS.cpi).data=p.Results.series.find(s=>s.seriesID===BLS_IDS.cpi).data.filter(o=>!(o.year==='2025'&&o.period==='M01'));
  const result=parseBls(p);
  assert.equal(result.payroll.observations.at(-1).value,null);
  assert.equal(result.cpi.observations.at(-1).value,null);
});

test('BLS rejects API failure, missing required series, duplicates and invalid observations', () => {
  assert.throws(()=>parseBls({status:'REQUEST_FAILED',message:['quota']}),/quota|failed/i);
  const p=payload();p.Results.series=p.Results.series.filter(s=>s.seriesID!=='JTS000000000000000JOL');assert.throws(()=>parseBls(p),/missing|openings/i);
  const duplicate=payload();duplicate.Results.series[0].data.push({...duplicate.Results.series[0].data[0]});
  assert.throws(()=>parseBls(duplicate),/duplicate/i);
  const invalid=payload();invalid.Results.series[0].data[0].value='oops';
  assert.throws(()=>parseBls(invalid),/invalid|numeric/i);
});

test('the admitted family maps eleven additions to the exact reviewed official BLS identifiers',()=>{
  assert.deepEqual(BLS_IDS,{
    unrate:'LNS14000000',payroll:'CES0000000001',cpi:'CUUR0000SA0',participation:'LNS11300000',wages:'CES0500000003',openings:'JTS000000000000000JOL',
    cpiIndex:'CUUR0000SA0',cpiCoreIndex:'CUUR0000SA0L1E',cpiSaIndex:'CUSR0000SA0',cpiCoreSaIndex:'CUSR0000SA0L1E',
    cpiCore:'CUUR0000SA0L1E',cpiMonthly:'CUSR0000SA0',cpiCoreMonthly:'CUSR0000SA0L1E',
    payrollLevel:'CES0000000001',underemployment:'LNS13327709',employmentPopulation:'LNS12300000',weeklyHours:'CES0500000002',
  });
});

test('CPI families keep official index levels and exact NSA annual versus SA monthly growth inputs separate',()=>{
  const parsed=parseBls(payload());
  for(const [id,want] of [['cpiIndex',306],['cpiCoreIndex',260],['cpiSaIndex',303],['cpiCoreSaIndex',252.5]]){
    assert.equal(parsed[id]?.observations.at(-1).value,want,id);
    assert.equal(parsed[id].observationType,'official');
    assert.match(parsed[id].measure,/1982.?84.*100/);
    assert.equal(parsed[id].observations.at(-1).publishedAt,null);
    assert.equal(Object.hasOwn(parsed[id].observations.at(-1),'baseValue'),false);
  }
  for(const [id,want,baseDate,baseValue] of [
    ['cpiCore',4,'2025-01-01','250'],['cpiMonthly',1,'2025-12-01','300'],['cpiCoreMonthly',1,'2025-12-01','250'],
  ]){
    const result=parsed[id],last=result?.observations.at(-1);
    assert.ok(Math.abs(last?.value-want)<1e-9,id);
    assert.equal(last.baseDate,baseDate);assert.equal(last.baseValue,baseValue);
    assert.equal(last.sourceValue,String(raw[BLS_IDS[id]][1]));
    assert.equal(result.observationType,'calculated');
    assert.deepEqual(last.footnotes,['preliminary']);
    assert.match(result.calculation,id==='cpiCore'?/year-ago/:/previous.*month/);
  }
  assert.notEqual(parsed.cpiIndex.observations,parsed.cpi.observations);
  assert.equal(parsed.cpiIndex.observations.at(-1).value,306);
  assert.ok(Math.abs(parsed.cpi.observations.at(-1).value-2)<1e-9,'existing headline YoY formula remains unchanged');
});

test('labor family returns total nonfarm job levels, U-6, employment-population and paid weekly hours without rescaling',()=>{
  const parsed=parseBls(payload());
  for(const [id,want] of [['payrollLevel',159120],['underemployment',8],['employmentPopulation',60.1],['weeklyHours',34.3]]){
    assert.equal(parsed[id]?.observations.at(-1).value,want,id);
    assert.equal(parsed[id].observationType,'official');
    assert.equal(parsed[id].observations.at(-1).sourceValue,String(want));
  }
  assert.match(parsed.payrollLevel.measure,/thousands.*jobs/i);
  assert.match(parsed.weeklyHours.measure,/paid.*hours|hours.*paid/i);
  assert.match(parsed.underemployment.measure,/U-6/);
  assert.equal(parsed.payroll.observations.at(-1).value,120,'original payroll remains an exact preceding-month change');
});

test('new growth observations never cross missing exact calendar baselines or divide by zero',()=>{
  for(const id of ['cpiCore','cpiMonthly','cpiCoreMonthly']){
    for(const kind of ['missing','suppressed','zero']){
      const p=payload(),source=p.Results.series.find(s=>s.seriesID===BLS_IDS[id]);
      const baseline=source?.data.find(o=>o.year==='2025'&&o.period===(id==='cpiCore'?'M01':'M12'));
      assert.ok(baseline,'test uses an independently specified exact baseline');
      if(kind==='missing')source.data=source.data.filter(o=>o!==baseline);
      else baseline.value=kind==='zero'?'0':'-';
      const last=parseBls(p)[id].observations.at(-1);
      assert.equal(last.value,null,`${id} ${kind}`);
      assert.equal(last.baseDate,kind==='missing'?null:id==='cpiCore'?'2025-01-01':'2025-12-01');
    }
  }
});

test('missing or ambiguous required raw series reject the complete family rather than publishing a partial update',()=>{
  for(const code of ['CUUR0000SA0L1E','CUSR0000SA0','CUSR0000SA0L1E','LNS13327709','LNS12300000','CES0500000002']){
    const p=payload();p.Results.series=p.Results.series.filter(s=>s.seriesID!==code);
    assert.throws(()=>parseBls(p),/missing/i,code);
  }
  const duplicate=payload();duplicate.Results.series.push(structuredClone(duplicate.Results.series[0]));
  assert.throws(()=>parseBls(duplicate),/duplicate.*series/i);
  const overflow=payload();overflow.Results.series[0].data[0].value='9'.repeat(400);
  assert.throws(()=>parseBls(overflow),/invalid|finite/i);
});

test('collector requests twelve unique keyless series once across ten calendar years and filters future dates',async()=>{
  let captured;
  const p=payload();
  p.Results.series.forEach(s=>s.data.push({year:'2027',period:'M01',value:'999',footnotes:[]}));
  const result=await collectBls({now:new Date('2026-10-22T00:00:00Z'),fetchImpl:async(url,options)=>{
    captured={url,options,body:JSON.parse(options.body)};
    return new Response(JSON.stringify(p),{status:200,headers:{'content-type':'application/json'}});
  }});
  assert.equal(captured.url,'https://api.bls.gov/publicAPI/v1/timeseries/data/');
  assert.equal(captured.options.method,'POST');
  assert.deepEqual([...captured.body.seriesid].sort(),Object.keys(raw).sort());
  assert.equal(captured.body.startyear,'2017');assert.equal(captured.body.endyear,'2026');
  assert.equal(Object.hasOwn(captured.body,'registrationkey'),false);
  assert.equal(Object.keys(result.series).length,17);
  assert.equal(result.provenance.length,1);assert.match(result.provenance[0].sha256,/^[a-f0-9]{64}$/);
  assert.ok(Object.values(result.series).every(s=>s.observations.every(o=>o.date<='2026-10-22')));
});

test('collector retains ten calendar years and derives exact-year changes before applying its retention limit',async()=>{
  const p=payload();
  for(const source of p.Results.series)source.data=Array.from({length:132},(_,i)=>({year:String(2016+Math.floor(i/12)),period:`M${String(i%12+1).padStart(2,'0')}`,value:String(i+100),footnotes:[]}));
  const result=await collectBls({now:new Date('2026-12-31T00:00:00Z'),fetchImpl:async()=>new Response(JSON.stringify(p),{status:200})});
  assert.equal(result.series.cpiCoreIndex.observations.length,120);
  assert.equal(result.series.cpiCoreIndex.observations[0].date,'2017-01-01');
  assert.ok(Math.abs(result.series.cpiCore.observations[0].value-12)<1e-9);
  assert.equal(result.series.cpiCore.observations[0].baseDate,'2016-01-01');
  assert.equal(result.series.payrollLevel.observations.at(-1).value,231);
});
