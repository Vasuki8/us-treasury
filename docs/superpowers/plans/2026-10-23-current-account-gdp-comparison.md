# Quarterly versus trailing-four-quarter current-account / GDP plan

> **For agentic workers:** Use subagent-driven-development or executing-plans; test each deliverable before integration.

**Goal:** Compare quarterly and trailing-four-quarter ratios for the current-account total and its four component balances while preserving Graphite and existing research functionality.

**Architecture:** One paired-line chart, a five-measure selector tied to the existing focused-measure route, an all-five latest-endpoint table and selected-measure history table. Reuse guarded quarterly and rolling calculations, exact-date windows, scoped charts and source evidence. New frozen context references the already retained breakdown inputs. Extend the existing T4Q CSV optionally for comparison, keeping its original columns/evidence and attachment filename; avoid duplicate full exports.

**Tech stack:** Existing JavaScript/SVG/HTML/CSS, Node tests and GitHub Actions/Pages.

**Spec/source mapping:** User request and [BEA source review](../../current-account-gdp-source-review.md). Existing approved ITA Table 1.1 line 30 and lines 32–35 are SA quarterly current-dollar balances, not annualized; NIPA Table 1.1.5 A191RC is nominal GDP SAAR. Exact feeds remain `https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.1.csv` and `https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt`. The existing scoped BEA statistical-use approval covers commercial calculation/display/export with attribution and no endorsement. No new source, credentials or infrastructure.

## Contracts and review focus

- Quarterly ratio = `100 × quarter balance / (GDP SAAR / 4)`; trailing ratio = `100 × sum(four balances) / sum(same four GDP SAAR / 4)`. Reuse these existing calculations; never average quarterly ratios.
- Align ending reference quarters exactly. Quarterly and T4Q values represent different flow horizons, with their own GDP denominators. Gap = quarterly minus trailing, in percentage points; it is not a revision, growth rate, quarter-to-quarter change or causal explanation.
- Missing or invalid input remains unavailable independently for each horizon/component. Keep valid quarterly observations when trailing coverage is insufficient. Do not fill, interpolate, substitute NIPA trade or move to an older overlap.
- Shared date controls select output endpoints after full lookback calculation. Source reference, release and retrieval dates remain distinct. Revised history does not establish original publication vintages.
- Preserve published totals, component accounting and rounding distinctions in the existing panels; comparisons do not force equality. Keep old pins, source captures and publication archives unchanged.
- Compare only the five admitted balances. The existing `macroMeasure` route tracks selection; an unrelated family measurement uses the current-account total as an explicit fallback.
- Frozen context is optional and bounded: `{version:1,range,measure,inputContext:'currentAccountGdpBreakdown'}`. Reuse captured sources and augment the retained T4Q CSV with selected comparison fields; keep existing library/package limits and legacy schemas.

## Tasks

### 1. Comparison calculation

Files: new `src/current-account-gdp-comparison.js`, `tests/current-account-gdp-comparison.test.js`.

- [ ] Write/run failing tests for all-five paired values, varying GDP, exact endpoint/window/lookback, first-three incomplete trailing observations, partial components, invalid identities/units, revisions, finite gap and bounds.
- [ ] Implement admitted selector resolution and paired synthetic series/rows from existing guarded calculations, preserving missing reasons and source point evidence.
- [ ] Verify no input mutation or change in existing quarterly/T4Q outputs.

### 2. Graphite UI, export and live route

Files: new `src/current-account-gdp-comparison-view.js`; `src/current-account-gdp-trailing-view.js`, `src/macro-coverage-page.js`, `src/app.js`; new view/integration tests.

- [ ] Test then add one two-line chart, labeled measure selector, all-five comparison table and selected-measure historical table, with explicit horizons, gap units, formula, source status and limitations.
- [ ] Extend `currentAccountGdpTrailingCsv(sources,range,{comparisonMeasure})` optionally, leaving its default export unchanged. Add selected quarterly/trailing ratios, gap and missing reasons using the existing input/metadata records. The comparison export wraps this self-contained CSV.
- [ ] Reuse shared date controls, route selection, loading/empty/error handling and scoped live/frozen bindings; no duplicate date controls or mixed-method decomposition.

### 3. Frozen compatibility and growth

Files: `src/research-context.js`, `src/research-packages.js`, `src/research-page.js`; new package/frozen tests.

- [ ] Test strict optional envelope/range/measure/reference validation and legacy no-live-fallback behavior.
- [ ] Retain the comparison selector/window plus existing input reference; augment the existing original T4Q attachment instead of adding a duplicate export or history.
- [ ] Verify JSON/CSV roundtrip, partial/unavailable sources and all-history browser-library persistence under the existing 3 MiB cap.

### 4. Verification and delivery

- [ ] Independently review method, source reuse, finite/missing handling, export evidence and frozen isolation.
- [ ] Run full/focused tests, Node 22 checks, production build and asset checks; verify immutable data files unchanged from `38961d8`.
- [ ] Test desktop/390px/320px layout, measure and date controls, keyboard readouts, empty states, exports, frozen results and browser errors locally.
- [ ] Push to `Vasuki8/us-treasury`; verify Actions deployment, live assets and representative pages before reporting live.

## Results

Starting commit: `38961d8`. Implemented the five-measure comparison model and selector, two-line Graphite chart, all-five latest-endpoint table, selected-measure historical table, optional extended evidence CSV and frozen comparison reference. No new source or source-data refresh. Independent source/methodology and final diff review found no outstanding findings. The default T4Q CSV is byte-identical to the starting commit for all/1y/count/custom ranges.

Full local suite: 1,199/1,199 pass. Node 22 focused ratio/chart/frozen checks: 151/151 pass. Production build smoke check passed 137 assets. All five measures and range modes match between model and export. JSON/CSV roundtrip, strict context validation, missing inputs, legacy isolation and durable-library reopening pass. Current-account all-history pin: 3,086,801 bytes with five shared attachments, below the existing 3 MiB library cap; all five full ITA histories retain their 266 observations. No immutable capture or publication archive changed.

Browser checks verified the Services selector/route, paired readouts at 1960Q1 (quarterly available, trailing unavailable) and 2026Q2, Graphite theme and source/table labels. Browser CDP input/emulation was intermittent; actual markup/styles/chart renderer were additionally rendered in fixed 390px and 320px preview frames. Both fit with no page overflow (375px/305px content widths after scrollbars), while tables scroll internally. Screenshot: `test-results/current-account-gdp-comparison-responsive.png`. A temporary local preview server was used only for verification and is excluded from version control. Date-window, export action binding and frozen views are also covered by integration tests.

Push and deployment verification pending.
