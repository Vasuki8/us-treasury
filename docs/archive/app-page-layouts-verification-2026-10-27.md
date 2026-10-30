# Remaining app layouts — verification, 27 October 2026

Implemented in the attached isolated checkout on codex/app-page-layouts from main fc2d36f. The accepted Fiscal pressure layout remains the reference. No merge, push or deployment was performed for this request.

## Delivered scope
All 17 remaining page types received a design and review pass: Overview, Labor, Economy families and all External sections, Indicator tabs, Explore catalog/comparison/coverage, Calendar scopes and selected event, Watchlist, Refinancing, Rates and curves, Auctions, Ownership, GDP contributions, Market functioning, Credit and policy, Captured history, Release evidence, and the four Research library views including frozen results and publication variants. Economy families share one renderer; the route inventory contains 18 renderer page types including Fiscal.

Native reading groups make units, periods and calculation basis explicit. Treasury distinguishes observed principal, modeled sensitivity, historical curves, quarterly ownership, weekly stocks/fails and daily funding. Economy leads with native readings and focused history; External Summary orders accounting, history and ratio context. Existing task-oriented research tables, controls and recovery paths remain primary. Overview and Labor retain their established compositions with more explicit reading basis. Both Light/Graphite tokens and density settings remain native.

## Preservation evidence
- 33 rendered route/view comparisons against main preserved control IDs, action attributes, chart configurations and every existing persisted disclosure key.
- Git blob hashes for 16 protected data/model/schema/action files exactly match fc2d36f, including official-snapshot, router, app, model, ui, research context/exports/packages/workspaces, package files and the approved Fiscal renderers.
- Independent code review confirmed unchanged calculation/CSV implementations in the touched view modules. No feeds, dependency, route, controller, storage, data, model, export-schema or source-rights changes.
- Frozen callers keep the complete default accounting and ratio presentation. Only live External Summary opts into compact presentation. Missing inputs, independent source failures and noncausal qualifications remain visible.

## Independent review loop
Fresh code/domain review passed each page family and the integrated patch. Visual review directly inspected 36 screenshots covering all 18 represented families. Two material visual findings were fixed:

1. Captured-history cells inherited broad anywhere wrapping and squeezed timestamps into roughly 61px columns. Removed that broad workspace rule and preserved complete words in unit notes. At320px the timestamp column is 145px with nowrap, and the roughly 865px table scrolls inside its 287px wrapper while the page fits. The reviewer confirmed the revised image is readable.
2. External Summary placed full source/method evidence and ratio context ahead of its focused chart. Native accounting now precedes focused history and compact ratios; named disclosures retain detailed accounting/release/source evidence and ratio context. Errors, source credit, native units, distinct clocks and critical limitations remain visible. Two new regression tests failed before the adjustment and passed afterward.

Scoped follow-up code and visual reviews found no remaining material issues. Reports and full task evidence are in output/app-page-layouts.

## Production build and browser evidence
The reviewed production build and smoke check passed all 163 assets, including lazy source-history bundles. Browser tests used asset directory 9d41d7d9f8fe4e42 through the native local server at http://127.0.0.1:4188/.

430 responsive observations covered 43 route variants at 320/390/736/1024/1440px in Light and Graphite. Comfortable density was used at 320px; compact at the other widths. No page/main overflow, clipped headline values or duplicate IDs appeared. Ten additional expanded-evidence views at 320px Comfortable also passed. All evidence and screenshots are saved under the chat's app-layouts visualization folder and a selected copy in output/app-page-layouts/live-proof.

Actual native UI flows verified:
- Historical yield-date selection and chart ArrowLeft exact-tenor readout.
- Save view and reopening its original configuration.
- Freeze into a read-only result; pinned JSON, frozen CSV and original curve CSV downloads. The recorded Curve A 2026-10-23 / Curve B 2025-10-22 attachment remained unchanged after selecting 2003-01-02 in the live page. The frozen package retained its four native measurements and original context.
- External ratio CSV with exact-quarter input columns, factor-four divisor and independent numerator/denominator retrievals.
- Economy selected-measure detail return, retaining its open supporting evidence.
- Native comparison panels and linked keyboard readouts; baseline-difference mode retains separate units and no-fill scope.
- Calendar selected-event preview with schedule-only basis; Watchlist follow/reorder; Indicator keyboard tabs with correct selected role and panel label.
- Invalid custom dates keep current readings visible and disable the scoped export; 1Y restores the chart/export.
- Mobile Save menu stays inside 320px (left 8px, right 296.7px). Browser warning/error log was empty after functional checks.

## Complete tests
node --test --test-concurrency=2 tests/*.test.js passed all 1,919 tests, zero failed/skipped/cancelled, in 976.35seconds (exit 0). This is the complete suite with two workers; no tests were excluded. The final run includes both visual fixes and all 27 new rendered-output regression tests.

Earlier exploratory full-suite runs were interrupted while incorporating visual review fixes. An isolated CPI temporary-file permission failure in a targeted worker was rerun successfully with the correct managed-checkout permissions. No assertions were weakened or tests excluded.

## Limits
Browser viewport and keyboard checks do not establish physical-device, touch-gesture, screen-reader or measured contrast results. Source freshness and numerical observations were preserved; this layout task did not refresh the snapshot. Existing production remains on main until separately integrated.
