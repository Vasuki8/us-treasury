# Official data implementation plan

**Goal:** Replace production samples with official Treasury/BLS/BEA observations and verify local/CI behavior.

**Spec:** `docs/superpowers/specs/2026-10-21-official-data-design.md`

**Architecture:** Explicit Node refresh into a committed static snapshot; independent source adapters; shared series metadata and truthful availability; existing frontend consumes the normalized shape.

- [ ] Verify official endpoints and series definitions for all three agencies.
- [ ] Write parser/transform tests before implementing source adapters.
- [ ] Add official registry, snapshot hydration, provenance and failure preservation.
- [ ] Refresh and reconcile actual responses; remove production synthetic histories and invented events.
- [ ] Update page labels, calendar states, charts, metadata and CSV provenance.
- [ ] Update deterministic model/page/navigation tests without weakening calculations.
- [ ] Run full tests, build, built-output smoke check and local browser QA.
- [ ] Complete independent code review; fix correctness findings.
- [ ] Commit and push to origin/main, then verify CI result.

Constraints: no new paid providers, no external publication other than the requested Git push, no assumed API keys, no scheduled jobs or fake release/revision metadata. DOL/Census measures stay visible without values until their official sources are integrated.
