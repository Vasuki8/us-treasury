/** Treasury rates are published par-curve observations, not transaction or zero-coupon yields. */
export const NOMINAL_YIELD_TENORS = Object.freeze(['1M','1.5M','2M','3M','4M','6M','1Y','2Y','3Y','5Y','7Y','10Y','20Y','30Y']);
export const REAL_YIELD_TENORS = Object.freeze(['5Y','7Y','10Y','20Y','30Y']);
export const YIELD_METHODOLOGY_CHANGE = '2021-12-06';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const rate = value => finite(value) ? value : null;
const clean = value => Number(value.toFixed(10));

function dateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid Treasury curve date');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== value) throw new Error('Invalid Treasury curve date');
  return value;
}

function capturedCurves(source) {
  const seen = new Set();
  return (source?.curveHistory ?? []).map(row => {
    dateKey(row.date);
    if (seen.has(row.date)) throw new Error(`Duplicate Treasury curve date: ${row.date}`);
    seen.add(row.date);
    return row;
  }).sort((a,b) => a.date.localeCompare(b.date));
}

/** Exact requested dates only; unavailable dates are explicit and no earlier curve is substituted. */
export function selectCurveOverlays(source, dates = []) {
  if (!Array.isArray(dates)) throw new Error('Treasury overlay dates must be an array');
  const curves = new Map(capturedCurves(source).map(row => [row.date,row]));
  return dates.map(date => {
    dateKey(date);
    const row = curves.get(date);
    const copyRates = (values,tenors) => Object.fromEntries(tenors.filter(tenor => Object.hasOwn(values ?? {},tenor)).map(tenor => [tenor,rate(values[tenor])]));
    return {
      date, available:Boolean(row),
      nominal:copyRates(row?.nominal,NOMINAL_YIELD_TENORS),
      real:copyRates(row?.real,REAL_YIELD_TENORS),
      methodology:date < YIELD_METHODOLOGY_CHANGE ? 'quasi-cubic-hermite-spline' : 'monotone-convex',
    };
  });
}

/** The difference includes inflation-risk and liquidity effects; it is not pure expected inflation. */
export function matchedYieldComponents(source, {tenor = '10Y'} = {}) {
  if (!REAL_YIELD_TENORS.includes(tenor)) throw new RangeError(`No matched Treasury real par yield tenor: ${tenor}`);
  return capturedCurves(source).map(row => {
    const nominal = rate(row.nominal?.[tenor]), real = rate(row.real?.[tenor]);
    return {
      date:row.date, tenor, nominal, real,
      inflationCompensationBps:nominal !== null && real !== null ? clean((nominal-real)*100) : null,
    };
  });
}
