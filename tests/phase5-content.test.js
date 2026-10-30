import test from 'node:test';
import assert from 'node:assert/strict';
import {fiscalPage} from '../src/fiscal-page.js';
import {laborPage} from '../src/labor-page.js';
import {refinancingPage} from '../src/refinancing-page.js';
import {yieldsPage} from '../src/yields-page.js';
import {auctionsPage} from '../src/auctions-page.js';
import {ownershipPage} from '../src/ownership-page.js';
import {macroPage} from '../src/macro-page.js';
import {macroCoveragePage} from '../src/macro-coverage-page.js';
import {marketFunctioningPage} from '../src/market-functioning-page.js';
import {creditContextPage} from '../src/credit-context-page.js';
import {researchPage} from '../src/research-page.js';

function visible(html){
 let hidden=0,result='';
 for(const token of html.matchAll(/<\/?details\b[^>]*>|[^<]+|<(?!\/?details\b)[^>]*>/g)){
  if(token[0].startsWith('<details')){if(hidden||!/\sopen(?:\s|>)/.test(token[0]))hidden++;}
  else if(token[0].startsWith('</details')){if(hidden)hidden--;}
  else if(!hidden)result+=token[0];
 }
 return result;
}
const stamp='2026-10-22T02:00:00Z';
const base={status:'ok',fetchedAt:stamp,series:{}};
const refinancing={...base,asOf:'2026-09-30',securities:[
 {securityId:'meridian-00000000000000000001',type:'Bill',principal:100,maturityDate:'2026-12-31'},
]};
const ownership={...base,z1:{asOf:'2026-06-30',releaseDate:'2026-09-11',assets:20,liabilities:20,
 valuationDiscrepancy:0,sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'}],
 history:[{date:'2026-06-30',sectors:[{code:'LM713061103.Q',label:'Central bank',value:20,valuation:'market value'}]}]}};
const renderers={fiscal:()=>fiscalPage(base),refinancing:()=>refinancingPage({},refinancing),yields:()=>yieldsPage({},base),
 auctions:()=>auctionsPage({},base),ownership:()=>ownershipPage(ownership),macro:()=>macroPage(base),
 market:()=>marketFunctioningPage(base),credit:()=>creditContextPage({},{}),labor:()=>laborPage(),
 coverage:()=>macroCoveragePage({macroFamily:'activity'})};
for(const [name,render]of Object.entries(renderers))test(`${name} puts collection evidence in closed About this data below content`,()=>{
 const html=render(),main=visible(html);
 assert.match(html,/<summary><span>About this data<\/span>/);
 assert.doesNotMatch(main,/2026-10-22T02:00:00Z|Release date: unknown|Actual release date: unknown/i);
 assert.doesNotMatch(main,/WHAT CHANGED\.<\/strong>\s*(?:Select|CAPTURED|Captured)/);
});
test('fiscal total deficit uses exact twelve-month outlays less receipts and remains missing for an incomplete input',()=>{
 const observations=Array.from({length:12},(_,i)=>({date:new Date(Date.UTC(2025,i,1)).toISOString().slice(0,10),value:100}));
 const source={...base,series:{receipts:{observations},outlays:{observations:observations.map(row=>({...row,value:120}))}}};
 const html=fiscalPage(source),card=html.match(/<div class="metric" data-fiscal-total-deficit>[\s\S]*?<\/div>/)?.[0];
 assert.ok(card,'Total deficit card is present');assert.match(card,/Total deficit/);assert.match(card,/\$0\.240T/);
 assert.match(card,/<span class="metric-period">Dec 2025 · Trailing 12 months<\/span>/);
 const missing=fiscalPage({...source,series:{...source.series,outlays:{observations:source.series.outlays.observations.slice(1)}}});
 assert.match(missing,/<div class="metric" data-fiscal-total-deficit>[\s\S]*?<strong class="metric-value">—<\/strong>/);
});
test('owned page links reserve external arrows for links leaving the site',()=>{
 for(const [name,render]of Object.entries(renderers)){
  for(const link of render().matchAll(/<a\b[^>]*href="(#[^"]*)"[^>]*>([\s\S]*?)<\/a>/g)){
   assert.ok(!link[2].includes('↗'),`${name}: ${link[1]}`);
  }
 }
});
test('saved research names the immutable result action Save snapshot',()=>{
 const html=researchPage({researchView:'packages'});
 assert.match(html,/Saved snapshots/);assert.doesNotMatch(html,/Freeze Result|FROZEN RESULTS|No frozen results/);
});
import {vintagesPage} from '../src/vintages-page.js';
import {releasePage} from '../src/release-page.js';
import {recordVintages} from '../src/vintages.js';
import {publicationArchive} from '../src/publication-archive.js';
test('capture and publication primary clocks use human time while exact cutoffs retain machine values',()=>{
 const source=(fetchedAt,value)=>({id:'bea',fetchedAt,series:{gdp:{observations:[{date:'2026-04-01',value}]}}});
 const history=recordVintages(null,{bea:source(stamp,2.2)},{bea:source('2026-10-23T02:00:00Z',2.4)},
  {checkedAt:'2026-10-23T03:00:00Z'});
 const html=vintagesPage({vintageSeries:'gdp'},history),text=visible(html).replace(/<[^>]+>/g,' ');
 assert.doesNotMatch(text,/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
 assert.match(html,/id="vintage-cutoff"[^>]*value="2026-10-23T02:00:00\.000"/);
 const row=publicationArchive.releases.find(row=>row.seriesId==='gdp');
 const release=releasePage({publicationSeries:'gdp',publicationPeriod:row.period,publicationCutoff:row.publicationDate},
  {archive:publicationArchive,publicationState:{status:'ready'}});
 assert.doesNotMatch(visible(release).replace(/<[^>]+>/g,' '),/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
 assert.match(release,/<summary><span>About this data<\/span>/);
});
import {series} from '../src/data.js';
test('Labor describes a payroll gap as a prior retained reading rather than a prior month',()=>{
 const original=series.payroll;
 try{
  series.payroll={...original,observations:[{date:'2026-05-01',value:133},{date:'2026-07-01',value:29}]};
  const html=laborPage(),headlines=html.split('class="labor-headlines"')[1]?.split('</section>')[0];
  assert.match(headlines,/Prior retained reading: 133k/);assert.doesNotMatch(headlines,/Prior month:/);
 }finally{series.payroll=original;}
});
test('Labor cards reserve derived labels for the source details',()=>{
 const html=laborPage({macroMeasure:'payroll'}),headlines=html.split('class="labor-headlines"')[1]?.split('</section>')[0];
 assert.doesNotMatch(headlines,/Derived|Calculated/);
 const details=html.split('data-page-disclosure="labor:definition:payroll"')[1]?.split('</details>')[0];
 assert.match(details,/Derived/);
});
