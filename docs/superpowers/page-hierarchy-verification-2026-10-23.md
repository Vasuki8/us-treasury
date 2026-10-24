# Remaining page hierarchy verification

The user approved the clearer Overview and requested the same hierarchy and reduced duplication across the remaining website, retaining the current UI and exact Light/Graphite colors.

## Scope

All 17 remaining page renderers were reviewed and updated: Labor, Indicator, Calendar, Explore, macro topic families, Fiscal, Refinancing, Yields, Auctions, Ownership, Market functioning, GDP contributions, Credit, Captured history, Release evidence, Watchlist and Research.

- Primary analysis, results or working lists lead. Supporting research, provenance and lengthy methods remain in named disclosures.
- Targeted consolidation preserves pages already appropriately structured. Calendar has one selected-event source receipt; Explore has one comparison CSV action; Labor removes duplicate data/CSV actions; Indicator consolidates metadata/definition homes.
- Metric and shared table change text retains the same numerical change, unit and prior period, with the current reference period separately visible and the full explanation retained in its title.
- Selected frozen results lead a compact, expandable package library. Active specialist analyses remain open; metadata and assumptions remain available below.
- Namespaced disclosure choices survive asynchronous renders and detail returns. Opening a chart section redraws only its subtree with the same live/frozen evidence catalog.
- Interpretation-critical warnings, estimate roles, source rights, temporal/valuation/accounting distinctions and essential scenario assumptions remain beside affected outputs.
- Approved Overview renderer, palettes, analytical models, data, schemas, routes and existing export logic are unchanged.

## Review and focused checks

- Independent economist/investor audit reviewed all 17 pages; GDP accounting-versus-causation caveat restored beside open contributions. No remaining material domain findings.
- Independent whole-change review checked 39 rendered route/subview/frozen variants: no duplicate IDs/keys or unbalanced disclosures. Active frozen specialist-result visibility fixed and re-reviewed. Selected-package library refinement re-reviewed with 24 passing checks; no findings.
- Implementation groups: primary/discovery 63 focused tests; Treasury 33; context/evidence 53 plus 66 frozen/related checks. Selected-library refinement: 24 Research/context and 63 frozen/package/export checks.
- Shared behavior and compact comparison tests confirmed red before implementation. Actual-app harness was updated to use the real expansion helper after its missing dependency caused 10 setup failures; 32 app/shared/context checks then passed, including actual live/frozen expansion callbacks.
- The potential hidden-chart zero-width issue was not reproduced in IAB; explicit expansion redraw is compatibility hardening, not a confirmed IAB regression.

## Browser acceptance before publication

- Desktop Light; 30 routes/subviews at 390px Light and 320px Graphite; no page overflow or duplicate IDs.
- Expanded supporting sections on 23 variants at 320px: no page overflow; visible native chart viewBoxes fit their containers. No console warning/error observed.
- Search/filter results, comparison selection, one enabled CSV action, indicator transformation/method tabs, selected Calendar evidence and one source receipt, detail returns and disclosure state were exercised.
- Compact and Comfortable density checked. Real external Trends FREEZE RESULT retained 20 rendered frozen charts; specialist context was open, and selected package led below the compact library disclosure.

## Final regression and live acceptance

- Final complete regression: **1,427 passed**, zero failed, skipped or cancelled; 163.15 seconds.
- Final production build and smoke check: **153 assets passed**, including all lazy history bundles. Asset directory: `fceb487d7915a7f9`.
- Runtime revision: `e69b97796c3933baa614ca18b5bd6a1b87645f22`.
- Workflow [40053544843](https://github.com/Vasuki8/us-treasury/actions/runs/40053544843) succeeded: refresh guard, Node22 and Node24 tests/builds, GitHub Pages deployment. Data refresh was not due; Cloudflare deployment correctly skipped.
- `node scripts/check-live.mjs https://vasuki8.github.io/us-treasury/` passed: all **153 published assets match** the final local build byte for byte. Checked 2026-10-24 02:22 UTC.
- Live browser: all 29 public route/subview variants passed desktop Light and 320px Graphite checks without page overflow. Published fiscal comparisons, supporting sections and expected asset directory confirmed. Expanded auction monthly chart matches its 262px container at 320px; no console warnings/errors. Theme restored to Light and temporary viewport reset after proof capture.
- Final live example: [Fiscal pressure](https://vasuki8.github.io/us-treasury/?_verify=e69b977#/fiscal). All existing destinations remain available through current navigation.
- Owned preview server stopped; pre-existing untracked exports/output/tmp and the reused managed worktree retained.
