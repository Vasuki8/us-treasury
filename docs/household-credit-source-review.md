# Household debt-service and bank delinquency context

Reviewed 2026-10-22; compatible bank-delinquency history extension reviewed 2026-10-26. This extends the independently reviewed credit context with five **Board-published aggregate statistical ratios**, using no keys or paid services. No underlying credit bureau records or bank-level reports are obtained or redistributed.

## Sources and rights

The [Board copyright/disclaimer policy](https://www.federalreserve.gov/disclaimer.htm) permits copying and distributing Board information unless otherwise indicated and requests source citation. The current [Household Debt Service Ratios release](https://www.federalreserve.gov/releases/dsr/default.htm), its linked XML and the [Board delinquency release](https://www.federalreserve.gov/releases/chargeoff/default.htm) contain no contrary notice for the selected Board-authored aggregate output. Commercial display and raw-value exports are admitted only for these exact aggregates, retaining Board/program attribution, source URLs, definitions, units and methodology. Accessibility is not the rights basis. This admission does not license Equifax/Consumer Credit Panel microdata, imagery, marks or other third-party material.

Exact keyless feeds, both verified HTTP 200 without redirects:

- `https://www.federalreserve.gov/releases/dsr/data/FRB_dsr_xml.zip`, exact member `DSR_data.xml`.
- `https://www.federalreserve.gov/releases/chgdel/data/FRB_CHGDEL_xml.zip`, exact member `CHGDEL_data.xml`.

The legacy lower-case `/releases/chargeoff/data/FRB_CHGDEL_xml.zip` link returns HTTP 301 to the second endpoint. The collector requests the verified destination directly; it does not allow arbitrary redirect following. The human release and methodology links remain available. Exact policy rules admit only the canonical files and selected series, not other CHGDEL fields.

The Board [DSR release](https://www.federalreserve.gov/releases/dsr/default.htm) is quarterly. The [delinquency methodology](https://www.federalreserve.gov/Releases/ChargeOff/about.htm) describes quarterly Call Report compilation, normally available about 60 days after quarter end. No exact historical publication instant is inferred from these schedules, the source XML `Prepared` field or retrieval. Numerical observation `publishedAt` remains null. Existing capture histories retain response hashes and retrieval instants separately.

## Household debt-service ratios: current methodology only

| Meridian ID | Exact source series | Native unit and basis |
| --- | --- | --- |
| householdDebtService | DSR_RATIO | Percent of aggregate disposable personal income; total required household debt payments, SA |
| mortgageDebtService | MORTGAGE_DSR_RATIO | Required mortgage payments / the same aggregate household disposable income, SA |
| consumerDebtService | CONSUMER_DSR_RATIO | Required consumer debt payments / the same aggregate household disposable income, SA |

The [current methodology](https://www.federalreserve.gov/releases/dsr/about.htm) begins in 2005. It uses scheduled required debt payments from credit bureau information and the NIPA disposable-income denominator. Mortgage payments can include bundled escrow taxes/insurance. These are aggregate ratios; they are not the median borrower's burden, individual debt-to-income underwriting ratios, debt outstanding/income, actual realized payment flows or delinquency rates. All three published series are retained directly at the XML's six-decimal precision. The total is not reconstructed from displayed rounded components.

The [Board's methodology-change note](https://www.federalreserve.gov/econres/notes/feds-notes/introducing-a-credit-bureau-based-measure-of-u-s-household-debt-service-20240904.html) explains differences from the older estimates. Credit-card payments represent required minimums; the current source provides the aggregate calculation, and Meridian does not recreate it from microdata. Archived [old DSR/Financial Obligations Ratio material](https://www.federalreserve.gov/releases/housedebt/default.htm) is not spliced into the current history. The old program stopped updating after the methodology transition in 2024. Selecting its longer 1980 history would change the measurement and create a false continuous series; it is excluded. The collector rejects current-series observations before 2005, verifies the exact series attributes and SA description, and records `methodology: credit-bureau-2024` for admission.

## Bank loan delinquency: narrower population and denominator

| Meridian ID | Exact source series | Native measure |
| --- | --- | --- |
| bankCardDelinquency | STFBQDCC%STFBAILCC_XEOP_MA.Q | Consumer credit-card delinquent loan dollars / matching end-of-quarter bank loans, SA percent |
| bankMortgageDelinquency | STFBQDSS%STFBAILSS_XEOP_XDO_MA.Q | Domestic-office residential real-estate delinquent loan dollars / matching end-of-quarter loans, SA percent |

The [official all-bank SA release](https://www.federalreserve.gov/Releases/ChargeOff/delallsa.htm) defines the population as insured U.S.-chartered commercial banks. Delinquency includes loans at least 30 days past due and still accruing plus loans in nonaccrual status. Residential lending includes one-to-four-family properties and home-equity lines of credit. These measures cover dollar balances, not the fraction of borrowers, all lenders, all household debts or a default probability. The population differs from H.8's all-commercial-bank universe and from the credit-bureau-based household debt-service ratio.

Delinquency uses end-of-period loan amounts and is **not annualized**. The program's net charge-off rates use a different flow/average-loan denominator and annualization; they are not admitted here. Metadata checks reject charge-off fields, NSA variants, top-100-only subsets and different loan categories. New captures retain the same series from a provider-specific 1991-01-01 floor, with first actual source quarter 1991-03-31. History includes source revisions and accounting/classification changes; no continuity adjustment, backfilled original vintage or cause of a change is inferred. The [Board methodology](https://www.federalreserve.gov/Releases/ChargeOff/about.htm) describes adjustments for pre-2001 small banks' internal loan classifications; the release also notes the 2008:1 fair-value accounting change and earlier reporting revisions. These are source limitations, not reasons to hide valid observations. The distinct DSR methodology floor remains 2005 and is not relaxed with the delinquency floor.

## Implementation, export and validation

The existing bounded ZIP/SDMX reader in `scripts/sources/credit-context.mjs` now exports `parseHouseholdDebtXml` / `collectHouseholdDebt` and `parseLoanDelinquencyXml` / `collectLoanDelinquency`. The independent provider IDs are `householdDebt` and `loanDelinquency`. The registry and credit page add separate debt-service and delinquency groups. All five series have `comparisonClass: rate`, preventing ratio indexing, and preserve exact source quarter-end dates. Missing dates are not filled. Source values remain unchanged percent ratios; no rescaling or double annualization occurs.

`scripts/credit-context-policy.mjs` includes the two provider contracts and validates exact IDs, file URLs, member names, source title, attribution, units, SA/quarterly metadata, raw-value equality, valid source periods and the current DSR methodology. `creditContextCsv(sources)` retains definitions, units, source values, citation/rights, dates and capture provenance for the added fields; the page follows the registry's two-decimal displayed precision. The main implementation adds the two independent collectors to refresh/freshness and performs final application-wide verification.

Original implementation live captures in ignored `test-results/report-credit/householdDebt.json` and `loanDelinquency.json` passed these admission checks. DSR retained 86 quarterly observations per measure from 2005-03-31 to 2026-06-30; latest total/mortgage/consumer values were 11.111439 / 5.829946 / 5.281493 percent of disposable personal income. Delinquency retained 106 observations per measure from 2000-03-31 to 2026-06-30; latest credit-card/residential values were 2.85 / 1.86 percent of the matching bank loan amounts. Dates are reference quarters, not publication dates.

The 2026-10-26 extension review's fresh exact CHGDEL receipt, captured at `2026-10-27T03:36:54.978Z` (October 26 Eastern), contains 142 quarterly observations per delinquency series from 1991-03-31 through 2026-06-30. This adds 36 rows to each existing series, with all original overlaps unchanged and the same exact source identifiers, SA metadata, raw percentage strings, end-quarter dates and null publication clocks. The first card/residential source values are `5.26` and `3.10`; published trailing precision is preserved. DSR remains at all 86 current-method quarters, with no older-method splice. Small real-source boundary regressions cover parsing and admission; existing immutable 2000-start captures and frozen packages retain their original contents. Final source refresh and archive-wide/package verification belong to the main implementation.

Tests cover current-methodology inception and SA metadata, incorrect units, invalid quarter dates, charge-off/NSA/top-100 substitution, impossible delinquency shares, exact canonical requests, ZIP provenance, source-policy admission, no methodology splicing, rate classification, distinct export denominators and displayed precision. No changes to published snapshots, immutable histories or frozen packages are made by these collectors.
