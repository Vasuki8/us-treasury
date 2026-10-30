import test from 'node:test';
import assert from 'node:assert/strict';
import {series} from '../src/data.js';
import {overviewPage} from '../src/overview-page.js';
import {laborPage} from '../src/labor-page.js';
import {indicatorPage} from '../src/indicator-page.js';
import {macroCoveragePage} from '../src/macro-coverage-page.js';

const state={saved:[],selected:[],transform:'level',range:12,tab:'data',window:'observations'};
function withReadings(id,values,work){
  const original=series[id];
  const months=original.frequency==='Quarterly'?3:1;
  const observations=values.map((value,index)=>({date:new Date(Date.UTC(2026,index*months,1)).toISOString().slice(0,10),value,publishedAt:null}));
  series[id]={...original,observations};
  try{work();}finally{series[id]=original;}
}

test('overview and labor headlines share compact values while labor evidence rows retain native precision',()=>{
  withReadings('payroll',[123.456,1234.567],()=>{
    const overview=overviewPage(state),labor=laborPage(state);
    assert.match(overview,/data-overview-reading="payroll"[^]*?reading-value">1,230k/);
    assert.match(labor,/labor-metric-name[^]*?<strong>1,230k<\/strong>/);
    const headlines=labor.match(/<section\b[^>]*aria-label="Latest headline indicators"[^>]*>([^]*?)<\/section>/)?.[1]??'';
    assert.ok(headlines.includes('Prior month: 123k'));
    assert.match(labor,/labor-row-change"[^>]*>\+1,111k/);
    assert.match(labor,/labor-row-value">1,235k/);
  });
});

test('indicator headline, prior and change share one scale while the table keeps native precision',()=>{
  withReadings('nominalGdp',[32000.123,32680.456],()=>{
    const html=indicatorPage({...state,seriesId:'nominalGdp'});
    assert.match(html,/big-value">\$32\.7T/);
    assert.match(html,/Display unit<br><b>Trillions of current dollars \(SAAR\)/);
    assert.match(html,/indicator-prior">Prior <b>\$32\.0T/);
    assert.match(html,/indicator-change">[^<]*\+\$0\.680T/);
    assert.match(html,/\$32,680\.46B/);
  });
});

test('macro family compact index readings leave source coverage precision native',()=>{
  withReadings('industrialProduction',[104.123,105.678],()=>{
    const html=macroCoveragePage({...state,macroFamily:'activity',macroMeasure:'industrialProduction'});
    assert.match(html,/metric-value">106<\/strong>/);
    assert.match(html,/105\.678/);
  });
});

test('overview summary charts explicitly retain one-year windows independently of detailed defaults',()=>{
  const html=overviewPage(state),plots=html.match(/<div class="chart"[^>]+>/g)??[];
  for(const ids of ['pceMonthly,pceCoreMonthly','payrollAverage3m']){
    const plot=plots.find(value=>value.includes(`data-series="${ids}"`));
    assert.ok(plot,`${ids} summary chart exists`);
    assert.match(plot,/data-range="\{&quot;preset&quot;:&quot;1y&quot;\}"/);
  }
});
