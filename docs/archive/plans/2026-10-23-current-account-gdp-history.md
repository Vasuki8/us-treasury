# Historical current-account-to-GDP chart implementation plan

> **For agentic workers:** Use test-first implementation and independent review of calculation, chart binding, exports and frozen input boundaries.

**Goal:** Add an interactive historical ratio chart using the admitted official BEA histories, preserving Graphite, exact quarterly/SAAR conversion and immutable research evidence.

**Architecture:** Extend the pure ratio calculation over a contiguous calendar of retained ITA quarters and the matching nominal GDP observations. Reuse the shared chart renderer through an explicit scoped catalog, keeping the calculation separate from independently collected official series. The Trade & current account chart uses the existing page date-window controls and a matching historical CSV. New frozen results retain the complete two relevant input histories and selected range; older pins gain no new data or chart.

**Tech stack:** Existing dependency-free browser modules, Graphite SVG chart, date-window utilities, CSV exports and portable research packages. No credentials, dependencies, infrastructure or new sources.

**Spec:** The user requests a historical current-account-to-GDP chart using official BEA data, preserving Graphite, local tests and a push to `Vasuki8/us-treasury`.

## Source and calculation contract

- Reuse `beaIta/currentAccountBalance` (ITA Table 1.1 line 30, quarterly SA USD billions) and `bea/nominalGdp` (`A191RC`, NIPA Table 1.1.5 line 1, SAAR USD billions). Existing commercial display/calculation/export admissions apply; see [ratio source review](../../sources/current-account-gdp-source-review.md).
- Compute `100 × quarterly current account / (same-quarter nominal GDP SAAR / 4)`. Deficits stay negative. Label every chart/value as calculated, including keyboard readouts.
- Cover the retained ITA quarter span; GDP-only quarters do not extend it. Missing/invalid/nonpositive inputs create null points with reasons. Explicit missing-quarter calculation rows keep line gaps and contain no invented official observations.
- Reuse exact year/all/custom/count window semantics. Chart and historical CSV share selected dates, ratios and original quarterly inputs. Preserve full precision in CSV. Percentage-point changes require adjacent exact quarters within the export; never bridge nulls.
- Show separate numerator and denominator retrieval evidence, units, IDs, rights and calculation. Latest revised histories are not historical first-release vintages. Unknown publication dates stay unknown.
- Preserve all existing snapshots, source-split archives, publication histories and legacy packages. New history pins retain only the two relevant full source-series histories plus the selected window and original CSV. This keeps reconstruction simple and captures gaps even when a selected window has no source observations.
- Scoped charts must fail closed when their supplied catalog is absent; frozen charts never fall back to current global data. Existing unscoped chart behavior stays unchanged.

## Tasks

### 1. Historical calculation and chart binding

Files: `src/current-account-gdp.js`, `src/charts.js`, focused history and scoped-chart tests.

- [x] Write failing tests for all-quarter calculation, factor four, source metadata, null/missing calendar intervals, duplicate/malformed dates, revisions, year/all/custom/count windows and no mutation.
- [x] Implement `currentAccountGdpHistory(sources, range)` returning full synthetic series, selected points, resolved window, error, formula and notice; preserve existing current/prior context.
- [x] Add explicit per-chart catalog/evidence bindings to the renderer, with calculated/frozen labels, keyboard interaction, null gaps and fail-closed missing bindings; pass legacy renderer tests.

### 2. Display, CSV and frozen research

Files: historical ratio view, existing CSV serializer, Economy page, app chart/action bindings, research context/view/package validation and integration tests.

- [x] Add a compact Graphite historical chart and selected-window coverage/missingness, with safe existing date controls and accessible fallback/data table.
- [x] Export precisely the selected historical rows with both raw inputs, quarterly conversion, independent source evidence and source rights.
- [x] Retain full CA and nominal GDP input histories and selected range in new pins; reconstruct their chart/CSV solely from frozen inputs. Validate the optional supplement without changing old pins.
- [x] Test empty/error/cached states, invalid/empty windows, CSV contents/escaping, revisions and old/new frozen-package reconstruction.

### 3. Acceptance and delivery

- [x] Verify original snapshots, 73 capture files and publication/explanation modules remain unchanged.
- [x] Run full tests and build/asset checks. Inspect desktop/mobile, date controls, keyboard chart values, exports and frozen replay in Graphite.
- [x] Push the tested changes; verify Actions and all deployed assets from a clean build, and inspect representative live pages before claiming live.

## Local acceptance evidence

- Node 24 complete local suite: 1,110/1,110 tests pass. Node 22 focused history/context/view/package/chart/control suite: 73/73 pass. Production build/HTTP check: 131 assets pass.
- All 266 current retained quarters (1960Q1–2026Q2) compute using exact nominal quarterly GDP (SAAR / 4). Keyboard Home/End returned 1960Q1 +0.26% and 2026Q2 −3.02%. One-year selection showed five quarter endpoints; custom 2025-02-01–2025-09-30 selected exactly two retained quarters and matching CSV.
- Graphite desktop 1440px, phone 390px and narrow 320px inspected: one main heading, no page-wide horizontal overflow, responsive chart, date controls and locally scrolling tables. Keyboard historical CSV export completed. Custom-window frozen replay showed the identical two chart quarters and a frozen calculated-input label, with no live history action. Browser error log empty.
- Source snapshots, all 73 capture files and all three publication/explanation archives remain unchanged against the starting commit. No new collector, source, credentials, dependencies or infrastructure. Existing daily refreshes update the admitted inputs.
- Independent reviews covered formula/windows/CSV, renderer isolation and frozen validation. Review fixes bound sparse calendar expansion before allocation and package acceptance, and replace release-fragile production assertions with dynamic coverage or fixed numerical fixtures. Scoped date controls use the calculated quarter calendar, including gaps.

## Limits

This is revised-input history, not an original-publication or historical as-known-on-date ratio series. Both source vintages remain explicit. Missing quarters retain null values/reasons; the line never interpolates them. New history pins retain the two relevant complete input histories to reconstruct even empty date windows; CSV and displayed chart remain limited to the selected range.

## Verified deployment

Runtime commit `bb12a63d0d8607ee6327b3f697b3481fe16250eb` was pushed to `main`. [Actions run 39906119018](https://github.com/Vasuki8/us-treasury/actions/runs/39906119018) completed successfully, including full Node 22/24 verification and GitHub Pages deployment. Existing refresh objectives were already satisfied; no unnecessary new data capture ran.

A clean LF checkout of the exact runtime commit built and served all 131 assets; the deployed site matched those assets byte-for-byte. Live all-history coverage showed all 266 quarters. Keyboard Home/End readouts showed 1960Q1 +0.26% and 2026Q2 −3.02%; historical CSV download completed. The existing current-account indicator chart retained its official-snapshot label and working chart. Browser error log empty. Graphite proof screenshot: `test-results/current-account-gdp-history-live.png` (local artifact, not committed). This completion record changes documentation only.
