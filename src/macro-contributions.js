/** Published NIPA 1.1.2 percentage-point contributions; no chained-dollar sums. */
export const GDP_CONTRIBUTION_COMPONENTS = Object.freeze([
  { id: 'consumption', label: 'Personal consumption expenditures' },
  { id: 'investment', label: 'Gross private domestic investment' },
  { id: 'government', label: 'Government consumption and investment' },
  { id: 'exports', label: 'Exports' },
  { id: 'imports', label: 'Imports (published contribution sign)' },
].map(Object.freeze));
const finite = value => typeof value === 'number' && Number.isFinite(value);
const rounded = value => Number(value.toFixed(10));
const roundingLimit = .075; // GDP to one decimal + five components to two decimals.

function quarterDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-(?:01|04|07|10)-01$/.test(value) || !Number(value.slice(0, 4))) throw new Error('Invalid GDP quarter date');
  return value;
}

export function validateContributionQuarter(row) {
  quarterDate(row?.date);
  const values = ['total', ...GDP_CONTRIBUTION_COMPONENTS.map(item => item.id)].map(id => row[id]);
  if (values.some(value => value !== null && value !== undefined && !finite(value))) throw new Error('Invalid GDP contribution value');
  if (!values.every(finite)) return { complete: false, sum: null, residual: null, roundingLimit };
  const sum = rounded(values.slice(1).reduce((total, value) => total + value, 0));
  const residual = rounded(row.total - sum);
  if (Math.abs(residual) > roundingLimit + 1e-10) throw new Error('GDP contribution reconciliation exceeds published rounding precision');
  return { complete: true, sum, residual, roundingLimit };
}

/** Accounting attribution describes release components, not a causal estimate. */
export function gdpContributionSummary(source = {}, { date: requestedDate } = {}) {
  const rows = source.quarterly ?? [];
  const seen = new Set();
  for (const row of rows) {
    quarterDate(row.date);
    if (seen.has(row.date)) throw new Error('Duplicate GDP contribution quarter');
    seen.add(row.date);
  }
  const row = requestedDate ? rows.find(item => item.date === requestedDate) : [...rows].sort((a, b) => a.date.localeCompare(b.date)).at(-1);
  if (!row) return null;
  const validation = validateContributionQuarter(row);
  const previousDate = new Date(Date.UTC(Number(row.date.slice(0, 4)), Number(row.date.slice(5, 7)) - 4, 1)).toISOString().slice(0, 10);
  const previous = rows.find(item => item.date === previousDate);
  const components = GDP_CONTRIBUTION_COMPONENTS.map(item => ({ ...item, value: finite(row[item.id]) ? row[item.id] : null, change: finite(row[item.id]) && finite(previous?.[item.id]) ? rounded(row[item.id] - previous[item.id]) : null }));
  const positives = components.filter(item => finite(item.value) && item.value > 0).sort((a, b) => b.value - a.value);
  const negatives = components.filter(item => finite(item.value) && item.value < 0).sort((a, b) => a.value - b.value);
  return { date: row.date, total: finite(row.total) ? row.total : null, components, complete: validation.complete, contributionSum: validation.sum, reconciliationResidual: validation.residual, roundingLimit, previousDate: previous?.date ?? null, growthChange: finite(row.total) && finite(previous?.total) ? rounded(row.total - previous.total) : null, largestPositive: validation.complete ? positives[0] ?? null : null, largestNegative: validation.complete ? negatives[0] ?? null : null, netExports: finite(row.exports) && finite(row.imports) ? rounded(row.exports + row.imports) : null, interpretation: 'Official BEA accounting contributions to quarter-over-quarter real GDP growth at an annual rate. These components describe the measured growth release; they do not establish economic causation. Imports already carry the published contribution sign.' };
}
