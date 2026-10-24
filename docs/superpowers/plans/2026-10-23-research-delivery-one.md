# Research delivery one implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Keep implementer ownership bounded and execute the approved first-delivery specification.

**Goal:** Ship release evidence upkeep/CPI, coverage inventory, extended GDP contributions, GDP revision matrix and funding distributions in the current UI/colors.

**Architecture:** Native source adapters, immutable publication archives, pure analysis/view helpers and bounded shared app/router/frozen integration. Reuse existing collector/capture locks, source policy, chart catalog bindings and research export contracts.

**Tech stack:** Native JS modules, Node collectors/tests, CSS, GitHub Actions/Pages.

**Spec:** `docs/superpowers/specs/2026-10-23-research-delivery-one.md`.

## Global constraints

- Preserve exact UI/colors, compact page hierarchy, existing archives/captures/frozen data, source notices and routes.
- Source-specific admission and raw evidence validation precede new publication use; no fabricated facts, expected timestamps or consensus.
- Preserve observation/publication/retrieval clocks, units, stages, missingness, seasonal adjustment and exact-date comparisons.
- Root owns app.js/router.js/workspace-context.js/research-context.js/research-page.js/explore-page.js/pages.js/styles.css/build/CI integration and shared tests. Implementers must not edit these.
- No subtask commits, browser/server runs or full-suite runs. Run meaningful focused tests red→green and report owned diff/results. Worktree commands may require explicit workdir and require_escalated.

## Review focus

- CPI rounded published rates cannot be confused with rounded-index calculations or SA annualization.
- Source challenge/redirect/malformed cells, ambiguous release identities and stale approved scope must fail closed.
- GDP historical stage exceptions/confirmations and distinct denominators must not bias routine revision statistics.
- Funding band gaps/ranges/domain/readout and frozen source catalog must never borrow current data or another market's population.
- Longer history must preserve all old captures and truthful first-retrieved dates; packages keep original attachment bytes.

### Task 1: CPI archive and release upkeep contracts

**Owner:** CPI implementer. **Files:** new `scripts/sources/cpi-publications.mjs`, `scripts/cpi-publication-policy.mjs`, `scripts/cpi-publication-scope.mjs`, `scripts/capture-cpi-publications.mjs`, `scripts/check-publication-upkeep.mjs`; new `src/cpi-publication-archive.js`, `src/cpi-publication-loader.js`, `src/cpi-publication-history.js`, `src/cpi-publication-view.js`, `src/publication-upkeep.js`; existing `src/release-evidence.js`, `src/publication-controller.js`, `src/release-coverage.js`, `src/research-brief.js`, `src/release-operations.js`, `src/release-page.js`, `src/overview-page.js`; CPI/upkeep focused tests/fixtures and source review docs. Do not edit root-owned app/router/research/build/CI files or existing GDP/claims policies/archives.

**Interfaces:**
- `cpiPublicationIds=['cpiMonthly','cpiCoreMonthly','cpi','cpiCore']`; `createCpiPublicationLoader()`; archive export `cpiPublicationArchive` version1/release rows.
- `selectCpiPublicationHistory(archive,{seriesId='cpiMonthly',cutoff='',period=''}={})`; `cpiPublicationCsv(archive,options={})`; `cpiPublicationView(state,{archive,publicationState})` native HTML with existing publication controls/action contracts. Root adds route/handler/freeze integration.
- `publicationFamily(seriesId)` export from publication-controller returns gdp/claims/cpi explicitly; controller accepts optional cpiLoader. Root passes it. Overview syncs all3families; CPI indicator/topic/release/publications sync only relevant family. Never binary non-GDP=claims fallback for CPI.
- Extend reviewed releaseMeasurements to the4CPI IDs, BLS program `consumer-price-index`; neutral published/prior-month roles and explicit unit/adjustment. Extend correct release selection/CSV/coverage/brief presentation without substituting index-derived readings. Expose CPI family load/error statuses honestly.
- Upkeep pure model/CLI reports coverage, missing approved IDs and source candidate review needs; use existing GDP/claims approved scopes and new CPI scope. Check mode default cannot mutate archives. Capture command appends only missing approved IDs atomically and no-refetches complete IDs. Root wires scheduled checks/build guard, views and summary artifact.

**Verified CPI source contract:** Official dated URL `https://www.bls.gov/news.release/archives/cpi_MMDDYYYY.htm`; existing requestText succeeds with2MiB cap and no credentials. Exactly one h1 Consumer Price Index News Release, PRE publication day/reference/USDL number and one table#cpi_pressa with CPI-U/U.S.city-average percent-change caption. All-items row `cpi_pressa.r.1`; core row `cpi_pressa.r.1.3`. Monthly header `cpi_pressa.h.1.2`; latest month `cpi_pressa.h.2.8`, preceding month `.h.2.7`; annual NSA header `.h.1.9`. Validate header text, period, row labels and unique cell `headers`, never positions only. Preserve source strings. Nine verified [publication,reference,headlineSA,coreSA,headlineNSA,coreNSA]: [2026-02-13,2026-01-01,0.2,0.3,2.4,2.5]; [03-11,02-01,0.3,0.2,2.4,2.5]; [04-10,03-01,0.9,0.2,3.3,2.6]; [05-12,04-01,0.6,0.4,3.8,2.8]; [06-10,05-01,0.5,0.2,4.2,2.9]; [07-14,06-01,-0.4,0.0,3.5,2.6]; [08-12,07-01,0.1,0.2,3.4,2.5]; [09-11,08-01,0.4,0.3,3.4,2.4]; [10-14,09-01,0.6,0.3,3.7,2.6], abbreviated dates all2026. Include preceding monthly printed cells only with validated headers/source tokens; annual prior absent unless explicit. Public samples available `D:/Projects/ChatGPT/New folder/us-treasury/tmp/cpi-feasibility`.

- [x] Add failing source/evidence/append-only/upkeep/loader/controller/CSV tests; inspect actual official payload and source terms.
- [x] Implement exact scoped parser/policy/capture and bootstrap approved CPI facts with real receipts; preserve full BLS attribution/disclaimer.
- [x] Implement explicit3-family evidence/brief/coverage/release hooks and upkeep check; provide root precise exports/commands.
- [x] Run focused tests, self-review and write `.superpowers/sdd/2026-10-23-research-delivery-one/task-1-report.md`.

### Task 2: GDP history and revision matrix

**Owner:** GDP implementer. **Files:** `scripts/sources/macro-contributions.mjs`, targeted source tests/source review; targeted official-snapshot/history artifact changes only for macroContributions; new `src/gdp-revision-matrix.js`, `src/gdp-revision-matrix-view.js` and focused tests. Do not edit research-page/app/router/context/shared CSS or other collectors/publication policies.

**Interfaces:** `buildGdpRevisionMatrix(archive,{cutoff=''}={})` pure result with quarter rows, explicit raw stage/date/identity cells, eligible-pair summaries and exceptions; `gdpRevisionMatrixCsv(archive,options={})`; `gdpRevisionMatrixPanel(archive,options={})` native HTML. Include cutoff controls under existing publication-cutoff ID and actions `data-export-gdp-matrix`, `data-pin-gdp-matrix`; avoid duplicate IDs. Root adds publicationMode='matrix' and viewer/freeze routing.

**Economist rulings:** raw stages Advance96/Second67/Third68/Preliminary29/Final29/Initial2/Updated1/Revised784 in current archive. Preliminary/Final may explicitly map to historical routine Second/Third while labels remain raw. 2018Q4 Initial→Third has no Second;2025Q3 Initial→Updated→Revised is exceptional. Never ordinal-fill. Exclude publicationContext confirmations from routine revision statistics, preserve zero observations, independent sampleN per pair. Report mean signed, mean absolute and median absolute pp with definitions; latest-retained-minus-first is distinct and need not be a headline statistic. No unsupported annual classification.

- [x] Add failing tests for full approved-history retention/missingness and matrix cutoffs/stage exceptions/confirmations/zero/sample denominators/CSV identities.
- [x] Raise contribution default to existing400-quarter cap; fetch official exact NIPA file and verify actual coverage, then targeted refresh only macroContributions preserving all old history and receipts. No full refresh or publication.
- [x] Implement matrix model/view/CSV, truthful empty/error states and documented methods; existing source stages/raw metadata accessible.
- [x] Run focused tests and write task-2-report.md including capture revision/coverage and root integration instructions.

### Task 3: Funding distributions

**Owner:** Funding implementer. **Files:** `src/charts.js`, `src/market-functioning-page.js`, new `src/funding-distribution.js` and optional view helper, focused source/model/renderer/funding tests. Do not edit app/router/context/pages/research/CSS or source collectors.

**Interfaces:** retain `marketFunctioningPage(source=dataStatus.sources.marketFunctioning,state={})` existing first argument contract. Root passes state. Export `fundingChartCatalog(source,{frozen=false}={})` returning a native scoped chart binding `{catalog,evidenceLabel}` with only the source's SOFR/EFFR median/percentile/volume observations. Native charts use `data-chart-catalog="funding"`, `kind:'funding-distribution'` and existing range encoding. Export `fundingDistributionPanels(source,range,{frozen=false}={})` for live/frozen view reuse, no active controls in frozen output. Root binds chartCatalogs.funding and records context.fundingDistributions `{version:1,range}` with complete retained source. Existing full-retained specialist CSV must remain byte-compatible; label its scope, do not claim generic selected CSV exports bands.

- [x] Add failing tests for exact percentiles, independent populations, y-domain including endpoints, missing bands/median, equal/zero values, window boundaries/readout/keyboard and frozen source binding.
- [x] Implement inner/outer opacity bands plus median using current chart/UI tokens, exact dates, no fill or percentile subtraction. Keep existing spread/dealer panels and notices.
- [x] Add shared rangeControls/viewRange to live market page; pass explicit range to distributions and spread and show retained/displayed coverage. Readout includes median,p1/p25/p75/p99,volume/revision flag with percent andUSD-billion units.
- [x] Run focused tests and write task-3-report.md; put any required CSS snippet in report for root to merge.

### Task 4: Coverage and shared integration

**Owner:** Root. **Files:** new coverage inventory model/view/tests; explore-page/router/workspace-context/pages/app/research-context/research-page/styles; build/CI integration; source/docs shared tests.

- [x] Add failing tests for every registered measurement including unavailable, independent observation/history classification, source state, exact bounds/counts and no implied publication coverage.
- [x] Add Explore inventory tab with existing query/topic/frequency filters and stable native detail/return/export/freeze contracts; scoped responsive styling.
- [x] Integrate CPI family/controls/CSV/pins; GDP matrix mode/cutoff/CSV/pin; funding state/catalog/frozen distribution view with old package compatibility.
- [x] Integrate CPI build/source guard and upkeep check/report with existing scheduled workflow, preserving current-data publication independence and immutable archive admission.
- [x] Run focused integration/export/frozen tests and record rulings in ledger.

### Task 5: Review and publication

- [x] Economist/investor acceptance and independent source/code review; resolve material findings.
- [x] Verify captured source metadata/rights and immutable history; complete regression/build/smoke.
- [x] Browser desktop,390/320px, Light/Graphite; CPI actual/prior evidence, coverage filters, matrix cutoffs/exports, funding bands/ranges/readout and freeze/reopen; no overflow/console errors.
- [ ] Commit scoped work, publish through existing approved live workflow, verify CI and exact live assets; record final runtime/coverage/limitations and proof.
