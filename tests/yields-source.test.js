import test from 'node:test';
import assert from 'node:assert/strict';

let adapter;
try { adapter = await import('../scripts/sources/yields.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('yields.mjs')) throw error; }
const yields = () => { assert.ok(adapter, 'The historical Treasury yields adapter must exist'); return adapter; };
const nominal = 'Date,"3 Mo","2 Yr","5 Yr","10 Yr","30 Yr"\n10/21/2026,4.25,4.81,4.95,5.13,5.42\n10/20/2026,4.26,4.79,4.94,,5.42\n';
const real = 'Date,"5 YR","7 YR","10 YR","20 YR","30 YR"\n10/21/2026,2.55,2.65,2.76,3.01,3.15\n10/19/2026,2.56,2.67,2.80,3.06,3.21\n';

test('par-curve parser sorts exact dates and retains signed yields, zero and missing tenors', () => {
  const rows = yields().parseParYieldCsv('\uFEFFDate,"1.5 Month","2 Yr","10 Yr"\r\n10/21/2026,0,4.81,N/A\r\n10/20/2026,,4.79,-0.02\r\n', 'nominal');
  assert.deepEqual(rows.map(row => row.date), ['2026-10-20', '2026-10-21']);
  assert.equal(rows[0].rates['10Y'], -0.02);
  assert.equal(rows[1].rates['1.5M'], 0);
  assert.equal(rows[1].rates['10Y'], null);
  assert.equal(rows[1].rates['3M'], null);
  assert.equal(yields().parseParYieldCsv(real, 'real')[1].rates['10Y'], 2.76);
});

test('curve parser rejects duplicate dates and headers, impossible dates, malformed rows and unknown numbers', () => {
  for (const csv of [
    'Date,"10 Yr"\n10/21/2026,4\n10/21/2026,4\n',
    'Date,"10 Yr","10 YR"\n10/21/2026,4,4\n',
    'Date,"1.5 Month","1.5 Mo","10 Yr"\n10/21/2026,4,4,4\n',
    'Date,"10 Yr"\n02/30/2026,4\n',
    'Date,"10 Yr"\n10/21/2026,4,5\n',
    'Date,"10 Yr"\n10/21/2026,oops\n',
    '<html>Access denied</html>',
  ]) assert.throws(() => yields().parseParYieldCsv(csv, 'nominal'), /Treasury|curve|duplicate|date|number|row|header/i);
  assert.throws(() => yields().parseParYieldCsv(real, 'spot'), /kind/i);
});

test('curve parser rejects nominal data labeled real and real data labeled nominal without filling missing tenors',()=>{
  assert.throws(()=>yields().parseParYieldCsv(nominal,'real'),/kind|nominal|real|header/i);
  assert.throws(()=>yields().parseParYieldCsv(real,'nominal'),/kind|nominal|real|header/i);
  assert.deepEqual(yields().parseParYieldCsv('Date,"10 Yr"\n','nominal'),[], 'An empty current-year response remains valid before the first publication');
  const partial=yields().parseParYieldCsv('Date,"2 Yr","10 Yr"\n10/21/2026,4.81,5.13\n','nominal');
  assert.equal(partial[0].rates['3M'],null);
  assert.equal(partial[0].rates['10Y'],5.13);
  const fullNominal='Date,"1 Mo","1.5 Month","2 Mo","3 Mo","4 Mo","6 Mo","1 Yr","2 Yr","3 Yr","5 Yr","7 Yr","10 Yr","20 Yr","30 Yr"\n10/21/2026,4,4,4,4,4,4,4,4,4,4,4,4,4,4\n';
  assert.equal(yields().parseParYieldCsv(fullNominal,'nominal')[0].rates['10Y'],4);
  assert.equal(yields().parseParYieldCsv(real,'real').at(-1).rates['10Y'],2.76);
});

test('dated curves join by exact date; unmatched dates never borrow nominal or real observations', () => {
  const history = yields().joinParCurves(yields().parseParYieldCsv(nominal, 'nominal'), yields().parseParYieldCsv(real, 'real'));
  assert.deepEqual(history.map(row => row.date), ['2026-10-19', '2026-10-20', '2026-10-21']);
  assert.equal(history[0].nominal['10Y'], null);
  assert.equal(history[1].real['10Y'], null);
  assert.equal(history[2].nominal['10Y'], 5.13);
  assert.equal(history[2].real['10Y'], 2.76);
  assert.throws(() => yields().joinParCurves([...yields().parseParYieldCsv(nominal, 'nominal'), ...yields().parseParYieldCsv(nominal, 'nominal')], []), /duplicate/i);
});

function fixtureFetch(calls, overrides = {}) {
  return async (url) => {
    calls.push(url);
    const target = new URL(url), year = Number(target.searchParams.get('field_tdr_date_value'));
    const kind = target.searchParams.get('type') === 'daily_treasury_real_yield_curve' ? 'real' : 'nominal';
    const key = `${kind}-${year}`;
    const text = overrides[key] ?? (year === 2026 ? kind === 'real' ? real : nominal : kind === 'real'
      ? `Date,"10 YR"\n12/31/${year},1.5\n` : `Date,"3 Mo","2 Yr","10 Yr"\n12/31/${year},3.2,3.8,4.2\n`);
    return new Response(text, {headers:{'content-type':'text/csv','last-modified':'Wed, 21 Oct 2026 22:00:00 GMT'}});
  };
}

test('collector retains paired curves from 2003 with annual provenance and correct calculated/official series', async () => {
  const calls = [];
  const result = await yields().collectYields({fetchImpl:fixtureFetch(calls), now:new Date('2026-10-21T23:00:00Z')});
  assert.equal(result.id, 'yields');
  assert.equal(calls.length, 48);
  assert.deepEqual([...new Set(calls.map(url => Number(new URL(url).searchParams.get('field_tdr_date_value'))))].sort(), [2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026]);
  assert.equal(result.curveHistory.length, 26);
  assert.deepEqual(result.series.spread2s10s.sourceIds, ['BC_10YEAR','BC_2YEAR']);
  assert.equal(result.series.spread2s10s.observations.at(-1).value, 32);
  assert.equal(result.series.spread3m10y.observations.at(-1).value, 88);
  assert.equal(result.series.realYield10.observations.at(-1).value, 2.76);
  assert.equal(result.series.inflationComp10.observations.at(-1).value, 237);
  assert.equal(result.series.inflationComp10.observations.at(-2).value, null);
  assert.equal(result.series.inflationComp10.observationType, 'calculated');
  assert.equal(result.series.realYield10.observationType, 'official');
  assert.equal(result.series.nominalYield2.observations.at(-1).value, 4.81);
  assert.equal(result.series.nominalYield3m.observations.at(-1).value, 4.25);
  assert.ok(Object.values(result.series).every(series=>series.inputProvenanceScope==='observation-source-urls'));
  assert.ok(Object.values(result.series).every(series=>series.observations.every(row=>!Object.hasOwn(row,'inputProvenance'))));
  assert.ok(Object.values(result.series).every(series => series.observations.every(row => row.publishedAt === null)));
  assert.ok(result.provenance.every(row => !Object.hasOwn(row,'text') && /^[a-f\d]{64}$/.test(row.sha256)));
  assert.equal(result.fetchedAt, result.provenance.map(row => row.retrievedAt).sort().at(-1));
  assert.equal(result.coverageStart, '2003-12-31');
  assert.equal(result.coverageEnd, '2026-10-21');
  assert.equal(result.series.spread2s10s.observations[0].sourceUrl,yields().treasuryParYieldUrl(2003));
  assert.deepEqual(result.series.inflationComp10.observations[0].sourceUrls,[yields().treasuryParYieldUrl(2003),yields().treasuryParYieldUrl(2003,'real')]);
  assert.equal(result.series.realYield10.observations[0].sourceUrl,yields().treasuryParYieldUrl(2003,'real'));
  assert.ok(Object.values(result.series).every(series=>series.observations.every(row=>row.sourceUrls.every(url=>result.provenance.some(item=>item.url===url)))));
  assert.deepEqual(result.methodologyBreaks.map(({date})=>date),['2008-12-01','2021-12-06']);
  const tipsBreak=result.methodologyBreaks[0];
  assert.equal(tipsBreak.kind,'real');
  assert.equal(tipsBreak.from,'all-tips-securities');
  assert.equal(tipsBreak.to,'most-recently-auctioned-tips');
  assert.equal(tipsBreak.sourceUrl,'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_real_yield_curve');
});

test('historical captures preserve early missing tenors and signed values while bounding paired annual requests', async () => {
  const calls=[];
  const fetchFixture=fixtureFetch(calls,{
    'nominal-2003':'Date,"1 Mo","3 Mo","2 Yr","10 Yr","30 Yr"\n01/02/2003,0,1.22,1.8,4.07,N/A\n01/03/2003,0,1.22,1.82,4.05,N/A\n',
    'real-2003':'Date,"5 YR","7 YR","10 YR","20 YR","30 YR"\n01/02/2003,-0.1,1.5,2.43,N/A,N/A\n01/06/2003,-0.02,1.4,2.4,N/A,N/A\n',
  });
  let active=0,maximum=0;
  const result=await yields().collectYields({fetchImpl:async url=>{
    active++;maximum=Math.max(maximum,active);
    try { await new Promise(resolve=>setImmediate(resolve));return await fetchFixture(url); }
    finally { active--; }
  },now:new Date('2026-10-21T23:00:00Z')});
  assert.equal(maximum,2);
  assert.equal(result.coverageStart,'2003-01-02');
  assert.equal(result.curveHistory[0].nominal['1M'],0);
  assert.equal(result.curveHistory[0].nominal['30Y'],null);
  assert.equal(result.curveHistory[0].real['5Y'],-0.1);
  assert.equal(result.curveHistory[0].real['20Y'],null);
  assert.deepEqual(result.series.inflationComp10.observations.slice(0,3).map(({date,value})=>({date,value})),[
    {date:'2003-01-02',value:164},{date:'2003-01-03',value:null},{date:'2003-01-06',value:null},
  ]);
  assert.equal(result.series.spread2s10s.observations[0].value,227);
  assert.equal(result.series.spread3m10y.observations[0].value,285);
  for(let index=0;index<calls.length;index+=2){
    const pair=calls.slice(index,index+2).map(url=>new URL(url)),year=2003+index/2;
    assert.deepEqual(pair.map(url=>url.searchParams.get('type')),['daily_treasury_yield_curve','daily_treasury_real_yield_curve']);
    assert.ok(pair.every(url=>url.pathname===`/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/${year}/all`&&url.searchParams.get('field_tdr_date_value')===String(year)));
  }
});

test('collector rejects empty past-year feeds instead of silently dropping historical coverage', async () => {
  for(const kind of ['nominal','real'])await assert.rejects(yields().collectYields({fetchImpl:fixtureFetch([],{
    [`${kind}-2003`]:'Date,"10 Yr"\n',
  }),now:new Date('2026-10-21T23:00:00Z')}),/empty|2003|past.year/i);
});

test('collector rejects past-year feeds with no usable 10-year observations', async () => {
  for(const [kind,text] of [
    ['nominal','Date,"2 Yr","10 Yr"\n01/02/2003,1.8,N/A\n'],
    ['real','Date,"5 YR","10 YR"\n01/02/2003,1.4,N/A\n'],
  ])await assert.rejects(yields().collectYields({fetchImpl:fixtureFetch([],{[`${kind}-2003`]:text}),now:new Date('2026-10-21T23:00:00Z')}),/usable.*2003|2003.*usable/i);
});

test('collector cutoff is an observation filter, preserves missing dates and rejects responses from the wrong year', async () => {
  const result = await yields().collectYields({fetchImpl:fixtureFetch([]),now:new Date('2026-10-20T12:00:00Z')});
  assert.equal(result.curveHistory.at(-1).date, '2026-10-20');
  assert.equal(result.series.realYield10.observations.at(-1).value, null);
  await assert.rejects(yields().collectYields({fetchImpl:fixtureFetch([], {'real-2025':'Date,"10 YR"\n12/31/2024,1.5\n'}),now:new Date('2026-10-21T23:00:00Z')}), /year/i);
});

test('collector handles New Year before a current-year observation and fails closed on unusable or failed sources', async () => {
  const result = await yields().collectYields({fetchImpl:fixtureFetch([], {'nominal-2026':'Date,"10 Yr"\n','real-2026':'Date,"10 YR"\n'}),now:new Date('2026-01-01T12:00:00Z')});
  assert.equal(result.curveHistory.at(-1).date,'2025-12-31');
  await assert.rejects(yields().collectYields({fetchImpl:async () => new Response('Forbidden',{status:403}),now:new Date('2026-10-21T23:00:00Z')}), /403/);
  await assert.rejects(yields().collectYields({fetchImpl:async url => new Response(new URL(url).searchParams.get('type').includes('real') ? 'Date,"10 YR"\n' : nominal),now:new Date('2026-10-21T23:00:00Z')}), /year|usable|real/i);
  await assert.rejects(yields().collectYields({now:new Date('invalid')}), /date/i);
});
