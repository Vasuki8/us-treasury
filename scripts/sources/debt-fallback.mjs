import { requestBytes } from './http.mjs';
import { DTS_DEBT_DATE, DTS_DEBT_URL, DTS_DEBT_SHA256, isDtsDebtFallbackRow } from '../../src/debt-fallback.js';

/** Exact reviewed bytes bind the literal facts, so a second PDF parser adds no evidence. */
export async function collectDebtFallback(payload, { cutoff = '9999-12-31', fetchImpl = globalThis.fetch } = {}) {
  if (cutoff < DTS_DEBT_DATE || !payload?.data?.some(isDtsDebtFallbackRow)) return null;
  const { bytes: _bytes, ...receipt } = await requestBytes(DTS_DEBT_URL, {
    maxBytes: 1024 * 1024,
    headers: { Accept: 'application/pdf' },
    fetchImpl: async (url, options) => {
      const response = await fetchImpl(url, { ...options, redirect: 'error' });
      if (response.redirected || (response.url && response.url !== url)) throw new Error('Unreviewed DTS debt PDF source URL or redirect');
      return response;
    },
  });
  if (receipt.url !== DTS_DEBT_URL || receipt.sha256 !== DTS_DEBT_SHA256) throw new Error('DTS debt PDF SHA-256 does not match reviewed evidence');
  return receipt;
}
