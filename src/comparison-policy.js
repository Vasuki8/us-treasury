/**
 * Classify the displayed measurement, never its hidden source input. In
 * particular, payroll is a change and CPI is growth, not their source levels.
 * New catalog entries fail closed until their measurement is classified here.
 */
export const comparisonClasses = Object.freeze({
  cpiIndex:'level',cpiCoreIndex:'level',cpiSaIndex:'level',cpiCoreSaIndex:'level',cpiCore:'growth',cpiMonthly:'growth',cpiCoreMonthly:'growth',
  payrollLevel:'count',underemployment:'rate',employmentPopulation:'rate',weeklyHours:'level',continuedClaims:'count',
  pceIndex:'level',pceCoreIndex:'level',pceCore:'growth',pceMonthly:'growth',pceCoreMonthly:'growth',realSpending:'amount',realSpendingMonthly:'growth',realDisposableIncome:'amount',realDisposableIncomeMonthly:'growth',
  policyTargetLower:'rate',policyTargetUpper:'rate',iorb:'rate',industrialProduction:'level',capacityUtilization:'rate',housingStarts:'count',housingPermits:'count',housingCompletions:'count',
  receipts: 'amount', outlays: 'amount', netInterest: 'amount',
  budgetDeficit: 'balance', primaryDeficit: 'balance',
  receiptsTtm: 'amount', outlaysTtm: 'amount', netInterestTtm: 'amount', primaryDeficitTtm: 'balance',
  interestRevenueRatio: 'rate', publicDebt: 'amount', marketableDebt: 'amount',
  spread2s10s: 'rate', spread3m10y: 'rate', realYield10: 'rate', inflationComp10: 'rate', nominalYield2: 'rate', nominalYield3m: 'rate',
  auctionOfferingMonthly: 'amount', foreignTreasuryHoldings: 'amount', fedTreasuryHoldings: 'amount', somaTreasuryHoldings: 'amount',
  gdpTotalContribution: 'growth', gdpConsumptionContribution: 'contribution', gdpInvestmentContribution: 'contribution',
  gdpGovernmentContribution: 'contribution', gdpExportsContribution: 'contribution', gdpImportsContribution: 'contribution',
  dealerNetTreasury: 'balance', dealerRepo: 'amount', dealerReverseRepo: 'amount', dealerFailsDeliver: 'amount', dealerFailsReceive: 'amount',
  sofr: 'rate', effr: 'rate', sofrEffrSpread: 'rate',
  unrate: 'rate', payroll: 'change', cpi: 'growth', pce: 'growth', gdp: 'growth', yield: 'rate', debt: 'amount',
  claims: 'count', participation: 'rate', wages: 'growth', openings: 'count', retail: 'growth',
});

const knownClasses = new Set(['level', 'count', 'amount', 'rate', 'growth', 'contribution', 'balance', 'change']);
const ratioClasses = new Set(['level', 'count', 'amount']);

export function comparisonClassification(s) {
  if (Object.hasOwn(comparisonClasses, s.id)) return comparisonClasses[s.id];
  // Explicit metadata also allows synthetic test measurements and future
  // independently reviewed levels; format/unit inference never opts a series in.
  return knownClasses.has(s.comparisonClass) ? s.comparisonClass : 'unknown';
}

export function indexEligibilityError(panel) {
  const s = panel.series;
  const classification = comparisonClassification(s);
  const alternative = 'Use native panels or baseline differences.';
  if (!ratioClasses.has(classification)) return `${s.name} cannot be ratio-indexed: its displayed measurement is ${classification === 'unknown' ? 'unknown or unclassified' : classification === 'change' ? 'a period change' : `a ${classification} measure`}. ${alternative}`;
  if (panel.observations.some(o => typeof o.value === 'number' && Number.isFinite(o.value) && o.value <= 0)) {
    return `${s.name} cannot be ratio-indexed: every observed value in the selected window must be strictly positive. ${alternative}`;
  }
  return null;
}
