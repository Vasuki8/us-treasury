import test from 'node:test';
import assert from 'node:assert/strict';
import {fiscalPage} from '../src/fiscal-page.js';
import {creditContextPage} from '../src/credit-context-page.js';
import {dataStatus} from '../src/data.js';

test('Fiscal headline groups share trillions while financing evidence keeps its native precision and unit',()=>{
  const html=fiscalPage();
  const readings=[...html.matchAll(/<strong class="metric-value">([^<]+)<\/strong>/g)].map(([,value])=>value);
  assert.ok(readings.filter(value=>value.includes('$')).every(value=>value.endsWith('T')));
  assert.ok(html.includes('−$15.50B'),'Native financing values keep cents of billions and place the sign before currency');
  assert.ok(!html.includes('$-'));
});
test('Credit headlines use the page currency unit without erasing small overnight balances',()=>{
  const sources=structuredClone(dataStatus.sources);
  sources.onRrp.series.onRrpAccepted.observations=[{date:'2026-10-22',value:.351}];
  const html=creditContextPage(sources);
  const values=[...html.matchAll(/<strong class="metric-value">([^<]+)<\/strong>/g)].map(([,value])=>value);
  assert.ok(values.includes('$0.000351T'));
  assert.ok(values.filter(value=>value.includes('$')).every(value=>value.endsWith('T')));
  assert.ok(html.includes('Exact retained value: 0.351B'));
});
