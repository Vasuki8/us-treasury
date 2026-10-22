import test from 'node:test';
import assert from 'node:assert/strict';

let model;
try { model = await import('../src/refinancing.js'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND' || !error.message.includes('refinancing.js')) throw error; }
const api = () => { assert.ok(model, 'The refinancing calculations must exist'); return model; };
const asOf = '2026-09-30';
const securities = [
  { securityId: 'meridian-00000000000000000001', type: 'Bill', principal: 100, maturityDate: '2026-10-15' },
  { securityId: 'meridian-00000000000000000002', type: 'Note', principal: 200, maturityDate: '2026-12-31' },
  { securityId: 'meridian-00000000000000000003', type: 'Bond', principal: 300, maturityDate: '2056-09-30' },
  { securityId: 'meridian-00000000000000000004', type: 'TIPS', principal: 120, unadjustedPrincipal: 100, inflationAdjustment: 20, maturityDate: '2027-09-30' },
  { securityId: 'meridian-00000000000000000005', type: 'FRN', principal: 50, maturityDate: '2027-03-31' },
];
const fixture = () => ({ asOf, unit: 'USD billions', securities: structuredClone(securities) });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
const days = (end, start = asOf) => (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000;

test('maturity summaries weight principal, use month-end calendar horizons and distinguish maturity from repricing', () => {
  const result = api().summarizeRefinancing(fixture());
  assert.equal(result.status, 'ok');
  assert.equal(result.totalPrincipal, 770);
  close(result.billSharePct, 100 / 770 * 100);
  close(result.weightedAverageMaturityYears, securities.reduce((sum, row) => sum + row.principal * days(row.maturityDate) / 365.25, 0) / 770);
  assert.deepEqual(result.maturing.map(({ months, endDate, principal }) => ({ months, endDate, principal })), [
    { months: 3, endDate: '2026-12-31', principal: 300 },
    { months: 12, endDate: '2027-09-30', principal: 470 },
    { months: 24, endDate: '2028-09-30', principal: 470 },
  ]);
  assert.equal(result.byType.find(row => row.type === 'FRN').principal, 50);
  assert.ok(result.limitations.some(text => /repric|reset/i.test(text)));
});

test('missing or invalid securities produce an unavailable summary, not zero exposure', () => {
  for (const source of [undefined, {}, { asOf, securities: [] }, { asOf, securities: [{ ...securities[0], principal: null }] }, { asOf, securities: [{ ...securities[0], maturityDate: '2026-02-30' }] }, { asOf, securities: [securities[0], securities[0]] }]) {
    assert.equal(api().summarizeRefinancing(source).status, 'unavailable');
    assert.equal(api().refinancingScenario(source).status, 'unavailable');
  }
});

test('rate scenarios apply shocks only after bills and fixed coupons mature and do not change long bonds', () => {
  const result = api().refinancingScenario(fixture(), { horizonMonths: 12, rateShockBps: 100 });
  assert.equal(result.status, 'ok');
  assert.equal(result.endDate, '2027-09-30');
  assert.equal(result.baselineRatePct, 4);
  assert.equal(result.modeledRatePct, 5);
  close(result.byType.find(row => row.type === 'Bill').accruedImpact, 100 * 0.01 * days('2027-09-30', '2026-10-15') / 365);
  close(result.byType.find(row => row.type === 'Note').accruedImpact, 200 * 0.01 * days('2027-09-30', '2026-12-31') / 365);
  assert.equal(result.byType.find(row => row.type === 'Bond').accruedImpact, 0);
  assert.equal(result.byType.find(row => row.type === 'TIPS').accruedImpact, 0, 'Maturing at the horizon contributes no within-horizon interest');
  close(result.annualizedImpactAtHorizon, 4.7);
  assert.ok(result.assumptions.some(text => /roll|refinanc/i.test(text)));
  assert.ok(result.assumptions.some(text => /inflation/i.test(text)));
  assert.ok(result.limitations.some(text => /net budget|net interest/i.test(text)));
});

test('FRNs reset before final maturity and accrue separately from assumed replacement debt', () => {
  const result = api().refinancingScenario(fixture(), { horizonMonths: 12, rateShockBps: 100 });
  const frn = result.byType.find(row => row.type === 'FRN');
  const existingDays = days('2027-03-31') - 7;
  const replacementDays = days('2027-09-30', '2027-03-31');
  close(frn.accruedImpact, 50 * 0.01 * (existingDays / 360 + replacementDays / 365));
  assert.equal(frn.repricingPrincipal, 50, 'One FRN principal is not counted again at maturity');
  close(frn.annualizedImpactAtHorizon, 0.5);
  assert.ok(result.assumptions.some(text => /7.day|seven.day/i.test(text)));
});

test('lower-rate scenarios honor zero-rate floor and keep explicitly modeled assumptions separate', () => {
  const lower = api().refinancingScenario(fixture(), { horizonMonths: 12, rateShockBps: -100 });
  const higher = api().refinancingScenario(fixture(), { horizonMonths: 12, rateShockBps: 100 });
  close(lower.accruedImpact, -higher.accruedImpact);
  const floored = api().refinancingScenario(fixture(), { horizonMonths: 12, rateShockBps: -500 });
  assert.equal(floored.modeledRatePct, 0);
  close(floored.annualizedImpactAtHorizon, -18.8);
  assert.equal(floored.dataStatus, 'modeled');
  assert.equal(api().refinancingScenario(fixture(), { rateShockBps: 0 }).accruedImpact, 0);
});

test('TIPS keep their existing real coupon and retain the original-principal redemption floor under frozen inflation', () => {
  const source = { asOf, securities: [{ securityId: 'meridian-00000000000000000004', type: 'TIPS', principal: 90, unadjustedPrincipal: 100, inflationAdjustment: -10, maturityDate: '2026-12-31' }] };
  const summary = api().summarizeRefinancing(source);
  assert.equal(summary.totalPrincipal, 90, 'Observed profile remains current inflation-adjusted principal');
  const scenario = api().refinancingScenario(source, { horizonMonths: 12, rateShockBps: 100 });
  close(scenario.annualizedImpactAtHorizon, 1, 'Replacement financing honors known original-principal floor');
  close(scenario.accruedImpact, 100 * 0.01 * days('2027-09-30', '2026-12-31') / 365);
  assert.ok(scenario.assumptions.some(text => /redemption.floor|original.principal floor/i.test(text)));
  assert.equal(api().refinancingScenario({ asOf, securities: [{ ...source.securities[0], unadjustedPrincipal: null }] }).status, 'unavailable');
});

test('scenarios reject invalid assumptions and calendar arithmetic handles leap years', () => {
  for (const options of [{ horizonMonths: 0 }, { horizonMonths: 13 }, { rateShockBps: NaN }, { baselineRatePct: -1 }, { frnResetLagDays: -1 }]) assert.throws(() => api().refinancingScenario(fixture(), options), /horizon|shock|rate|reset|assumption/i);
  const result = api().summarizeRefinancing({ asOf: '2023-11-30', securities: [{ securityId: 'meridian-00000000000000000001', type: 'Bill', principal: 1, maturityDate: '2024-02-29' }] });
  assert.equal(result.maturing[0].endDate, '2024-02-29');
  assert.equal(result.maturing[0].principal, 1);
});
test('an FRN maturing inside the reset lag has only replacement sensitivity, with one principal counted',()=>{
  const source={asOf,securities:[{securityId:'meridian-00000000000000000009',type:'FRN',principal:50,maturityDate:'2026-10-03'}]};
  const result=api().refinancingScenario(source,{horizonMonths:3,rateShockBps:100,frnResetLagDays:7});
  close(result.accruedImpact,50*.01*days('2026-12-31','2026-10-03')/365);
  close(result.annualizedImpactAtHorizon,.5);
  assert.equal(result.byType.find(row=>row.type==='FRN').repricingPrincipal,50);
});
