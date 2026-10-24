# Research delivery one verification

User-approved scope: release evidence upkeep and CPI, coverage inventory, longer GDP contribution history, GDP revision matrix and funding percentile charts. Existing compact hierarchy, Light/Graphite colors, navigation shell and old research packages are preserved. Base commit: `c28602c`.

## Source and preservation evidence

- CPI: 54 facts from nine actual official BLS captures, consisting of 36 current-reference published rates and 18 printed preceding-month cells. Actual-reference coverage January–September 2026; publication days February 13–October 14. Monthly SA and annual NSA bases remain distinct. December 2025 exists only as printed prior context. Actual publication instant remains unknown. See `docs/cpi-publication-source-review.md` for receipts, source cells, rights and caveats.
- GDP contributions: all ten reviewed series retain 317 numeric quarters, 1947 Q2–2026 Q2. Targeted official capture at `2026-10-24T03:06:14.124Z`; response SHA-256 `7a577c587cecc4b9e07b2edae2684ed565e7aef477a563c2a03d076f55d848b8`.
- Independent preservation comparison against the base validated all 97 immutable capture payloads, including the unchanged prefix of 96 captures. All 22 unrelated source objects and retained calendars/releases/policy metadata are unchanged. Existing GDP and claims publication archives were not modified.
- Read-only upkeep discovery succeeded locally at `2026-10-24T03:30:44.051Z`: GDP 1,076/1,076, claims 768/768 and CPI 54/54 approved facts; no missing approved facts or new candidates. This observation does not guarantee later discovery availability or auto-admission. The independent Actions job retains its own report and source errors without gating unrelated current-data publication.

## Automated verification

- Complete Node test suite: **1,476 passed, zero failed**, final run approximately 185 seconds. The initial run exposed one obsolete GDP/claims-only heading expectation; it was updated to assert the approved GDP/claims/CPI label without weakening the hierarchy-order assertion.
- Production build and built-application smoke check: **163 assets** verified, including lazy publication/history modules and all source-history bundles. Final runtime asset directory `b56c1a3eb5476c93`.
- Regression checks cover exact CPI source strings/header roles, rejected unknown or malformed editions, append-only/no-refetch capture, separate publication/reference/retrieval clocks, same-month comparisons and unavailable annual priors.
- GDP matrix checks cover explicit historical stage mapping, exceptions, zero revisions, 141 confirmations excluded from routine opportunities, independent denominators, cutoff behavior, canonical GDP metadata and original CSV evidence.
- Funding checks cover source-owned daily distributions, independently missing endpoints, native scales, band domains, exact shared windows, keyboard readouts and frozen source binding. Original specialist CSV bytes remain unchanged.
- Coverage checks include unavailable measurements, suppressed/missing counts, separate observation/history classifications, filters and frozen reconstruction. Review found omitted searchable `sourceTitle`/`measure` fields; a red/green regression fixed both. Independent full inventory freeze/import reconstructs all 136 rows exactly and preserves original CSV bytes (about 5.1 MB with loaded archives).
- Whitespace-only final cleanup was followed by21/21 CPI/matrix checks and another successful163-asset build/smoke. Full GDP matrix JSON remains below the 12 MiB portable-import limit and preserves the original matrix CSV exactly after export/import.
- Final independent source review found no material issue and passed 46 focused checks. The separate integration review passed 47 focused checks and confirmed exact full-inventory replay after the searchable-field correction. Economist review accepted CPI bases/prior handling and GDP/funding methods; its restricted Windows writer run hit an environment-level rename error, while the complete elevated suite passed that writer test.

## Browser acceptance

- Desktop plus 390- and 320-pixel responsive viewports; current Light and Graphite themes. No page overflow in CPI history/release, inventory, matrix, funding or macro views. Wide analytical tables scroll within their existing wrappers.
- CPI: monthly versus annual selection, reference-month change, same-month zero difference, dated evidence, release actual/prior rows, pin creation and actual portable JSON download.
- Inventory: source-title search returns five dealer measurements; freeze opens those five retained inventory rows. Search/topic/frequency and return-route contracts are covered by integration tests.
- GDP matrix: live table renders 98 quarters and three statistics rows; cutoff before archive start produces an explicit empty state with export/pin disabled. Restored cutoff renders the matrix. Frozen matrix displays the retained cutoff without live controls.
- Funding: separate inner/outer bands and median for SOFR/EFFR, shared custom September 1–October 22 window and spread; keyboard moves to October 21 and exposes all endpoints, volume and revision status. Frozen funding charts render retained inputs and the same range.
- Extended GDP indicator All history displays 317 observations beginning April 1947, with truthful current capture time.
- Console warning/error check during the responsive route sweep returned no entries.
- Large pins hit the existing browser-storage limit visibly: session-only status and JSON download guidance appear. Portable download was exercised. Existing packages do not acquire new evidence or charts.

## Publication

Live deployment and final source-review outcome are recorded after the verified main-branch publication.
