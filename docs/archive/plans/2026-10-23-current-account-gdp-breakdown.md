# Historical current-account / GDP breakdown implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans. Tasks below include tests, implementation and verification.

**Goal:** Add historical goods, services, primary-income and secondary-income balances as percentages of nominal GDP, preserving Graphite and existing research workflows.

**Architecture:** Reuse admitted, captured BEA ITA and NIPA observations, exact-quarter ratio validation, shared date windows and scoped chart rendering. Keep the published total chart and add four component lines, a reconciliation table, detailed CSV and a separate optional frozen-evidence context. Existing pins and immutable archives remain unchanged.

**Tech stack:** Existing JavaScript modules, native SVG/HTML/CSS, Node test runner and GitHub Actions/Pages.

**Spec:** User request in this chat; conventions and commercial scope in [current-account GDP source review](../../sources/current-account-gdp-source-review.md) and [ITA source review](../../sources/bea-current-account-source-review.md).

## Source mapping and rules

| Measurement | Approved source | Convention |
| --- | --- | --- |
| Published current-account balance | BEA ITA Table 1.1, line 30 | SA quarterly current dollars, not annualized |
| Goods / services / primary income / secondary income balances | Same table, lines 32 / 33 / 34 / 35 | Same quarterly convention |
| Nominal GDP | BEA NIPA 1.1.5 line 1, A191RC | Current dollars, SAAR |

Exact endpoints remain `https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.1.csv` and `https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt`. Existing collectors convert millions to billions. For each exact quarter, component ratio = `100 × quarterly balance / (GDP SAAR / 4)`. Preserve signs. Ratios are Meridian calculations, not separately published BEA observations. Changes are percentage points. Primary income covers income receipts/payments; secondary income covers current transfers. No NIPA trade substitution or claim of causation.

BEA's [public-domain policy](https://www.bea.gov/help/faq/147) and [citation guidance](https://www.bea.gov/help/guidelines-for-citing-bea), checked 23 October 2026, support the existing admitted statistical files' commercial display, calculation and CSV redistribution. Attribute BEA, identify Meridian calculations and retain source identities, rights links and independent retrieval dates. No new service, credentials or infrastructure.

## Constraints and review focus

- Preserve Graphite tokens, shared controls, registered measures, total history and deployment conventions.
- Use only exact same-quarter, compatible inputs; GDP is divided by four once. Missing components remain gaps and do not invalidate other valid components.
- Keep BEA's published total, calculated four-component sum and residual (`published total − sum`) distinct. Never force rounded source values to reconcile.
- Explain the latest selected quarter's changes against its exact predecessor within the selected window. Component ratio changes include both numerator and GDP movement; these are accounting comparisons, not economic causes.
- No fabricated historical publication dates or original vintages; retained revised histories and independent retrievals remain labeled.
- Frozen results retain full scoped inputs and chosen window, remain bounded by observation/span/package limits and never borrow live values. Older pins remain unchanged.
- Immutable captures, publication archives and existing user output directories must not change.

## Tasks

### 1. Calculation and reconciliation

Files: `src/current-account-gdp.js`, new `src/current-account-gdp-breakdown.js`, `tests/current-account-gdp-breakdown.test.js`.

- [x] Write and run failing tests for exact quarterly arithmetic, positive/negative/zero values, rounding residual, missing components/GDP, incompatible identities/metadata, duplicates, quarter gaps, windows and bounds.
- [x] Reuse guarded ratio input validation; expose four synthetic percent series and selected rows with component points, published total, sum and residual in percent/quarterly dollars.
- [x] Verify original inputs are unchanged and existing total tests pass.

### 2. Graphite view, CSV and live integration

Files: new `src/current-account-gdp-breakdown-view.js`; `src/macro-coverage-page.js`, `src/app.js`; new view/integration tests.

- [x] Write and run failing tests for four-series scoped catalog, window consistency, reconciliation/readout copy, partial/error states, escaped text and source-rich CSV.
- [x] Add four labeled lines using existing chart colors and the page's single date-control set; no stacking or extra comparison transformation.
- [x] Show latest selected quarter and exact-prior changes, historical reconciliation table, formula, source status, commercial attribution and limitations. Export every selected quarter with original input values, provenance and missing reasons.
- [x] Wire live chart catalogs and CSV action without altering generic registered series or comparisons.

### 3. Frozen evidence and compatibility

Files: `src/research-context.js`, `src/research-packages.js`, `src/research-page.js`, new package tests.

- [x] Write and run failing tests for new optional `currentAccountGdpBreakdown: {version:1, range, sources}` context, import limits and legacy compatibility.
- [x] Retain only the five relevant ITA histories and nominal GDP history, exact metadata and scoped CSV. Validate raw and expanded quarter spans and keep existing package byte limits.
- [x] Render frozen breakdown with its own explicitly supplied catalog. Legacy packages never acquire this panel from live data.

### 4. Verification and delivery

- [x] Independently review formulas, component definitions, missing data and frozen input isolation.
- [x] Run focused tests, full test suite, production build and asset checks; verify immutable data/archives unchanged.
- [x] Check desktop, 390px and 320px layouts, chart keyboard navigation, date windows, exports, frozen results and browser errors locally.
- [x] Commit and push intended files to `Vasuki8/us-treasury`; verify Actions deployment, live assets and representative pages before claiming live.
- [x] Record actual results, limitations and commit/deployment evidence below.

## Results

Implemented the four-series chart, latest selected-quarter changes, published-total reconciliation, historical table, source-rich wide CSV and optional frozen evidence. Source/methodology and final diff reviews found no actionable issues. The full Node 24 suite passed 1,136/1,136; after the final copy/export-escaping test, 83/83 focused checks passed. Node 22 passed 89/89 ratio/chart checks. The production build smoke check passed all 133 assets.

Local browser checks passed at 1440×1000, 390×844 and 320×740: no page overflow, exact-quarter Home/End readouts, shared year/custom/all windows, keyboard disclosure, CSV action, frozen chart labels and no console errors. Wide tables scroll within their containers. An all-history package is 2,815,612 bytes, including a 797,916-byte breakdown CSV; a fresh library persists and reopens it under the existing 3 MiB cap. A browser library already containing other large pins can still fall back to session storage with its existing visible JSON-download notice.

The four components cover all 266 retained quarters (1960Q1–2026Q2). Latest ratios: goods −3.5783%, services +1.1238%, primary income −0.1401%, secondary income −0.4275%; published total −3.0221%. The +$1 million rounding residual remains separate. Current revised inputs are not original publication vintages. Snapshot/history/publication files remain unchanged.

Runtime commit `632a0e088a6d50cd9372278da0bb3500e7fcdff2` was pushed to main. [Actions run 39908581009](https://github.com/Vasuki8/us-treasury/actions/runs/39908581009) passed full Node 22/24 checks and GitHub Pages deployment. A clean checkout build and live verifier confirmed all 133 deployed assets match. Live overview and external economy pages rendered; component Home/End readouts reached 1960Q1 and 2026Q2, CSV export succeeded, and the browser reported no console errors. Screenshot: `test-results/current-account-gdp-breakdown-live.png`. All milestone checks are complete; this does not claim completion of the wider fiscal/macro roadmap.
