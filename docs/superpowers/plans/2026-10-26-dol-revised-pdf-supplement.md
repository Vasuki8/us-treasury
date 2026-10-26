# Confirmed DOL PDF Supplement Implementation Plan

> **For agentic workers:** Use subagent-driven-development or executing-plans to implement these tasks. Preserve the existing source and archive guarantees.

**Goal:** Keep revised claims current with confirmed dated-PDF priors while retaining the 1967 XML history and current UI/colors.

**Architecture:** A wrapper collector reuses strict XML/PDF parsers, downloads at most eight new official releases per run, retains earlier verified PDF evidence and appends a continuous tail. A versioned admission profile proves per-row receipts and XML overlap. Existing chart/export/replay paths carry that metadata.

**Tech Stack:** Existing native Node ES modules, fetch, bounded unpdf worker and node:test; no new dependency.

**Spec:** `docs/superpowers/specs/2026-10-26-dol-revised-pdf-design.md`

## Global Constraints

- Keep the current UI and colors; retain both advance series separately.
- At most eight new PDFs per run and two annual index POSTs; 4 MiB/PDF and bounded parser/worker limits. Retained verified PDF rows/receipts preserve their original clocks.
- Preserve all native count strings, nulls, Saturdays, prior captures, actual receipt clocks and existing package limits.
- User approved the source approach with “continue”; execute and verify without another source-choice pause.

## Review Focus

- Rollover/holiday dates: use published links, never inferred Thursday URLs.
- Missing/mismatched overlap and annual revisions: reject mixed or incomplete histories.
- XML recovery and disappearance of a prior PDF: never shrink retained coverage or reset old receipt clocks.
- Profile removal/tampering: cannot bypass feed or observation-source admission.
- Full-size exports and old captures: scoped receipts must survive exact CSV/package/replay without retrofitting old metadata.

### 1. Collector

Files: create `scripts/sources/dol-revised.mjs`, `tests/dol-revised.test.js`.

Interface: `collectDolWithRevisions({previous,now,fetchImpl,extractPdf,maxAttempts,pause})` returns the existing DOL source shape plus the spec profile when supplementing. Reuse `collectDol`, `parseDolAdvanceText`, `extractDolAdvancePdf` and shared HTTP limits/retries. Export `discoverDolReleases(html,{year,now})` if useful for direct discovery tests.

- [x] Write failing discovery/collector tests for the October bridge, separate target weeks, overlap, unknown roles/notices, gaps/cap, rollover, no shrink, XML catch-up and annual barrier.
- [x] Implement the bounded collector and confirm tests pass, including successful-response receipts only.
- [x] Independently review its source scope and boundary handling.

Ruling during implementation: retain previously admitted PDF tails and their notice context rather than repeatedly rebuilding all weeks from a potentially frozen XML endpoint. The eight-request cap applies to new downloads, with old receipt clocks preserved and a separate 10,000-receipt ceiling matching the existing observation bound. This prevents a new eight-week freeze while keeping bounded backfill and annual-regime safeguards. Scan notice context beyond the first matching overlap; exact comma formatting alone is not a count disagreement.

### 2. Admission

Files: create `scripts/dol-revised-policy.mjs`, `tests/dol-revised-policy.test.js`; update `scripts/data-policy.mjs`, `scripts/macro-coverage-policy.mjs`.

Interfaces: `hasDolRevisedHistory(source)`, `matchesDolRevisedFeed(value)`, `assertDolRevisedHistoryData(source)`; literal profile and row fields follow the spec. Existing unprofiled XML captures remain valid; new receipts/overrides require the complete new contract.

- [x] Write failing positive/negative tests for exact feeds, roles, counts, dates, hashes, clocks, overlap, continuous tails, annual barriers and downgrade attempts.
- [x] Implement the minimal scoped admission and pass both new and existing data-policy tests.
- [x] Independently review collector output against admission.

### 3. Integration and Delivery

Files: update `scripts/refresh-data.mjs`, `src/vintages.js`; add integration regressions and update source documentation.

- [x] Preserve the new profile/publication note in replay without changing old capture identity; test actual scoped CSV and portable package round trips.
- [x] Wire only DOL to the wrapper with previous DOL state; keep the base primitive and advance collector unchanged.
- [x] Capture actual revised data through the reviewed CLI; verify expected new dates/counts, all old rows/captures, and independent review.
- [ ] Run full tests/build/smoke, publish through existing trusted CI, verify both runtimes, live assets and alert outcomes.
- [ ] Record actual capture/deployment evidence and synchronize the primary checkout.
