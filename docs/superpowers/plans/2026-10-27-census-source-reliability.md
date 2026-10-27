# Census source reliability implementation plan

> Use subagent-driven development for the independent alert and Census tasks; keep evidence under local `tmp/census-reliability/`.

**Goal:** Restore reliable Census collection and verifiable automatic alerts without changing the UI or source semantics.

**Architecture:** Reuse the existing bounded HTTP collectors and safe report reader. Correct source-specific transport routing/retries only after official probes, and bind rerun artifacts to their producing job rather than artifact order.

**Tech Stack:** Existing Node.js, native fetch, ZIP parser and tests; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-27-census-source-reliability.md`.

## Constraints and review focus

- Same UI/colors, exact statistical definitions, source limits, immutable capture prefix and original retained evidence.
- Failures preserve last-good data; only genuine successful retrieval may establish recovery.
- Report attempts cannot cross job windows; artifact IDs/order are not clocks.
- Reject redirects, wrong programs/units, malformed or oversized files and ambiguous report evidence.
- No account, secret, paid source or speculative service abstraction.

## Tasks

- [x] Alert evidence: reproduce duplicate-artifact rejection; add failing job-window tests, implement the minimal reader/caller fix, verify unsafe/ambiguous/stale cases and independent review. Owner: alert_report_reliability; files: scripts/read-source-attempt-artifact.mjs, scripts/data-update-maintenance.mjs and their existing tests. Six regressions added; focused 38/38, independent inherited-job check passed.
- [x] Census transport: probe approved files and official alternatives; record exact working route and numerical/schema equivalence; add failing regressions before the smallest routing/retry correction; verify full-history admission and immutable prefix. Root owns shared HTTP changes; census_source_probe supplies read-only official evidence. Exact ZIP hashes and all 2,736 existing observations match; no data/history/source-definition files changed. HTTP520 regression failed before the one-line fix; combined focused suite passes 66/66.
- [ ] Integration/release: full tests and build, independent whole-change review, publish existing cloud workflow, verify Census and all-source checks plus alert report/recovery, compare live assets, update evidence and synchronize primary checkout.

## Ledger

- Investigation: housing HTTP520 is excluded from transient retries. A source-job rerun leaves two valid same-name artifacts and the reader rejects both before download. Source job/time evidence is available; artifact IDs are not chronological.
- Independent implementation review: no critical or important findings; genuine source semantics, bounds and all artifact safeguards remain intact. Full local suite and actual collector check are running; cloud recovery/publication are pending.
- Ruling: continue the requested bug fixes without a separate design approval round; scope and unchanged UI/source constraints are explicit in the user request. No new feature or provider agreement is authorized.
