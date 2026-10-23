import { currentAccountRegistry, currentAccountDefinitions, itaLocator } from './current-account-registry.js';
import { economicDepthRegistry } from './economic-depth-registry.js';
import { resolveDateWindow, windowObservations } from './date-window.js';

export const CURRENT_ACCOUNT_GDP_FORMULA = '100 × current-account balance (USD billions per quarter) / (nominal GDP (USD billions, SAAR) / 4)';
export const MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS = 5000;
const NOTICE = 'Meridian calculated ratio using retained revised BEA current-account and nominal GDP inputs, which may be captured independently. It is not an independently published BEA ratio or a historical first-release series. Reference quarters are matched exactly; changes are percentage points. Both flows are seasonally adjusted and in current dollars; GDP SAAR is divided by four once to obtain a quarterly flow.';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const isQuarterStart = date => typeof date === 'string' && /^(?!0000)\d{4}-(?:01|04|07|10)-01$/.test(date);
const quarterOrdinal = date => Number(date.slice(0, 4)) * 4 + (Number(date.slice(5, 7)) - 1) / 3;

/** Count the complete inclusive calendar without allocating or filling observations. */
export function currentAccountGdpQuarterSpan(startDate, endDate) {
  if (!isQuarterStart(startDate) || !isQuarterStart(endDate) || startDate > endDate) return 0;
  return quarterOrdinal(endDate) - quarterOrdinal(startDate) + 1;
}

function precedingQuarter(date) {
  if (!isQuarterStart(date)) return null;
  const year = Number(date.slice(0, 4)), month = Number(date.slice(5, 7));
  return month === 1 ? `${String(year - 1).padStart(4, '0')}-10-01` : `${date.slice(0, 4)}-${String(month - 3).padStart(2, '0')}-01`;
}

/** Missing raw NIPA metadata uses its admitted registry convention, never a guessed conversion. */
function metadataIssue(series, expectedId, definition, label) {
  if (!Array.isArray(series?.sourceIds) || series.sourceIds.length !== 1 || series.sourceIds[0] !== expectedId) return `Incompatible ${label} source identity; expected ${expectedId}.`;
  for (const field of ['unit', 'frequency', 'adjustment', 'dateConvention', 'periodType']) {
    if (series[field] !== undefined && series[field] !== definition[field]) return `Incompatible ${label} ${field}; expected ${definition[field]}.`;
  }
  return null;
}

function calendarIssue(series, label) {
  if (!Array.isArray(series?.observations)) return `${label} observations are missing.`;
  const dates = new Set();
  for (const observation of series.observations) {
    if (!isQuarterStart(observation?.date)) return `Invalid ${label} quarter date; expected an exact quarter-start reference date.`;
    if (dates.has(observation.date)) return `Duplicate ${label} quarter date ${observation.date}; no arbitrary observation is selected.`;
    dates.add(observation.date);
  }
  return null;
}

/** Validate each source once and index exact reference quarters without nearest-date matching. */
export function currentAccountGdpRatioInputs(sources, numeratorId = 'currentAccountBalance') {
  const definition = currentAccountRegistry[numeratorId];
  const locator = currentAccountDefinitions.find(([id]) => id === numeratorId);
  const label = numeratorId === 'currentAccountBalance' ? 'current-account' : definition?.name ?? String(numeratorId);
  const labelSentence = label.charAt(0).toUpperCase() + label.slice(1);
  const numerator = sources?.beaIta?.series?.[numeratorId];
  const denominator = sources?.bea?.series?.nominalGdp;
  const observations = Array.isArray(numerator?.observations) ? numerator.observations : [];
  const dates = observations.every(row => typeof row?.date === 'string') ? observations.map(row => row.date).sort() : [];
  const numeratorCalendarIssue = calendarIssue(numerator, label);
  const numeratorIssue = !definition || !locator ? `Unadmitted current-account numerator ${label}.` : metadataIssue(numerator, itaLocator(locator[1]), definition, label) || numeratorCalendarIssue;
  const denominatorIssue = metadataIssue(denominator, 'A191RC', economicDepthRegistry.nominalGdp, 'nominal GDP') || calendarIssue(denominator, 'nominal GDP');
  const numerators = numeratorIssue ? new Map() : new Map(numerator.observations.map(row => [row.date, row]));
  const denominators = denominatorIssue ? new Map() : new Map(denominator.observations.map(row => [row.date, row]));
  const point = referenceDate => {
    const numeratorObservation = numerators.get(referenceDate) ?? null;
    const denominatorObservation = denominators.get(referenceDate) ?? null;
    const currentAccountBalance = !numeratorIssue && finite(numeratorObservation?.value) ? numeratorObservation.value : null;
    const nominalGdpSaar = !denominatorIssue && finite(denominatorObservation?.value) ? denominatorObservation.value : null;
    const nominalGdpQuarter = nominalGdpSaar !== null && nominalGdpSaar > 0 ? nominalGdpSaar / 4 : null;
    let reason = numeratorIssue || denominatorIssue;
    if (!reason && !referenceDate) reason = `${labelSentence} quarter date is unavailable.`;
    if (!reason && currentAccountBalance === null) reason = `${labelSentence} observation is missing or nonfinite for ${referenceDate}.`;
    if (!reason && nominalGdpSaar === null) reason = `Nominal GDP observation is missing or nonfinite for ${referenceDate}.`;
    if (!reason && nominalGdpQuarter === null) reason = `Nominal GDP must be positive for ${referenceDate}.`;
    const calculated = reason ? null : 100 * currentAccountBalance / nominalGdpQuarter;
    if (!reason && !finite(calculated)) reason = 'Current-account-to-GDP calculation is nonfinite; ratio unavailable.';
    return {
      date: referenceDate, value: reason ? null : calculated,
      currentAccountBalance, nominalGdpSaar, nominalGdpQuarter, reason,
      numeratorObservation, denominatorObservation,
    };
  };
  return { dates, numeratorCalendarIssue, error: numeratorIssue || denominatorIssue, point };
}

/** Match quarterly ITA amounts with nominal GDP flows without annualizing either input twice. */
export function currentAccountGdpContext(sources = {}) {
  const { dates, point } = currentAccountGdpRatioInputs(sources);
  // Include a retained null latest balance; never move the result to an older overlap.
  const date = dates.at(-1) ?? null;
  const previousDate = precedingQuarter(date);
  const current = point(date), previous = point(previousDate);
  return {
    date, previousDate, current, previous,
    change: finite(current.value) && finite(previous.value) ? current.value - previous.value : null,
    formula: CURRENT_ACCOUNT_GDP_FORMULA, notice: NOTICE,
  };
}

/** Quarter gaps are calculated unavailable rows, never invented official observations. */
function quarterCalendar(startDate, endDate) {
  if (!currentAccountGdpQuarterSpan(startDate, endDate)) return [];
  const dates = [];
  for (let quarter = quarterOrdinal(startDate), end = quarterOrdinal(endDate); quarter <= end; quarter++) {
    dates.push(`${String(Math.floor(quarter / 4)).padStart(4, '0')}-${String(quarter % 4 * 3 + 1).padStart(2, '0')}-01`);
  }
  return dates;
}

/** Full retained revised history, selected with the same date windows as official series charts. */
export function currentAccountGdpHistory(sources = {}, range = { preset: 'all' }) {
  const inputs = currentAccountGdpRatioInputs(sources);
  const span = currentAccountGdpQuarterSpan(inputs.dates[0], inputs.dates.at(-1));
  const spanError = span > MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS ? `Retained current-account GDP history spans ${span} quarters, exceeding the ${MAX_CURRENT_ACCOUNT_GDP_HISTORY_QUARTERS}-quarter calculated-history limit.` : null;
  const dates = inputs.numeratorCalendarIssue || spanError ? [] : quarterCalendar(inputs.dates[0], inputs.dates.at(-1));
  const fullHistory = dates.map(inputs.point);
  const series = {
    id: 'currentAccountToGdp', name: 'Current account / nominal GDP', short: 'Current account / GDP',
    format: 'percent', precision: 2, unit: 'Percent of nominal GDP', frequency: 'Quarterly',
    dateConvention: 'quarter-start', adjustment: 'Seasonally adjusted', comparisonClass: 'rate',
    observationType: 'calculated', observations: fullHistory,
  };
  const window = resolveDateWindow(range, [series]);
  return {
    series, observations: windowObservations(fullHistory, window), window,
    error: window.error || inputs.error || spanError, formula: CURRENT_ACCOUNT_GDP_FORMULA, notice: NOTICE,
  };
}
