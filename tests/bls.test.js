import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBls, BLS_IDS } from '../scripts/sources/bls.mjs';

function payload(overrides={}) {
  const values={unrate:[4,4.2],payroll:[159000,159120],cpi:[300,306],participation:[62,62.1],wages:[30,31.2],openings:[7000,7100]};
  return {status:'REQUEST_SUCCEEDED',message:[],Results:{series:Object.entries(BLS_IDS).map(([id,seriesID])=>({seriesID,data:[
    {year:'2025',period:'M01',value:String(values[id][0]),footnotes:[]},
    {year:'2026',period:'M01',value:String(values[id][1]),footnotes:[{code:'P',text:'preliminary'}]},
    {year:'2025',period:'M12',value:id==='payroll'?'159000':String(values[id][0]),footnotes:[]},
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
  const p=payload();p.Results.series.pop();assert.throws(()=>parseBls(p),/missing|openings/i);
  const duplicate=payload();duplicate.Results.series[0].data.push({...duplicate.Results.series[0].data[0]});
  assert.throws(()=>parseBls(duplicate),/duplicate/i);
  const invalid=payload();invalid.Results.series[0].data[0].value='oops';
  assert.throws(()=>parseBls(invalid),/invalid|numeric/i);
});
