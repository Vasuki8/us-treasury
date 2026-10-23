# Current-account ratio change contributions implementation plan

> **For agentic workers:** implement incrementally with test-first calculations, integration checks and independent final review.

**Goal:** Explain changes in quarterly and trailing-four-quarter current-account/GDP ratios with component accounting contributions, preserving Graphite.

**Architecture:** Reuse admitted BEA ratio calculations and the shared ending-quarter window. Add a contributions model, two four-component charts, latest reconciliation table, history table and self-contained evidence CSV. New frozen context references existing immutable breakdown inputs, without duplicating histories or growing retained CSV attachments. A clearly labeled reconstructed CSV can be generated from those frozen inputs.

**Tech stack:** Existing JavaScript/SVG/CSS, Node tests, GitHub Actions/Pages. Starting commit: `0229752`. Work in the existing local checkout; leave unrelated exports/output/tmp files untouched.

## Source mapping and design

Existing approved BEA ITA Table 1.1: current account line 30; goods/services/primary/secondary income lines 32–35. Feed: `https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.1.csv`. Quarterly SA USD millions, not annualized, converted by the admitted collector to USD billions. Nominal GDP NIPA 1.1.5 A191RC: `https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt`, SAAR USD millions converted to billions. Divide each quarterly GDP SAAR value by four once. Reuse retained revised captures, provenance, freshness and release/retrieval clocks. Existing admission policy and [source review](../../current-account-gdp-source-review.md) cover attributed commercial display/calculation/export; BEA FAQ147 and annual-rates guidance rechecked this turn. No new data source, credentials, infrastructure or historical vintages.

Component contribution = current component ratio − exact prior-quarter component ratio, in percentage points. Calculate separately for quarterly ratios and adjacent rolling four-quarter ratios. Sum of four contributions + change in (published total ratio − component ratio sum) = published total ratio change, within floating precision. GDP denominator changes are already included; no additional GDP row. This is an accounting attribution, not an official BEA growth-contribution release or causal claim. Positive values move toward surplus; negative values toward deficit. Do not report percent shares of a near-zero net change.

Alternative considered: balance-only changes at a fixed GDP denominator with a separate GDP effect. This introduces an ordering or symmetric-allocation convention and is unnecessary for this component-ratio question. Use exact changes in component ratios instead.

Calculate changes before endpoint filtering, deliberately retaining the exact predecessor outside a selected window. A single selected endpoint can therefore have a valid change. Quarterly contributions need two consecutive raw quarters; T4Q changes need two adjacent complete four-quarter windows (five raw quarters). Export every supporting current/prior input date. First retained endpoint and incomplete rolling windows remain unavailable. Individual valid components remain visible; complete reconciliation requires all four components plus published total at both endpoints. No fallback to older dates, interpolation or zero filling.

## Tasks

### 1. Calculation

Files: `src/current-account-gdp-contributions.js`, `tests/current-account-gdp-contributions.test.js`.

- [ ] Write failing fixture tests; implement `currentAccountGdpContributions(sources, range)` returning `observations`, `allObservations`, `series:{quarterly,trailing}`, `window`, `error`, `formula`, `notice`. Rows: `{date,priorDate,quarterly,trailing}`; each horizon: `{current,prior,totalChange,components:{[id]:{value,reason}},componentSumChange,residualChange,reason}`. Current/prior are original guarded breakdown rows (quarterly or T4Q).
- [ ] Test nonconstant GDP, exact reconciliation including nonzero residual changes, rolling overlap, lookback, bounds/custom windows, first endpoints, partial components, total-only gaps, invalid units/dates/GDP and nonfinite arithmetic. No source mutation.

### 2. Graphite view, live wiring and export

Files: new `src/current-account-gdp-contributions-view.js`, `tests/current-account-gdp-contributions-view.test.js`, `tests/current-account-gdp-contributions-integration.test.js`; modify `src/macro-coverage-page.js`, `src/app.js`.

- [ ] Test then add `currentAccountGdpContributionsPanel(sources,range,{frozen,packageId})`, `currentAccountGdpContributionsChartCatalog(sources,{frozen})`, `currentAccountGdpContributionsCsv(sources,range)`. Catalog ID `current-account-gdp-contributions`; four distinct series per horizon in percentage points. Reuse chart/table/empty-state/source-status components and shared window.
- [ ] Include all-four latest contributions, component sum, residual change and published-total change for both horizons, current/prior period labels, signed interpretation, formula, overlapping-window and revised-input limitations. Keep units and evidence explicit. History table first 50; CSV all selected endpoints.
- [ ] CSV metadata + change rows + uniquely retained current/prior input-quarter rows and source evidence. No default existing CSV changes. Bind live export and frozen reconstruction to recorded context only.

### 3. Immutable context and compatibility

Files: `src/research-context.js`, `src/research-packages.js`, `src/research-page.js`; new contributions package/frozen tests.

- [ ] Add strict optional context `{version:1,range,inputContext:'currentAccountGdpBreakdown'}` at `currentAccountGdpContributions`. Reuse six full histories once, same five original attachments, unchanged storage/package caps. Render only when context exists; legacy packages gain no live fallback or new source history.
- [ ] Test import/export, tampered context/reference/range, partial frozen sources, reconstructed CSV isolation, all-history size and durable storage reopening. Freeze method/version and window, with explanatory scope text.

### 4. Verification and delivery

- [ ] Independent source/method review and final diff review; run all tests, focused Node 22 tests, production build and asset checks. Confirm captures/publication archives unchanged.
- [ ] Verify desktop/narrow layout, keyboard chart readouts, source/error states and CSV behavior locally; record any browser-tool limits honestly.
- [ ] Commit/push to `Vasuki8/us-treasury`; verify Actions and live assets/representative comparison page before reporting deployment.

## Results and decisions

Implemented the calculation, two Graphite charts, latest reconciliation and historical tables, complete CSV evidence, live action binding and optional frozen reconstruction context. Source/method review and independent final review found no outstanding actionable findings. The additional predecessor lookback is intentional and documented, extending the older within-window change display convention. Across all 266 actual retained endpoints the maximum reconciliation error is 1.55 × 10^-15 percentage points.

Local verification: 1,232/1,232 full-suite tests passed with loopback/temporary Git access; 178/178 focused tests passed on Node 22. The production build and smoke check passed 139 assets. A CSV input-label regression was reproduced and fixed: valid source observations no longer inherit missing-ratio warnings from a different input. All-history frozen package remains 3,087,202 bytes under the unchanged 3 MiB cap, with five unchanged attachments and no duplicated history. Source captures/publication archives are unchanged.

Browser verification: local Economy page rendered both calculated contribution charts, signed readouts and the expected 2026Q2 versus Q1 total changes (−0.357 pp quarterly, +0.074 pp T4Q). Actual component markup/styles/chart rendering in 390px and 320px frames reported matching viewport/document widths of 375px/375px and 305px/305px after scrollbars; no page overflow. Browser CDP could not reliably locate controls or capture screenshots, so manual CSV download, keyboard interaction and visual pixel checks remain unconfirmed. Export payload/action binding, chart conventions, empty/error states and frozen input isolation pass automated checks. No screenshot is claimed. Temporary local preview files/servers are excluded from version control.

Push/deployment verification pending.
