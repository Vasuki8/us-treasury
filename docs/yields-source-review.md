# Treasury yield research admission review

Reviewed 2026-10-21; historical coverage and methodology notes updated 2026-10-25. This extends Meridian's existing Treasury adapter without changing its existing debt, yield detail or calendar records.

## Exact feeds and commercial reuse

The [nominal par-curve catalog record](https://catalog.data.gov/dataset/interest-rate-statistics-daily-treasury-yield-curve-rates) identifies dataset **015-DO-020**, published by Treasury's Office of Debt Management, and explicitly lists CC0 1.0. The separate [real par-curve record](https://catalog.data.gov/dataset/daily-treasury-real-yield-curve-rates) identifies **015-DO-036**, also explicitly CC0 1.0. These factual datasets support commercial display, calculation and CSV redistribution. This review does not apply those licenses to third-party quotations, logos, page design or copied methodology prose. Credit the U.S. Department of the Treasury, Office of Debt Management, without implying endorsement.

The annual CSV endpoints are:

- Nominal: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv`
- Real: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_real_yield_curve&field_tdr_date_value=2026&page&_format=csv`

Replace both year positions together. Both returned HTTP 200. Actual nominal headers are Date, 1 Mo, 1.5 Month, 2 Mo, 3 Mo, 4 Mo, 6 Mo, 1 Yr, 2 Yr, 3 Yr, 5 Yr, 7 Yr, 10 Yr, 20 Yr, 30 Yr. Real headers are Date, 5 YR, 7 YR, 10 YR, 20 YR, 30 YR. Treasury's [developer notice](https://home.treasury.gov/developer-notice-xml-changes) documents the corresponding XML feed types and history availability: nominal since 1990 and real since 2003. The verified real XML fields are NEW_DATE and TC_5YEAR, TC_7YEAR, TC_10YEAR, TC_20YEAR, TC_30YEAR. Nominal identifiers use BC_ prefixes.

The collector requests paired nominal and real annual feeds from 2003 through the capture year, two small CSVs at a time, with a 2 MiB response limit per file. A 2026 capture requests 48 annual CSVs and retains a hashed receipt for each. The oldest 2003 feeds contain 250 dates, January 2–December 31, and their absent nominal 30-year and real 20-/30-year rates remain null. Empty past-year feeds, or past-year feeds with no usable 10-year observation, fail the capture rather than silently omit a year; an empty current-year response remains valid before its first publication when earlier usable observations exist. Individual missing tenors and dates remain missing. Wrong-year observations and nominal/real feed substitutions still fail closed. Failures preserve no invented replacement; the shared refresh policy decides publication.

This retention uses the agency's currently published revised history, not original release vintages. The capture cutoff only filters observation dates. Nominal history before 2003 remains deferred even though the agency offers it from 1990: the paired collector's null real observations would otherwise cite annual real URLs that were never captured. Any earlier nominal admission must preserve truthful per-observation provenance.

New yield measurements opt in to `inputProvenanceScope: observation-source-urls`. Their generic level CSV resolves only the retained annual receipts named by each observation's actual input URLs: one for nominal or real measures, two for matched inflation compensation. The main 10-year history additionally matches its stored response hash and retrieval timestamp. Changes and baseline comparisons also include their actual predecessor or baseline receipts and input URLs, including across year boundaries; no earlier input is invented or substituted. Missing, ambiguous or incomplete receipt evidence fails export. The exported retrieval clock comes from the actual matching receipt(s), separately from unknown publication time. Source captures retain every annual receipt without duplicating receipt objects on observation rows. Explicit row evidence keeps priority; unmarked older frozen packages retain their original full-receipt CSV and retrieval-clock behavior. The existing ratio-indexing eligibility rules remain in force.

## Interpretation and calculations

Treasury's [methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology) describes fitted par curves using indicative bid-side prices near 3:30 p.m. Eastern each trading day. These are not executed trades, spot/zero-coupon yields or live quotes. Usual availability is by 6 p.m. Eastern, with possible delays. Observation date is retained; the feeds do not establish historical release timestamps. Retrieval and Last-Modified metadata do not become publication dates or an as-known vintage.

- 2s10s: `(10-year nominal − 2-year nominal) × 100` basis points.
- 3m10y: `(10-year nominal − 3-month nominal) × 100` basis points.
- Matched inflation compensation: `(nominal par yield − real par yield) × 100`, same date and tenor, basis points. Available matching tenors are 5, 7, 10, 20 and 30 years. This calculated spread includes inflation-risk and liquidity effects; it is not pure expected inflation or an exact causal decomposition.

Missing dates/tenors remain missing; no carry-forward or nearest-date match is permitted. Zero and negative observations are retained. Exact historical overlays expose unavailable selected dates rather than substituting another day. Unknown numeric strings, duplicate dates/tenor headers and malformed rows fail closed.

The [methodology-change sheet](https://home.treasury.gov/policy-issues/financing-the-government/yield-curve-methodology-change-information-sheet) documents the December 6, 2021 replacement of quasi-cubic Hermite spline with monotone convex fitting for nominal and real curves. Older and newer overlays must identify their methodology era; do not rewrite the published past to remove that break.

Treasury's [real-curve series notes](https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_real_yield_curve) separately document a December 1, 2008 TIPS input break: knot points changed from all securities to the most recently auctioned TIPS. The notes explicitly retain September 2–November 28, 2008 values under the prior method as official. This input selection change is distinct from the 2021 spline change and does not apply to nominal curves. Capture metadata retains both breaks. Overlays preserve the existing spline-method field and add the real input era; curve CSV exports include `real_curve_inputs` for real yields and inflation compensation, leaving that field blank for nominal rates.

## Term premium deferred

The [New York Fed Treasury Term Premia viewer](https://www.newyorkfed.org/research/data_indicators/term-premia-tabs) documents ACM model estimates at daily and end-of-month frequency, 1–10-year maturities, since 1961. It explicitly states these are not official Federal Reserve estimates. Its downloadable [ACMTermPremium.xls](https://www.newyorkfed.org/medialibrary/media/research/data_indicators/ACMTermPremium.xls) returned HTTP 200, approximately 10.16 MB. The viewer's monthly 10-year CSV is `https://www.newyorkfed.org/medialibrary/media/research/data_indicators/acmPlot_data.csv`, with RunDates, TERMYld, ACMFITYld and GSWYld columns.

The [New York Fed terms](https://www.newyorkfed.org/privacy/termsofuse) permit business reuse of data subject to attribution, source notices, labeling modifications, downstream terms and no endorsement. This is a conditional license, not public domain; staff reports have separate commercial redistribution restrictions. Workbook-specific notices, schema and input licensing still require admission review, so no ACM values or staff-report content are integrated. Even if admitted, ACM fitted yields and model term premia must remain separate from Treasury CMT curves; subtracting a model component from a different curve would not produce an exact decomposition.

## Test evidence

Focused yield tests cover parsing, duplicates, missing observations and dates, exact-date matching, spreads/units, New Year boundaries, cutoff filtering, provenance, invalid captures, upstream failures and immutable overlay selections. Historical retention tests require every annual nominal/real pair from 2003, at most two concurrent requests, early missing tenors and signed rates, rejection of empty past-year feeds, both methodology boundaries, and the CSV's real-input disclosure. Historical observations and archives are refreshed only through the collector, never hand-edited.
