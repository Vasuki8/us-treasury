# Stitch Page Fidelity Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans. Work only within the assigned file boundaries; the root agent owns shared route, admission, refresh, storage, research-context and stylesheet integration.

**Goal:** Implement all canonical Stitch page compositions with real official public data and precise coverage states.

**Architecture:** Explicit page templates use existing UI/chart atoms and native source models. Scoped official source extensions supply new detail series and tables; shared registry, lazy loading, refresh and frozen-evidence integration remain centralized.

**Tech Stack:** Existing native ES modules, CSS/SVG and Node built-in tests, HTTP/ZIP/XML/PDF utilities.

**Spec:** ../specs/2026-11-01-stitch-page-fidelity.md

## Global constraints

- Official public data only; actual receipts and reuse evidence; no sample metrics or invented services.
- Preserve all prior 32 inputs, immutable history, source checks, 20 MiB limits, exports and research reliability.
- Use exact reference geometry/content slots; readable missing-data and scenario labels are required.
- New PR only, no merge or deployment.

## Review focus

- Source-loaded detail panels must not treat unloaded inputs as unavailable or silently mix capture vintages.
- CES/CPS/ECI/PRS frequencies, SA/NSA bases, levels/rates and exact calculation periods must remain distinct.
- Market observations, official projections, survey aggregates and scenario assumptions must never be interchanged.
- Capture failures, suppressions, missing endpoints and older source dates remain visible without fabricated latest values.
- New visible chart/table inputs must survive self-contained frozen capture and exact CSV round trips.

## Tasks

- [x] Inventory all 26 canonical artifacts; retain exact HTML, section/KPI/chart/table/action mappings and data gaps.
- [x] Confirm official-public-only constraint and source feasibility; identify provider-only fields explicitly.
- [x] Add scoped BLS specialist definitions, bounded collection, transformations and shared schema/admission checks with failing-first regression tests. Preserve existing BLS/history scope.
- [x] Add public BEA/Cleveland detail inputs and exact CPI/PCE reconciliation, with explicit units/rights/missing-month rules.
- [x] Add scoped Fed/NYFed/OFR/ECB/Treasury public specialist captures and models from reviewed contracts; extend existing admitted feeds when safe.
- [x] Restore Overview/Labor compositions and eight exact family-specific indicator templates, preserving all source and action contracts.
- [x] Implement missing specialist desk templates and real scoped chart catalogs; preserve existing tools through meaningful links.
- [x] Implement FX scenario states and both source-backed CSV matrix exports, with observed versus assumed inputs explicit.
- [x] Integrate new page identities, source requirements, navigation, refresh objectives, registry/source policy and frozen captures centrally.
- [x] Match reference styling, tables, chart grids/annotations and responsive behavior; preserve contrast and keyboard fixes.
- [x] Collect/admit new public datasets, preserving existing snapshots/history and actual timestamps; verify real-source fixtures and rejection cases.
- [x] Run full tests/build/strict smoke, compare every reference page visually, and obtain independent review.
- [x] Open code PR #32 and stacked draft data PR #33; leave both unmerged and undeployed.

## Source extension interfaces

Scoped collectors return the existing source shape: id, status, fetchedAt, series, provenance and coverageNote, with optional named specialist tables carrying their own reference/projection dates. Definitions expose stable local IDs and exact official codes, units, frequency and adjustment. Collectors/definitions/shared validation can be implemented independently; root integrates registry, global admission, lazy loading and refresh objectives.

Use a separate blsDesk family for new CES/CPS/ECI/PRS inputs, leaving the existing 20-input/31-output BLS capture and history untouched. Respect public API batch/year limits. Other source-family contracts and URLs are retained in output/stitch-page-audit-2026-11-01/source-gap-research.json; exact catalogs still require bounded implementation probes.

Keep route templates separate from source collection. Reuse one FX renderer with base, fed-cut and policy-divergence state. Treat the two zero-dimension artifacts as CSV export specifications, not blank browser pages.

## Delivery adjustment

The complete synthetic PR merge also has an 8 MiB delta limit. Preserve all full captures and original history using stacked code and data PRs, rather than changing storage formats, rounding numbers, dropping observations or raising a budget. The second PR initially targets the code branch and requires retargeting/rebasing after the first merges for the existing main-only CI policy. Neither is merged or deployed here.
