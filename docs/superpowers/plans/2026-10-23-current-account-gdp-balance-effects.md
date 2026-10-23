# Balance versus GDP-denominator effects implementation plan

> **For agentic workers:** Build/test each deliverable incrementally, then independently review and verify deployment.

**Goal:** Separate balance changes from GDP-denominator effects in quarterly and adjacent trailing-four-quarter current-account/GDP changes, preserving Graphite and existing combined contributions.

**Architecture:** A new pure model decorates guarded contribution rows with a symmetric two-order split. A Graphite panel shows paired total-effect charts, component/residual reconciliation tables and selected-window history. Extend the existing evidence CSV only through an opt-in flag. Optional frozen context references the existing six immutable input histories and method; keep the same five original attachments and storage limits.

**Tech stack:** Existing JavaScript/SVG/CSS, Node tests, GitHub Actions/Pages. Base `dc68e6a`; existing local checkout. Leave unrelated exports/output/tmp files untouched.

## Source mapping and method

No new endpoint: approved BEA ITA Table 1.1 lines 30 and 32–35 (`https://apps.bea.gov/international/bp_web/tables/CSVNEW/Ita_T1.1.csv`) and nominal GDP NIPA 1.1.5 A191RC (`https://apps.bea.gov/national/Release/TXT/NipaDataQ.txt`). Reuse source admission, commercial attribution, provenance, freshness and release/retrieval clocks from [source review](../../current-account-gdp-source-review.md). ITA is SA quarterly USD millions, not annualized; admitted inputs are billions. GDP is USD billions SAAR; divide by four once per quarter. For T4Q, sum each window's balances and matching GDP flows separately. No source refresh or invented vintage.

Let N0,N1 be signed prior/current balances and D0,D1 matching positive GDP flows. Balance effect = `50 × (N1−N0) × (1/D0+1/D1)` pp; GDP effect = `50 × (N0+N1) × (1/D1−1/D0)` pp. Equivalently average the two sequential orders. Each pair sums to the original ratio change within floating precision. Use finite guarded arithmetic, not forced rounding or a manufactured leftover. The interaction is allocated equally; this is a Meridian accounting convention, not a uniquely observed/official BEA contribution or causal inference. Existing combined contributions already include both effects; do not add the split again to them.

Alternative considered: change balances at prior GDP first, then GDP at current balance. It is exact but makes allocation depend on order. Symmetric averaging is chosen to treat both endpoints equally.

Apply independently to total, four components, component sum and raw balance residual (published total minus component balances). Within tolerance, component effects plus residual effects reconcile to total effects. No new economic residual is invented from floating error. Positive pp moves toward surplus; rising GDP can mechanically narrow a negative balance/GDP ratio without improving its dollar balance. Adjacent T4Q windows overlap three quarters; changes need five raw quarters. Compute exact predecessor lookback before filtering endpoints. Missing components remain independent; total split can survive them, but full residual reconciliation needs all components and total. Invalid source identity/units/dates, missing/nonpositive GDP and nonfinite intermediate/cross-ratio/effect arithmetic remain unavailable.

## Tasks and interfaces

### 1. Model

Own new `src/current-account-gdp-balance-effects.js`, `tests/current-account-gdp-balance-effects.test.js`.

- [x] Write failing tests, then implement `currentAccountGdpBalanceEffects(sources={},range={preset:'all'})`. Reuse `currentAccountGdpContributions`; preserve rows and horizon fields, adding `row.quarterly.effects` / `row.trailing.effects` maps keyed by four component IDs, `componentSum`, `residual`, `currentAccountBalance`.
- [x] Each record: `{balanceEffect,gdpEffect,totalChange,currentBalance,priorBalance,balanceChange,currentGdp,priorGdp,reason}` with null unavailable arithmetic; totalChange retains the corresponding original combined contribution. Export `CURRENT_ACCOUNT_GDP_EFFECT_METHOD='symmetric-two-order-v1'`, `CURRENT_ACCOUNT_GDP_BALANCE_EFFECTS_CHART='current-account-gdp-balance-effects'`, `CURRENT_ACCOUNT_GDP_EFFECT_MEASURES` seven `{id,label}` entries.
- [x] Return base result with new `series:{quarterly:[balance,gdp,total],trailing:[balance,gdp,total]}` (calculated pp histories), `method`, `effectFormula`, `effectNotice`. IDs `currentAccountQuarterlyBalanceEffect`, `currentAccountQuarterlyGdpEffect`, `currentAccountQuarterlyRatioChange` and `Trailing` equivalents. Test varying GDP/balances, zero/signs/reversal, constant balance/GDP, nonzero residuals, component and total reconciliations, missing/invalid metadata, exact windows/lookback, revisions, finite limits and no mutation.

### 2. Graphite UI, export and app

Own new `src/current-account-gdp-balance-effects-view.js`, tests `current-account-gdp-balance-effects-view.test.js` / `-integration.test.js`; modify `src/current-account-gdp-contributions-view.js`, `src/macro-coverage-page.js`, `src/app.js`.

- [x] Test then implement `currentAccountGdpBalanceEffectsPanel(sources,range,{frozen=false,packageId=null})`, `currentAccountGdpBalanceEffectsCsv(sources,range)`. One total split chart per horizon (balance/GDP/combined), two seven-row latest tables, current/prior signed dollar balances and GDP flows, collapsed historical tables, source status, explicit formulas/order convention/revised-data caveats and no double counting. Latest endpoint never falls back. Reuse shared date controls.
- [x] Extend `currentAccountGdpContributionsCsv(sources,range,{effects=false}={})`: default byte-identical; true uses decorated rows and appends balance/GDP effects, current/prior balance/GDP, raw balance change, effect method/reason to each existing change record. Retain all original metadata and unique supporting input records. Wrapper calls with effects:true. No extra retained attachment.
- [x] Extend existing `currentAccountGdpContributionsChartCatalog(sources,{frozen=false,effects=false,includeContributions=true}={})` optionally with new chart catalog from model series. Preserve default eight-series binding. App uses effects context conditionally and includeContributions according to legacy context, so either optional field is independent without current-source fallback. Bind `data-export-current-account-gdp-balance-effects` live and `data-export-frozen-current-account-gdp-balance-effects="packageId"` recorded-only research action.

### 3. Frozen context and compatibility

Own `src/research-context.js`, `src/research-packages.js`, `src/research-page.js`, new `-frozen.test.js` / `-package.test.js`.

- [x] Add strict optional `currentAccountGdpBalanceEffects={version:1,method:'symmetric-two-order-v1',range,inputContext:'currentAccountGdpBreakdown'}`. Existing envelope versions/attachments unchanged. Render new panel only with new context and recorded sources/range/packageId. New pin scope explains reconstructed effects, method convention and source reuse.
- [x] Test strict method/envelope/range/reference validation, immutable import/export, partial/unavailable inputs, old pins without new panels/methods/live fallback, reconstructed CSV isolation, unchanged attachments and all-history durable storage under existing 3 MiB cap.

### 4. Review, local verification and delivery

- [x] Independent source/method review and final diff review. Full tests, focused Node 22 tests, production build/asset checks. Confirm captures/publication archives and original exports unchanged.
- [x] Check desktop/narrow rendered content and overflow bounds, chart keyboard values, and automated missing/error/export behavior; record manual visual/download limits.
- [x] Commit/push to us-treasury, verify Actions deployment, all live assets and representative new content before claiming live. Cloudflare remains deferred.

## Progress

Implemented the guarded split model, two Graphite total-effect charts, seven-row total/component/residual tables for both horizons, signed balance/GDP inputs, history tables, optional evidence CSV extension and recorded-only frozen reconstruction. Existing combined charts and default CSV semantics remain unchanged. Independent source/method review and final code review found no actionable findings. No new source, dependencies, credentials or deployment infrastructure.

Retained 2026Q2 versus Q1 total effects match the method oracle: quarterly balance −0.4148264943973819 pp, GDP +0.05798105789038233 pp; T4Q balance +0.028118301209965637 pp, GDP +0.04601340585733303 pp. Across all available seven-measure historical rows, maximum split-versus-original-change error is 2.22e−15 pp. The default contribution CSV is byte-identical to `dc68e6a` for all/1y/count/custom windows; all opt-in effect CSV metrics match selected model rows. Captures and publication archives remain unchanged.

Local tests: focused new/existing contributions 66/66 passed; Node 22 focused ratio/history/package tests 211/211 passed. The first full default-parallel run had two temporary-Git fixture setup failures (1,263 passed). With no application changes, all 20 publishing tests passed in isolation, then the complete suite passed 1,265/1,265 with four workers. Production build and smoke check passed 141 assets. No tests were weakened or skipped. New all-history frozen result is 3,087,717 bytes under the unchanged 3 MiB cap, using five unchanged original attachments.

Local browser: Economy page rendered the correct quarterly/T4Q splits and symmetric-method disclosure. Actual component markup/styles/chart rendering at 390px and 320px reported equal viewport/document widths (375/375px and 305/305px after scrollbars). Tab/Tab/Home focused the quarterly chart and selected 2025Q2: balance 2.413 pp, GDP 0.069 pp, combined 2.481 pp; the linked T4Q readout followed (0.094/0.053/0.147 pp). This validates keyboard/cursor behavior and narrow overflow bounds. Browser screenshot capture failed, so no visual pixel-check or screenshot is claimed; manual new CSV download remains unconfirmed. Export payload, action wiring, missing/error behavior and frozen isolation pass automated tests. QA previews are ignored local files and temporary servers.

Runtime commit `ef0ffcf01dd5c86f1f4d00942f987153850dc887` pushed to main. [Actions run 39989246711](https://github.com/Vasuki8/us-treasury/actions/runs/39989246711) passed Node 22/24 verification and GitHub Pages deployment. Cloudflare remains deferred. A clean committed checkout built successfully; check-live.mjs confirmed all 141 deployed assets exactly match that build. The deployed Economy page visibly exposes the split charts/export action, expected Q2 2026 effects, signed current/prior balances and GDP flows, and the symmetric interaction-allocation disclosure. Only the explicitly recorded manual screenshot/download checks remain unconfirmed.
