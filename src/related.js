import { registry } from './registry.js';

const inputs = {
  budgetDeficit: ['outlays', 'receipts', 'primaryDeficit', 'netInterest'],
  primaryDeficit: ['outlays', 'receipts', 'netInterest', 'budgetDeficit'],
  receiptsTtm: ['receipts', 'outlaysTtm', 'netInterestTtm'],
  outlaysTtm: ['outlays', 'receiptsTtm', 'primaryDeficitTtm'],
  netInterestTtm: ['netInterest', 'receiptsTtm', 'interestRevenueRatio'],
  primaryDeficitTtm: ['outlaysTtm', 'receiptsTtm', 'netInterestTtm', 'primaryDeficit'],
  interestRevenueRatio: ['netInterestTtm', 'receiptsTtm', 'netInterest', 'receipts'],
  debt: ['publicDebt', 'marketableDebt', 'netInterest', 'budgetDeficit'],
  publicDebt: ['debt', 'marketableDebt', 'netInterest', 'budgetDeficit'],
  marketableDebt: ['publicDebt', 'debt', 'auctionOfferingMonthly', 'netInterest'],
  spread2s10s: ['yield', 'nominalYield2', 'spread3m10y', 'realYield10'],
  spread3m10y: ['yield', 'nominalYield3m', 'spread2s10s', 'realYield10'],
  inflationComp10: ['yield', 'realYield10', 'spread2s10s', 'nominalYield2'],
  realYield10: ['yield', 'inflationComp10', 'spread2s10s'],
  yield: ['nominalYield2', 'nominalYield3m', 'realYield10', 'spread2s10s'],
  auctionOfferingMonthly: ['marketableDebt', 'publicDebt', 'debt'],
  sofrEffrSpread: ['sofr', 'effr', 'dealerRepo', 'dealerReverseRepo'],
  sofr: ['effr', 'sofrEffrSpread', 'dealerRepo', 'dealerReverseRepo'],
  effr: ['sofr', 'sofrEffrSpread', 'dealerRepo', 'dealerReverseRepo'],
  gdp: ['gdpTotalContribution', 'gdpConsumptionContribution', 'gdpInvestmentContribution', 'gdpGovernmentContribution'],
  gdpTotalContribution: ['gdpConsumptionContribution', 'gdpInvestmentContribution', 'gdpGovernmentContribution', 'gdpExportsContribution'],
};

const topicContext = {
  Labor: ['unrate', 'payroll', 'claims', 'participation', 'openings', 'wages'],
  Inflation: ['cpi', 'pce', 'inflationComp10', 'realYield10'],
  Growth: ['gdpTotalContribution', 'gdpConsumptionContribution', 'gdpInvestmentContribution', 'gdpGovernmentContribution', 'gdpExportsContribution', 'gdpImportsContribution', 'gdp', 'retail'],
  Fiscal: ['receipts', 'outlays', 'netInterest', 'budgetDeficit', 'publicDebt', 'debt'],
  Rates: ['yield', 'nominalYield2', 'nominalYield3m', 'realYield10', 'spread2s10s', 'inflationComp10'],
  Ownership: ['foreignTreasuryHoldings', 'fedTreasuryHoldings', 'somaTreasuryHoldings'],
  'Market functioning': ['dealerNetTreasury', 'dealerRepo', 'dealerReverseRepo', 'dealerFailsDeliver', 'dealerFailsReceive', 'sofr', 'effr', 'sofrEffrSpread'],
};

const modules = {
  fiscal: { label: 'Fiscal pressure', href: '#/fiscal' },
  refinancing: { label: 'Refinancing', href: '#/refinancing' },
  yields: { label: 'Yield explanations', href: '#/yields' },
  auctions: { label: 'Auction demand', href: '#/auctions' },
  ownership: { label: 'Debt ownership', href: '#/ownership' },
  macroContributions: { label: 'Macro drivers', href: '#/macro' },
  marketFunctioning: { label: 'Market functioning', href: '#/market' },
};
const topicModules = {
  Labor: { label: 'Labor market', href: '#/economy/labor' },
  Inflation: modules.macroContributions, Growth: modules.macroContributions,
  Fiscal: modules.fiscal, Rates: modules.yields,
};

/** Curated inputs first, then topic peers; every destination is an admitted series. */
export function relatedIndicators(seriesId) {
  if (!Object.hasOwn(registry, seriesId)) return { seriesIds: [], module: null };
  const current = registry[seriesId];
  const candidates = [...(inputs[seriesId] ?? []), ...(topicContext[current.topic] ?? []),
    ...Object.values(registry).filter(item => item.topic === current.topic).map(item => item.id)];
  const seriesIds = [...new Set(candidates)].filter(id => id !== seriesId && Object.hasOwn(registry, id)).slice(0, 4);
  return { seriesIds, module: modules[current.agency] ?? topicModules[current.topic] ?? null };
}
