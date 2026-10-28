# Research Reliability Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Work is already authorized; execute through verification without another proposal gate.

**Goal:** Make Meridian's research workflow durable, economically precise and useful while preserving existing source and package safeguards.

**Architecture:** Extend the native JavaScript modules and browser controls. Use IndexedDB per-record transactions; pure validated helpers for configuration, alignment and economic arithmetic; separately admitted source modules for new evidence. Root integrates shared controller/router/view changes; parallel workers own storage, Treasury analysis and labor/source evidence.

**Tech Stack:** Native ES modules, IndexedDB, SVG, Node built-in tests, existing unpdf; no new production dependency.

**Spec:** `docs/superpowers/specs/2026-10-27-research-reliability-design.md` and the user's numbered requirements.

## Global constraints

The original implementation phase did not authorize merge, push or deployment. A subsequent explicit user request authorizes the reviewed release; see the release record. Preserve official observations, missing values, source dates/rights/attribution, user records, immutable old packages, design tokens and the valid fiscal accounting identity. Never silently interpolate or treat capture differences as release revisions. No placeholder source panels.

## Review focus

- Transaction aborts and stale tabs must preserve the last durable version and allow unrelated writes.
- Imported configurations and package context must remain bounded data, with no executable or prototype keys.
- Quarter alignment must reject ambiguous, mixed-frequency and survey-round records and preserve original-date exports.
- Conditional inflation arithmetic must use exact indexes and consecutive months, never rounded published growth.
- Publication prior estimates, revisions, preliminary status, timing and commercial reuse must be established by the precise source.

## Tasks

- [x] Baseline: inspect current code/docs, run existing suite, record reproduced and already-correct behavior.
- [x] Storage: modify `research-library.js`, add native database helper and regression tests for migration, aborts, independent quota handling and reloads.
- [x] Research configuration: extend `storage.js`, `research-workspaces.js`, `research-page.js`, `watchlist-page.js`, `research-context.js` and controller for descriptions, named lists, portable settings, freeze selection, full retained rows and research questions. Test schema compatibility and round trips.
- [x] Comparison/evidence: extend `model.js`, `comparison-policy.js`, `router.js`, `charts.js` and Explore controls for explicit quarter mode; test exact/default behavior, unsafe conventions, original dates and CSV. Improve source footnotes/preliminary/break readouts and elapsed maturity spacing.
- [x] Discovery/events: extend `search.js`, `global-search.js`, `watchlist-monitor.js` and calendar associations for canonical ranking, grouped source variants and complete expandable event matches; test timing and publication versus catalyst roles.
- [x] Treasury interpretation: update auction states, refinancing principal/monthly ladder/labels, curve shortcuts/date-matched changes and verified Treasury calendar metadata. Preserve export/frozen provenance and test boundary cases.
- [x] Interface interpretation: consolidate freshness operations, promote private demand and inflation momentum, correctly describe the headline PCE objective, relocate CPI/FOMC material, advanced external calculations and residential-construction labels. Test meaningful changed contracts and inspect layouts.
- [x] New economic evidence: complete source investigation and admit official real earnings/diffusion and verified BEA PCE inflation composition, with source-specific policy/parser/fixture tests and qualified local UI. Independently dated Employment Situation publication capture remains blocked by the recorded HTTP403 responses; no reconstructed same-release revisions or placeholder panel is shipped.
- [x] PCE arithmetic: add tested exact-index conditional paths and target-monthly solver, historical rollouts, controls, exports and frozen assumptions.
- [x] Source gaps: inspect primary evidence and exact rights for expectations/financial conditions/market policy path. Existing admitted credit/funding context is already sufficient; consensus and market-implied path feeds remain blocked by the documented access, timestamp and redistribution dependencies. Investigation is complete; unsupported feeds are not implemented.
- [x] Acceptance: focused suites, complete suite, production build, browser reload/failure/keyboard/export/mobile checks; independent engineering and economic review; resolve findings and publish local inspection instructions only.

Each task records its outcome and test evidence in `docs/research-reliability-checklist.md`. Never mark a requirement complete before its linked behavior has been verified.

## Local verification outcome

The complete suite passed 1,992 tests with zero failures (`output/research-reliability/verified-tests.log`). A later focused run passed 74 checks with zero failures, including three tests added after the full-suite file list was expanded (`freshness-compact-green.log`). The final production build and asset smoke check passed for 180 assets.

The built local preview at `http://127.0.0.1:4192/` passed 304 responsive checks: 38 routes in Light and Graphite at 320, 390, 768 and 1,440 pixels. Sixteen additional expanded mobile disclosure checks and twelve mobile Save-form checks passed, and the final browser console contained no warnings or errors. Native IndexedDB reloads, recoverable legacy migration, named-watchlist restoration, complete frozen tables, settings/package exports and applied PCE assumptions were also exercised. Independent engineering, economic interpretation and final screenshot review gates passed.

Checked tasks mean the feasible implementation and dependency investigation have been completed. They do not change requirement 16 or the two blocked Phase 4 feeds to Implemented. The [requirement checklist](../../research-reliability-checklist.md) retains those distinctions. Detailed evidence and local inspection instructions are in the [verification record](../research-reliability-verification-2026-10-28.md). No commit, push, merge or deployment was performed for this request.
