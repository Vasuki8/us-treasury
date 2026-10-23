import { currentAccountGdpHistory, currentAccountGdpRatioInputs } from './current-account-gdp.js';
import { windowObservations } from './date-window.js';

export const CURRENT_ACCOUNT_GDP_COMPONENTS = Object.freeze([
  {id: 'itaGoodsBalance', label: 'Goods', ratioId: 'itaGoodsBalanceToGdp'},
  {id: 'itaServicesBalance', label: 'Services', ratioId: 'itaServicesBalanceToGdp'},
  {id: 'itaPrimaryIncomeBalance', label: 'Primary income', ratioId: 'itaPrimaryIncomeBalanceToGdp'},
  {id: 'itaSecondaryIncomeBalance', label: 'Secondary income', ratioId: 'itaSecondaryIncomeBalanceToGdp'},
].map(Object.freeze));

const FORMULA = '100 × component balance (USD billions per quarter) / (nominal GDP (USD billions, SAAR) / 4)';
const NOTICE = 'Meridian calculated ratios using retained revised BEA current-account component and nominal GDP inputs, which may be captured independently. These are not independently published BEA ratios or historical first-release estimates. Each component is matched to the same exact reference quarter and quarterly nominal GDP; GDP SAAR is divided by four once. Positive balances offset negative balances; changes and reconciliation residuals are percentage points of GDP. The published current-account total remains authoritative. A residual between that total and the four component balances is retained, including source rounding; missing components are never zero-filled. Component balances describe accounting contributions, not evidence of economic causation.';
const finite = value => typeof value === 'number' && Number.isFinite(value);

/** Match all components to the bounded published-total calendar and preserve gaps independently. */
export function currentAccountGdpBreakdown(sources = {}, range = {preset: 'all'}) {
  const history = currentAccountGdpHistory(sources, range);
  const inputs = CURRENT_ACCOUNT_GDP_COMPONENTS.map(component => currentAccountGdpRatioInputs(sources, component.id));
  const fullHistory = history.series.observations.map(total => {
    const components = Object.fromEntries(CURRENT_ACCOUNT_GDP_COMPONENTS.map((component, index) => [component.id, inputs[index].point(total.date)]));
    const points = Object.values(components);
    const complete = finite(total.value) && points.every(point => finite(point.value));
    const componentSum = complete ? points.reduce((sum, point) => sum + point.value, 0) : null;
    const componentSumBalance = complete ? points.reduce((sum, point) => sum + point.currentAccountBalance, 0) : null;
    return {
      date: total.date, components, total, componentSum,
      residual: complete ? total.value - componentSum : null,
      componentSumBalance, residualBalance: complete ? total.currentAccountBalance - componentSumBalance : null,
    };
  });
  const series = CURRENT_ACCOUNT_GDP_COMPONENTS.map(component => ({
    ...history.series,
    id: component.ratioId, name: `${component.label} balance / nominal GDP`, short: `${component.label} / GDP`,
    observations: fullHistory.map(point => point.components[component.id]),
  }));
  return {
    series, observations: windowObservations(fullHistory, history.window), window: history.window,
    error: history.error, formula: FORMULA, notice: NOTICE,
  };
}
