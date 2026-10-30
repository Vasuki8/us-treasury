# Trailing-four-quarter current-account / GDP implementation plan

> **For agentic workers:** Use subagent-driven-development or executing-plans; test each deliverable before integration.

**Goal:** Add trailing-four-quarter current-account and component ratios with Graphite charts, evidence-rich exports and frozen research support.

**Architecture:** Calculate rolling totals from the existing guarded quarterly input histories. Use separate total and four-component chart bindings, the page's existing date controls, and a compact self-contained CSV. New frozen context refers explicitly to the already retained breakdown inputs rather than duplicating them; old pins remain unchanged.

**Tech stack:** Existing native JavaScript/SVG/HTML, Node test runner and GitHub Actions/Pages.

**Spec/source mapping:** User request in this chat and [existing source review](../../sources/current-account-gdp-source-review.md). BEA ITA Table 1.1 line 30 and lines 32–35 are seasonally adjusted quarterly current-dollar balances, not annualized; NIPA Table 1.1.5 A191RC is nominal GDP SAAR. Approved endpoints remain `https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.1.csv` and `https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt`. The existing BEA public-domain statistical-use approval covers commercial calculated display and export, with attribution and no implied endorsement. No additional sources, credentials or infrastructure.

## Calculation and product contract

For reference quarter q, use exactly q−3, q−2, q−1 and q. Each ratio is `100 × sum(four quarterly balances) / sum(four nominal GDP SAAR / 4)`. It is a ratio of sums, never the unweighted mean of quarterly ratios. Divide each GDP observation by four once. Require all four exact consecutive observations; no partial-year extrapolation, interpolation, zero filling or calendar-gap bridging. Keep source quarterly observations distinct from calculated rolling flows. Positive balances offset negative balances; changes between adjacent rolling endpoints are percentage points and overlapping windows share three quarters.

Keep the published total distinct from the four-component sum and rounding residual. A missing component only suppresses that component and reconciliation; valid siblings remain available. The first three retained endpoints are unavailable because earlier inputs are absent. Calculate the full rolling history before selecting the chart window, retaining up to three supporting quarters outside it. Reference dates identify the ending quarter's start, not a release date; display each four-quarter start/end explicitly. Revised histories and independent retrieval dates remain labeled; do not reconstruct original publication vintages or claim economic causation.

## Review focus

- Varying GDP: ratio of sums must differ from an incorrect unweighted quarterly average.
- Missing earlier supporting quarter: suppress every affected rolling endpoint without extending beyond exact four-quarter coverage.
- Narrow custom window: retain three lookback inputs and calculate the same point as all-history selection.
- Rounding and revisions: preserve total, parts and residual and never mutate retained inputs or old pins.
- Archive growth: reuse full frozen inputs and export each supporting input once; keep existing 3 MiB library and package limits.

## Tasks

### 1. Rolling calculation

Files: new `src/current-account-gdp-trailing.js`, `tests/current-account-gdp-trailing.test.js`.

- [x] Write/run failing tests for varying denominators, exact four-quarter windows, year boundaries, incomplete initial coverage, internal gaps, invalid units/IDs, partial component missingness, nonpositive GDP, revisions, bounds and no mutation.
- [x] Implement `currentAccountGdpTrailing(sources,range)` with four synthetic component series, separate total series, selected reconciliation rows and supporting quarterly input points. Reuse existing guarded quarterly calculations and bounded calendars.
- [x] Run the new and existing formula tests.

### 2. Graphite charts and compact export

Files: new `src/current-account-gdp-trailing-view.js`; `src/macro-coverage-page.js`, `src/app.js`; new view/integration tests.

- [x] Write/run failing tests for explicit total/component catalogs, shared windows, labels, partial/error states, original input strings and safe CSV.
- [x] Add separate total and four-line component charts in one panel with latest selected period, changes, reconciliation, historical table, method and source evidence.
- [x] Export one typed metadata record, unique supporting input records and rolling endpoint records in a single consistent CSV schema. Include the three-quarter lookback where needed and keep source/retrieval/publication clocks distinct.
- [x] Wire live chart catalogs and keyboard-export action without adding duplicate date controls or altering existing charts.

### 3. Frozen compatibility

Files: `src/research-context.js`, `src/research-packages.js`, `src/research-page.js`; new package/frozen tests.

- [x] Test then add optional `currentAccountGdpTrailing:{version:1,range,inputContext:'currentAccountGdpBreakdown'}` with strict envelope/reference/range validation and required retained input context.
- [x] Save compact original CSV and render from the referenced recorded inputs. Legacy pins never gain the new panel or live inputs.
- [x] Verify partial/unavailable input handling, JSON roundtrip, browser-library persistence and package bounds without increasing storage caps.

### 4. Verification and delivery

- [x] Review methodology, source reuse and final diff independently.
- [x] Run focused and full tests, Node 22 checks, production build and asset checks; compare immutable data files to the starting commit.
- [x] Verify desktop/390px/320px layouts, keyboard readouts, date windows, table access, CSV, frozen views and browser errors locally.
- [x] Push to `Vasuki8/us-treasury`; verify Actions deployment, matching live assets and representative pages before reporting live.

## Results

Starting commit: `955a415`. Implemented bounded exact-four-quarter total/component calculations, two Graphite charts with linked cursors, shared date windows, reconciliation, historical table, compact evidence CSV and optional frozen reference to existing retained inputs. New CSV records explicitly distinguish official/unavailable supporting observations from calculated rolling ratios and intern exact footnotes without losing any notes. Independent source/method and final diff review completed; review findings about record labels and nonfinite reconciliation/changes were reproduced in tests and fixed.

Full local suite: 1,169/1,169 pass. Node 22 ratio/chart/frozen checks: 121/121 pass. Final display-copy adjustments: 10/10 focused view/frozen tests pass. Production build smoke check: 135 assets. No snapshot, history capture, publication archive or source receipt changed. Original quarterly charts and older pins are preserved.

Local browser verified at 1440×1000, 390×844 and 320×740: linked Home/arrow/End readouts, first three unavailable endpoints and first complete 1960Q4 window, year/custom/all date behavior, one endpoint retaining earlier four-quarter support, keyboard table disclosure and CSV action, frozen chart labels/lookback, no page overflow or console errors. Wide tables scroll inside their containers. A full-history package is 3,066,514 bytes with a 243,347-byte trailing CSV, below the existing 3 MiB library cap; fresh-library persistence/reopen tests pass. Libraries already containing large pins retain the existing visible session-only/download fallback.

Current capture: 263 complete windows (1960Q4–2026Q2), plus three leading unavailable endpoints. Latest window 2025Q3–2026Q2 uses −$942.557B current-account balance / $31,778.08B GDP = −2.966060252853539%; component and rounding details are documented in the source review. Revised capture history is not historical first-release information. Adjacent windows overlap by three quarters and changes do not identify causation.

Runtime commit `7f8f4640458317a69f6215be71b0eebf0b150a7e` was pushed to main. [Actions run 39910646882](https://github.com/Vasuki8/us-treasury/actions/runs/39910646882) passed the full Node 22/24 checks and GitHub Pages deployment. A clean checkout build and live verification confirmed all 135 deployed assets match. Live overview and external economy pages rendered, linked keyboard cursors reached 1960Q4 and 2026Q2, and CSV export succeeded without console errors. Local empty-window handling and disabled export were verified on the final build. Browser screenshot capture became unavailable during final live verification despite a fresh preview; local mobile screenshots and live accessibility/DOM/asset checks were available. All requested implementation checks are complete; this does not claim completion of the wider fiscal/macro roadmap.
