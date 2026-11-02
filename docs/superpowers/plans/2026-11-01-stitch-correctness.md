# Stitch correctness implementation plan

> For agentic workers: use subagent-driven development or inline execution. Keep the audit's stages in order.

**Goal:** Correct the confirmed publication-selection, source-qualifier and measurement-label defects before restoring analytical views.

**Architecture:** Repair existing collectors, validators and renderers at their shared boundaries. Continue to distinguish source observations, estimates, projections and assumptions. Retain historical captures and existing source admission checks.

**Tech stack:** Existing JavaScript modules, Node test runner, unpdf and native HTML controls; no new dependencies.

**Spec:** `output/stitch-live-deep-review-2026-11-01/deep-review.html` and its linked findings. The approved sequence is correctness → retained-data views → official public additions → compact layout and stronger parity verification.

## Global constraints

- Use official public data only; do not fabricate quotes, vintages or forecasts.
- Preserve all history, the 20 MiB limit, source receipts and refresh safeguards.
- No merge or deployment is included in this implementation batch.
- Reuse this isolated worktree; keep unrelated untracked audit artifacts out of the PR.

## Review focus

- A fresh retrieval may contain a superseded publication; select by supported publication/version evidence.
- Unknown, malformed, ambiguous or cross-origin schedule formats must fail admission.
- A lower bound on the announced maximum must not become a fixed amount or actual purchase.
- String and structured source notes must remain readable, deduplicated and escaped.
- Chart metadata must describe plotted series while selected table/CSV metadata stays native.

## Tasks

### 1. Publication selection and buyback amount semantics

Files: `src/refunding-desk.js`, `scripts/sources/refunding-desk.mjs`, focused tests and reviewed fixtures. UI integration in `src/specialist-desks-page.js`.

- [x] Reproduce older XML selection with a newer official PDF listed on the same index.
- [x] Add failing tests for reviewed document selection, amount qualifiers, unknown formats, provenance and historical XML compatibility.
- [x] Parse the current reviewed PDF format without removing existing XML validation; record source publication/version and bound semantics.
- [x] Render tentative maximum qualifiers in both Refunding and Liquidity.
- [x] Verify old history and future-quarter fixtures retain their admission guarantees.

### 2. Source footnotes and Labor estimate stage

Files: shared note helper, `src/stitch-family-view.js`, `src/stitch-family-analysis.js`, `src/stitch-indicator-context.js`, `src/labor-page.js`, focused tests.

- [x] Add a failing structured-footnote test covering preliminary text, codes, duplicate notes and HTML escaping.
- [x] Normalize notes at shared presentation boundaries; remove object stringification.
- [x] Display retained estimate qualifiers in the Labor catalog separately from capture state.
- [x] Verify missing qualifiers do not fabricate a preliminary label.

### 3. Measurement and source labels

Files: `src/indicator-page.js`, `src/stitch-family-view.js`, `src/specialist-desks-page.js`, focused tests.

- [x] Reproduce annual ECI overlays labelled as quarterly growth.
- [x] Derive chart footer metadata from plotted series, preserving selected-series table/CSV semantics.
- [x] Correct settlement-fails reporting form to FR2004C.
- [x] Make EUR/USD labels consistent with USD-per-EUR arithmetic.

### 4. Verification and reviewable release

- [x] Run focused tests, the complete suite and the production build.
- [x] Inspect affected local pages on desktop/mobile, including both themes.
- [x] Obtain an independent diff review and resolve material findings.
- [ ] Open a PR containing this correctness batch; do not merge or deploy.

## Subsequent ordered batches

After correctness, restore retained-data chart modes, overlays, ledger fields and exports. Next extend reviewed official ingestion for DOL averages, source quality/vintages, SOFR averages, custody, SEP history and other admitted public gaps. Finally tighten labels, tables, source notices and mobile information order. Each batch requires its own evidence and source/measurement contracts; licensed or unverified reference content remains unavailable.

## Execution record

Ruling: treat the approved sequence as ordered, reviewable batches. The first PR isolates current-data correctness from wider analytical/layout changes, so those changes cannot obscure publication or unit regressions.

| Task pair / task | Shared interface or self-check | Ruling |
| --- | --- | --- |
| Publication selection / specialist rendering | Buyback rows carry the announced maximum and its qualifier | Collector owner supplies semantics; renderer owner formats without inferring execution |
| Indicator footnotes / Labor qualifiers | Shared source-note normalization | Indicator owner supplies helper; Labor consumes it |
| Indicator units | Plot basis differs from selected-series basis | Keep the table/CSV native and label the plot separately |
| Source labels | Text-only corrections with economic meaning | Verify official form and quote orientation; do not alter arithmetic |
| Verification | Real fixtures, historical guarantees, live-like browser | Full suite and independent review precede PR |

Baseline branch: `origin/main` at `9f791db32b58ff970818fab11bbdd18e326f70b9`. Working branch: `codex/stitch-audit-corrections`.

Verification: full regression suite passed 2,603 tests; the subsequent publication-boundary correction passed 21 focused tests and an independent re-review. The final production build passed. Seven affected routes were checked at 1280 px and 390 px in Light and Graphite (28 states), with no object-string notes or document-wide horizontal overflow. Existing snapshot/history bytes were not modified.
