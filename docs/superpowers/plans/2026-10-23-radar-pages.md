# Radar Primary Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the approved Labor Radar design to the other four primary pages with economist/investor placement guidance.

**Architecture:** Focused overview/indicator/calendar/explore renderers consume existing normalized route state, production models and actions. Root owns shared theme CSS, dispatch and calendar presentation extraction; two UI work packages own separate modules/tests and provide isolated CSS fragments for root integration. No overlapping file ownership.

**Tech Stack:** Native browser ES modules, semantic HTML/CSS, Node test runner, existing static build and GitHub Pages.

**Spec:** docs/superpowers/specs/2026-10-23-radar-pages-design.md

## Global Constraints

- Preserve all current data, observations, source footnotes, evidence links and research actions. No data refresh, new data sources, forecasts or invented measurements.
- Latest readings, observation periods, publication dates and retrieval timestamps remain distinct. Measurement kind and cached freshness are separate. Missing observations remain gaps.
- Preserve routes, all detail tabs, filters, topic/frequency options, Follow, comparison, date/transform controls, CSV, Save view, Freeze result, source health and bounded workspace return context.
- Keep both existing themes and density preferences. Use the Radar palette for the five primary routes; retain other specialist workspaces and the existing compact shared navigation.
- Support 320, 390, 736, 1024 and wide desktop widths in both themes without page-level horizontal overflow. Tables may scroll inside their own container. Keep native dates readable, reference periods visible, touch targets and keyboard controls usable.
- Reuse production data, controls and persistence; no mock snapshots, prototype storage, viewport switches or new framework/dependencies.
- Publish through the existing verified GitHub Pages process and verify the public assets against the tested build.

## Review Focus

- Indicator historical/transform controls must not make the latest headline appear scoped or transformed; unavailable values and invalid/empty windows remain honest.
- Calendar selected preview must remain accessible on mobile without hiding chronological events, schedule basis, cached notices or unknown reference periods.
- Explore unit/status/observation metadata must remain visible when source/frequency columns are compacted; catalog selection never exceeds four.
- Indexed/difference eligibility, missing exact dates, per-series observation counts and shared calendar presets retain existing model/export semantics.
- Shared palette, native date inputs, Save menus and long identifiers must fit all five routes without changing unrelated specialist workspaces.

## Task 1: Overview and indicator research desk

**Files:** UI owns src/overview-page.js, new src/indicator-page.js, tests/radar-overview-indicator.test.js, and tmp/radar-pages-a.css. Root later copies the CSS into styles.css. Root owns src/pages.js and shared src/calendar-presentation.js. No UI edits to shared files or Git index.

**Interfaces:** export indicatorPage(state, historyContext={}) returns HTML; normalized state comes from renderPage. Import yieldTimingPanel from ./calendar-presentation.js. Existing overviewPage(state, context={}) contract remains. Wrap pages with radar-page radar-overview / radar-indicator classes. Shared root CSS supplies typography/palette/forms/panels; fragment supplies only page-specific layout. Preserve original IDs/data actions verbatim. Read domain reports in original checkout output/radar-{economist,investor}-verdict-2026-10-23.md and consult both domain agents directly.

- [ ] Read current renderer/helpers and domain verdicts; resolve placement directly with the economist/investor agents.
- [ ] Add meaningful assertions for all 12 Overview readings and complete hierarchy/actions; latest-vs-window indicator labels, native units, empty/invalid history, tabs/claims/GDP evidence and safe return. Observe intended new failures, without CSS-mirroring tests.
- [ ] Implement the approved page-specific layouts and isolated CSS fragment using existing helpers/models. Preserve headings needed by existing tests unless changing text is essential to the user-visible design.
- [ ] Run focused new and existing overview/indicator/pages/history tests. Report exact commands/results, remaining concerns and files; root stages/commits only owned paths when ready.

## Task 2: Calendar and Explore workspaces

**Files:** UI owns new src/calendar-page.js, src/explore-page.js, tests/radar-calendar-explore.test.js, and tmp/radar-pages-b.css. Root later copies CSS into styles.css. Root owns dispatch/shared helpers; no shared file or Git-index edits by UI.

**Interfaces:** export calendarPage(state) and explorePage(state), both normalized route-state HTML renderers. calendar-presentation.js exports releaseDate, scheduleLinks, calendarSourceNames, relatedSeries, scheduledPeriod, scheduleSource, scheduleState, scheduleBasisPrefix, scheduledTime, scheduleBasisNote, yieldTimingPanel. Import rather than duplicating these helpers. Wrap pages radar-page radar-calendar / radar-explore. Existing IDs/actions and tab/tabpanel relationships remain. Consult the economist/investor agents directly after reading their original output reports.

- [ ] Read original renderer/contracts and consult domain agents about placement, mobile preview and comparison safeguards.
- [ ] Add failing meaningful assertions for chronological schedule/full preview/filter recovery and source basis; catalog units/reference periods and comparison modes/errors/exact-date controls/actions. Preserve all source health and timing guidance.
- [ ] Implement Calendar schedule/preview and Explore catalog/comparison recipes, with an isolated CSS fragment. Mobile rows retain units and reference periods even if desktop-only columns collapse.
- [ ] Run new and existing pages/calendar/compare tests; report exact commands/results and concerns. Root integrates and commits only owned paths.

## Task 3: Shared integration, responsive acceptance and delivery

**Files:** Root owns src/pages.js, new src/calendar-presentation.js, styles.css and relevant integration tests; review fixes remain assigned to their implementer.

**Interfaces:** renderPage keeps its normalization/researchNavigation and delegates indicator/calendar/explore to new renderers. Root extracts existing shared presentation without changing semantics. Root expands existing Radar palette selectors from Labor to overview/indicator/calendar/explore. Shared .radar-page controls provide the established Labor visual language without copying its data-specific layout.

- [ ] Confirm clean existing isolated checkout and baseline evidence. Current source baseline b5d94aa is byte-identical to the just-verified 1333-test Labor runtime; targeted current-page checks supplement it.
- [ ] Extract shared presentation and wire finished renderers; remove obsolete duplicated local renderer code/imports only after replacement modules are ready.
- [ ] Integrate common Radar CSS and isolated page CSS fragments. Verify existing IDs/actions, precise bounds and all source-data files unchanged.
- [ ] Run focused integration and complete full suite, production build and smoke checks. Review the whole change independently for specification and quality; fix material findings with scoped re-review.
- [ ] Browser-check four new pages plus Labor, both themes and all specified widths. Exercise calendar filters/preview, Catalog selection/search, comparison modes/window/export, indicator tabs/return and Save/Freeze continuity.
- [ ] Obtain economist and investor acceptance of the implemented placement; integrate/publish through existing workflow, verify exact live build and representative live routes, preserve deployment evidence.
