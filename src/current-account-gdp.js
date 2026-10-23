import { currentAccountRegistry } from './current-account-registry.js';
import { economicDepthRegistry } from './economic-depth-registry.js';

export const CURRENT_ACCOUNT_GDP_FORMULA = '100 × current-account balance (USD billions per quarter) / (nominal GDP (USD billions, SAAR) / 4)';
const NOTICE = 'Meridian calculated ratio using retained revised BEA current-account and nominal GDP inputs, which may be captured independently. It is not an independently published BEA ratio or a historical first-release series. Reference quarters are matched exactly; changes are percentage points. Both flows are seasonally adjusted and in current dollars; GDP SAAR is divided by four once to obtain a quarterly flow.';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const isQuarterStart = date => typeof date === 'string' && /^(?!0000)\d{4}-(?:01|04|07|10)-01$/.test(date);

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

/** Match quarterly ITA amounts with nominal GDP flows without annualizing either input twice. */
export function currentAccountGdpContext(sources = {}) {
  const numerator = sources?.beaIta?.series?.currentAccountBalance;
  const denominator = sources?.bea?.series?.nominalGdp;
  const observations = Array.isArray(numerator?.observations) ? numerator.observations : [];
  // Include a retained null latest balance; never move the result to an older overlap.
  const date = observations.every(row => typeof row?.date === 'string') ? observations.map(row => row.date).sort().at(-1) ?? null : null;
  const previousDate = precedingQuarter(date);
  const numeratorIssue = metadataIssue(numerator, 'ITA:T1.1:line30:World:SA:Q', currentAccountRegistry.currentAccountBalance, 'current-account') || calendarIssue(numerator, 'current-account');
  const denominatorIssue = metadataIssue(denominator, 'A191RC', economicDepthRegistry.nominalGdp, 'nominal GDP') || calendarIssue(denominator, 'nominal GDP');
  const point = referenceDate => {
    const numeratorObservation = numeratorIssue ? null : numerator.observations.find(row => row.date === referenceDate) ?? null;
    const denominatorObservation = denominatorIssue ? null : denominator.observations.find(row => row.date === referenceDate) ?? null;
    const currentAccountBalance = !numeratorIssue && finite(numeratorObservation?.value) ? numeratorObservation.value : null;
    const nominalGdpSaar = !denominatorIssue && finite(denominatorObservation?.value) ? denominatorObservation.value : null;
    const nominalGdpQuarter = nominalGdpSaar !== null && nominalGdpSaar > 0 ? nominalGdpSaar / 4 : null;
    let reason = numeratorIssue || denominatorIssue;
    if (!reason && !referenceDate) reason = 'Current-account quarter date is unavailable.';
    if (!reason && currentAccountBalance === null) reason = `Current-account observation is missing or nonfinite for ${referenceDate}.`;
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
  const current = point(date), previous = point(previousDate);
  return {
    date, previousDate, current, previous,
    change: finite(current.value) && finite(previous.value) ? current.value - previous.value : null,
    formula: CURRENT_ACCOUNT_GDP_FORMULA, notice: NOTICE,
  };
}
