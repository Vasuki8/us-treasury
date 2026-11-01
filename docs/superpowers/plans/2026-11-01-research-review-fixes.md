# Research Review Fixes Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement these tasks. Preserve the file ownership boundaries during parallel work.

**Goal:** Correct five reproduced defects and streamline the approved reading/chart hierarchy in one unmerged PR.

**Architecture:** Keep the existing renderers and storage library. Scope async save completion to activation identity, fix validation at import, retain search relevance, use accessible foreground tokens and native disclosure controls.

**Tech Stack:** Vanilla ES modules, CSS, native HTML, Node built-in tests.

**Spec:** ../specs/2026-11-01-research-review-design.md

## Global Constraints

- No dependencies, collector/data changes, merges or deployment.
- Preserve real data, warning visibility, provenance, exports and chart interactions in both themes.
- Preserve historical tests and source safeguards; add regressions for actual defects.

## Review Focus

- Save A completes after opening B, clearing A, or a newer save: the latest activation remains active.
- Final CSS declarations and funding band compositing determine contrast, not the first matching rule.
- Enter then Tab after a Labor jump continues at its destination below the toolbar.
- Exact-ID results precede metadata matches while blank searches remain grouped.
- Malformed footnotes fail import; omitted and valid string arrays retain normal snapshot behavior.

## Task 1 — Saved views and keyboard navigation

Files: src/app.js; focused app-action and keyboard regression tests.

- [x] Reproduce late save completion using the existing review probe and add failing regression coverage for intervening activation and clear.
- [x] Implement the smallest activation guard; keep the saved record and scoped feedback.
- [x] Add and run a failing keyboard-jump regression, then focus the destination and preserve subsequent keyboard traversal.
- [x] Replace Frozen Results in recovery guidance with saved snapshots.
- [x] Run relevant research, focus, keyboard and navigation tests.

## Task 2 — Search and snapshot import

Files: src/explore-page.js; src/research-packages.js; catalog and package tests.

- [x] Add failing exact-ID search ordering and malformed-footnotes import regressions.
- [x] Preserve search ranking for nonempty queries, retaining topic browsing for empty queries.
- [x] Reject non-array/non-string footnotes before accepting a snapshot.
- [x] Run search/catalog, packages, exports and frozen-view tests.

## Task 3 — Contrast and layout styling

Files: styles.css; tests/chart-contrast.test.js; applicable style tests.

- [x] Make contrast tests resolve final exact palette declarations and verify the reproduced failures.
- [x] Separate accent text/strokes from fills, retaining Light and sufficient funding-band contrast.
- [x] Add header-aware scroll margins and compact responsive styles coordinated with Task 4 markup.
- [x] Verify both theme palettes and keyboard focus styles.

## Task 4 — Content hierarchy and corrections

Files: src/overview-page.js; src/labor-page.js; src/indicator-page.js; src/stitch-indicator-context.js; their page tests.

- [x] Combine duplicate Overview/Labor top readings, keeping useful interpretation and critical warnings visible.
- [x] Reduce Labor mobile hero/actions using native disclosure; preserve every action and label.
- [x] Put the selected indicator reading before history, with related context below history.
- [x] Correct earnings wording, inflation question, interest-burden heading and conditional overlay note.
- [x] Update intentional structure assertions without removing data/provenance/range safeguards.

## Integration and delivery

- [x] Review changes against the approved scope and run the complete tests, build and strict smoke check.
- [x] Inspect local desktop/mobile layouts and keyboard behavior in Light and Graphite; retain screenshots.
- [x] Obtain independent review and address actionable findings.
- [ ] Commit verified changes, push codex/research-review-fixes and open a new PR against main.
- [ ] Stop without merging, dispatching workflows or deploying.
