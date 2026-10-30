# Refinancing exposure: source review and calculations

Reviewed October 21, 2026. This module uses Treasury's **Monthly Statement of the Public Debt (MSPD)**, dataset `015-BFS-2014Q1-11`. It measures currently outstanding marketable principal and illustrates interest sensitivity under explicit assumptions. It does not forecast future deficits, actual issuance or a government's ability to refinance.

## Exact sources and commercial reuse

- [MSPD dataset and dictionary](https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/).
- [Official metadata service](https://api.fiscaldata.treasury.gov/services/dtg/metadata/): identity, table definitions and coverage were checked against the live response.
- [Marketable detail API](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/mspd_table_3_market), table/API ID `139`.
- [Summary API](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/debt/mspd/mspd_table_1), table/API ID `27`.
- [Fiscal Data license and authorization](https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization) explicitly permits copying, adaptation, redistribution and commercial use of the offered data. This scoped review covers Treasury statistical security facts and calculations using those facts; it does not add a commercial market quote or outside identifier/reference-data service. Plain-text credit to Treasury/Bureau of the Fiscal Service and original retrieval provenance remain in the application and exports.

The live metadata reported monthly coverage **January 31, 2001 through September 30, 2026**, last updated **October 6, 2026**. MSPD is published on the fourth business day of each month for the preceding month end. The dictionary generically calls `record_date` a publication date; actual records and the dataset description identify it as the period-end/as-of observation date. The module preserves that date as `asOf` and leaves exact historical `publishedAt` unknown. Metadata update dates and response retrieval instants are not invented release instants.

MSPD's source dictionary describes its CUSIP field as third-party assigned. It is used internally to distinguish Treasury-issued securities and combine Treasury's own reopening rows. Raw CUSIPs are not published or exported. Each published security has a deterministic Meridian-generated opaque `securityId` (`meridian-` plus the first 20 hexadecimal digits of SHA-256 of the internal identifier); this is not an official Treasury or third-party identifier. This review does not approve enrichment from, bulk copying of, or access to a separately licensed CUSIP reference database. Future third-party identifier products or claims of separate CUSIP database licensing require their own review.

## API handling and valuation

The adapter requests about 36 months of exact official category totals and the latest full month of marketable detail and summary. All responses retain URL, SHA-256, retrieval timestamp and Last-Modified when supplied. Every page must be complete within the declared page size; unknown categories, malformed dates, duplicate or conflicting balances and failed reconciliations reject collection so the existing last-good-source mechanism can retain the previous capture.

Required detail fields are `record_date`, `security_type_desc`, `security_class1_desc`, `security_class2_desc`, `issue_date`, `maturity_date`, `interest_rate_pct`, `issued_amt`, `inflation_adj_amt`, `redeemed_amt`, and `outstanding_amt`. Treasury amounts are USD millions. Stored security principal is USD billions; the reusable `marketableDebt` series is USD trillions. `yield_pct` is an auction yield, not a current effective borrowing rate, and is not used as an observed scenario baseline.

Multiple rows can represent different issue dates/reopenings of the **same CUSIP**. Exactly one must carry its complete `outstanding_amt`; the other reopening balances are literal `null`. Summing issues as separate outstanding securities would double count. The adapter validates each CUSIP's dates, instrument, coupon and the identity:

`sum(issued_amt + redeemed_amt + inflation_adj_amt) = outstanding_amt`

It then reconciles each instrument sum to its exact official unmatured total, the historical category total, and table 1's overall marketable balance. Redemption values in the source are signed; the adapter does not take an absolute value. Asterisks and missing CUSIP balances are not zeros. Matured bill amounts marked `*` are excluded through the difference between published total and unmatured balances, rather than inventing a suppressed balance.

Eligible categories are bills, notes, bonds, TIPS and FRNs with future contractual maturities. Federal Financing Bank balances and matured-unredeemed principal are excluded and reconciled separately. Table 1 includes small intragovernmental holdings of marketable securities; the security-level maturity distribution cannot separate them, so it is explicitly **not a debt-held-by-the-public profile**. Nonmarketable debt and STRIPS holdings tables are not added. TIPS outstanding principal already includes accrued inflation adjustment; adding `inflation_adj_amt` again would double count.

## Calculation contract

`collectRefinancing({fetchImpl, now})` returns `id: 'refinancing'`, `asOf`, `unit: 'USD billions'`, standard `series.marketableDebt`, `securities`, `totals`, `fetchedAt`, `provenance`, and `warnings`.

Each security has a generated `securityId`, `type` (`Bill`, `Note`, `Bond`, `FRN`, `TIPS`), `maturityDate`, `principal`, `unadjustedPrincipal`, `inflationAdjustment`, and nullable `couponRatePct`. Totals include eligible principal, reported marketable principal, FFB, matured-unredeemed principal and table 1's reported public/intragovernmental balances. Ownership totals do not imply the eligible distribution is separable by owner. Original agency source links and hashes remain available for verification without redistributing raw third-party assigned identifiers.

`summarizeRefinancing(source)` calculates:

- Cumulative contractual principal maturing within **3, 12 and 24 calendar months**, inclusive of the end date. Month-end observations remain aligned to the corresponding future month end, including leap years.
- Bill share = unmatured bill principal / eligible principal × 100.
- Weighted-average remaining maturity = sum(principal × remaining calendar days / 365.25) / eligible principal. This calculated remaining maturity is not duration or a separately published Treasury WAM series.

Histories retain missing months and warnings without interpolation. TIPS future redemption values can change with subsequent inflation. Unknown or structurally invalid security profiles return unavailable, never zero exposure.

## Modeled rate scenarios

`refinancingScenario(source, {horizonMonths: 12, rateShockBps: 100, baselineRatePct: 4, frnResetLagDays: 7})` returns `dataStatus: 'modeled'`, the explicitly assumed baseline/scenario rates, signed within-horizon `accruedImpact`, `annualizedImpactAtHorizon`, instrument contributions, assumptions and limitations. Supported horizons are 3/12/24 months. The flat 4% default is a transparent hypothetical baseline, not a claim about observed borrowing rates.

Existing bills, fixed notes, fixed bonds and TIPS receive **no market-rate shock before maturity**. Currently outstanding principal is assumed refinanced at maturity into nominal fixed-rate debt and maintained through the horizon. Repeated hypothetical bill rollovers do not multiply the original exposure. Replacement interest sensitivity uses principal × change in modeled rate × actual calendar days remaining / 365; it is not an exact bill-discount formula or coupon-payment cash schedule.

[Treasury FRNs](https://www.treasurydirect.gov/marketable-securities/floating-rate-notes/) reset against the most recent 13-week bill auction, generally weekly. Their actual accrual also has a two-business-day lockout and a zero floor; see the [official FRN term sheet](https://www.treasurydirect.gov/files/laws-and-regulations/auction-regulations-uoc/frn-term-sheet.pdf). The model applies a disclosed seven-day reset lag and actual/360 interest sensitivity before maturity, then the replacement assumption above. It does not reconstruct future auction dates, actual issue spreads or the index path. Its baseline is an assumed all-in FRN rate. Modeled rates have an explicit zero floor; for replacement securities that is a scenario convention.

[TIPS](https://www.treasurydirect.gov/marketable-securities/tips/) retain fixed real coupons while their principal changes with inflation. The model holds current adjusted principal constant, assumes no further inflation, and preserves the remaining original-principal floor at maturity. Only assumed nominal replacement financing receives the nominal-rate shock; existing real coupons are not repriced.

These calculations are partial sensitivities. They do not estimate net budget interest, gross Treasury interest expense, deficits, valuation losses, total future issuance or default risk. At-horizon annualized sensitivity differs from interest accruing within the modeled period. Future deficits, cash-balance movements, buybacks, instrument mix and inflation are not projected.

## Verification evidence

Focused adapter/model tests were written and observed failing before implementation. Tests cover reopening nulls, duplicate/conflicting rows, source reconciliation, TIPS adjustment and redemption floor, missing data, missing months, pagination, future/invalid dates, leap-year month ends, bill/fixed/FRN repricing, signed shocks, zero floors and invalid scenario assumptions.

A live collection on October 21 (Toronto local date; October 22 UTC) passed all three exact official API responses: **463 securities**, **36 monthly observations**, eligible principal **$31.8312256 trillion**, calculated bill share **22.3621%**, calculated remaining maturity **5.81095 years** as of September 30. Three-, twelve- and twenty-four-month maturity balances were **$6.1588132T**, **$10.6401554T** and **$14.6421712T**. These are validation results for that capture, not permanently current observations. No data was fabricated to replace unavailable coverage.
