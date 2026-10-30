# BEA current-account implementation plan

> **For agentic workers:** Use the existing source-admission, test-first and verification workflows. Each task below has a focused test/review boundary.

**Goal:** Add commercially reusable official BEA current-account balances and their accounting components to Meridian, preserving Graphite and the existing research tools.

**Architecture:** Use a separate `beaIta` collector and source policy, independent of NIPA. Register the official quarterly balances, expose a Trade & current account family, and reuse indicator details, native comparisons, CSV, source freshness and immutable source-split history. Add a compact accounting-change explanation with exact prior quarters and visible missingness.

**Tech stack:** Existing dependency-free browser modules, Node collectors, reviewed official bulk data; no credentials, paid services or new infrastructure.

**Spec and choices:** The user requests official BEA current-account data with commercial reuse, local tests and a repository push. An independent ITA source is preferable to expanding the NIPA capture because definitions, units, release timing and failures differ. An existing Economy family is preferable to a new top-level dashboard. Exact endpoint/table/field mappings and reuse evidence will be documented in `docs/bea-current-account-source-review.md` before admission.

## Constraints and review focus

- Current account includes goods/services plus primary and secondary income; NIPA goods/services trade is a different measurement.
- Quarterly ITA amounts are seasonally adjusted, not annualized; preserve negative balances, source precision and original period labels.
- Verify official endpoint, field identities, units, geographic scope, coverage and rights before connecting real values. Reject malformed, duplicate or incompatible responses.
- Preserve missing values and exact prior-quarter alignment. Component differences are accounting contributions, not causal explanations or market surprises.
- Keep publication and retrieval dates separate. Do not invent historical vintages or change any retained capture.
- Reuse Graphite, comparison classifications, exports, frozen results, source health and daily refresh/deployment conventions.

## Tasks

### 1. Reviewed source and collector

- [x] Verify keyless official ITA data and reuse terms; document exact scope and cadence.
- [x] Write failing parser/collector/admission tests for identity, SA/nonannualized units, date/number/missing handling, reconciliation and source provenance.
- [x] Implement the smallest bounded collector and source policy, then pass focused tests.

### 2. Research integration

- [x] Register current account and official component balances with safe comparison classes; add the Economy family and accounting-change panel.
- [x] Wire automatic refresh/freshness and scoped warnings; verify no GDP/PCE release linkage is invented.
- [x] Test exact/missing prior quarters, source failures, CSV metadata, frozen-result reconstruction and immutable replay.

### 3. Capture and acceptance

- [x] Capture genuine official data through the normal admission/writer pipeline; verify all original archives remain exact.
- [x] Run the complete tests and production asset checks; validate desktop/mobile, keyboard, loading/error states and exports locally.
- [x] Review, commit/push to `Vasuki8/us-treasury`, verify Actions and representative live pages before claiming live.

## Local acceptance evidence

- Genuine direct CSV receipt: 2026-10-23T04:21:42.080Z; table release 2026-09-24, next listed release 2026-12-18. Six balances each retain 266 quarters, 1960Q1–2026Q2. Current account is −$246.023 billion in 2026Q2, a $33.426 billion widening against the exact preceding quarter.
- Node 24 complete suite: 1,046/1,046 tests pass. Node 22 focused collector, current-account view/integration/import, vintage/admission and navigation checks: 47/47 pass. Production build and HTTP smoke check: 128 assets pass.
- Original 72 immutable captures, all three publication/explanation modules, 22 existing current sources and existing calendar remain unchanged. File hashes cover 75 original archive/publication files. One independent ITA baseline capture was appended. Before-capture replay remains exact and has no invented ITA history; after-capture source-scoped replay matches all six histories.
- Desktop 1440px, mobile 390px and narrow 320px inspected in Graphite: one main heading, no page-wide horizontal overflow, locally scrollable tables, mobile More navigation and keyboard CSV export. Native family comparisons, signed-balance indexing rejection, all-history detail, source-scoped retrieval history and frozen accounting replay verified. Browser error log was empty. Missing/loading/error/cached states and CSV contents are covered in focused tests.
- Independent source and integration reviews completed. A malformed supplementary-input import was fixed at package validation, with checksum-valid malformed-file regressions; genuine packages and original CSVs round-trip exactly. An existing navigation test was extended to include the new family.
- The normal daily objective check includes ITA and confirms the current slot complete, retaining the authorized BLS calendar exception. No credentials, paid service, dependency or infrastructure was added.

## Scope limits

This is current revised ITA history, first captured on its actual retrieval date. Historical first-publication values and period-specific publication instants remain unavailable. No current-account/GDP ratio, country breakdown, financial-account stock estimate or inferred cause is added. ITA quarterly balances and NIPA SAAR trade remain separate measurements. The existing BLS calendar stays visibly cached.

## Verified deployment

Runtime commit `fcdc65271980c84454c39842484611d116eb0ecf` was pushed to `main`. [Actions run 39900808740](https://github.com/Vasuki8/us-treasury/actions/runs/39900808740) completed successfully, including complete Node 22 and Node 24 verification and GitHub Pages deployment. The daily refresh objective was already satisfied, so no redundant all-source refresh ran. Cloudflare configuration remains deferred.

A clean LF checkout of this exact commit built successfully; all 128 published assets matched its build byte-for-byte. The live Trade & current account family showed the genuine capture and quarter/component arithmetic. Full-history indicator detail and keyboard CSV export worked, and the source-scoped retrieval-history page loaded captured ITA definitions/terms. No browser errors were recorded. Graphite screenshot: `test-results/current-account-live.png` (local acceptance artifact, not committed). This documentation-only completion record does not alter deployed runtime assets.
