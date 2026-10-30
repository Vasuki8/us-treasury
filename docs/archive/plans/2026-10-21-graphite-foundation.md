# Meridian Graphite Foundation Implementation Plan

> **For agentic workers:** Use the native execution workflow with independent data/page subtasks and a final fresh review. Steps use checkbox syntax.

**Goal:** Develop the selected five-page Graphite mockup into a runnable and verifiable local frontend.

**Architecture:** A static ES-module app with a synthetic provider boundary, pure analytical helpers, hash routes, shared page primitives, responsive SVG charts, and a small controller. Node serves and builds the app without installing dependencies.

**Tech Stack:** JavaScript modules, CSS, SVG, Node.js >=22, node:test.

**Spec:** `docs/superpowers/specs/2026-10-21-graphite-foundation-design.md`

## Global constraints

- Preserve original design artifacts.
- All data in this milestone are explicitly synthetic; no current economic claims.
- Never silently aggregate, interpolate, or fill observations.
- Local only; no accounts, external writes, or hosting registration.
- Use native JavaScript modules, CSS, SVG, and Node.js 22 or newer.

## Review focus

- Mixed-frequency comparisons must keep native panels or expose an explicit common baseline.
- Missing or zero prior values must not turn into invented percentage changes.
- Invalid links and unknown series must resolve safely without crashing.
- Corrupt or denied browser storage must preserve usable session behavior and report persistence failure.
- Filtered empty calendars/catalogs must explain their empty state without stale detail panels.

## Task 1: Data boundary and analytical behavior

Files: `src/data.js`, `src/model.js`, `tests/model.test.js`.

- [x] Write and run failing tests for canonical dates/frequencies, aliases/filtering, changes/rebasing with missing values, and CSV metadata/escaping.
- [x] Implement catalog, releases, curves and pure functions using the agreed interfaces in the delegated task.
- [x] Run the data tests and inspect all failures.

## Task 2: Pages and shared markup

Files: `src/ui.js`, `src/pages.js`.

- [x] Implement five page renderers returning escaped semantic HTML and chart descriptors.
- [x] Cover page output, empty filters, actual/forecast distinction, and different frequency labels with meaningful checks.
- [x] Leave all event handling to `src/app.js`; chart rendering to `src/charts.js`.

## Task 3: Shell, routing, charts, and persistence

Files: `index.html`, `styles.css`, `src/app.js`, `src/charts.js`, `src/router.js`, `src/storage.js`, `tests/navigation.test.js`.

- [x] Write/run route and persistence failure tests before implementing their behavior.
- [x] Build Graphite shell matching selected reference and wire URL navigation, searches, transforms, comparisons, saves and exports.
- [x] Render responsive SVG charts with exact observation readouts and keyboard controls.
- [x] Verify browser behavior on all five pages and narrow layout.

## Task 4: Tooling, review, and handoff

Files: `package.json`, `server.mjs`, `scripts/build.mjs`, `README.md`, `.gitignore`.

- [x] Add dependency-free development server and static build.
- [x] Run complete tests, syntax checks, and production build.
- [x] Obtain independent review; resolve correctness findings and rerun affected checks.
- [x] Record verification and local usage instructions; show the local preview.

## Execution notes

The workspace contains prototypes and is not a Git repository; work in the supplied directory and do not invent a remote or create worktrees. The user has requested development after choosing the layout in the prior planning chat; proceed with that direction. No commit or deployment is part of this milestone.
