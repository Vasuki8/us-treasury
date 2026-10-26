export const DEBT_HISTORY_START = '1993-04-01';
const endpoint = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny';
const maxRows = 10000;

export function debtHistoryUrl(fields, cutoff) {
  return `${endpoint}?fields=${fields}&filter=record_date:gte:${DEBT_HISTORY_START},record_date:lte:${cutoff}&sort=-record_date&page%5Bsize%5D=${maxRows}`;
}

/** Keep the complete admitted history or fail; never silently keep only its newest page. */
export function requireCompleteDebtHistory(payload) {
  const meta = payload?.meta;
  if (!Array.isArray(payload?.data) || !payload.data.length || payload.data.length > maxRows
    || !Number.isInteger(meta?.count) || meta.count !== payload.data.length
    || meta['total-pages'] !== 1 || meta['total-count'] !== payload.data.length || payload.links?.next) {
    throw new Error('Treasury debt history has incomplete pagination or exceeds the reviewed single-page bound');
  }
}
