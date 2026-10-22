const TYPES = ['Bill', 'Note', 'Bond', 'FRN', 'TIPS'];
const DAY = 86400000;
const sum = values => values.reduce((total, value) => total + value, 0);
const finite = value => typeof value === 'number' && Number.isFinite(value);
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const instant = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(instant) && new Date(instant).toISOString().slice(0, 10) === value ? instant : null;
}
function valid(source) {
  if (!source || date(source.asOf) === null || !Array.isArray(source.securities) || !source.securities.length) return false;
  const seen = new Set();
  return source.securities.every(row => {
    if (!row || !/^meridian-[a-f0-9]{20}$/.test(row.securityId) || seen.has(row.securityId) || !TYPES.includes(row.type) || !finite(row.principal) || row.principal <= 0 || date(row.maturityDate) === null || row.maturityDate <= source.asOf) return false;
    if (row.type === 'TIPS' && (!finite(row.unadjustedPrincipal) || row.unadjustedPrincipal <= 0 || !finite(row.inflationAdjustment) || Math.abs(row.unadjustedPrincipal + row.inflationAdjustment - row.principal) > 1e-8)) return false;
    seen.add(row.securityId); return true;
  });
}
function horizon(asOf, months) {
  const start = new Date(date(asOf));
  const year = start.getUTCFullYear(), month = start.getUTCMonth(), day = start.getUTCDate();
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const destinationLast = new Date(Date.UTC(year, month + months + 1, 0));
  const destinationDay = day === last ? destinationLast.getUTCDate() : Math.min(day, destinationLast.getUTCDate());
  return new Date(Date.UTC(year, month + months, destinationDay)).toISOString().slice(0, 10);
}
const limitations = [
  'Final maturity and interest-rate repricing differ: FRNs reset before they mature; fixed coupons do not reset when market yields change.',
  'The profile excludes nonmarketable debt, Federal Financing Bank balances and matured-unredeemed balances. It includes small intragovernmental holdings and is not a public-only profile.',
  'TIPS balances include inflation adjustment as of the observation date. Future inflation and actual redemption amounts can change.',
];

export function summarizeRefinancing(source) {
  if (!valid(source)) return { status: 'unavailable', reason: 'A complete valid official maturity profile is unavailable.' };
  const { asOf, securities } = source;
  const totalPrincipal = sum(securities.map(row => row.principal));
  const weighted = rows => sum(rows.map(row => row.principal * (date(row.maturityDate) - date(asOf)) / DAY / 365.25));
  const byType = TYPES.map(type => {
    const items = securities.filter(row => row.type === type);
    const principal = sum(items.map(row => row.principal));
    return { type, principal, sharePct: principal / totalPrincipal * 100, weightedAverageMaturityYears: principal ? weighted(items) / principal : null };
  });
  return {
    status: 'ok', dataStatus: 'calculated', asOf, unit: 'USD billions', totalPrincipal,
    billSharePct: byType.find(row => row.type === 'Bill').sharePct,
    weightedAverageMaturityYears: weighted(securities) / totalPrincipal,
    maturing: [3, 12, 24].map(months => {
      const endDate = horizon(asOf, months);
      const principal = sum(securities.filter(row => row.maturityDate <= endDate).map(row => row.principal));
      return { months, endDate, principal, sharePct: principal / totalPrincipal * 100 };
    }), byType, limitations: [...limitations],
    methodology: 'Outstanding principal weights remaining calendar days to contractual maturity / 365.25. Horizons include the end date and preserve month-end alignment. This is a calculated remaining maturity, not duration or an official Treasury WAM series.',
  };
}

export function refinancingScenario(source, { horizonMonths = 12, rateShockBps = 100, baselineRatePct = 4, frnResetLagDays = 7 } = {}) {
  if (![3, 12, 24].includes(horizonMonths)) throw new RangeError('Scenario horizon must be 3, 12 or 24 months');
  if (!finite(rateShockBps) || Math.abs(rateShockBps) > 1000) throw new RangeError('Rate shock must be finite and within 1,000 basis points');
  if (!finite(baselineRatePct) || baselineRatePct < 0 || baselineRatePct > 30) throw new RangeError('Baseline rate assumption must be between 0 and 30 percent');
  if (!Number.isInteger(frnResetLagDays) || frnResetLagDays < 0 || frnResetLagDays > 30) throw new RangeError('FRN reset lag assumption must be 0–30 days');
  if (!valid(source)) return { status: 'unavailable', reason: 'A complete valid official maturity profile is unavailable.' };
  const { asOf, securities } = source;
  const endDate = horizon(asOf, horizonMonths);
  const start = date(asOf), end = date(endDate);
  const modeledRatePct = Math.max(0, baselineRatePct + rateShockBps / 100);
  const rateDifference = (modeledRatePct - baselineRatePct) / 100;
  const byType = TYPES.map(type => {
    let accruedImpact = 0, repricingPrincipal = 0;
    for (const row of securities.filter(item => item.type === type)) {
      const maturity = date(row.maturityDate);
      const replacementPrincipal = type === 'TIPS' ? Math.max(row.principal, row.unadjustedPrincipal) : row.principal;
      const replacementDays = Math.max(0, (end - maturity) / DAY);
      const floatingDays = type === 'FRN' ? Math.max(0, (Math.min(maturity, end) - start) / DAY - frnResetLagDays) : 0;
      // Each original principal appears once. Before maturity only FRNs reprice;
      // afterward constant-principal nominal replacement financing is assumed.
      accruedImpact += rateDifference * (row.principal * floatingDays / 360 + replacementPrincipal * replacementDays / 365);
      if (type === 'FRN' && end > start + frnResetLagDays * DAY) repricingPrincipal += row.principal;
      else if (maturity <= end) repricingPrincipal += replacementPrincipal;
    }
    return { type, repricingPrincipal, accruedImpact, annualizedImpactAtHorizon: repricingPrincipal * rateDifference };
  });
  return {
    status: 'ok', dataStatus: 'modeled', asOf, endDate, unit: 'USD billions', horizonMonths,
    rateShockBps, baselineRatePct, modeledRatePct, frnResetLagDays,
    accruedImpact: sum(byType.map(row => row.accruedImpact)),
    annualizedImpactAtHorizon: sum(byType.map(row => row.annualizedImpactAtHorizon)), byType,
    assumptions: [
      `The flat ${baselineRatePct}% baseline and ${modeledRatePct}% scenario rate are modeling assumptions, not observed borrowing rates or forecasts. A zero floor is assumed for replacement rates and applied to modeled FRN all-in rates.`,
      'Only currently outstanding principal is modeled. At maturity it is assumed fully refinanced into nominal fixed-rate debt and maintained through the horizon. This future financing is assumed, not observed issuance; repeated bill rollovers are not counted again as additional principal.',
      `FRNs reprice after an assumed ${frnResetLagDays}-day reset lag; their existing accrual uses actual/360. The lag approximates weekly resets and does not reconstruct auction dates or the two-business-day lockout. The assumed baseline is the all-in FRN rate; actual issue spreads and the future index path are not projected.`,
      'Bills and existing fixed-coupon notes, bonds and TIPS receive no market-rate shock before maturity. Replacement financing uses a simple actual/365 interest sensitivity, not auction discount pricing or a coupon-payment cash schedule.',
      'TIPS adjusted principal is held constant, assuming no additional inflation adjustment. At maturity the greater of that balance and the remaining original principal is refinanced, preserving the original-principal redemption floor. Assumed nominal replacement financing receives the shock; existing real coupons and accrued inflation do not.',
    ],
    limitations: [...limitations,
      'Incremental modeled interest sensitivity is not a forecast of net budget interest, gross Treasury interest expense, auction outcomes, market value losses, fiscal deficits or total financing requirements.',
      'Future deficits, cash-balance changes, buybacks, new issuance policy, inflation, index paths and changes in instrument mix are not projected. Annualized impact at the horizon differs from interest accrued within the horizon.',
    ],
  };
}
