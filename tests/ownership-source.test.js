import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
const historicalPeriods = () => [...Array.from({length:7},(_,index)=>`${1945+index}:Q4`),...Array.from({length:40},(_,index)=>`${1952+Math.floor(index/4)}:Q${index%4+1}`)];
function replaceCell(text,period,code,value) {
  const [header,...rows]=text.split('\n').map(line=>line.split(','));
  rows.find(row=>row[0]===period)[header.indexOf(code)]=String(value);
  return [header,...rows].map(row=>row.join(',')).join('\n');
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

test('Z1 retains full native history with sparse annual-end observations and excludes future periods', () => {
  const periods=[...historicalPeriods(),'2027:Q1'];
  const parsed=api().parseZ1Ownership(csv({periods}),dictionary(),{now});
  assert.equal(parsed.history.length,47);
  assert.deepEqual(parsed.history.slice(0,8).map(row=>row.date),['1945-12-31','1946-12-31','1947-12-31','1948-12-31','1949-12-31','1950-12-31','1951-12-31','1952-03-31']);
  assert.equal(parsed.asOf,'1961-12-31');
  assert.ok(parsed.history.every(row=>row.reconciled));
  assert.equal(parsed.history[0].assets,2.5);
  assert.equal(parsed.history.at(-1).assets,117.5);
});

test('Z1 preserves older negative residuals, published zeros and missing values before the old retention window', () => {
  let text=csv({periods:historicalPeriods()});
  for(const [code,value]of [['LM153061105.Q',-50],['LM663061105.Q',0],['FL893061105.Q',2250],['FL313161105.Q',2350]])text=replaceCell(text,'1945:Q4',code,value);
  text=replaceCell(text,'1946:Q4','LM713061103.Q','ND');
  const parsed=api().parseZ1Ownership(text,dictionary(),{now});
  const first=parsed.history.find(row=>row.date==='1945-12-31'),missing=parsed.history.find(row=>row.date==='1946-12-31');
  assert.equal(first?.sectors.find(row=>row.code==='LM153061105.Q').value,-0.05);
  assert.equal(first.sectors.find(row=>row.code==='LM663061105.Q').value,0);
  assert.equal(first.reconciled,true);
  assert.equal(missing.sectors.find(row=>row.code==='LM713061103.Q').value,null);
  assert.equal(missing.reconciled,false);
  assert.ok(parsed.warnings.some(text=>text.includes('1946-12-31')&&/missing|Incomplete/.test(text)));
});

test('Z1 validates older complete rows with the unchanged 25-million reconciliation tolerance', () => {
  const text=csv({periods:historicalPeriods()});
  assert.doesNotThrow(()=>api().parseZ1Ownership(replaceCell(text,'1945:Q4','FL313161105.Q',2625),dictionary(),{now}));
  assert.throws(()=>api().parseZ1Ownership(replaceCell(text,'1945:Q4','FL313161105.Q',2626),dictionary(),{now}),/reconciliation at 1945-12-31/);
  assert.throws(()=>api().parseZ1Ownership(replaceCell(text,'1945:Q4','LM153061105.Q',126),dictionary(),{now}),/reconciliation at 1945-12-31/);
});

test('Z1 qualifies pre-2012 central-bank source valuation without changing native amounts or other sectors', () => {
  const parsed=api().parseZ1Ownership(csv({periods:['2011:Q4','2012:Q1']}),dictionary(),{now});
  const [before,after]=parsed.history.map(row=>row.sectors.find(sector=>sector.code==='LM713061103.Q'));
  assert.equal(before.value,0.1);
  assert.match(before.valuation,/historical.*H\.4\.1.*before 2012:Q1.*fair.value/i);
  assert.equal(after.value,0.2);
  assert.equal(after.valuation,'market value');
  assert.equal(parsed.history[0].sectors.find(row=>row.code==='LM263061105.Q').valuation,'market value');
  assert.match(parsed.history[0].sectors.find(row=>row.code==='FL633061105.Q').valuation,/reported.*basis/);
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
    data=>{delete data.soma.summary[0].frn;},
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

test('SOMA retains all native eligible observations rather than only the latest 104', () => {
  const row=soma().soma.summary[0],start=Date.parse('2024-01-03T00:00:00Z');
  const summary=Array.from({length:110},(_,index)=>({...row,asOfDate:new Date(start+index*7*86400000).toISOString().slice(0,10)}));
  summary.push({...row,asOfDate:'2027-01-06'});
  const parsed=api().parseSomaOwnership({soma:{summary}},{now});
  assert.equal(parsed.history.length,110);
  assert.equal(parsed.history[0].date,'2024-01-03');
  assert.equal(parsed.history.at(-1).date,'2026-02-04');
  assert.ok(parsed.history.every(row=>row.adjustedPrincipal===345));
});

test('SOMA preserves blank FRN inputs and qualifies pre-issuance exclusion without creating observed zeros', () => {
  const row=soma().soma.summary[0];
  const summary=['2003-07-09','2014-01-29','2014-01-31','2014-05-14'].map(asOfDate=>({...row,asOfDate,frn:''}));
  summary.push({...row,asOfDate:'2014-05-21',frn:'0'});
  const parsed=api().parseSomaOwnership({soma:{summary}},{now});
  assert.equal(parsed.history.length,5);
  for(const item of parsed.history.slice(0,2)){
    assert.equal(item.components.frn,null);
    assert.equal(item.frnStatus,'not-issued');
    assert.equal(item.principal,330);
    assert.equal(item.inflationCompensation,5);
    assert.equal(item.adjustedPrincipal,335);
  }
  for(const item of parsed.history.slice(2,4)){
    assert.equal(item.components.frn,null);
    assert.equal(item.frnStatus,'unavailable');
    assert.equal(item.principal,null);
    assert.equal(item.adjustedPrincipal,null);
    assert.equal(item.inflationCompensation,5);
  }
  assert.equal(parsed.history.at(-1).components.frn,0);
  assert.equal(parsed.history.at(-1).adjustedPrincipal,335);
  assert.ok(!Object.hasOwn(parsed.history.at(-1),'frnStatus'));
  assert.match(parsed.warnings.join(' '),/FRN.*unavailable|unavailable.*FRN/i);
  const currentMissing=api().parseSomaOwnership({soma:{summary:[{...row,frn:''}]}},{now});
  assert.equal(currentMissing.principal,null);
  assert.equal(currentMissing.adjustedPrincipal,null);
  assert.equal(currentMissing.history[0].frnStatus,'unavailable');
});

test('SOMA validates malformed old inputs beyond the former retention boundary and rejects invalid FRN tokens', () => {
  const row=soma().soma.summary[0],start=Date.parse('2003-07-09T00:00:00Z');
  const summary=Array.from({length:110},(_,index)=>({...row,asOfDate:new Date(start+index*7*86400000).toISOString().slice(0,10),frn:'0'}));
  summary[0].tips='bad';
  assert.throws(()=>api().parseSomaOwnership({soma:{summary}},{now}),/missing|invalid/i);
  for(const frn of [null,undefined,'ND','N/A',' ','oops','-1']){
    assert.throws(()=>api().parseSomaOwnership({soma:{summary:[{...row,asOfDate:'2003-07-09',frn}]}},{now}),/negative|missing|invalid/i);
  }
  const signed=api().parseSomaOwnership({soma:{summary:[{...row,frn:'0',tipsInflationCompensation:'-5000000000'}]}},{now});
  assert.equal(signed.inflationCompensation,-5);
  assert.equal(signed.adjustedPrincipal,325);
});

test('SOMA long-history observations retain numerical-feed receipts, null totals and FRN interpretation footnotes', async()=>{
  const row=soma().soma.summary[0],somaData={soma:{summary:[{...row,asOfDate:'2003-07-09',frn:''},{...row,asOfDate:'2014-02-05',frn:''},...soma().soma.summary]}};
  const source=await api().collectOwnership({now,fetchImpl:fixtures({somaData})}),item=source.series.somaTreasuryHoldings;
  const [pre,unknown]=item.observations;
  assert.equal(pre.value,0.335);assert.equal(unknown.value,null);
  assert.match(pre.footnotes.join(' '),/not.*issued|before.*issuance/i);
  assert.match(unknown.footnotes.join(' '),/FRN.*unavailable|unavailable.*FRN/i);
  assert.match(item.coverageNote,/2014-01-31/);
  assert.match(item.coverageNote,/blank.*null|missing.*null/i);
  const receipt=source.provenance.find(row=>row.url===api().SOMA_URL);
  for(const observation of item.observations){
    assert.equal(observation.sourceUrl,api().SOMA_URL);
    assert.equal(observation.sourceSha256,receipt.sha256);
    assert.equal(observation.retrievedAt,receipt.retrievedAt);
    assert.equal(observation.publishedAt,null);
  }
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

test('ownership series identify their exact numerical feed receipts and describe sparse historical methods', async () => {
  const z1csv=csv({periods:['1945:Q4','1951:Q4','1952:Q1','2011:Q4','2012:Q1','2026:Q2']});
  const fetchFixture=fixtures({z1csv});
  const source=await api().collectOwnership({now,fetchImpl:async url=>{
    if(url===api().Z1_RELEASE_URL)await new Promise(resolve=>setTimeout(resolve,30));
    return fetchFixture(url);
  }});
  const zip=zipFixture([{name:'csv/F3_2_s.csv',text:z1csv},{name:'data_dictionary/F3_2_s.txt',text:dictionary()}]);
  const hashes=new Map([[api().Z1_URL,createHash('sha256').update(zip).digest('hex')],[api().SOMA_URL,createHash('sha256').update(JSON.stringify(soma())).digest('hex')]]);
  for(const [id,url]of [['foreignTreasuryHoldings',api().Z1_URL],['fedTreasuryHoldings',api().Z1_URL],['somaTreasuryHoldings',api().SOMA_URL]]){
    const measurement=source.series[id],receipt=source.provenance.find(row=>row.url===url);
    assert.equal(measurement.inputProvenanceScope,'observation-source-urls');
    assert.ok(measurement.observations.every(row=>row.sourceUrl===url&&row.sourceSha256===hashes.get(url)&&row.retrievedAt===receipt.retrievedAt));
    assert.ok(measurement.observations.every(row=>row.publishedAt===null));
    assert.notEqual(measurement.observations[0].retrievedAt,source.fetchedAt,'numerical receipt clock is not the later release-page clock');
  }
  for(const id of ['foreignTreasuryHoldings','fedTreasuryHoldings']){
    assert.match(source.series[id].coverageNote,/annual.*1945.*1951.*quarterly.*1952/i);
    assert.match(source.series[id].coverageNote,/current.*vintage|revis/i);
  }
  assert.match(source.series.fedTreasuryHoldings.coverageNote,/2012:Q1.*fair.value.*H\.4\.1|H\.4\.1.*2012:Q1.*fair.value/i);
  assert.ok(source.limitations.some(text=>/residual.*negative|negative.*residual/i.test(text)));
  assert.ok(source.limitations.some(text=>/published.*zero.*coverage|coverage.*published.*zero/i.test(text)));
});
