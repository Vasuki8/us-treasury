import {CURRENT_ACCOUNT_GDP_COMPONENTS} from './current-account-gdp-breakdown.js';
import {currentAccountGdpContributions} from './current-account-gdp-contributions.js';
import {windowObservations} from './date-window.js';

export const CURRENT_ACCOUNT_GDP_EFFECT_METHOD = 'symmetric-two-order-v1';
export const CURRENT_ACCOUNT_GDP_BALANCE_EFFECTS_CHART = 'current-account-gdp-balance-effects';
export const CURRENT_ACCOUNT_GDP_EFFECT_MEASURES = Object.freeze([
  {id: 'currentAccountBalance', label: 'Current account'},
  ...CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id, label}) => ({id, label})),
  {id: 'componentSum', label: 'Component sum'},
  {id: 'residual', label: 'Reconciliation residual'},
].map(Object.freeze));

const EFFECT_FORMULA = 'Balance effect (pp) = 50 × (N1 − N0) × (1 / D0 + 1 / D1); GDP-denominator effect (pp) = 50 × (N0 + N1) × (1 / D1 − 1 / D0). N0/N1 are signed prior/current balances in USD billions; D0/D1 are their matching positive nominal GDP flows in USD billions.';
const EFFECT_NOTICE = 'Meridian calculated accounting split using the symmetric average of the two possible sequential orders; the interaction is allocated equally. This is a method convention, not official BEA contributions, a unique observed allocation or evidence of economic causation. Existing combined component contributions already include both effects: do not add this split again to those contributions. Quarterly GDP SAAR is divided by four once; trailing-four-quarter effects compare separately summed balances and matching GDP flows, not averaged quarterly ratios. Adjacent trailing windows overlap three quarters and their changes require five consecutive raw quarters. Positive percentage points move toward surplus. Rising GDP can mechanically narrow a negative balance/GDP ratio without improving its dollar balance. Published total, component sum and raw balance residual are split independently; rounding is not forced into a manufactured residual. Missing inputs and nonfinite arithmetic remain unavailable without falling back to older endpoints. These are retained revised BEA inputs, potentially captured independently, not first-release vintages or revision explanations.';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const finiteOrNull = value => finite(value) ? value : null;
const nonzeroOrZero = value => value === 0 ? 0 : value;
const PRIOR_REASON = 'The exact preceding quarter is outside retained published-total coverage; two consecutive retained endpoints are required.';
const NONFINITE_REASON = 'The balance/GDP effect calculation has nonfinite intermediate or cross-ratio arithmetic; split unavailable.';

function pointInputs(point) {
  const balance = finiteOrNull(point?.currentAccountBalance);
  const gdp = finite(point?.nominalGdpQuarter) && point.nominalGdpQuarter > 0 ? point.nominalGdpQuarter : null;
  const reason = point?.reason || (!point ? PRIOR_REASON : null)
    || (!finite(point.value) || balance === null || gdp === null ? 'Finite signed balance, ratio and matching positive GDP flow are required for the effect split.' : null);
  return {balance, gdp, reason};
}

function aggregateInputs(endpoint, residual) {
  if (!endpoint) return {balance: null, gdp: null, reason: PRIOR_REASON};
  const inputs = CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id}) => pointInputs(endpoint.components[id]));
  const componentSum = inputs.every(point => point.balance !== null)
    ? finiteOrNull(inputs.reduce((sum, point) => sum + point.balance, 0)) : null;
  const firstGdp = inputs[0].gdp;
  const gdp = firstGdp !== null && inputs.every(point => point.gdp === firstGdp) ? firstGdp : null;
  let reason = inputs.find(point => point.reason)?.reason || (componentSum === null || gdp === null ? 'A complete finite component balance sum and matching positive GDP are required.' : null);
  if (!residual) return {balance: componentSum, gdp, reason};
  const total = pointInputs(endpoint.total);
  const balance = total.balance !== null && componentSum !== null ? finiteOrNull(total.balance - componentSum) : null;
  reason = total.reason || reason || (balance === null || total.gdp !== gdp ? 'The raw balance residual or its matching GDP is nonfinite or unavailable.' : null);
  return {balance, gdp, reason};
}

function endpointInputs(endpoint, id) {
  if (id === 'componentSum' || id === 'residual') return aggregateInputs(endpoint, id === 'residual');
  return pointInputs(id === 'currentAccountBalance' ? endpoint?.total : endpoint?.components[id]);
}

function combinedChange(horizon, id) {
  if (id === 'currentAccountBalance') return horizon.totalChange;
  if (id === 'componentSum') return horizon.componentSumChange;
  if (id === 'residual') return horizon.residualChange;
  return horizon.components[id].value;
}

function effectRecord(horizon, id) {
  const current = endpointInputs(horizon.current, id), prior = endpointInputs(horizon.prior, id);
  const totalChange = finiteOrNull(combinedChange(horizon, id));
  const balanceChange = current.balance !== null && prior.balance !== null ? finiteOrNull(current.balance - prior.balance) : null;
  const result = {
    balanceEffect: null, gdpEffect: null, totalChange,
    currentBalance: current.balance, priorBalance: prior.balance, balanceChange,
    currentGdp: current.gdp, priorGdp: prior.gdp,
    reason: current.reason || prior.reason || (totalChange === null ? 'The corresponding combined ratio change is unavailable; effect split unavailable.' : null),
  };
  if (result.reason) return result;
  const inversePrior = 1 / prior.gdp, inverseCurrent = 1 / current.gdp;
  const inverseSum = inversePrior + inverseCurrent, inverseChange = inverseCurrent - inversePrior;
  const balanceSum = prior.balance + current.balance;
  const scaledBalanceChange = 50 * balanceChange, scaledBalanceSum = 50 * balanceSum;
  const crossRatios = [
    100 * prior.balance / prior.gdp, 100 * current.balance / current.gdp,
    100 * prior.balance / current.gdp, 100 * current.balance / prior.gdp,
  ];
  const balanceEffect = scaledBalanceChange * inverseSum, gdpEffect = scaledBalanceSum * inverseChange;
  if (![balanceChange, inversePrior, inverseCurrent, inverseSum, inverseChange, balanceSum,
    scaledBalanceChange, scaledBalanceSum, ...crossRatios, balanceEffect, gdpEffect, balanceEffect + gdpEffect].every(finite)) {
    return {...result, reason: NONFINITE_REASON};
  }
  return {...result, balanceEffect: nonzeroOrZero(balanceEffect), gdpEffect: nonzeroOrZero(gdpEffect)};
}

/** Decorate guarded exact-predecessor contribution rows without mutating any retained evidence. */
export function currentAccountGdpBalanceEffects(sources = {}, range = {preset: 'all'}) {
  const base = currentAccountGdpContributions(sources, range);
  const allObservations = base.allObservations.map(point => ({
    ...point,
    ...Object.fromEntries(['quarterly', 'trailing'].map(horizon => [horizon, {
      ...point[horizon],
      effects: Object.fromEntries(CURRENT_ACCOUNT_GDP_EFFECT_MEASURES.map(({id}) => [id, effectRecord(point[horizon], id)])),
    }])),
  }));
  const series = Object.fromEntries([['quarterly', 'Quarterly'], ['trailing', 'Trailing']].map(([horizon, suffix]) => [horizon,
    [['BalanceEffect', 'balanceEffect', 'Balance change effect'], ['GdpEffect', 'gdpEffect', 'GDP-denominator effect'], ['RatioChange', 'totalChange', 'Combined ratio change']].map(([part, field, label]) => ({
      ...base.series[horizon][0], id: `currentAccount${suffix}${part}`,
      name: `${label} in ${horizon === 'quarterly' ? 'quarterly' : 'trailing-four-quarter'} current account / GDP`,
      short: label, unit: 'Percentage points', format: 'percentagePoints', precision: 3, observationType: 'calculated',
      observations: allObservations.map(point => ({
        date: point.date, priorDate: point.priorDate,
        value: point[horizon].effects.currentAccountBalance[field],
        reason: finite(point[horizon].effects.currentAccountBalance[field]) ? null : point[horizon].effects.currentAccountBalance.reason,
      })),
    })),
  ]));
  return {
    ...base, allObservations, observations: windowObservations(allObservations, base.window), series,
    method: CURRENT_ACCOUNT_GDP_EFFECT_METHOD, effectFormula: EFFECT_FORMULA, effectNotice: EFFECT_NOTICE,
  };
}
