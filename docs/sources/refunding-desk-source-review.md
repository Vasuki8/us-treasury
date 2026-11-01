# Treasury financing desks: official-source review

Reviewed 2026-11-01. Scope: `dtsDesk`, `ticHolders`, and `treasuryRefunding`. These collectors consume public Treasury statistics and documents without authentication. They do not admit executable market quotes, private dealer consensus, sovereign CDS, extraordinary-measure estimates, or a modelled X-date.

## Feeds and rights

| Source | Reviewed feed | Native units and date | Admission and reuse basis |
| --- | --- | --- | --- |
| DTS Table III-C | [Debt subject to limit API](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/debt_subject_to_limit) | Integer USD millions, daily business date, current revised vintage | Official Treasury federal statistics; [Fiscal Data API license and authorization](https://fiscaldata.treasury.gov/api-documentation/#license-and-authorization). Three-year `record_date` range, ascending date/line sort, 1,000 rows/page, at most 12 pages. |
| DTS Table I | [Operating cash API](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance) | Integer USD millions, daily business date | Same bounded contract. The named closing TGA row carries its current value in `open_today_bal`; the similarly named `close_today_bal` field is null in the reviewed current records. |
| TIC Table 5 | [Major foreign holders](https://ticdata.treasury.gov/Publish/slt_table5.html) | USD billions, one decimal, month-end stocks, revised rolling table | Official Treasury statistics. Exact country/aggregate labels, table identity, units and descending consecutive month columns are required. The captured source contains thirteen months. |
| Refunding documents | [Latest linked documents](https://home.treasury.gov/policy-issues/financing-the-government/quarterly-refunding/most-recent-quarterly-refunding-documents/) | USD billions; announcement dates, distinct forecast quarters, auction months and fiscal years | Official Treasury federal statements/statistics and Treasury-published anonymous survey aggregates. [Treasury site policies](https://home.treasury.gov/subfooter/site-policies-and-notices) remain attached. Other providers' presentation charts and columns are excluded. |

Attribution is `Source: U.S. Department of the Treasury.` The admission policy applies to the selected federal statistical material, not a blanket license for external content linked from Treasury. Receipts preserve each exact official URL, retrieval timestamp and SHA-256 of the retrieved body. Native values, normalized text and PDF cell coordinates remain available for deterministic arithmetic/table replay. The hashes identify captured response bodies; they do not make Treasury a signer of the normalized JSON.

## DTS legal arithmetic and closing cash

Debt subject to the limit uses six exact-date Table III-C components in this fixed order:

1. Debt held by the public.
2. Intragovernmental holdings.
3. Less other debt not subject to limit.
4. Less unamortized discount not subject to limit.
5. Less Federal Financing Bank debt not subject to limit.
6. Plus guaranteed agency debt subject to limit.

The sum is divided by 1,000 to obtain USD billions. Statutory headroom is the exact-date statutory limit less this sum. A missing component or suspended/unavailable limit remains null; gross federal debt is not substituted. This headroom does not include extraordinary-measure capacity.

The official 2026-10-29 fixture yields debt subject to limit of 40,390.776 billion and headroom of 713.220 billion. Its closing TGA row is 1,040.236 billion from native `open_today_bal = "1040236"`. Deposits and withdrawals are Table I cash flows that include financing transactions, not budget receipts and outlays.

The collector verifies native `CURRENCY0`/`$1,000,000` metadata, row tables, query bounds, page counts, total counts and stable pagination. Browser admission requires complete consecutive receipt pages, the exact query parameters and the correct endpoint/receipt for every series. It also checks native field/row labels and identical observation dates across all six series.

## TIC country semantics and rounding

The twenty named countries, `All Other`, grand total, and three official-holder aggregates use exact Table 5 labels. All countries share the same month grid and retain the published one-decimal strings. No extra precision, interpolation, purchase-flow inference or current-dollar scaling is added. Published rounded components need not add exactly to the rounded total.

Treasury's table notes explain that the geography follows reporting custodians and broker-dealers and can differ from ultimate beneficial ownership. Long-term holdings and bills have different valuation/reporting conventions; comparison with Z.1, SOMA or debt-to-the-penny requires their population and valuation differences to remain visible.

## Refunding document roles and reviewed example

The retained latest-document index binds five distinct roles to exact official links. Six unique receipts are required including the index. Series for package/new cash must reference the policy receipt; borrowing estimates must reference the financing-estimates receipt. URLs with credentials, query strings, fragments, unreviewed hosts, swapped roles or unrelated PDF/XML filenames are rejected.

The reviewed August 2026 set is:

- [Financing estimates, August 3](https://home.treasury.gov/news/press-releases/sb0584): July–September borrowing 739 billion with assumed September-end cash 950 billion; October–December borrowing 628 billion with December-end cash 850 billion. These are official projections, not observed borrowing or deposits.
- [Policy statement, August 5](https://home.treasury.gov/news/press-releases/sb0590): package 125 billion and new cash 28.7 billion. The package/maturing/new-cash identity must reconcile within the statement's published rounding. Nominal/FRN coupon rows distinguish historical auction sizes from anticipated sizes.
- [TBAC financing table](https://home.treasury.gov/system/files/221/TBACRecommendedFinancingTableByRefundingQuarter-08052026.pdf): six historical rows, three recommendations for the current refunding and three provisional indications. These are separate row types and are not Treasury decisions.
- [Treasury presentation](https://home.treasury.gov/system/files/221/TreasuryPresentationToTBACQ32026.pdf): only the page headed by longer-term privately-held borrowing estimates is retained. The selected primary-dealer 25th/median/75th percentiles describe FY2026–FY2028, not quarterly borrowing. Their native date is July 2026 (`asOfMonth: "2026-07"`, `datePrecision: "month"`), not August 3. Borrowing estimates are normalized to a 950 billion FY2026 cash balance held constant in later years. OMB, CBO and other columns are not substituted for dealer percentiles.
- [Tentative buyback XML](https://home.treasury.gov/system/files/221/Tentative-Buyback-ScheduleQ32026.xml): eighteen scheduled operations, with maximum purchase caps. The cap is not an offer, acceptance, cover ratio or completed buyback result. Operation, announcement and settlement dates remain separate; malformed/duplicate fields, unsafe XML declarations, invalid dates and nonfinite amounts are rejected.

Documents keep their own dates. A new Monday financing estimate can coexist with an older Wednesday policy statement while the next policy release is pending. Neither the source admission nor the PDF parser pins a release quarter or a publication-day pairing.

## Sparse TBAC cells and maintenance boundary

Flattened PDF text loses empty TIPS columns. The Node collector therefore retains the single official PDF page's text items, widths and coordinates. Browser replay derives the eleven columns from their actual tenor and Notes/Bonds/TIPS/FRN headers, assigns each numeric cell by horizontal position, and verifies row order, bounds, native values, section labels and twelve consecutive auction months. Missing TIPS cells remain null.

The real August table places the August 8 billion figure in 30-year TIPS, September 19 billion in 10-year TIPS and October 26 billion in 5-year TIPS. There is no hardcoded month-to-tenor rule. Tests move a native cell to another valid column to demonstrate that positions determine the mapping. A date-shifted structural test verifies later-quarter support; it is a test fixture, not a future official forecast.

The collector fails closed on changed table headers, a multi-page recommendation table, missing/duplicated cells, unexpected row counts, different native units, altered document-role labels or malformed monetary syntax. Those are format changes needing review, rather than reasons to infer numbers. Positive borrowing and new-cash statement forms are reviewed; a materially different paydown statement form requires a parser review instead of a guessed sign.

## Verification and capture migration

`node --test tests/treasury-desks.test.js` covers the official one-day DTS and rolling TIC fixtures, the real one-page TBAC PDF, native/legal arithmetic, sparse cells, later quarters, staggered releases, browser replay without Node globals, and mutations of query bounds, receipt roles, dates, labels, precision, units, values, XML and fiscal horizons.

The existing DTS/TIC audit candidates pass the stricter schema unchanged. The prior refunding candidate needs a rebuild: add the exact captured index to `documents.index`, add `recommendedGrid` and regenerated `recommended` text using `extractRefundingRecommendedPdf` on the retained original PDF, then regenerate `tables` with `parseRefundingDocuments`. Preserve the original exact receipts. No network recollection is needed for that migration.

The compact refunding JSON test fixture retains only the five relevant index anchors; its receipts refer to the original full response bodies. The original official TBAC PDF is included separately so Node extraction is tested against actual PDF bytes rather than only a synthesized grid. PDF.js reports two font-program warnings for this official PDF; extraction succeeds and the cell/text equality assertions pass.
