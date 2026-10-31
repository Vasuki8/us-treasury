# Stitch UI Release Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans. The user approved the displayed Stitch concept and authorized deployment.

**Goal:** Apply the approved original Stitch UI to Meridian and publish after CI passes.

**Architecture:** Preserve the existing routes, models, chart renderer and controllers. Update the shared shell and visual roles, then adapt the five primary layouts. Mockups supply visual direction; production uses official retained data.

**Tech Stack:** Native HTML/CSS/JavaScript, Node tests, GitHub Actions and Pages.

**Spec:** https://stitch.withgoogle.com/projects/3788569267975541869 and output/stitch-us-treasury-2026-10-31/design-review.html.

## Global Constraints

- Original Meridian design; no Lanelytic assets.
- Preserve both themes, density, all routes, search, exports and research state.
- Preserve provenance, units, missing data, history, refresh safeguards and strict 20 MiB asset limit.
- Local assets under the existing CSP; no new runtime dependencies.
- Mobile touch targets, keyboard focus and reduced-motion support.

## Review Focus

- Bottom navigation must not cover content or the More menu.
- Long names, dense tables and chart controls must fit narrow screens.
- Readable contrast in both themes, including the charcoal sidebar.
- Inflation horizons remain explicitly labeled in separate native scales.
- Source warnings and research/export tools remain accessible.

### Task 1: Implement and verify the approved design

**Files:** index.html, styles.css, favicon.svg, src/app.js, src/overview-page.js, src/workspace-preview.js, tests/workspace-design.test.js.

**Interfaces:** Existing route links, navigation attributes, theme/density storage and delegated events remain. seriesPreview retains its signature and chooses bars for GDP/payroll, lines for rates.

- [x] Existing navigation/layout baseline: 19 tests passed.
- [x] Add a failing GDP/rate chart-kind regression, then implement and verify it.
- [x] Apply charcoal sidebar, violet/neutral themes, local SVG icons and mobile bottom navigation.
- [x] Place Overview trends beside releases and monitor below; adapt Labor, Indicator, Calendar and Explore via shared visual roles.
- [x] Run full tests, build and strict asset checks.
- [x] Inspect desktop/mobile routes in both themes, keyboard navigation and interactive controls.
- [x] Obtain an independent review and resolve its findings before the release commit.

### Task 2: Publish and verify

**Interfaces:** Consume the reviewed UI commit through the existing CI/Pages pipeline.

- [ ] Push, open PR, await required CI and merge the exact reviewed head.
- [ ] Await Pages deployment and verify exact served artifacts.
- [ ] Verify the live desktop/mobile UI and report the live link.

## Execution notes

Pre-flight: Task 2 consumes Task 1's verified commit; no shared-interface conflicts.
Ruling: the sandbox prevented writes in the managed worktree. Use a new release branch in the writable original checkout; preserve all untracked design work. Cost: no concurrent edits in that checkout during implementation.
Implementation choice: keep the local system sans-serif stack for CSP/offline reliability and use the approved mockup's visual hierarchy.

Validation: all 2,353 tests passed. Production build and strict 20 MiB smoke check passed for 225 assets. Browser QA covered all 28 navigation destinations at 390 and 1440 pixels in both themes, plus the five primary layouts at 320, 768 and 1024 pixels (127 cases); no page overflow, missing headings or retained-history loading states. The five primary layouts were visually inspected. Mobile menu positioning, Escape focus restoration, preview/back navigation and both density settings were checked; no browser warnings or errors were captured.

Independent review found stale theme-color expectations and text below the existing 13px readability minimum. Both were corrected while retaining the original assertions and readability guard; focused and full tests then passed. Source data, history, refresh workflows and asset budgets are unchanged.
