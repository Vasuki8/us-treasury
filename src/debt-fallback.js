/** One reviewed exception: the published DTS row is rounded, never inferred cents. */
export const DTS_DEBT_DATE = '2025-08-04';
export const DTS_DEBT_URL = 'https://fiscaldata.treasury.gov/static-data/published-reports/dts/DailyTreasuryStatement_20250804.pdf';
export const DTS_DEBT_SHA256 = '2afa2b2497dc88fb4b14893681d127d651c868b7c3d46ad0c52455df7e6f5c9f';
export const DTS_PRIMARY_VALUES = Object.freeze({ debt_held_public_amt: '29523300148538.85', intragov_hold_amt: '7314864649375.46', tot_pub_debt_out_amt: '36828164797914.31' });
export const DTS_DEBT_VALUES = Object.freeze({ debt_held_public_amt: '29523300', intragov_hold_amt: '7314865', tot_pub_debt_out_amt: '36838165' });
export const DTS_DEBT_FIELDS = Object.freeze({ debt_held_public_amt: 'DTS:IIIC:closing:public', intragov_hold_amt: 'DTS:IIIC:closing:intragovernmental', tot_pub_debt_out_amt: 'DTS:IIIC:closing:gross' });
export const DTS_DEBT_NOTE = '2025-08-04 uses the official Daily Treasury Statement Table IIIC closing balances, reported in USD millions with USD 1,000,000 precision. The contradictory Debt-to-the-Penny amounts and their USD -10,000,000,000 reconciliation residual are retained. All three balances use the same rounded source row; no corrected cents are inferred. Historical publication time is unknown.';

export function isDtsDebtFallbackRow(row) {
  return row?.record_date === DTS_DEBT_DATE && Object.entries(DTS_PRIMARY_VALUES).every(([field, value]) => row[field] === value);
}

export function debtFallbackMetadata(field, receipt, primaryReceipt) {
  if (!Object.hasOwn(DTS_DEBT_VALUES, field) || receipt?.url !== DTS_DEBT_URL || receipt?.sha256 !== DTS_DEBT_SHA256 || !Number.isFinite(Date.parse(receipt.retrievedAt))
    || typeof primaryReceipt?.url !== 'string' || !primaryReceipt.url.startsWith('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?') || !/^[a-f0-9]{64}$/.test(primaryReceipt.sha256) || !Number.isFinite(Date.parse(primaryReceipt.retrievedAt))) throw new Error('Invalid reviewed DTS debt receipt or field');
  return {
    sourceValue: DTS_DEBT_VALUES[field], sourceUnit: 'USD millions', sourcePrecisionUSD: 1000000,
    sourceSeriesId: DTS_DEBT_FIELDS[field], sourceUrl: DTS_DEBT_URL, sourceSha256: DTS_DEBT_SHA256,
    retrievedAt: receipt.retrievedAt, publishedAt: null, reconciliation: 'official-rounded-fallback',
    reconciliationResidualUSD: -10000000000, primarySourceValues: { ...DTS_PRIMARY_VALUES },
    fallbackSourceValues: { ...DTS_DEBT_VALUES }, footnotes: [DTS_DEBT_NOTE],
    inputProvenance: [primaryReceipt, receipt],
  };
}
