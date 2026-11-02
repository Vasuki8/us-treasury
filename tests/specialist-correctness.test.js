import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {specialistDeskPage} from '../src/specialist-desks-page.js';

const observation=(value,unit)=>({unit,observations:[{date:'2026-10-28',value}]});
const options=sources=>({sources,catalog:{},calendar:{sources:{}},now:new Date('2026-11-01T00:00:00Z')});

test('dealer settlement fails identify FR 2004C while keeping both weekly reporting directions',()=>{
 const html=specialistDeskPage({page:'dealers',specialistView:'fails'},options({dealerDetails:{id:'dealerDetails',series:{dealerFailsDeliver:observation(12,'USD billions'),dealerFailsReceive:observation(9,'USD billions')}}}));
 const fails=html.match(/<h2>(?:<span[^>]*>[^<]*<\/span>)?[^<]*settlement fails[^<]*<\/h2>([^]*?)<\/section>/i)?.[0];
 assert.ok(fails,'The settlement-fails panel is rendered');
 assert.match(fails,/<h2><span[^>]*>04<\/span>FR 2004C: settlement fails &amp; TMPG monitor<\/h2>/);
 assert.match(fails,/Failed deliveries<\/dt><dd>\$12\.0+B/);
 assert.match(fails,/Failed receipts<\/dt><dd>\$9\.0+B/);
 assert.match(html,/Cumulative weekly amounts, distinct from Wednesday stocks/);
 assert.doesNotMatch(fails,/2004D/);
});

test('all FX scenario outputs quote the unchanged forward reference as EUR/USD in USD per EUR',()=>{
 const sources={policyRates:{id:'policyRates',series:{policyTargetUpper:observation(4,'Percent')}},ecbPolicy:{id:'ecbPolicy',series:{ecbDepositRate:observation(2,'Percent')}},fedFx:{id:'fedFx',series:{fxUsdEur:observation(1.1,'USD per EUR')}}};
 // Hand-calculated simple-interest references: 1.1 * (1 + USD%/100 * .25) / (1 + EUR%/100 * .25).
 for(const [fxScenario,reference]of [['year-end','1.10547'],['fed-cut','1.10410'],['policy-divergence','1.10479']]){
  const html=specialistDeskPage({page:'fxBasis',fxScenario},options(sources));
  assert.match(html,new RegExp('<span>EUR/USD reference forward · USD per EUR</span><strong>'+reference.replace('.','\\.')+'</strong>'),fxScenario);
  assert.match(html,new RegExp('EUR/USD reference forward</div><strong[^>]*>'+reference.replace('.','\\.')+'</strong>'),fxScenario+' KPI');
  assert.match(html,/EUR\/USD spot · USD per EUR/);
  assert.match(html,/F_reference = S_USD_per_EUR × \(1 \+ r_USD × T\) \/ \(1 \+ r_EUR × T\)/);
  assert.match(html,/does not establish an executable forward/);
  assert.doesNotMatch(html,/USD\/EUR forward reference/);
 }
});

test('both buyback desks preserve a lower bound on the announced maximum and exact legacy amounts',()=>{
 const rows=[{date:'2026-11-04',purpose:'Liquidity Support',bucket:'Nominal Coupons 10Y to 20Y',maximumBillions:4,maximumOperator:'>='},{date:'2026-11-05',purpose:'Liquidity Support',bucket:'Nominal Coupons 1Mo to 2Y',maximumBillions:4,maximumOperator:'='},{date:'2026-11-06',purpose:'Liquidity Support',bucket:'Legacy capture',maximumBillions:2}];
 for(const page of ['refunding','liquidity']){
  const html=specialistDeskPage({page},options({treasuryRefunding:{id:'treasuryRefunding',tables:{buybacks:{calendarName:'Captured tentative calendar',rows}}}}));
  assert.match(html,/<th scope="row">2026-11-04<\/th><td>Liquidity Support<\/td><td>Nominal Coupons 10Y to 20Y<\/td><td>≥\$4\.00B<\/td>/,page+' lower bound');
  assert.match(html,/<th scope="row">2026-11-05<\/th><td>Liquidity Support<\/td><td>Nominal Coupons 1Mo to 2Y<\/td><td>\$4\.00B<\/td>/,page+' exact PDF amount');
  assert.match(html,/<th scope="row">2026-11-06<\/th><td>Liquidity Support<\/td><td>Legacy capture<\/td><td>\$2\.00B<\/td>/,page+' exact legacy amount');
  assert.match(html,/≥ denotes a lower bound on the tentative maximum/);
 }
});

test('both buyback desks suppress superseded current caps and retain the dated capture as history',async()=>{
 const source=JSON.parse(await readFile(new URL('./fixtures/market-desks/refunding-candidate.json',import.meta.url),'utf8'));
 for(const page of ['refunding','liquidity']){
  const html=specialistDeskPage({page},options({treasuryRefunding:source}));
  if(page==='refunding')assert.match(html,/Tentative buyback capacity<\/div><strong[^>]*>Current schedule unavailable<\/strong>/);
  const buybacks=html.slice(html.indexOf('<h3>Upcoming tentative operations</h3>'));
  const current=buybacks.split('<details>')[0];
  assert.match(current,/superseded/i,page+' status');
  assert.match(current,/2026-09-09/,page+' newer publication date');
  assert.match(current,/<a[^>]+href="https:\/\/home\.treasury\.gov\/system\/files\/221\/Tentative-Buyback-ScheduleQ32026\.pdf"/,page+' official amendment link');
  assert.doesNotMatch(current,/<th scope="row">2026-11-04<\/th>/,page+' no stale current operation cap');
  assert.match(buybacks,/<details><summary>Superseded captured upcoming operations/);
  assert.match(buybacks,/<details><summary>Captured past operations/);
  for(const row of source.tables.buybacks.rows)assert.ok(buybacks.includes(row.date),page+' retained '+row.date);
 }
});
