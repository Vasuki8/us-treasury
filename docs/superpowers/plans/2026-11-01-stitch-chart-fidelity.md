# Stitch Chart Fidelity Implementation Plan

> **For agentic workers:** Shared renderer and pure chart-data helper are independent bounded tasks; the root implements page/application integration. The user explicitly authorized this follow-up and updating PR #30, without merge or deployment.

**Goal:** Reproduce Stitch's real-data GDP/demand, inflation-horizon and payroll/moving-average charts, including legends, endpoint labels and working ranges.

**Architecture:** Extend the existing SVG renderer with opt-in combo/legend/endpoint features. Keep source and history captures unchanged. Build a scoped runtime PCE catalog from retained index endpoints; use the existing source loader to obtain full BEA history for Overview. Independent Overview chart controls remain session-only and resolve into existing custom date descriptors; Labor/detail ranges retain their shared route/export window contracts.

**Tech Stack:** Existing native JavaScript/CSS, Node tests, SVG. No new runtime dependencies.

**Spec:** https://stitch.withgoogle.com/projects/7931842367557945060, retained reference HTML in output/stitch-latest. User request: combined charts, legends, endpoint labels, time-range controls using real data.

## Global Constraints

- Update PR #30 only; do not merge or deploy.
- Keep source/history bytes, registry, momentumInputs, collection safeguards, CSP and strict 20 MiB asset limit unchanged.
- No sample values, invented payroll vintages, smoothing, filled source gaps, or dual axes hiding incompatible units.
- GDP and private demand share q/q annualized units; payroll and 3M average share thousands of jobs; U-3/U-6 share percent with differing denominators disclosed.
- PCE 1M annualized uses exact adjacent-month SA index endpoints; label calculated annualized rates separately from YoY. Do not annualize rounded monthly rates.
- Preserve keyboard inspection, native precision, frozen/scoped isolation, focused windows, exports, both themes, minimum 13px type and 44px mobile controls.

## Review Focus

- Latest endpoint is the last finite observation in the displayed window, never a value borrowed from outside it; its own reference date remains visible.
- Missing/nonpositive PCE inputs produce unavailable values and no fabricated connecting values.
- Collision handling and chart margins fit 320px without clipping labels or erasing the plot.
- Independent chart controls do not silently change research-window or comparison selection state.
- Browser's compact startup data cannot masquerade as a full 2Y/5Y/10Y/Max history.

### Task 1: SVG combined charts, legends and endpoints

**Files:** src/charts.js, src/ui.js, focused chart tests.

- [x] Observe failing renderer fixtures for mixed bars/lines, same-unit safeguards, legend identification and in-window endpoint labels.
- [x] Add kind combo plus opt-in legend/endLabels; keep other kinds unchanged.
- [x] Verify negative bars/zero baseline, gap handling, keyboard cursor, endpoint collisions, empty/scoped/frozen cases.

### Task 2: Data and page/application integration

**Files:** src/dashboard-chart-data.js, src/dashboard-charts.js, src/momentum.js, src/overview-page.js, src/labor-page.js, src/indicator-page.js, src/app.js, src/source-controller.js, src/research-context.js, styles.css; focused data/page/source/context tests.

- [x] Test 1M arithmetic, exact input dates, missing inputs, immutable catalogs and leap-safe explicit ranges before implementation.
- [x] Test the expected visible overlay/range actions on Overview, Labor and payroll/rate detail.
- [x] Add GDP + demand combo and core/headline PCE three-line panel with selected chart windows; preserve other preview choices and navigation.
- [x] Add payroll + 3M combo and U-3/U-6 overlay to Labor and appropriate native detail charts, with existing research-window controls.
- [x] Bind runtime PCE catalog after hydration; load complete retained BEA history for Overview; capture displayed chart inputs/settings in supplemental frozen context.
- [x] Style consistent legends/line colors/endpoint stamps and responsive controls in both themes.

### Task 3: Verify and update PR #30

- [x] Run integrated tests, production build and strict smoke check.
- [x] Browser-check real SVG series, exact endpoints, all range buttons and Core/Headline switch; test narrow/desktop layouts in both themes using rendered DOM geometry.
- [x] Verify shared date windows, keyboard inspection and frozen input preservation. Screenshot capture is unavailable; retain the DOM/data checks and report that visual verification limit.
- [x] Independent review, resolve material findings and commit/push only to the existing PR branch.

## Execution notes

- Existing isolated branch codex/meridian-stitch-workspace, starting commit 16e3db2d9aafc6cd366224f1956c619f8c8e7dee.
- Overview originally reused one-series previews and browser startup only retained about a year. Fix both presentation and history loading, without fetching new upstream data.

## Final evidence and rulings

- Full integrated suite: 2,391 tests passed, zero failures/skips. Final build and strict smoke check: 228 assets passed, 20 MiB limit unchanged.
- Browser checks: 48 cases across Overview, Labor, payroll detail and unemployment detail at 320/390/768/801/1024/1440px, both themes. No page overflow, endpoint clipping or endpoint-label overlap.
- All Overview range buttons and both PCE families worked without changing the route, comparison selection or research window. GDP ranges rendered 9/21/41/318 actual retained bars for 2Y/5Y/10Y/Max; the overlay remained a line. Labor's 1Y/3Y/5Y/Max controls preserved a common focused window for both overlay panels and kept CSV enabled.
- Core PCE 1M annualized endpoint was 3.8648382188662955%; headline was 6.0517258101921545%, from exact retained SA index endpoints. No rounded monthly-rate annualization or fabricated observations.
- Keyboard Home inspects the first exact displayed quarter while endpoint labels remain on their own last finite in-window dates.
- A production-data Max/Max headline-PCE frozen package retained all 318 GDP/demand rows and 813 rows per PCE horizon, exported in 2,281,016 bytes, and round-tripped identically. Existing primary measurement selection/export semantics remain.
- Independent final review found two asynchronous races: a late older source request could replace a newer preview, and Freeze could read changed session settings after awaiting history. Both were observed RED and fixed GREEN. The latest request now wins; Freeze copies the displayed settings and preview at invocation.
- Dense combo bars now shrink to at most 60% of nearest exact-date spacing. At 320px with 318 GDP quarters, the widest bar was 0.1866 SVG pixels versus 0.3109 spacing; no overlap. Standard bar sizing remains unchanged.
- The test harness needed the new chart-setting dependencies; its seven initial failures were corrected without changing existing behavior assertions. The final complete suite is green.
- Visual limitation: browser DOM/keyboard/control APIs worked, but all screenshot capture attempts returned unavailable. Restoring the desktop application timed out at its approval prompt. No pixel-level visual verification is claimed; the preview remains available for review.
- Session-only Overview chart choices deliberately reset on reload, like existing previews. Saved snapshot supplemental context captures the exact displayed settings and rows; no new registered measurement or source-capture series was introduced.
- Registry, source/history files, refresh workflows and safeguards are unchanged. QA records and logs remain untracked in output/stitch-chart-fidelity and output/stitch-latest.
- Publication constraint: update the existing PR only; no merge or deployment.
