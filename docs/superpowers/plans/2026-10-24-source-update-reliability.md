# Remaining source reliability implementation plan

> **For agentic workers:** Use systematic debugging and TDD for each confirmed failure; implement the independent DOL parser/calendar tasks in parallel, then review the complete patch.

**Goal:** Check every remaining registered source, repair confirmed automatic-update failures, and verify from the production runner while preserving the current UI and colors.

**Architecture:** Keep existing reviewed official feeds, collector registry, rights gates, atomic snapshot publication and immutable archives. Exclude only a structurally validated empty DOL placeholder; retain today's actual rule-based schedule for release retries. Use the existing refresh command in an isolated, read-only-permission Actions job for optional source diagnostics, without publishing its candidate snapshot.

**Tech stack:** Node 22/24 built-ins, existing locked PDF dependency, GitHub Actions.

**Spec:** User request in this chat, October 24, 2026; preserve UI/colors, inspect remaining data feeds and fix similar update/release-check issues.

## Constraints and review focus

- Do not change UI, themes, measurements, units, approved endpoints or frozen history.
- Never retry an access denial or substitute an unreviewed mirror.
- Excluded DOL rows must contain no count, rate or employment observations; validate dates, fields, duplicates and row bounds before exclusion.
- Same-day DOL events remain schedules, not evidence that a release occurred. Exclude earlier Eastern dates and honor Wednesday exceptions.
- Transient HTTP failure handling must remain bounded, respect Retry-After, and retain original successful capture timestamps on failure.
- Hosted diagnostics must not commit, push or deploy the candidate data, and should be explicitly opt-in.

## Task 1: DOL historical XML placeholder

Files: `scripts/sources/dol.mjs`, existing DOL parser tests.

- [ ] Reproduce official HTTP200 failure and record response hash and exact row shape.
- [ ] Write and observe a failing regression for a non-Saturday seasonal-factor-only placeholder between valid weekly observations.
- [ ] Skip only validated empty placeholders with a dated warning; reject non-Saturday numeric observations, malformed/duplicate records and invalid factors.
- [ ] Verify the real saved response and the focused source/retention/admission tests.

## Task 2: Claims release retry coverage

Files: `scripts/sources/calendar-dol.mjs`, `tests/calendar-dol.test.js`, `tests/dol-calendar-release-refresh.test.js`.

- [ ] Reproduce a late full refresh removing today's due event and incorrectly ending retries.
- [ ] Observe failing real-parser/refresh/planner regressions for Thursday and the published Wednesday exception.
- [ ] Retain the current Eastern day's schedule throughout that day within the existing coverage window; never expand earlier dates.
- [ ] Verify old results remain eligible for retries and verified current results complete the objective.

## Task 3: Bounded transient failure recovery and hosted audit

Files: shared HTTP helper/tests if justified by reproduction; `.github/workflows/ci.yml`, `tests/workflow-refresh.test.js`.

- [ ] Distinguish BLS HTTP503 from documented API limits; test whether an unchanged official request recovers.
- [ ] If warranted, add at most one transient HTTP retry with short bounded Retry-After, no denial/schema/redirect retries, and corresponding red/green tests.
- [ ] Add optional `check_sources` manual input and independent read-only-permission source audit job using the existing full refresh/validation command, retaining logs and never publishing its candidate snapshot.
- [ ] Test dispatch eligibility and verify actual all-source collection on a branch in Actions.

## Task 4: Review and publish verified fixes

- [ ] Review all source audit receipts, newest usable reference dates and expected source lags.
- [ ] Run full tests, build, smoke verification and independent patch review.
- [ ] Publish fixes, verify main's actual refresh/upkeep outcomes and compare live assets to the verified build.
- [ ] Record source inventory, confirmed fixes, evidence, cached BLS calendar limitation and unresolved provider issues. Update stale documentation counts.

## Execution ledger

- Tasks1–2 implemented and independently reviewed: DOL exact-empty-factor exclusion and current-Eastern-day schedule retention. Focused parser/history31 passed; calendar/planner15 passed, with expected red failures before implementation.
- Task3 HTTP ruling: leave shared HTTP defaults unchanged. Two real BLS503 busy responses establish provider unavailability, not that a bounded retry would restore access. No endpoint, header, credentials or access-denial workaround was introduced.
- Task3 hosted diagnostic implemented using `--check-only`, the existing registry and snapshot assembly/admission gates. It writes only ignored metadata. Three real-CLI regressions cover collector failure, admission failure and the explicit cached-calendar exception; all preserve original snapshot bytes.
- Review found and fixed missing diagnostic artifacts on admission failure. Normal publication still throws before writes; only check mode retains a failed admission report.
- Integrated local suite1,511 passed; added admission regression independently passed. Initial sandbox baseline failures were environment restrictions and the permitted integrated run resolved them. Hosted verification will run the final complete suite.
