# Website review milestone 3: repeatable research

Implemented October 22, 2026 against the review's third milestone and saved-result acceptance task. Graphite remains the default; existing research, watchlist, search, comparison, export and deployment paths remain in place.

This document records the initial milestone release. Its original three-publication sample was subsequently expanded without altering those records; see the [GDP publication expansion and acceptance evidence](gdp-publication-history-expansion.md) for current coverage and limits.

## Delivered behavior

- Named workspaces retain validated configuration and reopen current observations. Updating or renaming a workspace preserves its identity.
- Separate pinned packages freeze up to four measurements, all retained inputs, displayed values/window/baselines, calculation version, original CSV, assumptions, source identifiers, retrieval provenance and redistribution notices. Specialist pages also retain their scoped inputs and original exports. Calendar pins retain the currently filtered schedule; Captured by pins use the actual selected historical cutoff and captured measurement metadata.
- Portable JSON import reconstructs read-only results with captured metadata, even if a measurement is removed from the current registry. Charts, resizing and downloads use frozen inputs. SHA-256 checks integrity, not source authenticity. Imports are bounded, data-only and validated; package URLs are not fetched. Duplicate IDs cannot replace different evidence.
- Library limits are 50 workspaces / 20 packages / 3 MiB durable browser storage. The entire portable file is limited to 12 MiB, including checksum; optional individual CSV attachments retain an 8 MiB limit. Oversize libraries, unavailable/quota storage and stale-tab conflicts preserve existing durable bytes and visibly retain changes for the session. JSON download provides independent storage. Writes use an exclusive browser Web Lock; without that API, edits remain session-only.
- Exact-date comparison cursors link pointer/keyboard readouts. Dates absent from another panel remain unavailable; no neighboring value or interpolation is used.
- Capture changes load only relevant verified source archives, replay once per evidence/scope/cutoff, paginate the result and export all facts with old/new provenance and conditions. New periods, backfills, numeric changes, series/source metadata changes, observation-note changes and removed coverage remain distinct. Optional browser-local checkpoints/alerts require a return or reload; unchanged confirmations are not releases.

## Source and history evidence

Longer approved-file histories were collected with genuine October 22 retrieval times: BEA at `2026-10-22T16:20:38.051Z`, Board G.17 at `16:20:34.074Z`, and Census housing at `16:20:33.440Z`. BEA retains all available observations in the admitted quarterly/monthly files (GDP from 1947Q2; monthly measures have independent starts). Activity and housing retain January 2000 onward. Units, adjustments, missingness and exact-date calculation baselines are unchanged. These are newly captured current revised histories, not backdated publication vintages.

The separately [admitted publication sample](sources/publication-vintages-source-review.md) contains BEA's actual 2026Q1 GDP Advance/Second/Third estimates, published April 30 / May 28 / June 25: 2.0 / 1.6 / 2.1 percent SAAR. The exact dated workbook was retrieved at `2026-10-22T16:11:05.598Z`, SHA-256 `d12fb3a5b4d9184a9288d18eb249ea14683ac2614231b018c9f02a28d3c22b73`. Original cells and source strings are retained. The date-only cutoff cannot establish intraday server availability. The static archive is independently admitted during capture/build and excluded from daily freshness. Re-running its capture command preserves its bytes without refetching.

The archive audit compared the full pre-milestone snapshot with the result: all **31 original captures** retained unchanged, plus three new captures (**34 total / 15 sources / 77 measurements**). It checked 68 global cutoffs, 1,020 source cutoffs and 472 selected-source CSV comparisons; baseline verification covered 62 cutoffs and 77 historical CSVs. Source partitioning, original immutable files and replay equality remain intact.

## Local validation

- `npm test`: **760 passed, zero failures/skips**. Includes formula/calendar alignment, missing/zero values, source/observation metadata, immutable packages after simulated refresh, historical units/rights, instrument scenarios/attachments, malicious/corrupt imports, bounded incremental CSV generation, full-envelope bounds, storage quota/conflicts, original CSV byte round-trips, linked SVG cursors, file-input focus, application actions and publication admission.
- `npm run build` and `node scripts/check-build.mjs`: production build and **85 assets** pass, including all source history bundles.
- `node scripts/check-snapshot-history.mjs --baseline=test-results/before-repeatable-research.json`: complete immutable-history audit passes.
- Independent review reconciled all 25 numeric change-feed revisions with `revisionHistory()` and confirmed replay leaves retained capture objects unchanged. A local all-77-series replay probe improved from approximately 2.42 seconds to 0.24 seconds after single-pass replay; this is a local measurement, not a latency guarantee. Pagination/export reuse the computed feed.
- Actual browser: save/rename/reopen a named comparison; pin/reload its frozen result; JSON import without duplication; original JSON and CSV downloads. Downloaded JSON validated/re-exported byte-for-byte and the downloaded CSV (apart from its UTF-8 BOM) equals the package's original CSV.
- Actual browser: daily/monthly keyboard cursor shows unavailable on missing exact dates; publication cutoff before the second estimate shows only Advance and pins 2.0%; change feed shows loading, empty and populated/paginated states, and local alerts enable/disable without console errors.
- Graphite desktop screenshot inspected at 1440 pixels. Workspaces, pinned package and publication views checked at 320, 390 and 768 pixels with no page-level horizontal overflow. Phone personal-workspace links have 44-pixel targets; frozen charts remain within the viewport after resizing. Desktop/mobile screenshots and local test/audit logs are retained under ignored `test-results/`.

## Deployment verification

Implementation commit [`61a4ba6`](https://github.com/Vasuki8/us-treasury/commit/61a4ba66157d3e369584583b9bf56ee9a18981be) passed both Node 22 and Node 24 checks and GitHub Pages deployment in [Actions run 39821753028](https://github.com/Vasuki8/us-treasury/actions/runs/39821753028). The existing daily guard confirmed refresh was complete, so no extra agency refresh ran; Cloudflare remains deferred.

`node scripts/check-live.mjs https://vasuki8.github.io/us-treasury/` from a clean LF checkout of that exact commit verified all **85 published assets** against its tested build. Actual deployed overview, refinancing, calendar, capture changes and publication-history routes rendered without page overflow. The official three-estimate sample and day-precision/retrieval distinction were visible. The 390-pixel live view also had no page overflow; the temporary viewport override was reset. Public desktop/mobile screenshots are retained under ignored `test-results/`. The [research library is live](https://vasuki8.github.io/us-treasury/#/research); broader roadmap/source limitations below remain open.

## Explicit limits and remaining work

Publication history currently covers only those three 2026Q1 GDP estimates, not later annual/benchmark revisions, a complete publication database or inferred release causes. Historical supplemental-profile/calendar replay remains unavailable; pins preserve explicitly captured current context. BLS's calendar remains cached pending the owner's access request. Existing BLS keyless limits, DOL's 52-week retention and other source windows remain unchanged; broader DOL/Treasury backfills are deferred. A stable research API, accounts/multi-device sync and external/background notifications require subsequent work. Existing TIC/CPI-effects/term-premium/auction-tail source limitations remain in force. No paid service, credentials, new infrastructure or fabricated observations were introduced.
