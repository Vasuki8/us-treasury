# Koyfin styling across all workspaces

> **For agentic workers:** Continue in the existing isolated checkout. Implement shared styling, independently update legacy legend wording, and obtain a fresh whole-change review before publishing.

**Goal:** Apply the approved compact Koyfin UI and current Light/Graphite palettes to every remaining website page.

**Architecture:** Promote the existing approved palette to the application root. Retain specialist renderers and wrap their results in a shared compact workspace foundation. Keep page-specific data ordering, source caveats, evidence tables, exports and research interactions intact.

**Tech Stack:** Native ES modules, CSS, SVG charts, Node tests, existing GitHub Pages deployment.

**Spec:** User request to apply “this same Koyfin inspired UI and current color theme to the remaining pages too”; approved production reference commit833c89d and retained Koyfin template.

## Constraints and review focus

- Cover Economy families, Fiscal, Refinancing, Yields, Auctions, Ownership, GDP contributions, Retrieval history, Market functioning, Credit, Watchlist, Research views and Release evidence.
- Preserve all existing data, source/publication distinctions, controls, saved research and CSV workflows.
- Keep the five already-approved pages visually unchanged; current cream/plum Light and aubergine/lime Graphite colors become universal, including browser chrome.
- Metric cards fit their actual count and nested panels. Wide evidence tables scroll locally, while page width fits320px.
- Check source-loaded and empty/error states, long metadata, native date inputs, mobile menus, both themes and Comfortable spacing.
- Legend wording identifies measures accurately in either palette.

## Task 1: Shared workspace presentation

- [x] Promote palette tokens; align root/background/browser theme color.
- [x] Reuse compact foundations on specialist pages; fit metric cards, release facts/links, explanatory prose and panel spacing.
- [x] Inspect all remaining routes and key variants on desktop/mobile; run existing page/action tests.

## Task 2: Theme-neutral legends

- [x] Independently replace four legacy color-name captions with accurate series descriptions and verify scoped existing tests.

## Task 3: Verify and publish

- [x] Fresh review of integrated changes; address material findings.
- [x] Full regression suite, static build and build smoke checks.
- [x] Publish existing GitHub Pages site; compare every live asset and inspect published routes.

## Evidence

- Palette tokens promoted without changing the five approved pages' values. All specialist renderers retain their existing data and ordering. Release links/facts reuse existing components.
- Verified27 remaining route variants in Light and Graphite at1280/1024/736/390/320px. Source-loaded publication views, schedule-only release state, and a populated four-chart frozen result were inspected. No final page, metric or date overflow; chart labels fit after the fixes below.
- Targeted final metric matrix:48 cases across Fiscal/Refinancing/Yields/Ownership/Market/Credit at1280/1024/900/736/640/600/390/320px. Container breakpoints resolve local card overflow, including640px Fiscal and long Credit values.
- Additional27 Comfortable views at320px and20 regressions of the approved five pages at1280/320px in both themes passed. Retrieval cutoff now has267px width at320px, displaying the retained date and time. No captured console warnings/errors.
- Browser-verified Refinancing24-month/50bp controls and CSV; downloaded CSV contains the selected modeled scenario. Auction Bill filter updates the view and selected result.
- Chart inspection exposed fixed54px y-axis padding clipping long Credit labels and a long external-account unit at320px. Adaptive tick margins and wrapped exact unit labels preserve ordinary geometry, cursor/window behavior, at least100px plot width and60px plot height. Three regression tests failed before the fixes; chart/domain/catalog/cursor suite29/29 passed.
- Theme-neutral legends: regression failed before replacement;47 scoped view/frozen tests passed. Existing page/action checks67/67 passed.
- Fresh independent review found no remaining material issue after the measured mobile/tablet fixes. Signed ticks, exact units, calendar/cursor geometry and frozen evidence were reviewed separately.
- Build and smoke checks pass with149 assets. First full run:1,351/1,352 passed; only failure was the previous browser-theme hex expectations. Both expectations updated to the requested colors, preserving all focus/preference/icon assertions; navigation tests15/15 passed.
- Final full suite passes:1,352/1,352 tests, zero failures/cancellations/skips (165688.57ms, bounded concurrency2).
- Published runtime commit:`0d21bad8e6003edc21de3fbac794f61a8a56f788`. [GitHub Actions40036524490](https://github.com/Vasuki8/us-treasury/actions/runs/40036524490) passed Node22, Node24 and GitHub Pages deployment. Source refresh was not due and was skipped.
- Live asset check passed:all149 published assets match the tested local build byte for byte.
- Public browser verification:27 remaining route variants at1280/390px in Light and Graphite (108 views), no page or metric overflow, clipped chart labels, date-control overflow or captured console warnings/errors. Restored initial Light preference and default viewport; Fiscal pressure retained as the live preview.
