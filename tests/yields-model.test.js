import test from 'node:test';
import assert from 'node:assert/strict';

let model;
try { model = await import('../src/yields.js'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('yields.js')) throw error; }
const yields = () => { assert.ok(model, 'The yield research model must exist'); return model; };
test('date input snaps to the nearest captured trading date, with earlier ties and clamped ends',()=>{
  const captured={curveHistory:[{date:'2026-10-19'},{date:'2026-10-16'},{date:'2026-10-21'}]};
  const cases=[['2026-10-16','2026-10-16'],['2026-10-17','2026-10-16'],['2026-10-18','2026-10-19'],
    ['2026-10-20','2026-10-19'],['2000-01-01','2026-10-16'],['2099-01-01','2026-10-21']];
  for(const [requested,actual] of cases)assert.equal(yields().nearestCurveDate(captured,requested),actual);
  assert.equal(yields().nearestCurveDate(captured,''),null);assert.equal(yields().nearestCurveDate(captured,'2026-02-30'),null);
  assert.equal(yields().nearestCurveDate({},'2026-10-20'),null);
});
const source = {curveHistory:[
  {date:'2021-12-03',nominal:{'2Y':0.59,'3M':0.05,'10Y':1.35},real:{'10Y':-1.02}},
  {date:'2021-12-06',nominal:{'2Y':0.63,'3M':0.05,'10Y':1.43},real:{'10Y':-0.98}},
  {date:'2026-10-20',nominal:{'2Y':4.79,'3M':4.26,'10Y':null},real:{}},
  {date:'2026-10-21',nominal:{'2Y':4.81,'3M':4.25,'10Y':5.13},real:{'10Y':2.76}},
]};

test('matched components calculate exact same-day same-tenor inflation compensation in basis points', () => {
  const rows = yields().matchedYieldComponents(source,{tenor:'10Y'});
  assert.deepEqual(rows.map(({date,nominal,real,inflationCompensationBps}) => ({date,nominal,real,inflationCompensationBps})),[
    {date:'2021-12-03',nominal:1.35,real:-1.02,inflationCompensationBps:237},
    {date:'2021-12-06',nominal:1.43,real:-0.98,inflationCompensationBps:241},
    {date:'2026-10-20',nominal:null,real:null,inflationCompensationBps:null},
    {date:'2026-10-21',nominal:5.13,real:2.76,inflationCompensationBps:237},
  ]);
  assert.throws(() => yields().matchedYieldComponents(source,{tenor:'2Y'}), /matched|tenor/i);
  assert.deepEqual(yields().matchedYieldComponents(undefined),[]);
});

test('exact overlay dates retain request order and explicitly identify unavailable dates', () => {
  const result = yields().selectCurveOverlays(source,['2026-10-21','2026-10-19','2021-12-03']);
  assert.deepEqual(result.map(row => ({date:row.date,available:row.available})),[
    {date:'2026-10-21',available:true},{date:'2026-10-19',available:false},{date:'2021-12-03',available:true},
  ]);
  assert.equal(result[0].nominal['2Y'],4.81);
  assert.deepEqual(result[1].nominal,{});
  assert.equal(result[0].methodology,'monotone-convex');
  assert.equal(result[2].methodology,'quasi-cubic-hermite-spline');
  result[0].nominal['2Y']=99;
  assert.equal(source.curveHistory.at(-1).nominal['2Y'],4.81,'selection must not mutate the immutable capture');
  assert.throws(() => yields().selectCurveOverlays(source,['2026-02-30']), /date/i);
});

test('curve model rejects conflicting/invalid captured dates and never converts strings or nonfinite rates into zero', () => {
  assert.throws(() => yields().matchedYieldComponents({curveHistory:[source.curveHistory[0],source.curveHistory[0]]}), /duplicate/i);
  assert.throws(() => yields().selectCurveOverlays({curveHistory:[{date:'2026-02-30'}]},[]), /date/i);
  const bad = {curveHistory:[{date:'2026-10-21',nominal:{'10Y':'5'},real:{'10Y':Infinity}}]};
  assert.deepEqual(yields().matchedYieldComponents(bad).map(({nominal,real,inflationCompensationBps}) => ({nominal,real,inflationCompensationBps})),[{nominal:null,real:null,inflationCompensationBps:null}]);
});

test('overlay metadata distinguishes the 2008 real input break from the 2021 spline change',()=>{
  const rows=yields().selectCurveOverlays({curveHistory:[
    {date:'2008-11-28',nominal:{'10Y':2.92},real:{'10Y':3.08}},
    {date:'2008-12-01',nominal:{'10Y':2.72},real:{'10Y':2.59}},
    ...source.curveHistory,
  ]},['2008-11-28','2008-12-01','2021-12-03','2021-12-06']);
  assert.deepEqual(rows.map(({methodology,realCurveInputs})=>({methodology,realCurveInputs})),[
    {methodology:'quasi-cubic-hermite-spline',realCurveInputs:'all-tips-securities'},
    {methodology:'quasi-cubic-hermite-spline',realCurveInputs:'most-recently-auctioned-tips'},
    {methodology:'quasi-cubic-hermite-spline',realCurveInputs:'most-recently-auctioned-tips'},
    {methodology:'monotone-convex',realCurveInputs:'most-recently-auctioned-tips'},
  ]);
});
