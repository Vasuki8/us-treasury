# Treasury yield research admission review

Reviewed 2026-10-21. This extends Meridian's existing Treasury adapter without changing its existing debt, yield detail or calendar records.

## Exact feeds and commercial reuse

The [nominal par-curve catalog record](https://catalog.data.gov/dataset/interest-rate-statistics-daily-treasury-yield-curve-rates) identifies dataset **015-DO-020**, published by Treasury's Office of Debt Management, and explicitly lists CC0 1.0. The separate [real par-curve record](https://catalog.data.gov/dataset/daily-treasury-real-yield-curve-rates) identifies **015-DO-036**, also explicitly CC0 1.0. These factual datasets support commercial display, calculation and CSV redistribution. This review does not apply those licenses to third-party quotations, logos, page design or copied methodology prose. Credit the U.S. Department of the Treasury, Office of Debt Management, without implying endorsement.

The annual CSV endpoints are:

- Nominal: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_yield_curve&field_tdr_date_value=2026&page&_format=csv`
- Real: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2026/all?type=daily_treasury_real_yield_curve&field_tdr_date_value=2026&page&_format=csv`

Replace both year positions together. Both returned HTTP 200. Actual nominal headers are Date, 1 Mo, 1.5 Month, 2 Mo, 3 Mo, 4 Mo, 6 Mo, 1 Yr, 2 Yr, 3 Yr, 5 Yr, 7 Yr, 10 Yr, 20 Yr, 30 Yr. Real headers are Date, 5 YR, 7 YR, 10 YR, 20 YR, 30 YR. Treasury's [developer notice](https://home.treasury.gov/developer-notice-xml-changes) documents the corresponding XML feed types and history availability: nominal since 1990 and real since 2003. The verified real XML fields are NEW_DATE and TC_5YEAR, TC_7YEAR, TC_10YEAR, TC_20YEAR, TC_30YEAR. Nominal identifiers use BC_ prefixes.

The collector requests current and four previous calendar years, two small CSVs at a time, with a 2 MiB response limit per file. Its live verification captured 1,200 dated curves, January 3, 2022–October 21, 2026, with ten hashed provenance records; normalized JSON was approximately 679 KB. Older official archives exist but are not loaded in this milestone. Failures preserve no invented replacement; the shared refresh policy decides publication.

## Interpretation and calculations

Treasury's [methodology](https://home.treasury.gov/policy-issues/financing-the-government/interest-rate-statistics/treasury-yield-curve-methodology) describes fitted par curves using indicative bid-side prices near 3:30 p.m. Eastern each trading day. These are not executed trades, spot/zero-coupon yields or live quotes. Usual availability is by 6 p.m. Eastern, with possible delays. Observation date is retained; the feeds do not establish historical release timestamps. Retrieval and Last-Modified metadata do not become publication dates or an as-known vintage.

- 2s10s: `(10-year nominal − 2-year nominal) × 100` basis points.
- 3m10y: `(10-year nominal − 3-month nominal) × 100` basis points.
- Matched inflation compensation: `(nominal par yield − real par yield) × 100`, same date and tenor, basis points. Available matching tenors are 5, 7, 10, 20 and 30 years. This calculated spread includes inflation-risk and liquidity effects; it is not pure expected inflation or an exact causal decomposition.

Missing dates/tenors remain missing; no carry-forward or nearest-date match is permitted. Zero and negative observations are retained. Exact historical overlays expose unavailable selected dates rather than substituting another day. Unknown numeric strings, duplicate dates/tenor headers and malformed rows fail closed.

The [methodology-change sheet](https://home.treasury.gov/policy-issues/financing-the-government/yield-curve-methodology-change-information-sheet) documents the December 6, 2021 replacement of quasi-cubic Hermite spline with monotone convex fitting for nominal and real curves. Older and newer overlays must identify their methodology era; do not rewrite the published past to remove that break.

## Term premium deferred

The [New York Fed Treasury Term Premia viewer](https://www.newyorkfed.org/research/data_indicators/term-premia-tabs) documents ACM model estimates at daily and end-of-month frequency, 1–10-year maturities, since 1961. It explicitly states these are not official Federal Reserve estimates. Its downloadable [ACMTermPremium.xls](https://www.newyorkfed.org/medialibrary/media/research/data_indicators/ACMTermPremium.xls) returned HTTP 200, approximately 10.16 MB. The viewer's monthly 10-year CSV is `https://www.newyorkfed.org/medialibrary/media/research/data_indicators/acmPlot_data.csv`, with RunDates, TERMYld, ACMFITYld and GSWYld columns.

The [New York Fed terms](https://www.newyorkfed.org/privacy/termsofuse) permit business reuse of data subject to attribution, source notices, labeling modifications, downstream terms and no endorsement. This is a conditional license, not public domain; staff reports have separate commercial redistribution restrictions. Workbook-specific notices, schema and input licensing still require admission review, so no ACM values or staff-report content are integrated. Even if admitted, ACM fitted yields and model term premia must remain separate from Treasury CMT curves; subtracting a model component from a different curve would not produce an exact decomposition.

## Test evidence

Nine focused tests cover parsing, duplicates, missing observations and dates, exact-date matching, spreads/units, New Year boundaries, cutoff filtering, provenance, invalid captures, upstream failures, immutable overlay selections and the methodology-era boundary. The live read-only collector check succeeded; integration, UI and CSV acceptance checks remain the parent milestone's responsibility.
