# Historical coverage expansion

User priority: broader data and historical coverage, retaining the existing interface and colors. This delivery extends existing admitted feeds; it adds no provider, credential, measurement or dependency.

| History | Previous start | Retained start | Observations in the verified October 25, 2026 delivery |
| --- | --- | --- | ---: |
| Treasury nominal/real curves and same-date indicators | 2022-01-03 | 2003-01-02 | 5,958 dates; 5,957 usable 10Y values |
| Industrial production | 2000-01 | 1919-01 | 1,293 months |
| Capacity utilization | 2000-01 | 1967-01 | 717 months |
| Housing starts | 2000-01 | 1959-01 | 813 months |
| Housing permits | 2000-01 | 1960-01 | 801 months |
| Housing completions | 2000-01 | 1968-01 | 705 months |

Treasury observations end October 23; the monthly series end September 2026. The main 10-year indicator shares the expanded nominal history. Forty-eight annual Treasury response receipts retain actual retrieval clocks and hashes. Missing dates and maturities remain unavailable; there is no carry-forward or nearest-date match. The 2008 real-curve input change is distinct from the 2021 nominal/real spline change.

These are currently published revised histories. Retrievals on the evening of October 25 in Toronto (October 26 UTC) do not establish historical publication timestamps or reconstruct original releases. Production remains an industrial-sector index, 2017=100; utilization remains percent; housing remains thousands of units at a seasonally adjusted annual rate. No reannualization, price adjustment or population normalization is added.

## Research behavior and practical limits

Coverage inventory and All/custom windows reach the actual earliest dates. Existing one-year defaults remain unchanged. Treasury CSVs resolve each new observation's exact annual input receipts without repeating every annual download on every row. The explicit opt-in is retained in capture replay and frozen catalogs; older frozen packages preserve their original CSV behavior.

Yield-page frozen results retain the requested window and required calculation lookback, the two selected curve overlays, windowed spread inputs, current readings on their independent dates, methods and actual source receipts. The scope is recorded in the package. Full histories remain on the website and in immutable captures. Wide windows and All-history packages keep every requested row or report the existing 12 MiB size limit; no rows are silently dropped and no limit is raised. Verified one-year and 2008 historical-overlay packages are about 3.0 MB and 0.58 MB; five-year and All yield-page packages exceed the cap. Browser-library storage retains its existing 3 MiB/session-only behavior.

Captured-by pins retain only the selected measurement's source history through the actual cutoff, including its original baseline and required metadata. Later backfills cannot inflate an earlier cutoff's context. Historical observations never inherit a new export rule from today's live catalog. New opted-in captured-by CSVs resolve exact input receipts; older CSV behavior remains unchanged. Some full captured-by analyses, including the earliest real-yield All-history pin, already exceeded the package cap before this delivery and still report that limit; full CSV downloads remain available separately. No duplicate-CSV deferral, package schema change or higher cap is introduced.

## Acceptance evidence

Source-specific regression tests were observed failing on the old cutoffs and passing after the changes. Additional integration checks exercise actual retained data through inventory, All/custom windows, CSV annual inputs and unknown publication dates. Package tests cover normal one-year saves, historical overlays, required lookback, exact CSV reconstruction and the explicit All-history cap.

The capture audit compares every existing overlap date/value, unchanged source families and calendars, and the complete original archive prefix. All overlap values match. All 143 original archive entries and files remain unchanged; six genuine new captures extend the archive to 149. The 19 other data-source families, calendars and release events remain unchanged. Hydration and commercial-data admission pass for all stored captures.

The complete test run passed 1,683 tests. After final replay fixes, 84 affected coverage, provenance, replay and package regression tests passed. Static build and HTTP smoke verification passed for all 163 assets, including every source-history bundle. Independent economist/investor and engineering reviews found no remaining blocking issue. Legacy generic and captured-by CSV comparisons passed byte-for-byte. Styles, app navigation, layout components and colors are unchanged.

## Deferred scope

Nominal-only Treasury history before 2003, debt history before 2017 and longer BLS windows require separate merge/paging/provenance treatment. Retail already retains the full admitted history from 1992. No new debt, labor, CPI, term-premium or auction-tail source is introduced by this delivery.
