# Funding and credit history implementation plan

> **For agentic workers:** Use subagent-driven-development or executing-plans. Track each task below.

**Goal:** Extend existing funding and credit histories to economically useful comparable regimes, preserving UI, old evidence and working research downloads.

**Architecture:** Keep each dataset's own start and method rather than a shared retention cutoff. Exact existing feeds and identifiers provide new old-date facts. Preserve complete frozen source inputs; remove only duplicated derived CSV storage through an explicit versioned, deterministic generated full-retained export profile. The default/All feasibility probe passes without trimming any source rows.

**Tech Stack:** Existing JavaScript, Node test runner and collectors; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-funding-credit-history.md`.

## Global constraints and review focus

- Keep current UI/colors, all 213 immutable captures and existing stored size limits unchanged.
- No earlier EFFR mean, modeled SOFR, pre-SBN2024 dealer series, old-method DSR or unclassified RRP tests.
- Preserve source `NA`, `r`, footnote identifiers and meaning without numeric coercion or synthetic release clocks.
- Match every existing numeric overlap; expose native inceptions and unmatched effective dates.
- Old saved packages stay byte-identical. Full source inputs cannot be trimmed to pass a cap; generated exports must be explicit, versioned and bounded.

## Tasks

- [x] Credit: failing regressions, provider-specific 1990/1991 floors, exact source metadata and admission; verify 1,260 additional observations, same overlaps and measured package fit.
- [x] Funding: failing real-sample regressions, independent native rate URLs, per-type/legacy admission, missing bands, source notes and revision flags; verify event identities and unchanged dealer data.
- [x] Export compatibility: use the measured generated-full-retained market profile; retain complete frozen source, version and bound deterministic CSV generation, preserve legacy original attachment bytes and existing download controls. Keep ordinary full CSV behavior and stored caps unchanged.
- [x] Capture and acceptance: strict affected-source retrieval, immutable prefix/other-source proof, current/replayed/scoped admission, package round trips and independent review.
- [x] Release: complete focused/full test and build checks, publish through existing gates, verify actual live data and sources, update evidence and synchronize checkouts. All 1,862 tests pass locally and on Node 22/24; 163 live assets match. The separate read-only source retry retains open Census housing/retail and attempted-report incidents, documented in the expansion report; all four extended feeds pass.
