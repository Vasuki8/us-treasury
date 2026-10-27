import test from 'node:test';
import assert from 'node:assert/strict';
import {fiscalPage} from '../src/fiscal-page.js';
import {fiscalGdpPanel} from '../src/fiscal-gdp-view.js';

const stripTags=html=>html.replace(/<[^>]*>/g,' ');
function element(html,tag,attribute){
 const start=html.search(new RegExp(`<${tag}\\b[^>]*${attribute}[^>]*>`));
 assert.ok(start>=0,`${tag} with ${attribute} is rendered`);
 const tags=new RegExp(`<\\/?${tag}\\b[^>]*>`,'g');tags.lastIndex=start;
 let depth=0;
 for(let match;(match=tags.exec(html));){depth+=match[0].startsWith('</')?-1:1;if(depth===0)return html.slice(start,tags.lastIndex);}
 assert.fail(`Unclosed ${tag}`);
}
const disclosure=html=>element(html,'details','data-page-disclosure="fiscal:gdp-evidence"');
const primary=html=>html.replace(disclosure(html),'');
function fixture(){
 const nominal=[['2025-07-01',20000],['2025-10-01',22000],['2026-01-01',24000],['2026-04-01',26000]].map(([date,value])=>({date,value}));
 const monthly=Array.from({length:12},(_,i)=>({date:new Date(Date.UTC(2025,6+i,1)).toISOString().slice(0,10),receipts:100,outlays:120,netInterest:10}));
 return {bea:{fetchedAt:'2026-10-22T20:00:00Z',series:{nominalGdp:{observations:nominal}}},treasury:{fetchedAt:'2026-10-22T21:00:00Z',series:{debt:{observations:[{date:'2026-06-30',value:39},{date:'2026-10-21',value:40}]}}},fiscal:{fetchedAt:'2026-10-22T22:00:00Z',series:{publicDebt:{observations:[{date:'2026-06-30',value:30}]}},monthly}};
}
const ratioNames=['Gross federal debt','Debt held by the public','budget deficit','net budget interest'];

test('fiscal headline groups five TTM readings separately from the daily public debt stock',()=>{
 const html=fiscalPage();
 assert.match(html,/class="[^"]*\bfiscal-workspace\b/);
 const activity=element(html,'section','aria-label="Trailing 12-month fiscal activity"');
 const debt=element(html,'aside','aria-label="Daily public debt stock"');
 for(const id of ['receiptsTtm','outlaysTtm','primaryDeficitTtm','netInterestTtm','interestRevenueRatio'])assert.ok(activity.includes(`href="#/series/${id}"`),id);
 assert.equal((activity.match(/class="metric"/g)??[]).length,5);
 assert.doesNotMatch(activity,/href="#\/series\/publicDebt"/);
 assert.match(debt,/href="#\/series\/publicDebt"/);
 assert.equal((debt.match(/class="metric"/g)??[]).length,1);
 assert.match(stripTags(debt),/daily|stock/i);
});

test('fiscal trends and monthly contributors precede GDP context and retain native research actions',()=>{
 const html=fiscalPage();
 for(const title of ['TRAILING 12-MONTH FISCAL TRENDS','WHAT CONTRIBUTED']){
  assert.ok(html.includes(title));
  assert.ok(html.indexOf(title)<html.indexOf('FISCAL SIZE RELATIVE TO NOMINAL GDP'),title);
 }
 assert.match(html,/data-chart\s+data-series="receiptsTtm,outlaysTtm,netInterestTtm"/);
 assert.match(html,/data-comparison="native"/);
 assert.match(html,/data-compare="receiptsTtm,outlaysTtm,netInterestTtm"/);
 for(const action of ['data-export-fiscal','data-export-fiscal-financing','data-export-fiscal-gdp'])assert.ok(html.includes(action),action);
 for(const key of ['fiscal:monthly-research','fiscal:definitions-methods'])assert.ok(html.includes(`data-page-disclosure="${key}"`));
});

test('GDP context shows four compact ratios while stable collapsed evidence retains formulas and separate retrievals',()=>{
 const html=fiscalGdpPanel(fixture()),evidence=disclosure(html),main=primary(html);
 assert.doesNotMatch(evidence.slice(0,evidence.indexOf('>')),/\bopen\b/);
 assert.doesNotMatch(main,/100 ×/,'Full formulas belong to the stable evidence disclosure');
 for(const name of ratioNames)assert.ok(stripTags(main).toLowerCase().includes(name.toLowerCase()),name);
 // Hand calculation: stocks use 26,000 SAAR; annual flows use (20,000+22,000+24,000+26,000)/4 = 23,000.
 for(const value of ['150.00%','115.38%','1.04%','0.52%'])assert.ok(main.includes(value),value);
 for(const date of ['2026-04-01','2026-06-30'])assert.ok(main.includes(date),date);
 assert.match(evidence,/100 ×/);
 assert.match(evidence,/12 exact monthly/);
 assert.match(evidence,/four exact quarterly/);
 for(const time of ['2026-10-22T20:00:00Z','2026-10-22T21:00:00Z','2026-10-22T22:00:00Z'])assert.ok(evidence.includes(time),time);
 assert.match(html,/data-export-fiscal-gdp/);
});

test('partial GDP inputs retain four readings and disclose stock versus trailing-year timing',()=>{
 const sources=fixture();sources.fiscal.monthly.splice(3,1);sources.treasury.series.debt.observations.shift();
 const html=fiscalGdpPanel(sources),main=primary(html),evidence=disclosure(html);
 for(const name of ratioNames)assert.ok(stripTags(main).toLowerCase().includes(name.toLowerCase()),name);
 assert.ok(main.includes('115.38%'));
 assert.equal((main.match(/<td\b[^>]*class="[^"]*\bfiscal-gdp-value\b[^"]*"[^>]*>\s*Unavailable\s*<\/td>/g)??[]).length,3);
 assert.match(stripTags(main+' '+evidence),/quarter.end|same.quarter/i);
 assert.match(stripTags(main+' '+evidence),/trailing.year|trailing 12.month/i);
 assert.match(evidence,/2026-10-22T20:00:00Z/);
});

test('unavailable GDP and retained source failures remain explicit and escaped',()=>{
 const html=fiscalGdpPanel({bea:{series:{}},fiscal:{series:{}},treasury:{series:{}}});
 assert.match(html,/Fiscal GDP ratios unavailable\./);
 assert.match(html,/nominal GDP denominator and aligned numerator periods/);
 const page=fiscalPage({status:'error',error:'Retained fiscal <script>failure</script>',coverageNote:'Retained <scope>',series:{}});
 assert.ok(page.includes('Retained fiscal &lt;script&gt;failure&lt;/script&gt;'));
 assert.ok(page.includes('Retained &lt;scope&gt;'));
 assert.doesNotMatch(page,/<script>failure<\/script>/);
 assert.match(page,/Year-over-year attribution unavailable\./);
 assert.match(page,/Monthly financing unavailable\./);
});

