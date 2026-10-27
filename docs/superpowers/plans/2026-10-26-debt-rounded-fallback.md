# Official rounded debt fallback implementation plan

> **For agentic workers:** Use subagent-driven-development or executing-plans. Track each task below.

**Goal:** Repair the one reviewed debt day with official DTS million-precision figures while retaining contradictory raw evidence and the current UI/colors.

**Architecture:** One shared, date-specific profile binds an exact primary triple and an exact official PDF. Both debt collectors use the same coherent row. A dedicated admission check validates its row metadata and receipts in current and normalized/scoped sources; generic views/exports expose the note and precision without layout changes.

**Tech Stack:** Existing JavaScript/Node test runner and requestBytes; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-26-debt-rounded-fallback.md`.

## Constraints and review focus

- Keep UI, colors, all source/package size limits and all 211 published captures unchanged (including the original 188 and the intervening 23-source scheduled refresh).
- Never replace a reconciled primary record or apply the exception to another date/raw triple/PDF.
- Rounded strings must remain distinguishable from USD pennies in every CSV and frozen package.
- Missing evidence must not admit guessed numbers; source receipt clocks cannot exceed capture clocks.
- A selected export that omits the repaired date must still round-trip; old captures/packages must remain exact.

## Tasks

- [x] Collector task: add failing regression, exact profile and bounded PDF receipt validation; integrate both collectors and fiscal breakdown with primary precedence.
- [x] Admission task: add failing adversarial tests, narrow supplemental-feed admission and validate row units/precision/raw triple/hash/clocks; preserve old normalized sources and selected packages.
- [x] Presentation task: expose note, original million string/unit/precision and row receipts in existing detail/CSV paths; regression-test round trips.
- [x] Acceptance task: refresh only affected sources with genuine retrievals; prove old archive prefix exact, unchanged unrelated sources and only the intended historical numerical changes. Review independently.
- [ ] Release task: complete focused/full tests, build checks, publish through existing workflow, verify cloud/live output; record evidence and update source review status.
