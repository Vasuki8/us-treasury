import {CURRENT_ACCOUNT_GDP_COMPONENTS, currentAccountGdpBreakdown} from './current-account-gdp-breakdown.js';
import {currentAccountGdpTrailing} from './current-account-gdp-trailing.js';
import {resolveDateWindow, windowObservations} from './date-window.js';

const FORMULA = 'Component contribution (percentage points) = current component ratio − prior component ratio, using the exact preceding quarter separately for quarterly and trailing-four-quarter horizons; published total ratio change = sum of four component contributions + change in the reconciliation residual.';
const NOTICE = 'Meridian calculated accounting contributions, not official BEA growth contributions or causal explanations, using retained revised BEA inputs that may be captured independently. Changes in GDP denominators are already included in the exact component-ratio differences; no additional GDP contribution is added. Quarterly ratios use same-quarter balances / (GDP SAAR / 4); trailing ratios use sums of four consecutive quarterly balances / sums of matching quarterly GDP flows. Adjacent trailing windows overlap by three quarters, and their changes require five consecutive raw quarters, rather than averaging quarterly ratios. Positive contributions move toward surplus; negative contributions move toward deficit. The published total remains authoritative, with the change in its reconciliation residual retained separately. Missing observations are never interpolated, zero-filled or replaced by older endpoints. Calculations retain the exact predecessor before applying the selected endpoint window. These are retained revised inputs, not historical first-release vintages or a revision attribution.';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const PRIOR_REASON = 'The exact preceding quarter is outside retained published-total coverage; two consecutive retained endpoints are required.';

function precedingQuarter(date) {
  const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7));
  return month === 1 ? `${String(year - 1).padStart(4, '0')}-10-01` : `${date.slice(0, 4)}-${String(month - 3).padStart(2, '0')}-01`;
}

function difference(current, prior, label) {
  if (!current || !prior) return {value: null, reason: PRIOR_REASON};
  if (!finite(current.value) || !finite(prior.value)) {
    return {value: null, reason: current.reason || prior.reason || `${label} requires finite current and exact preceding-quarter ratios.`};
  }
  const value = current.value - prior.value;
  return finite(value) ? {value, reason: null} : {value: null, reason: `${label} change calculation is nonfinite; contribution unavailable.`};
}

function contributions(current, prior) {
  const total = difference(current?.total, prior?.total, 'Published total');
  const components = Object.fromEntries(CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id, label}) => [id, difference(current?.components[id], prior?.components[id], label)]));
  const points = Object.values(components);
  const componentSum = points.every(point => finite(point.value)) ? points.reduce((sum, point) => sum + point.value, 0) : null;
  const componentSumChange = finite(componentSum) ? componentSum : null;
  // Component contributions remain useful without a published total. A residual
  // is only a reconciliation once both published totals and all components exist.
  const residual = total.value !== null && componentSumChange !== null
    ? difference(current && {value: current.residual}, prior && {value: prior.residual}, 'Reconciliation residual')
    : {value: null, reason: null};
  const reason = total.reason || points.find(point => point.reason)?.reason
    || (componentSumChange === null ? 'The component-sum change is nonfinite; complete reconciliation is unavailable.' : null)
    || residual.reason;
  return {current, prior, totalChange: total.value, components, componentSumChange, residualChange: residual.value, reason};
}

/** Calculate exact adjacent endpoint contributions before filtering the chart window. */
export function currentAccountGdpContributions(sources = {}, range = {preset: 'all'}) {
  const quarterly = currentAccountGdpBreakdown(sources, {preset: 'all'});
  const trailing = currentAccountGdpTrailing(sources, {preset: 'all'});
  const quarterlyByDate = new Map(quarterly.observations.map(point => [point.date, point]));
  const trailingByDate = new Map(trailing.observations.map(point => [point.date, point]));
  const allObservations = quarterly.observations.map(current => {
    const date = current.date, priorDate = precedingQuarter(date);
    return {
      date, priorDate,
      quarterly: contributions(current, quarterlyByDate.get(priorDate) ?? null),
      trailing: contributions(trailingByDate.get(date) ?? null, trailingByDate.get(priorDate) ?? null),
    };
  });
  const series = Object.fromEntries([['quarterly', 'Quarterly'], ['trailing', 'Trailing']].map(([horizon, suffix]) => [horizon,
    CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id, label}, index) => ({
      ...quarterly.series[index], id: `${id}${suffix}Contribution`,
      name: `${label} contribution to ${horizon === 'quarterly' ? 'quarterly' : 'trailing-four-quarter'} change in current account / GDP`,
      short: `${label} · ${horizon === 'quarterly' ? 'Quarterly' : 'Trailing four quarters'}`,
      unit: 'Percentage points', format: 'percentagePoints', precision: 3, observationType: 'calculated',
      observations: allObservations.map(point => ({date: point.date, priorDate: point.priorDate, ...point[horizon].components[id]})),
    })),
  ]));
  const window = resolveDateWindow(range, [...series.quarterly, ...series.trailing]);
  return {
    observations: windowObservations(allObservations, window), allObservations, series, window,
    error: window.error || quarterly.error || trailing.error, formula: FORMULA, notice: NOTICE,
  };
}
