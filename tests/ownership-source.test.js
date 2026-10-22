import test from 'node:test';
import assert from 'node:assert/strict';
import { zipFixture } from './helpers/zip.mjs';
let adapter;
try { adapter = await import('../scripts/sources/ownership.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('ownership.mjs')) throw error; }
const api = () => { assert.ok(adapter, 'The reviewed official ownership connector must exist'); return adapter; };
const now = new Date('2026-10-21T12:00:00Z');
const codes = ['LM153061105.Q','LM103061103.Q','LM113061003.Q','LM213061103.Q','LM713061103.Q','LM763061100.Q','LM753061103.Q','LM743061103.Q','LM473061105.Q','LM513061105.Q','LM543061105.Q','LM573061105.Q','LM343061105.Q','LM223061143.Q','FL633061105.Q','LM653061105.Q','LM553061103.Q','LM563061103.Q','LM623061103.Q','LM403061105.Q','FL673061103.Q','LM663061105.Q','LM733061103.Q','FL503061123.Q','LM263061105.Q'];
const allCodes = ['FL313161105.Q','FL893061105.Q','LM903061103.Q',...codes];
function csv({periods=['2026:Q1','2026:Q2'], change=100, missing=null}={}) {
  return [ ['date',...allCodes].join(','), ...periods.map((period,index) => [period, 2600 + index*change*25, 2500 + index*change*25, 100, ...codes.map(code => code===missing?'ND':100 + index*change)].join(',')) ].join('\n');
}
function dictionary() {
  return allCodes.map(code => `${code}\t${code==='LM713061103.Q'?'Central bank; total Treasury securities; asset':code==='LM263061105.Q'?'Rest of the world; Treasury securities; asset':`${code}; Treasury securities`}\tLine 1\tF3.2.s Treasury securities\tMillions of dollars; amounts outstanding end of period, ${code.startsWith('LM')?'market value, ':''}not seasonally adjusted`).join('\n');
}
const soma = () => ({soma:{summary:[
  {asOfDate:'2026-10-07',bills:'100000000000',notesbonds:'200000000000',tips:'30000000000',frn:'10000000000',tipsInflationCompensation:'5000000000',mbs:'999999999999',agencies:'8888888888',total:'1348888888887'},
  {asOfDate:'2026-10-14',bills:'110000000000',notesbonds:'200000000000',tips:'30000000000',frn:'10000000000',tipsInflationCompensation:'6000000000',mbs:'999999999999',agencies:'8888888888',total:'1358888888887'},
]}});
function fixtures({z1csv=csv(),dict=dictionary(),somaData=soma(),page='<h2>Release Date: September 11, 2026 2026:Q2 Release</h2>',calls=[]}={}) {
  return async url => {
    calls.push(url);
    if (url===api().Z1_URL) return new Response(zipFixture([{name:'csv/F3_2_s.csv',text:z1csv},{name:'data_dictionary/F3_2_s.txt',text:dict}]));
    if (url===api().Z1_RELEASE_URL) return new Response(page);
    if (url===api().SOMA_URL) return new Response(JSON.stringify(somaData));
    throw new Error(`Unexpected official ownership URL ${url}`);
  };
}

test('Z1 resolves reviewed series by code and verifies dictionary units, sector totals and valuation differences', () => {
  const parsed = api().parseZ1Ownership(csv(),dictionary(),{now});
  assert.equal(parsed.asOf,'2026-06-30');
  assert.equal(parsed.history.length,2);
  assert.equal(parsed.sectors.length,25);
  assert.equal(parsed.assets,5);
  assert.equal(parsed.liabilities,5.1);
  assert.equal(parsed.valuationDiscrepancy,0.1);
  assert.equal(parsed.sectors.find(row=>row.code==='LM713061103.Q').value,0.2);
  assert.equal(parsed.sectors.find(row=>row.code==='LM713061103.Q').valuation,'market value');
  assert.match(parsed.sectors.find(row=>row.code==='FL633061105.Q').valuation,/reported.*basis/i);
});

test('Z1 missing values remain missing and do not produce an invented complete reconciliation', () => {
  const parsed = api().parseZ1Ownership(csv({missing:codes[0]}),dictionary(),{now});
  assert.equal(parsed.sectors.find(row=>row.code===codes[0]).value,null);
  assert.equal(parsed.reconciled,false);
  assert.ok(parsed.warnings.some(text=>/missing|incomplete/i.test(text)));
});

test('Z1 rejects wrong units/identities, duplicate quarters, malformed data and conflicting reconciliation', () => {
  for(const [data,dict] of [
    [csv(),dictionary().replace('Millions of dollars','Billions of dollars')],
    [csv(),dictionary().replace('LM713061103.Q','LM713061103.A')],
    [csv({periods:['2026:Q2','2026:Q2']}),dictionary()],
    [csv().replace('2026:Q2','2026:Q5'),dictionary()],
    [csv().replace('2026:Q2,5100','2026:Q2,9999'),dictionary()],
    [csv().replace('date,','unexpected,'),dictionary()],
  ]) assert.throws(()=>api().parseZ1Ownership(data,dict,{now}),/ownership|Z1|Z.1|quarter|reconcil|dictionary/i);
});

test('SOMA sums only Treasury categories and separately identifies TIPS inflation compensation', () => {
  const parsed = api().parseSomaOwnership(soma(),{now});
  assert.equal(parsed.asOf,'2026-10-14');
  assert.equal(parsed.principal,350);
  assert.equal(parsed.inflationCompensation,6);
  assert.equal(parsed.adjustedPrincipal,356);
  assert.equal(parsed.history.length,2);
  assert.equal(parsed.history[0].adjustedPrincipal,345);
  assert.ok(!('cusip' in parsed));
});

test('SOMA refuses missing components, duplicate/invalid dates and manufactured zeros', () => {
  for(const alter of [
    data=>{data.soma.summary[0].frn='';},
    data=>{data.soma.summary[0].tipsInflationCompensation=null;},
    data=>{data.soma.summary[1].asOfDate='2026-10-07';},
    data=>{data.soma.summary[1].asOfDate='2026-02-30';},
    data=>{data.soma.summary[1].tips='oops';},
  ]){const data=soma();alter(data);assert.throws(()=>api().parseSomaOwnership(data,{now}),/SOMA|ownership|date|missing/i);}
});

test('SOMA retains explicitly published holiday exception dates instead of inventing Wednesday captures', () => {
  const data=soma();data.soma.summary[1].asOfDate='2026-10-13';
  const parsed=api().parseSomaOwnership(data,{now});
  assert.equal(parsed.asOf,'2026-10-13');
  assert.equal(parsed.history.at(-1).date,'2026-10-13');
  assert.ok(parsed.warnings.some(text=>/exception|Wednesday/i.test(text)));
});

test('ownership collector captures exact feed provenance and carries NYFed redistribution conditions in series metadata', async () => {
  const calls=[];
  const source=await api().collectOwnership({now,fetchImpl:fixtures({calls})});
  assert.equal(source.id,'ownership');
  assert.equal(source.series.foreignTreasuryHoldings.observations.at(-1).value,0.0002);
  assert.equal(source.series.fedTreasuryHoldings.observations.at(-1).value,0.0002);
  assert.equal(source.series.somaTreasuryHoldings.observations.at(-1).value,0.356);
  assert.equal(source.z1.releaseDate,'2026-09-11');
  assert.ok(source.series.fedTreasuryHoldings.observations.every(row=>row.publishedAt===null));
  assert.equal(source.series.somaTreasuryHoldings.dataStatus,'calculated');
  assert.match(source.series.somaTreasuryHoldings.attribution,/© 2026 Federal Reserve Bank of New York/);
  assert.equal(source.series.somaTreasuryHoldings.termsUrl,'https://www.newyorkfed.org/privacy/termsofuse.html');
  assert.match(source.series.somaTreasuryHoldings.redistributionNotice,/same permissions|same terms/i);
  assert.ok(source.provenance.every(row=>!('text'in row)&&!('bytes'in row)&&/^[a-f0-9]{64}$/.test(row.sha256)));
  assert.equal(source.provenance.length,3);
  assert.ok(source.limitations.some(text=>/TIC.*not.*ingest|TIC.*unavailable/i.test(text)));
  assert.equal(calls.length,3);
});

test('ownership fails atomically for upstream errors or mismatched Z1 release quarter', async () => {
  await assert.rejects(api().collectOwnership({now,fetchImpl:async()=>new Response('Unavailable',{status:503})}),/503/);
  await assert.rejects(api().collectOwnership({now,fetchImpl:fixtures({page:'Release Date: September 11, 2026 2026:Q1 Release'})}),/release|quarter|ownership/i);
});
