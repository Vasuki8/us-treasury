import test from 'node:test';
import assert from 'node:assert/strict';
import {overviewPage} from '../src/overview-page.js';
import {getSeries,latest,formatValue} from '../src/model.js';
import {releases,dataStatus} from '../src/data.js';
import {defaults} from '../src/router.js';
import {claimsFact} from './helpers/claims-publications-fixture.js';

const state=extra=>({...defaults,saved:[],selected:[],...extra});
const render=(extra={},context={})=>overviewPage(state(extra),{now:new Date('2026-10-23T12:00:00Z'),...context});
const primary=(html,id)=>html.match(new RegExp(`data-overview-reading="${id}"[^]*?</a>`))?.[0];

test('Overview has four headline cards and four monitor readings with native momentum charts',()=>{
 const html=render();
 assert.match(html,/class="radar-page radar-overview overview-hierarchy"/);
 assert.equal((html.match(/data-overview-reading=/g)??[]).length,8);
 assert.equal((html.match(/class="oh-topic"/g)??[]).length,4);
 assert.equal((html.match(/class="workspace-monitor-row"/g)??[]).length,4);
 for(const id of ['gdp','pceCore','payroll','unrate','policyTargetRange','yield','spread2s10s','interestRevenueRatio'])assert.ok(primary(html,id),id);
 for(const [earlier,later] of [['oh-snapshot','oh-momentum'],['oh-momentum','oh-catalysts'],['oh-catalysts','oh-support']])assert.ok(html.indexOf(earlier)<html.indexOf(later));
 assert.match(primary(html,'gdp'),/q\/q SAAR/);
 assert.match(primary(html,'pceCore'),/y\/y/);
 assert.match(primary(html,'interestRevenueRatio'),/TTM/);
 assert.match(primary(html,'payroll'),/Prior month:/);
 assert.match(html,/data-series="pceMonthly,pceCoreMonthly"/);
 assert.match(html,/data-series="payrollAverage3m"/);
 assert.doesNotMatch(html,/data-series="payroll"/);
 for(const ids of ['pceMonthly,pceCoreMonthly','unrate,underemployment,participation','realDisposableIncomeMonthly,realSpendingMonthly'])assert.ok(html.includes('data-compare="'+ids+'"'),'native comparison control '+ids);
 for(const key of ['policy-effective','fiscal-debt','publications','activity-income','weekly-claims','my-research','data-methods'])assert.match(html,new RegExp(`data-overview-disclosure="${key}"`));
 assert.equal((html.match(/<details\b/g)??[]).length,(html.match(/data-overview-disclosure=/g)??[]).length,'all nested disclosure state can survive refresh');
 assert.doesNotMatch(html,/FOLLOWING · EXCEPTIONS|overview-evidence-desk|sample-|data-proposed-overview/);
});

test('Overview latest readings ignore inherited historical windows while retaining detail navigation',()=>{
 const current=getSeries('payroll'),saved=current.observations;
 current.observations=[{date:'2025-01-01',value:100},{date:'2026-09-01',value:177}];
 try{
  const html=render({window:'custom',startDate:'2025-01-01',endDate:'2025-01-01',transform:'change'}),reading=primary(html,'payroll');
  assert.ok(reading.includes(formatValue(current,177)));
  assert.match(reading,/Sep 2026/);assert.match(reading,/Prior retained reading: 100k/);
  assert.match(html,/href="#\/series\/payroll(?:\?|\")/);
 }finally{current.observations=saved;}
});

test('Overview never synthesizes a target range from misaligned or unavailable bounds',()=>{
 const lower=getSeries('policyTargetLower'),upper=getSeries('policyTargetUpper'),saved=[lower.observations,upper.observations];
 try{
  lower.observations=[{date:'2026-10-20',value:3.75}];upper.observations=[{date:'2026-10-22',value:4}];
  let html=render(),policy=html.slice(html.indexOf('data-overview-reading="policyTargetRange"'),html.indexOf('data-overview-disclosure="policy-effective"'));
  assert.match(policy,/lower bound/);assert.match(policy,/upper bound/);assert.match(policy,/20 Oct 2026/);assert.match(policy,/22 Oct 2026/);
  assert.doesNotMatch(policy,/3\.75–4\.00%/);
  lower.observations=[{date:'2026-10-22',value:null}];html=render();
  assert.match(html,/Target range · lower bound[^]*?reading-value">—/);
  lower.observations=[{date:'2026-10-22',value:Infinity}];html=render();
  assert.doesNotMatch(html,/Infinity/);
  lower.observations=[{date:'2026-10-22',value:3.75}];html=render();
  assert.match(primary(html,'policyTargetRange'),/3\.75–4%/);
 }finally{[lower.observations,upper.observations]=saved;}
});

test('Overview supports each activity measure and distinct weekly claim reference, role and reported publication clock',()=>{
 const html=render();
 for(const id of ['realSpendingMonthly','realDisposableIncomeMonthly','industrialProduction','claimsAdvance','continuedClaimsAdvance','effr','publicDebt','policyTargetLower'])assert.ok(html.includes(`#/series/${id}`),id);
 const claims=html.slice(html.indexOf('data-overview-disclosure="weekly-claims"'),html.indexOf('data-overview-disclosure="my-research"'));
 for(const id of ['claimsAdvance','continuedClaimsAdvance'])assert.ok(claims.includes(latest(getSeries(id)).date));
 assert.match(claims,/Estimate role/);assert.match(claims,/Advance/);assert.match(claims,/Reported publication 22 Oct 2026 · day precision/);
 assert.doesNotMatch(claims,/Verified|verified/);
 const current=getSeries('continuedClaimsAdvance'),saved=current.observations;
 try{current.observations=[{date:'2026-10-03',value:1700,releaseStage:'prior-week-revised'}];assert.match(render(),/Prior week · revised in same release/);}finally{current.observations=saved;}
});

test('Overview groups four distinct future programs using supplied now and preserves cached schedule evidence without invented time',()=>{
 const saved=[...releases],source=dataStatus.calendar.sources.bls;
 try{
  releases.splice(0,releases.length,...['a','b','c','d','e'].map((id,index)=>({id,program:id,sourceId:'bls',agency:'BLS',name:`Program ${id}`,date:index<2?'2026-10-23':'2026-10-24',seriesIds:['unrate'],scheduleBasis:'listed-date',sourceUrl:'https://www.bls.gov/schedule/'})));
  dataStatus.calendar.sources.bls={...source,status:'error',fetchedAt:'2026-10-22T22:00:00Z'};
  const html=render({saved:['unrate']});
  assert.equal((html.match(/class="oh-event-day"/g)??[]).length,2);assert.equal((html.match(/class="oh-event"/g)??[]).length,4);
  assert.doesNotMatch(html,/Time not supplied/);
  assert.match(html,/Cached schedule/);assert.match(html,/Following/);assert.match(html,/Listed schedule/);
  assert.doesNotMatch(html,/Program e|market surprise score|consensus forecast/);
  assert.match(html,/schedule does not confirm a result/);
 }finally{releases.splice(0,releases.length,...saved);dataStatus.calendar.sources.bls=source;}
});

test('Overview reviewed archives keep historical period and clocks without repeating headline values',()=>{
 const row=claimsFact({period:'2026-03-14',publicationDate:'2026-03-19',value:202});
 row.id=`dol-${row.seriesId}-${row.period}-${row.releaseStage}-${row.publicationDate}`;
 const html=render({}, {publicationContexts:{claims:{status:'ready',archive:{releases:[row]}},gdp:{status:'error',error:'<unsafe> archive'}}});
 const publications=html.slice(html.indexOf('data-overview-disclosure="publications"'),html.indexOf('class="oh-support"'));
 assert.match(publications,/reference 14 Mar 2026/);
 assert.match(publications,/Published 19 Mar 2026 · day precision/);
 assert.match(publications,/Captured 6:00 pm ET, 22 Oct/);
 assert.match(publications,/GDP: Publication evidence unavailable/);assert.match(publications,/&lt;unsafe&gt; archive/);
 assert.doesNotMatch(publications,/202k|new publication today|Released today/);
 assert.match(publications,/Historical publications captured recently are not new releases today/);
});

test('Overview exposes research counts, loading failures and escaped collector names in one disclosure',()=>{
 const html=render({saved:['unrate']},{changes:{status:'error',error:'<retry>'},failures:[{id:'<feed>',error:'<script>bad</script>',fetchedAt:'2026-10-22T23:00:00Z'}],publicationContexts:{gdp:{status:'loading'}}});
 const research=html.slice(html.indexOf('data-overview-disclosure="my-research"'),html.indexOf('data-overview-disclosure="data-methods"'));
 assert.match(research,/Following 1/);assert.match(research,/Collection attention 1/);assert.match(research,/Captured changes unavailable/);assert.match(research,/&lt;retry&gt;/);assert.match(research,/&lt;feed&gt;/);assert.match(research,/&lt;script&gt;bad&lt;\/script&gt;/);
 assert.doesNotMatch(research,/<script>/);
 assert.match(html,/GDP: Publication evidence loading/);
 assert.match(render(),/Publication evidence not loaded/);
});
