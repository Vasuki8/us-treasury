import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv} from '../scripts/sources/http.mjs';
let page;
try{page=await import('../src/yields-page.js');}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;}
const fixture={status:'ok',fetchedAt:'2026-10-22T03:00:00Z',curveHistory:[{date:'2026-01-02',nominal:{'2Y':3,'10Y':4},real:{'10Y':2}},{date:'2026-10-21',nominal:{'2Y':4,'10Y':5},real:{'10Y':2.5}}],provenance:[{url:'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve'},{url:'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_real_yield_curve'}]};
test('yield page exposes actual overlay dates and distinguishes inflation compensation and model limitations',()=>{
  assert.ok(page,'Yield explanation page exists');const html=page.yieldsPage({},fixture);
  for(const phrase of ['RATES &amp; CURVES','WHAT CHANGED','WHAT CONTRIBUTED','WHY IT MATTERS','LIMITATIONS','inflation compensation','not pure expected inflation','not an exact','2026-10-21','data-export-yield-curves'])assert.ok(html.toLowerCase().includes(phrase.toLowerCase()),phrase);
  assert.match(html,/id="yield-curve-date-a" type="date" min="2026-01-02" max="2026-10-21" value="2026-10-21"/);
  assert.match(html,/id="yield-curve-date-b" type="date" min="2026-01-02" max="2026-10-21" value="2026-01-02"/);
  assert.match(html,/data-kind="history-curve"/);
});
test('unavailable selected dates remain selected and explicit instead of showing another curve date',()=>{
  const html=page.yieldsPage({yieldDateA:'2026-10-20',yieldDateB:'2026-10-20'},fixture);
  assert.match(html,/id="yield-curve-date-a" type="date"[^>]*value="2026-10-20"/);assert.match(html,/A selected date is unavailable/);
  assert.match(html,/data-export-yield-curves disabled/);
});
test('curve CSV rows identify the actual input feed kind and keep missing rates blank',()=>{
  const [headers,...rows]=parseCsv(page.yieldCurvesCsv(fixture,{yieldDateA:'2026-10-21',yieldDateB:'2026-01-02'}));
  const values=rows.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]])));
  const nominal=values.find(row=>row.measure==='nominal'&&row.tenor==='10Y');
  const real=values.find(row=>row.measure==='real'&&row.tenor==='10Y');
  assert.equal(nominal.value,'5');assert.equal(nominal.unit,'Percent');assert.doesNotMatch(nominal.source_urls,/real_yield_curve/);
  assert.match(real.source_urls,/real_yield_curve/);assert.equal(real.observation_type,'official');assert.equal(real.release_date,'');
  const missing=values.find(row=>row.measure==='nominal'&&row.tenor==='30Y');assert.equal(missing.value,'');
  const comp=values.find(row=>row.measure==='inflation compensation'&&row.tenor==='10Y');assert.equal(comp.value,'250');assert.equal(comp.unit,'Basis points');assert.equal(comp.observation_type,'calculated');assert.match(comp.source_urls,/real_yield_curve/);assert.equal(comp.curve_methodology,'monotone-convex');
});
test('yield curve CSV exports only selected actual dates with separate nominal/real facts and calculation provenance',()=>{
  assert.ok(page);const csv=page.yieldCurvesCsv(fixture,{yieldDateA:'2026-10-21',yieldDateB:'2026-01-02'});
  assert.match(csv,/observation_type/);assert.match(csv,/nominal/);assert.match(csv,/real/);assert.match(csv,/calculated/);assert.match(csv,/retrieved_at/);assert.match(csv,/not pure expected inflation/);
  assert.doesNotMatch(page.yieldCurvesCsv(fixture,{yieldDateA:'2026-10-20',yieldDateB:'2026-10-20'}),/2026-10-21/);
});

test('historical curve CSV discloses the TIPS input era without assigning it to nominal rates',()=>{
  const history={...fixture,curveHistory:[
    {date:'2008-11-28',nominal:{'10Y':2.92},real:{'10Y':3.08}},
    {date:'2008-12-01',nominal:{'10Y':2.72},real:{'10Y':2.59}},
  ]};
  const [headers,...rows]=parseCsv(page.yieldCurvesCsv(history,{yieldDateA:'2008-11-28',yieldDateB:'2008-12-01'}));
  const values=rows.map(row=>Object.fromEntries(headers.map((key,i)=>[key,row[i]]))).filter(row=>row.tenor==='10Y');
  for(const row of values){
    assert.equal(row.curve_methodology,'quasi-cubic-hermite-spline');
    assert.equal(row.real_curve_inputs,row.measure==='nominal'?'':row.date==='2008-11-28'?'all-tips-securities':'most-recently-auctioned-tips');
  }
  const html=page.yieldsPage({yieldDateA:'2008-11-28',yieldDateB:'2008-12-01'},history);
  assert.match(html,/December 1, 2008/);
  assert.match(html,/Retention begins in 2003 and uses currently published revised history/);
});
