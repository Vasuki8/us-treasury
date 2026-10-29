import test from 'node:test';
import assert from 'node:assert/strict';
import {viewRange,indicatorHref} from '../src/workspace-context.js';
import {parseRoute} from '../src/router.js';
import {transformSeries,compareSeries,formatValue} from '../src/model.js';

const monthly={id:'monthly',frequency:'Monthly',unit:'Count',precision:0,format:'number',observations:[
  {date:'2020-01-01',value:1},{date:'2022-01-01',value:2},{date:'2026-01-01',value:3},
]};
test('omitted model and workspace windows follow frequency while explicit ranges stay exact',()=>{
  assert.equal(viewRange({page:'indicator',seriesId:'gdp'}).preset,'5y');
  assert.equal(viewRange({page:'indicator',seriesId:'yield'}).preset,'1y');
  assert.equal(transformSeries(monthly).window.preset,'5y');
  assert.equal(compareSeries(['monthly'],'native',undefined,{monthly}).window.preset,'5y');
  assert.deepEqual(transformSeries(monthly,'level',1).observations.map(row=>row.date),['2026-01-01']);
  assert.equal(viewRange({page:'indicator',seriesId:'gdp',window:'1y'}).preset,'1y');
});
test('Overview links use destination frequency; explicit research windows survive other journeys',()=>{
  assert.equal(parseRoute(indicatorHref('unrate',parseRoute('#/overview'))).window,'5y');
  assert.equal(parseRoute(indicatorHref('yield',parseRoute('#/overview'))).window,'1y');
  assert.equal(parseRoute(indicatorHref('receiptsTtm',parseRoute('#/fiscal'))).window,'5y');
  assert.equal(parseRoute(indicatorHref('marketableDebt',parseRoute('#/refinancing'))).window,'5y');
  const explicit=parseRoute('#/explore?mode=compare&window=1y');
  assert.equal(parseRoute(indicatorHref('unrate',explicit)).window,'1y');
});
test('source currency formatting keeps its precision and places negative signs before the symbol',()=>{
  assert.equal(formatValue({format:'billions',precision:4},-300.1001),'−$300.1001B');
  assert.equal(formatValue({format:'trillions',precision:5},-0.0142),'−$0.01420T');
  assert.equal(formatValue({format:'billions',precision:2},-0),'$0.00B');
});
