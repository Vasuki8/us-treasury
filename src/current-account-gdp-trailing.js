import {currentAccountGdpHistory, currentAccountGdpRatioInputs} from './current-account-gdp.js';
import {CURRENT_ACCOUNT_GDP_COMPONENTS} from './current-account-gdp-breakdown.js';
import {resolveDateWindow, windowObservations} from './date-window.js';

const FORMULA = '100 × sum of 4 consecutive quarterly balances (USD billions) / sum of the same 4 quarters of (nominal GDP (USD billions, SAAR) / 4)';
const NOTICE = 'Meridian calculated trailing-four-quarter ratios using retained revised BEA current-account and nominal GDP inputs, which may be captured independently. These are not independently published BEA ratios or historical first-release estimates. Each endpoint uses exactly four consecutive reference quarters; nominal GDP SAAR is divided by four once for each quarter, then the four quarterly GDP flows are summed. The result is not an average of quarterly ratios or an annual growth rate. The first three retained quarters and any four-quarter window with a missing input remain unavailable. The published current-account total is calculated separately from its four components; source rounding remains an explicit reconciliation residual, and missing components are never zero-filled. Component balances describe accounting contributions, not evidence of economic causation.';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const finiteOrNull = value => finite(value) ? value : null;

function fourQuarterDates(date) {
  const end = Number(date.slice(0, 4)) * 4 + (Number(date.slice(5, 7)) - 1) / 3;
  return Array.from({length: 4}, (_, index) => {
    const quarter = end - 3 + index;
    return `${String(Math.floor(quarter / 4)).padStart(4, '0')}-${String(quarter % 4 * 3 + 1).padStart(2, '0')}-01`;
  });
}

function trailingPoint(date, inputDates, inputs, enoughCoverage) {
  const inputPoints = inputDates.map(inputs.point);
  const sum = field => {
    if (!enoughCoverage || !inputPoints.every(point => finite(point[field]))) return null;
    const result = inputPoints.reduce((total, point) => total + point[field], 0);
    return finite(result) ? result : null;
  };
  const currentAccountBalance = sum('currentAccountBalance');
  const nominalGdpQuarter = sum('nominalGdpQuarter');
  let reason = !enoughCoverage ? 'Insufficient retained coverage: four consecutive quarters are required for a trailing-four-quarter ratio.' : inputPoints.find(point => point.reason)?.reason ?? null;
  if (!reason && (currentAccountBalance === null || nominalGdpQuarter === null || nominalGdpQuarter <= 0)) reason = 'The four-quarter balance or GDP aggregate is nonfinite or unavailable.';
  const calculated = reason ? null : 100 * currentAccountBalance / nominalGdpQuarter;
  if (!reason && !finite(calculated)) reason = 'Trailing-four-quarter current-account-to-GDP calculation is nonfinite; ratio unavailable.';
  return {date, value: reason ? null : calculated, currentAccountBalance, nominalGdpQuarter, nominalGdpSaar: null, reason, inputPoints};
}

/** Calculate complete four-quarter flows before applying the selected endpoint window. */
export function currentAccountGdpTrailing(sources = {}, range = {preset: 'all'}) {
  // Reuse the admitted source, exact-quarter and bounded-calendar guards. A chart
  // window cannot discard the three input quarters preceding its first endpoint.
  const history = currentAccountGdpHistory(sources, {preset: 'all'});
  const totalInputs = currentAccountGdpRatioInputs(sources);
  const componentInputs = CURRENT_ACCOUNT_GDP_COMPONENTS.map(component => currentAccountGdpRatioInputs(sources, component.id));
  const fullHistory = history.series.observations.map((endpoint, index) => {
    const inputDates = fourQuarterDates(endpoint.date);
    const total = trailingPoint(endpoint.date, inputDates, totalInputs, index >= 3);
    const components = Object.fromEntries(CURRENT_ACCOUNT_GDP_COMPONENTS.map((component, componentIndex) => [component.id, trailingPoint(endpoint.date, inputDates, componentInputs[componentIndex], index >= 3)]));
    const points = Object.values(components);
    const complete = finite(total.value) && points.every(point => finite(point.value));
    const componentSum = complete ? finiteOrNull(points.reduce((sum, point) => sum + point.value, 0)) : null;
    const componentSumBalance = complete ? finiteOrNull(points.reduce((sum, point) => sum + point.currentAccountBalance, 0)) : null;
    return {
      date: endpoint.date, startDate: inputDates[0], endDate: endpoint.date, inputDates, components, total,
      componentSum, residual: componentSum !== null ? finiteOrNull(total.value - componentSum) : null,
      componentSumBalance, residualBalance: componentSumBalance !== null ? finiteOrNull(total.currentAccountBalance - componentSumBalance) : null,
    };
  });
  const totalSeries = {
    ...history.series, id: 'currentAccountTrailingToGdp', name: 'Trailing four-quarter current account / nominal GDP', short: 'T4Q current account / GDP',
    observations: fullHistory.map(point => point.total),
  };
  const series = CURRENT_ACCOUNT_GDP_COMPONENTS.map(component => ({
    ...history.series, id: `${component.id}TrailingToGdp`, name: `Trailing four-quarter ${component.label.toLowerCase()} balance / nominal GDP`, short: `T4Q ${component.label} / GDP`,
    observations: fullHistory.map(point => point.components[component.id]),
  }));
  const window = resolveDateWindow(range, [totalSeries]);
  return {
    series, totalSeries, observations: windowObservations(fullHistory, window), window,
    error: window.error || history.error, formula: FORMULA, notice: NOTICE,
  };
}
