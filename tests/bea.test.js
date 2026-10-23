import test from 'node:test';
import assert from 'node:assert/strict';

let adapter;
try {
  adapter = await import('../scripts/sources/bea.mjs');
} catch (error) {
  if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('bea.mjs')) throw error;
}

function bea() {
  assert.ok(adapter, 'The official BEA source adapter must exist');
  return adapter;
}

const header = '%SeriesCode,Period,Value\r\n';

test('BEA GDP parser preserves published annualized quarterly growth and sorts period starts', () => {
  const text = '\uFEFF' + header
    + 'A191RL,2026Q2,"2.2"\r\n'
    + 'A191RL,2026Q1,"2.5"\r\n'
    + 'A191RL,2025,"2.1"\r\n'
    + 'DPCERG,2026Q2,"131.006"\r\n';
  assert.deepEqual(bea().parseBea(text, 'A191RL', 'quarterly'), [
    { date: '2026-01-01', value: 2.5, publishedAt: null, sourceValue: '2.5' },
    { date: '2026-04-01', value: 2.2, publishedAt: null, sourceValue: '2.2' },
  ]);
});

test('BEA parser selects the exact PCE index series and preserves zero, missing data and quoted commas', () => {
  const text = header + 'DPCERGM,2026M08,"0.3"\n'
    + 'DPCERG,2026M08,"1,131.579"\n'
    + 'DPCERG,2026M07,"0"\n'
    + 'DPCERG,2026M06,"(NA)"\n'
    + 'DPCERG,2026Q2,"131.006"\n';
  assert.deepEqual(bea().parseBea(text, 'DPCERG', 'M'), [
    { date: '2026-06-01', value: null, publishedAt: null, sourceValue: '(NA)' },
    { date: '2026-07-01', value: 0, publishedAt: null, sourceValue: '0' },
    { date: '2026-08-01', value: 1131.579, publishedAt: null, sourceValue: '1,131.579' },
  ]);
});

test('BEA parser rejects HTML200, unknown headers and a missing target series', () => {
  const { parseBea } = bea();
  for (const text of ['<html>File not found</html>', 'Series,Date,Rate\nA191RL,2026Q2,2.2', header + 'DPCERG,2026M08,131.579']) {
    assert.throws(() => parseBea(text, 'A191RL', 'Q'), /BEA|header|missing|series/i);
  }
});

test('BEA parser rejects duplicate periods, invalid periods and malformed numbers', () => {
  const { parseBea } = bea();
  for (const text of [
    header + 'A191RL,2026Q2,2.2\nA191RL,2026Q2,2.2',
    header + 'A191RL,2026Q5,2.2',
    header + 'A191RL,2026Q2,2.2garbage',
    header + 'A191RL,2026Q2,"1,2.2"',
  ]) {
    assert.throws(() => parseBea(text, 'A191RL', 'Q'), /duplicate|period|numeric|invalid/i);
  }
  assert.throws(() => parseBea(header + 'DPCERG,2026M13,1', 'DPCERG', 'M'), /period|invalid/i);
});

const companions='DPCCRG,2026M08,130.455\nDPCERGM,2026M08,0.3\nDPCCRGM,2026M08,0.2\nDPCERX,2026M08,"16,955,276"\nDPCERAM,2026M08,0.6\nA067RX,2026M08,"18,410,473"\nA067RM,2026M08,0.0\n';
const depthQuarterly=['A191RC','LB000003','PB000003','A261RC','A261RL','A008RL','A011RL','A009RL','Y033RL','Y001RL','B020RC','B021RC','A019RC'].map(code=>`${code},2026Q2,1000`).join('\n');
function fixtureFetch({ quarterly = header + 'A191RL,2026Q2,"2.2"\nA191RL,2027Q1,"9.9"', monthly, familyDefaults=true } = {}) {
  return async url => {
    if (url === 'https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt') {
      return new Response(quarterly+'\n'+depthQuarterly, { headers: { 'content-type': 'text/plain', 'last-modified': 'Wed, 30 Sep 2026 12:30:00 GMT' } });
    }
    if (url === 'https://apps.bea.gov/national/Release/TXT/NipaDataM.txt') {
      return new Response(monthly+(familyDefaults?'\n'+companions:'')+'\nA072RC,2026M08,4', { headers: { 'content-type': 'text/plain' } });
    }
    throw new Error(`Unexpected official BEA URL ${url}`);
  };
}

test('BEA collector calculates exact year-ago PCE inflation and retains both source indexes', async () => {
  const monthly = header + 'DPCERG,2025M08,"127.229"\nDPCERG,2026M08,"131.579"';
  const result = await bea().collectBea({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch({ monthly }) });
  const last = result.series.pce.observations.at(-1);
  assert.ok(Math.abs(last.value - 3.419031824505425) < 1e-10);
  assert.equal(last.sourceValue, '131.579');
  assert.equal(last.yearAgoSourceValue, '127.229');
  assert.equal(last.publishedAt, null);
  assert.equal(result.series.pce.observations[0].value, null);
  assert.equal(result.series.gdp.observations.at(-1).value, 2.2);
  assert.equal(result.id, 'bea');
  assert.equal(result.fetchedAt, result.provenance.map(source=>source.retrievedAt).sort().at(-1));
  assert.equal(result.series.pce.dataStatus, 'official');
  assert.deepEqual(result.series.gdp.sourceIds, ['A191RL']);
  assert.deepEqual(result.series.pce.sourceIds, ['DPCERG']);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.provenance.length, 2);
  assert.ok(result.provenance.every(row => !('text' in row) && /^[a-f\d]{64}$/.test(row.sha256)));
});

test('PCE annual inflation stays missing when the exact calendar comparison is unavailable or zero', async () => {
  const monthly = header + 'DPCERG,2025M07,"127"\nDPCERG,2025M09,"0"\n'
    + 'DPCERG,2025M10,"(NA)"\nDPCERG,2026M08,"131.579"\n'
    + 'DPCERG,2026M09,"132"\nDPCERG,2026M10,"133"';
  const result = await bea().collectBea({ now: new Date('2026-10-21T12:00:00Z'), fetchImpl: fixtureFetch({ monthly }) });
  assert.deepEqual(result.series.pce.observations.slice(-3).map(row => row.value), [null, null, null]);
  assert.deepEqual(result.series.pce.observations.slice(-3).map(row => row.date), ['2026-08-01', '2026-09-01', '2026-10-01']);
});

test('collector filters future periods after calculating exact full-history annual inflation', async () => {
  const monthly = header + Array.from({ length: 60 }, (_, index) => {
    const year = 2022 + Math.floor(index / 12);
    const month = String(index % 12 + 1).padStart(2, '0');
    return `DPCERG,${year}M${month},"${100 + index}"`;
  }).join('\n');
  const result = await bea().collectBea({ now: new Date('2026-08-21T12:00:00Z'), fetchImpl: fixtureFetch({ monthly }) });
  assert.equal(result.series.pce.observations.length, 56);
  assert.equal(result.series.pce.observations[0].date, '2022-01-01');
  assert.equal(result.series.pce.observations[0].value,null,'the earliest retained year stays missing without its exact annual baseline');
  assert.equal(result.series.pce.observations.at(-1).date, '2026-08-01');
  assert.equal(result.series.pce.observations.at(-1).sourceValue, '155');
  assert.equal(result.series.pce.observations.at(-1).yearAgoSourceValue, '143');
  assert.deepEqual(result.series.gdp.observations.map(row => row.date), ['2026-04-01']);
});

test('BEA collector propagates upstream failure rather than supplying sample values', async () => {
  await assert.rejects(bea().collectBea({ fetchImpl: async () => new Response('Unavailable', { status: 503 }) }), /503|HTTP|request/i);
});

test('BEA coherent family preserves published monthly rates, exact core annual changes and annualized real-dollar scale',async()=>{
 const monthly=header+'DPCERG,2025M08,125\nDPCERG,2026M08,131.579\nDPCCRG,2025M08,125\n'+companions;
 const result=await bea().collectBea({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:fixtureFetch({monthly,familyDefaults:false})});
 assert.equal(Object.keys(result.series).length,25);
 assert.equal(result.series.pceIndex.observations.at(-1).value,131.579);
 assert.equal(result.series.pceCoreIndex.observations.at(-1).value,130.455);
 assert.ok(Math.abs(result.series.pceCore.observations.at(-1).value-4.364)<1e-10);
 assert.equal(result.series.pceCore.observationType,'calculated');
 for(const [id,expected] of [['pceMonthly',.3],['pceCoreMonthly',.2],['realSpendingMonthly',.6],['realDisposableIncomeMonthly',0]]){
  assert.equal(result.series[id].observations.at(-1).value,expected);
  assert.equal(result.series[id].observationType,'official');
  assert.match(result.series[id].calculation,/published.*not annualized/i);
 }
 assert.equal(result.series.realSpending.observations.at(-1).value,16955.276);
 assert.equal(result.series.realDisposableIncome.observations.at(-1).value,18410.473);
 assert.equal(result.series.realSpending.observations.at(-1).sourceValue,'16,955,276');
 assert.match(result.series.realSpending.calculation,/1000.*annual/i);
 assert.ok(result.series.pceCore.observations.every(o=>o.publishedAt===null));
});

test('BEA new family rejects missing required series and keeps missing or zero core annual baselines unavailable',async()=>{
 const complete=header+'DPCERG,2026M08,131.579\n'+companions;
 await assert.rejects(bea().collectBea({fetchImpl:fixtureFetch({monthly:complete.replace('DPCCRGM,2026M08,0.2\n',''),familyDefaults:false})}),/missing.*DPCCRGM/i);
 const monthly=header+'DPCERG,2026M08,131.579\nDPCCRG,2025M08,0\nDPCCRG,2025M09,(NA)\nDPCCRG,2026M09,131\n'+companions;
 const result=await bea().collectBea({now:new Date('2026-10-21T12:00:00Z'),fetchImpl:fixtureFetch({monthly,familyDefaults:false})});
 assert.deepEqual(result.series.pceCore.observations.slice(-2).map(o=>o.value),[null,null]);
});

test('BEA batch parser selects all reviewed series in one pass with independent duplicate and missing checks',()=>{
 assert.equal(typeof bea().parseBeaBatch,'function');
 const result=bea().parseBeaBatch(header+'DPCERG,2026M08,131.579\nDPCCRG,2026M08,130.455',['DPCERG','DPCCRG'],'M');
 assert.equal(result.DPCERG[0].value,131.579);assert.equal(result.DPCCRG[0].value,130.455);
 assert.throws(()=>bea().parseBeaBatch(header+'DPCERG,2026M08,131',['DPCERG','DPCCRG'],'M'),/missing.*DPCCRG/i);
 assert.throws(()=>bea().parseBeaBatch(header+'DPCERG,2026M08,131\nDPCERG,2026M08,132',['DPCERG'],'M'),/duplicate/i);
});

test('BEA backfill retains all GDP and independent monthly histories without losing early baselines or inventing months',async()=>{
 const quarterly=header+Array.from({length:80},(_,i)=>`A191RL,${1990+Math.floor(i/4)}Q${i%4+1},${i/10}`).join('\n');
 const monthlyRows=[];
 for(let i=0;i<180;i++){
  const period=`${2000+Math.floor(i/12)}M${String(i%12+1).padStart(2,'0')}`;
  for(const [code,value]of [['DPCERG',100+i],['DPCCRG',200+i],['DPCERGM',.1],['DPCCRGM',.2],['DPCERX',1000000+i*1000],['DPCERAM',.3],['A067RX',2000000+i*1000],['A067RM',.4]]){
   if(code==='DPCERX'&&i<84||code==='DPCERG'&&i===13)continue;
   monthlyRows.push(`${code},${period},${value}`);
  }
 }
 const result=await bea().collectBea({now:new Date('2026-10-22T15:00:00Z'),fetchImpl:fixtureFetch({quarterly,monthly:header+monthlyRows.join('\n'),familyDefaults:false})});
 assert.equal(result.series.gdp.observations.length,80);assert.equal(result.series.gdp.observations[0].date,'1990-01-01');
 assert.equal(result.series.pceIndex.observations.length,179);assert.equal(result.series.pce.observations[0].date,'2000-01-01');
 assert.equal(result.series.pceCoreIndex.observations.length,180);assert.equal(result.series.realDisposableIncome.observations.length,180);
 assert.equal(result.series.realSpending.observations.length,96);assert.equal(result.series.realSpending.observations[0].date,'2007-01-01');
 assert.equal(result.series.realSpending.observations[0].value,1084);assert.equal(result.series.realSpending.observations[0].sourceValue,'1084000');
 assert.ok(result.series.pce.observations.slice(0,12).every(o=>o.value===null));
 assert.ok(Math.abs(result.series.pce.observations.find(o=>o.date==='2001-01-01').value-12)<1e-10);
 assert.equal(result.series.pce.observations.find(o=>o.date==='2002-02-01').value,null,'missing exact year-ago month stays unavailable');
 assert.ok(!result.series.pce.observations.some(o=>o.date==='2001-02-01'),'the source gap is not filled');
 assert.equal(result.series.pceMonthly.observations[0].value,.1);assert.equal(result.series.realSpendingMonthly.observations[0].date,'2000-01-01');
 assert.ok(Object.values(result.series).every(s=>s.observations.every(o=>o.publishedAt===null)));
});
