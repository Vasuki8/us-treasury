# Remaining App Page Layouts Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. Steps use checkboxes for tracking.

**Goal:** Apply the reviewed Fiscal hierarchy to the remaining app while preserving analytical/research contracts.
**Architecture:** Presentation-only edits in native page/view renderers and scoped styles, reusing panels, charts and persisted disclosures. Independent file-owned page families can be implemented concurrently and reviewed together.
**Tech Stack:** Browser ES modules, CSS, Node test runner; no dependency additions.
**Spec:** docs/superpowers/specs/2026-10-27-app-page-layouts-design.md

## Global Constraints
- Preserve both Light and Graphite theme tokens and both density settings.
- Preserve source data, calculations, models, export schemas, source rights, route/control/action IDs, chart configuration, tabs, disclosure identities, return context and immutable frozen inputs.
- Keep critical limitations/errors, distinct clocks, native units and modeled basis visible.
- No new dependencies, feeds, routes, deployment, or changes to current Fiscal behavior.

## Review Focus
- Different current/history/reference/retrieval/publication clocks remain explicit, including cached and missing inputs.
- Modeled refinancing, GDP accounting and funding-rate distributions retain assumptions, units and noncausal qualifications.
- Narrow tables scroll locally without clipping readings, focus, chart controls or Save menus.
- Every page retains the first visible page-heading actions container and existing research actions; no duplicate IDs.
- Frozen, publication, loading/error and detail-return paths keep the correct inputs and independent recovery actions.

### Task 1: Shared reading presentation and established overview/labor
**Files:** src/page-hierarchy.js, styles.css, src/overview-page.js, src/labor-page.js, tests/app-layout.test.js.
**Interfaces:** Add readingGroup(label,body,note='') returning escaped labeled section plus native body. CSS classes reading-group, reading-group-note, workspace-basis, workspace-analysis are shared presentation only. Existing supportingDetails remains unchanged.
- [x] Add focused rendered-output checks for labeled escaped reading group and visible native basis in Overview/Labor; observe intended failures.
- [x] Implement minimal helper and scoped CSS; retain established overview/labor hierarchy and all controls.
- [x] Run new checks plus overview/labor/hierarchy tests and review changes.

### Task 2: Treasury working pages
**Files:** src/refinancing-page.js, src/yields-page.js, src/auctions-page.js, src/ownership-page.js, src/market-functioning-page.js, tests/treasury-layout.test.js.
**Interfaces:** Consume readingGroup(label,body,note='') and shared classes; preserve renderer signatures and all exports. Own only these files.
- [x] Add meaningful rendered-output tests for grouped dates/basis, chart-before-secondary-evidence order and visible partial/error state; observe failures.
- [x] Compact source basis; distinguish observed exposure from modeled sensitivity; lead Yields with controls and overlay; group market weekly stocks/fails and daily funding; keep auction selection/history usable and SOMA notices visible.
- [x] Run focused tests plus treasury-hierarchy and affected page/action/export tests; self-review and record evidence.

### Task 3: Economy and credit pages
**Files:** src/macro-coverage-page.js, src/macro-page.js, src/credit-context-page.js, src/current-account-gdp-view.js where justified, tests/economy-layout.test.js.
**Interfaces:** Consume shared readingGroup/classes; preserve exported calculation/CSV functions and external section controls. Own only these files.
- [x] Add tests for compact topic readings, focused history order, exact units/clocks and visible errors/missing results; observe failures.
- [x] Recompose native topic readings/history, GDP result/accounting and source-specific credit groups; compact external summary GDP ratios with formulas retained in stable evidence. Keep all analysis sections and exports.
- [x] Run focused tests, current-account-sections, context-hierarchy and affected calculation/export tests; self-review and record evidence.

### Task 4: Detail and research workflows
**Files:** src/indicator-page.js, src/explore-page.js, src/calendar-page.js, src/vintages-page.js, src/watchlist-page.js, src/research-page.js, src/release-page.js, tests/research-layout.test.js.
**Interfaces:** Consume shared readingGroup/classes only where useful; preserve function signatures and every action/ID/tab/disclosure/export scope. Own only these files.
- [x] Add output checks for working-result hierarchy, visible scope/limitations and recovery actions; observe intended failures.
- [x] Compact basis/identity around primary chart or working table; retain task-oriented filters, selected results, navigation, clocks, frozen inputs and independent publication/explanation recovery.
- [x] Run focused tests plus primary/context hierarchy and affected action/package/publication tests; self-review and record evidence.

### Task 5: Review and verification
- [x] Independently review each page family against spec and contract audit; fix material findings and run relevant checks.
- [x] Run node --test --test-concurrency=2 tests/*.test.js, npm run build, node scripts/check-build.mjs. Expected: complete passing suite and 163 assets.
- [x] Browser-check all route families in Light/Graphite at desktop/390px; stress 320px/comfortable, open evidence and verify no page overflow or duplicate IDs. Exercise selected controls, chart keyboard interaction, return context, comparison, exports and Save/Freeze/reopen.
- [x] Obtain independent whole-branch code/domain review; resolve material issues, rerun required verification, record evidence and leave reviewable branch/preview.
