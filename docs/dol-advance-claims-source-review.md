# Separate DOL advance weekly claims release

Reviewed October 22, 2026. This admits national regular UI seasonally adjusted initial claims and insured unemployment (continued claims) from the latest official weekly news release. It adds `dolAdvance` as a separate refresh source and `claimsAdvance` / `continuedClaimsAdvance` as separate measurements. It does not modify or splice into the revised historical XML series.

## Official source and reuse

The [official ETA archive](https://oui.doleta.gov/unemploy/claims_arch.asp) explicitly identifies [DOL's current release PDF](https://www.dol.gov/ui/data.pdf) as the latest complete news release. Dated newsroom links redirect to PDFs; the newsroom index contains only an initial-claims summary and cannot supply both measurements. Only the exact current PDF URL is admitted for collection/provenance. Unexpected redirects or substituted feeds fail closed. The release can change at that URL; immutable captures retain the extracted facts, actual byte hash and retrieval evidence rather than claiming the URL itself is immutable.

[DOL's copyright policy](https://www.dol.gov/general/aboutdol/copyright), directly retrieved successfully during review, permits public-domain federal materials to be used, reproduced and distributed without permission. This scoped commercial display/export admission covers the agency-authored factual regular UI statistics. No contrary copyright notice was found. Retain DOL ETA credit and the policy link; exclude logos, embedded charts, other protected material, copied page design and implied endorsement. Public access alone is not the reuse basis.

`InitialClaims/SA/Release` and `ContinuedClaims/SA/Release` are Meridian semantic field mappings for the PDF's labels, not claimed agency API codes. Both retain the agency's original count strings and divide the counts by 1,000 for display. The PDF labels continued claims as **insured unemployment**; it is not all unemployment, unique people, all benefit programs or a newly calculated unemployment rate.

## Verified current and earlier releases

The current October 22 release PDF was retrieved at October 22, 2026, 20:52:11.508 UTC: 548,860 bytes, SHA256 `6bc739a9ccf4035720b6f09b6108c9800bb3d35bedb358938eaefa009ab974f8`. It is USDL 26-1613-NAT. Research receipts, raw PDFs, extracted text and `verified-source-cases.json` remain under ignored `test-results/dol-advance-research`.

| Printed release day | Initial advance reference / count | Same-release prior reference / count | Continued advance reference / count | Same-release prior reference / count |
| --- | --- | --- | --- | --- |
| 2026-10-22 | Oct 17 / 194,000 | Oct 10 / 200,000, revised from 199,000 | Oct 10 / 1,728,000 | Oct 3 / 1,703,000, revised from 1,710,000 |
| 2026-10-08 | Oct 3 / 197,000 | Sep 26 / 199,000, revised from 197,000 | Sep 26 / 1,716,000 | Sep 19 / 1,699,000, revised from 1,701,000 |
| 2026-09-17 | Sep 12 / 196,000 | Sep 5 / 206,000, explicitly unrevised | Sep 5 / 1,730,000 | Aug 29 / 1,769,000, revised from 1,774,000 |
| 2026-01-08 | Jan 3, 2026 / 208,000 | Dec 27, 2025 / 200,000, revised from 199,000 | Dec 27, 2025 / 1,914,000 | Dec 20, 2025 / 1,858,000, revised from 1,866,000 |

These four actual PDFs were checked using the implemented extractor/parser. The opening SA narrative and the independent regular-state-program SA table agree on counts, current/prior reference dates and signed weekly changes. The January case establishes calendar-year rollover. No older release is inserted into a historical advance time series merely because it was reviewed as a parser case.

Each current series retains exactly **two** rows: the current advance and the previous week's revised/unrevised comparison **as stated in the same release**. `releaseStage`, original prior count, explicit row footnotes, units, definition and methodology preserve that distinction. Ordinary changes compare these two compatible same-release counts. Initial and continued weeks are parsed independently; no shifts or copying align their latest dates. Native comparisons remain the default.

## Dates, cadence and limits

The printed release date is retained as `publishedAt:YYYY-MM-DD` with `publicationDatePrecision:'day'`; shared CSV's `publication_date` therefore contains a date, not an invented clock. The printed 08:30 Eastern embargo is announced timing, not proof of the historical server-publication instant. The collector rejects a future or unelapsed embargo using America/New_York DST rules but does not present that scheduled clock as an observed publication timestamp. Actual UTC retrieval, HTTP Last-Modified and PDF metadata dates remain distinct. Reference weeks must be valid Saturdays; an explicit previous week means seven days earlier, corroborated by the table dates.

DOL's weekly schedule and holiday exceptions are already separately admitted. Existing daily Actions runs collect the latest release, and a successful re-fetch need not mean a newer release exists. A release more than ten days old produces an explicit source warning. The historical XML feed retains its separate coverage/lag note and independent refresh outcome. Failure to fetch, extract or reconcile a release retains the prior successful advance capture under existing refresh semantics; it never substitutes historical XML counts. First failure leaves this source unavailable. The strict daily publication policy remains unchanged.

New captures are retained at actual retrieval time. As-known cutoffs before the first advance capture remain unavailable for these measurements. Each later release replaces the current two-row context, while immutable archive deltas and frozen packages preserve earlier captured contexts. This is capture history going forward, not a reconstruction of all historical first releases.

## Extraction, admission and integration

Use pinned `unpdf@1.9.1` (MIT; bundled Mozilla PDF.js under its included license) as a development-only Node collector dependency, installed with lockfile integrity using `npm ci --ignore-scripts`. It requires no service, credentials, Python, native canvas or new hosting. The static browser build contains neither this package nor the collector. PDF text parsing runs in an isolated Node worker with a 128 MiB heap limit and a 15-second termination timeout. Download input is bounded to 4 MiB; at most 16 PDF pages are accepted and only the first five are read, with text/item caps. Embedded evaluation, external font/resource fetches and rendering are disabled. No general PDF parser is hand-written.

The strict DOL text contract requires a unique dated SA header, valid release weekday, exact current/revised/unrevised wording, count and revision arithmetic, and independent matching SA table rows/dates. Unknown layouts fail closed for review. Admission independently checks the two IDs, exact URL/provenance, rights, units, scaling, dates, roles and separation from revised history. Narrow publication-note retention applies only to the new provider, preserving previous archive normalization contracts.

Registry/detail/search/watchlist/family/calendar/comparison/export components are reused. Reciprocal links distinguish advance context from revised history. Existing labor/history pages receive links rather than extra numerical panels outside their existing pin scope. Advance views can be frozen and exported through the existing package workflow.

## Acceptance evidence

The committed baseline was independently retrieved at **2026-10-22T21:06:41.532Z** and retains the same verified PDF SHA256 above. Its immutable 1,617-byte gzip capture is `5576eb8c3a2f90dbea3e7b15f94d817279defb1a52cd15d5ab1205ae0bda728b`. All 15 prior data sources, calendars, publication policy and all 35 earlier capture records/files remain exactly unchanged; the archive now contains 36 captures. A cutoff one millisecond before this retrieval exposes no advance source. At the retrieval cutoff, day precision, both row roles, source notices and values replay correctly.

Local verification: `npm ci --ignore-scripts` installs one locked package with no audit vulnerabilities; all **867 tests pass**. `npm run build` and the HTTP smoke check pass with **93 assets**, including all per-source history bundles. Tests cover calendar rollover/leap day, unrevised and unchanged comparisons, narrative/table disagreement, missing/unsafe input, PDF limits/timeouts, strict commercial admission, first failure, retained cached data, subsequent release replacement, immutable replay, CSV and frozen-package round trips. The full suite requires loopback and disposable test-repository Git access; a restricted-sandbox run was repeated with those permissions, without changing or skipping tests.

Browser checks retain Graphite and show correct independent initial/continued weeks and same-release prior values. Viewport checks at 320, 390, 736, 1,024 and 1,440 pixels have no horizontal page overflow. Home/End keyboard controls select 200k/194k on initial claims. Reciprocal history navigation keeps the revised series at its independently captured 1,714k through September 26, rather than inserting the advance 1,728k. Mobile More exposes Watchlist and closes with Escape; the advance Revisions view loads its source archive and explicitly reports no observed capture changes at this first baseline. Local evidence is under ignored `test-results/dol-advance-*`; no research PDFs or fabricated test values enter the app snapshot.
