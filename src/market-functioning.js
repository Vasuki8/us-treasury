export const NY_FED_TERMS_URL = 'https://www.newyorkfed.org/privacy/termsofuse';
export const NY_FED_DATA_NOTICE = '© 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org. Redistributed content remains subject to the same permissions, conditions and restrictions in those Terms of Use.';
export const NY_FED_REFERENCE_RATE_NOTICE = 'The SOFR and EFFR data are subject to the Terms of Use posted at newyorkfed.org. The New York Fed is not responsible for publication of the SOFR and EFFR data by Meridian, does not endorse any particular republication, and has no liability for your use.';
export const NY_FED_PRODUCT_NOTICE = 'Meridian is not affiliated with the New York Fed. The New York Fed does not sanction, endorse, or recommend any products or services offered by Meridian.';
export const MARKET_FUNCTIONING_LIMITATION = 'These are partial indicators from different markets and reporting periods, not a definitive liquidity or default-risk score. Dealer data cover primary dealers rather than the whole market, may be revised, and are not audited by the New York Fed. Suppressed values remain missing. Fails can persist across days and involve both a delivery and a receipt; they are not unique defaults.';
export const DEALER_METRICS = Object.freeze({
  dealerNetTreasury:{key:'PDPOSGST-TOT',measure:'Wednesday net position stock at fair value'},
  dealerRepo:{key:'PDSORA-UTSETTOT',measure:'Wednesday repurchase financing outstanding'},
  dealerReverseRepo:{key:'PDSIRRA-UTSETTOT',measure:'Wednesday reverse-repurchase financing outstanding'},
  dealerFailsDeliver:{key:'PDFTD-USTET',measure:'Cumulative weekly failed-delivery amounts'},
  dealerFailsReceive:{key:'PDFTR-USTET',measure:'Cumulative weekly failed-receipt amounts'},
});
const finite = value => typeof value === 'number' && Number.isFinite(value);
const clean = value => Number(value.toFixed(10));

function index(rows = []) {
  const result = new Map();
  for (const row of rows) {
    if (typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || new Date(`${row.date}T00:00:00Z`).toISOString().slice(0,10) !== row.date) throw new Error('Invalid market indicator date');
    if (result.has(row.date)) throw new Error('Duplicate market indicator date');
    result.set(row.date,row);
  }
  return result;
}

/** A same-date difference between two distinct funding markets, not a causal credit/liquidity decomposition. */
export function fundingRateDifference(sofr = [], effr = []) {
  const secured = index(sofr), unsecured = index(effr);
  return [...new Set([...secured.keys(),...unsecured.keys()])].sort().map(date => {
    const left = secured.get(date), right = unsecured.get(date);
    return {date,value:finite(left?.value) && finite(right?.value) ? clean((left.value-right.value)*100) : null,publishedAt:null,revisionIndicator:left?.revisionIndicator === 'Y' || right?.revisionIndicator === 'Y' ? 'Y' : ''};
  });
}

/** Each measure keeps its own basis. A missing/suppressed final value never falls back to an older print. */
export function dealerWeeklyChanges(source = {}) {
  return Object.entries(DEALER_METRICS).filter(([id]) => source?.series?.[id]?.observations?.length).map(([id,definition]) => {
    const values = index(source.series[id].observations), date = [...values.keys()].sort().at(-1);
    const previousDate = new Date(Date.parse(`${date}T00:00:00Z`)-7*86400000).toISOString().slice(0,10);
    const current = values.get(date)?.value, previous = values.get(previousDate)?.value;
    return {id,date,previousDate,current:finite(current) ? current : null,previous:finite(previous) ? previous : null,change:finite(current) && finite(previous) ? clean(current-previous) : null,unit:'USD billions',measure:definition.measure};
  });
}
