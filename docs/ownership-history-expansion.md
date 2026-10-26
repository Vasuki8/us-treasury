# Treasury ownership history expansion

October 26, 2026. The user requested longer Treasury ownership history with the current UI and colors preserved. This extends the existing Federal Reserve Z.1 source; SOMA remains a separate 104-observation weekly dataset. No provider, key, measurement, valuation conversion or storage limit is added.

## Verified history and interpretation

The official F3.2.s CSV/dictionary contains **305 published period-end observations**: seven annual-end rows from **1945Q4–1951Q4**, followed by **298 contiguous quarters, 1952Q1–2026Q2**. Both registered foreign and Federal Reserve histories retain these exact dates. The early annual rows are not expanded into invented quarters. Generic changes remain changes between actual observations; specialist changes require the exact preceding quarter and remain unavailable across annual gaps.

Every period's 25 selected sectors and three totals is numeric in the reviewed release. All 305 periods reconcile exactly, without weakening the existing $25 million tolerance. Published zeros, negative household residuals, net dealer positions and valuation discrepancies are retained. Earlier zero tokens do not prove that a sector was measured over the full history. Missing source values continue to remain null.

The [official central-bank guide](https://www.federalreserve.gov/apps/fof/SeriesAnalyzer.aspx?s=LM713061103&t=) identifies fair-value stocks from combined quarterly reports beginning in 2012Q1 and H.4.1 as the earlier source. Pre-2012 Fed sector rows therefore carry a historical-source qualification, and the indicator definition and coverage note explain the method boundary. Published amounts are not adjusted or spliced. Current positions remain separate from weekly SOMA par-plus-TIPS holdings; changes in positions are not labeled purchases or sales.

The [original source and rights review](ownership-source-review.md) remains applicable. The September 11, 2026 release date describes the current revised vintage, not original historical publication dates. Actual retrieval clocks and source SHA256 remain distinct. Each new registered observation resolves to its own numerical feed: the Z.1 ZIP or the SOMA API. Admission rejects wrong-feed, hash/clock mismatch and unmarked source overrides. Legacy captures retain their original receipt scope and CSV behavior.

## Existing page and frozen-result scope

The page's current tables, 36-observation charts, layout, navigation and colors remain unchanged. All/custom indicator and comparison windows expose the longer histories. Ordinary Ownership CSV downloads include every retained Z.1 period and SOMA observation. Z.1 CSV evidence includes the ZIP and release page; SOMA rows retain only their own API receipt plus the required title, attribution and downstream terms.

The full specialist CSV is about 27 MB because it repeats interpretation and provenance on each row. Frozen ownership results retain the **complete source and selected input histories**, with a supplementary CSV for the existing 36-period Z.1 view plus all retained SOMA observations. The scope is explicitly recorded. Prior-quarter lookup uses the complete history before selecting attached rows, preserving the first attached period's valid comparison. This keeps the existing 8 MiB attachment and 12 MiB portable limits without dropping source inputs. Large packages continue to use the existing session-only browser-library warning and downloadable JSON.

## Capture and verification

The normal strict ownership-only CLI captured the source at **`2026-10-26T18:22:36.043Z`**, adding one genuine capture to the 182-entry baseline. Source evidence and independent parser/reconciliation proofs are retained under ignored `tmp/ownership-history-source-review/`.

Actual export verification covers **8,852 specialist CSV rows**: 8,540 Z.1 rows and 312 SOMA rows. It confirms 112 negative and 1,343 zero entries, 247 pre-2012 Fed qualifications and 175 unavailable annual-gap sector changes. The generic two-series All CSV contains 610 rows with exact ZIP receipts, and early custom level/change windows preserve native dates and actual retrieval evidence.

Actual default and All ownership packages measure **6,147,135 / 7,166,235 bytes**, with a **4,004,809-byte** supplementary attachment. They retain all 305 source/catalog periods and round-trip exact JSON, main CSV and attachments. A genuine prechange 3,902,892-byte package still imports/exports byte-for-byte with its original attachment. Source, CSV, pin and lineage tests were observed failing before their fixes and passing afterward; independent engineering review found no material blocker.

The independent archive audit verified all **182** baseline descriptors, compressed Git blobs, decoded capture objects and replay checkpoints exactly. All seven old ownership cutoffs retain their 36-observation registered histories and original generic CSV behavior. The new capture contains 305 observations in each Z.1 registered series and exact numerical-feed receipts. Historical replay still covers only the three registered series, not supplementary 25-sector tables. Complete sector history is preserved in current/frozen source context instead.

All 8,540 official sector/total values match the independently saved CSV. The numerical ZIP SHA256 is `b63af9755437df0fb88b7cf346f8f9eaeb22bf1aa2b5df1709334135c43de4b6`. Every current 36-period sector row and all 176 old registered overlap dates retain their values/publication fields; SOMA's 104 dates, values, components and terms remain exact. No provider numeric changes were observed. All other source objects, calendars and release schedules remain unchanged, including the expanded BLS labor histories and DOL revised-PDF tail.

The first full local run completed 1,787 tests: 1,784 passed and three new fixture tests failed because they inherited the newly marked long source while constructing short/unmarked replacement rows. The fixtures now explicitly construct the legacy 36/104 shape or preserve matching scoped receipts, and synthetic sector totals reconcile. A fresh 89-test run covering all affected ownership, pin, context, package, admission and vintage paths passes. Independent review confirmed the corrections preserve or strengthen the original assertions. No production gate, timeout or numerical check was weakened. The final-data build and all 163 local HTTP asset checks also pass. Final complete verification on both supported runtimes and live-deployment evidence follows.
