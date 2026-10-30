# Labor Radar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved full Labor Radar layout using economist/investor information placement and the existing research infrastructure.

**Architecture:** A dedicated Labor renderer composes existing data/model/chart/range components. Router/application/research integration makes Labor a first-class scoped workspace; specialist indicator and Explore destinations retain their complete workflows. Existing Light/Graphite controls and application navigation remain shared.

**Tech Stack:** Browser ES modules, semantic HTML, CSS, Node 24 test runner and existing static build/GitHub Pages workflow.

**Spec:** docs/superpowers/specs/2026-10-23-labor-radar-design.md

## Global Constraints

- Preserve all 23 Labor measures and original observations; no data refresh, inferred observations, scores, surprise measures or forecasts.
- Retain exact dates, native units, source status, missing gaps and source footnotes. Measurement kind and cached freshness are separate.
- Two-observation advance claims pairs remain separate from revised history. Never present them as long-history trend sparklines or splice them.
- Support 320, 390, 736, 1024 and wide desktop widths in both Light and Graphite, with no page-level horizontal overflow.
- Do not carry prototype-only persistence, host widgets, illustrative data, export preview or viewport toggles into production.
- Use the existing verified build/deployment workflow. Preserve other specialist workspaces.

## Review Focus

- Labor canonical and legacy routes can accidentally use a Prices measure or discard custom windows.
- Saved/returned views and frozen results must agree with the focused Labor measure, window and exported observations.
- Claims publication, reference week, revised history and retrieval are different clocks.
- Empty windows/null endpoints must not borrow out-of-window change commentary or create false zero observations.
- Mobile rows, disclosure menus and native date controls must fit without hiding dates or actions.

## Task 1: Labor workspace and renderer integration

**Files:** root owns src/router.js, src/workspace-context.js, src/app.js, src/research-context.js and related integration tests. UI implementer owns src/labor-page.js, src/pages.js, Labor-scoped additions in styles.css and tests/labor-page.test.js plus necessary obsolete renderer assertions.

**Interfaces:** laborPage(state, options) returns HTML using the existing `macro-measure`, date-window, data-save, data-compare and data-export-macro-measure contracts. Canonical Labor state has page=labor, macroFamily=labor, a valid labor macroMeasure (default underemployment), and viewRange(state). Group/query controls use the existing query/topic state or a bounded Labor-specific group state that round-trips through routes/saves if needed; root/UI agree exact integration before edits. Indicator/Explore links use existing bounded return context. Production CSV/download, save and freeze remain existing application actions.

- [x] Establish a clean baseline and an isolated codex/labor-radar branch.
- [x] Write meaningful route, custom-window, return-context and focused frozen-result tests; verify the new expectations fail before integration.
- [x] Integrate Labor normalization, URL/window/query/group persistence, matching CSV, saved views and scoped pins using existing model/research functions.
- [x] Implement approved information order, full grouped table, presets and compact/mobile layouts; adapt current source evidence and error states.
- [x] Run focused tests. Resolve renderer and integration mismatches without changing source data or weakening existing behavior.
- [x] Run full tests, build and static smoke check; review the task diff and address material findings.
- [x] Commit the reviewed implementation.

## Task 2: Responsive acceptance and delivery

**Files:** deployment verification evidence/ledger and any fixes to Task 1 files. No new unrelated features.

**Interfaces:** Serves Task 1 application through existing server.mjs; existing workflow publishes main after verification.

- [x] Browser-check 320/390/736/1024/wide desktop and both themes. Check the empty/custom windows, full 23 rows, menu/date-field bounds and keyboard use.
- [x] Exercise focused-history change, CSV scope, Follow, comparison presets, detail/back navigation, Save view and Freeze result against real application state.
- [x] Economist and investor reviewers check the implemented order and visible semantics; fresh code reviewer checks the final diff.
- [x] Fix any material findings; rerun only the affected checks and required build/full suite after code changes.
- [x] Integrate and publish through the existing workflow only after checks pass, then verify deployed content. Preserve the exact published revision in delivery evidence.

## Verification before deployment

- Unchanged baseline `33743f8`: 1320/1320 tests passed. Initial renderer and integration regressions failed for their intended reasons before implementation.
- Runtime implementation `5b0133a`, final reviewed fix `c96c8de95cb5ee82fbaa2b3d27c945744fa08a35`. Economist and investor agents consulted the UI implementer directly and approved the implemented hierarchy, default U-6 focus, grouped measure order, native comparison starters and weekly release distinctions.
- Independent whole-change review found a mismatched core-chart preset window and a methodology destination label mismatch. One fix wave addressed both; scoped re-review approved all findings, with no new material breakage. A separate actual-data probe passed 10 quarterly/weekly window and navigation cases.
- Final `node --test --test-concurrency=2 --test-reporter=spec tests/*.test.js`: **1333/1333 passed**, no failures, skips or cancellations (162991.7891 ms). `node scripts/build.mjs` and `node scripts/check-build.mjs`: passed, **145 assets** including source history bundles.
- Browser checks at outer widths 320/390/736/1024/1440 in Light and Graphite retained all 23 rows without page-level horizontal overflow. Native mobile date controls fit; open Save menu fits at 320. Theme preference survives reload. Screenshots inspected at mobile and desktop widths; these are browser viewport checks, not physical-device testing.
- Actual UI workflows verified: group/search, focused measure, exact custom windows, detail/back and comparison/back, comparison starters, Follow, downloaded CSV, Save view and Freeze result. The wages CSV and frozen result both retained exactly the two Aug/Sep 2026 observations in the selected Aug 1–Sep 30 interval. Frozen result retained provenance. Keyboard Home/End reached exact first/last ECI readings. Methodology now opens its selected tab; all three calendar charts share the ECI focus's April-to-April bounds.
- Future empty windows disable export and show no out-of-window change; invalid reversed dates show an alert. Browser console warning/error capture was empty. Source snapshots, observations and publication archives are unchanged.

## Deployment verification

- Published commit **e687a53f4d078aa6e61f3a94f2b2337d894f7656** contains the reviewed runtime `c96c8de` and acceptance documentation. Integrated by fast-forward into main; original untracked exports/output/tmp were preserved.
- [GitHub Actions run 40020368880](https://github.com/Vasuki8/us-treasury/actions/runs/40020368880) succeeded: tests, build and smoke checks on Node 22 and 24, followed by GitHub Pages deployment. Official-data refresh was skipped because none was required. Existing hosting settings were preserved.
- `node scripts/check-live.mjs https://vasuki8.github.io/us-treasury/` passed: **all 145 public assets exactly match the locally tested build**. Tracked source files use LF endings consistently with the deployed build.
- Live browser at `https://vasuki8.github.io/us-treasury/#/economy/labor`: all 23 rows and four group headings, default U-6 analysis, no page overflow in desktop Graphite and 390px Light checks. Quarterly ECI focus produced identical April 2025–April 2026 calendar boundaries on focused/payroll/unemployment charts. Captured warning/error logs were empty. Restored the browser's original Graphite preference after testing both themes.
- Local review reports and full final test log were preserved in the main checkout's untracked `output/labor-radar-delivery-2026-10-23/` before temporary-worktree cleanup. No remaining material findings. Physical devices were not tested.
