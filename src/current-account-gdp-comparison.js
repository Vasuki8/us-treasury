import {currentAccountGdpHistory} from './current-account-gdp.js';
import {CURRENT_ACCOUNT_GDP_COMPONENTS, currentAccountGdpBreakdown} from './current-account-gdp-breakdown.js';
import {currentAccountGdpTrailing} from './current-account-gdp-trailing.js';
import {resolveDateWindow, windowObservations} from './date-window.js';

export const CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES = Object.freeze([
  {id: 'currentAccountBalance', label: 'Current account'},
  ...CURRENT_ACCOUNT_GDP_COMPONENTS.map(({id, label}) => ({id, label})),
].map(Object.freeze));

const NOTICE = 'Meridian calculated comparison using retained revised BEA inputs, which may be captured independently. Quarterly ratios use the selected quarter; trailing-four-quarter ratios use the sum of balances divided by the sum of quarterly nominal GDP for exactly four consecutive quarters. GDP SAAR is divided by four once for each quarter. The percentage-point gap is the quarterly ratio minus the trailing-four-quarter ratio at the same endpoint: a difference between horizons, not a quarter-to-quarter change, a revision, a growth rate or a forecast. Trailing ratios are not averages of quarterly ratios. Missing inputs remain unavailable without interpolation or zero-filling; a valid quarterly ratio can remain visible when the trailing window is incomplete. These are calculated ratios rather than independently published BEA observations or first-release estimates. Component balances describe accounting contributions, not evidence of economic causation.';
const finite = value => typeof value === 'number' && Number.isFinite(value);

/** Other Economy measures cannot silently substitute a different accounting balance. */
export function resolveCurrentAccountComparisonMeasure(id) {
  return CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES.find(measure => measure.id === id)?.id ?? 'currentAccountBalance';
}

/** Compare exact endpoint horizons after calculating the complete trailing lookback. */
export function currentAccountGdpComparison(sources = {}, range = {preset: 'all'}, measure = 'currentAccountBalance') {
  const id = resolveCurrentAccountComparisonMeasure(measure);
  const selected = CURRENT_ACCOUNT_GDP_COMPARISON_MEASURES.find(item => item.id === id);
  const quarterly = id === 'currentAccountBalance' ? currentAccountGdpHistory(sources, {preset: 'all'}) : currentAccountGdpBreakdown(sources, {preset: 'all'});
  const trailing = currentAccountGdpTrailing(sources, {preset: 'all'});
  const quarterlySeries = id === 'currentAccountBalance' ? quarterly.series : quarterly.series[CURRENT_ACCOUNT_GDP_COMPONENTS.findIndex(component => component.id === id)];
  const trailingSeries = id === 'currentAccountBalance' ? trailing.totalSeries : trailing.series[CURRENT_ACCOUNT_GDP_COMPONENTS.findIndex(component => component.id === id)];
  const trailingByDate = new Map(trailingSeries.observations.map(point => [point.date, point]));
  const allObservations = quarterlySeries.observations.map(point => {
    const trailingPoint = trailingByDate.get(point.date);
    const calculated = finite(point.value) && finite(trailingPoint.value) ? point.value - trailingPoint.value : null;
    const gap = finite(calculated) ? calculated : null;
    const gapReason = gap !== null ? null : point.reason || trailingPoint.reason || 'The horizon-gap calculation is nonfinite; comparison unavailable.';
    return {date: point.date, quarterly: point, trailing: trailingPoint, gap, gapReason};
  });
  const series = [
    {...quarterlySeries, id: `${id}QuarterlyComparison`, name: `${selected.label} / nominal GDP · Quarterly`, short: 'Quarterly'},
    {...trailingSeries, id: `${id}TrailingComparison`, name: `${selected.label} / nominal GDP · Trailing four quarters`, short: 'Trailing four quarters'},
  ];
  const window = resolveDateWindow(range, series);
  return {
    measure: {...selected}, series, observations: windowObservations(allObservations, window), allObservations, window,
    error: window.error || quarterly.error || trailing.error,
    quarterlyFormula: quarterly.formula, trailingFormula: trailing.formula, notice: NOTICE,
  };
}
