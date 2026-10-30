# Fiscal Pressure Reviewed Layout Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan. Steps use checkboxes for tracking.

**Goal:** Implement the reviewed Fiscal pressure layout without changing analytical or research contracts.
**Architecture:** Recompose the native fiscal renderer and GDP presentation; reuse existing metrics, chart, source state, disclosure persistence, routing, Save and export behavior. Add CSS scoped to the fiscal page; no new dependency or data transformation.
**Tech Stack:** Browser ES modules, CSS, Node test runner.
**Spec:** Reviewed design and review record at C:/Users/Vasuki/.codex/visualizations/2026/10/27/01a17e6e-469f-71d3-a3ab-068d9d53ea79/fiscal-review/review.html. The user explicitly requested implementing this reviewed design and running the tests/review loop.

## Global Constraints
- Preserve existing Light/Graphite tokens, native charts, all data/calculations/source rights and research action scopes.
- Group five TTM readings separately from independently dated daily public debt.
- Show trends and contributor evidence before all four compact GDP ratios; disclose full formulas with a stable namespaced key.
- Retain monthly-research and definitions-methods disclosure keys and visible critical warnings/errors.
- Do not deploy, introduce feeds, change exports, or replace the app shell.

## Review Focus
- Independently unavailable GDP ratios retain four rows and visible timing/basis.
- Missing or cached fiscal sources keep escaped visible diagnostics and cannot imply a publication time.
- Mixed TTM/monthly/daily/GDP clocks remain explicit and frozen results keep original scope.
- Narrow layouts must reflow without losing table interpretations, units or research controls.
- Shared helpers or CSS must not change other pages.

## Task 1: Native renderer and presentation
Files: src/fiscal-page.js, src/fiscal-gdp-view.js, styles.css, tests/fiscal-layout.test.js, tests/research-integration.test.js; src/ui.js only if a backward-compatible accessible label is needed.
Interfaces: fiscalPage(source=dataStatus.sources.fiscal), fiscalGdpPanel(sources=dataStatus.sources) remain compatible. fiscalGdpCsv, fiscalGdpContext and research-context remain unchanged.
- [x] Establish focused baseline; add rendered-output tests for grouping/order, visible caveats/source errors and partial/missing GDP evidence. Observe intended failures before production edits.
- [x] Implement native grouping, basis summary, scoped CSS and compact GDP/evidence presentation. Keep the native chart and all existing action attributes.
- [x] Run new and affected renderer/calculation/frozen tests and resolve failures without weakening invariants.

## Task 2: Verification and review
- [x] Run npm test, npm run build and node scripts/check-build.mjs. Save logs and report any baseline failures.
- [x] Browser-check the actual app in both themes at 320/390/736/1024/1440 pixels; exercise details, compare, exports, Save/freeze, contextual return and density.
- [x] Obtain independent code/domain review; fix material findings with focused regression evidence; rerun relevant checks after changes.
- [x] Record verification, review results and limitations. Leave the implementation reviewable in the attached worktree; no deployment.
